# Codex Task

Status: ready for implementation

## Objective

Execute Phase 1 only: scaffold the monorepo foundation for AI Marketing Campaign Builder and deliver working local project CRUD with React + Vite frontend, Express backend, shared TypeScript types, SQLite-backed project storage, and root dev scripts.

## Scope

- Allowed files:
  - root package/tooling files required for the monorepo
  - `client/**`
  - `server/**`
  - `shared/**`
  - `.env.example`
  - `README.md`
  - `.agent-handoff/cline-result.md`
  - `.agent-handoff/validation-log.md`
- Forbidden files:
  - `AGENTS.md`
  - `PROJECT.md`
  - `phases.md`
  - `.ai-codex/**`
  - any future Phase 2+ agent/prompt/schema work not needed for foundation CRUD

## Implementation Notes

- Codex is the planner and reviewer.
- Cline or DeepSeek is the implementation agent.
- At the start of each new implementation conversation, read `AGENTS.md` first.
- At the start of each new implementation conversation, use memory and symbol tools when available.
- Do not edit files outside the agreed scope.
- Do not work on the same files in parallel with Codex.
- If you edit any handoff file, count it as a changed file.
- In `.agent-handoff/cline-result.md`, list every touched file exactly, including handoff files.
- Use the current repo docs as truth:
  - `PROJECT.md`
  - `phases.md`
  - `.ai-codex/index.md`
  - `.ai-codex/architecture.md`
  - `.ai-codex/patterns.md`
  - `.ai-codex/api-surface.md`
  - `.ai-codex/scopes/phase-1-foundation.md`
- Keep Phase 1 narrow:
  - no Gemini integration
  - no intake agents
  - no upload parsing pipeline
  - no export system
  - no workflow gate implementation beyond base schema/status fields needed for future phases
- Recommended implementation direction:
  - root workspace with coordinated scripts
  - React client with dashboard and create/open/delete project flow
  - Express server with CRUD endpoints
  - shared schema/types package or folder used by both client and server
  - SQLite bootstrap plus a small storage layer
  - local data directories prepared safely for later phases

## Validation Required

- `npm install`
- `npm run dev` or equivalent proof that both client and server start correctly
- a minimal validation proving project CRUD works locally
- any targeted typecheck/build command added by the foundation setup

## Handoff To Agent

Use this exact prompt:

You are implementing Phase 1 only for `AI Marketing Campaign Builder`.

Read first:
- `AGENTS.md`
- `.agent-handoff/codex-task.md`
- `.agent-handoff/cline-result.md`
- `.agent-handoff/validation-log.md`
- `.agent-handoff/safety-rules.md`
- `.ai-codex/index.md`
- `.ai-codex/architecture.md`
- `.ai-codex/patterns.md`
- `.ai-codex/api-surface.md`
- `.ai-codex/scopes/phase-1-foundation.md`
- `PROJECT.md`
- `phases.md`

Task:
- Build the Phase 1 foundation only.
- Create the monorepo structure with `client`, `server`, and `shared`.
- Use React + Vite + TypeScript on the client.
- Use Node + Express + TypeScript on the server.
- Add root scripts so the intended local commands are `npm run dev`, `npm run dev:client`, and `npm run dev:server`.
- Add SQLite-backed project storage for local campaign project records.
- Build the first dashboard flow so a user can list projects, create a project, open a project, and delete a project.
- Add the base shared `Project` schema/types needed for this foundation work.
- Add `.env.example`.
- Keep the implementation minimal, clean, and production-minded.

Current truth:
- The repo currently contains planning and handoff docs only.
- Codex has already defined the architecture direction and phase boundary.
- Do not jump ahead to Gemini, file parsing, agents, approvals UI, exports, or later workflow stages.

Non-goals:
- No Gemini integration
- No upload parsing
- No intake/review/brief/specialist/final export pages
- No cloud or auth work
- No speculative abstractions for later phases unless required by the foundation

Validation:
- Run `npm install`
- Run the smallest useful command set to prove the app starts and CRUD works
- Record each validation command and result in `.agent-handoff/validation-log.md`

Handback format:
1. Files changed
2. What changed
3. Test results
4. Remaining limitations

---

## Prompt Pattern

Use one task at a time.

### Read First
- `AGENTS.md`
- `.agent-handoff/codex-task.md`
- `.agent-handoff/cline-result.md`
- `.agent-handoff/validation-log.md`
- `.agent-handoff/safety-rules.md`
- `.ai-codex/index.md`
- `PROJECT.md`
- `phases.md` when the task is phase-based

### Standard Rules
- Make small surgical changes.
- Do not start the next phase unless explicitly asked.
- Keep the answer grounded in the current repo state.
- Separate `code changed`, `tests passed`, and `live runtime verified`.
- If validation was not run, say so clearly.

### Handback Format
1. Files changed
2. What changed
3. Test results
4. Remaining limitations
