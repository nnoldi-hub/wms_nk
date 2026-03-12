const { pool } = require('../config/database');
const logger = require('../utils/logger');

class DrumTypesController {
  // GET /api/v1/drum-types
  static async list(_req, res, next) {
    try {
      const result = await pool.query(
        'SELECT * FROM drum_types WHERE is_active = TRUE ORDER BY unit_price, code'
      );
      res.json({ success: true, data: result.rows });
    } catch (error) {
      next(error);
    }
  }

  // POST /api/v1/drum-types
  static async create(req, res, next) {
    try {
      const { code, name, capacity_meters, tare_weight_kg, diameter_mm, width_mm, unit_price, notes } = req.body;
      if (!code || !name) {
        return res.status(400).json({ success: false, message: 'code si name sunt obligatorii' });
      }
      const result = await pool.query(
        `INSERT INTO drum_types (code, name, capacity_meters, tare_weight_kg, diameter_mm, width_mm, unit_price, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         RETURNING *`,
        [code.toUpperCase(), name, capacity_meters || null, tare_weight_kg || null,
         diameter_mm || null, width_mm || null, unit_price || 0, notes || null]
      );
      res.status(201).json({ success: true, data: result.rows[0] });
    } catch (error) {
      if (error.code === '23505') {
        return res.status(409).json({ success: false, message: `Tipul ${req.body.code} exista deja` });
      }
      logger.error('DrumTypes create error:', error);
      next(error);
    }
  }
}

module.exports = DrumTypesController;
