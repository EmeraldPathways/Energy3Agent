# AI Marketing Campaign Builder

Local-first monorepo app that turns meeting notes, brand guides, assets, and human feedback into an approval-gated, multi-phase marketing campaign. Built with TypeScript, React + Vite, Express, and SQLite with Gemini as the AI backbone.

## Monorepo Structure

```
  client/          - React + Vite + TypeScript SPA
  server/          - Express + TypeScript API + SQLite
  shared/          - Zod schemas/types shared by client and server
  test/            - Validation scripts per phase
  .ai-codex/       - Architecture and pattern docs for AI agents
  .agent-handoff/  - Task definitions and validation records
  data/            - SQLite DB + uploaded files (gitignored)
```

## Local Setup

```bash
npm install
```

Create `.env` from `.env.example`:

```
GEMINI_API_KEY=your-key-here
GEMINI_FAST_MODEL=gemini-2.5-flash-lite
GEMINI_STANDARD_MODEL=gemini-2.5-flash
GEMINI_REASONING_MODEL=gemini-2.5-pro
GEMINI_IMAGE_MODEL=gemini-2.5-flash
ENABLE_GOOGLE_SEARCH_GROUNDING=true
PORT=3001
```

## Commands

| Command | Purpose |
|---------|---------|
| `npm.cmd run dev` | Start both client (port 3000) and server (port 3001) |
| `run-local.cmd` | Start missing client/server processes, wait for readiness, write logs |
| `npm.cmd run dev:client` | Start client only |
| `npm.cmd run dev:server` | Start server only |
| `npm.cmd run build` | TypeScript compilation + Vite production build |
| `npm.cmd run validate:crud` | CRUD API test suite (11 assertions) |
| `node test/phase3-validation.mjs` | Intake flow validation |
| `node test/phase4-validation.mjs` | Manager brief validation |
| `node test/phase5-validation.mjs` | Creator + specialists validation |
| `node test/phase6-validation.mjs` | Feedback + revision validation |
| `node test/phase7-validation.mjs` | Final assembly + export validation |

## Workflow Phases

1. **Phase 1 — Foundation**: Monorepo scaffold, project CRUD, SQLite storage, dashboard
2. **Phase 2 — Gemini Backbone**: Centralized model config, backend-only Gemini service
3. **Phase 3 — Intake Stage**: File uploads, text extraction, 4 intake agents, approval gate
4. **Phase 4 — Manager Brief**: Brief generation from approved intake, editable/reviewable
5. **Phase 5 — Creator & Specialists**: Production plan + text/imagery/research specialist outputs
6. **Phase 6 — Feedback & Revision**: Target-section feedback, selective re-runs, untouched output preservation
7. **Phase 7 — Final Assembly & Export**: Campaign pack assembly, final approval, JSON/Markdown/HTML export

### User Workflow

1. Create a project, then setup meeting notes + brand guide (paste or upload)
2. Human check, then run intake agents, then review output, then approve intake
3. Generate manager brief, edit if needed, then approve brief
4. Run creator, review plan, then run specialists, then review outputs
5. Submit feedback on specific sections, then revise selectively
6. Run final assembly, then approve final, then export campaign pack

## Current Limitations

- `.env` file must contain a valid Gemini API key for AI-generated content phases
- All AI calls are synchronous — large projects may take several seconds per agent
- Gemini-dependent tests skip gracefully when API key is missing
- Auth not implemented (local-first MVP)
- File uploads stored on local disk, not cloud
- Export artifacts stored in SQLite JSON blob, not as separate files
- No image generation execution — imagery outputs are text prompts only
