import 'dotenv/config';
import { spawn } from 'node:child_process';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 3498;
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
    const create = await fetchJson(`${BASE}/projects`, { method: 'POST', body: { name: 'Phase6 Test ' + randomUUID().slice(0, 6), description: 'Feedback test' } });
    assert(create.status === 201, 'Create project returns 201');
    projectId = create.body.data.id;

    // 2. Feedback blocked before specialists exist
    console.log('\n=== Feedback gates ===');
    const f0 = await fetchJson(`${BASE}/projects/${projectId}/feedback`, { method: 'POST', body: { targetSection: 'text_content', feedback: 'test' } });
    assert(f0.status === 400, 'Feedback blocked before specialists');

    // 3. Revise blocked before feedback
    const r0 = await fetchJson(`${BASE}/projects/${projectId}/agents/revise`, { method: 'POST' });
    assert(r0.status === 400, 'Revise blocked before feedback');

    // 4. Setup full state (approved intake + brief + creator + specialists)
    console.log('\n=== Setup full state ===');
    const setup = await fetchJson(`${BASE}/projects/${projectId}/intake`, {
      method: 'PUT',
      body: {
        meetingNotesText: 'Test notes', brandGuideText: 'Test guide',
        stage: 'approved',
        meetingNotesIntake: { client_goals: ['Test'], campaign_objectives: ['Test'], target_audiences: ['Test'], products_or_services: ['Test'], key_messages_mentioned: ['Test'], channels_requested: ['Test'], deadlines_or_timing: 'Q3', budget_notes: '50k', stakeholder_concerns: [], approval_requirements: 'Lead', open_questions: [], summary: 'Test' },
        brandGuideIntake: { brand_positioning: 'Test', tone_of_voice: 'Friendly', visual_style: 'Clean', colour_guidance: 'Green', typography_guidance: 'Sans', logo_rules: 'Minimal', approved_language: [], restricted_language: [], compliance_notes: 'None', audience_guidance: 'Under 30', content_examples: [], summary: 'Test' },
        assetReview: { assets: [], missing_assets: [], overall_asset_summary: 'No assets' },
        intakeSummary: { campaign_readiness: 'Ready', summary: 'Test', confirmed_inputs: ['Notes'], missing_inputs: [], risks: [], recommended_next_step: 'Proceed' },
        humanCheckApproved: true, intakeApproved: true, intakeApprovedAt: new Date().toISOString(),
        managerBrief: {
          campaign_title: 'Green Launch', client: 'Test Client', campaign_objective: 'Launch eco', business_problem: 'Competition', customer_insight: 'Gen Z', target_audience: 'Gen Z', campaign_proposition: 'Eco',
          key_messages: ['Green'], content_pillars: ['Sustainability'], recommended_channels: ['Instagram'], asset_requirements: ['Logo'], brand_rules_to_follow: ['Green'], compliance_flags: [], missing_information: [], approval_checklist: ['Budget'], campaign_brief: 'Test body.'
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
          textContent: { model: 'gemini', generatedAt: new Date().toISOString(), headlines: ['H1'], social_captions: ['C1'], ad_copy: ['A1'], email_body: ['E1'], long_form_content: ['L1'], cta_suggestions: ['CTA1'], tone_notes: 'Friendly', summary: 'TC' },
          imageryCreative: { model: 'gemini', generatedAt: new Date().toISOString(), visual_concept: 'Green mood', color_palette_suggestions: ['Green'], image_prompts: [{ format: 'Instagram', scene_description: 'Nature', prompt: 'Green nature', suggested_alt_text: 'Green' }], typography_suggestions: ['Sans'], layout_ideas: ['Minimal'], summary: 'IC' },
          marketResearch: { model: 'gemini', generatedAt: new Date().toISOString(), target_audience_insights: ['Eco conscious'], competitor_analysis: ['Comp X'], market_trends: ['Sustainability'], channel_recommendations: ['Instagram'], benchmark_data: ['CTR 2%'], risk_factors: ['Greenwashing'], opportunities: ['Untapped'], summary: 'MR' },
        },
        specialistsStage: 'generated',
      }
    });
    assert(setup.status === 200, 'PUT intake with full state returns 200');

    // Re-fetch to capture current specialist outputs for later comparison
    const projBefore = await fetchJson(`${BASE}/projects/${projectId}`);
    const originalSpec = projBefore.body.data.intake.specialistOutputs;

    // 5. Submit feedback
    console.log('\n=== Submit feedback ===');
    const f1 = await fetchJson(`${BASE}/projects/${projectId}/feedback`, { method: 'POST', body: { targetSection: 'text_content', feedback: 'Make headlines punchier' } });
    assert(f1.status === 201, 'Feedback submission returns 201');
    assert(f1.body.data.targetSection === 'text_content', 'Feedback target is text_content');
    assert(f1.body.data.feedback === 'Make headlines punchier', 'Feedback text persisted');

    // 6. Feedback persisted in project
    const projAfterFb = await fetchJson(`${BASE}/projects/${projectId}`);
    assert(Array.isArray(projAfterFb.body.data.intake.feedbackItems), 'feedbackItems is array after submission');
    assert(projAfterFb.body.data.intake.feedbackItems.length === 1, 'One feedback item stored');

    // 7. Revise blocked before feedback (already tested) — now test out-of-order: revise with no specialists
    // Note: we already have specialists, so test invalid section
    console.log('\n=== Revision routing ===');
    const f2 = await fetchJson(`${BASE}/projects/${projectId}/feedback`, { method: 'POST', body: { targetSection: 'text_content', feedback: 'Fix ad copy tone' } });
    assert(f2.status === 201, 'Second feedback returns 201');

    // Skip Gemini-dependent revision tests if no API key
    const hasKey = process.env.GEMINI_API_KEY;
    if (!hasKey) {
      console.log('\n⚠️  Skipping Gemini-dependent revision tests (no GEMINI_API_KEY)');
      console.log('  Running gate-verification tests only...\n');

      // 8. Invalid section blocked
      const fBad = await fetchJson(`${BASE}/projects/${projectId}/feedback`, { method: 'POST', body: { targetSection: 'invalid_section', feedback: 'test' } });
      assert(fBad.status === 400, 'Invalid targetSection blocked');

      // 9. Cleanup
      console.log('\n=== Cleanup ===');
      const del = await fetchJson(`${BASE}/projects/${projectId}`, { method: 'DELETE' });
      assert(del.status === 204, 'Delete project returns 204');

      console.log(`\n====================`);
      console.log(`Results: ${passed} passed, ${failed} failed`);
      process.exitCode = failed > 0 ? 1 : 0;
      proc.kill();
      return;
    }

    // Gemini-dependent tests below

    // 8. Revise text_content — verify only text is updated
    const rev1 = await fetchJson(`${BASE}/projects/${projectId}/agents/revise`, { method: 'POST' });
    if (rev1.status === 200) {
      assert(rev1.status === 200, 'Revise returns 200');
      const projAfterRev1 = await fetchJson(`${BASE}/projects/${projectId}`);
      const sp = projAfterRev1.body.data.intake.specialistOutputs;
      // Check that imagery and research were untouched
      assert(JSON.stringify(sp.imageryCreative) === JSON.stringify(originalSpec.imageryCreative), 'Imagery untouched after text revision');
      assert(JSON.stringify(sp.marketResearch) === JSON.stringify(originalSpec.marketResearch), 'Research untouched after text revision');
      // Text should be different (new generation)
      assert(!!sp.textContent, 'Text content still exists after revision');

      // 9. Verify revision decision persisted
      const decisions = projAfterRev1.body.data.intake.revisionDecisions;
      assert(Array.isArray(decisions), 'Revision decisions persisted');
      assert(decisions.length >= 1, 'At least one revision decision');
      assert(decisions[0].targetSection === 'text_content', 'Decision targets text_content');
      assert(decisions[0].targetAgent === 'text-content', 'Decision agent is text-content');
      assert(decisions[0].completedAt !== null, 'Revision marked as completed');
    } else {
      console.log('  DEBUG revise response:', rev1.status, JSON.stringify(rev1.body || {}).substring(0, 300));
      assert(false, 'Revise text_content failed');
    }

    // 10. Feedback on imagery — verify only imagery reruns
    const fImg = await fetchJson(`${BASE}/projects/${projectId}/feedback`, { method: 'POST', body: { targetSection: 'imagery_creative', feedback: 'More vibrant colors' } });
    assert(fImg.status === 201, 'Imagery feedback returns 201');

    const projPreImgRev = await fetchJson(`${BASE}/projects/${projectId}`);
    const preImgText = JSON.stringify(projPreImgRev.body.data.intake.specialistOutputs.textContent);
    const preImgResearch = JSON.stringify(projPreImgRev.body.data.intake.specialistOutputs.marketResearch);

    const revImg = await fetchJson(`${BASE}/projects/${projectId}/agents/revise`, { method: 'POST' });
    if (revImg.status === 200) {
      const projAfterImgRev = await fetchJson(`${BASE}/projects/${projectId}`);
      const sp2 = projAfterImgRev.body.data.intake.specialistOutputs;
      assert(JSON.stringify(sp2.textContent) === preImgText, 'Text untouched after imagery revision');
      assert(JSON.stringify(sp2.marketResearch) === preImgResearch, 'Research untouched after imagery revision');
    } else {
      console.log('  DEBUG imagery revise:', revImg.status, JSON.stringify(revImg.body || {}).substring(0, 300));
      assert(false, 'Revise imagery failed');
    }

    // 11. Brief strategy feedback forces brief reapproval
    const fBrief = await fetchJson(`${BASE}/projects/${projectId}/feedback`, { method: 'POST', body: { targetSection: 'brief_strategy', feedback: 'Change target audience to millennials' } });
    assert(fBrief.status === 201, 'Brief strategy feedback returns 201');

    const revBrief = await fetchJson(`${BASE}/projects/${projectId}/agents/revise`, { method: 'POST' });
    assert(revBrief.status === 200, 'Revise brief strategy returns 200');
    assert(revBrief.body.briefReapprovalRequired === true, 'Brief reapproval required flag is true');
    assert(revBrief.body.strategyChanged === true, 'Strategy changed flag is true');

    const projAfterBriefRev = await fetchJson(`${BASE}/projects/${projectId}`);
    assert(projAfterBriefRev.body.data.intake.briefApproved === false, 'Brief approval revoked after strategy change');

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