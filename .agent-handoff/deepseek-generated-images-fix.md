You are fixing a specific missing feature in this repo:

`D:\GOOGLE DRIVE\EMERALD PATHWAYS\WEB WORK\AI CODING\VS CODE\work\Energy Group 3 Agent`

Read first, in this exact order:
1. `AGENTS.md`
2. `.ai-codex/index.md`
3. `.ai-codex/architecture.md`
4. `.ai-codex/api-surface.md`
5. `.ai-codex/scopes/phase-5-creator-specialists.md`
6. `PROJECT.md`
7. `server/src/config.ts`
8. `server/src/services/geminiClient.ts`
9. `server/src/agents/runPhase5.ts`
10. `server/src/routes/phase5.ts`
11. `server/src/routes/phase6.ts`
12. `server/src/routes/phase7.ts`
13. `shared/src/index.ts`
14. `client/src/pages/ProjectView.tsx`
15. `test/phase5-validation.mjs`
16. `test/phase7-validation.mjs`

Task:
Fix the missing generated-image pipeline so generated concept images are actually created during the specialist stage, persisted in project state, visible in the app, and included in exported documents.

Current truth:
- `shared/src/index.ts` already has `GeneratedConceptImageSchema` and `intake.conceptImages`.
- `server/src/routes/phase7.ts` already carries `intake.conceptImages` into final assembly and export, but only if they already exist.
- `server/src/routes/phase5.ts` currently generates `textContent`, `imageryCreative`, and `marketResearch`, but does not create or persist concept image files.
- `client/src/pages/ProjectView.tsx` currently shows imagery prompts and only a final count of concept images; it does not visibly render generated images in specialist outputs.
- `.ai-codex/scopes/phase-5-creator-specialists.md` explicitly says `No image generation execution yet`.
- This means the user is correct: there are no real generated images in specialist outputs, and exports only include whatever is manually seeded into `conceptImages`.

What to implement:

1. Add real image generation in Phase 5
- Use the backend-only Gemini image model path.
- Generate a bounded number of concept images from the imagery specialist output.
- Keep it small and deterministic enough for MVP safety. Prefer 1-2 generated images from the first approved prompts, not an unbounded batch.
- Save the generated image files on disk in a predictable project-scoped location.
- Persist generated image metadata into `intake.conceptImages` using the existing schema.

2. Persist and return concept images from the specialist run
- After `POST /api/projects/:id/agents/run-specialists`, the project should contain non-empty `intake.conceptImages` when image generation succeeds.
- The specialist response should make the generated concept images discoverable without needing hidden seeded state.
- Do not break the existing `specialistOutputs.imageryCreative` contract.

3. Handle imagery revisions correctly
- When Phase 6 reruns `imagery_creative`, regenerate/refresh the related concept images instead of leaving stale ones in place forever.
- Do this surgically. Do not wipe unrelated text or market research outputs.
- Avoid endless duplication of concept images across retries.

4. Show generated images in the UI
- In `client/src/pages/ProjectView.tsx`, render generated concept images in the specialist output area using the persisted `intake.conceptImages`.
- Keep the change minimal and consistent with the current UI.
- Showing thumbnails and/or file links is enough. Do not redesign the page.

5. Add generated images into exported documents
- `server/src/routes/phase7.ts` should include the actual generated images in DOCX and PDF exports, not just text lines with file paths.
- Preferred behavior:
  - DOCX embeds the image binaries in the document.
  - PDF embeds the image binaries in the document.
- If one format is straightforward and the other is awkward, still finish both in a minimal safe way. Do not leave one format silently text-only if the binary exists.

6. Add or update tests so this is actually proven
- `test/phase5-validation.mjs` should verify that specialist generation creates persisted `conceptImages`, not just `imageryCreative.image_prompts`.
- Assert at least:
  - `intake.conceptImages` exists after `run-specialists`
  - at least 1 concept image is present
  - the referenced image file actually exists on disk
- `test/phase7-validation.mjs` should verify that exports contain generated images, not just seeded metadata.
- For DOCX, inspect the returned ZIP and assert image media entries exist under `word/media/`.
- For PDF, assert the exported binary contains embedded image objects in a reliable way, for example checking for `/Subtype /Image` or another stable PDF image marker.
- If live Gemini image generation cannot run without credentials or model support, add a graceful skip path that clearly says the image-generation-dependent assertions were skipped. Do not produce false passes.

7. Keep the fix surgical
- Touch only the files needed for image generation, persistence, rendering, export, and tests.
- Do not redesign the whole imagery workflow.
- Do not refactor unrelated prompt or export systems.

Important constraints:
- Small production-safe diff only.
- Reuse the existing `GeneratedConceptImageSchema` and current project state shape.
- Keep all secrets backend-only.
- Do not broaden Phase 7 into a full Gemini final assembly redesign.
- Do not break existing text/imagery/research specialist outputs.
- Do not fake success by only seeding `conceptImages` in tests without wiring the real runtime path.

Likely files to change:
- `server/src/config.ts`
- `server/src/services/geminiClient.ts`
- `server/src/agents/runPhase5.ts`
- `server/src/routes/phase5.ts`
- `server/src/routes/phase6.ts`
- `server/src/routes/phase7.ts`
- `shared/src/index.ts` only if a tiny schema extension is absolutely necessary
- `client/src/pages/ProjectView.tsx`
- `test/phase5-validation.mjs`
- `test/phase7-validation.mjs`

Diagnosis to keep in mind:
- The current bug is not mainly in Phase 7 export.
- The root problem is that Phase 5 never creates real concept image artifacts.
- Phase 7 only exports what already exists in `intake.conceptImages`.
- Fix the creation path first, then the export embedding path, then prove it with tests.

Verification commands:
1. `npm.cmd run build`
2. `node test/phase5-validation.mjs`
3. `node test/phase7-validation.mjs`

If needed for confidence:
4. `npm.cmd run validate:agents`

If the current validation scripts still fail before reaching the image assertions because they receive HTML instead of JSON from create-project, inspect the test harness/server startup first and fix only what is necessary to make the validations trustworthy again.

Success criteria:
- Running specialists creates real concept image files.
- Those files are persisted in `intake.conceptImages`.
- The ProjectView specialist area visibly shows the generated images.
- Final assembly includes the generated images from real runtime state.
- DOCX and PDF exports include the generated images in the document output.
- Validation scripts prove creation, persistence, and export inclusion rather than only seeded metadata.

Handback format:
1. What changed
2. Why
3. Verification commands run
4. Results
5. Files changed
