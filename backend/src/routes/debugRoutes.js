import { Router } from 'express';
import Session from '../models/Session.js';
import ECGReading from '../models/ECGReading.js';
import GameEvent from '../models/GameEvent.js';
import { getActiveSession } from '../services/sessionManager.js';
import { addCalibrationReading, computeStress } from '../services/stressService.js';
import { getIO } from '../websocket/index.js';

const router = Router();

// POST /api/debug/simulate-sensor — Simulate an ECG sensor reading
router.post('/simulate-sensor', async (req, res) => {
  try {
    const { sessionId, heartRate, rawValue } = req.body;

    if (!sessionId || !heartRate) {
      return res.status(400).json({ error: 'sessionId and heartRate are required' });
    }

    const session = await Session.findById(sessionId);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    let phase = session.status === 'calibrating' ? 'calibration' : 'active';
    let stressScore = 0;
    let baselineHR = null;

    if (phase === 'calibration') {
      baselineHR = addCalibrationReading(sessionId, heartRate);
      if (baselineHR) {
        // Calibration complete — transition to active
        session.baselineHR = baselineHR;
        session.status = 'active';
        session.startedAt = new Date();
        await session.save();
        phase = 'active';

        try {
          const io = getIO();
          io.of('/dashboard').to(sessionId).emit('calibration-complete', { baselineHR });
          io.of('/game').to(sessionId).emit('calibration-complete', { baselineHR });
        } catch (e) { /* no clients */ }
      } else {
        try {
          const io = getIO();
          const active = getActiveSession(sessionId);
          io.of('/dashboard').to(sessionId).emit('calibration-progress', {
            readings: active.calibrationData.length,
            needed: 10,
          });
        } catch (e) { /* no clients */ }
      }
    }

    if (phase === 'active' && session.baselineHR) {
      stressScore = computeStress(sessionId, heartRate);
      session.currentStress = stressScore;
      await session.save();

      // Broadcast stress update to the game namespace
      try {
        const io = getIO();
        const stressUpdate = {
          sessionId,
          heartRate,
          stressScore,
          difficulty: stressScore < 30 ? 'easy' : stressScore < 65 ? 'medium' : 'hard',
          timestamp: new Date().toISOString(),
        };
        io.of('/game').to(sessionId).emit('stress-update', stressUpdate);
        io.of('/dashboard').to(sessionId).emit('stress-update', stressUpdate);
      } catch (e) { /* no clients connected */ }
    }

    // Save reading
    const reading = await ECGReading.create({
      sessionId,
      heartRate,
      rawValue: rawValue || null,
      stressScore,
      phase,
    });

    res.json({
      message: 'Simulated sensor reading saved',
      reading,
      baselineHR: baselineHR || session.baselineHR,
      stressScore,
      sessionStatus: session.status,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/debug/simulate-game-event — Simulate a game event
router.post('/simulate-game-event', async (req, res) => {
  try {
    const { sessionId, eventType, data } = req.body;

    if (!sessionId || !eventType) {
      return res.status(400).json({ error: 'sessionId and eventType are required' });
    }

    const session = await Session.findById(sessionId);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const activeSession = getActiveSession(sessionId);

    const event = await GameEvent.create({
      sessionId,
      eventType,
      data: data || {},
      heartRateAtEvent: activeSession?.lastHR || null,
      stressAtEvent: activeSession?.lastStress || null,
    });

    // Notify dashboard
    try {
      const io = getIO();
      io.of('/dashboard').to(sessionId).emit('game-event', {
        eventType,
        data: data || {},
        heartRateAtEvent: activeSession?.lastHR || null,
        stressAtEvent: activeSession?.lastStress || null,
        timestamp: new Date().toISOString(),
      });
    } catch (e) { /* no clients */ }

    res.json({ message: 'Simulated game event saved', event });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/debug/start-calibration — Quick helper to set session to calibrating
router.post('/start-calibration', async (req, res) => {
  try {
    const { sessionId } = req.body;
    const session = await Session.findById(sessionId);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    session.status = 'calibrating';
    await session.save();
    res.json({ message: 'Session set to calibrating', sessionId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
