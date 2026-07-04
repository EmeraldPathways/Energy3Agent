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

- Date: 2026-07-04
  Decision: Keep prompt source of truth in `server/src/agents/prompts/*.ts`.
  Reason: Avoids duplicated prompt storage, extra build-copy steps, and drift between markdown and runtime code.
  Tradeoff: Prompt text is less separable from code-review diffs than standalone content files.

- Date: 2026-07-04
  Decision: Persist workflow stage state inside the project intake JSON for MVP phases 3-5.
  Reason: Keeps Phase 3-5 implementation moving without introducing a larger relational redesign too early.
  Tradeoff: The intake JSON grows in responsibility and requires stricter schema discipline.

- Date: 2026-07-04
  Decision: Add later workflow stages incrementally while preserving earlier page flow in `ProjectView`.
  Reason: The product is stage-gated; later-stage work is invalid if it breaks earlier approvals or review paths.
  Tradeoff: The page becomes more conditional and needs careful review when extending sections.
