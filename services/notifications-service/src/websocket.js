const jwt = require('jsonwebtoken');
const logger = require('./utils/logger');

function setupWebSocket(io) {
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    
    if (!token) {
      logger.warn('WebSocket connection rejected: No token');
      return next(new Error('Authentication required'));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.userId;
      socket.username = decoded.username;
      socket.role = decoded.role;
      next();
    } catch (error) {
      logger.warn('WebSocket auth failed:', error.message);
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    logger.info(`User connected: ${socket.username} (${socket.userId})`);
    
    socket.join(`user:${socket.userId}`);
    socket.join(`role:${socket.role}`);

    socket.emit('welcome', {
      message: 'Connected to WMS Notifications',
      userId: socket.userId,
      username: socket.username
    });

    socket.on('subscribe', (channels) => {
      channels.forEach(channel => socket.join(channel));
      logger.info(`User ${socket.username} subscribed to: ${channels.join(', ')}`);
    });

    socket.on('unsubscribe', (channels) => {
      channels.forEach(channel => socket.leave(channel));
      logger.info(`User ${socket.username} unsubscribed from: ${channels.join(', ')}`);
    });

    socket.on('disconnect', () => {
      logger.info(`User disconnected: ${socket.username}`);
    });
  });
}

module.exports = setupWebSocket;
