const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const Joi = require('joi');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// Validation schemas
const updateUserSchema = Joi.object({
  email: Joi.string().email(),
  role: Joi.string().valid('admin', 'manager', 'operator'),
  is_active: Joi.boolean()
});

const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: Joi.string().min(6).required()
});

// GET /api/v1/users - Get all users (admin only)
router.get('/', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const result = await req.db.query(
      'SELECT id, username, email, role, is_active, last_login, created_at FROM users ORDER BY created_at DESC'
    );

    res.json({ users: result.rows });
  } catch (error) {
    req.logger.error('Get users error', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/users/:id - Get user by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Users can only view their own profile unless they're admin
    if (req.user.role !== 'admin' && req.user.userId !== id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await req.db.query(
      'SELECT id, username, email, role, is_active, last_login, created_at FROM users WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: result.rows[0] });
  } catch (error) {
    req.logger.error('Get user error', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/v1/users/:id - Update user
router.put('/:id', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { error, value } = updateUserSchema.validate(req.body);

    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (value.email !== undefined) {
      updates.push(`email = $${paramIndex++}`);
      values.push(value.email);
    }
    if (value.role !== undefined) {
      updates.push(`role = $${paramIndex++}`);
      values.push(value.role);
    }
    if (value.is_active !== undefined) {
      updates.push(`is_active = $${paramIndex++}`);
      values.push(value.is_active);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const query = `
      UPDATE users 
      SET ${updates.join(', ')} 
      WHERE id = $${paramIndex}
      RETURNING id, username, email, role, is_active, updated_at
    `;

    const result = await req.db.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: result.rows[0] });
  } catch (error) {
    req.logger.error('Update user error', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/v1/users/:id - Delete user (soft delete)
router.delete('/:id', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const { id } = req.params;

    const result = await req.db.query(
      'UPDATE users SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Remove refresh token from Redis
    await req.redis.del(`refresh_token:${id}`);

    res.json({ message: 'User deactivated successfully' });
  } catch (error) {
    req.logger.error('Delete user error', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/users/:id/change-password - Change password
router.post('/:id/change-password', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Users can only change their own password unless they're admin
    if (req.user.role !== 'admin' && req.user.userId !== id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { error, value } = changePasswordSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { currentPassword, newPassword } = value;

    // Get current password hash
    const result = await req.db.query(
      'SELECT password_hash FROM users WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, result.rows[0].password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    // Update password
    await req.db.query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [newPasswordHash, id]
    );

    // Invalidate all refresh tokens
    await req.redis.del(`refresh_token:${id}`);

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    req.logger.error('Change password error', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
