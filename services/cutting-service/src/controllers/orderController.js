const db = require('../config/database');
const logger = require('../utils/logger');
const { AppError } = require('../middleware/errorHandler');
const axios = require('axios');

const INVENTORY_SERVICE_URL = process.env.INVENTORY_SERVICE_URL || 'http://localhost:3011';

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

  // NEW: Suggest source batch for cutting order
  async suggestSource(req, res, next) {
    try {
      const { id } = req.params;
      const { method = 'MIN_WASTE', preferred_location } = req.query;

      // Get cutting order details
      const orderResult = await db.query(
        'SELECT * FROM cutting_orders WHERE id = $1',
        [id]
      );

      if (orderResult.rows.length === 0) {
        throw new AppError('Cutting order not found', 404);
      }

      const order = orderResult.rows[0];

      // Call Inventory Service to get optimal batch
      const inventoryUrl = `${INVENTORY_SERVICE_URL}/api/v1/batches/select`;
      const params = {
        product_sku: order.product_sku,
        required_quantity: order.quantity,
        method,
        preferred_location
      };

      logger.info('Calling Inventory Service:', { url: inventoryUrl, params });

      const response = await axios.get(inventoryUrl, { params });

      logger.info('Batch suggestion received:', response.data.selectedBatch?.batch_number);

      res.json({
        success: true,
        order: {
          id: order.id,
          order_number: order.order_number,
          product_sku: order.product_sku,
          quantity: order.quantity
        },
        suggestion: response.data
      });
    } catch (error) {
      if (error.response) {
        logger.error('Inventory Service error:', error.response.data);
        throw new AppError(error.response.data.error || 'Failed to get batch suggestion', error.response.status);
      }
      next(error);
    }
  }

  // NEW: Execute cutting order with batch tracking
  async executeOrder(req, res, next) {
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');

      const { id } = req.params;
      const { 
        source_batch_id, 
        selection_method = 'MANUAL',
        actual_quantity,
        waste_quantity = 0,
        worker_id,
        notes
      } = req.body;

      // Get cutting order
      const orderResult = await client.query(
        'SELECT * FROM cutting_orders WHERE id = $1',
        [id]
      );

      if (orderResult.rows.length === 0) {
        throw new AppError('Cutting order not found', 404);
      }

      const order = orderResult.rows[0];

      if (!source_batch_id) {
        throw new AppError('source_batch_id is required', 400);
      }

      // Create transformation in Inventory Service
      const transformationData = {
        type: 'CUT',
        source_batch_id,
        source_quantity: order.quantity,
        result_quantity: actual_quantity || order.quantity,
        waste_quantity: waste_quantity || 0,
        cutting_order_id: order.id,
        selection_method,
        notes: notes || `Cutting order ${order.order_number}`
      };

      logger.info('Creating transformation:', transformationData);

      const transformationResponse = await axios.post(
        `${INVENTORY_SERVICE_URL}/api/v1/transformations`,
        transformationData
      );

      const transformation = transformationResponse.data.data;

      logger.info('Transformation created:', transformation.transformation_number);

      // Update cutting order with batch tracking info
      const updateResult = await client.query(
        `UPDATE cutting_orders 
         SET status = 'IN_PROGRESS',
             source_batch_id = $1,
             selection_method = $2,
             transformation_id = $3,
             worker_id = $4,
             actual_quantity = $5,
             waste_quantity = $6,
             started_at = COALESCE(started_at, NOW()),
             updated_at = NOW()
         WHERE id = $7
         RETURNING *`,
        [
          source_batch_id,
          selection_method,
          transformation.id,
          worker_id,
          actual_quantity || order.quantity,
          waste_quantity || 0,
          id
        ]
      );

      await client.query('COMMIT');

      logger.info('Cutting order executed:', order.order_number);

      res.json({
        success: true,
        data: {
          order: updateResult.rows[0],
          transformation
        }
      });
    } catch (error) {
      await client.query('ROLLBACK');
      if (error.response) {
        logger.error('Inventory Service error:', error.response.data);
        throw new AppError(error.response.data.error || 'Failed to execute cutting order', error.response.status);
      }
      next(error);
    } finally {
      client.release();
    }
  }
}

module.exports = new OrderController();
