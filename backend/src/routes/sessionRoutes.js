import { Router } from 'express';
import Session from '../models/Session.js';
import { createActiveSession } from '../services/sessionManager.js';

const router = Router();

// POST /api/sessions — Create a new gameplay session
router.post('/', async (req, res) => {
  try {
    const { playerName, difficulty } = req.body;

    const session = await Session.create({
      playerName: playerName || 'Anonymous',
      difficulty: difficulty || 'medium',
    });

    // Register in memory for WebSocket tracking
    createActiveSession(session._id.toString());

    res.status(201).json({
      message: 'Session created',
      sessionId: session._id,
      status: session.status,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/sessions/:id — Get session details
router.get('/:id', async (req, res) => {
  try {
    const session = await Session.findById(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    res.json(session);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
