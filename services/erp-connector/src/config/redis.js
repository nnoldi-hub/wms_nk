const { createClient } = require('redis');
const logger = require('./logger');

const client = createClient({
  socket: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  },
  password: process.env.REDIS_PASSWORD || undefined,
});

client.on('error', (err) => logger.error('Redis eroare', { err: err.message }));
client.on('connect', () => logger.info('✓ ERP connector conectat la Redis'));

// Connect la startup — apelat din index.js
async function connectRedis() {
  if (!client.isOpen) {
    await client.connect();
  }
  return client;
}

module.exports = { client, connectRedis };
