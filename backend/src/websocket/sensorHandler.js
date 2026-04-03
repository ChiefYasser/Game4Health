import Session from '../models/Session.js';
import ECGReading from '../models/ECGReading.js';
import { getActiveSession, setSocket, removeSocket } from '../services/sessionManager.js';
import { addCalibrationReading, computeStress, stressToDifficulty } from '../services/stressService.js';
import { getIO } from './index.js';

export const handleSensorConnection = (socket) => {
  console.log(`Sensor connected: ${socket.id}`);
  let sessionId = null;

  // Sensor joins a session room
  socket.on('join-session', async (data) => {
    sessionId = data.sessionId;
    const active = getActiveSession(sessionId);
    if (!active) {
      socket.emit('error', { message: 'Session not found. Create a session first via REST API.' });
      return;
    }

    socket.join(sessionId);
    setSocket(sessionId, 'sensor', socket);
    socket.emit('joined', { sessionId, message: 'Sensor joined session' });
    console.log(`Sensor ${socket.id} joined session ${sessionId}`);
  });

  // Receive ECG data from sensor
  socket.on('ecg-data', async (data) => {
    if (!sessionId) {
      socket.emit('error', { message: 'Join a session first' });
      return;
    }

    const { heartRate, rawValue } = data;
    if (!heartRate) {
      socket.emit('error', { message: 'heartRate is required' });
      return;
    }

    try {
      const session = await Session.findById(sessionId);
      if (!session) return;

      let phase = session.status === 'calibrating' ? 'calibration' : 'active';
      let stressScore = 0;

      // Calibration phase
      if (phase === 'calibration') {
        const baselineHR = addCalibrationReading(sessionId, heartRate);
        if (baselineHR) {
          session.baselineHR = baselineHR;
          session.status = 'active';
          session.startedAt = new Date();
          await session.save();

          socket.emit('calibration-complete', { baselineHR });

          // Notify game that calibration is done
          const io = getIO();
          io.of('/game').to(sessionId).emit('calibration-complete', { baselineHR });

          phase = 'active';
        } else {
          const active = getActiveSession(sessionId);
          socket.emit('calibration-progress', {
            readings: active.calibrationData.length,
            needed: 10,
          });
        }
      }

      // Active phase — compute stress
      if (phase === 'active' && session.baselineHR) {
        stressScore = computeStress(sessionId, heartRate);
        session.currentStress = stressScore;
        await session.save();

        // Send stress update to game
        const io = getIO();
        const stressUpdate = {
          sessionId,
          heartRate,
          stressScore,
          difficulty: stressToDifficulty(stressScore),
          timestamp: new Date().toISOString(),
        };

        io.of('/game').to(sessionId).emit('stress-update', stressUpdate);
        socket.emit('stress-update', stressUpdate); // Echo back to sensor too
      }

      // Save reading to DB
      await ECGReading.create({
        sessionId,
        heartRate,
        rawValue: rawValue || null,
        stressScore,
        phase,
      });
    } catch (err) {
      console.error('ECG processing error:', err.message);
      socket.emit('error', { message: 'Failed to process ECG data' });
    }
  });

  socket.on('disconnect', () => {
    if (sessionId) removeSocket(sessionId, 'sensor');
    console.log(`Sensor disconnected: ${socket.id}`);
  });
};
