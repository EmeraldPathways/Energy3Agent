import { Router, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { FeedbackItemSchema, FeedbackTargetSection, RevisionDecisionSchema } from '@ai-campaign/shared';
import { getDb } from '../db.js';
import {
  runCreatorPlan,
  runTextContent,
  runImageryCreative,
  runMarketResearch,
} from '../agents/runPhase5.js';

const router = Router();

interface ProjectRow {
  id: string;
  name: string;
  description: string;
  status: string;
  intake: string;
  created_at: string;
  updated_at: string;
}

function parseIntake(intake: string) {
  try {
    return JSON.parse(intake || '{}');
  } catch {
    return {};
  }
}

// ── POST /api/projects/:id/feedback ──
router.post('/:id/feedback', (req: Request, res: Response) => {
  const db = getDb();
  const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id) as ProjectRow | undefined;
  if (!row) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  const intake = parseIntake(row.intake);

  // Gate: must have specialist outputs before submitting feedback
  if (intake.specialistsStage !== 'generated' && intake.specialistsStage !== 'review') {
    res.status(400).json({ error: 'Specialist outputs must exist before submitting feedback' });
    return;
  }

  const { targetSection, feedback } = req.body;
  if (!targetSection || !feedback) {
    res.status(400).json({ error: 'targetSection and feedback are required' });
    return;
  }

  const parsed = FeedbackTargetSection.safeParse(targetSection);
  if (!parsed.success) {
    res.status(400).json({ error: `Invalid targetSection. Must be one of: ${FeedbackTargetSection.options.join(', ')}` });
    return;
  }

  const item = {
    id: randomUUID(),
    targetSection: parsed.data,
    feedback: String(feedback).trim(),
    createdAt: new Date().toISOString(),
  };

  FeedbackItemSchema.parse(item);

  const feedbackItems: Record<string, unknown>[] = Array.isArray(intake.feedbackItems) ? intake.feedbackItems : [];
  feedbackItems.push(item);
  intake.feedbackItems = feedbackItems;

  db.prepare('UPDATE projects SET intake = ?, updated_at = ? WHERE id = ?').run(
    JSON.stringify(intake),
    new Date().toISOString(),
    req.params.id,
  );

  res.status(201).json({ data: item });
});

// ── POST /api/projects/:id/agents/revise ──
router.post('/:id/agents/revise', async (req: Request, res: Response) => {
  const db = getDb();
  const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id) as ProjectRow | undefined;
  if (!row) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  const intake = parseIntake(row.intake);

  // Gate: must have feedback items before revision
  const feedbackItems: Record<string, unknown>[] = Array.isArray(intake.feedbackItems) ? intake.feedbackItems : [];
  if (feedbackItems.length === 0) {
    res.status(400).json({ error: 'No feedback to revise. Submit feedback first.' });
    return;
  }

  // Gate: must have specialist outputs
  if (intake.specialistsStage !== 'generated' && intake.specialistsStage !== 'review') {
    res.status(400).json({ error: 'Specialist outputs must exist before revising' });
    return;
  }

  // Gate: must have approved brief
  if (!intake.briefApproved) {
    res.status(400).json({ error: 'Brief must be approved before revising' });
    return;
  }

  // Gate: must have creator plan
  if (!intake.creatorPlan) {
    res.status(400).json({ error: 'Creator plan must exist before revising' });
    return;
  }

  // Use the latest feedback item's target section
  const latestFeedback = feedbackItems[feedbackItems.length - 1] as { targetSection: string; feedback: string };
  const targetSection = latestFeedback.targetSection;

  // Determine target agent from target section
  const targetAgentMap: Record<string, string> = {
    brief_strategy: 'manager',
    creator_plan: 'creator',
    text_content: 'text-content',
    imagery_creative: 'imagery-creative',
    market_research: 'market-research',
  };
  const targetAgent = targetAgentMap[targetSection] || 'unknown';

  // Determine if strategy changed (brief_strategy or creator_plan => strategy change)
  const strategyChanged = targetSection === 'brief_strategy' || targetSection === 'creator_plan';
  const briefReapprovalRequired = targetSection === 'brief_strategy';

  // Create revision decision
  const decision = {
    id: randomUUID(),
    targetSection,
    targetAgent,
    reason: latestFeedback.feedback,
    strategyChanged,
    briefReapprovalRequired,
    invalidatedSpecialists: strategyChanged,
    createdAt: new Date().toISOString(),
    completedAt: null as string | null,
  };

  RevisionDecisionSchema.parse(decision);

  // Save decision
  const decisions: Record<string, unknown>[] = Array.isArray(intake.revisionDecisions) ? intake.revisionDecisions : [];
  decisions.push(decision as unknown as Record<string, unknown>);
  intake.revisionDecisions = decisions;

  try {
    // Route revision to correct agent
    if (targetSection === 'brief_strategy') {
      // Clear brief approval to force re-approval
      intake.briefApproved = false;
      intake.briefApprovedAt = null;
      intake.briefStage = 'review';
      res.status(200).json({
        data: decision,
        message: 'Brief strategy feedback received. Brief must be re-generated and re-approved.',
        strategyChanged: true,
        briefReapprovalRequired: true,
      });
    } else if (targetSection === 'creator_plan') {
      // Rerun creator — runCreatorPlan takes brief only, creatorPlan from existing state
      const result = await runCreatorPlan(intake.managerBrief);
      intake.creatorPlan = result;
      intake.creatorStage = 'review';
      // Invalidate all specialist outputs since creator plan changed
      intake.specialistOutputs = null;
      intake.editableSpecialistOutputs = null;
      intake.specialistsStage = 'pending';
      decision.invalidatedSpecialists = true;
      res.status(200).json({
        data: decision,
        result,
        message: 'Creator plan revised. Specialist outputs invalidated — re-run specialists.',
        strategyChanged: true,
        invalidatedSpecialists: true,
      });
    } else {
      // Specialist-specific reruns — preserve other outputs
      if (!intake.specialistOutputs) {
        res.status(400).json({ error: 'Specialist outputs not found' });
        return;
      }

      const so = intake.specialistOutputs as Record<string, unknown>;
      if (targetSection === 'text_content') {
        const textResult = await runTextContent(intake.managerBrief, intake.creatorPlan);
        intake.specialistOutputs = { ...so, textContent: textResult };
      } else if (targetSection === 'imagery_creative') {
        const imageryResult = await runImageryCreative(intake.managerBrief, intake.creatorPlan);
        intake.specialistOutputs = { ...so, imageryCreative: imageryResult };
      } else if (targetSection === 'market_research') {
        const researchResult = await runMarketResearch(intake.managerBrief, intake.creatorPlan);
        intake.specialistOutputs = { ...so, marketResearch: researchResult };
      }
      intake.specialistsStage = 'review';

      res.status(200).json({
        data: decision,
        untouchedOutputs: targetSection === 'text_content'
          ? { imageryCreative: true, marketResearch: true }
          : targetSection === 'imagery_creative'
          ? { textContent: true, marketResearch: true }
          : { textContent: true, imageryCreative: true },
        message: `Revised ${targetSection}. Other specialist outputs preserved.`,
      });
    }

    // Mark revision as completed
    decision.completedAt = new Date().toISOString();

    // Re-push with updated completedAt
    const finalDecisions: Record<string, unknown>[] = Array.isArray(intake.revisionDecisions) ? intake.revisionDecisions : [];
    finalDecisions[finalDecisions.length - 1] = decision as unknown as Record<string, unknown>;
    intake.revisionDecisions = finalDecisions;

    // Persist
    db.prepare('UPDATE projects SET intake = ?, updated_at = ? WHERE id = ?').run(
      JSON.stringify(intake),
      new Date().toISOString(),
      req.params.id,
    );
  } catch (err) {
    // Remove failed decision
    const reverted: Record<string, unknown>[] = ((intake.revisionDecisions as Record<string, unknown>[]) || []).filter(
      (d) => d.id !== decision.id,
    );
    intake.revisionDecisions = reverted;
    db.prepare('UPDATE projects SET intake = ?, updated_at = ? WHERE id = ?').run(
      JSON.stringify(intake),
      new Date().toISOString(),
      req.params.id,
    );
    res.status(500).json({ error: `Revision failed: ${(err as Error).message}` });
  }
});

export default router;