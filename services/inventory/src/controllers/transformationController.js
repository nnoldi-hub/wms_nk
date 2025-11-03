const { pool } = require('../config/database');
const logger = require('../utils/logger');
const { AppError } = require('../middleware/errorHandler');

class TransformationController {
  // Get all transformations with filters
  static async getAllTransformations(req, res, next) {
    try {
      const { type, product_sku, date_from, date_to, limit = 50, offset = 0 } = req.query;
      
      let query = `
        SELECT t.*, 
               sb.batch_number as source_batch_number,
               sb.product_sku as source_product,
               rb.batch_number as result_batch_number,
               u.username as performed_by_name
        FROM product_transformations t
        LEFT JOIN product_batches sb ON t.source_batch_id = sb.id
        LEFT JOIN product_batches rb ON t.result_batch_id = rb.id
        LEFT JOIN users u ON t.performed_by = u.id
        WHERE 1=1
      `;
      const params = [];
      let paramIndex = 1;

      if (type) {
        query += ` AND t.type = $${paramIndex++}`;
        params.push(type);
      }
      if (product_sku) {
        query += ` AND sb.product_sku = $${paramIndex++}`;
        params.push(product_sku);
      }
      if (date_from) {
        query += ` AND t.performed_at >= $${paramIndex++}`;
        params.push(date_from);
      }
      if (date_to) {
        query += ` AND t.performed_at <= $${paramIndex++}`;
        params.push(date_to);
      }

      query += ` ORDER BY t.performed_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
      params.push(limit, offset);

      const result = await pool.query(query, params);
      
      res.json({ success: true, data: result.rows });
    } catch (error) {
      logger.error('Error fetching transformations:', error);
      next(error);
    }
  }

  // Get transformation by ID
  static async getTransformationById(req, res, next) {
    try {
      const { id } = req.params;
      
      const result = await pool.query(`
        SELECT t.*, 
               sb.batch_number as source_batch_number,
               sb.product_sku as source_product,
               sb.current_quantity as source_current_quantity,
               rb.batch_number as result_batch_number,
               rb.current_quantity as result_current_quantity,
               u.username as performed_by_name,
               co.order_number as cutting_order_number
        FROM product_transformations t
        LEFT JOIN product_batches sb ON t.source_batch_id = sb.id
        LEFT JOIN product_batches rb ON t.result_batch_id = rb.id
        LEFT JOIN users u ON t.performed_by = u.id
        LEFT JOIN cutting_orders co ON t.cutting_order_id = co.id
        WHERE t.id = $1
      `, [id]);

      if (result.rows.length === 0) {
        throw new AppError('Transformation not found', 404);
      }

      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      logger.error('Error fetching transformation:', error);
      next(error);
    }
  }

  // Create transformation
  static async createTransformation(req, res, next) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      const {
        type,
        source_batch_id,
        source_quantity,
        result_batch_id,
        result_quantity,
        waste_quantity,
        cutting_order_id,
        performed_by,
        selection_method,
        notes
      } = req.body;

      // Validate required fields
      if (!type || !source_batch_id || !source_quantity) {
        throw new AppError('Missing required fields: type, source_batch_id, source_quantity', 400);
      }

      // Create transformation record
      const transformationResult = await client.query(`
        INSERT INTO product_transformations
        (type, source_batch_id, source_quantity, result_batch_id, result_quantity, 
         waste_quantity, cutting_order_id, performed_by, selection_method, notes)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `, [
        type,
        source_batch_id,
        source_quantity,
        result_batch_id,
        result_quantity,
        waste_quantity || 0,
        cutting_order_id,
        performed_by,
        selection_method,
        notes
      ]);

      const transformation = transformationResult.rows[0];

      // Update source batch quantity and status
      await client.query(`
        UPDATE product_batches
        SET current_quantity = current_quantity - $1,
            status = CASE 
              WHEN current_quantity - $1 = 0 THEN 'EMPTY'
              WHEN current_quantity - $1 < initial_quantity THEN 'CUT'
              ELSE status
            END,
            updated_at = NOW()
        WHERE id = $2
      `, [source_quantity, source_batch_id]);

      // Update result batch if provided
      if (result_batch_id) {
        await client.query(`
          UPDATE product_batches
          SET transformation_id = $1, source_batch_id = $2
          WHERE id = $3
        `, [transformation.id, source_batch_id, result_batch_id]);
      }

      await client.query('COMMIT');

      logger.info(`Transformation created: ${transformation.transformation_number}`);
      res.status(201).json({ success: true, data: transformation });
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error creating transformation:', error);
      next(error);
    } finally {
      client.release();
    }
  }

  // Get transformation statistics
  static async getTransformationStatistics(req, res, next) {
    try {
      const result = await pool.query(`
        SELECT 
          COUNT(*) as total_transformations,
          COUNT(*) FILTER (WHERE type = 'CUT') as cut_count,
          COUNT(*) FILTER (WHERE type = 'REPACK') as repack_count,
          COUNT(*) FILTER (WHERE type = 'CONVERT') as convert_count,
          SUM(waste_quantity) as total_waste,
          AVG(waste_quantity) as avg_waste,
          SUM(result_quantity) as total_result_quantity
        FROM product_transformations
        WHERE performed_at >= NOW() - INTERVAL '30 days'
      `);

      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      logger.error('Error fetching transformation statistics:', error);
      next(error);
    }
  }

  // Get transformation tree (source batch -> transformations -> result batches)
  static async getTransformationTree(req, res, next) {
    try {
      const { batch_id } = req.params;

      // Get source batch info
      const batchResult = await pool.query(`
        SELECT * FROM product_batches WHERE id = $1
      `, [batch_id]);

      if (batchResult.rows.length === 0) {
        throw new AppError('Batch not found', 404);
      }

      const sourceBatch = batchResult.rows[0];

      // Get all transformations from this batch
      const transformationsResult = await pool.query(`
        SELECT t.*, rb.batch_number as result_batch_number
        FROM product_transformations t
        LEFT JOIN product_batches rb ON t.result_batch_id = rb.id
        WHERE t.source_batch_id = $1
        ORDER BY t.performed_at ASC
      `, [batch_id]);

      // Get all batches created from transformations
      const resultBatchesResult = await pool.query(`
        SELECT * FROM product_batches 
        WHERE source_batch_id = $1
      `, [batch_id]);

      res.json({
        success: true,
        data: {
          source_batch: sourceBatch,
          transformations: transformationsResult.rows,
          result_batches: resultBatchesResult.rows
        }
      });
    } catch (error) {
      logger.error('Error fetching transformation tree:', error);
      next(error);
    }
  }

  // Set/Update result batch for an existing transformation
  static async setTransformationResult(req, res, next) {
    const client = await pool.connect();
    try {
      const { id } = req.params;
      const { result_batch_id, result_quantity, notes } = req.body;

      if (!result_batch_id || result_quantity === undefined) {
        throw new AppError('Missing required fields: result_batch_id, result_quantity', 400);
      }

      await client.query('BEGIN');

      // Ensure transformation exists and get source info
      const trRes = await client.query(
        `SELECT id, source_batch_id, source_quantity FROM product_transformations WHERE id = $1`,
        [id]
      );
      if (trRes.rows.length === 0) {
        throw new AppError('Transformation not found', 404);
      }
      const tr = trRes.rows[0];

      // Compute waste if not provided (source - result, not less than 0)
      const waste = Math.max(0, Number(tr.source_quantity || 0) - Number(result_quantity || 0));

      // Update transformation with result info
      const updRes = await client.query(
        `UPDATE product_transformations
         SET result_batch_id = $1,
             result_quantity = $2,
             waste_quantity = COALESCE(waste_quantity, $3),
             notes = COALESCE(notes, $4),
             updated_at = NOW()
         WHERE id = $5
         RETURNING *`,
        [result_batch_id, result_quantity, waste, notes || null, id]
      );
      const updated = updRes.rows[0];

      // Link batch back to transformation & source batch
      await client.query(
        `UPDATE product_batches
         SET transformation_id = $1, source_batch_id = $2, updated_at = NOW()
         WHERE id = $3`,
        [updated.id, tr.source_batch_id, result_batch_id]
      );

      await client.query('COMMIT');
      return res.json({ success: true, data: updated });
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error setting transformation result:', error);
      next(error);
    } finally {
      client.release();
    }
  }
}

module.exports = TransformationController;
