const db = require('../config/database');
const logger = require('../config/logger');
const { v4: uuidv4 } = require('uuid');

class ZoneController {
  // Get all zones for a warehouse
  async getAll(req, res, next) {
    try {
      const { warehouseId } = req.params;
      const { zone_type, is_active } = req.query;
      const { parsePagination } = require('../utils/pagination');
      const { page, limit, offset, sortBy, sortDir } = parsePagination(
        req.query,
        ['zone_code','zone_name','zone_type','created_at','updated_at'],
        'zone_code'
      );

      let query = `
        SELECT 
          wz.*,
          COUNT(DISTINCT l.id) as location_count,
          COUNT(DISTINCT l.id) FILTER (WHERE l.status = 'AVAILABLE') as available_locations,
          COUNT(DISTINCT l.id) FILTER (WHERE l.status = 'OCCUPIED') as occupied_locations
        FROM warehouse_zones wz
        LEFT JOIN locations l ON wz.id = l.zone_id
        WHERE wz.warehouse_id = $1 AND (wz.is_active = true OR wz.is_active IS NULL)
      `;
      const params = [warehouseId];
      let paramIndex = 2;

      if (zone_type) {
        query += ` AND wz.zone_type = $${paramIndex}`;
        params.push(zone_type);
        paramIndex++;
      }

      if (is_active !== undefined) {
        query += ` AND wz.is_active = $${paramIndex}`;
        params.push(is_active === 'true');
        paramIndex++;
      }

      query += ` GROUP BY wz.id ORDER BY wz.${sortBy} ${sortDir} LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
      params.push(limit, offset);

      // Wrap to add total_count window after grouping
      const wrapped = `SELECT *, COUNT(*) OVER() AS total_count FROM (${query}) grouped`;
      const result = await db.query(wrapped, params);

      const total = result.rows.length ? Number(result.rows[0].total_count) : 0;
      res.json({ success: true, data: result.rows, pagination: { page, limit, total } });
    } catch (error) {
      logger.error('Get zones error:', error);
      next(error);
    }
  }

  // Get zone by ID
  async getById(req, res, next) {
    try {
      const { id } = req.params;

      const result = await db.query(`
        SELECT 
          wz.*,
          w.warehouse_name,
          w.warehouse_code,
          COUNT(DISTINCT l.id) as location_count,
          COUNT(DISTINCT l.id) FILTER (WHERE l.status = 'AVAILABLE') as available_locations,
          COUNT(DISTINCT l.id) FILTER (WHERE l.status = 'OCCUPIED') as occupied_locations
        FROM warehouse_zones wz
        JOIN warehouses w ON wz.warehouse_id = w.id
        LEFT JOIN locations l ON wz.id = l.zone_id
        WHERE wz.id = $1
        GROUP BY wz.id, w.warehouse_name, w.warehouse_code
      `, [id]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: 'Zone not found'
        });
      }

      res.json({
        success: true,
        data: result.rows[0]
      });
    } catch (error) {
      logger.error('Get zone error:', error);
      next(error);
    }
  }

  // Create new zone
  async create(req, res, next) {
    try {
      const data = req.validatedBody;
      const id = uuidv4();

      const result = await db.query(`
        INSERT INTO warehouse_zones (
          id, warehouse_id, zone_code, zone_name, zone_type,
          coordinate_x, coordinate_y, width, height,
          max_pallets, max_volume_cubic_meters,
          temperature_controlled, temperature_min_celsius, temperature_max_celsius,
          restricted_access, requires_special_equipment,
          is_active
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, true
        )
        RETURNING *
      `, [
        id, data.warehouse_id, data.zone_code, data.zone_name, data.zone_type,
        data.coordinate_x, data.coordinate_y, data.width, data.height,
        data.max_pallets, data.max_volume_cubic_meters,
        data.temperature_controlled, data.temperature_min_celsius, data.temperature_max_celsius,
        data.restricted_access, data.requires_special_equipment
      ]);

      logger.info(`Zone created: ${data.zone_code} by user ${req.user.id}`);

      res.status(201).json({
        success: true,
        message: 'Zone created successfully',
        data: result.rows[0]
      });
    } catch (error) {
      logger.error('Create zone error:', error);
      next(error);
    }
  }

  // Update zone
  async update(req, res, next) {
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
        UPDATE warehouse_zones
        SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
        WHERE id = $${paramIndex}
        RETURNING *
      `, values);

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: 'Zone not found'
        });
      }

      logger.info(`Zone updated: ${id} by user ${req.user.id}`);

      res.json({
        success: true,
        message: 'Zone updated successfully',
        data: result.rows[0]
      });
    } catch (error) {
      logger.error('Update zone error:', error);
      next(error);
    }
  }

  // Delete zone
  async delete(req, res, next) {
    try {
      const { id } = req.params;

      // Check if zone has active locations (exclude soft-deleted)
      const locationCheck = await db.query(
        'SELECT COUNT(*) as count FROM locations WHERE zone_id = $1 AND (is_active = true OR is_active IS NULL)',
        [id]
      );

      const locationCount = parseInt(locationCheck.rows[0].count);
      if (locationCount > 0) {
        return res.status(400).json({
          error: `Cannot delete zone. Please delete all locations first (${locationCount} active locations exist).`
        });
      }

      const result = await db.query(`
        UPDATE warehouse_zones
        SET is_active = false, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING id, zone_code
      `, [id]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: 'Zone not found'
        });
      }

      logger.info(`Zone deleted: ${id} by user ${req.user.id}`);

      res.json({
        success: true,
        message: 'Zone deleted successfully'
      });
    } catch (error) {
      logger.error('Delete zone error:', error);
      next(error);
    }
  }
}

module.exports = new ZoneController();
