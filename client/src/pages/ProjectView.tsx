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
  type Project,
  type UploadedFile,
  type IntakeData,
} from '../api.js';

export default function ProjectView() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [uploads, setUploads] = useState<UploadedFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [saving, setSaving] = useState(false);

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

  async function handleTextSave(field: keyof IntakeData, value: string) {
    if (!id) return;
    setSaving(true);
    try {
      const updated = await updateIntake(id, { [field]: value });
      setProject(prev => prev ? { ...prev, intake: updated.data } : prev);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
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

  if (loading) return <p className="status-msg">Loading project...</p>;
  if (error) return <div className="error-banner">{error}</div>;
  if (!project) return <p className="status-msg">Project not found.</p>;

  const { intake } = project;
  const isSetup = intake.stage === 'setup' || intake.stage === 'human-check' || !intake.humanCheckApproved;
  const isReview = intake.humanCheckApproved;
  const hasOutputs = !!intake.meetingNotesIntake;
  const isIntakeApproved = intake.intakeApproved;

  return (
    <div className="project-view">
      <Link to="/" className="back-link">&larr; Back to Dashboard</Link>
      <h1>{project.name}</h1>
      <dl className="project-meta">
        <dt>Status</dt><dd>{project.status}</dd>
        <dt>Stage</dt><dd>{intake.stage || 'setup'}</dd>
        <dt>Description</dt><dd>{project.description || 'No description'}</dd>
        <dt>Updated</dt><dd>{new Date(project.updatedAt).toLocaleString()}</dd>
      </dl>

      {/* ── Setup: text areas + file uploads ── */}
      {isSetup && (
        <section className="intake-section">
          <h2>Project Setup</h2>
          <h3>Meeting Notes</h3>
          <textarea
            rows={6}
            value={intake.meetingNotesText}
            onChange={e => setProject({ ...project, intake: { ...intake, meetingNotesText: e.target.value } })}
            onBlur={() => handleTextSave('meetingNotesText', intake.meetingNotesText)}
            placeholder="Paste meeting notes or upload a file..."
          />
          <div className="upload-row">
            <input type="file" multiple accept=".txt,.pdf,.docx" onChange={e => handleFileUpload(e, 'meetingNotes')} />
          </div>

          <h3>Brand Guide</h3>
          <textarea
            rows={6}
            value={intake.brandGuideText}
            onChange={e => setProject({ ...project, intake: { ...intake, brandGuideText: e.target.value } })}
            onBlur={() => handleTextSave('brandGuideText', intake.brandGuideText)}
            placeholder="Paste brand guide text or upload a file..."
          />
          <div className="upload-row">
            <input type="file" multiple accept=".txt,.pdf,.docx" onChange={e => handleFileUpload(e, 'brandGuide')} />
          </div>

          <h3>Image Assets</h3>
          <div className="upload-row">
            <label>Logo <input type="file" accept=".png,.jpg,.jpeg,.webp,.svg" onChange={e => handleFileUpload(e, 'logo')} /></label>
            <label>Product Images <input type="file" multiple accept=".png,.jpg,.jpeg,.webp,.svg" onChange={e => handleFileUpload(e, 'productImages')} /></label>
            <label>Campaign Imagery <input type="file" multiple accept=".png,.jpg,.jpeg,.webp,.svg" onChange={e => handleFileUpload(e, 'campaignImagery')} /></label>
          </div>

          <h3>Project Notes</h3>
          <textarea
            rows={4}
            value={intake.projectNotes}
            onChange={e => setProject({ ...project, intake: { ...intake, projectNotes: e.target.value } })}
            onBlur={() => handleTextSave('projectNotes', intake.projectNotes)}
            placeholder="Any additional notes or context..."
          />
        </section>
      )}

      {/* ── Human Check: review uploads before running intake ── */}
      {!intake.humanCheckApproved && (
        <section className="intake-section">
          <h2>Human Check</h2>
          <p>Review the uploaded files before running the intake agents.</p>
          {uploads.length === 0 && <p className="status-msg">No files uploaded yet.</p>}
          {uploads.length > 0 && (
            <ul className="upload-list">
              {uploads.map(u => (
                <li key={u.id}>
                  <span>{u.originalName} ({u.category}, {(u.size / 1024).toFixed(1)}KB)</span>
                  <button className="btn btn-danger btn-sm" onClick={() => handleDeleteUpload(u.id)}>Delete</button>
                </li>
              ))}
            </ul>
          )}
          <button className="btn btn-primary" onClick={handleHumanCheck}>Confirm & Run Intake Agents</button>
        </section>
      )}

      {/* ── Run Intake: shown after human check, before outputs exist ── */}
      {intake.humanCheckApproved && !hasOutputs && (
        <section className="intake-section">
          <h2>Run Intake Agents</h2>
          <p>Human check approved. Run the intake agents to analyze your inputs.</p>
          <button className="btn btn-primary" onClick={handleRunIntake} disabled={running}>
            {running ? 'Running Agents...' : 'Run Intake Agents'}
          </button>
        </section>
      )}

      {/* ── Intake Review: outputs + approve ── */}
      {hasOutputs && (
        <section className="intake-section">
          <h2>Intake Review</h2>
          {intake.meetingNotesIntake && (
            <RenderIntakeOutput title="Meeting Notes Intake" data={intake.meetingNotesIntake as Record<string, unknown>} />
          )}
          {intake.brandGuideIntake && (
            <RenderIntakeOutput title="Brand Guide Intake" data={intake.brandGuideIntake as Record<string, unknown>} />
          )}
          {intake.assetReview && (
            <RenderIntakeOutput title="Asset Review" data={intake.assetReview as Record<string, unknown>} />
          )}
          {intake.intakeSummary && (
            <RenderIntakeOutput title="Intake Summary" data={intake.intakeSummary as Record<string, unknown>} />
          )}
          <div className="button-group">
            {!isIntakeApproved && (
              <button className="btn btn-primary" onClick={handleApproveIntake}>
                Approve Intake Summary
              </button>
            )}
            {isIntakeApproved && (
              <p className="status-msg">✅ Intake approved — ready for next phase.</p>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

function RenderIntakeOutput({ title, data }: { title: string; data: Record<string, unknown> | null }) {
  if (!data) return null;
  return (
    <div className="intake-output">
      <h3>{title}</h3>
      {Array.isArray((data as { assets?: unknown[] }).assets) ? (
        <div>
          <dl>
            {Object.entries(data).filter(([k]) => k !== 'assets').map(([k, v]) => (
              <div key={k}><dt>{k.replace(/_/g, ' ')}</dt><dd>{Array.isArray(v) ? (v as string[]).join(', ') : String(v)}</dd></div>
            ))}
          </dl>
          <h4>Assets</h4>
          {((data as { assets: Record<string, unknown>[] }).assets).map((a, i) => (
            <dl key={i} className="asset-dl">
              {Object.entries(a).map(([k, v]) => (
                <div key={k}><dt>{k.replace(/_/g, ' ')}</dt><dd>{Array.isArray(v) ? (v as string[]).join(', ') : String(v)}</dd></div>
              ))}
            </dl>
          ))}
        </div>
      ) : (
        <dl>
          {Object.entries(data).map(([key, value]) => (
            <div key={key}>
              <dt>{key.replace(/_/g, ' ')}</dt>
              <dd>{Array.isArray(value) ? (value as string[]).join(', ') : String(value)}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}