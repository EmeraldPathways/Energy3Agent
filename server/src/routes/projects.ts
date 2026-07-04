import { Router, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import {
  CreateProjectInputSchema,
  UpdateProjectInputSchema,
  IntakeDataSchema,
} from '@ai-campaign/shared';
import { getDb } from '../db.js';

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

function rowToProject(row: ProjectRow) {
  let intake = {};
  try {
    intake = JSON.parse(row.intake || '{}');
  } catch {
    intake = {};
  }
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    status: row.status,
    intake,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// GET /api/projects
router.get('/', (_req: Request, res: Response) => {
  const db = getDb();
  const rows = db
    .prepare('SELECT * FROM projects ORDER BY updated_at DESC')
    .all() as ProjectRow[];
  const projects = rows.map(rowToProject);
  res.json({ data: projects });
});

// POST /api/projects
router.post('/', (req: Request, res: Response) => {
  const parsed = CreateProjectInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
    return;
  }

  const db = getDb();
  const now = new Date().toISOString();
  const id = randomUUID();
  const { name, description = '' } = parsed.data;
  const defaultIntake = JSON.stringify(IntakeDataSchema.parse({}));

  db.prepare(
    'INSERT INTO projects (id, name, description, status, intake, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(id, name, description, 'draft', defaultIntake, now, now);

  const row = db
    .prepare('SELECT * FROM projects WHERE id = ?')
    .get(id) as ProjectRow;
  res.status(201).json({ data: rowToProject(row) });
});

// GET /api/projects/:id
router.get('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const row = db
    .prepare('SELECT * FROM projects WHERE id = ?')
    .get(req.params.id) as ProjectRow | undefined;
  if (!row) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }
  res.json({ data: rowToProject(row) });
});

// PUT /api/projects/:id
router.put('/:id', (req: Request, res: Response) => {
  const parsed = UpdateProjectInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
    return;
  }

  const db = getDb();
  const existing = db
    .prepare('SELECT * FROM projects WHERE id = ?')
    .get(req.params.id) as ProjectRow | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  const updates = parsed.data;
  const now = new Date().toISOString();

  let intake = existing.intake;
  if (updates.intake) {
    const currentIntake = JSON.parse(existing.intake || '{}');
    const merged = { ...currentIntake, ...updates.intake };
    try {
      IntakeDataSchema.parse(merged);
    } catch {
      res.status(400).json({ error: 'Invalid intake data structure' });
      return;
    }
    intake = JSON.stringify(merged);
  }

  const name = updates.name ?? existing.name;
  const description = updates.description ?? existing.description;
  const status = updates.status ?? existing.status;

  db.prepare(
    'UPDATE projects SET name = ?, description = ?, status = ?, intake = ?, updated_at = ? WHERE id = ?'
  ).run(name, description, status, intake, now, req.params.id);

  const row = db
    .prepare('SELECT * FROM projects WHERE id = ?')
    .get(req.params.id) as ProjectRow;
  res.json({ data: rowToProject(row) });
});

// DELETE /api/projects/:id
router.delete('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const existing = db
    .prepare('SELECT * FROM projects WHERE id = ?')
    .get(req.params.id) as ProjectRow | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  db.prepare('DELETE FROM uploads WHERE project_id = ?').run(req.params.id);
  db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id);
  res.status(204).send();
});

export default router;