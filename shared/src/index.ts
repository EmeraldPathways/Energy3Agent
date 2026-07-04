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

// ── Project ──
export const ProjectSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(200),
  description: z.string().default(''),
  status: ProjectStatus.default('draft'),
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

// ── UploadedFile (schema-only for future phases) ──
export const UploadedFileSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  originalName: z.string(),
  mimeType: z.string(),
  size: z.number(),
  path: z.string(),
  createdAt: z.string(),
});
export type UploadedFile = z.infer<typeof UploadedFileSchema>;