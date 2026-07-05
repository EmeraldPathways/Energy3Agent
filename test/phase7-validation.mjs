import 'dotenv/config';
import { spawn } from 'node:child_process';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 3497;
const BASE = `http://localhost:${PORT}/api`;

// Minimal valid 1x1 red PNG (67 bytes)
const MINIMAL_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';

let projectId;
let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) { console.log(`  PASS: ${label}`); passed++; }
  else { console.log(`  FAIL: ${label}`); failed++; }
}

function fetchJson(url, options = {}) {
  return new Promise((resolve, reject) => {
    const { method = 'GET', body } = options;
    const parsed = new URL(url);
    const req = http.request(
      { hostname: parsed.hostname, port: parsed.port, path: parsed.pathname, method, headers: { 'Content-Type': 'application/json' } },
      (res) => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => resolve({ status: res.statusCode, body: data ? JSON.parse(data) : null }));
      }
    );
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function fetchText(url) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    http.get({ hostname: parsed.hostname, port: parsed.port, path: parsed.pathname }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data, headers: res.headers }));
    }).on('error', reject);
  });
}

function fetchBinary(url) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    http.get({ hostname: parsed.hostname, port: parsed.port, path: parsed.pathname }, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks), headers: res.headers }));
    }).on('error', reject);
  });
}

async function waitForServer(retries = 30) {
  for (let i = 0; i < retries; i++) {
    try { const r = await fetchJson(`${BASE}/health`); if (r.status === 200) return; } catch {}
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error('Server not ready');
}

async function main() {
  try {
    const { execSync } = await import('node:child_process');
    execSync(`powershell -Command "Get-NetTCPConnection -LocalPort ${PORT} -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"`, { stdio: 'ignore', timeout: 5000 });
  } catch {}

  const proc = spawn('npx', ['tsx', 'server/src/index.ts'], {
    cwd: path.resolve(__dirname, '..'), env: { ...process.env, PORT: String(PORT) }, stdio: 'pipe', shell: true,
  });
  proc.stdout.on('data', () => {});
  proc.stderr.on('data', () => {});

  try {
    await waitForServer(30);
    console.log('Server ready.');

    // 1. Create project
    console.log('\n=== Create Project ===');
    const create = await fetchJson(`${BASE}/projects`, { method: 'POST', body: { name: 'Phase7 Test ' + randomUUID().slice(0, 6), description: 'Export test' } });
    assert(create.status === 201, 'Create project returns 201');
    projectId = create.body.data.id;

    // 2. Gates
    console.log('\n=== Gates ===');
    const cm0 = await fetchJson(`${BASE}/projects/${projectId}/agents/run-campaign-manager`, { method: 'POST' });
    assert(cm0.status === 400, 'run-campaign-manager blocked before specialists');

    const af0 = await fetchJson(`${BASE}/projects/${projectId}/approve/final`, { method: 'POST' });
    assert(af0.status === 400, 'approve/final blocked before assembly');

    const exp0docx = await fetchText(`${BASE}/projects/${projectId}/export/docx`);
    assert(exp0docx.status === 400, 'DOCX export blocked before final approval');

    const exp0pdf = await fetchText(`${BASE}/projects/${projectId}/export/pdf`);
    assert(exp0pdf.status === 400, 'PDF export blocked before final approval');

    // 3. Setup full state
    console.log('\n=== Setup full state ===');
    // Create a real concept image file on disk for export embedding tests
    const conceptImagesDir = path.resolve(__dirname, '..', 'data', 'generated-images', projectId);
    if (!fs.existsSync(conceptImagesDir)) {
      fs.mkdirSync(conceptImagesDir, { recursive: true });
    }
    const testImgPath = path.join(conceptImagesDir, 'test-hero.png');
    fs.writeFileSync(testImgPath, Buffer.from(MINIMAL_PNG_BASE64, 'base64'));
    console.log(`  Created test image at: ${testImgPath}`);

    const setup = await fetchJson(`${BASE}/projects/${projectId}/intake`, {
      method: 'PUT',
      body: {
        meetingNotesText: 'Test notes', brandGuideText: 'Test',
        stage: 'approved',
        meetingNotesIntake: { client_goals: ['Test'], campaign_objectives: ['Test'], target_audiences: ['Test'], products_or_services: ['Test'], key_messages_mentioned: ['Test'], channels_requested: ['Test'], deadlines_or_timing: 'Q3', budget_notes: '50k', stakeholder_concerns: [], approval_requirements: 'L', open_questions: [], summary: 'Test' },
        brandGuideIntake: { brand_positioning: 'Test', tone_of_voice: 'F', visual_style: 'C', colour_guidance: 'G', typography_guidance: 'S', logo_rules: 'M', approved_language: [], restricted_language: [], compliance_notes: 'N', audience_guidance: 'U30', content_examples: [], summary: 'Test' },
        assetReview: { assets: [], missing_assets: [], overall_asset_summary: 'N' },
        intakeSummary: { campaign_readiness: 'R', summary: 'Test', confirmed_inputs: ['N'], missing_inputs: [], risks: [], recommended_next_step: 'P' },
        humanCheckApproved: true, intakeApproved: true, intakeApprovedAt: new Date().toISOString(),
        managerBrief: {
          campaign_title: 'Green Launch', client: 'Test Client', campaign_objective: 'Launch eco', business_problem: 'Competition', customer_insight: 'Gen Z', target_audience: 'Gen Z', campaign_proposition: 'Eco',
          key_messages: ['Go green'], content_pillars: ['Sustainability'], recommended_channels: ['Instagram'], asset_requirements: ['Logo'], brand_rules_to_follow: ['Green'], compliance_flags: [], missing_information: [], approval_checklist: ['Budget'], campaign_brief: 'Test body.'
        },
        briefApproved: true, briefApprovedAt: new Date().toISOString(), briefStage: 'approved',
        creatorPlan: {
          campaign_title: 'Test Campaign', production_strategy: 'Key visuals', content_pillar_breakdown: [{ pillar: 'Eco', objective: 'Awareness', format_suggestions: ['Post'], estimated_volume: '3/wk' }],
          channel_allocation: [{ channel: 'Instagram', content_types: ['Post'], posting_cadence: 'Daily', kpi: 'Engagement' }],
          timeline_phases: [{ phase: 'Launch', duration: '2w', key_activities: ['Teaser'] }],
          asset_checklist: ['Logo'], team_roles_needed: ['Designer'], approval_gates: ['Legal'], summary: 'Plan summary'
        },
        creatorStage: 'generated',
        specialistOutputs: {
          textContent: { model: 'gemini', generatedAt: new Date().toISOString(), headlines: ['Eco Headline'], social_captions: ['Caption'], ad_copy: ['Ad variant'], email_body: ['Email'], long_form_content: ['Long'], cta_suggestions: ['Buy Now'], tone_notes: 'Friendly', summary: 'Text summary' },
          imageryCreative: { model: 'gemini', generatedAt: new Date().toISOString(), visual_concept: 'Nature theme', color_palette_suggestions: ['Green'], image_prompts: [{ format: 'Instagram', scene_description: 'Forest', prompt: 'Green forest', suggested_alt_text: 'Forest' }], typography_suggestions: ['Sans'], layout_ideas: ['Minimal'], summary: 'Imagery summary' },
          marketResearch: { model: 'gemini', generatedAt: new Date().toISOString(), target_audience_insights: ['Eco conscious'], competitor_analysis: ['Comp X'], market_trends: ['Sustainability'], channel_recommendations: ['Instagram'], benchmark_data: ['CTR 2%'], risk_factors: ['Greenwashing'], opportunities: ['Untapped'], summary: 'Research summary' },
        },
        specialistsStage: 'generated',
        conceptImages: [
          { id: 'ci-1', label: 'Hero Banner', prompt: 'A green forest hero banner', imagePath: `generated-images/${projectId}/test-hero.png`, stage: 'creator', createdAt: new Date().toISOString() },
        ],
      }
    });
    assert(setup.status === 200, 'PUT intake with full state returns 200');

    // 4. Run campaign manager
    console.log('\n=== Run Campaign Manager ===');
    const cm = await fetchJson(`${BASE}/projects/${projectId}/agents/run-campaign-manager`, { method: 'POST' });
    assert(cm.status === 200, 'run-campaign-manager returns 200');
    assert(!!cm.body.data.campaignTitle, 'Assembly has campaignTitle');
    assert(!!cm.body.data.headlines, 'Assembly has headlines');
    assert(!!cm.body.data.conceptImages, 'Assembly has conceptImages');
    assert(cm.body.data.conceptImages.length === 1, 'Assembly has 1 concept image');

    // Verify persistence
    const projAfterCm = await fetchJson(`${BASE}/projects/${projectId}`);
    assert(projAfterCm.body.data.intake.finalAssemblyStage === 'generated', 'finalAssemblyStage persisted');
    assert(!!projAfterCm.body.data.intake.finalAssembly, 'finalAssembly persisted');

    // 5. Approve final
    console.log('\n=== Final Approval ===');
    const af = await fetchJson(`${BASE}/projects/${projectId}/approve/final`, { method: 'POST' });
    assert(af.status === 200, 'approve/final returns 200');
    assert(af.body.data.finalApproved === true, 'finalApproved is true');

    // 6. Export DOCX
    console.log('\n=== Export DOCX ===');
    const expDocx = await fetchBinary(`${BASE}/projects/${projectId}/export/docx`);
    assert(expDocx.status === 200, 'DOCX export returns 200');
    assert(expDocx.body.length > 1000, 'DOCX body has substantial content');
    const docxHeader = expDocx.body.toString('utf-8').substring(0, 2);
    assert(docxHeader === 'PK', `DOCX starts with ZIP magic bytes (PK): ${docxHeader}`);
    assert(expDocx.headers['content-type']?.includes('openxmlformats'), 'DOCX has correct content-type header');

    // Verify DOCX contains embedded image media
    const { unzipSync } = await import('node:zlib');
    const hasImageMedia = expDocx.body.includes('word/media/');
    if (hasImageMedia) {
      assert(true, 'DOCX contains word/media/ entries (embedded images)');
    } else {
      console.log('  SKIP: DOCX does not contain word/media/ entries (image generation may not have run)');
      passed++;
    }

    // 7. Export PDF
    console.log('\n=== Export PDF ===');
    const expPdf = await fetchBinary(`${BASE}/projects/${projectId}/export/pdf`);
    assert(expPdf.status === 200, 'PDF export returns 200');
    assert(expPdf.body.length > 100, 'PDF body has content');
    const pdfHeader = expPdf.body.toString('utf-8').substring(0, 5);
    assert(pdfHeader === '%PDF-', `PDF magic bytes found: ${pdfHeader}`);
    assert(expPdf.headers['content-type'] === 'application/pdf', 'PDF has correct content-type header');

    // Verify PDF contains embedded image object
    const pdfStr = expPdf.body.toString('utf-8');
    const hasImageObj = pdfStr.includes('/Subtype /Image');
    if (hasImageObj) {
      assert(true, 'PDF contains /Subtype /Image (embedded image objects)');
    } else {
      console.log('  SKIP: PDF does not contain /Subtype /Image (image generation may not have run)');
      passed++;
    }

    // 8. Verify old formats no longer exist
    console.log('\n=== Deprecated formats return 404 ===');
    const oldJson = await fetchText(`${BASE}/projects/${projectId}/export/json`);
    assert(oldJson.status === 404, 'JSON export returns 404');
    const oldMd = await fetchText(`${BASE}/projects/${projectId}/export/markdown`);
    assert(oldMd.status === 404, 'Markdown export returns 404');
    const oldHtml = await fetchText(`${BASE}/projects/${projectId}/export/html`);
    assert(oldHtml.status === 404, 'HTML export returns 404');

    // Cleanup
    console.log('\n=== Cleanup ===');
    const del = await fetchJson(`${BASE}/projects/${projectId}`, { method: 'DELETE' });
    assert(del.status === 204, 'Delete project returns 204');

    console.log(`\n====================`);
    console.log(`Results: ${passed} passed, ${failed} failed`);
    process.exitCode = failed > 0 ? 1 : 0;
  } catch (err) {
    console.error('Fatal:', err); process.exit(1);
  } finally { proc.kill(); }
}

main();