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

// ── Permisiuni granulare ────────────────────────────────────────────────────

const ALLOWED_RESOURCES = [
  'orders', 'batches', 'picking', 'reception', 'cutting',
  'sewing', 'qc', 'reports', 'config', 'users',
];

// GET /api/v1/users/:id/permissions — returneaza permisiunile granulare ale unui user
exports.getPermissions = async (req, res) => {
  try {
    const { id } = req.params;

    if (req.user.role !== 'admin' && req.user.userId !== id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const result = await req.db.query(
      `SELECT resource, can_view, can_create, can_edit, can_delete, can_approve
       FROM user_operation_permissions
       WHERE user_id = $1
       ORDER BY resource`,
      [id]
    );

    // Returneza un obiect indexat pe resource pentru consum facil in UI
    const permissions = {};
    for (const row of result.rows) {
      permissions[row.resource] = {
        can_view:    row.can_view,
        can_create:  row.can_create,
        can_edit:    row.can_edit,
        can_delete:  row.can_delete,
        can_approve: row.can_approve,
      };
    }

    res.json({ success: true, data: permissions });
  } catch (error) {
    req.logger.error('Get permissions error', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// PUT /api/v1/users/:id/permissions — upsert permisiuni granulare (admin only)
exports.updatePermissions = async (req, res) => {
  try {
    const { id } = req.params;
    const permissions = req.body; // { orders: { can_view, can_create, ... }, ... }

    if (!permissions || typeof permissions !== 'object') {
      return res.status(400).json({ error: 'Body must be an object of resource permissions' });
    }

    const entries = Object.entries(permissions);
    if (entries.length === 0) {
      return res.status(400).json({ error: 'At least one resource permission required' });
    }

    // Valideaza resource names
    const invalid = entries.map(([r]) => r).filter(r => !ALLOWED_RESOURCES.includes(r));
    if (invalid.length > 0) {
      return res.status(400).json({ error: `Resurse necunoscute: ${invalid.join(', ')}` });
    }

    // Verificare user exista
    const userCheck = await req.db.query('SELECT id FROM users WHERE id = $1', [id]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Upsert fiecare resource
    const savedPermissions = {};
    for (const [resource, perms] of entries) {
      const { can_view = true, can_create = false, can_edit = false,
              can_delete = false, can_approve = false } = perms;

      const result = await req.db.query(
        `INSERT INTO user_operation_permissions
           (user_id, resource, can_view, can_create, can_edit, can_delete, can_approve)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (user_id, resource) DO UPDATE SET
           can_view    = EXCLUDED.can_view,
           can_create  = EXCLUDED.can_create,
           can_edit    = EXCLUDED.can_edit,
           can_delete  = EXCLUDED.can_delete,
           can_approve = EXCLUDED.can_approve,
           updated_at  = NOW()
         RETURNING resource, can_view, can_create, can_edit, can_delete, can_approve`,
        [id, resource, can_view, can_create, can_edit, can_delete, can_approve]
      );

      const row = result.rows[0];
      savedPermissions[row.resource] = {
        can_view:    row.can_view,
        can_create:  row.can_create,
        can_edit:    row.can_edit,
        can_delete:  row.can_delete,
        can_approve: row.can_approve,
      };
    }

    // Audit
    await req.db.query(
      `INSERT INTO audit_logs (entity_type, entity_id, action, user_id, metadata)
       VALUES ('user', $1, 'update_permissions', $2, $3)`,
      [id, req.user.userId, JSON.stringify(savedPermissions)]
    );

    res.json({ success: true, data: savedPermissions });
  } catch (error) {
    req.logger.error('Update permissions error', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
