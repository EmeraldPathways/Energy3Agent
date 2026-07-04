# patterns.md

## Project Patterns

- Authentication: none in V1; keep backend interfaces auth-agnostic so auth can be added later without changing stage logic
- Data fetching: minimal typed fetch wrappers from the client to REST endpoints; avoid introducing extra client-state libraries unless a real coordination need appears
- State management: route-local React state plus server persistence; human-edited stage drafts should be stored separately from machine-generated outputs when needed
- Validation: Zod in `shared/` for API DTOs and agent output schemas; backend must validate all inbound writes and all Gemini structured outputs
- Error handling: backend returns actionable JSON errors; frontend surfaces them in a consistent error banner/panel without exposing secrets or stack traces
- Prompt storage: keep prompts in `server/src/agents/prompts/*.ts`; do not reintroduce duplicate markdown prompt files
- Stage persistence: keep generated output and editable output as separate fields when a stage supports manual editing
- Route layering: extend workflow through new route files such as `brief.ts` and `phase5.ts` rather than overloading unrelated handlers

## Gotchas

- Do not expose `GEMINI_API_KEY` or model config to the client.
- Approval gates are product rules, not just UI affordances; backend must enforce them.
- Regeneration flows must not silently overwrite approved or human-edited sections.
- Uploaded source files and generated artifacts live on disk, but workflow truth lives in SQLite.
- When extending `ProjectView`, preserve earlier phases while adding later ones; do not replace a working intake/brief flow with a later-stage shortcut.
- Prompt JSON contracts must match the real Zod schemas in `shared/src/index.ts` exactly.
- Passing smoke tests is not enough if the user-facing workflow path has regressed.
