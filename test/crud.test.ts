import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_PORT = 3099;
const BASE = `http://localhost:${SERVER_PORT}/api`;

let serverProcess: ChildProcess;

function fetchJson(
  url: string,
  options: { method?: string; body?: unknown } = {},
): Promise<{ status: number; body: unknown }> {
  return new Promise((resolve, reject) => {
    const { method = 'GET', body } = options;
    const urlObj = new URL(url);
    const req = http.request(
      {
        hostname: urlObj.hostname,
        port: urlObj.port,
        path: urlObj.pathname,
        method,
        headers: { 'Content-Type': 'application/json' },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          resolve({
            status: res.statusCode ?? 0,
            body: data.length > 0 ? JSON.parse(data) : null,
          });
        });
      },
    );
    req.on('error', reject);
    if (body !== undefined) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function waitForServer(retries = 20): Promise<void> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetchJson(`${BASE}/health`);
      if (res.status === 200) return;
    } catch {
      // server not ready yet
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error('Server did not become ready');
}

before(async () => {
  return new Promise<void>((resolve, reject) => {
    serverProcess = spawn('node', ['--import', 'tsx', 'server/src/index.ts'], {
      cwd: path.resolve(__dirname, '..'),
      env: { ...process.env, PORT: String(SERVER_PORT) },
      stdio: 'pipe',
      shell: true,
    });

    const timeout = setTimeout(() => {
      reject(new Error('Server process did not start within 10s'));
    }, 10000);

    serverProcess.stdout?.on('data', (data: Buffer) => {
      const msg = data.toString();
      if (msg.includes('running')) {
        clearTimeout(timeout);
        // wait for server to be ready
        waitForServer().then(resolve).catch(reject);
      }
    });

    serverProcess.stderr?.on('data', (data: Buffer) => {
      // suppress tsx warnings
    });

    serverProcess.on('error', reject);
  });
});

after(() => {
  if (serverProcess) {
    serverProcess.kill();
  }
});

describe('CRUD API', () => {
  it('GET /api/health returns 200 ok', async () => {
    const res = await fetchJson(`${BASE}/health`);
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { status: 'ok' });
  });

  it('GET /api/projects returns a project list (may have leftover data)', async () => {
    const res = await fetchJson(`${BASE}/projects`);
    assert.equal(res.status, 200);
    assert.ok(Array.isArray((res.body as { data: unknown[] }).data));
  });

  let projectId: string;
  let initialCount: number;

  it('POST /api/projects creates a project', async () => {
    // record count before creation
    const before = await fetchJson(`${BASE}/projects`);
    initialCount = (before.body as { data: unknown[] }).data.length;

    const res = await fetchJson(`${BASE}/projects`, {
      method: 'POST',
      body: { name: 'Q3 Launch', description: 'Summer campaign' },
    });
    assert.equal(res.status, 201);
    const data = (res.body as { data: Record<string, unknown> }).data;
    assert.equal(data.name, 'Q3 Launch');
    assert.equal(data.status, 'draft');
    assert.equal(data.description, 'Summer campaign');
    assert.ok(typeof data.id === 'string' && data.id.length > 0);
    projectId = data.id as string;
  });

  it('GET /api/projects count increased by 1 after creation', async () => {
    const res = await fetchJson(`${BASE}/projects`);
    assert.equal(res.status, 200);
    const data = (res.body as { data: unknown[] }).data;
    assert.equal(data.length, initialCount + 1);
  });

  it('POST /api/projects without description defaults to empty string', async () => {
    const res = await fetchJson(`${BASE}/projects`, {
      method: 'POST',
      body: { name: 'Holiday Sale' },
    });
    assert.equal(res.status, 201);
    const data = (res.body as { data: Record<string, unknown> }).data;
    assert.equal(data.description, '');
  });

  it('GET /api/projects/:id returns the correct project', async () => {
    const res = await fetchJson(`${BASE}/projects/${projectId}`);
    assert.equal(res.status, 200);
    const data = (res.body as { data: Record<string, unknown> }).data;
    assert.equal(data.name, 'Q3 Launch');
  });

  it('GET /api/projects/nonexistent returns 404', async () => {
    const res = await fetchJson(`${BASE}/projects/nonexistent`);
    assert.equal(res.status, 404);
  });

  it('DELETE /api/projects/:id removes the project', async () => {
    const res = await fetchJson(`${BASE}/projects/${projectId}`, {
      method: 'DELETE',
    });
    assert.equal(res.status, 204);
  });

  it('After delete, GET /api/projects/:id returns 404', async () => {
    const res = await fetchJson(`${BASE}/projects/${projectId}`);
    assert.equal(res.status, 404);
  });

  it('DELETE /api/projects/nonexistent returns 404', async () => {
    const res = await fetchJson(`${BASE}/projects/nonexistent`, {
      method: 'DELETE',
    });
    assert.equal(res.status, 404);
  });

  it('POST /api/projects with empty name returns 400', async () => {
    const res = await fetchJson(`${BASE}/projects`, {
      method: 'POST',
      body: { name: '' },
    });
    assert.equal(res.status, 400);
  });
});