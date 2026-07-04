import express from 'express';
import cors from 'cors';
import projectsRouter from './routes/projects.js';

const PORT = process.env.PORT ?? 3001;

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/projects', projectsRouter);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});