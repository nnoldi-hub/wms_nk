const db = require('../config/database');
const logger = require('../config/logger');
const { v4: uuidv4 } = require('uuid');

class LocationController {
  // Get all locations for a zone
  async getAll(req, res, next) {
    try {
      const { zoneId } = req.params;
      const { status, location_type } = req.query;
      const { parsePagination } = require('../utils/pagination');
      const { page, limit, offset, sortBy, sortDir } = parsePagination(
        req.query,
        ['aisle','rack','shelf_level','bin_position','created_at','updated_at','location_code'],
        'aisle'
      );

      let query = `
        SELECT 
          l.*,
          lt.name as type_name,
          wz.zone_name,
          wz.zone_code,
          w.warehouse_name
        FROM locations l
        LEFT JOIN location_types lt ON l.location_type_id = lt.id
        LEFT JOIN warehouse_zones wz ON l.zone_id = wz.id
        LEFT JOIN warehouses w ON l.warehouse_id = w.id
        WHERE l.zone_id = $1 AND (l.is_active = true OR l.is_active IS NULL)
      `;
      const params = [zoneId];
      let paramIndex = 2;

      if (status) {
        query += ` AND l.status = $${paramIndex}`;
        params.push(status);
        paramIndex++;
      }

      if (location_type) {
        query += ` AND lt.code = $${paramIndex}`;
        params.push(location_type);
        paramIndex++;
      }

      query += ` ORDER BY l.${sortBy} ${sortDir}, l.rack, l.shelf_level, l.bin_position LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
      params.push(limit, offset);

      // Add total count via window function
      const wrapped = `SELECT sub.*, COUNT(*) OVER() AS total_count FROM (${query}) sub`;
      const result = await db.query(wrapped, params);

      const total = result.rows.length ? Number(result.rows[0].total_count) : 0;
      res.json({ success: true, data: result.rows, pagination: { page, limit, total } });
    } catch (error) {
      logger.error('Get locations error:', error);
      next(error);
    }
  }

  // Get location by ID
  async getById(req, res, next) {
    try {
      const { id } = req.params;

      const result = await db.query(`
        SELECT 
          l.*,
          lt.name as type_name,
          lt.code as type_code,
          wz.zone_name,
          wz.zone_code,
          wz.zone_type,
          w.warehouse_name,
          w.warehouse_code
        FROM locations l
        LEFT JOIN location_types lt ON l.location_type_id = lt.id
        LEFT JOIN warehouse_zones wz ON l.zone_id = wz.id
        LEFT JOIN warehouses w ON l.warehouse_id = w.id
        WHERE l.id = $1
      `, [id]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: 'Location not found'
        });
      }

      res.json({
        success: true,
        data: result.rows[0]
      });
    } catch (error) {
      logger.error('Get location error:', error);
      next(error);
    }
  }

  // Create new location
  async create(req, res, next) {
    try {
      const data = req.validatedBody;
      const id = uuidv4().substring(0, 50); // Limit to 50 chars for VARCHAR(50)

      const result = await db.query(`
        INSERT INTO locations (
          id, warehouse_id, zone_id, location_code, barcode,
          location_type_id, aisle, rack, shelf_level, bin_position,
          width_cm, depth_cm, height_cm, max_weight_kg, max_volume_cubic_meters,
          status, priority_level, accessibility_level,
          is_active
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 
          COALESCE($16, 'AVAILABLE'), 
          COALESCE($17, 1), 
          COALESCE($18, 'GROUND'),
          true
        )
        RETURNING *
      `, [
        id, data.warehouse_id, data.zone_id, data.location_code, data.barcode,
        data.location_type_id, data.aisle, data.rack, data.shelf_level, data.bin_position,
        data.width_cm, data.depth_cm, data.height_cm, data.max_weight_kg, data.max_volume_cubic_meters,
        data.status, data.priority_level, data.accessibility_level
      ]);

      logger.info(`Location created: ${data.location_code} by user ${req.user.id}`);

      res.status(201).json({
        success: true,
        message: 'Location created successfully',
        data: result.rows[0]
      });
    } catch (error) {
      logger.error('Create location error:', error);
      next(error);
    }
  }

  // Bulk create locations
  async bulkCreate(req, res, next) {
    const client = await db.getClient();
    
    try {
      const data = req.validatedBody;
      await client.query('BEGIN');

      const locations = [];
      const { 
        warehouse_id, 
        zone_id, 
        location_type_id,
        naming_pattern,
        default_properties
      } = data;

      // Generate locations based on naming pattern
      for (let aisle = naming_pattern.aisle_start; aisle <= naming_pattern.aisle_end; aisle++) {
        const aisleStr = String(aisle).padStart(2, '0');
        
        for (let rack = naming_pattern.rack_start; rack <= naming_pattern.rack_end; rack++) {
          const rackStr = String(rack).padStart(2, '0');
          
          for (let shelf of naming_pattern.shelf_levels) {
            const shelfStr = String(shelf).padStart(2, '0');
            
            for (let bin = 1; bin <= naming_pattern.bins_per_shelf; bin++) {
              const binStr = String(bin).padStart(2, '0');
              
              const location_code = `${aisleStr}-${rackStr}-${shelfStr}-${binStr}`;
              const id = uuidv4().substring(0, 50);
              
              const result = await client.query(`
                INSERT INTO locations (
                  id, warehouse_id, zone_id, location_code, barcode,
                  location_type_id, aisle, rack, shelf_level, bin_position,
                  width_cm, depth_cm, height_cm, max_weight_kg, max_volume_cubic_meters,
                  status, priority_level, accessibility_level,
                  is_active
                ) VALUES (
                  $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
                  'AVAILABLE', $16, $17, true
                )
                RETURNING id, location_code
              `, [
                id, warehouse_id, zone_id, location_code, location_code,
                location_type_id, aisleStr, rackStr, parseInt(shelfStr), parseInt(binStr),
                default_properties.width_cm, default_properties.depth_cm, default_properties.height_cm,
                default_properties.max_weight_kg, default_properties.max_volume_cubic_meters,
                default_properties.priority_level || 1,
                default_properties.accessibility_level || 'GROUND'
              ]);
              
              locations.push(result.rows[0]);
            }
          }
        }
      }

      await client.query('COMMIT');

      logger.info(`Bulk created ${locations.length} locations for zone ${zone_id} by user ${req.user.id}`);

      res.status(201).json({
        success: true,
        message: `Successfully created ${locations.length} locations`,
        data: {
          count: locations.length,
          locations: locations.slice(0, 10) // Return first 10 as sample
        }
      });
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Bulk create locations error:', error);
      next(error);
    } finally {
      client.release();
    }
  }

  // Update location
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
        UPDATE locations
        SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
        WHERE id = $${paramIndex}
        RETURNING *
      `, values);

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: 'Location not found'
        });
      }

      logger.info(`Location updated: ${id} by user ${req.user.id}`);

      res.json({
        success: true,
        message: 'Location updated successfully',
        data: result.rows[0]
      });
    } catch (error) {
      logger.error('Update location error:', error);
      next(error);
    }
  }

  // Delete location
  async delete(req, res, next) {
    try {
      const { id } = req.params;

      // Check if location is occupied
      const statusCheck = await db.query(
        'SELECT status FROM locations WHERE id = $1',
        [id]
      );

      if (statusCheck.rows.length === 0) {
        return res.status(404).json({
          error: 'Location not found'
        });
      }

      if (statusCheck.rows[0].status === 'OCCUPIED') {
        return res.status(400).json({
          error: 'Cannot delete occupied location'
        });
      }

      await db.query(`
        UPDATE locations
        SET is_active = false, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING id, location_code
      `, [id]);

      logger.info(`Location deleted: ${id} by user ${req.user.id}`);

      res.json({
        success: true,
        message: 'Location deleted successfully'
      });
    } catch (error) {
      logger.error('Delete location error:', error);
      next(error);
    }
  }

  // Generate barcode for location
  async generateBarcode(req, res, next) {
    try {
      const { id } = req.params;
      const QRCode = require('qrcode');

      const location = await db.query(
        'SELECT location_code FROM locations WHERE id = $1',
        [id]
      );

      if (location.rows.length === 0) {
        return res.status(404).json({
          error: 'Location not found'
        });
      }

      const qrCodeData = await QRCode.toDataURL(location.rows[0].location_code);

      res.json({
        success: true,
        data: {
          location_code: location.rows[0].location_code,
          qr_code: qrCodeData
        }
      });
    } catch (error) {
      logger.error('Generate barcode error:', error);
      next(error);
    }
  }
}

module.exports = new LocationController();
