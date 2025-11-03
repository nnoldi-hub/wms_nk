const redisClient = require('../config/redis');

class RedisRateLimitStore {
  constructor(options = {}) {
    this.prefix = options.prefix || 'rl:';
    this.windowMs = 60_000;
    this.client = options.client || redisClient;
  }

  init(options) {
    // Synchronous init; express-rate-limit passes options including windowMs
    if (options && typeof options.windowMs === 'number') {
      this.windowMs = options.windowMs;
    }
  }

  _key(key) {
    return `${this.prefix}${key}`;
  }

  async get(key) {
    const k = this._key(key);
    const [count, pttl] = await Promise.all([
      this.client.sendCommand(['GET', k]),
      this.client.sendCommand(['PTTL', k])
    ]);
    if (count === null) return undefined;
    const ttlMs = typeof pttl === 'number' && pttl >= 0 ? pttl : this.windowMs;
    const resetTime = new Date(Date.now() + ttlMs);
    return { totalHits: Number(count), resetTime };
  }

  async increment(key) {
    const k = this._key(key);
    // INCR and ensure PEXPIRE is set
    const totalHits = Number(await this.client.sendCommand(['INCR', k]));
    let pttl = await this.client.sendCommand(['PTTL', k]);
    if (typeof pttl !== 'number' || pttl < 0) {
      // Set expire only if not already set
      await this.client.sendCommand(['PEXPIRE', k, String(this.windowMs), 'NX']);
      pttl = this.windowMs;
    }
    const resetTime = new Date(Date.now() + (typeof pttl === 'number' ? pttl : this.windowMs));
    return { totalHits, resetTime };
  }

  async decrement(key) {
    const k = this._key(key);
    const val = Number(await this.client.sendCommand(['DECR', k]));
    if (val <= 0) {
      await this.client.sendCommand(['DEL', k]);
    }
  }

  async resetKey(key) {
    const k = this._key(key);
    await this.client.sendCommand(['DEL', k]);
  }

  async resetAll() {
    // Optional: scan and delete by prefix; avoids heavy operations in production
    // Implement only if needed; left intentionally empty to avoid SCAN cost by default.
  }
}

module.exports = RedisRateLimitStore;
