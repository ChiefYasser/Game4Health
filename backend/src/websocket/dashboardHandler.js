import Session from '../models/Session.js';
import ECGReading from '../models/ECGReading.js';
import GameEvent from '../models/GameEvent.js';

export const handleDashboardConnection = (socket) => {
  console.log(`Dashboard connected: ${socket.id}`);
  let sessionId = null;

  socket.on('join-session', async (data) => {
    sessionId = data.sessionId;
    socket.join(sessionId);
    socket.emit('joined', { sessionId, message: 'Dashboard joined session' });

    // Send existing session data so the dashboard can hydrate
    try {
      const session = await Session.findById(sessionId);
      if (!session) {
        socket.emit('error', { message: 'Session not found' });
        return;
      }

      const readings = await ECGReading.find({ sessionId }).sort('timestamp').lean();
      const events = await GameEvent.find({ sessionId }).sort('timestamp').lean();

      socket.emit('session-state', {
        session,
        readings,
        events,
      });
    } catch (err) {
      socket.emit('error', { message: 'Failed to load session data' });
    }

    console.log(`Dashboard ${socket.id} joined session ${sessionId}`);
  });

  socket.on('disconnect', () => {
    console.log(`Dashboard disconnected: ${socket.id}`);
  });
};
