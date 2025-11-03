const db = require('../config/database');
const logger = require('../config/logger');
const { v4: uuidv4 } = require('uuid');

class CarrierController {
  // Get all carriers
  async getAll(req, res, next) {
    try {
  const { carrier_type, is_active, q } = req.query;
      const { parsePagination } = require('../utils/pagination');
      const { page, limit, offset, sortBy, sortDir } = parsePagination(
        req.query,
        ['carrier_name','carrier_code','created_at','updated_at','carrier_type'],
        'carrier_name'
      );

      let query = `
        SELECT 
          sc.*,
          COUNT(DISTINCT cs.id) as service_count
        FROM shipping_carriers sc
        LEFT JOIN carrier_services cs ON sc.id = cs.carrier_id
        WHERE 1=1
      `;
      const params = [];
      let paramIndex = 1;

      if (carrier_type) {
        query += ` AND sc.carrier_type = $${paramIndex}`;
        params.push(carrier_type);
        paramIndex++;
      }

      if (is_active !== undefined) {
        query += ` AND sc.is_active = $${paramIndex}`;
        params.push(is_active === 'true');
        paramIndex++;
      }

      if (q) {
        query += ` AND (sc.carrier_name ILIKE $${paramIndex} OR sc.carrier_code ILIKE $${paramIndex})`;
        params.push(`%${q}%`);
        paramIndex++;
      }

      query += ` GROUP BY sc.id ORDER BY sc.${sortBy} ${sortDir} LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
      params.push(limit, offset);

      const wrapped = `SELECT grouped.*, COUNT(*) OVER() AS total_count FROM (${query}) grouped`;
      const result = await db.query(wrapped, params);

      const total = result.rows.length ? Number(result.rows[0].total_count) : 0;
      res.json({ success: true, data: result.rows, pagination: { page, limit, total } });
    } catch (error) {
      logger.error('Get carriers error:', error);
      next(error);
    }
  }

  // Get carrier by ID
  async getById(req, res, next) {
    try {
      const { id } = req.params;

      const carrierResult = await db.query(
        'SELECT * FROM shipping_carriers WHERE id = $1',
        [id]
      );

      if (carrierResult.rows.length === 0) {
        return res.status(404).json({
          error: 'Carrier not found'
        });
      }

      const servicesResult = await db.query(
        'SELECT * FROM carrier_services WHERE carrier_id = $1 AND is_active = true ORDER BY service_name',
        [id]
      );

      res.json({
        success: true,
        data: {
          ...carrierResult.rows[0],
          services: servicesResult.rows
        }
      });
    } catch (error) {
      logger.error('Get carrier error:', error);
      next(error);
    }
  }

  // Create carrier
  async create(req, res, next) {
    try {
      const data = req.validatedBody;
      const id = uuidv4();

      const result = await db.query(`
        INSERT INTO shipping_carriers (
          id, carrier_code, carrier_name, carrier_type,
          contact_email, contact_phone,
          api_endpoint, api_key_encrypted, api_username,
          pricing_model, base_rate, 
          supports_tracking, supports_pickup, supports_international,
          average_delivery_days,
          is_active
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, true
        )
        RETURNING *
      `, [
        id, data.carrier_code, data.carrier_name, data.carrier_type,
        data.contact_email, data.contact_phone,
        data.api_endpoint, data.api_key_encrypted, data.api_username,
        data.pricing_model, data.base_rate,
        data.supports_tracking, data.supports_pickup, data.supports_international,
        data.average_delivery_days
      ]);

      logger.info(`Carrier created: ${data.carrier_code} by user ${req.user.id}`);

      res.status(201).json({
        success: true,
        message: 'Carrier created successfully',
        data: result.rows[0]
      });
    } catch (error) {
      logger.error('Create carrier error:', error);
      next(error);
    }
  }

  // Update carrier
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
        UPDATE shipping_carriers
        SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
        WHERE id = $${paramIndex}
        RETURNING *
      `, values);

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: 'Carrier not found'
        });
      }

      logger.info(`Carrier updated: ${id} by user ${req.user.id}`);

      res.json({
        success: true,
        message: 'Carrier updated successfully',
        data: result.rows[0]
      });
    } catch (error) {
      logger.error('Update carrier error:', error);
      next(error);
    }
  }

  // Get carrier services
  async getServices(req, res, next) {
    try {
      const { carrierId } = req.params;
      const { parsePagination } = require('../utils/pagination');
      const { page, limit, offset, sortBy, sortDir } = parsePagination(
        req.query,
        ['service_name','service_code','service_type','created_at','updated_at'],
        'service_name'
      );

      const query = `
        SELECT cs.*, COUNT(*) OVER() AS total_count
        FROM carrier_services cs
        WHERE cs.carrier_id = $1
        ORDER BY cs.${sortBy} ${sortDir}
        LIMIT $2 OFFSET $3
      `;
      const result = await db.query(query, [carrierId, limit, offset]);

      const total = result.rows.length ? Number(result.rows[0].total_count) : 0;
      res.json({ success: true, data: result.rows, pagination: { page, limit, total } });
    } catch (error) {
      logger.error('Get carrier services error:', error);
      next(error);
    }
  }

  // Create carrier service
  async createService(req, res, next) {
    try {
      const data = req.validatedBody;
      const id = uuidv4();

      const result = await db.query(`
        INSERT INTO carrier_services (
          id, carrier_id, service_code, service_name, service_type,
          estimated_delivery_days, base_cost,
          supports_tracking, supports_insurance, max_weight_kg,
          is_active
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true
        )
        RETURNING *
      `, [
        id, data.carrier_id, data.service_code, data.service_name, data.service_type,
        data.estimated_delivery_days, data.base_cost,
        data.supports_tracking, data.supports_insurance, data.max_weight_kg
      ]);

      logger.info(`Carrier service created: ${data.service_code} by user ${req.user.id}`);

      res.status(201).json({
        success: true,
        message: 'Carrier service created successfully',
        data: result.rows[0]
      });
    } catch (error) {
      logger.error('Create carrier service error:', error);
      next(error);
    }
  }

  // Delete carrier
  async delete(req, res, next) {
    try {
      const { id } = req.params;

      const result = await db.query(`
        UPDATE shipping_carriers
        SET is_active = false, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING id, carrier_name
      `, [id]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: 'Carrier not found'
        });
      }

      logger.info(`Carrier deleted: ${id} by user ${req.user.id}`);

      res.json({
        success: true,
        message: 'Carrier deleted successfully'
      });
    } catch (error) {
      logger.error('Delete carrier error:', error);
      next(error);
    }
  }
}

module.exports = new CarrierController();
