import { Router, Request, Response } from 'express';
import { CreatorProductionPlanSchema, SpecialistOutputsSchema } from '@ai-campaign/shared';
import { getDb } from '../db.js';
import {
  runCreatorPlan,
  runTextContent,
  runImageryCreative,
  runMarketResearch,
  generateConceptImages,
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

// POST /api/projects/:id/agents/run-creator
router.post('/:id/agents/run-creator', async (req: Request, res: Response) => {
  const db = getDb();
  const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id) as ProjectRow | undefined;
  if (!row) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  const intake = parseIntake(row.intake);

  if (!intake.briefApproved) {
    res.status(400).json({ error: 'Campaign brief must be approved before running creator' });
    return;
  }

  if (!intake.managerBrief) {
    res.status(400).json({ error: 'Campaign brief must exist before running creator' });
    return;
  }

  try {
    const plan = await runCreatorPlan(intake.managerBrief);
    CreatorProductionPlanSchema.parse(plan);

    intake.creatorPlan = plan;
    intake.editableCreatorPlan = plan;
    intake.creatorStage = 'generated';

    const now = new Date().toISOString();
    db.prepare('UPDATE projects SET intake = ?, status = ?, updated_at = ? WHERE id = ?')
      .run(JSON.stringify(intake), 'needs_review', now, req.params.id);

    res.json({ data: plan });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Creator plan generation failed';
    console.error('[phase5]', message);
    res.status(500).json({ error: message });
  }
});

// POST /api/projects/:id/agents/run-specialists
router.post('/:id/agents/run-specialists', async (req: Request, res: Response) => {
  const db = getDb();
  const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id) as ProjectRow | undefined;
  if (!row) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  const intake = parseIntake(row.intake);

  if (!intake.creatorPlan) {
    res.status(400).json({ error: 'Creator plan must be generated before running specialists' });
    return;
  }

  if (!intake.managerBrief) {
    res.status(400).json({ error: 'Campaign brief must exist before running specialists' });
    return;
  }

  try {
    const [textContent, imageryCreative, marketResearch] = await Promise.all([
      runTextContent(intake.managerBrief, intake.creatorPlan),
      runImageryCreative(intake.managerBrief, intake.creatorPlan),
      runMarketResearch(intake.managerBrief, intake.creatorPlan),
    ]);

    // Generate concept images from imagery creative output
    const conceptImages = await generateConceptImages(imageryCreative, req.params.id as string);
    if (conceptImages.length > 0) {
      const existing = Array.isArray(intake.conceptImages) ? intake.conceptImages : [];
      intake.conceptImages = [...existing, ...conceptImages];
    }

    const combined = { textContent, imageryCreative, marketResearch };
    SpecialistOutputsSchema.parse(combined);

    intake.specialistOutputs = combined;
    intake.editableSpecialistOutputs = combined;
    intake.specialistsStage = 'generated';

    const now = new Date().toISOString();
    db.prepare('UPDATE projects SET intake = ?, status = ?, updated_at = ? WHERE id = ?')
      .run(JSON.stringify(intake), 'needs_review', now, req.params.id);

    res.json({
      data: {
        textContent,
        imageryCreative,
        marketResearch,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Specialist run failed';
    console.error('[phase5]', message);
    res.status(500).json({ error: message });
  }
});

// PUT /api/projects/:id/creator — save editable creator plan
router.put('/:id/creator', (req: Request, res: Response) => {
  const db = getDb();
  const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id) as ProjectRow | undefined;
  if (!row) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  const parsed = CreatorProductionPlanSchema.partial().deepPartial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid creator plan', details: parsed.error.flatten() });
    return;
  }

  const intake = parseIntake(row.intake);
  intake.editableCreatorPlan = { ...(intake.editableCreatorPlan || intake.creatorPlan || {}), ...parsed.data };
  intake.creatorStage = 'review';

  const now = new Date().toISOString();
  db.prepare('UPDATE projects SET intake = ?, updated_at = ? WHERE id = ?')
    .run(JSON.stringify(intake), now, req.params.id);

  res.json({ data: intake.editableCreatorPlan });
});

// PUT /api/projects/:id/specialists — save editable specialist outputs
router.put('/:id/specialists', (req: Request, res: Response) => {
  const db = getDb();
  const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id) as ProjectRow | undefined;
  if (!row) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  const parsed = SpecialistOutputsSchema.partial().deepPartial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid specialist data', details: parsed.error.flatten() });
    return;
  }

  const intake = parseIntake(row.intake);
  intake.editableSpecialistOutputs = { ...(intake.editableSpecialistOutputs || intake.specialistOutputs || {}), ...parsed.data };
  intake.specialistsStage = 'review';

  const now = new Date().toISOString();
  db.prepare('UPDATE projects SET intake = ?, updated_at = ? WHERE id = ?')
    .run(JSON.stringify(intake), now, req.params.id);

  res.json({ data: intake.editableSpecialistOutputs });
});

export default router;