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

// ── Workflow Stages ──
export const IntakeStage = z.enum(['setup', 'human-check', 'intake-review', 'approved']);
export type IntakeStage = z.infer<typeof IntakeStage>;

export const BriefStage = z.enum(['pending', 'generated', 'review', 'approved']);
export type BriefStage = z.infer<typeof BriefStage>;

export const CreatorStage = z.enum(['pending', 'generated', 'review', 'approved']);
export type CreatorStage = z.infer<typeof CreatorStage>;

export const SpecialistsStage = z.enum(['pending', 'generated', 'review']);
export type SpecialistsStage = z.infer<typeof SpecialistsStage>;

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

// ── Generated Concept Image ──
export const GeneratedConceptImageSchema = z.object({
  id: z.string(),
  label: z.string(),
  prompt: z.string(),
  imagePath: z.string(),
  stage: z.enum(['creator']),
  createdAt: z.string(),
});
export type GeneratedConceptImage = z.infer<typeof GeneratedConceptImageSchema>;

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

// ── Manager Brief ──
export const ManagerBriefSchema = z.object({
  campaign_title: z.string(),
  client: z.string(),
  campaign_objective: z.string(),
  business_problem: z.string(),
  customer_insight: z.string(),
  target_audience: z.string(),
  campaign_proposition: z.string(),
  key_messages: z.array(z.string()),
  content_pillars: z.array(z.string()),
  recommended_channels: z.array(z.string()),
  asset_requirements: z.array(z.string()),
  brand_rules_to_follow: z.array(z.string()),
  compliance_flags: z.array(z.string()),
  missing_information: z.array(z.string()),
  approval_checklist: z.array(z.string()),
  campaign_brief: z.string(),
});
export type ManagerBrief = z.infer<typeof ManagerBriefSchema>;

// ── Phase 5: Creator & Specialists ──

export const CreatorProductionPlanSchema = z.object({
  campaign_title: z.string(),
  production_strategy: z.string(),
  content_pillar_breakdown: z.array(
    z.object({
      pillar: z.string(),
      objective: z.string(),
      format_suggestions: z.array(z.string()),
      estimated_volume: z.string(),
    })
  ),
  channel_allocation: z.array(
    z.object({
      channel: z.string(),
      content_types: z.array(z.string()),
      posting_cadence: z.string(),
      kpi: z.string(),
    })
  ),
  timeline_phases: z.array(
    z.object({
      phase: z.string(),
      duration: z.string(),
      key_activities: z.array(z.string()),
    })
  ),
  asset_checklist: z.array(z.string()),
  team_roles_needed: z.array(z.string()),
  approval_gates: z.array(z.string()),
  summary: z.string(),
});
export type CreatorProductionPlan = z.infer<typeof CreatorProductionPlanSchema>;

export const TextContentOutputSchema = z.object({
  model: z.string().optional(),
  generatedAt: z.string().optional(),
  headlines: z.array(z.string()),
  social_captions: z.array(z.string()),
  ad_copy: z.array(z.string()),
  email_body: z.array(z.string()),
  long_form_content: z.array(z.string()),
  cta_suggestions: z.array(z.string()),
  tone_notes: z.string(),
  summary: z.string(),
});
export type TextContentOutput = z.infer<typeof TextContentOutputSchema>;

export const ImageryCreativeOutputSchema = z.object({
  model: z.string().optional(),
  generatedAt: z.string().optional(),
  visual_concept: z.string(),
  color_palette_suggestions: z.array(z.string()),
  image_prompts: z.array(
    z.object({
      format: z.string(),
      scene_description: z.string(),
      prompt: z.string(),
      suggested_alt_text: z.string(),
    })
  ),
  typography_suggestions: z.array(z.string()),
  layout_ideas: z.array(z.string()),
  summary: z.string(),
});
export type ImageryCreativeOutput = z.infer<typeof ImageryCreativeOutputSchema>;

export const MarketResearchOutputSchema = z.object({
  model: z.string().optional(),
  generatedAt: z.string().optional(),
  target_audience_insights: z.array(z.string()),
  competitor_analysis: z.array(z.string()),
  market_trends: z.array(z.string()),
  channel_recommendations: z.array(z.string()),
  benchmark_data: z.array(z.string()),
  risk_factors: z.array(z.string()),
  opportunities: z.array(z.string()),
  summary: z.string(),
});
export type MarketResearchOutput = z.infer<typeof MarketResearchOutputSchema>;

export const SpecialistOutputsSchema = z.object({
  textContent: TextContentOutputSchema.nullable().default(null),
  imageryCreative: ImageryCreativeOutputSchema.nullable().default(null),
  marketResearch: MarketResearchOutputSchema.nullable().default(null),
});
export type SpecialistOutputs = z.infer<typeof SpecialistOutputsSchema>;

// ── Full Intake/Brief/Creator/Specialists State ──
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
  // Manager Brief
  briefStage: BriefStage.default('pending'),
  managerBrief: ManagerBriefSchema.nullable().default(null),
  editableBrief: ManagerBriefSchema.nullable().default(null),
  briefApproved: z.boolean().default(false),
  briefApprovedAt: z.string().nullable().default(null),
  // Creator
  creatorStage: CreatorStage.default('pending'),
  creatorPlan: CreatorProductionPlanSchema.nullable().default(null),
  editableCreatorPlan: CreatorProductionPlanSchema.nullable().default(null),
  // Specialists
  specialistsStage: SpecialistsStage.default('pending'),
  specialistOutputs: SpecialistOutputsSchema.nullable().default(null),
  editableSpecialistOutputs: SpecialistOutputsSchema.nullable().default(null),
  // Generated Concept Images
  conceptImages: z.array(GeneratedConceptImageSchema).default([]),
});
export type IntakeData = z.infer<typeof IntakeDataSchema>;

// ── Project (extended) ──
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

// ── Phase 6: Feedback & Revision ──

export const FeedbackTargetSection = z.enum([
  'brief_strategy',
  'creator_plan',
  'text_content',
  'imagery_creative',
  'market_research',
]);
export type FeedbackTargetSection = z.infer<typeof FeedbackTargetSection>;

export const FeedbackItemSchema = z.object({
  id: z.string(),
  targetSection: FeedbackTargetSection,
  feedback: z.string(),
  createdAt: z.string(),
});
export type FeedbackItem = z.infer<typeof FeedbackItemSchema>;

export const RevisionDecisionSchema = z.object({
  id: z.string(),
  targetSection: FeedbackTargetSection,
  targetAgent: z.enum(['manager', 'creator', 'text-content', 'imagery-creative', 'market-research']),
  reason: z.string(),
  strategyChanged: z.boolean(),
  briefReapprovalRequired: z.boolean(),
  invalidatedSpecialists: z.boolean().default(false),
  createdAt: z.string(),
  completedAt: z.string().nullable().default(null),
});
export type RevisionDecision = z.infer<typeof RevisionDecisionSchema>;

export const RevisionStage = z.enum(['pending', 'in_progress', 'completed']);
export type RevisionStage = z.infer<typeof RevisionStage>;

// ── Phase 7: Final Assembly & Export ──

export const FinalAssemblyStage = z.enum(['pending', 'generated']);
export type FinalAssemblyStage = z.infer<typeof FinalAssemblyStage>;

export const FinalAssemblySchema = z.object({
  generatedAt: z.string(),
  campaignTitle: z.string(),
  client: z.string(),
  intakeSummary: z.string(),
  campaignObjective: z.string(),
  targetAudience: z.string(),
  keyMessages: z.array(z.string()),
  contentPillars: z.array(z.string()),
  recommendedChannels: z.array(z.string()),
  productionStrategy: z.string(),
  assetChecklist: z.array(z.string()),
  headlines: z.array(z.string()),
  adCopy: z.array(z.string()),
  ctaSuggestions: z.array(z.string()),
  visualConcept: z.string(),
  imagePrompts: z.array(z.object({
    format: z.string(),
    prompt: z.string(),
  })),
  conceptImages: z.array(z.object({
    id: z.string(),
    label: z.string(),
    prompt: z.string(),
    imagePath: z.string(),
  })),
  audienceInsights: z.array(z.string()),
  competitorAnalysis: z.array(z.string()),
  risks: z.array(z.string()),
  opportunities: z.array(z.string()),
  feedbackCount: z.number(),
  revisionCount: z.number(),
  summary: z.string(),
});
export type FinalAssembly = z.infer<typeof FinalAssemblySchema>;

export const ExportArtifactSchema = z.object({
  format: z.enum(['docx', 'pdf']),
  content: z.string(),
  generatedAt: z.string(),
});
export type ExportArtifact = z.infer<typeof ExportArtifactSchema>;

// ── API Response wrappers ──
export const ApiErrorSchema = z.object({
  error: z.string(),
  details: z.unknown().optional(),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;

export const ApiSuccessSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({ data: dataSchema });