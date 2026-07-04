# Phase 1 Scope

## Goal

Create the initial working monorepo and first local CRUD flow for campaign projects.

## Required Deliverables

- Root workspace tooling for a TypeScript monorepo
- `client/`, `server/`, and `shared/` structure
- Root `npm run dev`, `npm run dev:client`, and `npm run dev:server` scripts
- SQLite bootstrap and base project storage service
- Local upload/data directories created or initialized safely
- `.env.example`
- Project dashboard with:
  - list local projects
  - create project
  - open existing project
  - delete project
- Base `Project` schema and related shared types needed for foundation CRUD

## Notes

- Keep Phase 1 intentionally narrow.
- Do not add Gemini code yet.
- Do not add intake agents, uploads UI beyond what foundation requires, or approval-stage logic beyond the base schema/state shape.
- Prefer the smallest stable structure that makes later phases straightforward.
