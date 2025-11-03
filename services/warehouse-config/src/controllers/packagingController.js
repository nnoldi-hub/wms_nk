const db = require('../config/database');
const logger = require('../config/logger');
const { v4: uuidv4 } = require('uuid');

class PackagingController {
  // Get all packaging types
  async getAllTypes(req, res, next) {
    try {
  const { category, is_reusable, is_active, q } = req.query;
      const { parsePagination } = require('../utils/pagination');
      const { page, limit, offset, sortBy, sortDir } = parsePagination(
        req.query,
        ['category','packaging_name','packaging_code','created_at','updated_at'],
        'category'
      );

      let query = 'SELECT * FROM packaging_types WHERE 1=1';
      const params = [];
      let paramIndex = 1;

      if (category) {
        query += ` AND category = $${paramIndex}`;
        params.push(category);
        paramIndex++;
      }

      if (is_reusable !== undefined) {
        query += ` AND is_reusable = $${paramIndex}`;
        params.push(is_reusable === 'true');
        paramIndex++;
      }

      if (is_active !== undefined) {
        query += ` AND is_active = $${paramIndex}`;
        params.push(is_active === 'true');
        paramIndex++;
      }

      if (q) {
        query += ` AND (packaging_name ILIKE $${paramIndex} OR packaging_code ILIKE $${paramIndex})`;
        params.push(`%${q}%`);
        paramIndex++;
      }

      query += ` ORDER BY ${sortBy} ${sortDir}, packaging_name LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
      params.push(limit, offset);

      const wrapped = `SELECT sub.*, COUNT(*) OVER() AS total_count FROM (${query}) sub`;
      const result = await db.query(wrapped, params);

      const total = result.rows.length ? Number(result.rows[0].total_count) : 0;
      res.json({ success: true, data: result.rows, pagination: { page, limit, total } });
    } catch (error) {
      logger.error('Get packaging types error:', error);
      next(error);
    }
  }

  // Get packaging type by ID
  async getTypeById(req, res, next) {
    try {
      const { id } = req.params;

      const result = await db.query(
        'SELECT * FROM packaging_types WHERE id = $1',
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: 'Packaging type not found'
        });
      }

      res.json({
        success: true,
        data: result.rows[0]
      });
    } catch (error) {
      logger.error('Get packaging type error:', error);
      next(error);
    }
  }

  // Create packaging type
  async createType(req, res, next) {
    try {
      const data = req.validatedBody;
      const id = uuidv4();

      const result = await db.query(`
        INSERT INTO packaging_types (
          id, packaging_code, packaging_name, category,
          length_cm, width_cm, height_cm,
          max_weight_kg, max_volume_cubic_meters,
          is_reusable, is_stackable, max_stack_height,
          purchase_cost_per_unit, rental_cost_per_day,
          is_active
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, true
        )
        RETURNING *
      `, [
        id, data.packaging_code, data.packaging_name, data.category,
        data.length_cm, data.width_cm, data.height_cm,
        data.max_weight_kg, data.max_volume_cubic_meters,
        data.is_reusable, data.is_stackable, data.max_stack_height,
        data.purchase_cost_per_unit, data.rental_cost_per_day
      ]);

      logger.info(`Packaging type created: ${data.packaging_code} by user ${req.user.id}`);

      res.status(201).json({
        success: true,
        message: 'Packaging type created successfully',
        data: result.rows[0]
      });
    } catch (error) {
      logger.error('Create packaging type error:', error);
      next(error);
    }
  }

  // Update packaging type
  async updateType(req, res, next) {
    try {
      const { id } = req.params;
      const data = req.validatedBody;

      const updates = [];
      const values = [];
      let paramIndex = 1;

      Object.keys(data).forEach(key => {
        updates.push(`${key} = $${paramIndex}`);
        values.push(data[key]);
        paramIndex++;
      });

      if (updates.length === 0) {
        return res.status(400).json({
          error: 'No fields to update'
        });
      }

      values.push(id);

      const result = await db.query(`
        UPDATE packaging_types
        SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
        WHERE id = $${paramIndex}
        RETURNING *
      `, values);

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: 'Packaging type not found'
        });
      }

      logger.info(`Packaging type updated: ${id} by user ${req.user.id}`);

      res.json({
        success: true,
        message: 'Packaging type updated successfully',
        data: result.rows[0]
      });
    } catch (error) {
      logger.error('Update packaging type error:', error);
      next(error);
    }
  }

  // Get all package instances
  async getAllInstances(req, res, next) {
    try {
      const { packaging_type_id, current_location_id, status } = req.query;
      const { parsePagination } = require('../utils/pagination');
      const { page, limit, offset, sortBy, sortDir } = parsePagination(
        req.query,
        ['created_at','updated_at','status','barcode'],
        'created_at'
      );

      let query = `
        SELECT 
          pi.*,
          pt.packaging_name,
          pt.packaging_code,
          l.location_code,
          wz.zone_name
        FROM package_instances pi
        JOIN packaging_types pt ON pi.packaging_type_id = pt.id
        LEFT JOIN locations l ON pi.current_location_id = l.id
        LEFT JOIN warehouse_zones wz ON l.zone_id = wz.id
        WHERE 1=1
      `;
      const params = [];
      let paramIndex = 1;

      if (packaging_type_id) {
        query += ` AND pi.packaging_type_id = $${paramIndex}`;
        params.push(packaging_type_id);
        paramIndex++;
      }

      if (current_location_id) {
        query += ` AND pi.current_location_id = $${paramIndex}`;
        params.push(current_location_id);
        paramIndex++;
      }

      if (status) {
        query += ` AND pi.status = $${paramIndex}`;
        params.push(status);
        paramIndex++;
      }

      query += ` ORDER BY pi.${sortBy} ${sortDir} LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
      params.push(limit, offset);

      const wrapped = `SELECT sub.*, COUNT(*) OVER() AS total_count FROM (${query}) sub`;
      const result = await db.query(wrapped, params);

      const total = result.rows.length ? Number(result.rows[0].total_count) : 0;
      res.json({ success: true, data: result.rows, pagination: { page, limit, total } });
    } catch (error) {
      logger.error('Get package instances error:', error);
      next(error);
    }
  }

  // Create package instance
  async createInstance(req, res, next) {
    try {
      const data = req.validatedBody;
      const id = uuidv4();
      const barcode = data.barcode || `PKG-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      const result = await db.query(`
        INSERT INTO package_instances (
          id, packaging_type_id, barcode, current_location_id,
          status, condition_notes
        ) VALUES (
          $1, $2, $3, $4, $5, $6
        )
        RETURNING *
      `, [
        id, data.packaging_type_id, barcode, data.current_location_id,
        data.status || 'AVAILABLE', data.condition_notes
      ]);

      logger.info(`Package instance created: ${barcode} by user ${req.user.id}`);

      res.status(201).json({
        success: true,
        message: 'Package instance created successfully',
        data: result.rows[0]
      });
    } catch (error) {
      logger.error('Create package instance error:', error);
      next(error);
    }
  }

  // Update package instance status
  async updateInstanceStatus(req, res, next) {
    try {
      const { id } = req.params;
      const { status, current_location_id, condition_notes } = req.body;

      const result = await db.query(`
        UPDATE package_instances
        SET 
          status = COALESCE($1, status),
          current_location_id = COALESCE($2, current_location_id),
          condition_notes = COALESCE($3, condition_notes),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $4
        RETURNING *
      `, [status, current_location_id, condition_notes, id]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: 'Package instance not found'
        });
      }

      logger.info(`Package instance updated: ${id} by user ${req.user.id}`);

      res.json({
        success: true,
        message: 'Package instance updated successfully',
        data: result.rows[0]
      });
    } catch (error) {
      logger.error('Update package instance error:', error);
      next(error);
    }
  }

  // Get packaging inventory report
  async getInventoryReport(req, res, next) {
    try {
      const result = await db.query(`
        SELECT 
          pt.id,
          pt.packaging_code,
          pt.packaging_name,
          pt.category,
          COUNT(pi.id) as total_units,
          COUNT(pi.id) FILTER (WHERE pi.status = 'AVAILABLE') as available_units,
          COUNT(pi.id) FILTER (WHERE pi.status = 'IN_USE') as in_use_units,
          COUNT(pi.id) FILTER (WHERE pi.status = 'MAINTENANCE') as maintenance_units,
          COUNT(pi.id) FILTER (WHERE pi.status = 'DAMAGED') as damaged_units
        FROM packaging_types pt
        LEFT JOIN package_instances pi ON pt.id = pi.packaging_type_id
        WHERE pt.is_active = true
        GROUP BY pt.id, pt.packaging_code, pt.packaging_name, pt.category
        ORDER BY pt.category, pt.packaging_name
      `);

      res.json({
        success: true,
        data: result.rows
      });
    } catch (error) {
      logger.error('Get packaging inventory report error:', error);
      next(error);
    }
  }
}

module.exports = new PackagingController();
