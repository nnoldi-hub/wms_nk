const db = require('../config/database');
const logger = require('../config/logger');
const { v4: uuidv4 } = require('uuid');

class LocationTypeController {
  async getAll(req, res, next) {
    try {
      const { parsePagination } = require('../utils/pagination');
      const { page, limit, offset, sortBy, sortDir } = parsePagination(
        req.query,
        ['created_at','updated_at','code','name'],
        'code'
      );

      const result = await db.query(
        `SELECT *, COUNT(*) OVER() AS total_count
         FROM location_types
         ORDER BY ${sortBy} ${sortDir}
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      );

      const total = result.rows.length ? Number(result.rows[0].total_count) : 0;
      res.json({ success: true, data: result.rows, pagination: { page, limit, total } });
    } catch (e) {
      logger.error('List location types error:', e);
      next(e);
    }
  }

  async getById(req, res, next) {
    try {
      const { id } = req.params;
      const result = await db.query('SELECT * FROM location_types WHERE id = $1', [id]);
      if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
      res.json({ success: true, data: result.rows[0] });
    } catch (e) {
      next(e);
    }
  }

  async create(req, res, next) {
    try {
      const data = req.validatedBody;
      const id = uuidv4();
      const userId = req.user?.id === '00000000-0000-0000-0000-000000000000' ? null : req.user?.id;
      
      const fields = ['id', 'code', 'name'];
      const values = [id, data.code, data.name];
      const placeholders = ['$1', '$2', '$3'];
      let idx = 4;

      // Optional fields
      if (data.capacity_type) { fields.push('capacity_type'); values.push(data.capacity_type); placeholders.push(`$${idx++}`); }
      if (data.default_width_cm) { fields.push('default_width_cm'); values.push(data.default_width_cm); placeholders.push(`$${idx++}`); }
      if (data.default_depth_cm) { fields.push('default_depth_cm'); values.push(data.default_depth_cm); placeholders.push(`$${idx++}`); }
      if (data.default_height_cm) { fields.push('default_height_cm'); values.push(data.default_height_cm); placeholders.push(`$${idx++}`); }
      if (data.default_max_weight_kg) { fields.push('default_max_weight_kg'); values.push(data.default_max_weight_kg); placeholders.push(`$${idx++}`); }
      if (data.default_max_volume_cubic_meters) { fields.push('default_max_volume_cubic_meters'); values.push(data.default_max_volume_cubic_meters); placeholders.push(`$${idx++}`); }
      if (data.requires_forklift !== undefined) { fields.push('requires_forklift'); values.push(data.requires_forklift); placeholders.push(`$${idx++}`); }
      if (data.is_pickable !== undefined) { fields.push('is_pickable'); values.push(data.is_pickable); placeholders.push(`$${idx++}`); }
      if (data.is_stackable !== undefined) { fields.push('is_stackable'); values.push(data.is_stackable); placeholders.push(`$${idx++}`); }
      if (data.max_stack_height) { fields.push('max_stack_height'); values.push(data.max_stack_height); placeholders.push(`$${idx++}`); }

      const result = await db.query(
        `INSERT INTO location_types (${fields.join(', ')})
         VALUES (${placeholders.join(', ')}) RETURNING *`,
        values
      );
      logger.info(`Location type created ${data.code} by ${req.user?.id || 'system'}`);
      res.status(201).json({ success: true, data: result.rows[0] });
    } catch (e) {
      next(e);
    }
  }

  async update(req, res, next) {
    try {
      const { id } = req.params;
      const data = req.validatedBody;
      const fields = [];
      const values = [];
      let idx = 1;

      if (data.code) { fields.push(`code = $${idx++}`); values.push(data.code); }
      if (data.name) { fields.push(`name = $${idx++}`); values.push(data.name); }
      if (data.capacity_type) { fields.push(`capacity_type = $${idx++}`); values.push(data.capacity_type); }
      if (data.default_width_cm) { fields.push(`default_width_cm = $${idx++}`); values.push(data.default_width_cm); }
      if (data.default_depth_cm) { fields.push(`default_depth_cm = $${idx++}`); values.push(data.default_depth_cm); }
      if (data.default_height_cm) { fields.push(`default_height_cm = $${idx++}`); values.push(data.default_height_cm); }
      if (data.default_max_weight_kg) { fields.push(`default_max_weight_kg = $${idx++}`); values.push(data.default_max_weight_kg); }
      if (data.default_max_volume_cubic_meters) { fields.push(`default_max_volume_cubic_meters = $${idx++}`); values.push(data.default_max_volume_cubic_meters); }
      if (data.requires_forklift !== undefined) { fields.push(`requires_forklift = $${idx++}`); values.push(data.requires_forklift); }
      if (data.is_pickable !== undefined) { fields.push(`is_pickable = $${idx++}`); values.push(data.is_pickable); }
      if (data.is_stackable !== undefined) { fields.push(`is_stackable = $${idx++}`); values.push(data.is_stackable); }
      if (data.max_stack_height) { fields.push(`max_stack_height = $${idx++}`); values.push(data.max_stack_height); }
      if (data.is_active !== undefined) { fields.push(`is_active = $${idx++}`); values.push(data.is_active); }

      if (!fields.length) return res.status(400).json({ error: 'No fields to update' });
      
      values.push(id);
      const result = await db.query(
        `UPDATE location_types SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${idx} RETURNING *`,
        values
      );
      if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
      res.json({ success: true, data: result.rows[0] });
    } catch (e) {
      next(e);
    }
  }
}

module.exports = new LocationTypeController();
