const db = require('../config/database');
const logger = require('../config/logger');
const { v4: uuidv4 } = require('uuid');

class VehicleController {
  // List vehicles with optional filters
  async getAll(req, res, next) {
    try {
  const { warehouse_id, status, has_refrigeration, is_active, q } = req.query;
      const { parsePagination } = require('../utils/pagination');
      const { page, limit, offset, sortBy, sortDir } = parsePagination(
        req.query,
        ['vehicle_code', 'created_at', 'updated_at', 'current_status', 'year'],
        'vehicle_code'
      );

      let query = `
        SELECT 
          v.*,
          (SELECT COUNT(*) FROM vehicle_maintenance_history vmh WHERE vmh.vehicle_id = v.id) AS maintenance_records,
          COUNT(*) OVER() AS total_count
        FROM internal_vehicles v
        WHERE 1=1
      `;
      const params = [];
      let i = 1;

      if (typeof is_active !== 'undefined') {
        query += ` AND v.is_active = $${i++}`;
        params.push(is_active === 'true');
      } else {
        query += ` AND v.is_active = true`;
      }

      if (warehouse_id) {
        query += ` AND v.warehouse_id = $${i++}`;
        params.push(warehouse_id);
      }
      if (status) {
        query += ` AND v.current_status = $${i++}`;
        params.push(status);
      }
      if (has_refrigeration !== undefined) {
        query += ` AND v.has_refrigeration = $${i++}`;
        params.push(has_refrigeration === 'true');
      }

      if (q) {
        query += ` AND (v.vehicle_code ILIKE $${i} OR v.license_plate ILIKE $${i} OR v.make ILIKE $${i} OR v.model ILIKE $${i})`;
        params.push(`%${q}%`);
        i++;
      }

      query += ` ORDER BY v.${sortBy} ${sortDir} LIMIT $${i++} OFFSET $${i++}`;
      params.push(limit, offset);

      const result = await db.query(query, params);
      const total = result.rows.length ? Number(result.rows[0].total_count) : 0;
      res.json({ success: true, data: result.rows, pagination: { page, limit, total } });
    } catch (error) {
      logger.error('Get vehicles error:', error);
      next(error);
    }
  }

  // Get single vehicle by id
  async getById(req, res, next) {
    try {
      const { id } = req.params;
      const result = await db.query('SELECT * FROM internal_vehicles WHERE id = $1', [id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Vehicle not found' });
      }

      const maintenance = await db.query(
        'SELECT * FROM vehicle_maintenance_history WHERE vehicle_id = $1 ORDER BY performed_at DESC NULLS LAST, created_at DESC',
        [id]
      );

      res.json({ success: true, data: { ...result.rows[0], maintenance: maintenance.rows } });
    } catch (error) {
      logger.error('Get vehicle error:', error);
      next(error);
    }
  }

  // Create vehicle
  async create(req, res, next) {
    try {
      const data = req.validatedBody || req.body;
      const id = uuidv4();

      const result = await db.query(`
        INSERT INTO internal_vehicles (
          id, warehouse_id, vehicle_code, vehicle_type,
          make, model, license_plate, year,
          max_weight_kg, max_volume_cubic_meters, max_pallets,
          has_refrigeration, has_lift_gate, has_gps,
          cost_per_km, cost_per_hour, fuel_consumption_l_per_100km,
          is_active
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,true
        ) RETURNING *
      `, [
        id, data.warehouse_id, data.vehicle_code, data.vehicle_type,
        data.make, data.model, data.license_plate, data.year,
        data.max_weight_kg, data.max_volume_cubic_meters, data.max_pallets,
        data.has_refrigeration, data.has_lift_gate, data.has_gps,
        data.cost_per_km, data.cost_per_hour, data.fuel_consumption_l_per_100km
      ]);

      logger.info(`Vehicle created: ${data.vehicle_code} by user ${req.user.id}`);
      res.status(201).json({ success: true, message: 'Vehicle created', data: result.rows[0] });
    } catch (error) {
      logger.error('Create vehicle error:', error);
      next(error);
    }
  }

  // Update vehicle (generic fields)
  async update(req, res, next) {
    try {
      const { id } = req.params;
      const data = req.body;

      const keys = Object.keys(data);
      if (keys.length === 0) return res.status(400).json({ error: 'No fields to update' });

      const sets = keys.map((k, idx) => `${k} = $${idx + 1}`);
      const values = keys.map(k => data[k]);
      values.push(id);

      const result = await db.query(
        `UPDATE internal_vehicles SET ${sets.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${values.length} RETURNING *`,
        values
      );
      if (result.rows.length === 0) return res.status(404).json({ error: 'Vehicle not found' });

      logger.info(`Vehicle updated: ${id} by user ${req.user.id}`);
      res.json({ success: true, message: 'Vehicle updated', data: result.rows[0] });
    } catch (error) {
      logger.error('Update vehicle error:', error);
      next(error);
    }
  }

  // Update only status or assignment
  async updateStatus(req, res, next) {
    try {
      const { id } = req.params;
      const { current_status, assigned_driver_id } = req.body;
      const result = await db.query(
        `UPDATE internal_vehicles
         SET current_status = COALESCE($1, current_status),
             assigned_driver_id = COALESCE($2, assigned_driver_id),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $3 RETURNING *`,
        [current_status, assigned_driver_id, id]
      );
      if (result.rows.length === 0) return res.status(404).json({ error: 'Vehicle not found' });
      res.json({ success: true, message: 'Vehicle status updated', data: result.rows[0] });
    } catch (error) {
      logger.error('Update vehicle status error:', error);
      next(error);
    }
  }

  // Add maintenance record
  async addMaintenance(req, res, next) {
    try {
      const { id } = req.params; // vehicle id
      const { maintenance_type, description, cost, odometer_km, performed_at, performed_by, next_maintenance_date } = req.body;

      const exists = await db.query('SELECT id FROM internal_vehicles WHERE id = $1', [id]);
      if (exists.rows.length === 0) return res.status(404).json({ error: 'Vehicle not found' });

      const rec = await db.query(
        `INSERT INTO vehicle_maintenance_history (
           id, vehicle_id, maintenance_type, description, cost, odometer_km, performed_at, performed_by, next_maintenance_date
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [uuidv4(), id, maintenance_type, description, cost, odometer_km, performed_at, performed_by, next_maintenance_date]
      );

      res.status(201).json({ success: true, message: 'Maintenance record added', data: rec.rows[0] });
    } catch (error) {
      logger.error('Add maintenance error:', error);
      next(error);
    }
  }

  // List maintenance history
  async listMaintenance(req, res, next) {
    try {
      const { id } = req.params; // vehicle id
      const result = await db.query(
        'SELECT * FROM vehicle_maintenance_history WHERE vehicle_id = $1 ORDER BY performed_at DESC NULLS LAST, created_at DESC',
        [id]
      );
      res.json({ success: true, data: result.rows });
    } catch (error) {
      logger.error('List maintenance error:', error);
      next(error);
    }
  }

  // Soft delete
  async delete(req, res, next) {
    try {
      const { id } = req.params;
      const result = await db.query(
        'UPDATE internal_vehicles SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING id',
        [id]
      );
      if (result.rows.length === 0) return res.status(404).json({ error: 'Vehicle not found' });
      res.json({ success: true, message: 'Vehicle deleted' });
    } catch (error) {
      logger.error('Delete vehicle error:', error);
      next(error);
    }
  }
}

module.exports = new VehicleController();
