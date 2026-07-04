# Validation Log

## Phase 3 Fixes — Validation

### Command — npm run build

```powershell
npm run build
```

- Result: PASS
- Notes: shared/server/client all compile cleanly.

### Command — npm run validate:crud

```powershell
npm run validate:crud
```

- Result: PASS — 11/11 tests pass
- Notes: Phase 1 CRUD unaffected by all fixes.

### Command — node test/phase3-validation.mjs (Phase 3 flow)

```powershell
node test/phase3-validation.mjs
```

- Result: **PASS — 23/23 tests pass**
- Validated end-to-end flow:
  - Create project → 201
  - Upload file with named field `meetingNotes` → 201, category `meeting_notes`
  - List uploads → 200, file present
  - Human check approve → 200, `humanCheckApproved: true`
  - Run intake agents → 200, all 4 outputs present (meetingNotesIntake, brandGuideIntake, assetReview, intakeSummary)
  - Schema arrays verified: `client_goals`, `campaign_objectives` are arrays, `confirmed_inputs`, `risks` are arrays
  - Approve intake → 200, `intakeApproved: true`, `stage: approved`
  - Delete upload → 204
  - Delete project → 204

### Fix 1: Upload field names match frontend

- Changed from `upload.array('files')` to `upload.fields([...])` with individual names: `meetingNotes`, `brandGuide`, `logo`, `productImages`, `campaignImagery`
- Added `flattenMulterFields()` helper to merge field arrays into single file list
- `getFileCategory()` maps field names directly to DB categories

### Fix 2: UI flow for Human Check → Run Intake → Approve

- Split ProjectView into 4 distinct UI phases:
  - **Setup**: text areas + file uploads (shown when stage=`setup` or no human check yet)
  - **Human Check**: file list + "Confirm & Run Intake" button (shown before `humanCheckApproved`)
  - **Run Intake**: standalone run button (shown after approval, before outputs)
  - **Intake Review**: rendered outputs + "Approve Intake Summary" button (shown when outputs exist)
- Each phase has a clear activation condition — no dead ends

### Fix 3: Shared schemas use arrays where intended

- `MeetingNotesIntake`: `client_goals`, `campaign_objectives`, `target_audiences`, `products_or_services`, `key_messages_mentioned`, `channels_requested`, `stakeholder_concerns`, `open_questions` → `z.array(z.string())`
- `BrandGuideIntake`: `approved_language`, `restricted_language`, `content_examples` → `z.array(z.string())`
- `AssetReview`: `missing_assets` → `z.array(z.string())`; each asset's `best_uses`, `risks_or_limitations` → `z.array(z.string())`
- `IntakeSummary`: `confirmed_inputs`, `missing_inputs`, `risks` → `z.array(z.string())`
- All 4 agent prompts updated to reflect array schema shapes
- UI `RenderIntakeOutput` handles array display (joins with `, `)

### Fix 4: PDF extraction ESM runtime

- Replaced broken `require('pdf-parse')` with dynamic `import('pdf-parse')`
- Used type casting to handle ESM default export mismatch
- DOCX extraction already used dynamic `import('mammoth')` — no change needed

### Fix 5: Phase 3 validation evidence

- Created `test/phase3-validation.mjs` (23 assertions)
- Validates upload → human-check → run-intake → approve-intake → cleanup
- Array shape assertions on Gemini outputs
- Uses `dotenv/config` for API key loading