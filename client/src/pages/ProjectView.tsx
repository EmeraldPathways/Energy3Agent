import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getProject, type Project } from '../api.js';

export default function ProjectView() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProject = useCallback(async () => {
    if (!id) return;
    try {
      setError(null);
      const res = await getProject(id);
      setProject(res.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load project');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  if (loading) return <p className="status-msg">Loading project...</p>;
  if (error) return <div className="error-banner">{error}</div>;
  if (!project) return <p className="status-msg">Project not found.</p>;

  return (
    <div className="project-view">
      <Link to="/" className="back-link">&larr; Back to Dashboard</Link>
      <h1>{project.name}</h1>
      <dl className="project-meta">
        <dt>Status</dt>
        <dd>{project.status}</dd>
        <dt>Description</dt>
        <dd>{project.description || 'No description'}</dd>
        <dt>Created</dt>
        <dd>{new Date(project.createdAt).toLocaleString()}</dd>
        <dt>Updated</dt>
        <dd>{new Date(project.updatedAt).toLocaleString()}</dd>
      </dl>
      <div className="project-placeholder">
        <p>Phase 1 foundation complete. Further workflow stages will be available in later phases.</p>
      </div>
    </div>
  );
}