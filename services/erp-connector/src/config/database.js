const { Pool } = require('pg');
const logger = require('./logger');

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME     || 'wms_nks',
  user:     process.env.DB_USER     || 'wms_admin',
  password: process.env.DB_PASSWORD || 'wms_secure_pass_2025',
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 3_000,
});

pool.on('connect', () => logger.info('✓ ERP connector conectat la PostgreSQL'));
pool.on('error', (err) => logger.error('❌ Eroare pool DB', { err: err.message }));

module.exports = {
  query:     (text, params) => pool.query(text, params),
  getClient: ()             => pool.connect(),
  end:       ()             => pool.end(),
  pool,
};
