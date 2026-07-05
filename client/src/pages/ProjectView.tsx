import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  getProject,
  updateIntake,
  uploadFiles,
  getUploads,
  deleteUpload,
  approveHumanCheck,
  runIntake,
  approveIntake,
  runManagerBrief,
  approveBrief,
  updateEditableBrief,
  runCreator,
  runSpecialists,
  submitFeedback,
  runRevision,
  runCampaignManager,
  approveFinal,
  getExportUrl,
  type Project,
  type UploadedFile,
  type ManagerBrief,
} from '../api.js';

// -- Stage definitions --

type StageStatus = 'not-started' | 'in-progress' | 'needs-review' | 'approved' | 'blocked';

interface StageDef {
  key: string;
  label: string;
}

const STAGES: StageDef[] = [
  { key: 'setup',       label: 'Project Setup' },
  { key: 'humanCheck',  label: 'Human Check' },
  { key: 'intake',      label: 'Intake Review' },
  { key: 'brief',       label: 'Campaign Brief' },
  { key: 'creator',     label: 'Creator Stage' },
  { key: 'specialists', label: 'Specialists' },
  { key: 'feedback',    label: 'Feedback' },
  { key: 'export',      label: 'Export' },
];

function deriveStageStatuses(project: Project): Record<string, StageStatus> {
  const i = project.intake;
  const s: Record<string, StageStatus> = {};

  // setup
  s.setup = i.stage !== 'setup' && i.stage !== 'intake-review' ? 'approved' : (i.humanCheckApproved ? 'needs-review' : (i.meetingNotesText || i.brandGuideText ? 'in-progress' : 'not-started'));

  // human check
  if (i.humanCheckApproved) {
    s.humanCheck = 'approved';
  } else if (i.stage === 'setup' && (i.meetingNotesText || i.brandGuideText)) {
    s.humanCheck = 'needs-review';
  } else {
    s.humanCheck = 'not-started';
  }

  // intake
  if (i.intakeApproved) {
    s.intake = 'approved';
  } else if (i.meetingNotesIntake) {
    s.intake = 'needs-review';
  } else if (i.humanCheckApproved) {
    s.intake = 'in-progress';
  } else {
    s.intake = 'not-started';
  }

  // brief
  if (i.briefApproved) {
    s.brief = 'approved';
  } else if (i.managerBrief) {
    s.brief = 'needs-review';
  } else if (i.intakeApproved) {
    s.brief = 'in-progress';
  } else {
    s.brief = 'not-started';
  }

  // creator
  if (i.creatorPlan) {
    s.creator = 'approved';
  } else if (i.briefApproved) {
    s.creator = 'in-progress';
  } else {
    s.creator = 'not-started';
  }

  // specialists
  if (i.specialistsStage === 'generated') {
    s.specialists = 'approved';
  } else if (i.specialistOutputs && Object.keys(i.specialistOutputs as object).length > 0) {
    s.specialists = 'needs-review';
  } else if (i.creatorPlan) {
    s.specialists = 'in-progress';
  } else {
    s.specialists = 'not-started';
  }

  // feedback
  if (i.specialistsStage === 'generated') {
    const revisions = i.revisionDecisions || [];
    const hasPending = revisions.some(d => !d.completedAt);
    s.feedback = hasPending ? 'in-progress' : (revisions.length > 0 ? 'approved' : 'needs-review');
  } else {
    s.feedback = 'not-started';
  }

  // export
  if (i.finalApproved) {
    s.export = 'approved';
  } else if (i.finalAssemblyStage === 'generated') {
    s.export = 'needs-review';
  } else if (i.specialistsStage === 'generated') {
    s.export = 'in-progress';
  } else {
    s.export = 'not-started';
  }

  return s;
}

function activeStageKey(statuses: Record<string, StageStatus>): string {
  // return the first non-approved stage
  for (const { key } of STAGES) {
    if (statuses[key] !== 'approved') return key;
  }
  return 'export';
}

// -- Stage rail component --

function StageRail({ statuses, activeKey }: { statuses: Record<string, StageStatus>; activeKey: string }) {
  return (
    <nav className="project-stage-rail" aria-label="Workflow stages">
      <div className="stage-rail-title">Workflow</div>
      {STAGES.map(({ key, label }) => {
        const st = statuses[key] || 'not-started';
        const isActive = key === activeKey;
        return (
          <div key={key} className={`stage-item${isActive ? ' stage-item--active' : ''}`}>
            <span className={`stage-dot stage-dot--${st}`} aria-hidden="true" />
            <span>{label}</span>
          </div>
        );
      })}
    </nav>
  );
}

// -- Shared helpers --

function ArraySection({ title, items }: { title: string; items: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="output-block">
      <h4>{title}</h4>
      <ul className="output-list">{items.map((item, i) => <li key={i}>{item}</li>)}</ul>
    </div>
  );
}

function filterMeaningfulMissing(items: string[]): string[] {
  if (!items || items.length === 0) return [];
  // Generic noise patterns that Gemini often emits for "nothing missing"
  const noisePatterns = [
    /^none\.?\s*$/i,
    /^n\/a\.?\s*$/i,
    /^not applicable\.?\s*$/i,
    /^no (missing|additional) information/i,
    /^nothing (missing|to report)/i,
    /^all (necessary|required|needed) information (is )?(present|available|provided)/i,
    /^client (has|provided) (all|everything)/i,
    /^no (gaps|issues) (identified|found)/i,
  ];
  return items.filter(item => {
    if (item.length < 20) return false;
    for (const pattern of noisePatterns) {
      if (pattern.test(item.trim())) return false;
    }
    return true;
  });
}

function IntakeOutputTabs({
  meetingNotesIntake,
  brandGuideIntake,
  assetReview,
  intakeSummary,
}: {
  meetingNotesIntake: Record<string, unknown> | null;
  brandGuideIntake: Record<string, unknown> | null;
  assetReview: Record<string, unknown> | null;
  intakeSummary: Record<string, unknown> | null;
}) {
  const tabs = [
    { key: 'meeting', label: 'Meeting Notes', data: meetingNotesIntake },
    { key: 'brand', label: 'Brand Guide', data: brandGuideIntake },
    { key: 'assets', label: 'Asset Review', data: assetReview },
    { key: 'summary', label: 'Summary', data: intakeSummary },
  ].filter(t => t.data);

  const [active, setActive] = useState(tabs[0]?.key || '');

  if (tabs.length === 0) return null;

  const current = tabs.find(t => t.key === active) || tabs[0];

  return (
    <div>
      <div className="intake-tabs" role="tablist">
        {tabs.map(t => (
          <button
            key={t.key}
            role="tab"
            aria-selected={t.key === active}
            className={`intake-tab${t.key === active ? ' intake-tab--active' : ''}`}
            onClick={() => setActive(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel">
        <OutputGrid data={current.data!} />
      </div>
    </div>
  );
}

function OutputGrid({ data }: { data: Record<string, unknown> }) {
  const entries = Object.entries(data);
  // show plain fields first, then array fields
  const scalars = entries.filter(([, v]) => !Array.isArray(v));
  const arrays = entries.filter(([, v]) => Array.isArray(v));

  return (
    <div>
      {scalars.length > 0 && (
        <dl className="output-grid">
          {scalars.map(([k, v]) => (
            <div key={k} style={{ display: 'contents' }}>
              <dt>{k.replace(/_/g, ' ')}</dt>
              <dd>{String(v)}</dd>
            </div>
          ))}
        </dl>
      )}
      {arrays.map(([k, v]) => (
        <ArraySection key={k} title={k.replace(/_/g, ' ')} items={v as string[]} />
      ))}
    </div>
  );
}

// -- Main ProjectView --

export default function ProjectView() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [uploads, setUploads] = useState<UploadedFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [editBrief, setEditBrief] = useState<ManagerBrief | null>(null);

  const fetchProject = useCallback(async () => {
    if (!id) return;
    try {
      setError(null);
      const [projRes, upRes] = await Promise.all([getProject(id), getUploads(id)]);
      setProject(projRes.data);
      setUploads(upRes.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  // -- Phase 3 handlers --

  async function handleTextSave(field: string, value: string) {
    if (!id) return;
    try {
      const updated = await updateIntake(id, { [field]: value });
      setProject(prev => prev ? { ...prev, intake: updated.data } : prev);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>, category: string) {
    if (!id || !e.target.files?.length) return;
    const fd = new FormData();
    for (const file of Array.from(e.target.files)) {
      fd.append(category, file);
    }
    try {
      await uploadFiles(id, fd);
      await fetchProject();
      e.target.value = '';
    } catch (e2) {
      setError(e2 instanceof Error ? e2.message : 'Upload failed');
    }
  }

  async function handleDeleteUpload(fileId: string) {
    if (!id) return;
    try {
      await deleteUpload(id, fileId);
      setUploads(prev => prev.filter(u => u.id !== fileId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    }
  }

  async function handleHumanCheck() {
    if (!id) return;
    try {
      await approveHumanCheck(id);
      await fetchProject();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Human check approval failed');
    }
  }

  async function handleRunIntake() {
    if (!id) return;
    setRunning(true);
    try {
      await runIntake(id);
      await fetchProject();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Intake agent run failed');
    } finally {
      setRunning(false);
    }
  }

  async function handleApproveIntake() {
    if (!id) return;
    try {
      await approveIntake(id);
      await fetchProject();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Intake approval failed');
    }
  }

  // -- Phase 4 handlers --

  async function handleRunManager() {
    if (!id) return;
    setRunning(true);
    try {
      await runManagerBrief(id);
      await fetchProject();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Manager brief failed');
    } finally {
      setRunning(false);
    }
  }

  async function handleSaveBrief() {
    if (!id || !editBrief) return;
    try {
      await updateEditableBrief(id, editBrief);
      await fetchProject();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save brief failed');
    }
  }

  async function handleApproveBrief() {
    if (!id) return;
    try {
      await approveBrief(id);
      await fetchProject();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Brief approval failed');
    }
  }

  if (loading) return <p className="status-msg">Loading project...</p>;
  if (!project) return <p className="status-msg">Project not found.</p>;

  const { intake } = project;
  const hasOutputs = !!intake.meetingNotesIntake;
  const isIntakeApproved = intake.intakeApproved;
  const hasBrief = !!intake.managerBrief;
  const isBriefApproved = intake.briefApproved;
  const brief = editBrief ?? intake.editableBrief ?? intake.managerBrief;
  const hasCreator = !!intake.creatorPlan;
  const hasSpecialists = !!(intake.specialistOutputs as { textContent?: unknown })?.textContent;
  const statuses = deriveStageStatuses(project);

  return (
    <div>
      <Link to="/" className="back-link">Back to Dashboard</Link>

      {/* -- Project Header -- */}
      <div className="project-header">
        <div className="project-header-top">
          <h1>{project.name}</h1>
          <span className={`status-badge status-badge--${isIntakeApproved ? (isBriefApproved ? (intake.finalApproved ? 'approved' : 'in-progress') : 'in-progress') : (intake.humanCheckApproved ? 'needs-review' : 'not-started')}`}>
            {intake.finalApproved ? 'Complete' : intake.briefApproved ? 'In progress' : intake.intakeApproved ? 'Brief pending' : intake.humanCheckApproved ? 'Awaiting review' : 'Setup'}
          </span>
        </div>
        <div className="project-header-meta">
          {project.description && <span>{project.description}</span>}
          <span>Updated {new Date(project.updatedAt).toLocaleString()}</span>
        </div>
      </div>

      {/* -- Two-column: stage rail + content -- */}
      <div className="project-view">
        <StageRail statuses={statuses} activeKey={activeStageKey(statuses)} />

        <div className="project-content">

          {/* -- Error banner -- */}
          {error && (
            <div className="error-banner">
              <span>{error}</span>
              <button className="btn btn-sm" onClick={() => setError(null)}>Dismiss</button>
            </div>
          )}

          {/* -- Phase 3: Intake (Setup, Human Check, Run, Review) -- */}
          {!isIntakeApproved && (
            <>
              {intake.stage !== 'intake-review' && !intake.humanCheckApproved && (
                <section className="workflow-section" aria-labelledby="setup-heading">
                  <h2 id="setup-heading">Project Setup</h2>
                  <h3>Meeting Notes</h3>
                  <textarea rows={5} value={intake.meetingNotesText} onChange={e => setProject({ ...project, intake: { ...intake, meetingNotesText: e.target.value } })} onBlur={e => handleTextSave('meetingNotesText', e.currentTarget.value)} placeholder="Paste meeting notes or upload a file..." />
                  <div className="upload-row"><input type="file" multiple accept=".txt,.pdf,.docx" onChange={e => handleFileUpload(e, 'meetingNotes')} /></div>
                  <h3>Project Brief</h3>
                  <textarea rows={5} value={intake.projectBriefText ?? ''} onChange={e => setProject({ ...project, intake: { ...intake, projectBriefText: e.target.value } })} onBlur={e => handleTextSave('projectBriefText', e.currentTarget.value)} placeholder="Paste project brief or upload a file..." />
                  <div className="upload-row"><input type="file" multiple accept=".txt,.pdf,.docx" onChange={e => handleFileUpload(e, 'projectBrief')} /></div>
                  <h3>Brand Guide</h3>
                  <textarea rows={5} value={intake.brandGuideText} onChange={e => setProject({ ...project, intake: { ...intake, brandGuideText: e.target.value } })} onBlur={e => handleTextSave('brandGuideText', e.currentTarget.value)} placeholder="Paste brand guide text or upload a file..." />
                  <div className="upload-row"><input type="file" multiple accept=".txt,.pdf,.docx" onChange={e => handleFileUpload(e, 'brandGuide')} /></div>
                  <h3>Images & Assets</h3>
                  <label className="upload-label">Logo</label>
                  <div className="upload-row"><input type="file" multiple accept=".png,.jpg,.jpeg,.webp,.svg" onChange={e => handleFileUpload(e, 'logo')} /></div>
                  <label className="upload-label">Product Images</label>
                  <div className="upload-row"><input type="file" multiple accept=".png,.jpg,.jpeg,.webp" onChange={e => handleFileUpload(e, 'productImages')} /></div>
                  <label className="upload-label">Campaign Imagery</label>
                  <div className="upload-row"><input type="file" multiple accept=".png,.jpg,.jpeg,.webp" onChange={e => handleFileUpload(e, 'campaignImagery')} /></div>
                </section>
              )}

              {!intake.humanCheckApproved && (
                <section className="workflow-section" aria-labelledby="human-check-heading">
                  <h2 id="human-check-heading">Human Check</h2>
                  {uploads.length === 0 && <p className="status-msg">No files uploaded yet.</p>}
                  {uploads.length > 0 && (
                    <ul className="upload-list">{uploads.map(u => <li key={u.id}><span>{u.originalName} ({u.category}, {(u.size / 1024).toFixed(1)}KB)</span><button className="btn btn-danger btn-sm" onClick={() => handleDeleteUpload(u.id)}>Delete</button></li>)}</ul>
                  )}
                  <button className="btn btn-primary" onClick={handleHumanCheck}>Confirm and Run Intake Agents</button>
                </section>
              )}

              {intake.humanCheckApproved && !hasOutputs && (
                <section className="workflow-section" aria-labelledby="run-intake-heading">
                  <h2 id="run-intake-heading">Run Intake Agents</h2>
                  <p>Human check confirmed. Run the intake agents to process your materials.</p>
                  <button className="btn btn-primary" onClick={handleRunIntake} disabled={running}>{running ? 'Running agents...' : 'Run Intake Agents'}</button>
                </section>
              )}

              {hasOutputs && !isIntakeApproved && (
                <section className="workflow-section" aria-labelledby="review-intake-heading">
                  <h2 id="review-intake-heading">Intake Review</h2>
                  <IntakeOutputTabs
                    meetingNotesIntake={intake.meetingNotesIntake}
                    brandGuideIntake={intake.brandGuideIntake}
                    assetReview={intake.assetReview}
                    intakeSummary={intake.intakeSummary}
                  />
                  <div className="button-group">
                    <button className="btn btn-primary" onClick={handleApproveIntake}>Approve Intake Summary</button>
                  </div>
                </section>
              )}
            </>
          )}

          {/* -- Phase 4: Manager Brief -- */}
          {isIntakeApproved && (
            <section className="workflow-section" aria-labelledby="brief-heading">
              <h2 id="brief-heading">Campaign Brief</h2>
              {!hasBrief && (
                <div>
                  <p>Intake approved. Generate the campaign brief to proceed.</p>
                  <button className="btn btn-primary" onClick={handleRunManager} disabled={running}>
                    {running ? 'Generating...' : 'Generate Campaign Brief'}
                  </button>
                </div>
              )}
              {hasBrief && brief && (
                <div>
                  {!editBrief && (
                    <div>
                      <RenderBriefOutput brief={intake.editableBrief ?? intake.managerBrief!} />
                      <div className="button-group">
                        <button className="btn btn-primary" onClick={() => setEditBrief({ ...(intake.editableBrief ?? intake.managerBrief!) })}>Edit Brief</button>
                        {!isBriefApproved && <button className="btn btn-primary" onClick={handleApproveBrief}>Approve Campaign Brief</button>}
                      </div>
                    </div>
                  )}
                  {editBrief && (
                    <div>
                      <BriefEditor brief={editBrief} onChange={setEditBrief} />
                      <div className="button-group">
                        <button className="btn btn-primary" onClick={handleSaveBrief}>Save Edits</button>
                        <button className="btn" onClick={() => setEditBrief(null)}>Cancel</button>
                        {!isBriefApproved && <button className="btn btn-primary" onClick={handleApproveBrief}>Approve Campaign Brief</button>}
                      </div>
                    </div>
                  )}
                </div>
              )}
              {isBriefApproved && (
                <div className="locked-state">
                  <strong>Campaign brief approved.</strong> Ready for Creator stage.
                </div>
              )}
            </section>
          )}

          {/* -- Phase 5: Creator Stage -- */}
          {isBriefApproved && (
            <section className="workflow-section" aria-labelledby="creator-heading">
              <h2 id="creator-heading">Creator Stage</h2>
              {!hasCreator && (
                <div>
                  <p>Brief approved. Generate the production plan to continue.</p>
                  <button className="btn btn-primary" onClick={async () => { if (!id) return; setRunning(true); try { await runCreator(id); await fetchProject(); } catch (e) { setError((e as Error).message); } finally { setRunning(false); } }} disabled={running}>
                    {running ? 'Generating...' : 'Run Creator'}
                  </button>
                </div>
              )}
              {hasCreator && (
                <div className="output-block">
                  <h3>{(intake.creatorPlan as { campaign_title?: string })?.campaign_title || 'Production Plan'}</h3>
                  <dl className="output-grid">
                    <dt>Strategy</dt>
                    <dd>{(intake.creatorPlan as { production_strategy?: string })?.production_strategy || '-'}</dd>
                  </dl>
                  <ArraySection title="Content Pillars" items={((intake.creatorPlan as { content_pillar_breakdown?: { pillar: string }[] })?.content_pillar_breakdown || []).map((p: { pillar: string }) => p.pillar)} />
                  <ArraySection title="Channels" items={((intake.creatorPlan as { channel_allocation?: { channel: string }[] })?.channel_allocation || []).map((c: { channel: string }) => c.channel)} />
                  <ArraySection title="Asset Checklist" items={(intake.creatorPlan as { asset_checklist?: string[] })?.asset_checklist || []} />
                  <ArraySection title="Team Roles" items={(intake.creatorPlan as { team_roles_needed?: string[] })?.team_roles_needed || []} />
                  <ArraySection title="Approval Gates" items={(intake.creatorPlan as { approval_gates?: string[] })?.approval_gates || []} />
                  {(intake.creatorPlan as { summary?: string })?.summary && <p>{(intake.creatorPlan as { summary?: string }).summary}</p>}
                </div>
              )}
            </section>
          )}

          {/* -- Phase 5: Specialist Outputs Review -- */}
          {hasCreator && (
            <section className="workflow-section" aria-labelledby="specialists-heading">
              <h2 id="specialists-heading">Specialist Outputs</h2>
              {!hasSpecialists && (
                <div>
                  <p>Creator plan ready. Run the specialists to produce content.</p>
                  <button className="btn btn-primary" onClick={async () => { if (!id) return; setRunning(true); try { await runSpecialists(id); await fetchProject(); } catch (e) { setError((e as Error).message); } finally { setRunning(false); } }} disabled={running}>
                    {running ? 'Generating...' : 'Run Specialists'}
                  </button>
                </div>
              )}
              {hasSpecialists && (
                <div>
                  <div className="output-block">
                    <h3>Text Content</h3>
                    <ArraySection title="Headlines" items={(intake.specialistOutputs as { textContent?: { headlines?: string[] } })?.textContent?.headlines || []} />
                    <ArraySection title="Social Captions" items={(intake.specialistOutputs as { textContent?: { social_captions?: string[] } })?.textContent?.social_captions || []} />
                    <ArraySection title="Ad Copy" items={(intake.specialistOutputs as { textContent?: { ad_copy?: string[] } })?.textContent?.ad_copy || []} />
                    <ArraySection title="CTAs" items={(intake.specialistOutputs as { textContent?: { cta_suggestions?: string[] } })?.textContent?.cta_suggestions || []} />
                  </div>

                  <div className="output-block">
                    <h3>Imagery Creative</h3>
                    <dl className="output-grid">
                      <dt>Concept</dt>
                      <dd>{(intake.specialistOutputs as { imageryCreative?: { visual_concept?: string } })?.imageryCreative?.visual_concept || '-'}</dd>
                    </dl>
                    <ArraySection title="Image Prompts" items={((intake.specialistOutputs as { imageryCreative?: { image_prompts?: { format: string; prompt: string }[] } })?.imageryCreative?.image_prompts || []).map((p: { format: string; prompt: string }) => `${p.format}: ${p.prompt}`)} />
                    {intake.conceptImages && (intake.conceptImages as { id: string; label: string; prompt: string; imagePath: string }[]).length > 0 && (
                      <div className="concept-images-section">
                        <h4>Generated Concept Images</h4>
                        <div className="concept-images-grid">
                          {(intake.conceptImages as { id: string; label: string; prompt: string; imagePath: string }[]).map((ci) => (
                            <div key={ci.id} className="concept-image-card">
                              <img src={`/${ci.imagePath}`} alt={ci.label} className="concept-image-thumb" loading="lazy" />
                              <span className="concept-image-label">{ci.label}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="output-block">
                    <h3>Market Research</h3>
                    <ArraySection title="Audience Insights" items={(intake.specialistOutputs as { marketResearch?: { target_audience_insights?: string[] } })?.marketResearch?.target_audience_insights || []} />
                    <ArraySection title="Competitors" items={(intake.specialistOutputs as { marketResearch?: { competitor_analysis?: string[] } })?.marketResearch?.competitor_analysis || []} />
                    <ArraySection title="Risks" items={(intake.specialistOutputs as { marketResearch?: { risk_factors?: string[] } })?.marketResearch?.risk_factors || []} />
                    <ArraySection title="Opportunities" items={(intake.specialistOutputs as { marketResearch?: { opportunities?: string[] } })?.marketResearch?.opportunities || []} />
                  </div>
                </div>
              )}
              {hasSpecialists && (
                <div className="locked-state">
                  <strong>Specialist outputs generated.</strong> Ready for review and feedback.
                </div>
              )}
            </section>
          )}

          {/* -- Phase 6: Feedback & Revision -- */}
          {hasSpecialists && (
            <Phase6Feedback
              projectId={id!}
              intake={intake}
              onRefresh={fetchProject}
              onError={(msg: string) => setError(msg)}
              running={running}
              setRunning={setRunning}
            />
          )}

          {/* -- Phase 7: Final Assembly & Export -- */}
          {hasSpecialists && (
            <Phase7Final
              projectId={id!}
              intake={intake as unknown as { finalAssemblyStage?: string; finalAssembly?: Record<string, unknown>; finalApproved?: boolean }}
              onRefresh={fetchProject}
              onError={(msg: string) => setError(msg)}
              running={running}
              setRunning={setRunning}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// -- Brief render --

function RenderBriefOutput({ brief }: { brief: ManagerBrief }) {
  return (
    <div className="output-block">
      <h3>{brief.campaign_title}</h3>
      <dl className="output-grid">
        <dt>Client</dt><dd>{brief.client}</dd>
        <dt>Objective</dt><dd>{brief.campaign_objective}</dd>
        <dt>Business Problem</dt><dd>{brief.business_problem}</dd>
        <dt>Customer Insight</dt><dd>{brief.customer_insight}</dd>
        <dt>Target Audience</dt><dd>{brief.target_audience}</dd>
        <dt>Proposition</dt><dd>{brief.campaign_proposition}</dd>
      </dl>

      <ArraySection title="Key Messages" items={brief.key_messages} />
      <ArraySection title="Content Pillars" items={brief.content_pillars} />
      <ArraySection title="Recommended Channels" items={brief.recommended_channels} />
      <ArraySection title="Asset Requirements" items={brief.asset_requirements} />
      <ArraySection title="Brand Rules to Follow" items={brief.brand_rules_to_follow} />
      <ArraySection title="Compliance Flags" items={brief.compliance_flags} />
      <ArraySection title="Missing Information" items={filterMeaningfulMissing(brief.missing_information)} />
      <ArraySection title="Approval Checklist" items={brief.approval_checklist} />

      <h4>Campaign Brief</h4>
      <p style={{ whiteSpace: 'pre-wrap' }}>{brief.campaign_brief}</p>
    </div>
  );
}

// -- Brief editor --

function BriefEditor({ brief, onChange }: { brief: ManagerBrief; onChange: (b: ManagerBrief) => void }) {
  return (
    <div>
      <div className="brief-field-group">
        <label>Campaign title</label>
        <input type="text" value={brief.campaign_title} onChange={e => onChange({ ...brief, campaign_title: e.target.value })} />
      </div>
      <div className="brief-field-group">
        <label>Campaign brief (full)</label>
        <textarea rows={8} value={brief.campaign_brief} onChange={e => onChange({ ...brief, campaign_brief: e.target.value })} />
      </div>
      {(['key_messages', 'content_pillars', 'recommended_channels', 'asset_requirements', 'compliance_flags', 'missing_information', 'approval_checklist'] as const).map(field => (
        <div className="brief-field-group" key={field}>
          <label>{field.replace(/_/g, ' ')}</label>
          <textarea rows={3} value={brief[field].join('\n')} onChange={e => onChange({ ...brief, [field]: e.target.value.split('\n').filter(Boolean) })} />
        </div>
      ))}
      {(['campaign_objective', 'business_problem', 'customer_insight', 'target_audience', 'campaign_proposition', 'client'] as const).map(field => (
        <div className="brief-field-group" key={field}>
          <label>{field.replace(/_/g, ' ')}</label>
          <input type="text" value={brief[field]} onChange={e => onChange({ ...brief, [field]: e.target.value })} />
        </div>
      ))}
    </div>
  );
}

// -- Phase 6: Feedback & Revision component --

function Phase6Feedback({
  projectId,
  intake,
  onRefresh,
  onError,
  running,
  setRunning,
}: {
  projectId: string;
  intake: { feedbackItems?: { id: string; targetSection: string; feedback: string; createdAt: string }[]; revisionDecisions?: { id: string; targetSection: string; targetAgent: string; completedAt: string | null; strategyChanged: boolean; briefReapprovalRequired: boolean }[]; briefApproved: boolean; specialistsStage: string };
  onRefresh: () => void;
  onError: (msg: string) => void;
  running: boolean;
  setRunning: (v: boolean) => void;
}) {
  const [feedback, setFeedback] = useState('');
  const [targetSection, setTargetSection] = useState('text_content');
  const feedbackItems = intake.feedbackItems || [];
  const decisions = intake.revisionDecisions || [];
  const pendingRevision = decisions.some((d) => !d.completedAt);
  const briefNeedsReapproval = decisions.some((d) => d.briefReapprovalRequired && d.strategyChanged);

  async function handleSubmitFeedback() {
    if (!feedback.trim()) return;
    setRunning(true);
    try {
      await submitFeedback(projectId, targetSection, feedback);
      setFeedback('');
      await onRefresh();
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setRunning(false);
    }
  }

  async function handleRevise() {
    setRunning(true);
    try {
      await runRevision(projectId);
      await onRefresh();
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="workflow-section" aria-labelledby="feedback-heading">
      <h2 id="feedback-heading">Feedback & Revision</h2>

      {briefNeedsReapproval && (
        <div className="locked-state" style={{ borderColor: 'var(--color-danger)', color: 'var(--color-danger)' }}>
          <strong>Strategy-level change requested.</strong> Brief requires re-generation and re-approval.
        </div>
      )}

      {pendingRevision && !briefNeedsReapproval && (
        <div className="locked-state">
          <strong>Revision in progress.</strong> Waiting for re-runs to complete.
        </div>
      )}

      <div style={{ marginBottom: '12px' }}>
        <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.85rem', fontWeight: 500, color: 'var(--color-text-muted)' }}>Target Section</label>
        <select value={targetSection} onChange={(e) => setTargetSection(e.target.value)}>
          <option value="brief_strategy">Brief / Strategy</option>
          <option value="creator_plan">Creator Plan</option>
          <option value="text_content">Text Content</option>
          <option value="imagery_creative">Imagery Creative</option>
          <option value="market_research">Market Research</option>
        </select>
      </div>

      <div style={{ marginBottom: '12px' }}>
        <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.85rem', fontWeight: 500, color: 'var(--color-text-muted)' }}>Feedback</label>
        <textarea rows={3} value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="Describe what needs to change..." style={{ width: '100%', maxWidth: '600px' }} />
      </div>

      <div className="button-group">
        <button className="btn btn-primary" onClick={handleSubmitFeedback} disabled={running || !feedback.trim()}>
          {running ? 'Submitting...' : 'Submit Feedback'}
        </button>
        <button className="btn btn-primary" onClick={handleRevise} disabled={running || feedbackItems.length === 0}>
          {running ? 'Revising...' : 'Run Revision'}
        </button>
      </div>

      {feedbackItems.length > 0 && (
        <div style={{ marginTop: '16px' }}>
          <h4>Submitted Feedback ({feedbackItems.length})</h4>
          <ul className="feedback-list">
            {feedbackItems.map((f) => (
              <li key={f.id}>
                <strong>{f.targetSection}</strong>: {f.feedback} <small style={{ color: 'var(--color-text-soft)' }}>({new Date(f.createdAt).toLocaleTimeString()})</small>
              </li>
            ))}
          </ul>
        </div>
      )}

      {decisions.length > 0 && (
        <div style={{ marginTop: '12px' }}>
          <h4>Revision History ({decisions.length})</h4>
          <ul className="revision-list">
            {decisions.map((d) => (
              <li key={d.id}>
                <strong>{d.targetSection}</strong> {'>'} {d.targetAgent}
                {d.strategyChanged && <span style={{ color: 'var(--color-warning)' }}> strategy changed</span>}
                {d.briefReapprovalRequired && <span style={{ color: 'var(--color-danger)' }}> brief reapproval needed</span>}
                {d.completedAt ? <span style={{ color: 'var(--color-success)' }}> completed {new Date(d.completedAt).toLocaleTimeString()}</span> : <span style={{ color: 'var(--color-warning)' }}> pending</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

// -- Phase 7: Final Assembly & Export component --

function Phase7Final({
  projectId,
  intake,
  onRefresh,
  onError,
  running,
  setRunning,
}: {
  projectId: string;
  intake: { finalAssemblyStage?: string; finalAssembly?: Record<string, unknown>; finalApproved?: boolean };
  onRefresh: () => void;
  onError: (msg: string) => void;
  running: boolean;
  setRunning: (v: boolean) => void;
}) {
  const hasAssembly = intake.finalAssemblyStage === 'generated' && !!intake.finalAssembly;
  const isApproved = !!intake.finalApproved;

  async function handleRunManager() {
    setRunning(true);
    try {
      await runCampaignManager(projectId);
      await onRefresh();
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setRunning(false);
    }
  }

  async function handleApprove() {
    setRunning(true);
    try {
      await approveFinal(projectId);
      await onRefresh();
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="workflow-section" aria-labelledby="final-heading">
      <h2 id="final-heading">Final Assembly & Export</h2>

      {!hasAssembly && !isApproved && (
        <div>
          <p>Assemble the final campaign pack from all approved outputs.</p>
          <button className="btn btn-primary" onClick={handleRunManager} disabled={running}>
            {running ? 'Assembling...' : 'Run Final Assembly'}
          </button>
        </div>
      )}

          {hasAssembly && (
        <div className="output-block">
          <h3>Final Assembly Summary</h3>
          <dl className="output-grid">
            <dt>Campaign</dt><dd>{intake.finalAssembly?.campaignTitle as string}</dd>
            <dt>Client</dt><dd>{intake.finalAssembly?.client as string}</dd>
            <dt>Headlines</dt><dd>{(intake.finalAssembly?.headlines as string[])?.length || 0}</dd>
            <dt>Ad Copy Variants</dt><dd>{(intake.finalAssembly?.adCopy as string[])?.length || 0}</dd>
            <dt>Image Prompts</dt><dd>{(intake.finalAssembly?.imagePrompts as unknown[])?.length || 0}</dd>
            <dt>Concept Images</dt><dd>{(intake.finalAssembly?.conceptImages as unknown[])?.length || 0}</dd>
            <dt>Feedback Items</dt><dd>{intake.finalAssembly?.feedbackCount as number || 0}</dd>
            <dt>Revisions</dt><dd>{intake.finalAssembly?.revisionCount as number || 0}</dd>
          </dl>
        </div>
      )}

      {hasAssembly && !isApproved && (
        <div className="button-group">
          <button className="btn btn-primary" onClick={handleApprove} disabled={running}>
            {running ? 'Approving...' : 'Approve Final Assembly'}
          </button>
        </div>
      )}

      {isApproved && (
        <div>
          <div className="locked-state">
            <strong>Final assembly approved.</strong> Export ready.
          </div>
          <div className="export-actions">
            <a href={getExportUrl(projectId, 'docx')} className="btn btn-primary" target="_blank" rel="noopener noreferrer">Export DOCX</a>
            <a href={getExportUrl(projectId, 'pdf')} className="btn btn-primary" target="_blank" rel="noopener noreferrer">Export PDF</a>
          </div>
        </div>
      )}
    </section>
  );
}