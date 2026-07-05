You are fixing the remaining non-critical issues in this repo:

D:\GOOGLE DRIVE\EMERALD PATHWAYS\WEB WORK\AI CODING\VS CODE\work\Energy Group 3 Agent

Read first, in this exact order:
1. AGENTS.md
2. .agent-handoff/review-report.md
3. .agent-handoff/cline-result.md
4. .ai-codex/index.md
5. .ai-codex/api-surface.md
6. PROJECT.md
7. README.md
8. client/src/pages/ProjectView.tsx
9. server/src/routes/phase7.ts
10. server/src/agents/prompts/index.ts
11. server/src/agents/prompts/campaign-manager-agent.ts
12. test/phase4-validation.mjs

Task:
Fix the remaining review findings after the 2 critical issues are done. Make small, production-safe changes. Do not reopen or redesign already-fixed critical work.

Current truth:
- Review-only audit is complete and documented in `.agent-handoff/review-report.md`.
- The critical fixes are being handled separately.
- This prompt is for the remaining high, medium, and low issues only.
- Build was passing during the review.
- Most validations were already passing during the review.

Required issues to address:

1. High: stale `.ai-codex/api-surface.md`
- Add the missing Phase 6 and Phase 7 routes.
- Add the undocumented `PUT /api/projects/:id/intake` route.
- Remove the non-existent `POST /api/projects/:id/approve/draft-outputs` entry if it is still present.
- Update gate rules so the doc matches actual code behavior.

2. High: unused `campaign-manager-agent.ts` prompt with mismatched future contract risk
- Resolve the confusion in the smallest safe way.
- Preferred options:
  - remove the unused prompt if it is truly dead code, or
  - clearly mark it as not wired and align its documented contract with the real `FinalAssemblySchema` if it must remain.
- Do not wire Gemini into Phase 7 unless the code already clearly requires it.

3. Medium: `handleTextSave` stale React state risk in `client/src/pages/ProjectView.tsx`
- Fix the onBlur save path so it uses the actual latest textarea value instead of stale render-time state.
- Keep the UI behavior otherwise unchanged.

4. Medium: `phase4-validation.mjs` should not false-fail without Gemini
- Add the same kind of Gemini guard pattern used elsewhere so phase 4 validation skips gracefully when `GEMINI_API_KEY` is missing.

5. Low: stale `.ai-codex/index.md`
- Update it so it reflects the actual current repo state rather than Phase 5 being the active frontier.

6. Low: `README.md` missing the Phase 4 validation command
- Add `node test/phase4-validation.mjs` to the commands table.

Issue to handle only if it stays surgical:

7. Medium: no API-level error distinction for Gemini vs validation failures
- If this can be fixed with a small, coherent change, add structured error codes to the relevant agent routes and update the frontend error display minimally.
- If it becomes broad or invasive, do not force it. Leave it alone rather than widening scope.

Issue to skip unless there is an obviously tiny, low-risk extraction:

8. Medium: duplicated utility code across route and agent files
- Do not do a broad refactor.
- Only touch this if there is a very small consolidation that clearly reduces duplication without affecting behavior.

Issue to clean up if safe:

9. Low: unused prompt modules
- If some prompt modules are truly unused and safe to remove, remove them.
- Otherwise add a minimal clarifying note so future agents know they are not wired.

Constraints:
- Small surgical diff only.
- Prefer correctness and maintainability over broad cleanup.
- Touch only files needed for the listed issues.
- Do not refactor unrelated code.
- Do not change runtime workflow behavior except where required by these findings.
- Preserve existing naming, patterns, and API shape where possible.

Success criteria:
- Docs match the actual route surface and current repo state.
- The Phase 4 validation script no longer false-fails without Gemini.
- The ProjectView text save path no longer risks saving a stale value.
- Phase 7 prompt confusion is resolved without broad redesign.
- Build still passes.

Verification commands:
1. npm.cmd run build
2. node test/phase4-validation.mjs

If needed for confidence:
3. npm.cmd run validate:agents

Handback format:
1. What changed
2. Why
3. Verification commands run
4. Results
5. Files changed

Do not start any new feature work.
