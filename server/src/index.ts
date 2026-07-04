import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import projectsRouter from './routes/projects.js';
import intakeRouter from './routes/intake.js';
import briefRouter from './routes/brief.js';
import phase5Router from './routes/phase5.js';
import phase6Router from './routes/phase6.js';
import phase7Router from './routes/phase7.js';
import geminiSmokeRouter from './routes/gemini-smoke.js';

const PORT = process.env.PORT ?? 3001;

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/projects', projectsRouter);
app.use('/api/projects', intakeRouter);
app.use('/api/projects', briefRouter);
app.use('/api/projects', phase5Router);
app.use('/api/projects', phase6Router);
app.use('/api/projects', phase7Router);
app.use('/api/gemini-smoke', geminiSmokeRouter);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});