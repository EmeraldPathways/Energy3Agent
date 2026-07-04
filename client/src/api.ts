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
  createdAt: string;
  updatedAt: string;
}

export function listProjects(): Promise<{ data: Project[] }> {
  return request('/projects');
}

export function createProject(input: { name: string; description?: string }): Promise<{ data: Project }> {
  return request('/projects', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function getProject(id: string): Promise<{ data: Project }> {
  return request(`/projects/${id}`);
}

export function deleteProject(id: string): Promise<void> {
  return request(`/projects/${id}`, { method: 'DELETE' });
}