require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const logger = require('./utils/logger');
const routes = require('./routes');
const { errorHandler } = require('./middleware/errorHandler');
const db = require('./config/database');

const app = express();
const PORT = process.env.PORT || 3015;

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'quality-control-service', timestamp: new Date().toISOString() });
});

app.use('/api/v1/qc', routes);
app.use(errorHandler);

async function startServer() {
  try {
    await db.testConnection();
    app.listen(PORT, () => logger.info(`Quality Control Service on port ${PORT}`));
  } catch (error) {
    logger.error('Failed to start:', error);
    process.exit(1);
  }
}

startServer();
module.exports = app;
