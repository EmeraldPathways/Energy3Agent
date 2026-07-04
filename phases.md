# phases.md

Use this file only when the project is being executed in stages.

## Active Phase

- Name: Phase 1 - Foundation
- Goal: Establish the monorepo structure, local persistence baseline, environment scaffolding, and first user flow for project CRUD.
- In scope: `client/`, `server/`, `shared/`, root package/tooling files, SQLite bootstrap, local upload/data directories, `.env.example`, project dashboard, create/open/delete project flow, base project schema, base storage service
- Out of scope: Gemini integration, file parsing, agents, approvals beyond baseline schema fields, exports, tests beyond minimal foundation smoke coverage
- Success criteria: `npm install` succeeds, `npm run dev` starts the app, project CRUD works locally, and the repo contains the agreed monorepo structure for later phases

## Upcoming Phases

1. Phase 2 - Gemini Backbone
2. Phase 3 - Intake Stage
3. Phase 4 - Manager Brief
4. Phase 5 - Creator And Specialists
5. Phase 6 - Feedback And Selective Revision
6. Phase 7 - Final Assembly And Export
7. Phase 8 - Hardening
