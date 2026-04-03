import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import healthRoutes from './routes/healthRoutes.js';
import sessionRoutes from './routes/sessionRoutes.js';
import questionnaireRoutes from './routes/questionnaireRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import debugRoutes from './routes/debugRoutes.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Serve frontend static files
app.use(express.static(join(__dirname, '../../frontend')));

// Routes
app.use('/api/health', healthRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/questionnaires', questionnaireRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/debug', debugRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

export default app;
