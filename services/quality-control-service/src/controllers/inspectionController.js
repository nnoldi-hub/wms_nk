const { pool } = require('../config/database');
const logger = require('../utils/logger');
const { AppError } = require('../middleware/errorHandler');

class InspectionController {
  static async getInspections(req, res, next) {
    try {
      const { status, inspector_id, limit = 50, offset = 0 } = req.query;
      let query = 'SELECT * FROM qc_inspections WHERE 1=1';
      const params = [];
      let paramIndex = 1;

      if (status) {
        query += ` AND status = $${paramIndex++}`;
        params.push(status);
      }
      if (inspector_id) {
        query += ` AND inspector_id = $${paramIndex++}`;
        params.push(inspector_id);
      }

      query += ` ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
      params.push(limit, offset);

      const result = await pool.query(query, params);
      res.json({ inspections: result.rows, count: result.rows.length });
    } catch (error) {
      next(error);
    }
  }

  static async createInspection(req, res, next) {
    try {
      const { sewing_order_id, inspector_id, inspection_type, checklist } = req.body;
      
      const result = await pool.query(
        `INSERT INTO qc_inspections 
        (sewing_order_id, inspector_id, inspection_type, checklist, status) 
        VALUES ($1, $2, $3, $4, 'IN_PROGRESS') 
        RETURNING *`,
        [sewing_order_id, inspector_id, inspection_type, JSON.stringify(checklist)]
      );

      logger.info(`QC inspection created: ${result.rows[0].id}`);
      res.status(201).json(result.rows[0]);
    } catch (error) {
      next(error);
    }
  }

  static async getInspectionById(req, res, next) {
    try {
      const { id } = req.params;
      const inspection = await pool.query('SELECT * FROM qc_inspections WHERE id = $1', [id]);
      
      if (inspection.rows.length === 0) {
        throw new AppError('Inspection not found', 404);
      }

      const defects = await pool.query('SELECT * FROM qc_defects WHERE inspection_id = $1', [id]);
      
      res.json({ ...inspection.rows[0], defects: defects.rows });
    } catch (error) {
      next(error);
    }
  }

  static async addDefect(req, res, next) {
    try {
      const { id } = req.params;
      const { defect_type, severity, location, description, image_url } = req.body;
      
      const result = await pool.query(
        `INSERT INTO qc_defects 
        (inspection_id, defect_type, severity, location, description, image_url) 
        VALUES ($1, $2, $3, $4, $5, $6) 
        RETURNING *`,
        [id, defect_type, severity, location, description, image_url]
      );

      await pool.query(
        `UPDATE qc_inspections 
        SET defects_count = defects_count + 1, updated_at = NOW() 
        WHERE id = $1`,
        [id]
      );

      logger.info(`Defect added to inspection ${id}: ${defect_type}`);
      res.status(201).json(result.rows[0]);
    } catch (error) {
      next(error);
    }
  }

  static async approveInspection(req, res, next) {
    try {
      const { id } = req.params;
      const { notes } = req.body;
      
      const result = await pool.query(
        `UPDATE qc_inspections 
        SET status = 'APPROVED', 
            notes = $1,
            completed_at = NOW(),
            updated_at = NOW()
        WHERE id = $2 
        RETURNING *`,
        [notes, id]
      );

      if (result.rows.length === 0) {
        throw new AppError('Inspection not found', 404);
      }

      logger.info(`Inspection approved: ${id}`);
      res.json(result.rows[0]);
    } catch (error) {
      next(error);
    }
  }

  static async rejectInspection(req, res, next) {
    try {
      const { id } = req.params;
      const { reason, rework_required } = req.body;
      
      const result = await pool.query(
        `UPDATE qc_inspections 
        SET status = 'REJECTED', 
            rejection_reason = $1,
            rework_required = $2,
            completed_at = NOW(),
            updated_at = NOW()
        WHERE id = $3 
        RETURNING *`,
        [reason, rework_required, id]
      );

      if (result.rows.length === 0) {
        throw new AppError('Inspection not found', 404);
      }

      logger.info(`Inspection rejected: ${id}`);
      res.json(result.rows[0]);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = InspectionController;
