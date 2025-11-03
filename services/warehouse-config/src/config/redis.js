const redis = require('redis');
require('dotenv').config();

const isTest = process.env.NODE_ENV === 'test';

// In test mode, provide a lightweight no-op client to avoid noisy logs and open handles
if (isTest) {
  const noopAsync = async () => undefined;
  const noop = () => {};
  const mockClient = {
    // Event emitter compatibility
    on: noop,
    off: noop,
    // Common Redis command stubs
    get: async () => null,
    set: async () => 'OK',
    del: async () => 0,
    exists: async () => 0,
    expire: async () => 0,
    hget: async () => null,
    hset: async () => 0,
    // Connection lifecycle stubs
    connect: noopAsync,
    quit: noopAsync,
    disconnect: noop,
  };
  module.exports = mockClient;
}

else {
const redisClient = redis.createClient({
  socket: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    // Faster fail for unavailable Redis in non-test environments
    connectTimeout: Number(process.env.REDIS_CONNECT_TIMEOUT_MS || 5000),
    reconnectStrategy: (retries) => {
      // Exponential backoff up to 2s
      return Math.min(retries * 50, 2000);
    },
  },
  password: process.env.REDIS_PASSWORD || undefined,
});

redisClient.on('connect', () => {
  // Keep logs out of test (already returned above), allow in other envs
  console.log('✓ Connected to Redis');
});

redisClient.on('error', (err) => {
  // Avoid crashing on transient errors; surface concise log
  console.error('❌ Redis error:', err);
});

// Connect to Redis
(async () => {
  try {
    await redisClient.connect();
  } catch (error) {
    console.error('Failed to connect to Redis:', error);
  }
})();

module.exports = redisClient;
}
