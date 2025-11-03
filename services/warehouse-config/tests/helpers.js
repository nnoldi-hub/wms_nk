const jwt = require('jsonwebtoken');

function getToken(role = 'admin', extra = {}) {
  const payload = {
    id: extra.id || '00000000-0000-0000-0000-000000000000',
    email: extra.email || 'test@example.com',
    role,
    ...extra
  };
  const secret = process.env.JWT_SECRET || 'wms_jwt_secret_key_change_in_production';
  return jwt.sign(payload, secret, { expiresIn: '1h' });
}

module.exports = { getToken };
