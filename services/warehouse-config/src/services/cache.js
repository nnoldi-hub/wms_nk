'use strict';
/**
 * Cache Service — wrapper Redis cu fallback transparent la DB
 *
 * TTL-uri implicite:
 *   rules        → 60s  (se modifică rar, dar trebuie să se reflecte repede)
 *   zones        → 300s (5 min)
 *   locations    → 120s (2 min)
 *   loc-types    → 600s (10 min)
 *   packaging    → 600s (10 min)
 */

const redis = require('../config/redis');
const logger = require('../config/logger');

const TTL = {
  RULES: 60,
  ZONES: 300,
  LOCATIONS: 120,
  LOC_TYPES: 600,
  PACKAGING: 600,
};

// ─── Primitive ────────────────────────────────────────────────────────────────

async function get(key) {
  try {
    const raw = await redis.get(key);
    if (raw == null) return null;
    return JSON.parse(raw);
  } catch (err) {
    logger.warn(`[cache] get("${key}") failed — fallback to DB: ${err.message}`);
    return null;
  }
}

async function set(key, value, ttlSeconds = 60) {
  try {
    await redis.set(key, JSON.stringify(value), { EX: ttlSeconds });
  } catch (err) {
    logger.warn(`[cache] set("${key}") failed: ${err.message}`);
  }
}

async function del(key) {
  try {
    await redis.del(key);
  } catch (err) {
    logger.warn(`[cache] del("${key}") failed: ${err.message}`);
  }
}

/**
 * Șterge toate cheile care încep cu un prefix (pattern prefix:*)
 * Folosit la invalidare după scriere.
 */
async function invalidatePrefix(prefix) {
  try {
    // redis client v4 — folosim SCAN
    let cursor = 0;
    do {
      const reply = await redis.scan(cursor, { MATCH: `${prefix}:*`, COUNT: 100 });
      cursor = reply.cursor;
      if (reply.keys && reply.keys.length > 0) {
        await redis.del(reply.keys);
      }
    } while (cursor !== 0);
  } catch (err) {
    logger.warn(`[cache] invalidatePrefix("${prefix}") failed: ${err.message}`);
  }
}

// ─── Helper "cache-aside" ─────────────────────────────────────────────────────

/**
 * Returnează valoarea din cache dacă există, altfel execută loader(),
 * salvează în cache și returnează rezultatul.
 *
 * @param {string} key
 * @param {Function} loader - async function() => data
 * @param {number} ttlSeconds
 */
async function getOrLoad(key, loader, ttlSeconds = 60) {
  const cached = await get(key);
  if (cached !== null) return cached;

  const data = await loader();
  await set(key, data, ttlSeconds);
  return data;
}

// ─── Chei canonice ───────────────────────────────────────────────────────────

const keys = {
  rules: (scope, isActive, ruleType) => {
    const parts = ['rules', scope || 'all', isActive ?? 'all', ruleType || 'all'];
    return parts.join(':');
  },
  zones: (warehouseId) => `zones:${warehouseId || 'all'}`,
  locations: (zoneId) => `locations:${zoneId || 'all'}`,
  locationTypes: () => 'location-types:all',
  packagingTypes: () => 'packaging-types:all',
};

const prefixes = {
  rules: 'rules',
  zones: 'zones',
  locations: 'locations',
  locationTypes: 'location-types',
  packagingTypes: 'packaging-types',
};

module.exports = { get, set, del, invalidatePrefix, getOrLoad, keys, prefixes, TTL };
