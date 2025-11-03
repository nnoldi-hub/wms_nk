const { Pool } = require('pg');
require('dotenv').config();

const isTest = process.env.NODE_ENV === 'test';

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 20,
  // In tests keep idle clients from holding the event loop; speed up teardown
  idleTimeoutMillis: isTest ? 100 : 30000,
  allowExitOnIdle: true,
  connectionTimeoutMillis: 2000,
});

// Test connection (suppress noise during tests)
pool.on('connect', () => {
  if (!isTest) {
    console.log('✓ Connected to PostgreSQL database');
  }
});

pool.on('error', (err) => {
  console.error('❌ Unexpected error on idle client', err);
  process.exit(-1);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  getClient: () => pool.connect(),
  end: () => pool.end(),
  pool
};
