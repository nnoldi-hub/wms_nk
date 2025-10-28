// ============================================================================
// services/auth/src/routes/auth.js
// ============================================================================
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const { validateLogin, validateRegister, validateRefresh } = require('../middleware/validation');

router.post('/login', validateLogin, authController.login);
router.post('/register', validateRegister, authController.register);
router.post('/refresh', validateRefresh, authController.refreshToken);
router.post('/logout', authenticate, authController.logout);
router.get('/me', authenticate, authController.getCurrentUser);

module.exports = router;

// ============================================================================
// services/auth/src/routes/users.js
// ============================================================================
const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/', authenticate, authorize(['admin']), userController.getAllUsers);
router.get('/:id', authenticate, userController.getUserById);
router.put('/:id', authenticate, userController.updateUser);
router.delete('/:id', authenticate, authorize(['admin']), userController.deleteUser);

module.exports = router;

// ============================================================================
// services/auth/src/controllers/authController.js
// ============================================================================
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRY = process.env.JWT_EXPIRY || '15m';
const REFRESH_TOKEN_EXPIRY = process.env.REFRESH_TOKEN_EXPIRY || '7d';

// Generate tokens
const generateTokens = (user) => {
  const accessToken = jwt.sign(
    { 
      userId: user.id, 
      username: user.username, 
      role: user.role 
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );

  const refreshToken = jwt.sign(
    { 
      userId: user.id, 
      type: 'refresh' 
    },
    JWT_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRY }
  );

  return { accessToken, refreshToken };
};

// Login
exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;

    // Find user
    const result = await req.db.query(
      'SELECT * FROM users WHERE username = $1 AND is_active = true',
      [username]
    );

    if (result.rows.length === 0) {
      req.metrics.authAttempts.labels('failed').inc();
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      req.metrics.authAttempts.labels('failed').inc();
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(user);

    // Store refresh token in Redis (with 7 days TTL)
    const refreshTokenKey = `refresh:${user.id}:${uuidv4()}`;
    await req.redis.setEx(refreshTokenKey, 7 * 24 * 60 * 60, refreshToken);

    // Update last login
    await req.db.query(
      'UPDATE users SET last_login = NOW() WHERE id = $1',
      [user.id]
    );

    // Audit log
    await req.db.query(
      `INSERT INTO audit_logs (entity_type, entity_id, action, user_id, metadata, ip_address) 
       VALUES ($1, $2, $3, $4, $5, $6)`,
      ['user', user.id, 'login', user.id, JSON.stringify({ username }), req.ip]
    );

    req.metrics.authAttempts.labels('success').inc();
    req.logger.info(`User ${username} logged in successfully`);

    res.json({
      accessToken,
      refreshToken,
      expiresIn: JWT_EXPIRY,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    req.logger.error('Login error', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Register
exports.register = async (req, res) => {
  try {
    const { username, email, password, role = 'operator' } = req.body;

    // Check if user exists
    const existingUser = await req.db.query(
      'SELECT id FROM users WHERE username = $1 OR email = $2',
      [username, email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: 'User already exists' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const result = await req.db.query(
      `INSERT INTO users (username, email, password_hash, role) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id, username, email, role, created_at`,
      [username, email, passwordHash, role]
    );

    const newUser = result.rows[0];

    // Audit log
    await req.db.query(
      `INSERT INTO audit_logs (entity_type, entity_id, action, user_id, metadata) 
       VALUES ($1, $2, $3, $4, $5)`,
      ['user', newUser.id, 'create', newUser.id, JSON.stringify({ username, email, role })]
    );

    req.logger.info(`New user registered: ${username}`);

    res.status(201).json({
      message: 'User created successfully',
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        role: newUser.role,
        createdAt: newUser.created_at
      }
    });
  } catch (error) {
    req.logger.error('Registration error', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Refresh token
exports.refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    // Verify refresh token
    const decoded = jwt.verify(refreshToken, JWT_SECRET);
    
    if (decoded.type !== 'refresh') {
      return res.status(401).json({ error: 'Invalid token type' });
    }

    // Check if token exists in Redis
    const keys = await req.redis.keys(`refresh:${decoded.userId}:*`);
    let tokenFound = false;

    for (const key of keys) {
      const storedToken = await req.redis.get(key);
      if (storedToken === refreshToken) {
        tokenFound = true;
        // Revoke old token
        await req.redis.del(key);
        break;
      }
    }

    if (!tokenFound) {
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }

    // Get user
    const result = await req.db.query(
      'SELECT * FROM users WHERE id = $1 AND is_active = true',
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }

    const user = result.rows[0];

    // Generate new tokens
    const tokens = generateTokens(user);

    // Store new refresh token
    const refreshTokenKey = `refresh:${user.id}:${uuidv4()}`;
    await req.redis.setEx(refreshTokenKey, 7 * 24 * 60 * 60, tokens.refreshToken);

    req.logger.info(`Token refreshed for user ${user.username}`);

    res.json({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: JWT_EXPIRY
    });
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    req.logger.error('Refresh token error', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Logout
exports.logout = async (req, res) => {
  try {
    const userId = req.user.userId;

    // Revoke all refresh tokens for this user
    const keys = await req.redis.keys(`refresh:${userId}:*`);
    if (keys.length > 0) {
      await req.redis.del(keys);
    }

    // Audit log
    await req.db.query(
      `INSERT INTO audit_logs (entity_type, entity_id, action, user_id) 
       VALUES ($1, $2, $3, $4)`,
      ['user', userId, 'logout', userId]
    );

    req.logger.info(`User ${req.user.username} logged out`);

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    req.logger.error('Logout error', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get current user
exports.getCurrentUser = async (req, res) => {
  try {
    const result = await req.db.query(
      `SELECT id, username, email, role, last_login, created_at 
       FROM users WHERE id = $1`,
      [req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: result.rows[0] });
  } catch (error) {
    req.logger.error('Get current user error', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ============================================================================
// services/auth/src/controllers/userController.js
// ============================================================================
const bcrypt = require('bcryptjs');

// Get all users (admin only)
exports.getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 50, role, search } = req.query;
    const offset = (page - 1) * limit;

    let query = `SELECT id, username, email, role, is_active, last_login, created_at 
                 FROM users WHERE 1=1`;
    const params = [];
    let paramCount = 0;

    if (role) {
      paramCount++;
      query += ` AND role = ${paramCount}`;
      params.push(role);
    }

    if (search) {
      paramCount++;
      query += ` AND (username ILIKE ${paramCount} OR email ILIKE ${paramCount})`;
      params.push(`%${search}%`);
    }

    query += ` ORDER BY created_at DESC LIMIT ${paramCount + 1} OFFSET ${paramCount + 2}`;
    params.push(limit, offset);

    const result = await req.db.query(query, params);

    // Get total count
    const countResult = await req.db.query('SELECT COUNT(*) FROM users');
    const total = parseInt(countResult.rows[0].count);

    res.json({
      users: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    req.logger.error('Get all users error', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get user by ID
exports.getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    // Users can only view their own profile unless they're admin
    if (req.user.role !== 'admin' && req.user.userId !== id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const result = await req.db.query(
      `SELECT id, username, email, role, is_active, last_login, created_at, updated_at 
       FROM users WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: result.rows[0] });
  } catch (error) {
    req.logger.error('Get user by ID error', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Update user
exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { email, password, role, is_active } = req.body;

    // Users can only update their own profile unless they're admin
    if (req.user.role !== 'admin' && req.user.userId !== id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Only admins can change roles and active status
    if (req.user.role !== 'admin' && (role || is_active !== undefined)) {
      return res.status(403).json({ error: 'Forbidden: Cannot change role or status' });
    }

    const updates = [];
    const params = [];
    let paramCount = 0;

    if (email) {
      paramCount++;
      updates.push(`email = ${paramCount}`);
      params.push(email);
    }

    if (password) {
      paramCount++;
      const passwordHash = await bcrypt.hash(password, 10);
      updates.push(`password_hash = ${paramCount}`);
      params.push(passwordHash);
    }

    if (role && req.user.role === 'admin') {
      paramCount++;
      updates.push(`role = ${paramCount}`);
      params.push(role);
    }

    if (is_active !== undefined && req.user.role === 'admin') {
      paramCount++;
      updates.push(`is_active = ${paramCount}`);
      params.push(is_active);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    updates.push(`updated_at = NOW()`);
    paramCount++;
    params.push(id);

    const query = `UPDATE users SET ${updates.join(', ')} 
                   WHERE id = ${paramCount} 
                   RETURNING id, username, email, role, is_active, updated_at`;

    const result = await req.db.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Audit log
    await req.db.query(
      `INSERT INTO audit_logs (entity_type, entity_id, action, user_id, metadata) 
       VALUES ($1, $2, $3, $4, $5)`,
      ['user', id, 'update', req.user.userId, JSON.stringify(req.body)]
    );

    req.logger.info(`User ${id} updated by ${req.user.username}`);

    res.json({
      message: 'User updated successfully',
      user: result.rows[0]
    });
  } catch (error) {
    req.logger.error('Update user error', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Delete user (soft delete)
exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    // Cannot delete yourself
    if (req.user.userId === id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    const result = await req.db.query(
      'UPDATE users SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING id, username',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Revoke all refresh tokens
    const keys = await req.redis.keys(`refresh:${id}:*`);
    if (keys.length > 0) {
      await req.redis.del(keys);
    }

    // Audit log
    await req.db.query(
      `INSERT INTO audit_logs (entity_type, entity_id, action, user_id) 
       VALUES ($1, $2, $3, $4)`,
      ['user', id, 'delete', req.user.userId]
    );

    req.logger.info(`User ${id} deleted by ${req.user.username}`);

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    req.logger.error('Delete user error', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ============================================================================
// services/auth/src/middleware/auth.js
// ============================================================================
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;

// Authentication middleware
exports.authenticate = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);

    const decoded = jwt.verify(token, JWT_SECRET);

    if (decoded.type === 'refresh') {
      return res.status(401).json({ error: 'Invalid token type' });
    }

    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    req.logger?.error('Authentication error', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Authorization middleware
exports.authorize = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
    }

    next();
  };
};

// ============================================================================
// services/auth/src/middleware/validation.js
// ============================================================================
const Joi = require('joi');

const validateRequest = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body, { abortEarly: false });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      return res.status(400).json({
        error: 'Validation failed',
        details: errors
      });
    }

    next();
  };
};

const loginSchema = Joi.object({
  username: Joi.string().alphanum().min(3).max(30).required(),
  password: Joi.string().min(6).required()
});

const registerSchema = Joi.object({
  username: Joi.string().alphanum().min(3).max(30).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  role: Joi.string().valid('admin', 'manager', 'operator', 'scanner').default('operator')
});

const refreshSchema = Joi.object({
  refreshToken: Joi.string().required()
});

exports.validateLogin = validateRequest(loginSchema);
exports.validateRegister = validateRequest(registerSchema);
exports.validateRefresh = validateRequest(refreshSchema);