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
- `scopes/phase-5-creator-specialists.md` - Creator and Specialists work reference

## Do Not Read

- `node_modules/`
- build output
- lockfiles
- logs
- generated artifacts unless the task requires them

## Current Repo Truth

- All 8 phases are implemented and validated:
  - Phase 1: Foundation (monorepo, CRUD, SQLite, dashboard)
  - Phase 2: Gemini backbone (centralized config, backend-only service)
  - Phase 3: Intake stage (file uploads, 4 intake agents, approval gate)
  - Phase 4: Manager brief (strategy brief generation, editable output, approval)
  - Phase 5: Creator & Specialists (production plan, text/imagery/research agents)
  - Phase 6: Feedback & Revision (targeted feedback, selective revision routing)
  - Phase 7: Final Assembly & Export (deterministic assembly, JSON/Markdown/HTML export)
  - Phase 8: Client UI (Vite + React frontend with workflow rail)
- Prompt source of truth is `server/src/agents/prompts/*.ts`.
- Phase 7 (`campaign-manager-agent.ts`) is deterministic assembly — the Gemini prompt module exists but is not wired.
- Several prompt modules (`revision-router`, `export-formatter`, `quality-safeguard`, `json-repair`) are exported but not imported by any runner — see comments in each file.
- The full agent validation suite (`npm run validate:agents`) exercises all phases end-to-end with live Gemini.