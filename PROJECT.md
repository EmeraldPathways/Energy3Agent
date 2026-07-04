# PROJECT.md

## Project Summary

- Name: AI Marketing Campaign Builder
- Goal: Build a local-first AI marketing campaign app that turns meeting notes, brand guides, assets, and human feedback into an approval-gated campaign production workflow with exportable outputs.
- Users: Internal marketing operators or consultants running campaign planning locally on one machine during MVP.
- Current status: Phases 1-4 are implemented locally. Foundation, Gemini backbone, Intake Stage, and Manager Brief are built and validated. Phase 5 (Creator and Specialists) is the next build target.

## Stack

- Frontend: React + Vite + TypeScript
- Backend: Node.js + Express + TypeScript
- Database: SQLite for project state plus local disk storage for uploads and generated artifacts
- Deployment: Local-only MVP, no cloud deployment in V1

## Local Run Commands

- App: `npm run dev`
- Frontend: `npm run dev:client`
- Backend: `npm run dev:server`
- Build: `npm run build`
- CRUD validation: `npm run validate:crud`
- Gemini smoke test: `node test/gemini-smoke.mjs`
- Phase 3 flow validation: `node test/phase3-validation.mjs`
- Phase 4 flow validation: `node test/phase4-validation.mjs`

## Environment Notes

- Required env files: root `.env` and `.env.example`
- Required services: local filesystem only; no external services beyond Gemini API access from backend
- Secrets location: `GEMINI_API_KEY` stored in local `.env`, never exposed to frontend code
- Current Gemini defaults:
  - `GEMINI_FAST_MODEL=gemini-2.5-flash-lite`
  - `GEMINI_STANDARD_MODEL=gemini-2.5-flash`
  - `GEMINI_REASONING_MODEL=gemini-2.5-pro`
  - `GEMINI_IMAGE_MODEL=gemini-2.5-flash`
  - `ENABLE_GOOGLE_SEARCH_GROUNDING=true`

## Active Constraints

- Scope limits: local-first MVP only; human approval required at every major workflow gate; keep functions/prompts/schemas modular and small
- Non-goals: auth, cloud deployment, external DB, Stripe, Supabase, Firebase, client portal, speculative extra workflow steps
- Known risks: document parsing complexity for `.pdf` and `.docx`, Gemini structured-output repair edge cases, keeping selective revisions stable without overwriting human edits
- Prompt source of truth: all agent prompts now live under `server/src/agents/prompts/*.ts`

## Current Capability Snapshot

- Phase 1 complete:
  - monorepo scaffold with `client/`, `server/`, `shared/`
  - SQLite-backed project CRUD
  - dashboard and project detail flow
- Phase 2 complete:
  - centralized Gemini config
  - backend-only Gemini client service
  - smoke-test route at `/api/gemini-smoke`
- Phase 3 complete:
  - intake schemas for meeting notes, brand guide, asset review, and intake summary
  - upload pipeline for `.txt`, `.pdf`, `.docx`, `.png`, `.jpg`, `.jpeg`, `.webp`, `.svg`
  - intake routes for uploads, human check, run-intake, approve-intake
  - ProjectView supports setup, human check, run intake, and intake review flow
- Phase 4 complete:
  - Manager Brief schema and intake JSON storage fields are implemented
  - backend routes support run-manager, approve-brief, and editable brief save flow
  - ProjectView supports brief generation, review, editing, save, and approval
  - prompt set is consolidated under `server/src/agents/prompts/*.ts` with current and future agent prompt modules

## Latest Validation

- `npm run build` passes
- `npm run validate:crud` passes
- `node test/gemini-smoke.mjs` exists for Gemini path verification
- `node test/phase3-validation.mjs` passes with full upload -> intake -> approval coverage
- `node test/phase4-validation.mjs` passes with manager-brief gate, generation, edit-path, and approval coverage

## Current Priorities

1. Build Phase 5 Creator and Specialists on top of the approved brief flow
2. Preserve the Codex planner/reviewer and DeepSeek/Cline implementation split through `.agent-handoff`
3. Keep backend-enforced gates, shared schema contracts, and `.ts` prompt modules stable as later phases add more agents

## Running Phase Map

- Phase 1 - Foundation
  - Status: complete
  - Outcome: monorepo scaffolded with `client/`, `server/`, and `shared/`; SQLite-backed project CRUD in place; dashboard and project detail flow working
  - Delivered: root dev/build scripts, shared project schema baseline, Express API, React/Vite shell, local data storage
  - Validation: `npm run build`, `npm run validate:crud`
- Phase 2 - Gemini Backbone
  - Status: complete
  - Outcome: backend-only Gemini integration established through centralized config and shared service layer
  - Delivered: `server/src/config.ts`, `server/src/services/geminiClient.ts`, Gemini smoke route, model config defaults, `.env.example` Gemini keys
  - Validation: `npm run build`, `node test/gemini-smoke.mjs`
- Phase 3 - Intake Stage
  - Status: complete
  - Outcome: project setup, file uploads, text extraction, intake agents, intake review, and intake approval gate are implemented
  - Delivered: upload pipeline for `.txt/.pdf/.docx` and supported image formats, intake schemas, intake prompts, intake routes, ProjectView setup/human-check/review flow
  - Validation: `npm run build`, `npm run validate:crud`, `node test/phase3-validation.mjs`
- Phase 4 - Manager Brief
  - Status: complete
  - Outcome: approved intake output can be converted into an editable, approval-gated campaign brief
  - Delivered: `ManagerBriefSchema`, intake brief state fields, `/api/projects/:id/agents/run-manager`, `/api/projects/:id/approve/brief`, `/api/projects/:id/brief`, ProjectView brief review/edit/approve flow, Phase 4 validation script
  - Validation: `npm run build`, `node test/phase4-validation.mjs`
- Phase 5 - Creator And Specialists
  - Status: next active phase
  - Goal: generate the production plan and specialist outputs after brief approval
  - Planned work: Creator Agent, Text Content Agent, Imagery / Creative Agent, Market Research Agent, specialist output review UI
  - Success signal: approved brief can produce grouped draft outputs with model metadata and human review controls
- Phase 6 - Feedback And Selective Revision
  - Status: pending
  - Goal: route human feedback to the correct agent and rerun only affected sections
  - Planned work: revision router, selective rerun logic, feedback capture, section-level revision handling, reapproval rules when strategy changes
  - Success signal: targeted feedback updates only the relevant outputs without overwriting unaffected approved sections
- Phase 7 - Final Assembly And Export
  - Status: pending
  - Goal: assemble approved outputs into the final campaign pack
  - Planned work: Campaign Manager Agent, final assembly page, final approval gate, JSON/Markdown/HTML export generation
  - Success signal: final-approved project exports a complete campaign pack from approved inputs only
- Phase 8 - Hardening
  - Status: pending
  - Goal: polish, reliability, documentation, and final validation
  - Planned work: README completion, validation tightening, error-state polish, test coverage improvements, UX cleanup, final MVP limitations pass
  - Success signal: build and validations are stable, documentation is accurate, and the MVP workflow is consistent end to end
