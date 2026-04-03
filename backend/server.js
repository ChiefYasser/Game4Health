import { createServer } from 'http';
import app from './src/app.js';
import env from './src/config/env.js';
import connectDB from './src/config/db.js';
import { initSocket } from './src/websocket/index.js';
import { initMQTT } from './src/mqtt/mqttClient.js';

const server = createServer(app);

// Initialize WebSocket
initSocket(server);

// Initialize MQTT (sensor data from IoT)
initMQTT();

// Connect to MongoDB and start server
connectDB().then(() => {
  server.listen(env.PORT, () => {
    console.log(`Server running on port ${env.PORT}`);
    console.log(`WebSocket ready on port ${env.PORT}`);
    console.log(`Dashboard: http://localhost:${env.PORT}`);
    console.log(`Health check: http://localhost:${env.PORT}/api/health`);
  });
});
