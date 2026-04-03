import { Router } from 'express';
import { generateReport } from '../services/reportService.js';

const router = Router();

// GET /api/reports/:sessionId — Generate and return final session report
router.get('/:sessionId', async (req, res) => {
  try {
    const report = await generateReport(req.params.sessionId);
    res.json(report);
  } catch (err) {
    if (err.message === 'Session not found') {
      return res.status(404).json({ error: err.message });
    }
    res.status(500).json({ error: err.message });
  }
});

export default router;
