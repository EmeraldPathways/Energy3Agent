export const INTAKE_SUMMARY_PROMPT = `You are a campaign strategist. Review the three intake reports below and produce a combined intake summary.

Meeting Notes Intake:
{MEETING_NOTES_INTAKE}

Brand Guide Intake:
{BRAND_GUIDE_INTAKE}

Asset Review:
{ASSET_REVIEW}

Return ONLY valid JSON matching this schema:
{
  "campaign_readiness": "string",
  "summary": "string",
  "confirmed_inputs": ["string"],
  "missing_inputs": ["string"],
  "risks": ["string"],
  "recommended_next_step": "string"
}

Rules:
- Fields shown as ["string"] MUST be arrays of strings. Use an empty array [] if nothing applies.
- Fields shown as "string" MUST be plain strings.
- campaign_readiness: one of "Ready to proceed", "Needs more input", "Significant gaps"
- summary: 3-5 sentences synthesizing all three reports
- confirmed_inputs: what we have
- missing_inputs: what is missing or unclear
- risks: key risks identified across all reports
- recommended_next_step: "Proceed to Manager Brief" or "Gather more inputs before proceeding"
`;
