const jwt = require('jsonwebtoken');

const mintToken = (req, res) => {
  // Only allow in non-production environments
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Dev token endpoint disabled in production' }
    });
  }

  // Optional header secret to protect the endpoint further
  const requiredSecret = process.env.DEV_TOOL_SECRET;
  if (requiredSecret && requiredSecret.trim() !== '') {
    const provided = req.headers['x-dev-secret'] || req.headers['x-devtoken'] || req.headers['x-dev-token'];
    if (provided !== requiredSecret) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Invalid dev secret' }
      });
    }
  }

  const { role = 'admin', id, email, expiresIn } = req.body || {};
  const payload = {
    id: id || '00000000-0000-0000-0000-000000000000',
    email: email || `dev-${role}@example.com`,
    role
  };
  const secret = process.env.JWT_SECRET || 'wms_jwt_secret_key_change_in_production';
  const exp = expiresIn || process.env.JWT_EXPIRES_IN || '8h';

  const token = jwt.sign(payload, secret, { expiresIn: exp });
  return res.json({ success: true, data: { token, payload } });
};

module.exports = { mintToken };
