const { Pool } = require('pg');
const logger = require('../utils/logger');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000
});

pool.on('error', (err) => logger.error('PostgreSQL pool error:', err));

async function testConnection() {
  const client = await pool.connect();
  await client.query('SELECT 1');
  client.release();
  logger.info('Sewing Service DB connected');
}

module.exports = { pool, testConnection };
