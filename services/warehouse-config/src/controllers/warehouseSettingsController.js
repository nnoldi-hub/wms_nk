const db = require('../config/database');
const logger = require('../config/logger');
const { v4: uuidv4 } = require('uuid');

class WarehouseSettingsController {
  // List all settings for a warehouse, optional filter by category
  async list(req, res, next) {
    try {
      const { warehouseId } = req.params;
      const { category } = req.query;
      const { parsePagination } = require('../utils/pagination');
      const { page, limit, offset, sortBy, sortDir } = parsePagination(
        req.query,
        ['setting_category', 'setting_key', 'created_at', 'updated_at'],
        'setting_category'
      );
      const params = [warehouseId];
      let i = 2;
      let q = 'SELECT *, COUNT(*) OVER() AS total_count FROM warehouse_settings WHERE warehouse_id = $1';
      if (category) { q += ` AND setting_category = $${i++}`; params.push(category); }
      q += ` ORDER BY ${sortBy} ${sortDir}, setting_key LIMIT $${i++} OFFSET $${i++}`;
      params.push(limit, offset);
      const result = await db.query(q, params);
      const total = result.rows.length ? Number(result.rows[0].total_count) : 0;
      res.json({ success: true, data: result.rows, pagination: { page, limit, total } });
    } catch (error) {
      logger.error('List warehouse settings error:', error);
      next(error);
    }
  }

  // Get a setting by id
  async getById(req, res, next) {
    try {
      const { id } = req.params;
      const result = await db.query('SELECT * FROM warehouse_settings WHERE id = $1', [id]);
      if (!result.rows.length) return res.status(404).json({ error: 'Setting not found' });
      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      logger.error('Get warehouse setting error:', error);
      next(error);
    }
  }

  // Create a setting
  async create(req, res, next) {
    try {
      const data = req.validatedBody || req.body;
      const id = uuidv4();
      const result = await db.query(`
        INSERT INTO warehouse_settings (
          id, warehouse_id, setting_category, setting_key, setting_value, setting_type,
          display_name, description, default_value, validation_rules, is_editable
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11
        ) RETURNING *
      `, [
        id, data.warehouse_id, data.setting_category, data.setting_key, data.setting_value, data.setting_type || 'STRING',
        data.display_name || null, data.description || null, data.default_value || null,
        data.validation_rules ? JSON.stringify(data.validation_rules) : null,
        data.is_editable !== false
      ]);
      res.status(201).json({ success: true, message: 'Setting created', data: result.rows[0] });
    } catch (error) {
      logger.error('Create warehouse setting error:', error);
      next(error);
    }
  }

  // Update (by id) any subset of fields
  async update(req, res, next) {
    try {
      const { id } = req.params;
      const data = req.body;
      const keys = Object.keys(data);
      if (!keys.length) return res.status(400).json({ error: 'No fields to update' });
      const sets = [];
      const values = [];
      let i = 1;
      for (const k of keys) {
        if (k === 'validation_rules' && data[k] !== undefined) {
          sets.push(`validation_rules = $${i}`);
          values.push(data[k] ? JSON.stringify(data[k]) : null);
        } else {
          sets.push(`${k} = $${i}`);
          values.push(data[k]);
        }
        i++;
      }
      values.push(id);
      const result = await db.query(
        `UPDATE warehouse_settings SET ${sets.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${values.length} RETURNING *`,
        values
      );
      if (!result.rows.length) return res.status(404).json({ error: 'Setting not found' });
      res.json({ success: true, message: 'Setting updated', data: result.rows[0] });
    } catch (error) {
      logger.error('Update warehouse setting error:', error);
      next(error);
    }
  }

  // Delete a setting (hard delete since settings are re-creatable)
  async remove(req, res, next) {
    try {
      const { id } = req.params;
      const result = await db.query('DELETE FROM warehouse_settings WHERE id = $1 RETURNING id', [id]);
      if (!result.rows.length) return res.status(404).json({ error: 'Setting not found' });
      res.json({ success: true, message: 'Setting deleted' });
    } catch (error) {
      logger.error('Delete warehouse setting error:', error);
      next(error);
    }
  }
}

module.exports = new WarehouseSettingsController();
