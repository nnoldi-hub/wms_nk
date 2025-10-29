const { pool } = require('../config/database');
const logger = require('../utils/logger');
const { AppError } = require('../middleware/errorHandler');

class OrderController {
  static async getOrders(req, res, next) {
    try {
      const { status, machine_id, limit = 50, offset = 0 } = req.query;
      let query = 'SELECT * FROM sewing_orders WHERE 1=1';
      const params = [];
      let paramIndex = 1;

      if (status) {
        query += ` AND status = $${paramIndex++}`;
        params.push(status);
      }
      if (machine_id) {
        query += ` AND machine_id = $${paramIndex++}`;
        params.push(machine_id);
      }

      query += ` ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
      params.push(limit, offset);

      const result = await pool.query(query, params);
      res.json({ orders: result.rows, count: result.rows.length });
    } catch (error) {
      next(error);
    }
  }

  static async createOrder(req, res, next) {
    try {
      const { cutting_order_id, machine_id, operator_id, estimated_time, notes } = req.body;
      
      const result = await pool.query(
        `INSERT INTO sewing_orders 
        (cutting_order_id, machine_id, operator_id, estimated_time, notes, status) 
        VALUES ($1, $2, $3, $4, $5, 'PENDING') 
        RETURNING *`,
        [cutting_order_id, machine_id, operator_id, estimated_time, notes]
      );

      logger.info(`Sewing order created: ${result.rows[0].id}`);
      res.status(201).json(result.rows[0]);
    } catch (error) {
      next(error);
    }
  }

  static async getOrderById(req, res, next) {
    try {
      const { id } = req.params;
      const result = await pool.query('SELECT * FROM sewing_orders WHERE id = $1', [id]);
      
      if (result.rows.length === 0) {
        throw new AppError('Sewing order not found', 404);
      }

      res.json(result.rows[0]);
    } catch (error) {
      next(error);
    }
  }

  static async updateOrder(req, res, next) {
    try {
      const { id } = req.params;
      const { status, actual_time, defects_count, rework_count } = req.body;
      
      const result = await pool.query(
        `UPDATE sewing_orders 
        SET status = COALESCE($1, status),
            actual_time = COALESCE($2, actual_time),
            defects_count = COALESCE($3, defects_count),
            rework_count = COALESCE($4, rework_count),
            updated_at = NOW()
        WHERE id = $5 
        RETURNING *`,
        [status, actual_time, defects_count, rework_count, id]
      );

      if (result.rows.length === 0) {
        throw new AppError('Sewing order not found', 404);
      }

      res.json(result.rows[0]);
    } catch (error) {
      next(error);
    }
  }

  static async addCheckpoint(req, res, next) {
    try {
      const { id } = req.params;
      const { checkpoint_type, passed, notes } = req.body;

      const result = await pool.query(
        `UPDATE sewing_orders 
        SET checkpoints = COALESCE(checkpoints, '[]'::jsonb) || 
            jsonb_build_object(
              'type', $1, 
              'passed', $2, 
              'notes', $3, 
              'timestamp', NOW()
            )::jsonb,
            updated_at = NOW()
        WHERE id = $4 
        RETURNING *`,
        [checkpoint_type, passed, notes, id]
      );

      if (result.rows.length === 0) {
        throw new AppError('Sewing order not found', 404);
      }

      logger.info(`Checkpoint added to order ${id}: ${checkpoint_type}`);
      res.json(result.rows[0]);
    } catch (error) {
      next(error);
    }
  }

  static async completeOrder(req, res, next) {
    try {
      const { id } = req.params;
      
      const result = await pool.query(
        `UPDATE sewing_orders 
        SET status = 'COMPLETED', 
            completed_at = NOW(),
            updated_at = NOW()
        WHERE id = $1 
        RETURNING *`,
        [id]
      );

      if (result.rows.length === 0) {
        throw new AppError('Sewing order not found', 404);
      }

      logger.info(`Sewing order completed: ${id}`);
      res.json(result.rows[0]);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = OrderController;
