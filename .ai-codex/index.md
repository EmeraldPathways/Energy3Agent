# Project AI Index

Read this before broader repo exploration.

## Core Files

| File | Purpose |
|------|---------|
| `architecture.md` | High-level system layout, modules, and data flow |
| `patterns.md` | Reusable project conventions and gotchas |
| `api-surface.md` | Endpoints, contracts, and key types |
| `decisions-archive.md` | Important decisions and why they were made |
| `scopes/` | Task-specific notes for larger areas |

## Current Scope Notes

- `scopes/phase-1-foundation.md` - original foundation scope reference
- `scopes/phase-5-creator-specialists.md` - current active area for Creator and Specialists work

## Do Not Read

- `node_modules/`
- build output
- lockfiles
- logs
- generated artifacts unless the task requires them

## Current Repo Truth

- Phases 1-4 are implemented and validated in the repo history.
- Phase 5 code exists in the working tree: shared schemas, Phase 5 routes, Phase 5 runner, and prompt modules.
- Prompt source of truth is `server/src/agents/prompts/*.ts`.
- The main current risk area is Phase 5 integration quality: preserving Phase 3-4 behavior while extending the workflow forward.
