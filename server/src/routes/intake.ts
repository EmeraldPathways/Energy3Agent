import { Router, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs/promises';
import multer from 'multer';
import {
  IntakeDataSchema,
  MeetingNotesIntakeSchema,
  BrandGuideIntakeSchema,
  AssetReviewIntakeSchema,
  IntakeSummarySchema,
} from '@ai-campaign/shared';
import { getDb, getUploadsDir } from '../db.js';
import { getFileCategory, isTextFile, extractText } from '../services/uploadParser.js';
import {
  runMeetingNotesIntake,
  runBrandGuideIntake,
  runAssetReview,
  runIntakeSummary,
} from '../agents/runIntake.js';

const router = Router();
const uploadsDir = getUploadsDir();

const uploadFields = [
  { name: 'meetingNotes', maxCount: 10 },
  { name: 'brandGuide', maxCount: 10 },
  { name: 'logo', maxCount: 5 },
  { name: 'productImages', maxCount: 20 },
  { name: 'campaignImagery', maxCount: 20 },
];

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadsDir,
    filename: (_req, file, cb) => {
      const unique = `${Date.now()}-${randomUUID()}${path.extname(file.originalname)}`;
      cb(null, unique);
    },
  }),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowed = ['.txt', '.pdf', '.docx', '.png', '.jpg', '.jpeg', '.webp', '.svg'];
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${ext} not allowed`));
    }
  },
});

interface UploadRow {
  id: string;
  project_id: string;
  original_name: string;
  mime_type: string;
  size: number;
  storage_path: string;
  category: string;
  created_at: string;
}

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

function flattenMulterFields(req: Request): Express.Multer.File[] {
  const fieldFiles = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
  if (!fieldFiles) return [];
  const all: Express.Multer.File[] = [];
  for (const arr of Object.values(fieldFiles)) {
    all.push(...arr);
  }
  return all;
}

// POST /api/projects/:id/uploads
router.post('/:id/uploads', upload.fields(uploadFields), async (req: Request, res: Response) => {
  const db = getDb();
  const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id) as ProjectRow | undefined;
  if (!row) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  const files = flattenMulterFields(req);
  if (files.length === 0) {
    res.status(400).json({ error: 'No files uploaded' });
    return;
  }

  const now = new Date().toISOString();
  const results = [];

  for (const file of files) {
    const id = randomUUID();
    const ext = path.extname(file.originalname);
    const category = getFileCategory(file.originalname, file.fieldname);

    db.prepare(
      'INSERT INTO uploads (id, project_id, original_name, mime_type, size, storage_path, category, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(id, req.params.id, file.originalname, file.mimetype || 'application/octet-stream', file.size, file.filename, category, now);

    let extractedText: string | null = null;
    if (isTextFile(ext)) {
      try {
        extractedText = await extractText(path.join(uploadsDir, file.filename), ext);
      } catch {
        // extraction failed, file is still stored
      }
    }

    results.push({
      id,
      projectId: req.params.id,
      originalName: file.originalname,
      mimeType: file.mimetype || 'application/octet-stream',
      size: file.size,
      path: file.filename,
      category,
      createdAt: now,
      extractedText,
    });

    // append extracted text to project intake
    const currentIntake = parseIntake(row.intake);
    if (extractedText) {
      if (category === 'meeting_notes') {
        currentIntake.meetingNotesText = (currentIntake.meetingNotesText || '') + '\n\n' + extractedText;
      } else if (category === 'brand_guide') {
        currentIntake.brandGuideText = (currentIntake.brandGuideText || '') + '\n\n' + extractedText;
      } else if (category === 'other') {
        currentIntake.projectNotes = (currentIntake.projectNotes || '') + '\n\n' + extractedText;
      }
    }

    db.prepare('UPDATE projects SET intake = ?, updated_at = ? WHERE id = ?')
      .run(JSON.stringify(currentIntake), now, req.params.id);
    row.intake = JSON.stringify(currentIntake);
  }

  res.status(201).json({ data: results });
});

// DELETE /api/projects/:id/uploads/:fileId
router.delete('/:id/uploads/:fileId', async (req: Request, res: Response) => {
  const db = getDb();
  const uploadRow = db.prepare(
    'SELECT * FROM uploads WHERE id = ? AND project_id = ?'
  ).get(req.params.fileId, req.params.id) as UploadRow | undefined;

  if (!uploadRow) {
    res.status(404).json({ error: 'File not found' });
    return;
  }

  try {
    await fs.unlink(path.join(uploadsDir, uploadRow.storage_path));
  } catch {
    // file already gone
  }

  db.prepare('DELETE FROM uploads WHERE id = ?').run(req.params.fileId);
  res.status(204).send();
});

// POST /api/projects/:id/approve/human-check
router.post('/:id/approve/human-check', (req: Request, res: Response) => {
  const db = getDb();
  const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id) as ProjectRow | undefined;
  if (!row) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  const intake = parseIntake(row.intake);
  intake.humanCheckApproved = true;
  intake.stage = 'intake-review';

  const now = new Date().toISOString();
  db.prepare('UPDATE projects SET intake = ?, updated_at = ? WHERE id = ?')
    .run(JSON.stringify(intake), now, req.params.id);

  res.json({ data: { humanCheckApproved: true, stage: 'intake-review' } });
});

// POST /api/projects/:id/agents/run-intake
router.post('/:id/agents/run-intake', async (req: Request, res: Response) => {
  const db = getDb();
  const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id) as ProjectRow | undefined;
  if (!row) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  const intake = parseIntake(row.intake);

  if (!intake.meetingNotesText?.trim() && !intake.brandGuideText?.trim()) {
    res.status(400).json({ error: 'No source data to process. Upload meeting notes or brand guide text before running intake agents.' });
    return;
  }

  try {
    const [meetingNotesIntake, brandGuideIntake] = await Promise.all([
      runMeetingNotesIntake(intake.meetingNotesText || 'No meeting notes provided.'),
      runBrandGuideIntake(intake.brandGuideText || 'No brand guide provided.'),
    ]);

    const uploads = db.prepare(
      'SELECT * FROM uploads WHERE project_id = ? AND category IN (?, ?, ?, ?)'
    ).all(req.params.id, 'logo', 'product_image', 'campaign_imagery', 'other') as UploadRow[];

    const assetList = uploads.map(u =>
      `- ${u.original_name} (${u.category}, ${(u.size / 1024).toFixed(1)}KB)`
    ).join('\n') || 'No assets uploaded.';

    const assetReview = await runAssetReview(assetList);
    const intakeSummary = await runIntakeSummary(meetingNotesIntake, brandGuideIntake, assetReview);

    // Validate all outputs
    MeetingNotesIntakeSchema.parse(meetingNotesIntake);
    BrandGuideIntakeSchema.parse(brandGuideIntake);
    AssetReviewIntakeSchema.parse(assetReview);
    IntakeSummarySchema.parse(intakeSummary);

    intake.meetingNotesIntake = meetingNotesIntake;
    intake.brandGuideIntake = brandGuideIntake;
    intake.assetReview = assetReview;
    intake.intakeSummary = intakeSummary;
    intake.stage = 'intake-review';

    const now = new Date().toISOString();
    db.prepare('UPDATE projects SET intake = ?, status = ?, updated_at = ? WHERE id = ?')
      .run(JSON.stringify(intake), 'needs_review', now, req.params.id);

    res.json({
      data: {
        meetingNotesIntake,
        brandGuideIntake,
        assetReview,
        intakeSummary,
        stage: 'intake-review',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Intake agent run failed';
    console.error('[intake]', message);
    res.status(500).json({ error: message });
  }
});

// POST /api/projects/:id/approve/intake
router.post('/:id/approve/intake', (req: Request, res: Response) => {
  const db = getDb();
  const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id) as ProjectRow | undefined;
  if (!row) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  const intake = parseIntake(row.intake);

  if (!intake.intakeSummary) {
    res.status(400).json({ error: 'Intake summary must be generated before approval' });
    return;
  }

  intake.intakeApproved = true;
  intake.intakeApprovedAt = new Date().toISOString();
  intake.stage = 'approved';

  const now = new Date().toISOString();
  db.prepare('UPDATE projects SET intake = ?, status = ?, updated_at = ? WHERE id = ?')
    .run(JSON.stringify(intake), 'approved', now, req.params.id);

  res.json({
    data: {
      intakeApproved: true,
      intakeApprovedAt: intake.intakeApprovedAt,
      stage: 'approved',
    },
  });
});

// PUT /api/projects/:id/intake
router.put('/:id/intake', (req: Request, res: Response) => {
  const db = getDb();
  const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id) as ProjectRow | undefined;
  if (!row) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  const parsed = IntakeDataSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid intake data', details: parsed.error.flatten() });
    return;
  }

  const current = parseIntake(row.intake);
  const merged = { ...current, ...parsed.data };

  try {
    const valid = IntakeDataSchema.parse(merged);
    const now = new Date().toISOString();
    db.prepare('UPDATE projects SET intake = ?, updated_at = ? WHERE id = ?')
      .run(JSON.stringify(valid), now, req.params.id);
    res.json({ data: valid });
  } catch (err) {
    res.status(400).json({ error: 'Merged intake data is invalid', details: String(err) });
  }
});

// GET /api/projects/:id/uploads
router.get('/:id/uploads', (req: Request, res: Response) => {
  const db = getDb();
  const rows = db.prepare(
    'SELECT * FROM uploads WHERE project_id = ? ORDER BY created_at DESC'
  ).all(req.params.id) as UploadRow[];

  const files = rows.map(r => ({
    id: r.id,
    projectId: r.project_id,
    originalName: r.original_name,
    mimeType: r.mime_type,
    size: r.size,
    path: r.storage_path,
    category: r.category,
    createdAt: r.created_at,
  }));

  res.json({ data: files });
});

export default router;