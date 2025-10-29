const db = require('../config/database');
const logger = require('../utils/logger');
const { AppError } = require('../middleware/errorHandler');

class OrderController {
  async getOrders(req, res, next) {
    try {
      const { status, limit = 20, offset = 0 } = req.query;
      let query = 'SELECT * FROM cutting_orders WHERE 1=1';
      const params = [];
      
      if (status) {
        params.push(status);
        query += ` AND status = $${params.length}`;
      }
      
      query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(limit, offset);
      
      const result = await db.query(query, params);
      res.json({ success: true, data: result.rows });
    } catch (error) {
      next(error);
    }
  }

  async createOrder(req, res, next) {
    try {
      const { product_sku, quantity, pattern_id, notes } = req.body;
      
      const result = await db.query(
        `INSERT INTO cutting_orders (product_sku, quantity, pattern_id, status, notes, created_at)
         VALUES ($1, $2, $3, 'PENDING', $4, NOW())
         RETURNING *`,
        [product_sku, quantity, pattern_id, notes]
      );
      
      logger.info('Cutting order created:', result.rows[0].id);
      res.status(201).json({ success: true, data: result.rows[0] });
    } catch (error) {
      next(error);
    }
  }

  async getOrderById(req, res, next) {
    try {
      const result = await db.query(
        'SELECT * FROM cutting_orders WHERE id = $1',
        [req.params.id]
      );
      
      if (result.rows.length === 0) {
        throw new AppError('Order not found', 404);
      }
      
      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      next(error);
    }
  }

  async updateOrder(req, res, next) {
    try {
      const { status, worker_id, actual_quantity, waste_quantity } = req.body;
      
      const result = await db.query(
        `UPDATE cutting_orders 
         SET status = COALESCE($1, status),
             worker_id = COALESCE($2, worker_id),
             actual_quantity = COALESCE($3, actual_quantity),
             waste_quantity = COALESCE($4, waste_quantity),
             updated_at = NOW()
         WHERE id = $5
         RETURNING *`,
        [status, worker_id, actual_quantity, waste_quantity, req.params.id]
      );
      
      if (result.rows.length === 0) {
        throw new AppError('Order not found', 404);
      }
      
      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      next(error);
    }
  }

  async completeOrder(req, res, next) {
    try {
      const result = await db.query(
        `UPDATE cutting_orders 
         SET status = 'COMPLETED', completed_at = NOW(), updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [req.params.id]
      );
      
      if (result.rows.length === 0) {
        throw new AppError('Order not found', 404);
      }
      
      logger.info('Cutting order completed:', req.params.id);
      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new OrderController();
