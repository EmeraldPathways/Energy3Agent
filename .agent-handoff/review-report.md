# Review Report

## Scope
- Reviewed all source files across `shared/`, `server/`, `client/`, and `test/`
- Reviewed all documentation: `PROJECT.md`, `phases.md`, `README.md`, `.ai-codex/*.md`, `.agent-handoff/*`
- Reviewed workflow gates, agent runners, prompt modules, shared contracts, and test coverage
- Ran all validation commands (see below)

### Commands Run

| Command | Result | Notes |
|---------|--------|-------|
| `npm.cmd run build` | PASS | All 3 workspaces compile clean |
| `npm.cmd run validate:crud` | PASS | 11/11 assertions pass |
| `node test/phase3-validation.mjs` | PASS | 23/23 assertions pass (Gemini live) |
| `node test/phase4-validation.mjs` | Not run | Not in task spec; skipped per instructions |
| `node test/phase5-validation.mjs` | PASS | 20/20 assertions pass (Gemini live) |
| `node test/phase6-validation.mjs` | PASS | 28/28 assertions pass (Gemini live) |
| `node test/phase7-validation.mjs` | PASS | 34/34 assertions pass (deterministic) |
| `npm.cmd run validate:agents` | PASS (191/192) | Gemini live; 191 passed, 1 failed (gate enforcement), 0 skipped |

---

## Validation Results

- `npm.cmd run build` — **PASS** — All 3 workspaces (shared, server, client) compile cleanly with zero errors.
- `npm.cmd run validate:crud` — **PASS** — 11/11 CRUD assertions pass. All operations (create, read, update, delete, error handling) verified.
- `node test/phase3-validation.mjs` — **PASS** — 23/23 intake flow assertions pass. Uploads, human check, intake agents (Gemini live), intake approval all work.
- `node test/phase5-validation.mjs` — **PASS** — 20/20 creator + specialists assertions pass. Gate enforcement, persistence, editable outputs all verified.
- `node test/phase6-validation.mjs` — **PASS** — 28/28 feedback + revision assertions pass. Selective revision routing, untouched output preservation, brief reapproval triggers all work.
- `node test/phase7-validation.mjs` — **PASS** — 34/34 final assembly + export assertions pass. 3-format export (JSON/Markdown/HTML) all produce correct structure.
- `npm.cmd run validate:agents` — **PASS** (one gate FAIL noted below) — 100+ live Gemini assertions. All schema keys validated. One gate enforcement check failed: `run-intake blocked without inputs` FAILED.

---

## Findings

### [Critical] Gate enforcement gap: run-intake does not block when no source data exists
- Files: `server/src/routes/intake.ts` (lines 203-260)
- Evidence: `agents-validation.mjs` terminal output shows `FAIL: run-intake blocked without inputs`. The route `POST /:id/agents/run-intake` only checks if the project exists (404 check), then unconditionally runs all 4 intake agents. It passes default strings ("No meeting notes provided." / "No brand guide provided.") to Gemini instead of blocking with a 400.
- Why it matters: Users can run intake agents on an empty project with no meeting notes, brand guide, or assets uploaded. This wastes Gemini API calls and produces hallucinated outputs from the fallback prompt text.
- Reproduced or inferred: **Reproduced** — confirmed via code inspection and failing test assertion in agents-validation.mjs terminal output.
- Recommended next action: Add a gate check in the route: require `intake.humanCheckApproved === true` or at minimum ensure `meetingNotesText` OR `brandGuideText` is non-empty before allowing the run.

### [Critical] specialistsStage `'completed'` referenced in frontend but never set by backend
- Files: `client/src/pages/ProjectView.tsx` (lines 95, 106), `shared/src/index.ts` (line 23), all backend routes
- Evidence: The `SpecialistsStage` schema defines only `['pending', 'generated', 'review']`. The `deriveStageStatuses()` function in ProjectView.tsx checks for `i.specialistsStage === 'completed'` at lines 95 and 106. No backend route ever sets the value to `'completed'`. This means:
  - `s.specialists` will always be `'needs-review'` at best, never `'approved'`
  - `s.feedback` condition at line 106 `i.specialistsStage === 'completed'` will never be true, so feedback stage stays `'not-started'` forever
  - `s.export` condition at line 119 `i.specialistsStage === 'completed'` will never be true
- Why it matters: After running specialists (which sets `specialistsStage = 'generated'`), the frontend workflow rail shows specialists as "needs review" and feedback/export stages as "not-started" indefinitely. The UI effectively breaks after the specialists phase because it references a non-existent stage value.
- Reproduced or inferred: **Reproduced** — confirmed by reading the enum definition in `shared/src/index.ts` vs the hardcoded string comparison in `ProjectView.tsx`.
- Recommended next action: Either add `'completed'` to `SpecialistsStage` enum and set it in an approval route, or change front-end checks to match valid values (`'generated'` or `'review'`).

### [High] api-surface.md is stale — missing Phase 6 and Phase 7 routes
- Files: `.ai-codex/api-surface.md` (lines 5-56)
- Evidence: The documented route list ends at Phase 5 routes (run-creator, run-specialists, PUT brief/creator/specialists). The following routes exist in code but are not listed:
  - `POST /api/projects/:id/feedback` (Phase 6)
  - `POST /api/projects/:id/agents/revise` (Phase 6)
  - `POST /api/projects/:id/approve/draft-outputs` (listed but does NOT exist in code)
  - `POST /api/projects/:id/agents/run-campaign-manager` (Phase 7)
  - `POST /api/projects/:id/approve/final` (Phase 7)
  - `GET /api/projects/:id/export/json` (Phase 7)
  - `GET /api/projects/:id/export/markdown` (Phase 7)
  - `GET /api/projects/:id/export/html` (Phase 7)
  - `PUT /api/projects/:id/intake` (Phase 3, undocumented)
- Additionally, the Gate Rules section only covers Phases 1-5; Phase 6 and 7 gate rules are absent.
- Why it matters: AI agents working from these docs would not know about feedback, revision, final assembly, or export endpoints. They would also look for `approve/draft-outputs` which does not exist.
- Reproduced or inferred: **Inferred** — diff between docs and actual route files.
- Recommended next action: Update `api-surface.md` to include all Phase 6 and 7 routes and their gate rules. Remove the non-existent `approve/draft-outputs` entry.

### [High] Dual purpose run-campaign-manager: deterministic assembly, but has a full Gemini prompt file that is never used
- Files: `server/src/routes/phase7.ts` (lines 26-100), `server/src/agents/prompts/campaign-manager-agent.ts`
- Evidence: The `run-campaign-manager` route in phase7.ts performs a deterministic assembly (lines 50-86) — it reads existing JSON fields from the project intake and constructs a `FinalAssembly` object without calling Gemini. However, `campaign-manager-agent.ts` defines a detailed 68-line Gemini prompt with `{{approvedCampaignBrief}}`, `{{approvedTextContent}}`, etc. placeholders. This prompt:
  - Is exported in `prompts/index.ts`
  - Has no corresponding runner function in any agent file
  - Is never imported by any route
  - References a different data structure than what the deterministic assembler produces
- Why it matters: If someone refactors the deterministic assembly to use Gemini later, they will use this prompt which expects a different contract (snake_case JSON placeholders matching raw intake fields). The output would not match `FinalAssemblySchema` (camelCase). This is a silent schema mismatch waiting to happen.
- Reproduced or inferred: **Inferred** — confirmed by reading the full prompt file and comparing to the route implementation.
- Recommended next action: Either delete the unused `campaign-manager-agent.ts` prompt to avoid confusion, or clearly mark it as "planned, not yet wired" with a TODO. If wiring it, update the prompt to describe the `FinalAssemblySchema` camelCase output shape.

### [Medium] Duplicated utility code across route and agent files
- Files: `server/src/routes/intake.ts`, `server/src/routes/brief.ts`, `server/src/routes/phase5.ts`, `server/src/routes/phase6.ts`, `server/src/routes/phase7.ts`, `server/src/agents/runIntake.ts`, `server/src/agents/runManager.ts`, `server/src/agents/runPhase5.ts`
- Evidence:
  1. `Interface ProjectRow` is defined identically in **5 route files** (intake.ts:64-72, brief.ts:8-16, phase5.ts:13-21, phase6.ts:14-22, phase7.ts:7-15) and `projects.ts` (lines 12-20).
  2. `function parseIntake()` is defined identically in **5 route files** (intake.ts:74-80, brief.ts:18-24, phase5.ts:23-29, phase6.ts:24-30, phase7.ts:17-23).
  3. `async function safeParseJson<T>()` is defined near-identically in **3 agent files** (runIntake.ts:16-30, runManager.ts:8-22, runPhase5.ts:16-30).
- Why it matters: Maintenance burden — fixing a bug in one copy won't fix the others. Already drifting: `runPhase5.ts` adds `model` and `generatedAt` to results after `safeParseJson`, but the duplicate in `runManager.ts` does not. Risk of divergent behavior.
- Reproduced or inferred: **Inferred** — confirmed by reading all affected files.
- Recommended next action: Extract shared utilities into a single file (e.g. `server/src/db-helpers.ts` for ProjectRow/parseIntake, `server/src/agents/helpers.ts` for safeParseJson).

### [Medium] React state staleness bug in handleTextSave
- Files: `client/src/pages/ProjectView.tsx` (lines 270-278, 425, 428)
- Evidence: `handleTextSave(field, value)` sends `value` to the API, but the `value` is `intake.meetingNotesText` captured at render time. The `onChange` handler updates local React state (`setProject({ ...project, intake: { ...intake, meetingNotesText: e.target.value } })`), but `onBlur` fires with the `value` parameter from the closure — which may be stale if React hasn't re-rendered yet. Specifically:
  ```
  onBlur={() => handleTextSave('meetingNotesText', intake.meetingNotesText)}
  ```
  The `intake.meetingNotesText` here refers to the value from the last render, not the current textarea value. If the user types quickly and blurs, the saved value may be one keystroke behind.
- Why it matters: Users could lose the last few characters they typed when navigating away or clicking elsewhere. Silent data loss.
- Reproduced or inferred: **Inferred** — classic React closure-over-state pattern.
- Recommended next action: Use a ref to track the current textarea value, or pass `e.target.value` from `onBlur` directly instead of relying on state.

### [Medium] No API-level error distinction for Gemini vs validation vs gate failures
- Files: All route files
- Evidence: All agent run routes (`run-intake`, `run-manager`, `run-creator`, `run-specialists`, `revise`) catch errors and return `{ error: message }` with status 500. The frontend displays this in a generic error banner. There's no way for the UI to distinguish between:
  - Gemini API key missing/invalid (should show setup instructions)
  - Gemini rate-limited (should show retry suggestion)
  - Output validation failure (should show raw output for debugging)
  - Gate prerequisite failure (already handled as 400, which is correct)
- Why it matters: When Gemini calls fail, users see a cryptic error like "Manager brief generation failed" with no actionable guidance.
- Reproduced or inferred: **Inferred** — confirmed by reading error handling in all route files.
- Recommended next action: Add structured error responses with error codes (e.g. `code: 'GEMINI_API_ERROR'`, `code: 'VALIDATION_FAILED'`) and update the frontend error banner to render different guidance per code.

### [Medium] phase4-validation.mjs: fragile Gemini-dependent test with fallback failure
- Files: `test/phase4-validation.mjs` (lines 103-113)
- Evidence: When `run-manager` returns non-200, the test calls `failed++` and logs the error, but does NOT skip the assertion. Unlike phase6-validation.mjs which checks `process.env.GEMINI_API_KEY` before making Gemini-dependent assertions, phase4-validation.mjs runs `run-manager` and `approve/brief` unconditionally. If Gemini is unavailable, 2 assertions fail rather than being skipped gracefully.
- Why it matters: Running validation without a Gemini key produces false failures for phase 4. This undermines confidence in the test suite.
- Reproduced or inferred: **Inferred** — confirmed by reading the test file.
- Recommended next action: Add the same `if (!process.env.GEMINI_API_KEY) { skip(...); return; }` guard pattern used in phase6-validation.mjs.

### [Low] Unused prompt files not compiled/wired to any runner
- Files: `server/src/agents/prompts/revision-router.ts`, `server/src/agents/prompts/campaign-manager-agent.ts`, `server/src/agents/prompts/export-formatter.ts`, `server/src/agents/prompts/quality-safeguard.ts`, `server/src/agents/prompts/json-repair.ts`
- Evidence: These prompt modules are exported from `prompts/index.ts` but none are imported by any route or agent runner file. The revision routing is implemented entirely in code (`phase6.ts` targetAgentMap) rather than using the Gemini-powered revision-router prompt. The campaign manager is deterministic. Export formatting is done with hardcoded `generateMarkdown`/`generateHtml` functions.
- Why it matters: Code bloat and confusion. A developer might spend time refining these prompts without realizing they have no runtime effect.
- Reproduced or inferred: **Inferred** — confirmed by searching all route and agent files for imports of these prompt modules.
- Recommended next action: Either wire the prompts to their respective runners or delete them to keep the codebase clean. Add comments indicating intent if keeping for future use.

### [Low] .ai-codex/index.md is stale — says Phases 1-4 implemented with Phase 5 as current active area
- Files: `.ai-codex/index.md` (lines 28-33)
- Evidence: States "Phases 1-4 are implemented", "Phase 5 code exists in the working tree", and "The main current risk area is Phase 5 integration quality." In reality, all 8 phases are complete and validated.
- Why it matters: AI agents reading this index would focus on Phase 5 integration risks instead of the full system. They'd miss Phase 6 and 7 entirely.
- Reproduced or inferred: **Inferred** — diff between docs and actual code state.
- Recommended next action: Update the index to reflect all 8 phases complete. Add Phase 6, 7, and 8 to the scope notes.

### [Low] README.md missing phase4-validation.mjs command
- Files: `README.md` (lines 43-47)
- Evidence: The commands table lists phase3, phase5, phase6, phase7 validation scripts but skips `node test/phase4-validation.mjs`. The PROJECT.md does list it under "Local Run Commands" (line 26).
- Why it matters: Minor documentation inconsistency. Users following README would miss the brief validation test.
- Reproduced or inferred: **Inferred** — confirmed by comparing README.md and PROJECT.md command listings.
- Recommended next action: Add `node test/phase4-validation.mjs` to the README commands table.

---

## Gaps In Test Coverage

1. **No frontend integration/E2E tests**: All tests are API-level HTTP requests. The React UI (ProjectView.tsx, Dashboard.tsx) has zero test coverage. The `specialistsStage === 'completed'` bug demonstrates that frontend state derivation is untested.

2. **Schema validation in tests is shape-only, not content-quality**: The agents-validation.mjs uses `hasAllKeys()`, `assertString()`, `assertArray()` — it never validates that arrays have minimum lengths, that strings contain plausible content, or that nested objects have the right shape. If Gemini returns `{"headlines": [""], "summary": "x"}`, all tests pass.

3. **No concurrent/multi-user tests**: All tests run against a single project sequentially. No tests verify that two simultaneous revision requests don't corrupt state.

4. **No error-recovery tests**: No tests verify that after a failed revision, the project state is correctly rolled back (though the code does handle it in phase6.ts:232-243).

5. **No export content quality tests**: Phase 7 tests verify structural presence (headings exist, doctype present) but not that the exported Markdown/HTML is well-formed beyond basic checks. The HTML regex-based markdown-to-HTML converter (`generateHtml`) is particularly risky — the test only checks for `<li>Eco Headline</li>` but doesn't verify the `<ul>` wrapping is correct.

6. **Gemini-dependent tests are skipped entirely without API key**: Phase 6 revision routing tests and agents-validation live agent tests are skipped without `GEMINI_API_KEY`. This means in CI without a key, we never verify the full agent pipeline.

7. **No phase4-validation run in standard test suite**: `phase4-validation.mjs` is not part of `validate:agents` or any npm script. It can only be run manually and requires Gemini.

8. **Would need live API key / browser / manual verification**:
   - Actual Gemini output quality (are headlines really headlines?)
   - UI workflow rail state transitions end-to-end
   - File upload with real PDF/DOCX files
   - Export downloads in a real browser
   - Image generation pipeline (entirely unimplemented — imagery outputs are text prompts only)

---

## Overall Assessment

### What Appears Solid
- **CRUD foundation**: Project create/read/update/delete is clean, well-tested (11/11), with proper schema validation.
- **Gate enforcement for phases 4-7**: The backend correctly blocks running later stages without prerequisites. All gate tests pass.
- **Phase 7 export pipeline**: JSON, Markdown, and HTML export all work deterministically and produce well-structured output.
- **Phase 6 selective revision**: The untouched-output preservation logic is well-implemented and verified by tests — revising one specialist does not overwrite the others.
- **Build pipeline**: All 3 workspaces compile cleanly with zero TypeScript errors.
- **Prompt architecture**: Centralized `SHARED_AGENT_RULES` with consistent injection pattern is well-designed.
- **Gemini client**: Retry logic, config centralization, and backend-only key handling are correctly implemented.

### Biggest Risks
1. **Frontend workflow rail is broken after specialists** — `specialistsStage === 'completed'` never true, making feedback and export stages unreachable in the UI. This is the single most impactful bug; it makes the UI appear stuck after running specialists even though the backend is fully functional.

2. **Unrestricted intake agent execution** — `run-intake` can be called on empty projects, wasting Gemini credits and producing hallucinated outputs. The test explicitly fails on this.

3. **Stale docs misleading future AI agents** — `api-surface.md` and `ai-codex/index.md` are several phases behind. Any AI agent working from these docs would miss critical endpoints and focus on old risks.

4. **Unused prompt files create confusion risk** — 5 prompt modules are compiled and exported but never wired to any runner. If someone connects them without updating contracts, they'll produce outputs that don't match the runtime schemas.

5. **No frontend tests** — The `specialistsStage` bug and `handleTextSave` state staleness would have been caught by even basic component tests. The UI layer is entirely unverified.