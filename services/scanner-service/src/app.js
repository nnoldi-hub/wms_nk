require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const routes = require('./routes');
const { errorHandler } = require('./middleware/errorHandler');
const logger = require('./utils/logger');
const redisClient = require('./config/redis');
const rabbitmq = require('./config/rabbitmq');

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'scanner-service',
    timestamp: new Date().toISOString(),
    redis: redisClient.isReady ? 'connected' : 'disconnected',
  });
});

// Routes
app.use('/api/v1/scanner', routes);

// Error handling
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
  });
});

const PORT = process.env.PORT || 3012;

// Initialize connections and start server
async function startServer() {
  try {
    // Connect to Redis
    await redisClient.connect();
    logger.info('Connected to Redis');

    // Connect to RabbitMQ
    await rabbitmq.connect();
    logger.info('Connected to RabbitMQ');

    // Start server
    app.listen(PORT, () => {
      logger.info(`Scanner Service running on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  await redisClient.quit();
  await rabbitmq.close();
  process.exit(0);
});

startServer();

module.exports = app;
