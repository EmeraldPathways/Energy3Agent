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
  type Project,
  type UploadedFile,
  type ManagerBrief,
} from '../api.js';

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
    const { campaign_title, campaign_brief, ...rest } = editBrief;
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
  if (error) return <div className="error-banner">{error}</div>;
  if (!project) return <p className="status-msg">Project not found.</p>;

  const { intake } = project;
  const hasOutputs = !!intake.meetingNotesIntake;
  const isIntakeApproved = intake.intakeApproved;
  const hasBrief = !!intake.managerBrief;
  const isBriefApproved = intake.briefApproved;
  const brief = editBrief ?? intake.editableBrief ?? intake.managerBrief;

  return (
    <div className="project-view">
      <Link to="/" className="back-link">&larr; Back to Dashboard</Link>
      <h1>{project.name}</h1>
      <dl className="project-meta">
        <dt>Status</dt><dd>{project.status}</dd>
        <dt>Intake Stage</dt><dd>{intake.stage || 'setup'}</dd>
        <dt>Brief Stage</dt><dd>{intake.briefStage || 'pending'}</dd>
        <dt>Description</dt><dd>{project.description || 'No description'}</dd>
        <dt>Updated</dt><dd>{new Date(project.updatedAt).toLocaleString()}</dd>
      </dl>

      {/* ── Phase 3: Intake (Setup, Human Check, Run, Review) ── */}
      {!isIntakeApproved && (
        <>
          {intake.stage !== 'intake-review' && !intake.humanCheckApproved && (
            <section className="intake-section">
              <h2>Project Setup</h2>
              <h3>Meeting Notes</h3>
              <textarea rows={6} value={intake.meetingNotesText} onChange={e => setProject({ ...project, intake: { ...intake, meetingNotesText: e.target.value } })} onBlur={() => handleTextSave('meetingNotesText', intake.meetingNotesText)} placeholder="Paste meeting notes or upload a file..." />
              <div className="upload-row"><input type="file" multiple accept=".txt,.pdf,.docx" onChange={e => handleFileUpload(e, 'meetingNotes')} /></div>
              <h3>Brand Guide</h3>
              <textarea rows={6} value={intake.brandGuideText} onChange={e => setProject({ ...project, intake: { ...intake, brandGuideText: e.target.value } })} onBlur={() => handleTextSave('brandGuideText', intake.brandGuideText)} placeholder="Paste brand guide text or upload a file..." />
              <div className="upload-row"><input type="file" multiple accept=".txt,.pdf,.docx" onChange={e => handleFileUpload(e, 'brandGuide')} /></div>
            </section>
          )}

          {!intake.humanCheckApproved && (
            <section className="intake-section">
              <h2>Human Check</h2>
              {uploads.length === 0 && <p className="status-msg">No files uploaded yet.</p>}
              {uploads.length > 0 && (
                <ul className="upload-list">{uploads.map(u => <li key={u.id}><span>{u.originalName} ({u.category}, {(u.size / 1024).toFixed(1)}KB)</span><button className="btn btn-danger btn-sm" onClick={() => handleDeleteUpload(u.id)}>Delete</button></li>)}</ul>
              )}
              <button className="btn btn-primary" onClick={handleHumanCheck}>Confirm & Run Intake Agents</button>
            </section>
          )}

          {intake.humanCheckApproved && !hasOutputs && (
            <section className="intake-section">
              <h2>Run Intake Agents</h2>
              <button className="btn btn-primary" onClick={handleRunIntake} disabled={running}>{running ? 'Running Agents...' : 'Run Intake Agents'}</button>
            </section>
          )}

          {hasOutputs && !isIntakeApproved && (
            <section className="intake-section">
              <h2>Intake Review</h2>
              {intake.meetingNotesIntake && <RenderJsonOutput title="Meeting Notes Intake" data={intake.meetingNotesIntake} />}
              {intake.brandGuideIntake && <RenderJsonOutput title="Brand Guide Intake" data={intake.brandGuideIntake} />}
              {intake.assetReview && <RenderJsonOutput title="Asset Review" data={intake.assetReview} />}
              {intake.intakeSummary && <RenderJsonOutput title="Intake Summary" data={intake.intakeSummary} />}
              <button className="btn btn-primary" onClick={handleApproveIntake}>Approve Intake Summary</button>
            </section>
          )}
        </>
      )}

      {/* ── Phase 4: Manager Brief ── */}
      {isIntakeApproved && (
        <section className="intake-section">
          <h2>Campaign Brief</h2>
          {!hasBrief && (
            <div>
              <p>Intake approved. Generate the campaign brief to proceed.</p>
              <button className="btn btn-primary" onClick={handleRunManager} disabled={running}>
                {running ? 'Generating...' : 'Generate Manager Brief'}
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
            <p className="status-msg">✅ Campaign Brief approved — ready for Creator stage.</p>
          )}
        </section>
      )}
    </div>
  );
}

function RenderJsonOutput({ title, data }: { title: string; data: Record<string, unknown> }) {
  return (
    <div className="intake-output">
      <h3>{title}</h3>
      <dl>
        {Object.entries(data).map(([k, v]) => (
          <div key={k}><dt>{k.replace(/_/g, ' ')}</dt><dd>{Array.isArray(v) ? (v as string[]).join(', ') : String(v)}</dd></div>
        ))}
      </dl>
    </div>
  );
}

function RenderBriefOutput({ brief }: { brief: ManagerBrief }) {
  return (
    <div className="intake-output">
      <h3>{brief.campaign_title}</h3>
      <p><strong>Client:</strong> {brief.client}</p>
      <p><strong>Objective:</strong> {brief.campaign_objective}</p>
      <p><strong>Business Problem:</strong> {brief.business_problem}</p>
      <p><strong>Customer Insight:</strong> {brief.customer_insight}</p>
      <p><strong>Target Audience:</strong> {brief.target_audience}</p>
      <p><strong>Proposition:</strong> {brief.campaign_proposition}</p>

      <ArraySection title="Key Messages" items={brief.key_messages} />
      <ArraySection title="Content Pillars" items={brief.content_pillars} />
      <ArraySection title="Recommended Channels" items={brief.recommended_channels} />
      <ArraySection title="Asset Requirements" items={brief.asset_requirements} />
      <ArraySection title="Brand Rules to Follow" items={brief.brand_rules_to_follow} />
      <ArraySection title="Compliance Flags" items={brief.compliance_flags} highlight />
      <ArraySection title="Missing Information" items={brief.missing_information} highlight />
      <ArraySection title="Approval Checklist" items={brief.approval_checklist} />

      <h4>Campaign Brief</h4>
      <p style={{ whiteSpace: 'pre-wrap' }}>{brief.campaign_brief}</p>
    </div>
  );
}

function ArraySection({ title, items, highlight }: { title: string; items: string[]; highlight?: boolean }) {
  if (!items || items.length === 0) return null;
  return (
    <div style={{ marginBottom: '0.75rem' }}>
      <strong>{title}:</strong>
      <ul className={highlight ? 'highlight-list' : ''}>
        {items.map((item, i) => <li key={i} style={highlight ? { color: '#b91c1c' } : {}}>{item}</li>)}
      </ul>
    </div>
  );
}

function BriefEditor({ brief, onChange }: { brief: ManagerBrief; onChange: (b: ManagerBrief) => void }) {
  return (
    <div>
      <label>Campaign Title<br /><input type="text" value={brief.campaign_title} onChange={e => onChange({ ...brief, campaign_title: e.target.value })} /></label>
      <label>Campaign Brief (full)<br /><textarea rows={10} value={brief.campaign_brief} onChange={e => onChange({ ...brief, campaign_brief: e.target.value })} /></label>
      {(['key_messages', 'content_pillars', 'recommended_channels', 'asset_requirements', 'compliance_flags', 'missing_information', 'approval_checklist'] as const).map(field => (
        <label key={field}>{field.replace(/_/g, ' ')}<br /><textarea rows={4} value={brief[field].join('\n')} onChange={e => onChange({ ...brief, [field]: e.target.value.split('\n').filter(Boolean) })} /></label>
      ))}
      {(['campaign_objective', 'business_problem', 'customer_insight', 'target_audience', 'campaign_proposition', 'client'] as const).map(field => (
        <label key={field}>{field.replace(/_/g, ' ')}<br /><input type="text" value={brief[field]} onChange={e => onChange({ ...brief, [field]: e.target.value })} /></label>
      ))}
    </div>
  );
}