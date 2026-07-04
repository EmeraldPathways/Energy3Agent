# api-surface.md

## Public Surface

- Routes:
  - `GET /api/projects`
  - `POST /api/projects`
  - `GET /api/projects/:id`
  - `PUT /api/projects/:id`
  - `DELETE /api/projects/:id`
  - `PUT /api/projects/:id/intake`
  - `POST /api/projects/:id/uploads`
  - `DELETE /api/projects/:id/uploads/:fileId`
  - `GET /api/projects/:id/uploads`
  - `POST /api/projects/:id/approve/human-check`
  - `POST /api/projects/:id/agents/run-intake`
  - `POST /api/projects/:id/approve/intake`
  - `POST /api/projects/:id/agents/run-manager`
  - `POST /api/projects/:id/approve/brief`
  - `POST /api/projects/:id/agents/run-creator`
  - `POST /api/projects/:id/agents/run-specialists`
  - `PUT /api/projects/:id/brief`
  - `PUT /api/projects/:id/creator`
  - `PUT /api/projects/:id/specialists`
  - `POST /api/projects/:id/feedback` (Phase 6)
  - `POST /api/projects/:id/agents/revise` (Phase 6)
  - `POST /api/projects/:id/agents/run-campaign-manager` (Phase 7)
  - `POST /api/projects/:id/approve/final` (Phase 7)
  - `GET /api/projects/:id/export/json` (Phase 7)
  - `GET /api/projects/:id/export/markdown` (Phase 7)
  - `GET /api/projects/:id/export/html` (Phase 7)
  - `GET /api/health`
  - `POST /api/gemini-smoke`
- RPC actions: none planned; keep V1 as REST
- Background jobs: none in V1; long-running agent work may still execute synchronously behind loading UI unless a later phase requires queueing
- Shared types:
  - `Project`
  - `UploadedFile`
  - `MeetingNotesIntake`
  - `BrandGuideIntake`
  - `AssetReviewIntake`
  - `IntakeSummary`
  - `ManagerBrief`
  - `CreatorProductionPlan`
  - `TextContentOutput`
  - `ImageryCreativeOutput`
  - `MarketResearchOutput`
  - `SpecialistOutputs`
  - `FeedbackItem`
  - `RevisionDecision`
  - `FinalAssembly`
  - `ExportArtifact`

## Current Gate Rules

- `POST /api/projects/:id/agents/run-intake` — requires non-empty `meetingNotesText` or `brandGuideText` in intake
- `POST /api/projects/:id/approve/intake` — requires `intakeSummary`
- `POST /api/projects/:id/agents/run-manager` — requires `intakeApproved === true`
- `POST /api/projects/:id/approve/brief` — requires `managerBrief`
- `POST /api/projects/:id/agents/run-creator` — requires `briefApproved === true` and `managerBrief`
- `POST /api/projects/:id/agents/run-specialists` — requires `creatorPlan` and `managerBrief`
- `POST /api/projects/:id/feedback` — requires `specialistOutputs` exist
- `POST /api/projects/:id/agents/revise` — requires at least one un-revised `feedbackItem`
- `POST /api/projects/:id/agents/run-campaign-manager` — requires `briefApproved` and valid specialist outputs
- `POST /api/projects/:id/approve/final` — requires `finalAssemblyStage === 'generated'`
- `GET /api/projects/:id/export/:format` — requires `finalApproved === true`