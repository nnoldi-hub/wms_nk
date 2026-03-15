const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const JWT_SECRET = process.env.JWT_SECRET || 'wms_jwt_secret_key_change_in_production';

/**
 * Mint a signed JWT access token for use in tests.
 * @param {'admin'|'operator'|'supervisor'} role
 * @param {object} extra - optional overrides merged into the payload
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
