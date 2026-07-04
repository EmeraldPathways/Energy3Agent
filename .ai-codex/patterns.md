# patterns.md

## Project Patterns

- Authentication: none in V1; keep backend interfaces auth-agnostic so auth can be added later without changing stage logic
- Data fetching: minimal typed fetch wrappers from the client to REST endpoints; avoid introducing extra client-state libraries unless a real coordination need appears
- State management: route-local React state plus server persistence; human-edited stage drafts should be stored separately from machine-generated outputs when needed
- Validation: Zod in `shared/` for API DTOs and agent output schemas; backend must validate all inbound writes and all Gemini structured outputs
- Error handling: backend returns actionable JSON errors; frontend surfaces them in a consistent error banner/panel without exposing secrets or stack traces

## Gotchas

- Do not expose `GEMINI_API_KEY` or model config to the client.
- Approval gates are product rules, not just UI affordances; backend must enforce them.
- Regeneration flows must not silently overwrite approved or human-edited sections.
- Uploaded source files and generated artifacts live on disk, but workflow truth lives in SQLite.
