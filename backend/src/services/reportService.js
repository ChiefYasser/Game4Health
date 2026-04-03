import { GoogleGenerativeAI } from '@google/generative-ai';
import env from '../config/env.js';
import Session from '../models/Session.js';
import ECGReading from '../models/ECGReading.js';
import GameEvent from '../models/GameEvent.js';
import Questionnaire from '../models/Questionnaire.js';

/**
 * Generate a final session report with stats and AI insight
 */
export const generateReport = async (sessionId) => {
  const session = await Session.findById(sessionId);
  if (!session) throw new Error('Session not found');

  const readings = await ECGReading.find({ sessionId }).sort('timestamp');
  const events = await GameEvent.find({ sessionId }).sort('timestamp');
  const questionnaire = await Questionnaire.findOne({ sessionId });

  // Compute summary stats
  const heartRates = readings.map(r => r.heartRate);
  const stressScores = readings.filter(r => r.phase === 'active').map(r => r.stressScore);

  const summary = {
    avgHeartRate: heartRates.length ? Math.round(heartRates.reduce((a, b) => a + b, 0) / heartRates.length) : null,
    maxHeartRate: heartRates.length ? Math.max(...heartRates) : null,
    minHeartRate: heartRates.length ? Math.min(...heartRates) : null,
    avgStress: stressScores.length ? Math.round(stressScores.reduce((a, b) => a + b, 0) / stressScores.length) : null,
    maxStress: stressScores.length ? Math.max(...stressScores) : null,
    totalReadings: readings.length,
    totalGameEvents: events.length,
    durationSeconds: session.startedAt && session.completedAt
      ? Math.round((session.completedAt - session.startedAt) / 1000)
      : null,
  };

  // Update session with summary
  session.summary = summary;
  session.status = 'completed';
  session.completedAt = session.completedAt || new Date();

  // Generate AI insight
  try {
    session.aiInsight = await generateAIInsight(summary, events, questionnaire);
  } catch (err) {
    console.error('Gemini AI insight failed:', err.message);
    session.aiInsight = generateFallbackInsight(summary, questionnaire);
  }

  await session.save();

  return {
    session,
    questionnaire,
    summary,
    aiInsight: session.aiInsight,
    readingsCount: readings.length,
    eventsCount: events.length,
    events: events.map(e => ({
      eventType: e.eventType,
      data: e.data,
      heartRateAtEvent: e.heartRateAtEvent,
      stressAtEvent: e.stressAtEvent,
      timestamp: e.timestamp,
    })),
  };
};

/**
 * Call Gemini to generate a human-readable insight from session data
 */
const generateAIInsight = async (summary, events, questionnaire) => {
  if (!env.GEMINI_API_KEY) return 'Gemini API key not configured.';

  const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' });

  const eventSummary = events.map(e =>
    `${e.eventType} (HR: ${e.heartRateAtEvent}, Stress: ${e.stressAtEvent})`
  ).join(', ');

  const prompt = `You are a health analytics assistant for a VR phobia therapy game called NeuroPhobia VR.
A patient just completed a session. Analyze their data and provide a brief, supportive insight (3-4 sentences).

Patient info: ${questionnaire ? `Age ${questionnaire.age}, ${questionnaire.gender}, phobia level ${questionnaire.phobiaLevel}/10, mood before: ${questionnaire.currentMood}` : 'Not provided'}

Session stats:
- Average heart rate: ${summary.avgHeartRate} BPM
- Max heart rate: ${summary.maxHeartRate} BPM
- Min heart rate: ${summary.minHeartRate} BPM
- Average stress: ${summary.avgStress}%
- Max stress: ${summary.maxStress}%
- Duration: ${summary.durationSeconds} seconds
- Total readings: ${summary.totalReadings}
- Game events: ${eventSummary || 'None recorded'}

Provide a supportive, clinical-style insight about the player's stress response and phobia management during the session.`;

  const result = await model.generateContent(prompt);
  return result.response.text();
};

/**
 * Generate a realistic fallback insight when Gemini is unavailable (demo-safe)
 */
const generateFallbackInsight = (summary, questionnaire) => {
  const stress = summary.avgStress ?? 0;
  const maxStress = summary.maxStress ?? 0;
  const avgHR = summary.avgHeartRate ?? 0;
  const phobia = questionnaire?.phobiaLevel ?? 5;

  let stressDesc, recoveryDesc, recommendation;

  if (stress < 30) {
    stressDesc = 'maintained a calm physiological state throughout most of the session';
    recoveryDesc = 'Their stress recovery pattern indicates strong emotional regulation';
  } else if (stress < 60) {
    stressDesc = 'experienced moderate stress responses during key game events';
    recoveryDesc = 'Their ability to return to baseline after stress peaks shows promising resilience';
  } else {
    stressDesc = 'showed significant physiological arousal during high-intensity game moments';
    recoveryDesc = 'While peak stress was elevated, the overall pattern suggests the participant engaged actively with the exposure';
  }

  if (phobia >= 7) {
    recommendation = 'Given their self-reported phobia level, this level of engagement represents meaningful progress in exposure therapy.';
  } else {
    recommendation = 'Continued sessions at gradually increasing difficulty levels are recommended to build further resilience.';
  }

  return `The participant ${stressDesc}, with an average heart rate of ${avgHR} BPM and peak stress reaching ${maxStress}%. ${recoveryDesc}. ${recommendation}`;
};
