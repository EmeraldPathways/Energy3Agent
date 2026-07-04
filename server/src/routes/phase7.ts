import { Router, Request, Response } from 'express';
import { FinalAssemblySchema } from '@ai-campaign/shared';
import { getDb } from '../db.js';
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';

type HeadingLevelType = (typeof HeadingLevel)[keyof typeof HeadingLevel];

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
  const conceptImages = Array.isArray(intake.conceptImages) ? intake.conceptImages : [];

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
    conceptImages: conceptImages.map((ci: { id: string; label: string; prompt: string; imagePath: string }) => ({
      id: ci.id,
      label: ci.label,
      prompt: ci.prompt,
      imagePath: ci.imagePath,
    })),
    audienceInsights: (mr.target_audience_insights || []) as string[],
    competitorAnalysis: (mr.competitor_analysis || []) as string[],
    risks: (mr.risk_factors || []) as string[],
    opportunities: (mr.opportunities || []) as string[],
    feedbackCount: feedbackItems.length,
    revisionCount: revisionDecisions.length,
    summary: '',
  };
  assembly.summary = `Campaign "${campaignTitle}" for ${assembly.client}. ${assembly.headlines.length} headlines, ${assembly.adCopy.length} ad variants, ${assembly.audienceInsights.length} audience insights, ${assembly.conceptImages.length} concept images.`;

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

// ── Shared helpers ──

function storeArtifact(intake: Record<string, unknown>, format: string, content: string, projectId: string | string[]): void {
  const db = getDb();
  const artifact = { format, content, generatedAt: new Date().toISOString() };
  const artifacts: Record<string, unknown>[] = Array.isArray(intake.exportArtifacts) ? intake.exportArtifacts : [];
  artifacts.push(artifact);
  intake.exportArtifacts = artifacts;
  db.prepare('UPDATE projects SET intake = ?, updated_at = ? WHERE id = ?').run(
    JSON.stringify(intake), new Date().toISOString(), projectId,
  );
}

function assemblyArr(assembly: Record<string, unknown>, key: string): string[] {
  const v = assembly[key];
  return Array.isArray(v) ? v as string[] : [];
}

// ── GET /api/projects/:id/export/docx ──
router.get('/:id/export/docx', async (req: Request, res: Response) => {
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

  try {
    const a = intake.finalAssembly as Record<string, unknown>;

    function heading(text: string, level: HeadingLevelType): Paragraph {
      return new Paragraph({
        heading: level,
        spacing: { before: 400, after: 200 },
        children: [new TextRun({ text, bold: true, size: level === HeadingLevel.HEADING_1 ? 44 : 32 })],
      });
    }

    function body(text: string): Paragraph {
      return new Paragraph({
        spacing: { after: 120 },
        children: [new TextRun({ text, size: 22 })],
      });
    }

    function bullet(text: string): Paragraph {
      return new Paragraph({
        spacing: { after: 60 },
        bullet: { level: 0 },
        children: [new TextRun({ text, size: 22 })],
      });
    }

    const children: Paragraph[] = [
      heading(String(a.campaignTitle || 'Campaign Pack'), HeadingLevel.HEADING_1),
      body(`Client: ${a.client || ''}`),
      body(`Generated: ${String(a.generatedAt || '').replace('T', ' ').substring(0, 19)}`),
      heading('Campaign Objective', HeadingLevel.HEADING_2),
      body(String(a.campaignObjective || '')),
      heading('Target Audience', HeadingLevel.HEADING_2),
      body(String(a.targetAudience || '')),
      heading('Key Messages', HeadingLevel.HEADING_2),
      ...assemblyArr(a, 'keyMessages').map(bullet),
      heading('Content Pillars', HeadingLevel.HEADING_2),
      ...assemblyArr(a, 'contentPillars').map(bullet),
      heading('Recommended Channels', HeadingLevel.HEADING_2),
      ...assemblyArr(a, 'recommendedChannels').map(bullet),
      heading('Production Strategy', HeadingLevel.HEADING_2),
      body(String(a.productionStrategy || '')),
      heading('Headlines', HeadingLevel.HEADING_2),
      ...assemblyArr(a, 'headlines').map(bullet),
      heading('Ad Copy', HeadingLevel.HEADING_2),
      ...assemblyArr(a, 'adCopy').map(bullet),
      heading('CTAs', HeadingLevel.HEADING_2),
      ...assemblyArr(a, 'ctaSuggestions').map(bullet),
      heading('Visual Concept', HeadingLevel.HEADING_2),
      body(String(a.visualConcept || '')),
    ];

    // Image Prompts
    const imgPrompts = Array.isArray(a.imagePrompts) ? a.imagePrompts as { format: string; prompt: string }[] : [];
    children.push(heading('Image Prompts', HeadingLevel.HEADING_2));
    for (const p of imgPrompts) {
      children.push(bullet(`${p.format}: ${p.prompt}`));
    }

    // Concept Images
    const conceptImages = Array.isArray(a.conceptImages) ? a.conceptImages as { id: string; label: string; prompt: string; imagePath: string }[] : [];
    if (conceptImages.length > 0) {
      children.push(heading('Generated Concept Images', HeadingLevel.HEADING_2));
      for (const ci of conceptImages) {
        children.push(bullet(`${ci.label} (${ci.imagePath}) — ${ci.prompt}`));
      }
    }

    children.push(
      heading('Audience Insights', HeadingLevel.HEADING_2),
      ...assemblyArr(a, 'audienceInsights').map(bullet),
      heading('Competitor Analysis', HeadingLevel.HEADING_2),
      ...assemblyArr(a, 'competitorAnalysis').map(bullet),
      heading('Risks', HeadingLevel.HEADING_2),
      ...assemblyArr(a, 'risks').map(bullet),
      heading('Opportunities', HeadingLevel.HEADING_2),
      ...assemblyArr(a, 'opportunities').map(bullet),
      heading('Summary', HeadingLevel.HEADING_2),
      body(String(a.summary || '')),
    );

    const doc = new Document({
      sections: [{ children }],
    });

    const buffer = await Packer.toBuffer(doc);

    storeArtifact(intake, 'docx', '[DOCX binary stored]', req.params.id);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="campaign-${req.params.id}.docx"`);
    res.send(buffer);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'DOCX generation failed';
    console.error('[phase7 docx]', message);
    res.status(500).json({ error: message });
  }
});

// ── GET /api/projects/:id/export/pdf ──
router.get('/:id/export/pdf', async (req: Request, res: Response) => {
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

  try {
    const assembly = intake.finalAssembly as Record<string, unknown>;
    const PDFDocument = (await import('pdfkit')).default;

    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 50, bottom: 50, left: 60, right: 60 },
      info: {
        Title: String(assembly.campaignTitle || 'Campaign Pack'),
        Author: String(assembly.client || ''),
        CreationDate: new Date(),
      },
    });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));

    const pdfPromise = new Promise<Buffer>((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
    });

    const arr = (v: unknown): string[] => (Array.isArray(v) ? v as string[] : []);
    const imgPrompts = (Array.isArray(assembly.imagePrompts) ? assembly.imagePrompts as { format: string; prompt: string }[] : []);
    const conceptImages = (Array.isArray(assembly.conceptImages) ? assembly.conceptImages as { id: string; label: string; prompt: string; imagePath: string }[] : []);

    doc.fontSize(24).font('Helvetica-Bold').text(String(assembly.campaignTitle || 'Campaign Pack'), { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(14).font('Helvetica').text(`Client: ${assembly.client || ''}`, { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(10).font('Helvetica').text(`Generated: ${String(assembly.generatedAt || '').replace('T', ' ').substring(0, 19)}`, { align: 'center' });
    doc.moveDown(1.5);

    function addHeading(text: string) {
      doc.moveDown(1);
      doc.fontSize(16).font('Helvetica-Bold').text(text);
      doc.moveDown(0.3);
    }

    function addBody(text: string) {
      doc.fontSize(11).font('Helvetica').text(text);
    }

    function addList(items: string[]) {
      doc.fontSize(11).font('Helvetica');
      for (const item of items) {
        doc.text(`  \u2022 ${item}`);
      }
    }

    addHeading('Campaign Objective');
    addBody(String(assembly.campaignObjective || ''));

    addHeading('Target Audience');
    addBody(String(assembly.targetAudience || ''));

    addHeading('Key Messages');
    addList(arr(assembly.keyMessages));

    addHeading('Content Pillars');
    addList(arr(assembly.contentPillars));

    addHeading('Recommended Channels');
    addList(arr(assembly.recommendedChannels));

    addHeading('Production Strategy');
    addBody(String(assembly.productionStrategy || ''));

    addHeading('Headlines');
    addList(arr(assembly.headlines));

    addHeading('Ad Copy');
    addList(arr(assembly.adCopy));

    addHeading('CTAs');
    addList(arr(assembly.ctaSuggestions));

    addHeading('Visual Concept');
    addBody(String(assembly.visualConcept || ''));

    addHeading('Image Prompts');
    for (const p of imgPrompts) {
      doc.font('Helvetica-Bold').text(`  ${p.format}:`);
      doc.font('Helvetica').text(`    ${p.prompt}`);
    }

    if (conceptImages.length > 0) {
      addHeading('Generated Concept Images');
      for (const ci of conceptImages) {
        doc.font('Helvetica-Bold').text(`  ${ci.label}`);
        doc.font('Helvetica').text(`    Path: ${ci.imagePath}`);
        doc.font('Helvetica').text(`    Prompt: ${ci.prompt}`);
        doc.moveDown(0.2);
      }
    }

    addHeading('Audience Insights');
    addList(arr(assembly.audienceInsights));

    addHeading('Competitor Analysis');
    addList(arr(assembly.competitorAnalysis));

    addHeading('Risks');
    addList(arr(assembly.risks));

    addHeading('Opportunities');
    addList(arr(assembly.opportunities));

    doc.moveDown(1);
    addHeading('Summary');
    addBody(String(assembly.summary || ''));

    doc.end();

    const pdfBuffer = await pdfPromise;

    storeArtifact(intake, 'pdf', '[PDF binary stored]', req.params.id);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="campaign-${req.params.id}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'PDF generation failed';
    console.error('[phase7 pdf]', message);
    res.status(500).json({ error: message });
  }
});

export default router;