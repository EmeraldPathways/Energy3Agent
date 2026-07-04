# Phase 5 Scope

## Goal

Extend the approved-brief workflow with Creator and Specialists stages without regressing the earlier intake and brief flow.

## Implemented Area

- Shared schemas for:
  - `CreatorProductionPlan`
  - `TextContentOutput`
  - `ImageryCreativeOutput`
  - `MarketResearchOutput`
  - `SpecialistOutputs`
- Backend routes:
  - `POST /api/projects/:id/agents/run-creator`
  - `POST /api/projects/:id/agents/run-specialists`
  - `PUT /api/projects/:id/creator`
  - `PUT /api/projects/:id/specialists`
- Agent runner:
  - `server/src/agents/runPhase5.ts`
- Prompt modules:
  - `creator-agent.ts`
  - `text-content-agent.ts`
  - `imagery-creative-agent.ts`
  - `market-research-agent.ts`

## Current Review Risks

- Preserve the Phase 3-4 UI while adding Phase 5 sections.
- Keep specialist outputs Zod-validated before persistence.
- Keep prompt JSON contracts aligned with `shared/src/index.ts`.
- Strengthen validation around persistence and editable save paths, not just 200 responses.

## Non-goals

- No revision routing yet
- No final assembly/export flow yet
- No image generation execution yet
- No auth or cloud deployment work
