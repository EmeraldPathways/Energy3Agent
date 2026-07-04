import { Router, Request, Response } from 'express';
import { ManagerBriefSchema } from '@ai-campaign/shared';
import { getDb } from '../db.js';
import { runManagerBrief } from '../agents/runManager.js';

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

// POST /api/projects/:id/agents/run-manager
router.post('/:id/agents/run-manager', async (req: Request, res: Response) => {
  const db = getDb();
  const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id) as ProjectRow | undefined;
  if (!row) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  const intake = parseIntake(row.intake);

  if (!intake.intakeApproved) {
    res.status(400).json({ error: 'Intake must be approved before generating manager brief' });
    return;
  }

  if (!intake.meetingNotesIntake || !intake.brandGuideIntake || !intake.assetReview || !intake.intakeSummary) {
    res.status(400).json({ error: 'All intake outputs must be present before generating manager brief' });
    return;
  }

  try {
    const brief = await runManagerBrief(
      intake.meetingNotesIntake,
      intake.brandGuideIntake,
      intake.assetReview,
      intake.intakeSummary,
    );

    ManagerBriefSchema.parse(brief);

    intake.managerBrief = brief;
    intake.editableBrief = brief;
    intake.briefStage = 'generated';

    const now = new Date().toISOString();
    db.prepare('UPDATE projects SET intake = ?, status = ?, updated_at = ? WHERE id = ?')
      .run(JSON.stringify(intake), 'needs_review', now, req.params.id);

    res.json({ data: brief });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Manager brief generation failed';
    console.error('[brief]', message);
    res.status(500).json({ error: message });
  }
});

// POST /api/projects/:id/approve/brief
router.post('/:id/approve/brief', (req: Request, res: Response) => {
  const db = getDb();
  const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id) as ProjectRow | undefined;
  if (!row) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  const intake = parseIntake(row.intake);

  if (!intake.managerBrief) {
    res.status(400).json({ error: 'Manager brief must be generated before approval' });
    return;
  }

  intake.briefApproved = true;
  intake.briefApprovedAt = new Date().toISOString();
  intake.briefStage = 'approved';

  const now = new Date().toISOString();
  db.prepare('UPDATE projects SET intake = ?, status = ?, updated_at = ? WHERE id = ?')
    .run(JSON.stringify(intake), 'approved', now, req.params.id);

  res.json({
    data: {
      briefApproved: true,
      briefApprovedAt: intake.briefApprovedAt,
      briefStage: 'approved',
    },
  });
});

// PUT /api/projects/:id/brief — save editable brief
router.put('/:id/brief', (req: Request, res: Response) => {
  const db = getDb();
  const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id) as ProjectRow | undefined;
  if (!row) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  const parsed = ManagerBriefSchema.partial().deepPartial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid brief data', details: parsed.error.flatten() });
    return;
  }

  const intake = parseIntake(row.intake);
  intake.editableBrief = { ...(intake.editableBrief || intake.managerBrief || {}), ...parsed.data };
  intake.briefStage = 'review';

  const now = new Date().toISOString();
  db.prepare('UPDATE projects SET intake = ?, updated_at = ? WHERE id = ?')
    .run(JSON.stringify(intake), now, req.params.id);

  res.json({ data: intake.editableBrief });
});

export default router;
