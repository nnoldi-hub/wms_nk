const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

// Inventory service default secret (matches middleware/auth.js fallback)
const JWT_SECRET = process.env.JWT_SECRET || 'wms_jwt_secret_key_2025';

/**
 * Mint a signed JWT token compatible with the inventory service auth middleware.
 */
function getToken(role = 'admin', extra = {}) {
  const payload = {
    userId: extra.userId || uuidv4(),
    username: extra.username || `test_${role}`,
    role,
    ...extra,
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
}

module.exports = { getToken };
