require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const logger = require('./utils/logger');
const routes = require('./routes');
const { errorHandler } = require('./middleware/errorHandler');
const db = require('./config/database');

const app = express();
const PORT = process.env.PORT || 3013;

app.use(helmet());

// CORS configuration
app.use(cors({
  origin: process.env.WEB_UI_ORIGIN || 'http://localhost:5173',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Handle preflight requests
app.options('*', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', process.env.WEB_UI_ORIGIN || 'http://localhost:5173');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.sendStatus(204);
});

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'cutting-service', timestamp: new Date().toISOString() });
});

app.use('/api/v1/cutting', routes);
app.use(errorHandler);

async function startServer() {
  try {
    await db.testConnection();
    app.listen(PORT, () => logger.info(`Cutting Service on port ${PORT}`));
  } catch (error) {
    logger.error('Failed to start:', error);
    process.exit(1);
  }
}

startServer();
module.exports = app;
