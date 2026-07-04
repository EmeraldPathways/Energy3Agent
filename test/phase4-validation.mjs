import 'dotenv/config';
import { spawn } from 'node:child_process';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 3399;
const BASE = `http://localhost:${PORT}/api`;

let projectId;
let passed = 0;
let failed = 0;
let skipped = 0;

const HAS_GEMINI = !!process.env.GEMINI_API_KEY;

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
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, PORT: String(PORT) },
    stdio: 'pipe',
    shell: true,
  });
  proc.stdout.on('data', () => {});
  proc.stderr.on('data', () => {});

  try {
    await waitForServer(30);
    console.log('Server ready.');

    // 1. Create project
    console.log('\n=== Create Project ===');
    const create = await fetchJson(`${BASE}/projects`, { method: 'POST', body: { name: 'Phase4 Test ' + randomUUID().slice(0, 6), description: 'Brief validation' } });
    assert(create.status === 201, 'Create project returns 201');
    projectId = create.body.data.id;

    // 2. Run manager brief before intake approval — BLOCKED
    console.log('\n=== Gate: run-manager blocked before intake ===');
    const beforeIntake = await fetchJson(`${BASE}/projects/${projectId}/agents/run-manager`, { method: 'POST' });
    assert(beforeIntake.status === 400, 'run-manager blocked before intake approval');
    assert(beforeIntake.body.error.includes('Intake must be approved'), 'Error mentions intake approval');

    // 3. Approve brief before it exists — BLOCKED
    console.log('\n=== Gate: approve/brief blocked before brief exists ===');
    const beforeBrief = await fetchJson(`${BASE}/projects/${projectId}/approve/brief`, { method: 'POST' });
    assert(beforeBrief.status === 400, 'approve/brief blocked');
    assert(beforeBrief.body.error.includes('must be generated'), 'Error mentions brief generation');

    // 4. Set up approved intake state via PUT intake endpoint
    console.log('\n=== Setup: PUT intake with approved state ===');
    const intakeSetup = {
      meetingNotesText: 'Test meeting notes about Q3 launch targeting Gen Z.',
      brandGuideText: 'Brand guide: friendly tone, sustainable positioning.',
      stage: 'approved',
      meetingNotesIntake: { client_goals: ['Test goal'], campaign_objectives: ['Test objective'], target_audiences: ['Gen Z'], products_or_services: ['Eco product'], key_messages_mentioned: ['Go green'], channels_requested: ['Instagram'], deadlines_or_timing: 'Q3', budget_notes: '$50k', stakeholder_concerns: [], approval_requirements: 'Marketing lead', open_questions: [], summary: 'Test meeting summary' },
      brandGuideIntake: { brand_positioning: 'Sustainable', tone_of_voice: 'Friendly', visual_style: 'Clean', colour_guidance: 'Green palette', typography_guidance: 'Sans-serif', logo_rules: 'Minimal use', approved_language: ['eco-friendly', 'sustainable'], restricted_language: ['cheap'], compliance_notes: 'None', audience_guidance: 'Under 30', content_examples: ['Reel videos'], summary: 'Test brand summary' },
      assetReview: { assets: [], missing_assets: [], overall_asset_summary: 'No assets' },
      intakeSummary: { campaign_readiness: 'Ready to proceed', summary: 'Ready for brief', confirmed_inputs: ['Meeting notes', 'Brand guide'], missing_inputs: [], risks: [], recommended_next_step: 'Proceed to Manager Brief' },
      humanCheckApproved: true,
      intakeApproved: true,
      intakeApprovedAt: new Date().toISOString(),
    };
    const setupRes = await fetchJson(`${BASE}/projects/${projectId}/intake`, { method: 'PUT', body: intakeSetup });
    assert(setupRes.status === 200, 'PUT intake returns 200');

    // 5. Run manager brief
    console.log('\n=== Generate Manager Brief ===');
    if (HAS_GEMINI) {
      const briefGen = await fetchJson(`${BASE}/projects/${projectId}/agents/run-manager`, { method: 'POST' });
      if (briefGen.status === 200 && briefGen.body.data) {
        assert(true, 'run-manager returns 200 after intake approval');
        assert(briefGen.body.data.campaign_title, 'Brief has campaign_title');
        assert(Array.isArray(briefGen.body.data.key_messages), 'key_messages is array');
        assert(Array.isArray(briefGen.body.data.approval_checklist), 'approval_checklist is array');
      } else {
        failed++;
        console.log('  FAIL: Brief generation failed');
        console.log('  Status:', briefGen.status);
        console.log('  Error:', JSON.stringify(briefGen.body));
      }
    } else {
      skip('Manager brief generation');
    }

    // 6. Approve brief
    console.log('\n=== Approve Campaign Brief ===');
    if (HAS_GEMINI) {
      const approve = await fetchJson(`${BASE}/projects/${projectId}/approve/brief`, { method: 'POST' });
      if (approve.status === 200) {
        assert(true, 'approve/brief returns 200');
        assert(approve.body.data.briefApproved === true, 'briefApproved is true');
        assert(approve.body.data.briefStage === 'approved', 'briefStage is approved');
      } else {
        failed++;
        console.log('  FAIL: Brief approval failed');
        console.log('  Status:', approve.status);
        console.log('  Error:', JSON.stringify(approve.body));
      }
    } else {
      skip('Brief approval');
    }

    // 7. Delete project
    console.log('\n=== Cleanup ===');
    const del = await fetchJson(`${BASE}/projects/${projectId}`, { method: 'DELETE' });
    assert(del.status === 204, 'Delete project returns 204');

    console.log(`\n====================`);
    console.log(`Results: ${passed} passed, ${failed} failed, ${skipped} skipped`);
    console.log(`====================`);

    if (!HAS_GEMINI) {
      console.log(`\nNOTE: GEMINI_API_KEY not set. Live agent execution paths were SKIPPED.`);
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