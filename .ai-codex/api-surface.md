# api-surface.md

## Public Surface

- Routes:
  - `GET /api/projects`
  - `POST /api/projects`
  - `GET /api/projects/:id`
  - `PUT /api/projects/:id`
  - `DELETE /api/projects/:id`
  - `POST /api/projects/:id/uploads`
  - `DELETE /api/projects/:id/uploads/:fileId`
  - `POST /api/projects/:id/approve/human-check`
  - `POST /api/projects/:id/agents/run-intake`
  - `POST /api/projects/:id/approve/intake`
  - `POST /api/projects/:id/agents/run-manager`
  - `POST /api/projects/:id/approve/brief`
  - `POST /api/projects/:id/agents/run-creator`
  - `POST /api/projects/:id/agents/run-specialists`
  - `POST /api/projects/:id/feedback`
  - `POST /api/projects/:id/agents/revise`
  - `POST /api/projects/:id/approve/draft-outputs`
  - `POST /api/projects/:id/agents/run-campaign-manager`
  - `POST /api/projects/:id/approve/final`
  - `GET /api/projects/:id/export/json`
  - `GET /api/projects/:id/export/markdown`
  - `GET /api/projects/:id/export/html`
- RPC actions: none planned; keep V1 as REST
- Background jobs: none in V1; long-running agent work may still execute synchronously behind loading UI unless a later phase requires queueing
- Shared types:
  - `Project`
  - `UploadedFile`
  - `AgentRun`
  - `FeedbackItem`
  - `QualityCheck`
  - `RevisionDecision`
  - `ExportArtifact`
