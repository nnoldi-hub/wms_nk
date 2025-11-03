const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const redis = require('redis');
const winston = require('winston');
const promClient = require('prom-client');
const { errorHandler } = require('./middleware/errorHandler');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Winston logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
  ],
});

// Prometheus metrics
const register = new promClient.Registry();
promClient.collectDefaultMetrics({ register });

const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register]
});

// Middleware
app.use(express.json());

// CORS - allow web UI (Vite dev server) and handle preflight without auth
const corsOptions = {
  origin: process.env.WEB_UI_ORIGIN || 'http://localhost:5173',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
};
app.use(cors(corsOptions));
// Ensure preflight requests short-circuit before hitting auth middleware
app.options('*', cors(corsOptions));

// Harden preflight handling: explicitly return 204 with CORS headers
app.use((req, res, next) => {
  if (req.method === 'OPTIONS') {
    res.header('Access-Control-Allow-Origin', corsOptions.origin);
    res.header('Access-Control-Allow-Methods', corsOptions.methods.join(','));
    res.header('Access-Control-Allow-Headers', corsOptions.allowedHeaders.join(','));
    res.header('Access-Control-Allow-Credentials', 'true');
    return res.sendStatus(204);
  }
  next();
});

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info({
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: `${duration}ms`
    });
    
    httpRequestDuration
      .labels(req.method, req.route?.path || req.url, res.statusCode)
      .observe(duration / 1000);
  });
  next();
});

// PostgreSQL connection
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'wms_nks',
  user: process.env.DB_USER || 'wms_admin',
  password: process.env.DB_PASSWORD || 'wms_secure_pass_2025',
});

// Redis connection
const redisClient = redis.createClient({
  socket: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
  },
  password: process.env.REDIS_PASSWORD || 'redis_pass_2025',
});

redisClient.on('error', (err) => logger.error('Redis Client Error', err));
redisClient.on('connect', () => logger.info('Redis connected'));
redisClient.connect();

// Attach database, redis, and logger to request object
app.use((req, res, next) => {
  req.db = pool;
  req.redis = redisClient;
  req.logger = logger;
  req.metrics = {
    httpRequestDuration
  };
  next();
});

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    const redisStatus = redisClient.isOpen ? 'connected' : 'disconnected';
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: 'connected',
      redis: redisStatus,
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message,
    });
  }
});

// Metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.send(await register.metrics());
});

// Import routes
const productsRoutes = require('./routes/products');
const locationsRoutes = require('./routes/locations');
const movementsRoutes = require('./routes/movements');
const batchesRoutes = require('./routes/batches');
const transformationsRoutes = require('./routes/transformations');
const importRoutes = require('./routes/import');
const ordersRoutes = require('./routes/orders');
const pickingRoutes = require('./routes/picking');
const inventoryRoutes = require('./routes/inventory');

// API routes
app.use('/api/v1/products', productsRoutes);
app.use('/api/v1/locations', locationsRoutes);
app.use('/api/v1/movements', movementsRoutes);
app.use('/api/v1/batches', batchesRoutes);
app.use('/api/v1/transformations', transformationsRoutes);
app.use('/api/v1/inventory', inventoryRoutes);
app.use('/api/v1', importRoutes);
app.use('/api/v1', ordersRoutes);
app.use('/api/v1', pickingRoutes);

// Legacy compatibility endpoint
app.get('/api/v1/inventory', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT ii.*, p.sku, p.name as product_name, l.name as location_name
      FROM inventory_items ii
      JOIN products p ON ii.product_id = p.id
      JOIN locations l ON ii.location_id = l.id
      LIMIT 100
    `);
    res.json({
      success: true,
      data: result.rows,
      count: result.rowCount,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found'
  });
});

// Start server
app.listen(PORT, () => {
  logger.info(`Inventory Service running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`Health check: http://localhost:${PORT}/health`);
  logger.info(`Metrics: http://localhost:${PORT}/metrics`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing connections...');
  await pool.end();
  await redisClient.quit();
  process.exit(0);
});
