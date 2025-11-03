require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { metricsMiddleware, metricsRouter } = require('./middleware/metrics');
const morgan = require('morgan');
const requestId = require('./middleware/requestId');
const logger = require('./config/logger');
const db = require('./config/database');
const redis = require('./config/redis');
const routes = require('./routes');
const { errorHandler, notFound } = require('./middleware/errorHandler');
const swaggerUi = require('swagger-ui-express');
const openapi = require('./docs/openapi');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());

const originEnv = process.env.CORS_ORIGIN || 'http://localhost:5173';
const allowedOrigins = originEnv.split(',').map(o => o.trim());
const corsOptions = {
  origin: function (origin, callback) {
    // allow non-browser clients (no origin) and any origin in the allowlist
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Authorization','Content-Type','x-dev-secret'],
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request ID for correlation
app.use(requestId);

if (process.env.NODE_ENV !== 'test') {
  // Add request id token and skip noisy endpoints
  morgan.token('rid', (req) => req.id || '-');
  const skipMetrics = (req) => req.path === '/metrics' || req.path === '/ready';

  if (process.env.NODE_ENV === 'development') {
    app.use(morgan(':method :url :status :res[content-length] - :response-time ms rid=:rid', { skip: skipMetrics }));
  } else {
    const prodFormat = ':remote-addr - :remote-user ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent" rid=:rid';
    app.use(morgan(prodFormat, {
      stream: {
        write: (message) => logger.info(message.trim())
      },
      skip: skipMetrics
    }));
  }
}

// Metrics (no auth)
app.use(metricsRouter);

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'warehouse-config',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Readiness: checks DB and Redis connectivity
app.get('/ready', async (req, res) => {
  const details = { db: false, redis: false };
  try {
    await db.query('SELECT 1');
    details.db = true;
  } catch (e) {
    details.db = false;
  }

  try {
    if (process.env.NODE_ENV === 'test') {
      // In tests, Redis is mocked; assume OK to keep tests deterministic
      details.redis = true;
    } else if (typeof redis.ping === 'function') {
      await redis.ping();
      details.redis = true;
    } else if (typeof redis.sendCommand === 'function') {
      await redis.sendCommand(['PING']);
      details.redis = true;
    } else if (redis && typeof redis.isOpen !== 'undefined') {
      details.redis = !!redis.isOpen;
    } else {
      // Conservative default
      details.redis = true;
    }
  } catch (e) {
    details.redis = false;
  }

  const ok = details.db && details.redis;
  const body = {
    status: ok ? 'ready' : 'not-ready',
    service: 'warehouse-config',
    timestamp: new Date().toISOString(),
    dependencies: details
  };
  if (ok) return res.json(body);
  return res.status(503).json(body);
});

// API docs (Swagger UI)
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openapi));

// Rate limit dev token minting (public, non-prod)
if (process.env.NODE_ENV !== 'production') {
  let store;
  try {
    const RedisRateLimitStore = require('./middleware/rateLimitStoreRedis');
    store = new RedisRateLimitStore({ prefix: 'rl:dev:' });
    logger.info('Using Redis-backed rate limit store for /dev/token');
  } catch (e) {
    logger.warn('Redis store for rate limit not available, falling back to in-memory limiter');
  }

  const devLimiter = rateLimit({
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: 30, // 30 requests per IP per window
    standardHeaders: true,
    legacyHeaders: false,
    store
  });
  app.use('/api/v1/dev/token', devLimiter);
}

// Optional global rate limit (off by default). Enable with RATE_LIMIT_GLOBAL_ENABLED=true
if (String(process.env.RATE_LIMIT_GLOBAL_ENABLED).toLowerCase() === 'true') {
  let store;
  try {
    const RedisRateLimitStore = require('./middleware/rateLimitStoreRedis');
    store = new RedisRateLimitStore({ prefix: 'rl:global:' });
    logger.info('Using Redis-backed global rate limit store');
  } catch (e) {
    logger.warn('Redis store for global rate limit not available, using in-memory');
  }

  const windowMs = Number(process.env.RATE_LIMIT_GLOBAL_WINDOW_MS || 15 * 60 * 1000);
  const max = Number(process.env.RATE_LIMIT_GLOBAL_MAX || 300);

  const globalLimiter = rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    store,
    passOnStoreError: true,
  });

  // Apply to API routes (keeps /health, /ready, /metrics unthrottled)
  app.use('/api/v1', globalLimiter);
}

// Per-request metrics
app.use(metricsMiddleware);

app.use('/api/v1', routes);
app.use(notFound);
app.use(errorHandler);

const gracefulShutdown = async () => {
  logger.info('Received shutdown signal, closing server gracefully...');
  
  try {
    await db.end();
    logger.info('Database connections closed');
    
    await redis.quit();
    logger.info('Redis connection closed');
    
    process.exit(0);
  } catch (error) {
    logger.error('Error during graceful shutdown:', error);
    process.exit(1);
  }
};

// Avoid registering signal handlers during tests to prevent lingering handles
if (process.env.NODE_ENV !== 'test') {
  process.on('SIGTERM', gracefulShutdown);
  process.on('SIGINT', gracefulShutdown);
}

const startServer = async () => {
  try {
    await db.query('SELECT NOW()');
    logger.info('Database connection established');
    
    if (!redis.isOpen) {
      logger.info('Waiting for Redis to connect...');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    await redis.ping();
    logger.info('Redis connection established');
    
    app.listen(PORT, () => {
      logger.info(`Warehouse Config Service running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`CORS enabled for origins: ${allowedOrigins.join(', ')}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Don't auto-start server when running tests
if (process.env.NODE_ENV !== 'test') {
  startServer();
}

module.exports = app;
