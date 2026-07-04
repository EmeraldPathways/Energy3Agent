# architecture.md

## Summary

Local-first TypeScript monorepo for a staged marketing-campaign production app. The frontend drives a route-based workflow UI, the backend owns all file handling, workflow rules, Gemini access, and export generation, and shared schemas/types keep contracts synchronized.

## Modules

- Frontend: React + Vite SPA with a single `ProjectView` workflow page, fetch-based API client, editable stage outputs, approval UI, and later-stage review panels
- Backend: Express API, workflow orchestrators, agent runners, prompt modules, validation, upload parsing, and approval enforcement
- Data layer: SQLite for structured project/workflow state; local filesystem for uploads, extracted text, and generated artifacts
- External services: Google Gemini via backend-only `@google/genai` integration

## Runtime Flow

1. User creates or opens a local campaign project in the client.
2. Client reads/writes project state through Express API routes backed by SQLite and filesystem storage.
3. Backend enforces workflow gates, runs agent stages, validates structured output, and records human-edited stage state separately from generated outputs where needed.

## Implemented Workflow Stages

1. Foundation:
   - project CRUD
   - dashboard and project detail flow
2. Intake:
   - meeting notes and brand guide text capture
   - upload pipeline for `.txt`, `.pdf`, `.docx`, and supported images
   - intake agents plus human-check and intake approval gates
3. Manager Brief:
   - brief generation
   - editable brief persistence
   - brief approval gate
4. Creator and Specialists:
   - creator plan generation
   - specialist generation routes for text, imagery concepts, and market research
   - specialist state persistence in project intake JSON

## Current Backend Entry Points

- `server/src/index.ts`
- `server/src/routes/projects.ts`
- `server/src/routes/intake.ts`
- `server/src/routes/brief.ts`
- `server/src/routes/phase5.ts`

## Current Agent Entry Points

- `server/src/agents/runIntake.ts`
- `server/src/agents/runManager.ts`
- `server/src/agents/runPhase5.ts`

## Prompt Layout

- All prompt modules live in `server/src/agents/prompts/`
- Active runtime prompts are `.ts` files only
- `shared-rules.ts` contains cross-agent behavioral guidance
