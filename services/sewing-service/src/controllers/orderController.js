const { pool } = require('../config/database');
const logger = require('../utils/logger');
const { AppError } = require('../middleware/errorHandler');

class OrderController {
  static async getOrders(req, res, next) {
    try {
      const { status, limit = 50, offset = 0 } = req.query;
      let query = 'SELECT * FROM sewing_orders WHERE 1=1';
      const params = [];
      let paramIndex = 1;

      if (status) {
        query += ` AND status = $${paramIndex++}`;
        params.push(status);
      }

      query += ` ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
      params.push(limit, offset);

      const result = await pool.query(query, params);
      res.json({ success: true, data: result.rows });
    } catch (error) {
      next(error);
    }
  }

  static async createOrder(req, res, next) {
    try {
      const { product_sku, cutting_order_id, quantity, priority = 'NORMAL', notes } = req.body;
      
      const result = await pool.query(
        `INSERT INTO sewing_orders 
        (product_sku, cutting_order_id, quantity, priority, status, notes, created_at) 
        VALUES ($1, $2, $3, $4, 'PENDING', $5, NOW()) 
        RETURNING *`,
        [product_sku, cutting_order_id, quantity, priority, notes]
      );

      logger.info(`Sewing order created: ${result.rows[0].id}`);
      res.status(201).json({ success: true, data: result.rows[0] });
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

      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      next(error);
    }
  }

  static async updateOrder(req, res, next) {
    try {
      const { id } = req.params;
      const { status, worker_id, actual_quantity, defect_quantity, quality_notes, notes } = req.body;
      
      const result = await pool.query(
        `UPDATE sewing_orders 
        SET status = COALESCE($1, status),
            worker_id = COALESCE($2, worker_id),
            actual_quantity = COALESCE($3, actual_quantity),
            defect_quantity = COALESCE($4, defect_quantity),
            quality_notes = COALESCE($5, quality_notes),
            notes = COALESCE($6, notes),
            updated_at = NOW()
        WHERE id = $7 
        RETURNING *`,
        [status, worker_id, actual_quantity, defect_quantity, quality_notes, notes, id]
      );

      if (result.rows.length === 0) {
        throw new AppError('Sewing order not found', 404);
      }

      res.json({ success: true, data: result.rows[0] });
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
      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = OrderController;
