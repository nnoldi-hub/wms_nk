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
