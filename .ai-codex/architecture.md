# architecture.md

## Summary

Local-first TypeScript monorepo for a staged marketing-campaign production app. The frontend drives a route-based workflow UI, the backend owns all file handling, workflow rules, Gemini access, and export generation, and shared schemas/types keep contracts synchronized.

## Modules

- Frontend: React + Vite SPA with route-based workflow pages, fetch-based API client, editable stage outputs, approval UI, and export views
- Backend: Express API, workflow orchestrators, agent runners, prompt modules, validation, upload parsing, export builders, and approval enforcement
- Data layer: SQLite for structured project/workflow state; local filesystem for uploads, extracted text, generated images, and export artifacts
- External services: Google Gemini via backend-only `@google/genai` integration

## Runtime Flow

1. User creates or opens a local campaign project in the client.
2. Client reads/writes project state through Express API routes backed by SQLite and filesystem storage.
3. Backend enforces workflow gates, runs agent stages, validates structured output, records human edits/feedback, and generates export artifacts.
