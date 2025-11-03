const db = require('../src/config/database');
const redis = require('../src/config/redis');

module.exports = async () => {
  try {
    await db.end();
  } catch {}
  try {
    if (redis && redis.isOpen) {
      await redis.quit();
    }
  } catch {}
  // Give the event loop a brief moment to settle any pending handles
  await new Promise((resolve) => setTimeout(resolve, 50));
};