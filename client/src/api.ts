const BASE = '/api';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed: ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export interface Project {
  id: string;
  name: string;
  description: string;
  status: string;
  intake: IntakeData;
  createdAt: string;
  updatedAt: string;
}

export interface ManagerBrief {
  campaign_title: string;
  client: string;
  campaign_objective: string;
  business_problem: string;
  customer_insight: string;
  target_audience: string;
  campaign_proposition: string;
  key_messages: string[];
  content_pillars: string[];
  recommended_channels: string[];
  asset_requirements: string[];
  brand_rules_to_follow: string[];
  compliance_flags: string[];
  missing_information: string[];
  approval_checklist: string[];
  campaign_brief: string;
}

export interface IntakeData {
  meetingNotesText: string;
  brandGuideText: string;
  projectNotes: string;
  stage: string;
  meetingNotesIntake: Record<string, unknown> | null;
  brandGuideIntake: Record<string, unknown> | null;
  assetReview: Record<string, unknown> | null;
  intakeSummary: Record<string, unknown> | null;
  humanCheckApproved: boolean;
  intakeApproved: boolean;
  intakeApprovedAt: string | null;
  briefStage: string;
  managerBrief: ManagerBrief | null;
  editableBrief: ManagerBrief | null;
  briefApproved: boolean;
  briefApprovedAt: string | null;
  creatorStage: string;
  creatorPlan: unknown;
  specialistsStage: string;
  specialistOutputs: unknown;
  feedbackItems?: FeedbackItem[];
  revisionDecisions?: RevisionDecision[];
  finalAssemblyStage?: string;
  finalAssembly?: Record<string, unknown> | null;
  finalApproved?: boolean;
}

export interface UploadedFile {
  id: string;
  projectId: string;
  originalName: string;
  mimeType: string;
  size: number;
  path: string;
  category: string;
  createdAt: string;
  extractedText?: string;
}

export function listProjects(): Promise<{ data: Project[] }> {
  return request('/projects');
}

export function createProject(input: { name: string; description?: string }): Promise<{ data: Project }> {
  return request('/projects', { method: 'POST', body: JSON.stringify(input) });
}

export function getProject(id: string): Promise<{ data: Project }> {
  return request(`/projects/${id}`);
}

export function updateProject(id: string, input: Record<string, unknown>): Promise<{ data: Project }> {
  return request(`/projects/${id}`, { method: 'PUT', body: JSON.stringify(input) });
}

export function updateIntake(id: string, intake: Partial<IntakeData>): Promise<{ data: IntakeData }> {
  return request(`/projects/${id}/intake`, { method: 'PUT', body: JSON.stringify(intake) });
}

export function deleteProject(id: string): Promise<void> {
  return request(`/projects/${id}`, { method: 'DELETE' });
}

export function uploadFiles(projectId: string, formData: FormData): Promise<{ data: UploadedFile[] }> {
  return fetch(`${BASE}/projects/${projectId}/uploads`, { method: 'POST', body: formData })
    .then(res => !res.ok ? res.json().then(err => { throw new Error(err.error || 'Upload failed') }) : res.json());
}

export function getUploads(projectId: string): Promise<{ data: UploadedFile[] }> {
  return request(`/projects/${projectId}/uploads`);
}

export function deleteUpload(projectId: string, fileId: string): Promise<void> {
  return request(`/projects/${projectId}/uploads/${fileId}`, { method: 'DELETE' });
}

export function approveHumanCheck(projectId: string): Promise<{ data: { humanCheckApproved: boolean; stage: string } }> {
  return request(`/projects/${projectId}/approve/human-check`, { method: 'POST' });
}

export function runIntake(projectId: string): Promise<{ data: Record<string, unknown> }> {
  return request(`/projects/${projectId}/agents/run-intake`, { method: 'POST' });
}

export function approveIntake(projectId: string): Promise<{ data: { intakeApproved: boolean } }> {
  return request(`/projects/${projectId}/approve/intake`, { method: 'POST' });
}

export function runManagerBrief(projectId: string): Promise<{ data: ManagerBrief }> {
  return request(`/projects/${projectId}/agents/run-manager`, { method: 'POST' });
}

export function approveBrief(projectId: string): Promise<{ data: { briefApproved: boolean } }> {
  return request(`/projects/${projectId}/approve/brief`, { method: 'POST' });
}

export function updateEditableBrief(projectId: string, brief: Partial<ManagerBrief>): Promise<{ data: ManagerBrief }> {
  return request(`/projects/${projectId}/brief`, { method: 'PUT', body: JSON.stringify(brief) });
}

export function runCreator(projectId: string): Promise<{ data: unknown }> {
  return request(`/projects/${projectId}/agents/run-creator`, { method: 'POST' });
}

export function runSpecialists(projectId: string): Promise<{ data: unknown }> {
  return request(`/projects/${projectId}/agents/run-specialists`, { method: 'POST' });
}

// Phase 6 — Feedback & Revision

export interface FeedbackItem {
  id: string;
  targetSection: string;
  feedback: string;
  createdAt: string;
}

export interface RevisionDecision {
  id: string;
  targetSection: string;
  targetAgent: string;
  reason: string;
  strategyChanged: boolean;
  briefReapprovalRequired: boolean;
  invalidatedSpecialists: boolean;
  createdAt: string;
  completedAt: string | null;
}

export function submitFeedback(projectId: string, targetSection: string, feedback: string): Promise<{ data: FeedbackItem }> {
  return request(`/projects/${projectId}/feedback`, { method: 'POST', body: JSON.stringify({ targetSection, feedback }) });
}

export function runRevision(projectId: string): Promise<{ data: RevisionDecision; message: string; strategyChanged?: boolean; briefReapprovalRequired?: boolean; invalidatedSpecialists?: boolean; untouchedOutputs?: Record<string, boolean> }> {
  return request(`/projects/${projectId}/agents/revise`, { method: 'POST' });
}

// Phase 7 — Final Assembly & Export

export interface FinalAssembly {
  generatedAt: string;
  campaignTitle: string;
  client: string;
  intakeSummary: string;
  campaignObjective: string;
  targetAudience: string;
  keyMessages: string[];
  contentPillars: string[];
  recommendedChannels: string[];
  productionStrategy: string;
  assetChecklist: string[];
  headlines: string[];
  adCopy: string[];
  ctaSuggestions: string[];
  visualConcept: string;
  imagePrompts: { format: string; prompt: string }[];
  conceptImages: { id: string; label: string; prompt: string; imagePath: string }[];
  audienceInsights: string[];
  competitorAnalysis: string[];
  risks: string[];
  opportunities: string[];
  feedbackCount: number;
  revisionCount: number;
  summary: string;
}

export function runCampaignManager(projectId: string): Promise<{ data: FinalAssembly }> {
  return request(`/projects/${projectId}/agents/run-campaign-manager`, { method: 'POST' });
}

export function approveFinal(projectId: string): Promise<{ data: { finalApproved: boolean; finalApprovedAt: string } }> {
  return request(`/projects/${projectId}/approve/final`, { method: 'POST' });
}

export function getExportUrl(projectId: string, format: 'docx' | 'pdf'): string {
  return `${BASE}/projects/${projectId}/export/${format}`;
}
