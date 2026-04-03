import { Server } from 'socket.io';
import { handleSensorConnection } from './sensorHandler.js';
import { handleGameConnection } from './gameHandler.js';

let io;

export const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: { origin: '*' },
  });

  // Sensor namespace — ECG devices connect here
  const sensorNsp = io.of('/sensor');
  sensorNsp.on('connection', handleSensorConnection);

  // Game namespace — VR game connects here
  const gameNsp = io.of('/game');
  gameNsp.on('connection', handleGameConnection);

  console.log('Socket.io initialized with /sensor and /game namespaces');
  return io;
};

export const getIO = () => {
  if (!io) throw new Error('Socket.io not initialized');
  return io;
};
