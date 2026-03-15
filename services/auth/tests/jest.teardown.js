const { db, redis } = require('../src/index');

module.exports = async () => {
  try {
    await db.end();
  } catch {}
  try {
    if (redis && redis.isOpen) {
      await redis.quit();
    }
  } catch {}
  await new Promise((resolve) => setTimeout(resolve, 50));
};
