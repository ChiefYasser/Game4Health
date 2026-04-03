import Session from '../models/Session.js';
import GameEvent from '../models/GameEvent.js';
import { getActiveSession, setSocket, removeSocket } from '../services/sessionManager.js';
import { generateReport } from '../services/reportService.js';

export const handleGameConnection = (socket) => {
  console.log(`Game connected: ${socket.id}`);
  let sessionId = null;

  // Game joins a session room
  socket.on('join-session', async (data) => {
    sessionId = data.sessionId;
    const active = getActiveSession(sessionId);
    if (!active) {
      socket.emit('error', { message: 'Session not found. Create a session first via REST API.' });
      return;
    }

    socket.join(sessionId);
    setSocket(sessionId, 'game', socket);
    socket.emit('joined', { sessionId, message: 'Game joined session' });
    console.log(`Game ${socket.id} joined session ${sessionId}`);
  });

  // Receive game events (markers)
  socket.on('game-event', async (data) => {
    if (!sessionId) {
      socket.emit('error', { message: 'Join a session first' });
      return;
    }

    const { eventType, data: eventData } = data;
    if (!eventType) {
      socket.emit('error', { message: 'eventType is required' });
      return;
    }

    try {
      const active = getActiveSession(sessionId);

      const event = await GameEvent.create({
        sessionId,
        eventType,
        data: eventData || {},
        heartRateAtEvent: active?.lastHR || null,
        stressAtEvent: active?.lastStress || null,
      });

      socket.emit('event-saved', { eventType, eventId: event._id });
      console.log(`Game event: ${eventType} for session ${sessionId}`);
    } catch (err) {
      console.error('Game event error:', err.message);
      socket.emit('error', { message: 'Failed to save game event' });
    }
  });

  // Game requests session end
  socket.on('end-session', async () => {
    if (!sessionId) return;

    try {
      const session = await Session.findById(sessionId);
      if (session) {
        session.completedAt = new Date();
        session.status = 'completed';
        await session.save();
      }

      // Generate report
      const report = await generateReport(sessionId);
      socket.emit('session-report', report);
      console.log(`Session ${sessionId} ended`);
    } catch (err) {
      console.error('End session error:', err.message);
      socket.emit('error', { message: 'Failed to end session' });
    }
  });

  socket.on('disconnect', () => {
    if (sessionId) removeSocket(sessionId, 'game');
    console.log(`Game disconnected: ${socket.id}`);
  });
};
