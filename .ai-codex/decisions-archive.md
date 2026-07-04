# decisions-archive.md

Record short architecture and product decisions here.

## Template

- Date:
- Decision:
- Reason:
- Tradeoff:

## Decisions

- Date: 2026-07-04
  Decision: Use a TypeScript monorepo with `client/`, `server/`, and `shared/`.
  Reason: Keeps frontend/backend concerns clear while sharing schemas and types across both sides.
  Tradeoff: Slightly more setup overhead than a single-package app.

- Date: 2026-07-04
  Decision: Use SQLite for project/workflow state and local disk for uploaded/generated files.
  Reason: Fits local-first MVP needs while handling structured workflow state more safely than plain JSON files.
  Tradeoff: Requires DB bootstrap and migration discipline from the start.

- Date: 2026-07-04
  Decision: Keep Gemini access backend-only through a centralized client service and model config.
  Reason: Protects API keys, standardizes retries/validation, and avoids model sprawl across the codebase.
  Tradeoff: Agent development depends on backend abstractions before frontend integration is complete.
