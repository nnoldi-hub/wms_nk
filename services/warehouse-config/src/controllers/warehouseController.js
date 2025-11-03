const db = require('../config/database');
const logger = require('../config/logger');
const { v4: uuidv4 } = require('uuid');

class WarehouseController {
  // Get all warehouses
  async getAll(req, res, next) {
    try {
      const { parsePagination } = require('../utils/pagination');
      const { page, limit, offset, sortBy, sortDir } = parsePagination(
        req.query,
        ['created_at','updated_at','warehouse_code','warehouse_name','company_name'],
        'created_at'
      );

      const { company_name, is_active, q } = req.query;

      let base = `
        SELECT 
          w.*,
          COUNT(DISTINCT wz.id) as zone_count,
          COUNT(DISTINCT l.id) as location_count
        FROM warehouses w
        LEFT JOIN warehouse_zones wz ON w.id = wz.warehouse_id AND wz.is_active = true
        LEFT JOIN locations l ON w.id = l.warehouse_id AND l.is_active = true
        WHERE 1=1
      `;
      const params = [];
      let idx = 1;

      // Filters
      if (typeof is_active !== 'undefined') {
        base += ` AND w.is_active = $${idx}`;
        params.push(is_active === 'true');
        idx++;
      } else {
        // Default to active only when not specified
        base += ` AND w.is_active = true`;
      }

      if (company_name) {
        base += ` AND w.company_name ILIKE $${idx}`;
        params.push(`%${company_name}%`);
        idx++;
      }

      if (q) {
        base += ` AND (w.warehouse_code ILIKE $${idx} OR w.warehouse_name ILIKE $${idx} OR w.company_name ILIKE $${idx})`;
        params.push(`%${q}%`);
        idx++;
      }

      base += ` GROUP BY w.id`;

      const wrapped = `SELECT sub.*, COUNT(*) OVER() AS total_count FROM (${base}) sub`;
      const finalSql = `${wrapped} ORDER BY ${sortBy} ${sortDir} LIMIT $${idx++} OFFSET $${idx++}`;
      params.push(limit, offset);

      const result = await db.query(finalSql, params);

      const total = result.rows.length ? Number(result.rows[0].total_count) : 0;
      res.json({ success: true, data: result.rows, pagination: { page, limit, total } });
    } catch (error) {
      logger.error('Get warehouses error:', error);
      next(error);
    }
  }

  // Get warehouse by ID
  async getById(req, res, next) {
    try {
      const { id } = req.params;

      const result = await db.query(`
        SELECT 
          w.*,
          COUNT(DISTINCT wz.id) as zone_count,
          COUNT(DISTINCT l.id) as location_count,
          COUNT(DISTINCT l.id) FILTER (WHERE l.status = 'AVAILABLE') as available_locations,
          COUNT(DISTINCT l.id) FILTER (WHERE l.status = 'OCCUPIED') as occupied_locations
        FROM warehouses w
        LEFT JOIN warehouse_zones wz ON w.id = wz.warehouse_id
        LEFT JOIN locations l ON w.id = l.warehouse_id
        WHERE w.id = $1
        GROUP BY w.id
      `, [id]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: 'Warehouse not found'
        });
      }

      res.json({
        success: true,
        data: result.rows[0]
      });
    } catch (error) {
      logger.error('Get warehouse error:', error);
      next(error);
    }
  }

  // Create new warehouse
  async create(req, res, next) {
    try {
      const data = req.validatedBody;
      const userId = req.user.id;
      const id = uuidv4();

      // Use NULL for created_by if using dev dummy user
      const createdBy = userId === '00000000-0000-0000-0000-000000000000' ? null : userId;

      const result = await db.query(`
        INSERT INTO warehouses (
          id, warehouse_code, warehouse_name, company_name,
          street, city, postal_code, country,
          phone, email, manager_name,
          timezone, currency, measurement_system,
          total_area_sqm, height_meters, layout_type,
          is_active, created_by
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, true, $18
        )
        RETURNING *
      `, [
        id, data.warehouse_code, data.warehouse_name, data.company_name,
        data.street, data.city, data.postal_code, data.country,
        data.phone, data.email, data.manager_name,
        data.timezone, data.currency, data.measurement_system,
        data.total_area_sqm, data.height_meters, data.layout_type,
        createdBy
      ]);

      logger.info(`Warehouse created: ${data.warehouse_code} by user ${userId}`);

      res.status(201).json({
        success: true,
        message: 'Warehouse created successfully',
        data: result.rows[0]
      });
    } catch (error) {
      logger.error('Create warehouse error:', error);
      next(error);
    }
  }

  // Update warehouse
  async update(req, res, next) {
    try {
      const { id } = req.params;
      const data = req.validatedBody;

      // Build dynamic SET clause
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
        UPDATE warehouses
        SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
        WHERE id = $${paramIndex}
        RETURNING *
      `, values);

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: 'Warehouse not found'
        });
      }

      logger.info(`Warehouse updated: ${id} by user ${req.user.id}`);

      res.json({
        success: true,
        message: 'Warehouse updated successfully',
        data: result.rows[0]
      });
    } catch (error) {
      logger.error('Update warehouse error:', error);
      next(error);
    }
  }

  // Complete warehouse setup
  async completeSetup(req, res, next) {
    try {
      const { id } = req.params;

      const result = await db.query(`
        UPDATE warehouses
        SET setup_completed = true,
            setup_completed_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING *
      `, [id]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: 'Warehouse not found'
        });
      }

      logger.info(`Warehouse setup completed: ${id} by user ${req.user.id}`);

      res.json({
        success: true,
        message: 'Warehouse setup completed',
        data: result.rows[0]
      });
    } catch (error) {
      logger.error('Complete setup error:', error);
      next(error);
    }
  }

  // Get warehouse statistics
  async getStatistics(req, res, next) {
    try {
      const { id } = req.params;

      const result = await db.query(`
        SELECT 
          w.warehouse_code,
          w.warehouse_name,
          COUNT(DISTINCT wz.id) as total_zones,
          COUNT(DISTINCT l.id) as total_locations,
          COUNT(DISTINCT l.id) FILTER (WHERE l.status = 'AVAILABLE') as available_locations,
          COUNT(DISTINCT l.id) FILTER (WHERE l.status = 'OCCUPIED') as occupied_locations,
          COUNT(DISTINCT l.id) FILTER (WHERE l.status = 'BLOCKED') as blocked_locations,
          ROUND(
            (COUNT(DISTINCT l.id) FILTER (WHERE l.status = 'OCCUPIED')::numeric / 
             NULLIF(COUNT(DISTINCT l.id), 0) * 100), 2
          ) as occupancy_percent,
          COUNT(DISTINCT pb.id) as total_batches,
          SUM(pb.current_quantity) as total_quantity_stored
        FROM warehouses w
        LEFT JOIN warehouse_zones wz ON w.id = wz.warehouse_id
        LEFT JOIN locations l ON w.id = l.warehouse_id
        LEFT JOIN product_batches pb ON l.id = pb.location_id AND pb.current_quantity > 0
        WHERE w.id = $1
        GROUP BY w.id, w.warehouse_code, w.warehouse_name
      `, [id]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: 'Warehouse not found'
        });
      }

      res.json({
        success: true,
        data: result.rows[0]
      });
    } catch (error) {
      logger.error('Get warehouse statistics error:', error);
      next(error);
    }
  }

  // Delete warehouse (soft delete)
  async delete(req, res, next) {
    try {
      const { id } = req.params;

      // Check if warehouse has active zones (exclude soft-deleted zones)
      const zonesCheck = await db.query(`
        SELECT COUNT(*) as zone_count 
        FROM warehouse_zones 
        WHERE warehouse_id = $1 AND (is_active = true OR is_active IS NULL)
      `, [id]);

      const zoneCount = parseInt(zonesCheck.rows[0].zone_count);
      if (zoneCount > 0) {
        return res.status(400).json({
          error: `Cannot delete warehouse. Please delete all zones first (${zoneCount} active zones exist).`
        });
      }

      const result = await db.query(`
        UPDATE warehouses
        SET is_active = false, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING id, warehouse_code
      `, [id]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: 'Warehouse not found'
        });
      }

      logger.info(`Warehouse deleted: ${id} by user ${req.user.id}`);

      res.json({
        success: true,
        message: 'Warehouse deleted successfully'
      });
    } catch (error) {
      logger.error('Delete warehouse error:', error);
      next(error);
    }
  }
}

module.exports = new WarehouseController();
