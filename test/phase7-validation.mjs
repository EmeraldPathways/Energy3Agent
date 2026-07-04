import 'dotenv/config';
import { spawn } from 'node:child_process';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 3497;
const BASE = `http://localhost:${PORT}/api`;

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
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
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

    // 2. Gates: run-campaign-manager and approve/final blocked
    console.log('\n=== Gates ===');
    const cm0 = await fetchJson(`${BASE}/projects/${projectId}/agents/run-campaign-manager`, { method: 'POST' });
    assert(cm0.status === 400, 'run-campaign-manager blocked before specialists');

    const af0 = await fetchJson(`${BASE}/projects/${projectId}/approve/final`, { method: 'POST' });
    assert(af0.status === 400, 'approve/final blocked before assembly');

    const exp0json = await fetchText(`${BASE}/projects/${projectId}/export/json`);
    assert(exp0json.status === 400, 'JSON export blocked before final approval');

    // 3. Setup full state
    console.log('\n=== Setup full state ===');
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
      }
    });
    assert(setup.status === 200, 'PUT intake with full state returns 200');

    // 4. Run campaign manager
    console.log('\n=== Run Campaign Manager ===');
    const cm = await fetchJson(`${BASE}/projects/${projectId}/agents/run-campaign-manager`, { method: 'POST' });
    assert(cm.status === 200, 'run-campaign-manager returns 200');
    assert(!!cm.body.data.campaignTitle, 'Assembly has campaignTitle');
    assert(!!cm.body.data.headlines, 'Assembly has headlines');
    assert(Array.isArray(cm.body.data.headlines), 'headlines is array');
    assert(!!cm.body.data.adCopy, 'Assembly has adCopy');
    assert(!!cm.body.data.imagePrompts, 'Assembly has imagePrompts');
    assert(cm.body.data.feedbackCount === 0, 'feedbackCount is 0');

    // Verify persistence
    const projAfterCm = await fetchJson(`${BASE}/projects/${projectId}`);
    assert(projAfterCm.body.data.intake.finalAssemblyStage === 'generated', 'finalAssemblyStage persisted');
    assert(!!projAfterCm.body.data.intake.finalAssembly, 'finalAssembly persisted');

    // 5. Approve final
    console.log('\n=== Final Approval ===');
    const af = await fetchJson(`${BASE}/projects/${projectId}/approve/final`, { method: 'POST' });
    assert(af.status === 200, 'approve/final returns 200');
    assert(af.body.data.finalApproved === true, 'finalApproved is true');

    // 6. Export JSON
    console.log('\n=== Export JSON ===');
    const expJson = await fetchText(`${BASE}/projects/${projectId}/export/json`);
    assert(expJson.status === 200, 'JSON export returns 200');
    const jsonData = JSON.parse(expJson.body);
    assert(jsonData.campaignTitle === 'Green Launch', 'JSON has campaignTitle');
    assert(Array.isArray(jsonData.headlines), 'JSON headlines is array');
    assert(Array.isArray(jsonData.imagePrompts), 'JSON imagePrompts is array');

    // 7. Export Markdown
    console.log('\n=== Export Markdown ===');
    const expMd = await fetchText(`${BASE}/projects/${projectId}/export/markdown`);
    assert(expMd.status === 200, 'Markdown export returns 200');
    assert(expMd.body.includes('# Green Launch'), 'Markdown has h1 title');
    assert(expMd.body.includes('## Campaign Objective'), 'Markdown has objective heading');
    assert(expMd.body.includes('## Headlines'), 'Markdown has headlines heading');
    assert(expMd.body.includes('- Eco Headline'), 'Markdown has headline content');
    assert(expMd.body.includes('## Image Prompts'), 'Markdown has image prompts heading');
    assert(expMd.body.includes('## Summary'), 'Markdown has summary heading');

    // 8. Export HTML
    console.log('\n=== Export HTML ===');
    const expHtml = await fetchText(`${BASE}/projects/${projectId}/export/html`);
    assert(expHtml.status === 200, 'HTML export returns 200');
    assert(expHtml.body.includes('<!DOCTYPE html>'), 'HTML has doctype');
    assert(expHtml.body.includes('<h1>Green Launch</h1>'), 'HTML has h1');
    assert(expHtml.body.includes('<h2>Campaign Objective</h2>'), 'HTML has h2');
    assert(expHtml.body.includes('<li>Eco Headline</li>'), 'HTML has headline content');
    assert(expHtml.body.includes('</html>'), 'HTML has closing tag');

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