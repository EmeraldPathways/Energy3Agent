# Validation Log

## Phase 1 Fixes — Validation

### Command — npm run validate:crud (committed CRUD test)

```powershell
npm run validate:crud
```

- Result: PASS — 11/11 tests pass
- Notes: Builds `shared/` first (tsc → dist/), then spawns server on port 3099 and runs the full CRUD test suite via `node --import tsx --test test/crud.test.ts`. Tests are idempotent (count-based, not hardcoded to empty state).

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
- Notes: `shared/` builds (tsc → dist/), `server/` builds (tsc → dist/), `client/` builds (tsc + vite build). Zero errors.

### Command — Shared dist resolution check

```powershell
node verify-shared.mjs
```

- Result: PASS
- Output:
  - shared/dist resolves OK
  - Status enum values: [ 'draft', 'needs_review', 'approved', 'changes_requested', 'blocked' ]
  - Schema validates: true
  - Shared package production-clean: PASS
- Notes: Confirmed `@ai-campaign/shared` resolves from built `dist/` output (not raw `src/index.ts`). Status enum uses the correct approval contract.

### Command — Install check

```powershell
npm install
```

- Result: PASS
- Notes: 0 vulnerabilities. `tsx` added to root devDependencies for test runner support.

### Fix 1: ProjectStatus enum

- Replaced workflow-stage enum with approval-status enum: `draft`, `needs_review`, `approved`, `changes_requested`, `blocked`.
- Verified via runtime import from `shared/dist/index.js`.

### Fix 2: Shared package build wiring

- Changed `shared/package.json` `main`/`types` from `./src/index.ts` to `./dist/index.js` / `./dist/index.d.ts`.
- Added proper `exports` map with `types`, `import`, and `default` conditions.
- Added `"type": "module"` to shared package.
- Root `dev:server` now builds shared first (`npm run build:shared && npm run dev -w server`).
- Verified clean resolution from built output — no source-file imports at runtime.

### Fix 3: Committed CRUD validation

- Created `test/crud.test.ts` using Node's built-in test runner.
- Added `validate:crud` script to root `package.json`.
- Tests are idempotent: track initial count before creation, verify +1, verify delete, verify re-get returns 404.
- Former temporary `test-crud.mjs` removed.