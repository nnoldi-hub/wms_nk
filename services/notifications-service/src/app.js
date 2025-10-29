require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const { Server } = require('socket.io');
const logger = require('./utils/logger');
const setupWebSocket = require('./websocket');
const setupRabbitMQ = require('./rabbitmq');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

const PORT = process.env.PORT || 3017;

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'notifications-service', 
    connections: io.engine.clientsCount,
    timestamp: new Date().toISOString() 
  });
});

setupWebSocket(io);
setupRabbitMQ(io);

server.listen(PORT, () => {
  logger.info(`Notifications Service on port ${PORT}`);
  logger.info('WebSocket server ready');
});

module.exports = { app, io };
