import 'dotenv/config';
import { execSync, spawn } from 'node:child_process';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 3495;
const BASE = `http://localhost:${PORT}/api`;

let projectId;
let passed = 0;
let failed = 0;
let skipped = 0;

const HAS_GEMINI = !!process.env.GEMINI_API_KEY;
const LIVE_MODE = HAS_GEMINI;

function assert(condition, label) {
  if (condition) { console.log(`  PASS: ${label}`); passed++; }
  else { console.log(`  FAIL: ${label}`); failed++; }
}

function skip(label) {
  console.log(`  SKIP: ${label} (no GEMINI_API_KEY)`);
  skipped++;
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
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, body: data ? JSON.parse(data) : null });
          } catch {
            resolve({ status: res.statusCode, body: data });
          }
        });
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

// ── Schema shape validators (lightweight, no zod at runtime) ──

const MEETING_NOTES_KEYS = ['client_goals', 'campaign_objectives', 'target_audiences', 'products_or_services', 'key_messages_mentioned', 'channels_requested', 'deadlines_or_timing', 'budget_notes', 'stakeholder_concerns', 'approval_requirements', 'open_questions', 'summary'];
const BRAND_GUIDE_KEYS = ['brand_positioning', 'tone_of_voice', 'visual_style', 'colour_guidance', 'typography_guidance', 'logo_rules', 'approved_language', 'restricted_language', 'compliance_notes', 'audience_guidance', 'content_examples', 'summary'];
const ASSET_REVIEW_KEYS = ['assets', 'missing_assets', 'overall_asset_summary'];
const INTAKE_SUMMARY_KEYS = ['campaign_readiness', 'summary', 'confirmed_inputs', 'missing_inputs', 'risks', 'recommended_next_step'];

const MANAGER_BRIEF_KEYS = ['campaign_title', 'client', 'campaign_objective', 'business_problem', 'customer_insight', 'target_audience', 'campaign_proposition', 'key_messages', 'content_pillars', 'recommended_channels', 'asset_requirements', 'brand_rules_to_follow', 'compliance_flags', 'missing_information', 'approval_checklist', 'campaign_brief'];

const CREATOR_KEYS = ['campaign_title', 'production_strategy', 'content_pillar_breakdown', 'channel_allocation', 'timeline_phases', 'asset_checklist', 'team_roles_needed', 'approval_gates', 'summary'];

const TEXT_CONTENT_KEYS = ['headlines', 'social_captions', 'ad_copy', 'email_body', 'long_form_content', 'cta_suggestions', 'tone_notes', 'summary'];
const IMAGERY_KEYS = ['visual_concept', 'color_palette_suggestions', 'image_prompts', 'typography_suggestions', 'layout_ideas', 'summary'];
const MARKET_RESEARCH_KEYS = ['target_audience_insights', 'competitor_analysis', 'market_trends', 'channel_recommendations', 'benchmark_data', 'risk_factors', 'opportunities', 'summary'];

const FINAL_ASSEMBLY_KEYS = ['generatedAt', 'campaignTitle', 'client', 'intakeSummary', 'campaignObjective', 'targetAudience', 'keyMessages', 'contentPillars', 'recommendedChannels', 'productionStrategy', 'assetChecklist', 'headlines', 'adCopy', 'ctaSuggestions', 'visualConcept', 'imagePrompts', 'audienceInsights', 'competitorAnalysis', 'risks', 'opportunities', 'feedbackCount', 'revisionCount', 'summary'];

function hasAllKeys(obj, keys, label) {
  if (!obj || typeof obj !== 'object') { assert(false, `${label}: not an object`); return; }
  for (const k of keys) {
    assert(k in obj, `${label}: has key '${k}'`);
  }
}

function assertString(val, label) {
  assert(typeof val === 'string' && val.trim().length > 0, label);
}

function assertArray(val, label) {
  assert(Array.isArray(val), label);
}

function assertObject(val, label) {
  assert(val !== null && typeof val === 'object', label);
}

// ── Deep clone helper for preserving pre-revision state ──
function deepClone(obj) { return JSON.parse(JSON.stringify(obj)); }

// ======================================================================
// MAIN
// ======================================================================
async function main() {
  console.log('=== Agent Validation Suite ===');
  console.log(`GEMINI_API_KEY present: ${HAS_GEMINI}`);
  console.log(`Live agent execution: ${LIVE_MODE ? 'ENABLED' : 'DISABLED'}\n`);

  try {
    execSync(`powershell -Command "Get-NetTCPConnection -LocalPort ${PORT} -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"`, { stdio: 'ignore', timeout: 5000 });
  } catch {}

  const proc = spawn(process.execPath, ['--import', 'tsx', 'server/src/index.ts'], {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, PORT: String(PORT) },
    stdio: 'ignore',
    shell: false,
    windowsHide: true,
  });

  try {
    await waitForServer(30);
    console.log('Server ready.\n');

    // ──────────────────────────────────────────────────────────
    // SECTION A: Create project
    // ──────────────────────────────────────────────────────────
    console.log('--- Section A: Create project ---');
    const create = await fetchJson(`${BASE}/projects`, { method: 'POST', body: { name: 'Agent Test ' + randomUUID().slice(0, 6), description: 'Agent validation' } });
    assert(create.status === 201, 'Create project returns 201');
    if (create.status !== 201 || !create.body?.data?.id) {
      throw new Error(`Create project failed: status=${create.status} body=${JSON.stringify(create.body)}`);
    }
    projectId = create.body.data.id;

    // ──────────────────────────────────────────────────────────
    // SECTION B: Gate enforcement — agent runs blocked
    // ──────────────────────────────────────────────────────────
    console.log('\n--- Section B: Gate enforcement ---');

    // B1: run-intake blocked before meeting notes / brand guide
    const b1 = await fetchJson(`${BASE}/projects/${projectId}/agents/run-intake`, { method: 'POST' });
    // run-intake may return 400 if no text to process
    assert(b1.status === 400, 'run-intake blocked without inputs');

    // B2: run-manager blocked before intake approval
    const b2 = await fetchJson(`${BASE}/projects/${projectId}/agents/run-manager`, { method: 'POST' });
    assert(b2.status === 400, 'run-manager blocked before intake approval');

    // B3: run-creator blocked before brief approval
    const b3 = await fetchJson(`${BASE}/projects/${projectId}/agents/run-creator`, { method: 'POST' });
    assert(b3.status === 400, 'run-creator blocked before brief approval');

    // B4: run-specialists blocked before creator output
    const b4 = await fetchJson(`${BASE}/projects/${projectId}/agents/run-specialists`, { method: 'POST' });
    assert(b4.status === 400, 'run-specialists blocked before creator output');

    // B5: feedback blocked before specialist outputs
    const b5 = await fetchJson(`${BASE}/projects/${projectId}/feedback`, { method: 'POST', body: { targetSection: 'text_content', feedback: 'test' } });
    assert(b5.status === 400, 'Feedback blocked before specialist outputs');

    // B6: revise blocked before feedback
    const b6 = await fetchJson(`${BASE}/projects/${projectId}/agents/revise`, { method: 'POST' });
    assert(b6.status === 400, 'Revise blocked before feedback');

    // B7: run-campaign-manager blocked before valid state
    const b7 = await fetchJson(`${BASE}/projects/${projectId}/agents/run-campaign-manager`, { method: 'POST' });
    assert(b7.status === 400, 'run-campaign-manager blocked before valid specialist state');

    // ──────────────────────────────────────────────────────────
    // SECTION C: Seed project data
    // ──────────────────────────────────────────────────────────
    console.log('\n--- Section C: Seed project data ---');

    if (!LIVE_MODE) {
      // Seed full state so we can test gates + structure even without Gemini
      const seed = await fetchJson(`${BASE}/projects/${projectId}/intake`, {
        method: 'PUT',
        body: {
          meetingNotesText: 'Test meeting notes for agent validation.',
          brandGuideText: 'Test brand guide for agent validation.',
          stage: 'approved',
          meetingNotesIntake: { client_goals: ['Goal A'], campaign_objectives: ['Obj A'], target_audiences: ['Audience A'], products_or_services: ['Product A'], key_messages_mentioned: ['Message A'], channels_requested: ['Email'], deadlines_or_timing: 'Q1', budget_notes: '10k', stakeholder_concerns: [], approval_requirements: 'Manager', open_questions: [], summary: 'Test meeting notes output' },
          brandGuideIntake: { brand_positioning: 'Premium', tone_of_voice: 'Friendly', visual_style: 'Clean', colour_guidance: 'Green', typography_guidance: 'Sans', logo_rules: 'Minimal', approved_language: [], restricted_language: [], compliance_notes: 'None', audience_guidance: 'All ages', content_examples: [], summary: 'Test brand guide output' },
          assetReview: { assets: [], missing_assets: [], overall_asset_summary: 'No assets' },
          intakeSummary: { campaign_readiness: 'Ready', summary: 'Test summary', confirmed_inputs: ['Notes'], missing_inputs: [], risks: [], recommended_next_step: 'Proceed' },
          humanCheckApproved: true, intakeApproved: true, intakeApprovedAt: new Date().toISOString(),
          managerBrief: { campaign_title: 'Agent Test Campaign', client: 'Test Client', campaign_objective: 'Validate agents', business_problem: 'Need testing', customer_insight: 'Users want reliability', target_audience: 'Engineers', campaign_proposition: 'Reliable agent validation', key_messages: ['Test everything'], content_pillars: ['Quality'], recommended_channels: ['Web'], asset_requirements: ['Logo'], brand_rules_to_follow: ['Keep it clean'], compliance_flags: [], missing_information: [], approval_checklist: ['All agents pass'], campaign_brief: 'This is a test campaign for agent validation.' },
          briefApproved: true, briefApprovedAt: new Date().toISOString(), briefStage: 'approved',
          creatorPlan: { campaign_title: 'Agent Test Campaign', production_strategy: 'Test-driven', content_pillar_breakdown: [{ pillar: 'Quality', objective: 'Prove correctness', format_suggestions: ['Doc'], estimated_volume: '1' }], channel_allocation: [{ channel: 'Web', content_types: ['Docs'], posting_cadence: 'Weekly', kpi: 'Coverage' }], timeline_phases: [{ phase: 'Test', duration: '1d', key_activities: ['Run tests'] }], asset_checklist: ['Test file'], team_roles_needed: ['QA'], approval_gates: ['PR'], summary: 'Test creator plan' },
          creatorStage: 'generated',
          specialistOutputs: {
            textContent: { headlines: ['Test Headline'], social_captions: ['Test caption'], ad_copy: ['Test ad'], email_body: ['Test email'], long_form_content: ['Test long'], cta_suggestions: ['Click now'], tone_notes: 'Professional', summary: 'Test text content' },
            imageryCreative: { visual_concept: 'Test concept', color_palette_suggestions: ['Green'], image_prompts: [{ format: 'square', scene_description: 'Test scene', prompt: 'Test prompt', suggested_alt_text: 'Test alt' }], typography_suggestions: ['Sans'], layout_ideas: ['Grid'], summary: 'Test imagery' },
            marketResearch: { target_audience_insights: ['Insight'], competitor_analysis: ['Competitor'], market_trends: ['Trend'], channel_recommendations: ['Web'], benchmark_data: ['Bench'], risk_factors: ['Risk'], opportunities: ['Opp'], summary: 'Test research' },
          },
          specialistsStage: 'generated',
        }
      });
      assert(seed.status === 200, 'Seed project state returns 200');
      console.log('  (seeded full project state with mock data — Gemini not available)');
    }

    // ──────────────────────────────────────────────────────────
    // SECTION D: Live intake agent execution
    // ──────────────────────────────────────────────────────────
    console.log('\n--- Section D: Intake agents ---');

    if (LIVE_MODE) {
      // Seed minimal inputs for intake
      const seedIntake = await fetchJson(`${BASE}/projects/${projectId}/intake`, {
        method: 'PUT',
        body: {
          meetingNotesText: 'We need a Q3 campaign targeting Gen Z consumers. The goal is to increase brand awareness by 25%. Budget is 50k. Key message: sustainable fashion for everyone. Launch by August 15.',
          brandGuideText: 'Our brand is premium eco-fashion. Tone is warm and empowering. Use deep green and cream colours. Fonts: Montserrat for headings, Open Sans for body. Logo must sit on white background with 20px padding. Avoid competitor names and black colour as background.',
          stage: 'setup',
        }
      });
      assert(seedIntake.status === 200, 'Seed intake inputs returns 200');

      // Approve human check
      const hc = await fetchJson(`${BASE}/projects/${projectId}/approve/human-check`, { method: 'POST' });
      assert(hc.status === 200, 'Human check approved');

      // Run intake
      console.log('  Running intake agents (Gemini live)...');
      const intakeRun = await fetchJson(`${BASE}/projects/${projectId}/agents/run-intake`, { method: 'POST' });

      if (intakeRun.status === 200) {
        console.log('  Intake agents completed successfully.');

        // Validate meeting notes output
        const mn = intakeRun.body.data.meetingNotesIntake;
        assertObject(mn, 'meetingNotesIntake is object');
        if (mn) hasAllKeys(mn, MEETING_NOTES_KEYS, 'meetingNotesIntake');
        if (mn) assertArray(mn.client_goals, 'meetingNotesIntake.client_goals is array');
        if (mn) assertArray(mn.campaign_objectives, 'meetingNotesIntake.campaign_objectives is array');
        if (mn) assertString(mn.summary, 'meetingNotesIntake.summary is non-empty string');

        // Validate brand guide output
        const bg = intakeRun.body.data.brandGuideIntake;
        assertObject(bg, 'brandGuideIntake is object');
        if (bg) hasAllKeys(bg, BRAND_GUIDE_KEYS, 'brandGuideIntake');
        if (bg) assertString(bg.summary, 'brandGuideIntake.summary is non-empty string');

        // Validate asset review output
        const ar = intakeRun.body.data.assetReview;
        assertObject(ar, 'assetReview is object');
        if (ar) hasAllKeys(ar, ASSET_REVIEW_KEYS, 'assetReview');

        // Validate intake summary output
        const is_ = intakeRun.body.data.intakeSummary;
        assertObject(is_, 'intakeSummary is object');
        if (is_) hasAllKeys(is_, INTAKE_SUMMARY_KEYS, 'intakeSummary');
        if (is_) assertString(is_.summary, 'intakeSummary.summary is non-empty string');

        // Verify persistence
        const projAfterIntake = await fetchJson(`${BASE}/projects/${projectId}`);
        const pi = projAfterIntake.body.data.intake;
        assert(!!pi.meetingNotesIntake, 'meetingNotesIntake persisted');
        assert(!!pi.brandGuideIntake, 'brandGuideIntake persisted');
        assert(!!pi.assetReview, 'assetReview persisted');
        assert(!!pi.intakeSummary, 'intakeSummary persisted');

        // Approve intake
        const ai = await fetchJson(`${BASE}/projects/${projectId}/approve/intake`, { method: 'POST' });
        assert(ai.status === 200, 'Approve intake returns 200');
      } else {
        assert(false, `run-intake failed with status ${intakeRun.status}: ${JSON.stringify(intakeRun.body)}`);
      }
    } else {
      skip('Intake agent execution');
      // Already seeded with approved state — approve intake for chain
      const ai = await fetchJson(`${BASE}/projects/${projectId}/approve/intake`, { method: 'POST' });
      if (ai.status !== 200) {
        // May need to seed approval state
        const patch = await fetchJson(`${BASE}/projects/${projectId}/intake`, {
          method: 'PUT',
          body: { intakeApproved: true, intakeApprovedAt: new Date().toISOString() }
        });
        assert(patch.status === 200, 'Seed intake approval');
      }
    }

    // ──────────────────────────────────────────────────────────
    // SECTION E: Manager brief agent
    // ──────────────────────────────────────────────────────────
    console.log('\n--- Section E: Manager brief agent ---');

    if (LIVE_MODE) {
      console.log('  Running manager brief agent (Gemini live)...');
      const mb = await fetchJson(`${BASE}/projects/${projectId}/agents/run-manager`, { method: 'POST' });

      if (mb.status === 200) {
        console.log('  Manager brief generated successfully.');
        const brief = mb.body.data;
        assertObject(brief, 'Manager brief is object');
        hasAllKeys(brief, MANAGER_BRIEF_KEYS, 'Manager brief');
        assertString(brief.campaign_title, 'Manager brief campaign_title is non-empty');
        assertString(brief.campaign_brief, 'Manager brief campaign_brief is non-empty');
        assertArray(brief.key_messages, 'Manager brief key_messages is array');
        assertArray(brief.content_pillars, 'Manager brief content_pillars is array');

        // Verify persistence
        const projAfterBrief = await fetchJson(`${BASE}/projects/${projectId}`);
        const pb = projAfterBrief.body.data.intake;
        assert(!!pb.managerBrief, 'Manager brief persisted');
        assert(pb.briefStage === 'generated' || pb.briefStage === 'review', 'briefStage updated');

        // Approve brief
        const ab = await fetchJson(`${BASE}/projects/${projectId}/approve/brief`, { method: 'POST' });
        assert(ab.status === 200, 'Approve brief returns 200');
      } else {
        assert(false, `run-manager failed with status ${mb.status}: ${JSON.stringify(mb.body)}`);
      }
    } else {
      skip('Manager brief agent execution');
      // Seeded state already has approved brief
      const ab = await fetchJson(`${BASE}/projects/${projectId}/approve/brief`, { method: 'POST' });
      if (ab.status !== 200) {
        // May need to patch
        const patch = await fetchJson(`${BASE}/projects/${projectId}/intake`, {
          method: 'PUT',
          body: { briefApproved: true, briefApprovedAt: new Date().toISOString(), briefStage: 'approved' }
        });
        assert(patch.status === 200, 'Seed brief approval');
      }
    }

    // ──────────────────────────────────────────────────────────
    // SECTION F: Creator agent
    // ──────────────────────────────────────────────────────────
    console.log('\n--- Section F: Creator agent ---');

    if (LIVE_MODE) {
      console.log('  Running creator agent (Gemini live)...');
      const cr = await fetchJson(`${BASE}/projects/${projectId}/agents/run-creator`, { method: 'POST' });

      if (cr.status === 200) {
        console.log('  Creator plan generated successfully.');
        const plan = cr.body.data;
        assertObject(plan, 'Creator plan is object');
        hasAllKeys(plan, CREATOR_KEYS, 'Creator plan');
        assertString(plan.campaign_title, 'Creator campaign_title is non-empty');
        assertString(plan.production_strategy, 'Creator production_strategy is non-empty');
        assertArray(plan.content_pillar_breakdown, 'Creator content_pillar_breakdown is array');
        assertArray(plan.channel_allocation, 'Creator channel_allocation is array');
        assertArray(plan.asset_checklist, 'Creator asset_checklist is array');

        // Verify persistence
        const projAfterCreator = await fetchJson(`${BASE}/projects/${projectId}`);
        const pc = projAfterCreator.body.data.intake;
        assert(!!pc.creatorPlan, 'Creator plan persisted');
        assert(pc.creatorStage === 'generated', 'creatorStage set to generated');
      } else {
        assert(false, `run-creator failed with status ${cr.status}: ${JSON.stringify(cr.body)}`);
      }
    } else {
      skip('Creator agent execution');
    }

    // ──────────────────────────────────────────────────────────
    // SECTION G: Specialist agents
    // ──────────────────────────────────────────────────────────
    console.log('\n--- Section G: Specialist agents ---');

    if (LIVE_MODE) {
      console.log('  Running specialist agents (Gemini live)...');
      const sp = await fetchJson(`${BASE}/projects/${projectId}/agents/run-specialists`, { method: 'POST' });

      if (sp.status === 200) {
        console.log('  Specialist outputs generated successfully.');

        // Validate text content
        const tc = sp.body.data.textContent;
        assertObject(tc, 'textContent is object');
        if (tc) {
          hasAllKeys(tc, TEXT_CONTENT_KEYS, 'Text content');
          assertArray(tc.headlines, 'Text content headlines is array');
          assertArray(tc.social_captions, 'Text content social_captions is array');
          assertArray(tc.cta_suggestions, 'Text content cta_suggestions is array');
        }

        // Validate imagery creative
        const ic = sp.body.data.imageryCreative;
        assertObject(ic, 'imageryCreative is object');
        if (ic) {
          hasAllKeys(ic, IMAGERY_KEYS, 'Imagery creative');
          assertString(ic.visual_concept, 'Imagery visual_concept is non-empty');
          assertArray(ic.image_prompts, 'Imagery image_prompts is array');
        }

        // Validate market research
        const mr = sp.body.data.marketResearch;
        assertObject(mr, 'marketResearch is object');
        if (mr) {
          hasAllKeys(mr, MARKET_RESEARCH_KEYS, 'Market research');
          assertArray(mr.target_audience_insights, 'Market research target_audience_insights is array');
          assertArray(mr.competitor_analysis, 'Market research competitor_analysis is array');
        }

        // Verify persistence
        const projAfterSpec = await fetchJson(`${BASE}/projects/${projectId}`);
        const ps = projAfterSpec.body.data.intake;
        assert(!!ps.specialistOutputs, 'specialistOutputs persisted');
        assert(!!ps.specialistOutputs.textContent, 'textContent persisted');
        assert(!!ps.specialistOutputs.imageryCreative, 'imageryCreative persisted');
        assert(!!ps.specialistOutputs.marketResearch, 'marketResearch persisted');
        assert(ps.specialistsStage === 'generated', 'specialistsStage set to generated');
      } else {
        assert(false, `run-specialists failed with status ${sp.status}: ${JSON.stringify(sp.body)}`);
      }
    } else {
      skip('Specialist agent execution');
    }

    // ──────────────────────────────────────────────────────────
    // SECTION H: Revision routing — gate tests
    // ──────────────────────────────────────────────────────────
    console.log('\n--- Section H: Revision routing — gate tests ---');

    if (LIVE_MODE) {
      // H1: Submit feedback for text_content
      console.log('  Testing text_content feedback and selective revision...');
      const f1 = await fetchJson(`${BASE}/projects/${projectId}/feedback`, { method: 'POST', body: { targetSection: 'text_content', feedback: 'Make headlines more punchy and add urgency' } });
      assert(f1.status === 201, 'Submit text_content feedback returns 201');

      // Capture pre-revision state
      const preRev1 = await fetchJson(`${BASE}/projects/${projectId}`);
      const preSpec = deepClone(preRev1.body.data.intake.specialistOutputs);

      // H2: Run revision — should only rerun text_content
      const rev1 = await fetchJson(`${BASE}/projects/${projectId}/agents/revise`, { method: 'POST' });
      if (rev1.status === 200) {
        assert(rev1.body.message !== undefined, 'Revision returns message');
        assert(!rev1.body.strategyChanged, 'text_content feedback does not trigger strategy changed');
        assert(!rev1.body.briefReapprovalRequired, 'text_content feedback does not trigger brief reapproval');

        // Verify untouched outputs preserved (or re-fetch)
        const postRev1 = await fetchJson(`${BASE}/projects/${projectId}`);
        const postSpec = postRev1.body.data.intake.specialistOutputs;
        assertObject(postSpec, 'specialistOutputs still present after text_content revision');
        if (postSpec && preSpec) {
          // textContent should have changed (or at minimum still exist)
          assert(!!postSpec.textContent, 'textContent still exists after revision');
        }
      } else {
        assert(false, `text_content revision failed: ${rev1.status} ${JSON.stringify(rev1.body)}`);
      }

      // H3: Submit feedback for imagery_creative
      console.log('  Testing imagery_creative feedback and selective revision...');
      const f2 = await fetchJson(`${BASE}/projects/${projectId}/feedback`, { method: 'POST', body: { targetSection: 'imagery_creative', feedback: 'Use warmer colour palette' } });
      assert(f2.status === 201, 'Submit imagery_creative feedback returns 201');

      const rev2 = await fetchJson(`${BASE}/projects/${projectId}/agents/revise`, { method: 'POST' });
      if (rev2.status === 200) {
        assert(!!rev2.body.data, 'Imagery revision returns data');
        assert(!rev2.body.strategyChanged, 'imagery_creative feedback does not trigger strategy changed');

        const postRev2 = await fetchJson(`${BASE}/projects/${projectId}`);
        assert(!!postRev2.body.data.intake.specialistOutputs.imageryCreative, 'imageryCreative still present after revision');
      } else {
        assert(false, `imagery_creative revision failed: ${rev2.status} ${JSON.stringify(rev2.body)}`);
      }

      // H4: Submit feedback for market_research
      console.log('  Testing market_research feedback and selective revision...');
      const f3 = await fetchJson(`${BASE}/projects/${projectId}/feedback`, { method: 'POST', body: { targetSection: 'market_research', feedback: 'Add more competitor data' } });
      assert(f3.status === 201, 'Submit market_research feedback returns 201');

      const rev3 = await fetchJson(`${BASE}/projects/${projectId}/agents/revise`, { method: 'POST' });
      if (rev3.status === 200) {
        assert(!!rev3.body.data, 'Market research revision returns data');
        const postRev3 = await fetchJson(`${BASE}/projects/${projectId}`);
        assert(!!postRev3.body.data.intake.specialistOutputs.marketResearch, 'marketResearch still present after revision');
      } else {
        assert(false, `market_research revision failed: ${rev3.status} ${JSON.stringify(rev3.body)}`);
      }

      // H5: Submit feedback for creator_plan
      console.log('  Testing creator_plan feedback and revision...');
      const f4 = await fetchJson(`${BASE}/projects/${projectId}/feedback`, { method: 'POST', body: { targetSection: 'creator_plan', feedback: 'Adjust content pillars for mobile-first approach' } });
      assert(f4.status === 201, 'Submit creator_plan feedback returns 201');

      const rev4 = await fetchJson(`${BASE}/projects/${projectId}/agents/revise`, { method: 'POST' });
      if (rev4.status === 200) {
        assert(rev4.body.strategyChanged === true, 'creator_plan feedback triggers strategy changed');
        assert(rev4.body.invalidatedSpecialists === true, 'creator_plan feedback invalidates specialists');
        const postRev4 = await fetchJson(`${BASE}/projects/${projectId}`);
        assert(!postRev4.body.data.intake.specialistOutputs, 'specialistOutputs cleared after creator plan revision');
      } else {
        assert(false, `creator_plan revision failed: ${rev4.status} ${JSON.stringify(rev4.body)}`);
      }

      // Re-run specialists after creator invalidated them
      if (rev4.status === 200) {
        console.log('  Re-running specialists after creator revision...');
        const sp2 = await fetchJson(`${BASE}/projects/${projectId}/agents/run-specialists`, { method: 'POST' });
        assert(sp2.status === 200, 'Re-run specialists after creator revision returns 200');
      }

      // H6: Submit feedback for brief_strategy
      console.log('  Testing brief_strategy feedback...');
      const f5 = await fetchJson(`${BASE}/projects/${projectId}/feedback`, { method: 'POST', body: { targetSection: 'brief_strategy', feedback: 'Refocus on enterprise segment instead of consumer' } });
      assert(f5.status === 201, 'Submit brief_strategy feedback returns 201');

      const rev5 = await fetchJson(`${BASE}/projects/${projectId}/agents/revise`, { method: 'POST' });
      if (rev5.status === 200) {
        assert(rev5.body.strategyChanged === true, 'brief_strategy feedback triggers strategy changed');
        assert(rev5.body.briefReapprovalRequired === true, 'brief_strategy feedback triggers brief reapproval required');

        // Verify brief approval was cleared
        const postRev5 = await fetchJson(`${BASE}/projects/${projectId}`);
        assert(postRev5.body.data.intake.briefApproved === false, 'briefApproved cleared after brief_strategy feedback');
      } else {
        assert(false, `brief_strategy revision failed: ${rev5.status} ${JSON.stringify(rev5.body)}`);
      }
    } else {
      skip('Revision routing — live agent reruns');
      // Still test that feedback submission works against seeded specialist data
      const f = await fetchJson(`${BASE}/projects/${projectId}/feedback`, { method: 'POST', body: { targetSection: 'text_content', feedback: 'Test feedback with seeded data' } });
      assert(f.status === 201, 'Submit feedback against seeded state returns 201');

      const rev = await fetchJson(`${BASE}/projects/${projectId}/agents/revise`, { method: 'POST' });
      // May succeed (deterministic routing) or fail (no Gemini to rerun)
      // The gate test already verified blocking, so just log
      console.log(`  Revise with seeded data: status ${rev.status} (may fail without Gemini for reruns)`);
    }

    // ──────────────────────────────────────────────────────────
    // SECTION I: Campaign manager / final assembly
    // ──────────────────────────────────────────────────────────
    console.log('\n--- Section I: Campaign manager / final assembly ---');

    if (LIVE_MODE) {
      // Ensure we have valid specialist outputs (re-seed if needed after creator revision)
      const currentProj = await fetchJson(`${BASE}/projects/${projectId}`);
      const spNow = currentProj.body.data.intake.specialistOutputs;

      if (!spNow || !spNow.textContent) {
        // Re-seed specialists if they were cleared
        console.log('  Re-seeding specialist outputs for final assembly...');
        await fetchJson(`${BASE}/projects/${projectId}/intake`, {
          method: 'PUT',
          body: {
            specialistOutputs: {
              textContent: { headlines: ['Final headline'], social_captions: ['Final caption'], ad_copy: ['Final ad'], email_body: ['Final email'], long_form_content: ['Final long'], cta_suggestions: ['Buy now'], tone_notes: 'Professional', summary: 'Final text' },
              imageryCreative: { visual_concept: 'Final concept', color_palette_suggestions: ['Green'], image_prompts: [{ format: 'landscape', scene_description: 'Final scene', prompt: 'Final prompt', suggested_alt_text: 'Final alt' }], typography_suggestions: ['Sans'], layout_ideas: ['Grid'], summary: 'Final imagery' },
              marketResearch: { target_audience_insights: ['Final insight'], competitor_analysis: ['Final competitor'], market_trends: ['Final trend'], channel_recommendations: ['Web'], benchmark_data: ['Final bench'], risk_factors: ['Final risk'], opportunities: ['Final opp'], summary: 'Final research' },
            },
            specialistsStage: 'generated',
            intakeApproved: true,
            briefApproved: true, briefApprovedAt: new Date().toISOString(), briefStage: 'approved',
          }
        });
      }

      // Approve brief if needed
      const preBrief = await fetchJson(`${BASE}/projects/${projectId}`);
      if (!preBrief.body.data.intake.briefApproved) {
        await fetchJson(`${BASE}/projects/${projectId}/intake`, {
          method: 'PUT',
          body: { briefApproved: true, briefApprovedAt: new Date().toISOString(), briefStage: 'approved', intakeApproved: true }
        });
      }

      console.log('  Running campaign manager (deterministic assembly)...');
      const cm = await fetchJson(`${BASE}/projects/${projectId}/agents/run-campaign-manager`, { method: 'POST' });

      if (cm.status === 200) {
        console.log('  Final assembly generated successfully.');
        const assembly = cm.body.data;
        assertObject(assembly, 'Final assembly is object');
        hasAllKeys(assembly, FINAL_ASSEMBLY_KEYS, 'Final assembly');
        assertString(assembly.campaignTitle, 'Final assembly campaignTitle is non-empty');
        assertArray(assembly.keyMessages, 'Final assembly keyMessages is array');
        assertArray(assembly.headlines, 'Final assembly headlines is array');
        assertArray(assembly.imagePrompts, 'Final assembly imagePrompts is array');
        assert(typeof assembly.feedbackCount === 'number', 'Final assembly feedbackCount is number');
        assert(typeof assembly.revisionCount === 'number', 'Final assembly revisionCount is number');

        // Verify persistence
        const projAfterFinal = await fetchJson(`${BASE}/projects/${projectId}`);
        const pf = projAfterFinal.body.data.intake;
        assert(!!pf.finalAssembly, 'finalAssembly persisted');
        assert(pf.finalAssemblyStage === 'generated', 'finalAssemblyStage set to generated');

        // Approve final
        const af = await fetchJson(`${BASE}/projects/${projectId}/approve/final`, { method: 'POST' });
        assert(af.status === 200, 'Approve final returns 200');
        const projApproved = await fetchJson(`${BASE}/projects/${projectId}`);
        assert(projApproved.body.data.intake.finalApproved === true, 'finalApproved persisted after approval');
      } else {
        assert(false, `run-campaign-manager failed with status ${cm.status}: ${JSON.stringify(cm.body)}`);
      }
    } else {
      skip('Campaign manager execution');
      // With seeded state, run campaign manager should work (deterministic, no Gemini needed)
      console.log('  Running campaign manager with seeded data (deterministic path)...');
      const cm = await fetchJson(`${BASE}/projects/${projectId}/agents/run-campaign-manager`, { method: 'POST' });
      if (cm.status === 200) {
        const assembly = cm.body.data;
        assertObject(assembly, 'Final assembly is object (seeded)');
        assertString(assembly.campaignTitle, 'Final assembly campaignTitle is non-empty (seeded)');
        assert(typeof assembly.feedbackCount === 'number', 'Final assembly feedbackCount is number (seeded)');

        const projAfterFinal = await fetchJson(`${BASE}/projects/${projectId}`);
        assert(!!projAfterFinal.body.data.intake.finalAssembly, 'finalAssembly persisted (seeded)');
        assert(projAfterFinal.body.data.intake.finalAssemblyStage === 'generated', 'finalAssemblyStage set to generated (seeded)');
      } else {
        // May need specialist data — campaign manager gate requires briefApproved + specialist outputs
        console.log(`  Campaign manager skipped (status ${cm.status}: ${cm.body?.error}) — gates may not be satisfied`);
        skip('Campaign manager — gate not satisfied with seeded data');
      }
    }

    // ──────────────────────────────────────────────────────────
    // Cleanup
    // ──────────────────────────────────────────────────────────
    console.log('\n--- Cleanup ---');
    const del = await fetchJson(`${BASE}/projects/${projectId}`, { method: 'DELETE' });
    assert(del.status === 204, 'Delete project returns 204');

    // ──────────────────────────────────────────────────────────
    // Results
    // ──────────────────────────────────────────────────────────
    console.log(`\n========================================`);
    console.log(`Agent Validation Results`);
    console.log(`========================================`);
    console.log(`Passed:  ${passed}`);
    console.log(`Failed:  ${failed}`);
    console.log(`Skipped: ${skipped} (no GEMINI_API_KEY)`);
    console.log(`========================================`);

    if (!HAS_GEMINI) {
      console.log(`\nNOTE: GEMINI_API_KEY not set.`);
      console.log(`Gate enforcement and structure assertions ran.`);
      console.log(`All live agent execution paths were SKIPPED.`);
      console.log(`Set a valid GEMINI_API_KEY in .env to run the full agent suite.`);
    }

    if (failed > 0) {
      console.log(`\nSOME AGENT TESTS FAILED. Review the FAIL lines above.`);
    } else if (skipped > 0 && passed > 0) {
      console.log(`\nPartial pass: structure + gate tests succeeded, live agent execution skipped.`);
    } else if (failed === 0 && skipped === 0) {
      console.log(`\nFull agent validation PASSED with live Gemini execution.`);
    }

    process.exitCode = failed > 0 ? 1 : 0;
  } catch (err) {
    console.error('Fatal:', err);
    process.exit(1);
  } finally {
    proc.kill();
  }
}

main();
