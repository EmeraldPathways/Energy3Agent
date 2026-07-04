import { z } from 'zod';

// ── Project Status ──
export const ProjectStatus = z.enum([
  'draft',
  'needs_review',
  'approved',
  'changes_requested',
  'blocked',
]);
export type ProjectStatus = z.infer<typeof ProjectStatus>;

// ── Intake Stage ──
export const IntakeStage = z.enum(['setup', 'human-check', 'intake-review', 'approved']);
export type IntakeStage = z.infer<typeof IntakeStage>;

// ── UploadedFile ──
export const UploadedFileSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  originalName: z.string(),
  mimeType: z.string(),
  size: z.number(),
  path: z.string(),
  category: z.enum(['meeting_notes', 'brand_guide', 'logo', 'product_image', 'campaign_imagery', 'other']),
  createdAt: z.string(),
});
export type UploadedFile = z.infer<typeof UploadedFileSchema>;

// ── Intake Agent Output Schemas ──

export const MeetingNotesIntakeSchema = z.object({
  client_goals: z.array(z.string()),
  campaign_objectives: z.array(z.string()),
  target_audiences: z.array(z.string()),
  products_or_services: z.array(z.string()),
  key_messages_mentioned: z.array(z.string()),
  channels_requested: z.array(z.string()),
  deadlines_or_timing: z.string(),
  budget_notes: z.string(),
  stakeholder_concerns: z.array(z.string()),
  approval_requirements: z.string(),
  open_questions: z.array(z.string()),
  summary: z.string(),
});
export type MeetingNotesIntake = z.infer<typeof MeetingNotesIntakeSchema>;

export const BrandGuideIntakeSchema = z.object({
  brand_positioning: z.string(),
  tone_of_voice: z.string(),
  visual_style: z.string(),
  colour_guidance: z.string(),
  typography_guidance: z.string(),
  logo_rules: z.string(),
  approved_language: z.array(z.string()),
  restricted_language: z.array(z.string()),
  compliance_notes: z.string(),
  audience_guidance: z.string(),
  content_examples: z.array(z.string()),
  summary: z.string(),
});
export type BrandGuideIntake = z.infer<typeof BrandGuideIntakeSchema>;

export const AssetItemSchema = z.object({
  file_name: z.string(),
  asset_type: z.string(),
  description: z.string(),
  best_uses: z.array(z.string()),
  quality_notes: z.string(),
  risks_or_limitations: z.array(z.string()),
  recommended_alt_text: z.string(),
});
export type AssetItem = z.infer<typeof AssetItemSchema>;

export const AssetReviewIntakeSchema = z.object({
  assets: z.array(AssetItemSchema),
  missing_assets: z.array(z.string()),
  overall_asset_summary: z.string(),
});
export type AssetReviewIntake = z.infer<typeof AssetReviewIntakeSchema>;

export const IntakeSummarySchema = z.object({
  campaign_readiness: z.string(),
  summary: z.string(),
  confirmed_inputs: z.array(z.string()),
  missing_inputs: z.array(z.string()),
  risks: z.array(z.string()),
  recommended_next_step: z.string(),
});
export type IntakeSummary = z.infer<typeof IntakeSummarySchema>;

// ── Full Intake State (stored as JSON on project) ──
export const IntakeDataSchema = z.object({
  meetingNotesText: z.string().default(''),
  brandGuideText: z.string().default(''),
  projectNotes: z.string().default(''),
  stage: IntakeStage.default('setup'),
  meetingNotesIntake: MeetingNotesIntakeSchema.nullable().default(null),
  brandGuideIntake: BrandGuideIntakeSchema.nullable().default(null),
  assetReview: AssetReviewIntakeSchema.nullable().default(null),
  intakeSummary: IntakeSummarySchema.nullable().default(null),
  humanCheckApproved: z.boolean().default(false),
  intakeApproved: z.boolean().default(false),
  intakeApprovedAt: z.string().nullable().default(null),
});
export type IntakeData = z.infer<typeof IntakeDataSchema>;

// ── Project (extended with intake) ──
export const ProjectSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(200),
  description: z.string().default(''),
  status: ProjectStatus.default('draft'),
  intake: IntakeDataSchema.default({}),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Project = z.infer<typeof ProjectSchema>;

export const CreateProjectInputSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
});
export type CreateProjectInput = z.infer<typeof CreateProjectInputSchema>;

export const UpdateProjectInputSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  status: ProjectStatus.optional(),
  intake: IntakeDataSchema.partial().optional(),
});
export type UpdateProjectInput = z.infer<typeof UpdateProjectInputSchema>;

// ── API Response wrappers ──
export const ApiErrorSchema = z.object({
  error: z.string(),
  details: z.unknown().optional(),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;

export const ApiSuccessSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({ data: dataSchema });