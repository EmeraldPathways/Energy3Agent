import { spawn } from 'node:child_process';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 3199;
const BASE = `http://localhost:${PORT}/api`;

function fetchJson(url, options = {}) {
  return new Promise((resolve, reject) => {
    const { method = 'GET', body } = options;
    const parsed = new URL(url);
    const req = http.request(
      {
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname,
        method,
        headers: { 'Content-Type': 'application/json' },
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          resolve({ status: res.statusCode, body: data ? JSON.parse(data) : null });
        });
      },
    );
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function waitForServer(retries = 30) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetchJson(`${BASE}/health`);
      if (res.status === 200) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('Server did not become ready');
}

async function main() {
  // Kill stale processes on our port
  try {
    const { execSync } = await import('node:child_process');
    execSync(
      `powershell -Command "Get-NetTCPConnection -LocalPort ${PORT} -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"`,
      { stdio: 'ignore', timeout: 5000 },
    );
  } catch {}

  const proc = spawn('npx', ['tsx', 'server/src/index.ts'], {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, PORT: String(PORT) },
    stdio: 'pipe',
    shell: true,
  });

  proc.stdout?.on('data', () => {});
  proc.stderr?.on('data', () => {});

  try {
    await waitForServer(30);
    console.log('Server ready on port', PORT);

    const res = await fetchJson(`${BASE}/gemini-smoke`, {
      method: 'POST',
      body: { topic: 'sustainable coffee' },
    });

    console.log('Status:', res.status);
    console.log('Response:', JSON.stringify(res.body, null, 2));

    if (res.status === 200 && res.body?.data?.taglines?.length === 3) {
      console.log('\n✅ PASS: Gemini smoke test returned 3 taglines');
      console.log('Model:', res.body.data.model);
      process.exitCode = 0;
    } else {
      console.log('\n❌ FAIL: Unexpected response from Gemini smoke test');
      process.exitCode = 1;
    }
  } catch (err) {
    console.error('Error:', err.message);
    process.exitCode = 1;
  } finally {
    proc.kill();
  }
}

main();