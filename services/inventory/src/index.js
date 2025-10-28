const express = require('express');
const { Pool } = require('pg');
const redis = require('redis');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

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

redisClient.on('error', (err) => console.error('Redis Client Error', err));
redisClient.connect();

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
app.get('/metrics', (req, res) => {
  res.set('Content-Type', 'text/plain');
  res.send(`
# HELP inventory_uptime_seconds Uptime of the inventory service
# TYPE inventory_uptime_seconds counter
inventory_uptime_seconds ${process.uptime()}
`);
});

// API endpoints
app.get('/api/v1/inventory', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM inventory_items LIMIT 100');
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

app.get('/api/v1/inventory/sku/:sku', async (req, res) => {
  try {
    const { sku } = req.params;
    const result = await pool.query(
      'SELECT * FROM inventory_items WHERE sku = $1',
      [sku]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'SKU not found',
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

app.get('/api/v1/inventory/locations', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM locations ORDER BY name');
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

// Start server
app.listen(PORT, () => {
  console.log(`Inventory Service running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Metrics: http://localhost:${PORT}/metrics`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing connections...');
  await pool.end();
  await redisClient.quit();
  process.exit(0);
});
