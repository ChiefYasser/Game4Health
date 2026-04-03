// In-memory store of active sessions and their connected sockets
// Maps sessionId -> { sensorSocket, gameSocket, calibrationData, baselineHR, lastHR, lastStress }
const activeSessions = new Map();

export const createActiveSession = (sessionId) => {
  activeSessions.set(sessionId, {
    sensorSocket: null,
    gameSocket: null,
    calibrationData: [],  // HR readings during calibration
    baselineHR: null,
    lastHR: null,
    lastStress: 0,
  });
  return activeSessions.get(sessionId);
};

export const getActiveSession = (sessionId) => {
  return activeSessions.get(sessionId);
};

export const setSocket = (sessionId, type, socket) => {
  const session = activeSessions.get(sessionId);
  if (!session) return null;
  if (type === 'sensor') session.sensorSocket = socket;
  if (type === 'game') session.gameSocket = socket;
  return session;
};

export const removeSocket = (sessionId, type) => {
  const session = activeSessions.get(sessionId);
  if (!session) return;
  if (type === 'sensor') session.sensorSocket = null;
  if (type === 'game') session.gameSocket = null;
};

export const removeActiveSession = (sessionId) => {
  activeSessions.delete(sessionId);
};

export const getAllActiveSessions = () => {
  return Array.from(activeSessions.keys());
};
