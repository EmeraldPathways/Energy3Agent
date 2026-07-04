# Validation Log

## Phase 1 — Fix: Robust CRUD Validation

### Command — npm run validate:crud

```powershell
npm run validate:crud
```

- Result: PASS — 11/11 tests pass
- Notes: Builds `shared/` first, then spawns server on port 3099 and runs full CRUD suite. Server startup uses health-poll readiness (no stdout text matching). 30s timeout with `settled` guard prevents hanging.

Test cases:
  - ✔ GET /api/health returns 200 ok
  - ✔ GET /api/projects returns a project list (may have leftover data)
  - ✔ POST /api/projects creates a project
  - ✔ GET /api/projects count increased by 1 after creation
  - ✔ POST /api/projects without description defaults to empty string
  - ✔ GET /api/projects/:id returns the correct project
  - ✔ GET /api/projects/nonexistent returns 404
  - ✔ DELETE /api/projects/:id removes the project
  - ✔ After delete, GET /api/projects/:id returns 404
  - ✔ DELETE /api/projects/nonexistent returns 404
  - ✔ POST /api/projects with empty name returns 400

### Command — npm run build

```powershell
npm run build
```

- Result: PASS
- Notes: `shared/` tsc → dist/, `server/` tsc → dist/, `client/` tsc + vite build → dist/. Zero errors.

### Fix applied: Robust server startup in CRUD test

- Removed brittle stdout text-matching gate (`msg.includes('running')`) which fails on Windows when `tsx` output is not reliably piped.
- Server readiness is now determined exclusively by health polling (`GET /api/health` → 200) with 60 retries × 500ms.
- Added `settled` flag to prevent double-resolve/reject from race conditions.
- Added `exit` handler to detect early server crashes.
- Added 30s hard timeout as safety net.
- Kept `shell: true` on Windows for `node --import tsx` compatibility.
- Added PowerShell-based stale port cleanup in `before` hook (guarded by try/catch).