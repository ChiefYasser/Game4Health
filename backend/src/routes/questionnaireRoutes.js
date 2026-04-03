import { Router } from 'express';
import Questionnaire from '../models/Questionnaire.js';
import Session from '../models/Session.js';

const router = Router();

// POST /api/questionnaires/:sessionId — Save pre-session questionnaire
router.post('/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { age, gender, priorGamingExperience, currentMood, phobiaLevel, notes } = req.body;

    // Validate session exists
    const session = await Session.findById(sessionId);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    // Check for existing questionnaire
    const existing = await Questionnaire.findOne({ sessionId });
    if (existing) return res.status(400).json({ error: 'Questionnaire already submitted for this session' });

    if (!age || !gender) {
      return res.status(400).json({ error: 'age and gender are required' });
    }

    const questionnaire = await Questionnaire.create({
      sessionId,
      age,
      gender,
      priorGamingExperience,
      currentMood,
      phobiaLevel,
      notes,
    });

    res.status(201).json({ message: 'Questionnaire saved', questionnaire });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
