require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const logger  = require('./config/logger');
const db      = require('./config/database');
const { connectRedis } = require('./config/redis');
const routes  = require('./routes');
const syncService = require('./services/syncService');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// ── Health ────────────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'erp-connector',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

app.get('/ready', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ status: 'ready', service: 'erp-connector', timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(503).json({ status: 'not-ready', error: err.message });
  }
});

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/v1', routes);

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: 'Not found' }));

// ── Error handler ─────────────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  logger.error('Unhandled error', { err: err.message, stack: err.stack });
  res.status(500).json({ error: 'Internal server error' });
});

// ── Startup ───────────────────────────────────────────────────────────────────
async function start() {
  try {
    await db.query('SELECT 1');
    logger.info('✓ DB conectat');

    await connectRedis();
    logger.info('✓ Redis conectat');

    app.listen(PORT, () => {
      logger.info(`✓ ERP Connector pornit pe portul ${PORT}`);
    });

    // Porneste sincronizarea periodica
    syncService.start();
  } catch (err) {
    logger.error('Eroare startup', { err: err.message });
    process.exit(1);
  }
}

// ── Graceful shutdown ─────────────────────────────────────────────────────────
process.on('SIGTERM', async () => {
  logger.info('SIGTERM — oprire gratiosa');
  syncService.stop();
  await db.end();
  process.exit(0);
});

process.on('SIGINT', async () => {
  syncService.stop();
  await db.end();
  process.exit(0);
});

start();

module.exports = app;
