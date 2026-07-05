import 'dotenv/config';
import { spawn } from 'node:child_process';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 3299;
const BASE = `http://localhost:${PORT}/api`;

let projectId;
let uploadId;
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

function uploadFiles(projectId, formData) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(`/api/projects/${projectId}/uploads`, BASE);
    const req = http.request(
      { hostname: parsed.hostname, port: parsed.port, path: parsed.pathname, method: 'POST', headers: formData.getHeaders() },
      (res) => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => resolve({ status: res.statusCode, body: data ? JSON.parse(data) : null }));
      }
    );
    req.on('error', reject);
    formData.pipe(req);
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

  const tmpDir = path.resolve(__dirname, '..', 'data', 'tmp');
  await fs.mkdir(tmpDir, { recursive: true });
  const filePath = path.join(tmpDir, `test-meeting-${Date.now()}.txt`);
  await fs.writeFile(filePath, 'Meeting Notes: Q3 Product Launch\n\nClient wants to target Gen Z with sustainable messaging. Budget is $50k. Deadline: September 15. Channels: TikTok, Instagram, YouTube. Key message: Eco-friendly without compromise.');

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
    const create = await fetchJson(`${BASE}/projects`, { method: 'POST', body: { name: 'Phase3 Test ' + randomUUID().slice(0, 6), description: 'Intake validation test' } });
    assert(create.status === 201, 'Create project returns 201');
    projectId = create.body.data.id;

    // 2. Upload meeting notes file
    console.log('\n=== Upload Meeting Notes ===');
    const FormData = (await import('form-data')).default;
    const fd = new FormData();
    fd.append('meetingNotes', await fs.readFile(filePath), { filename: 'test-notes.txt', contentType: 'text/plain' });
    const uploadRes = await uploadFiles(projectId, fd);
    assert(uploadRes.status === 201, 'Upload returns 201');
    assert(uploadRes.body.data.length > 0, 'Upload returns file record');
    assert(uploadRes.body.data[0].category === 'meeting_notes', 'File categorized as meeting_notes');
    uploadId = uploadRes.body.data[0].id;

    // 2b. Upload project brief file
    console.log('\n=== Upload Project Brief ===');
    const briefFilePath = path.join(tmpDir, `test-brief-${Date.now()}.txt`);
    await fs.writeFile(briefFilePath, 'Project Brief: Eco-Friendly Product Launch\n\nTarget market: 18-35 age group. Key USP: Carbon-neutral packaging. Competitors: GreenPak, EcoBox. Budget: $50k. Timeline: 8 weeks.');
    const fd2 = new FormData();
    fd2.append('projectBrief', await fs.readFile(briefFilePath), { filename: 'test-brief.txt', contentType: 'text/plain' });
    const briefUploadRes = await uploadFiles(projectId, fd2);
    assert(briefUploadRes.status === 201, 'Project brief upload returns 201');
    assert(briefUploadRes.body.data.length > 0, 'Project brief upload returns file record');
    assert(briefUploadRes.body.data[0].category === 'project_brief', 'File categorized as project_brief');

    // 3. Verify uploads list
    console.log('\n=== List Uploads ===');
    const list = await fetchJson(`${BASE}/projects/${projectId}/uploads`);
    assert(list.status === 200, 'GET uploads returns 200');
    assert(list.body.data.length >= 1, 'Uploads list contains file');

    // 4. Human check approve
    console.log('\n=== Human Check ===');
    const hc = await fetchJson(`${BASE}/projects/${projectId}/approve/human-check`, { method: 'POST' });
    assert(hc.status === 200, 'Human check approve returns 200');
    assert(hc.body.data.humanCheckApproved === true, 'humanCheckApproved is true');

    // 5. Run intake agents
    console.log('\n=== Run Intake ===');
    const intake = await fetchJson(`${BASE}/projects/${projectId}/agents/run-intake`, { method: 'POST' });
    if (intake.status === 200 && intake.body.data) {
      console.log('  intake response:', JSON.stringify(intake.body.data).slice(0, 200));
      assert(true, 'Run intake returns 200');
      assert(intake.body.data.meetingNotesIntake !== null, 'meetingNotesIntake present');
      assert(intake.body.data.brandGuideIntake !== null, 'brandGuideIntake present');
      assert(intake.body.data.assetReview !== null, 'assetReview present');
      assert(intake.body.data.intakeSummary !== null, 'intakeSummary present');

      const mn = intake.body.data.meetingNotesIntake;
      assert(Array.isArray(mn.client_goals), 'client_goals is array');
      assert(Array.isArray(mn.campaign_objectives), 'campaign_objectives is array');
      assert(typeof mn.summary === 'string', 'summary is string');

      const summary = intake.body.data.intakeSummary;
      assert(Array.isArray(summary.confirmed_inputs), 'confirmed_inputs is array');
      assert(Array.isArray(summary.risks), 'risks is array');

      // 6. Approve intake
      console.log('\n=== Approve Intake ===');
      const approve = await fetchJson(`${BASE}/projects/${projectId}/approve/intake`, { method: 'POST' });
      assert(approve.status === 200, 'Approve intake returns 200');
      assert(approve.body.data.intakeApproved === true, 'intakeApproved is true');
      assert(approve.body.data.stage === 'approved', 'stage is approved');
    } else {
      failed++;
      console.log('  FAIL: Intake run failed');
      console.log('  Error:', JSON.stringify(intake.body));
    }

    // 7. Delete upload
    console.log('\n=== Delete Upload ===');
    const delUpload = await fetchJson(`${BASE}/projects/${projectId}/uploads/${uploadId}`, { method: 'DELETE' });
    assert(delUpload.status === 204, 'Delete upload returns 204');

    // 8. Delete project
    console.log('\n=== Delete Project ===');
    const delProj = await fetchJson(`${BASE}/projects/${projectId}`, { method: 'DELETE' });
    assert(delProj.status === 204, 'Delete project returns 204');

    console.log(`\n====================`);
    console.log(`Results: ${passed} passed, ${failed} failed`);
    console.log(`====================`);
    process.exitCode = failed > 0 ? 1 : 0;
  } finally {
    proc.kill();
    try { await fs.rm(tmpDir, { recursive: true, force: true }); } catch {}
  }
}

main();