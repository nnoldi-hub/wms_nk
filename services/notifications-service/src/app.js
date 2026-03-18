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

const jwt = require('jsonwebtoken');

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'notifications-service', 
    connections: io.engine.clientsCount,
    timestamp: new Date().toISOString() 
  });
});

/**
 * GET /operators/presence
 * Returnează lista operatorilor conectați la acest moment.
 * Necesită JWT valid (role manager sau admin).
 */
app.get('/operators/presence', (req, res) => {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ success: false, message: 'Autentificare necesară' });

  let caller;
  try {
    caller = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ success: false, message: 'Token invalid' });
  }
  if (!['manager', 'admin'].includes(caller.role)) {
    return res.status(403).json({ success: false, message: 'Acces interzis' });
  }

  // Colectăm socket-urile conectate din room-ul role:operator
  const operatorRoom = io.sockets.adapter.rooms.get('role:operator') || new Set();
  const operators = [];

  for (const socketId of operatorRoom) {
    const socket = io.sockets.sockets.get(socketId);
    if (socket) {
      operators.push({
        socketId,
        userId: socket.userId,
        username: socket.username,
        role: socket.role,
        status: 'ONLINE',
      });
    }
  }

  return res.json({ success: true, data: operators, total: operators.length });
});

setupWebSocket(io);
setupRabbitMQ(io);

server.listen(PORT, () => {
  logger.info(`Notifications Service on port ${PORT}`);
  logger.info('WebSocket server ready');
});

module.exports = { app, io };
