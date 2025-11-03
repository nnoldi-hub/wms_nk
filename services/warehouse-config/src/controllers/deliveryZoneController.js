const db = require('../config/database');
const logger = require('../config/logger');
const { v4: uuidv4 } = require('uuid');

class DeliveryZoneController {
  // List zones for a warehouse
  async getAll(req, res, next) {
    try {
      const { warehouseId } = req.params;
      const { zone_type, is_active } = req.query;
      const { parsePagination } = require('../utils/pagination');
      const { page, limit, offset, sortBy, sortDir } = parsePagination(
        req.query,
        ['zone_code', 'zone_name', 'zone_type', 'created_at', 'updated_at'],
        'zone_code'
      );

      let query = `
        SELECT dz.*, 
               COUNT(zca.id) FILTER (WHERE zca.is_available = true) AS available_carriers,
               COUNT(zca.id) AS total_carriers,
               COUNT(*) OVER() AS total_count
        FROM delivery_zones dz
        LEFT JOIN zone_carrier_availability zca ON dz.id = zca.delivery_zone_id
        WHERE dz.warehouse_id = $1
      `;
      const params = [warehouseId];
      let i = 2;
      if (zone_type) { query += ` AND dz.zone_type = $${i++}`; params.push(zone_type); }
      if (is_active !== undefined) { query += ` AND dz.is_active = $${i++}`; params.push(is_active === 'true'); }
      query += ` GROUP BY dz.id ORDER BY dz.${sortBy} ${sortDir} LIMIT $${i++} OFFSET $${i++}`;
      params.push(limit, offset);

      const result = await db.query(query, params);
      const total = result.rows.length ? Number(result.rows[0].total_count) : 0;
      res.json({ success: true, data: result.rows, pagination: { page, limit, total } });
    } catch (error) {
      logger.error('Get delivery zones error:', error);
      next(error);
    }
  }

  // Get zone by id with carrier availability
  async getById(req, res, next) {
    try {
      const { id } = req.params;
      const zone = await db.query('SELECT * FROM delivery_zones WHERE id = $1', [id]);
      if (zone.rows.length === 0) return res.status(404).json({ error: 'Delivery zone not found' });

      const carriers = await db.query(`
        SELECT zca.*, sc.carrier_code, sc.carrier_name
        FROM zone_carrier_availability zca
        JOIN shipping_carriers sc ON sc.id = zca.carrier_id
        WHERE zca.delivery_zone_id = $1
        ORDER BY zca.priority ASC
      `, [id]);

      res.json({ success: true, data: { ...zone.rows[0], carriers: carriers.rows } });
    } catch (error) {
      logger.error('Get delivery zone error:', error);
      next(error);
    }
  }

  // Create zone
  async create(req, res, next) {
    try {
      const data = req.validatedBody || req.body;
      const id = uuidv4();
      const result = await db.query(`
        INSERT INTO delivery_zones (
          id, warehouse_id, zone_code, zone_name, zone_type,
          countries, regions, postal_code_patterns, cities,
          boundary_coordinates, min_order_value, free_shipping_threshold, max_delivery_days, is_active
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,true
        ) RETURNING *
      `, [
        id, data.warehouse_id, data.zone_code, data.zone_name, data.zone_type,
        data.countries ? JSON.stringify(data.countries) : null,
        data.regions ? JSON.stringify(data.regions) : null,
        data.postal_code_patterns ? JSON.stringify(data.postal_code_patterns) : null,
        data.cities ? JSON.stringify(data.cities) : null,
        data.boundary_coordinates ? JSON.stringify(data.boundary_coordinates) : null,
        data.min_order_value, data.free_shipping_threshold, data.max_delivery_days
      ]);
      logger.info(`Delivery zone created: ${data.zone_code} by user ${req.user.id}`);
      res.status(201).json({ success: true, message: 'Delivery zone created', data: result.rows[0] });
    } catch (error) {
      logger.error('Create delivery zone error:', error);
      next(error);
    }
  }

  // Update zone
  async update(req, res, next) {
    try {
      const { id } = req.params;
      const data = req.body;
      const keys = Object.keys(data);
      if (!keys.length) return res.status(400).json({ error: 'No fields to update' });
      const sets = keys.map((k, idx) => `${k} = $${idx + 1}`);
      const values = keys.map(k => data[k]);
      values.push(id);
      const result = await db.query(
        `UPDATE delivery_zones SET ${sets.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${values.length} RETURNING *`,
        values
      );
      if (!result.rows.length) return res.status(404).json({ error: 'Delivery zone not found' });
      logger.info(`Delivery zone updated: ${id} by user ${req.user.id}`);
      res.json({ success: true, message: 'Delivery zone updated', data: result.rows[0] });
    } catch (error) {
      logger.error('Update delivery zone error:', error);
      next(error);
    }
  }

  // Soft delete
  async delete(req, res, next) {
    try {
      const { id } = req.params;
      const result = await db.query('UPDATE delivery_zones SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING id', [id]);
      if (!result.rows.length) return res.status(404).json({ error: 'Delivery zone not found' });
      res.json({ success: true, message: 'Delivery zone deleted' });
    } catch (error) {
      logger.error('Delete delivery zone error:', error);
      next(error);
    }
  }

  // List carrier availability for a zone
  async getCarriers(req, res, next) {
    try {
      const { zoneId } = req.params;
      const result = await db.query(`
        SELECT zca.*, sc.carrier_code, sc.carrier_name
        FROM zone_carrier_availability zca
        JOIN shipping_carriers sc ON sc.id = zca.carrier_id
        WHERE zca.delivery_zone_id = $1
        ORDER BY zca.priority ASC
      `, [zoneId]);
      res.json({ success: true, data: result.rows });
    } catch (error) {
      logger.error('Get zone carriers error:', error);
      next(error);
    }
  }

  // Create or update carrier availability for a zone
  async upsertCarrier(req, res, next) {
    try {
      const { zoneId } = req.params;
      const { carrier_id, priority, estimated_delivery_days, cost_adjustment, is_available } = req.body;

      // Try update first
      const update = await db.query(`
        UPDATE zone_carrier_availability
        SET priority = COALESCE($3, priority),
            estimated_delivery_days = COALESCE($4, estimated_delivery_days),
            cost_adjustment = COALESCE($5, cost_adjustment),
            is_available = COALESCE($6, is_available)
        WHERE delivery_zone_id = $1 AND carrier_id = $2
        RETURNING *
      `, [zoneId, carrier_id, priority, estimated_delivery_days, cost_adjustment, is_available]);

      if (update.rows.length) {
        return res.json({ success: true, message: 'Carrier availability updated', data: update.rows[0] });
      }

      // Else insert
      const insert = await db.query(`
        INSERT INTO zone_carrier_availability (
          id, delivery_zone_id, carrier_id, priority, estimated_delivery_days, cost_adjustment, is_available
        ) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *
      `, [uuidv4(), zoneId, carrier_id, priority || 5, estimated_delivery_days || null, cost_adjustment || 0, is_available !== false]);

      res.status(201).json({ success: true, message: 'Carrier availability created', data: insert.rows[0] });
    } catch (error) {
      logger.error('Upsert zone carrier error:', error);
      next(error);
    }
  }
}

module.exports = new DeliveryZoneController();
