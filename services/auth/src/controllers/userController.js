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
      query += ` AND role = $${paramCount}`;
      params.push(role);
    }

    if (search) {
      paramCount++;
      query += ` AND (username ILIKE $${paramCount} OR email ILIKE $${paramCount})`;
      params.push(`%${search}%`);
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    params.push(limit, offset);

    const result = await req.db.query(query, params);

    // Get total count
    const countResult = await req.db.query('SELECT COUNT(*) FROM users');
    const total = parseInt(countResult.rows[0].count);

    res.json({
      success: true,
      data: result.rows,
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

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    req.logger.error('Get user by ID error', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Create new user (admin only)
exports.createUser = async (req, res) => {
  try {
    const { username, email, password, role = 'operator', is_active = true } = req.body;

    // Validate required fields
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required' });
    }

    // Check if username or email already exists
    const existingUser = await req.db.query(
      'SELECT id FROM users WHERE username = $1 OR email = $2',
      [username, email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: 'Username or email already exists' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const result = await req.db.query(
      `INSERT INTO users (username, email, password_hash, role, is_active) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING id, username, email, role, is_active, created_at`,
      [username, email, passwordHash, role, is_active]
    );

    const newUser = result.rows[0];

    // Audit log
    await req.db.query(
      `INSERT INTO audit_logs (entity_type, entity_id, action, user_id, metadata) 
       VALUES ($1, $2, $3, $4, $5)`,
      ['user', newUser.id, 'create', req.user.userId, JSON.stringify({ username, email, role })]
    );

    req.logger.info(`User ${username} created by ${req.user.username}`);

    res.status(201).json({
      success: true,
      data: newUser
    });
  } catch (error) {
    req.logger.error('Create user error', error);
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
      updates.push(`email = $${paramCount}`);
      params.push(email);
    }

    if (password) {
      paramCount++;
      const passwordHash = await bcrypt.hash(password, 10);
      updates.push(`password_hash = $${paramCount}`);
      params.push(passwordHash);
    }

    if (role && req.user.role === 'admin') {
      paramCount++;
      updates.push(`role = $${paramCount}`);
      params.push(role);
    }

    if (is_active !== undefined && req.user.role === 'admin') {
      paramCount++;
      updates.push(`is_active = $${paramCount}`);
      params.push(is_active);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    updates.push(`updated_at = NOW()`);
    paramCount++;
    params.push(id);

    const query = `UPDATE users SET ${updates.join(', ')} 
                   WHERE id = $${paramCount} 
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
      success: true,
      data: result.rows[0]
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

    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    req.logger.error('Delete user error', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
