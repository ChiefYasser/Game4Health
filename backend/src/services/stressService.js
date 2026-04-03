import { getActiveSession } from './sessionManager.js';

const CALIBRATION_READINGS_NEEDED = 10;

/**
 * Add a calibration reading and return baseline when ready.
 * Baseline = average HR during the calm calibration phase.
 */
export const addCalibrationReading = (sessionId, heartRate) => {
  const session = getActiveSession(sessionId);
  if (!session) return null;

  session.calibrationData.push(heartRate);

  if (session.calibrationData.length >= CALIBRATION_READINGS_NEEDED) {
    const sum = session.calibrationData.reduce((a, b) => a + b, 0);
    session.baselineHR = Math.round(sum / session.calibrationData.length);
    return session.baselineHR;
  }

  return null; // Not enough readings yet
};

/**
 * Compute stress score (0-100) based on how far current HR deviates from baseline.
 *
 * Logic:
 * - If HR is at or below baseline → stress = 0
 * - For every BPM above baseline, stress increases
 * - 30+ BPM above baseline = max stress (100)
 * - Uses a simple linear scale, clamped to 0-100
 */
export const computeStress = (sessionId, currentHR) => {
  const session = getActiveSession(sessionId);
  if (!session || !session.baselineHR) return 0;

  const deviation = currentHR - session.baselineHR;

  if (deviation <= 0) return 0;

  // Linear scale: 30 BPM above baseline = 100% stress
  const MAX_DEVIATION = 30;
  const stress = Math.min(100, Math.round((deviation / MAX_DEVIATION) * 100));

  session.lastHR = currentHR;
  session.lastStress = stress;

  return stress;
};

/**
 * Map stress score to a game difficulty suggestion
 */
export const stressToDifficulty = (stress) => {
  if (stress < 30) return 'easy';
  if (stress < 65) return 'medium';
  return 'hard';
};

export { CALIBRATION_READINGS_NEEDED };
