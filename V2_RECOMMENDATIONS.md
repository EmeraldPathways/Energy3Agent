# V2 Recommendations

## Goal

V2 should move the app from a strong workflow MVP to a closer implementation of the original project brief.

## Highest-Value Improvements

### 1. Real model specialization per agent

The current app mostly uses the same Gemini model across intake, manager, creator, and specialist stages. V2 should align model selection to agent purpose:

- Meeting Notes Intake: `gemini-2.5-flash-lite`
- Brand Guide Intake: `gemini-2.5-flash`
- Asset Review: `gemini-2.5-flash`
- Manager Agent: `gemini-2.5-pro`
- Creator Agent: `gemini-2.5-pro`
- Text Content Agent: `gemini-2.5-flash`
- Imagery Agent: `gemini-2.5-flash-image`
- Market Research Agent: `gemini-2.5-flash` with Google Search grounding
- Campaign Manager Agent: `gemini-2.5-pro`

This is the clearest gap between the current implementation and the original brief.

### 2. Grounded market research

The market research stage should use live Google Search grounding instead of plain text generation. Outputs should include:

- evidence-backed competitor observations
- source summaries or citations
- clearer separation between facts, inference, and recommendations

This would materially improve factual discipline and bring the research agent closer to the project brief.

### 3. True AI-powered final assembly

The current final assembly is mostly deterministic merging. V2 should introduce a real campaign manager pass that:

- synthesizes all approved outputs into a polished campaign proposal
- creates a structured rollout plan
- builds a final asset library summary
- applies a final QA checklist before approval

The deterministic assembly can remain as a fallback path for reliability.

### 4. Actual image generation pipeline

The current imagery flow mainly produces concepts and prompts. V2 should add:

- prompt-to-image generation
- stored generated image artifacts
- image review and approval handling
- regeneration for only the selected image or visual direction

This would make the imagery agent meaningfully closer to the original app design.

### 5. Better export package

V2 exports should go beyond a single proposal document. The app should support:

- polished DOCX export
- polished PDF export
- asset library ZIP export
- export manifest listing approved assets, prompts, and supporting notes

This would better match the brief's client-ready campaign pack idea.

## Workflow Improvements

### 6. Stronger review states and approvals

The brief implies more explicit review control than the current MVP. V2 should add:

- approve or request-changes actions for creator outputs
- approve or request-changes actions for each specialist output
- per-image approval for generated visuals
- clearer distinction between generated, edited, approved, and superseded content

### 7. Revision routing that uses feedback content

The current routing is mostly based on the selected section. V2 should use the feedback text itself to:

- classify whether the request is strategic or tactical
- detect cross-agent dependencies
- generate targeted revision instructions
- recommend whether brief reapproval is required

This would make revision behavior smarter without broadening scope unnecessarily.

### 8. Missing-information and compliance handling

V2 should strengthen safeguards already suggested by the brief:

- explicit missing-information flags in each stage
- stronger compliance-risk surfacing
- unsupported-claim warnings
- channel-fit checks before final approval

## Product and Operations Improvements

### 9. Cost visibility

The original brief explicitly discusses API cost. V2 should add:

- per-stage estimated token and image cost
- per-project running cost estimate
- warnings before expensive regeneration or image batches

### 10. Better artifact and provenance tracking

For each generated output, V2 should store:

- model used
- prompt version
- generation timestamp
- grounding status
- approval status
- revision lineage

This would improve auditability and make the workflow easier to defend professionally.

## Suggested V2 Priority Order

1. Model specialization
2. Grounded market research
3. AI-powered final assembly
4. Image generation pipeline
5. Asset-library export package
6. Richer approval and provenance controls

## Recommended V2 Definition

If scope must stay tight, V2 should be defined as:

"The version that closes the major fidelity gaps with the original brief: correct model allocation, grounded research, true campaign-manager assembly, generated imagery, and client-ready export packaging."
