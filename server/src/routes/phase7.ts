import { Router, Request, Response } from 'express';
import { FinalAssemblySchema } from '@ai-campaign/shared';
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

function parseIntake(intake: string) {
  try {
    return JSON.parse(intake || '{}');
  } catch {
    return {};
  }
}

// ── POST /api/projects/:id/agents/run-campaign-manager ──
router.post('/:id/agents/run-campaign-manager', (req: Request, res: Response) => {
  const db = getDb();
  const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id) as ProjectRow | undefined;
  if (!row) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  const intake = parseIntake(row.intake);

  // Gates
  if (!intake.briefApproved) {
    res.status(400).json({ error: 'Brief must be approved' });
    return;
  }
  if (intake.specialistsStage !== 'generated' && intake.specialistsStage !== 'review') {
    res.status(400).json({ error: 'Specialist outputs must exist before final assembly' });
    return;
  }
  if (!intake.specialistOutputs) {
    res.status(400).json({ error: 'Specialist outputs must exist before final assembly' });
    return;
  }

  // Assemble final pack from current state (deterministic, no Gemini)
  const brief = intake.managerBrief || {};
  const creator = intake.creatorPlan || {};
  const sp = intake.specialistOutputs || {};
  const tc = sp.textContent || {};
  const ic = sp.imageryCreative || {};
  const mr = sp.marketResearch || {};
  const feedbackItems = Array.isArray(intake.feedbackItems) ? intake.feedbackItems : [];
  const revisionDecisions = Array.isArray(intake.revisionDecisions) ? intake.revisionDecisions : [];

  const campaignTitle = brief.campaign_title || creator.campaign_title || '';
  const assembly = {
    generatedAt: new Date().toISOString(),
    campaignTitle,
    client: brief.client || '',
    intakeSummary: (intake.intakeSummary?.summary) || '',
    campaignObjective: brief.campaign_objective || '',
    targetAudience: brief.target_audience || '',
    keyMessages: brief.key_messages || [],
    contentPillars: brief.content_pillars || [],
    recommendedChannels: brief.recommended_channels || [],
    productionStrategy: creator.production_strategy || '',
    assetChecklist: creator.asset_checklist || [],
    headlines: (tc.headlines || []) as string[],
    adCopy: (tc.ad_copy || []) as string[],
    ctaSuggestions: (tc.cta_suggestions || []) as string[],
    visualConcept: ic.visual_concept || '',
    imagePrompts: (ic.image_prompts || []).map((p: { format: string; prompt: string }) => ({ format: p.format, prompt: p.prompt })),
    audienceInsights: (mr.target_audience_insights || []) as string[],
    competitorAnalysis: (mr.competitor_analysis || []) as string[],
    risks: (mr.risk_factors || []) as string[],
    opportunities: (mr.opportunities || []) as string[],
    feedbackCount: feedbackItems.length,
    revisionCount: revisionDecisions.length,
    summary: '',
  };
  assembly.summary = `Campaign "${campaignTitle}" for ${assembly.client}. ${assembly.headlines.length} headlines, ${assembly.adCopy.length} ad variants, ${assembly.audienceInsights.length} audience insights.`;

  FinalAssemblySchema.parse(assembly);

  intake.finalAssembly = assembly;
  intake.finalAssemblyStage = 'generated';

  db.prepare('UPDATE projects SET intake = ?, updated_at = ? WHERE id = ?').run(
    JSON.stringify(intake),
    new Date().toISOString(),
    req.params.id,
  );

  res.status(200).json({ data: assembly });
});

// ── POST /api/projects/:id/approve/final ──
router.post('/:id/approve/final', (req: Request, res: Response) => {
  const db = getDb();
  const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id) as ProjectRow | undefined;
  if (!row) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  const intake = parseIntake(row.intake);

  // Gate: final assembly must exist
  if (!intake.finalAssembly || intake.finalAssemblyStage !== 'generated') {
    res.status(400).json({ error: 'Final assembly must be generated before approval' });
    return;
  }

  // Gate: must have approved brief and specialist outputs
  if (!intake.briefApproved) {
    res.status(400).json({ error: 'Brief must be approved before final approval' });
    return;
  }

  intake.finalApproved = true;
  intake.finalApprovedAt = new Date().toISOString();

  db.prepare('UPDATE projects SET intake = ?, updated_at = ?, status = ? WHERE id = ?').run(
    JSON.stringify(intake),
    new Date().toISOString(),
    'approved',
    req.params.id,
  );

  res.status(200).json({ data: { finalApproved: true, finalApprovedAt: intake.finalApprovedAt } });
});

// ── Export helpers ──
function generateMarkdown(assembly: Record<string, unknown>): string {
  const a = assembly;
  const arr = (v: unknown): string[] => (Array.isArray(v) ? v as string[] : []);
  const imgPrompts = (Array.isArray(a.imagePrompts) ? a.imagePrompts as { format: string; prompt: string }[] : []);

  return [
    `# ${a.campaignTitle || 'Campaign Pack'}`,
    '',
    `**Client:** ${a.client || ''}`,
    `**Generated:** ${a.generatedAt || ''}`,
    '',
    '## Campaign Objective',
    '',
    `${a.campaignObjective || ''}`,
    '',
    '## Target Audience',
    '',
    `${a.targetAudience || ''}`,
    '',
    '## Key Messages',
    '',
    ...arr(a.keyMessages).map(m => `- ${m}`),
    '',
    '## Content Pillars',
    '',
    ...arr(a.contentPillars).map(p => `- ${p}`),
    '',
    '## Recommended Channels',
    '',
    ...arr(a.recommendedChannels).map(c => `- ${c}`),
    '',
    '## Production Strategy',
    '',
    `${a.productionStrategy || ''}`,
    '',
    '## Headlines',
    '',
    ...arr(a.headlines).map(h => `- ${h}`),
    '',
    '## Ad Copy',
    '',
    ...arr(a.adCopy).map(ac => `- ${ac}`),
    '',
    '## CTAs',
    '',
    ...arr(a.ctaSuggestions).map(c => `- ${c}`),
    '',
    '## Visual Concept',
    '',
    `${a.visualConcept || ''}`,
    '',
    '## Image Prompts',
    '',
    ...imgPrompts.map(p => `- **${p.format}:** ${p.prompt}`),
    '',
    '## Audience Insights',
    '',
    ...arr(a.audienceInsights).map(i => `- ${i}`),
    '',
    '## Competitor Analysis',
    '',
    ...arr(a.competitorAnalysis).map(c => `- ${c}`),
    '',
    '## Risks',
    '',
    ...arr(a.risks).map(r => `- ${r}`),
    '',
    '## Opportunities',
    '',
    ...arr(a.opportunities).map(o => `- ${o}`),
    '',
    '## Summary',
    '',
    `${a.summary || ''}`,
    '',
  ].join('\n');
}

function generateHtml(assembly: Record<string, unknown>): string {
  const md = generateMarkdown(assembly);
  // Simple markdown-to-HTML conversion
  let html = md
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
    .replace(/\n{2,}/g, '</p><p>')
    .replace(/^(?!<[hlu/]).+$/gm, (line: string) => line.trim() ? line : '');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${assembly.campaignTitle || 'Campaign Pack'}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 800px; margin: 2rem auto; padding: 0 1rem; line-height: 1.6; color: #1a1a1a; }
    h1 { border-bottom: 2px solid #333; padding-bottom: 0.5rem; }
    h2 { margin-top: 2rem; color: #2c5282; }
    ul { padding-left: 1.5rem; }
  </style>
</head>
<body>
${html}
</body>
</html>`;
}

// ── GET /api/projects/:id/export/json ──
router.get('/:id/export/json', (req: Request, res: Response) => {
  const db = getDb();
  const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id) as ProjectRow | undefined;
  if (!row) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  const intake = parseIntake(row.intake);

  if (!intake.finalApproved) {
    res.status(400).json({ error: 'Final approval required before export' });
    return;
  }
  if (!intake.finalAssembly) {
    res.status(400).json({ error: 'Final assembly must exist before export' });
    return;
  }

  const artifact = {
    format: 'json' as const,
    content: JSON.stringify(intake.finalAssembly, null, 2),
    generatedAt: new Date().toISOString(),
  };

  // Store in project
  const artifacts: Record<string, unknown>[] = Array.isArray(intake.exportArtifacts) ? intake.exportArtifacts : [];
  artifacts.push(artifact);
  intake.exportArtifacts = artifacts;
  db.prepare('UPDATE projects SET intake = ?, updated_at = ? WHERE id = ?').run(
    JSON.stringify(intake), new Date().toISOString(), req.params.id,
  );

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="campaign-${req.params.id}.json"`);
  res.send(artifact.content);
});

// ── GET /api/projects/:id/export/markdown ──
router.get('/:id/export/markdown', (req: Request, res: Response) => {
  const db = getDb();
  const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id) as ProjectRow | undefined;
  if (!row) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  const intake = parseIntake(row.intake);

  if (!intake.finalApproved) {
    res.status(400).json({ error: 'Final approval required before export' });
    return;
  }
  if (!intake.finalAssembly) {
    res.status(400).json({ error: 'Final assembly must exist before export' });
    return;
  }

  const content = generateMarkdown(intake.finalAssembly);

  const artifact = {
    format: 'markdown' as const,
    content,
    generatedAt: new Date().toISOString(),
  };

  const artifacts: Record<string, unknown>[] = Array.isArray(intake.exportArtifacts) ? intake.exportArtifacts : [];
  artifacts.push(artifact);
  intake.exportArtifacts = artifacts;
  db.prepare('UPDATE projects SET intake = ?, updated_at = ? WHERE id = ?').run(
    JSON.stringify(intake), new Date().toISOString(), req.params.id,
  );

  res.setHeader('Content-Type', 'text/markdown');
  res.setHeader('Content-Disposition', `attachment; filename="campaign-${req.params.id}.md"`);
  res.send(content);
});

// ── GET /api/projects/:id/export/html ──
router.get('/:id/export/html', (req: Request, res: Response) => {
  const db = getDb();
  const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id) as ProjectRow | undefined;
  if (!row) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  const intake = parseIntake(row.intake);

  if (!intake.finalApproved) {
    res.status(400).json({ error: 'Final approval required before export' });
    return;
  }
  if (!intake.finalAssembly) {
    res.status(400).json({ error: 'Final assembly must exist before export' });
    return;
  }

  const content = generateHtml(intake.finalAssembly);

  const artifact = {
    format: 'html' as const,
    content,
    generatedAt: new Date().toISOString(),
  };

  const artifacts: Record<string, unknown>[] = Array.isArray(intake.exportArtifacts) ? intake.exportArtifacts : [];
  artifacts.push(artifact);
  intake.exportArtifacts = artifacts;
  db.prepare('UPDATE projects SET intake = ?, updated_at = ? WHERE id = ?').run(
    JSON.stringify(intake), new Date().toISOString(), req.params.id,
  );

  res.setHeader('Content-Type', 'text/html');
  res.setHeader('Content-Disposition', `attachment; filename="campaign-${req.params.id}.html"`);
  res.send(content);
});

export default router;