# PROJECT.md

## Project Summary

- Name: AI Marketing Campaign Builder
- Goal: Build a local-first AI marketing campaign app that turns meeting notes, brand guides, assets, and human feedback into an approval-gated campaign production workflow with exportable outputs.
- Users: Internal marketing operators or consultants running campaign planning locally on one machine during MVP.
- Current status: Planning complete. Repo is scaffold-only. Phase 1 foundation handoff is ready for DeepSeek/Cline execution.

## Stack

- Frontend: React + Vite + TypeScript
- Backend: Node.js + Express + TypeScript
- Database: SQLite for project state plus local disk storage for uploads and generated artifacts
- Deployment: Local-only MVP, no cloud deployment in V1

## Local Run Commands

- App: `npm run dev`
- Frontend: `npm run dev:client`
- Backend: `npm run dev:server`
- Tests: `npm test`

## Environment Notes

- Required env files: root `.env` and `.env.example`
- Required services: local filesystem only; no external services beyond Gemini API access from backend
- Secrets location: `GEMINI_API_KEY` stored in local `.env`, never exposed to frontend code

## Active Constraints

- Scope limits: local-first MVP only; human approval required at every major workflow gate; keep functions/prompts/schemas modular and small
- Non-goals: auth, cloud deployment, external DB, Stripe, Supabase, Firebase, client portal, speculative extra workflow steps
- Known risks: document parsing complexity for `.pdf` and `.docx`, Gemini structured-output repair edge cases, keeping selective revisions stable without overwriting human edits

## Current Priorities

1. Complete Phase 1 foundation: monorepo scaffolding, local persistence baseline, dashboard, and CRUD
2. Keep `.agent-handoff` as the execution contract between Codex and DeepSeek/Cline
3. Preserve a stable path to later Gemini integration without exposing secrets to the client
