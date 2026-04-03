import mqtt from 'mqtt';
import env from '../config/env.js';
import Session from '../models/Session.js';
import ECGReading from '../models/ECGReading.js';
import { getActiveSession, createActiveSession } from '../services/sessionManager.js';
import { addCalibrationReading, computeStress, stressToDifficulty } from '../services/stressService.js';
import { getIO } from '../websocket/index.js';

let client;

/**
 * MQTT Topic structure:
 *   {prefix}/sensor/{sessionId}/ecg    — sensor publishes HR data here
 *   {prefix}/sensor/{sessionId}/status — sensor publishes connect/disconnect
 *
 * Expected payload on ecg topic (JSON):
 *   { "heartRate": 75, "rawValue": 512 }
 */
export const initMQTT = () => {
  client = mqtt.connect(env.MQTT_BROKER_URL);

  client.on('connect', () => {
    console.log(`MQTT connected to ${env.MQTT_BROKER_URL}`);
    // Subscribe to all sensor ECG topics
    const topic = `${env.MQTT_TOPIC_PREFIX}/sensor/+/ecg`;
    client.subscribe(topic, (err) => {
      if (err) console.error('MQTT subscribe error:', err.message);
      else console.log(`MQTT subscribed to: ${topic}`);
    });
  });

  client.on('message', async (topic, message) => {
    try {
      // Parse topic: ihealthpass/sensor/{sessionId}/ecg
      const parts = topic.split('/');
      const sessionId = parts[2];
      const channel = parts[3];

      if (channel !== 'ecg') return;

      const data = JSON.parse(message.toString());
      const { heartRate, rawValue } = data;

      if (!heartRate) return;

      await processECGReading(sessionId, heartRate, rawValue);
    } catch (err) {
      console.error('MQTT message processing error:', err.message);
    }
  });

  client.on('error', (err) => {
    console.error('MQTT connection error:', err.message);
  });

  client.on('offline', () => {
    console.log('MQTT client offline');
  });

  return client;
};

/**
 * Process an ECG reading from MQTT — same logic as WebSocket sensor handler
 */
const processECGReading = async (sessionId, heartRate, rawValue) => {
  const session = await Session.findById(sessionId);
  if (!session) return;

  // Ensure session is tracked in memory
  if (!getActiveSession(sessionId)) {
    createActiveSession(sessionId);
  }

  let phase = session.status === 'calibrating' ? 'calibration' : 'active';
  let stressScore = 0;

  if (phase === 'calibration') {
    const baselineHR = addCalibrationReading(sessionId, heartRate);
    if (baselineHR) {
      session.baselineHR = baselineHR;
      session.status = 'active';
      session.startedAt = new Date();
      await session.save();

      // Notify via Socket.io
      try {
        const io = getIO();
        io.of('/sensor').to(sessionId).emit('calibration-complete', { baselineHR });
        io.of('/game').to(sessionId).emit('calibration-complete', { baselineHR });
        io.of('/dashboard').to(sessionId).emit('calibration-complete', { baselineHR });
      } catch (e) { /* no clients connected */ }

      phase = 'active';
    } else {
      const active = getActiveSession(sessionId);
      try {
        const io = getIO();
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

    const stressUpdate = {
      sessionId,
      heartRate,
      stressScore,
      difficulty: stressToDifficulty(stressScore),
      timestamp: new Date().toISOString(),
    };

    // Broadcast to all namespaces
    try {
      const io = getIO();
      io.of('/game').to(sessionId).emit('stress-update', stressUpdate);
      io.of('/sensor').to(sessionId).emit('stress-update', stressUpdate);
      io.of('/dashboard').to(sessionId).emit('stress-update', stressUpdate);
    } catch (e) { /* no clients */ }
  }

  // Save reading to DB
  await ECGReading.create({
    sessionId,
    heartRate,
    rawValue: rawValue || null,
    stressScore,
    phase,
  });
};

export const getMQTTClient = () => client;
