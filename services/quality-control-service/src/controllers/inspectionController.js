const { pool } = require('../config/database');
const logger = require('../utils/logger');
const { AppError } = require('../middleware/errorHandler');

class InspectionController {
  static async getInspections(req, res, next) {
    try {
      const { status } = req.query;
      let query = 'SELECT * FROM qc_inspections WHERE 1=1';
      const params = [];

      if (status) {
        query += ' AND status = $1';
        params.push(status);
      }

      query += ' ORDER BY created_at DESC';

      const result = await pool.query(query, params);
      res.json({ success: true, data: result.rows });
    } catch (error) {
      logger.error('Error fetching inspections:', error);
      next(error);
    }
  }

  static async createInspection(req, res, next) {
    try {
      const { sewing_order_id, inspector_id, defects_found, severity, inspection_notes, notes } = req.body;
      
      const result = await pool.query(
        `INSERT INTO qc_inspections 
        (sewing_order_id, inspector_id, defects_found, severity, inspection_notes, notes, status) 
        VALUES ($1, $2, $3, $4, $5, $6, 'IN_PROGRESS') 
        RETURNING *`,
        [sewing_order_id, inspector_id, defects_found || 0, severity, inspection_notes, notes]
      );

      logger.info(`QC inspection created: ${result.rows[0].id}`);
      res.status(201).json({ success: true, data: result.rows[0] });
    } catch (error) {
      logger.error('Error creating inspection:', error);
      next(error);
    }
  }

  static async getInspectionById(req, res, next) {
    try {
      const { id } = req.params;
      const result = await pool.query('SELECT * FROM qc_inspections WHERE id = $1', [id]);
      
      if (result.rows.length === 0) {
        throw new AppError('Inspection not found', 404);
      }

      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      logger.error('Error fetching inspection:', error);
      next(error);
    }
  }

  static async updateInspection(req, res, next) {
    try {
      const { id } = req.params;
      const { defects_found, severity, inspection_notes, notes } = req.body;
      
      const result = await pool.query(
        `UPDATE qc_inspections 
        SET defects_found = COALESCE($1, defects_found),
            severity = COALESCE($2, severity),
            inspection_notes = COALESCE($3, inspection_notes),
            notes = COALESCE($4, notes),
            updated_at = NOW()
        WHERE id = $5 
        RETURNING *`,
        [defects_found, severity, inspection_notes, notes, id]
      );

      if (result.rows.length === 0) {
        throw new AppError('Inspection not found', 404);
      }

      logger.info(`Inspection updated: ${id}`);
      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      logger.error('Error updating inspection:', error);
      next(error);
    }
  }

  static async passInspection(req, res, next) {
    try {
      const { id } = req.params;
      const { notes } = req.body;
      
      const result = await pool.query(
        `UPDATE qc_inspections 
        SET status = 'PASSED', 
            notes = COALESCE($1, notes),
            completed_at = NOW(),
            updated_at = NOW()
        WHERE id = $2 
        RETURNING *`,
        [notes, id]
      );

      if (result.rows.length === 0) {
        throw new AppError('Inspection not found', 404);
      }

      logger.info(`Inspection passed: ${id}`);
      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      logger.error('Error passing inspection:', error);
      next(error);
    }
  }

  static async failInspection(req, res, next) {
    try {
      const { id } = req.params;
      const { notes } = req.body;
      
      const result = await pool.query(
        `UPDATE qc_inspections 
        SET status = 'FAILED', 
            notes = COALESCE($1, notes),
            completed_at = NOW(),
            updated_at = NOW()
        WHERE id = $2 
        RETURNING *`,
        [notes, id]
      );

      if (result.rows.length === 0) {
        throw new AppError('Inspection not found', 404);
      }

      logger.info(`Inspection failed: ${id}`);
      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      logger.error('Error failing inspection:', error);
      next(error);
    }
  }
}

module.exports = InspectionController;
