const { pool, redisClient } = require('../src/index');

module.exports = async () => {
  try {
    await pool.end();
  } catch {}
  try {
    if (redisClient && redisClient.isOpen) {
      await redisClient.quit();
    }
  } catch {}
  await new Promise((resolve) => setTimeout(resolve, 50));
};
