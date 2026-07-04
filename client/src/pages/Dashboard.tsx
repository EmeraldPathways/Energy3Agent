import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  listProjects,
  createProject,
  deleteProject,
  type Project,
} from '../api.js';

export default function Dashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchProjects = useCallback(async () => {
    try {
      setError(null);
      const res = await listProjects();
      setProjects(res.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      await createProject({ name: name.trim(), description: description.trim() });
      setName('');
      setDescription('');
      setShowCreate(false);
      await fetchProjects();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create project');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Delete this project?')) return;
    try {
      await deleteProject(id);
      await fetchProjects();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete project');
    }
  }

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1>Campaign Projects</h1>
        <button
          className="btn btn-primary"
          onClick={() => setShowCreate(!showCreate)}
        >
          {showCreate ? 'Cancel' : 'New Project'}
        </button>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {showCreate && (
        <form className="create-form" onSubmit={handleCreate}>
          <label>
            Project Name
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Q3 Product Launch"
              required
              maxLength={200}
            />
          </label>
          <label>
            Description (optional)
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description..."
            />
          </label>
          <button className="btn btn-primary" type="submit" disabled={submitting}>
            {submitting ? 'Creating...' : 'Create Project'}
          </button>
        </form>
      )}

      {loading && <p className="status-msg">Loading projects...</p>}

      {!loading && projects.length === 0 && !error && (
        <p className="status-msg">No projects yet. Create one to get started.</p>
      )}

      {projects.length > 0 && (
        <table className="project-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Status</th>
              <th>Updated</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((p) => (
              <tr key={p.id}>
                <td>
                  <Link to={`/projects/${p.id}`} className="project-link">
                    {p.name}
                  </Link>
                  {p.description && (
                    <span className="project-desc">{p.description}</span>
                  )}
                </td>
                <td>{p.status}</td>
                <td>{new Date(p.updatedAt).toLocaleDateString()}</td>
                <td>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => handleDelete(p.id)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}