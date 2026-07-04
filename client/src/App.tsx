import { Routes, Route } from 'react-router-dom';
import Dashboard from './pages/Dashboard.js';
import ProjectView from './pages/ProjectView.js';
import Layout from './components/Layout.js';

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/projects/:id" element={<ProjectView />} />
      </Routes>
    </Layout>
  );
}