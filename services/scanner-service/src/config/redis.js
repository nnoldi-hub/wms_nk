const redis = require('redis');
const logger = require('../utils/logger');

const redisConfig = {
  socket: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
  },
};

// Only add password if it's set and not empty
if (process.env.REDIS_PASSWORD && process.env.REDIS_PASSWORD.trim() !== '') {
  redisConfig.password = process.env.REDIS_PASSWORD;
}

const redisClient = redis.createClient(redisConfig);

redisClient.on('error', (err) => {
  logger.error('Redis Client Error:', err);
});

redisClient.on('connect', () => {
  logger.info('Redis Client Connected');
});

module.exports = redisClient;
