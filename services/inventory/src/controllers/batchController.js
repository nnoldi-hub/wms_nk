const { pool } = require('../config/database');
const logger = require('../utils/logger');
const { AppError } = require('../middleware/errorHandler');
const BatchSelectionService = require('../services/batchSelectionService');
const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');

class BatchController {
  // Get all batches with filters
  static async getAllBatches(req, res, next) {
    try {
      const { status, product_sku, location_id, limit = 50, offset = 0 } = req.query;
      
      let query = `
        SELECT b.*, u.code as unit_code, u.name as unit_name, p.name as product_name
        FROM product_batches b
        LEFT JOIN product_units u ON b.unit_id = u.id
        LEFT JOIN products p ON b.product_sku = p.sku
        WHERE 1=1
      `;
      const params = [];
      let paramIndex = 1;

      if (status) {
        query += ` AND b.status = $${paramIndex++}`;
        params.push(status);
      }
      if (product_sku) {
        query += ` AND b.product_sku = $${paramIndex++}`;
        params.push(product_sku);
      }
      if (location_id) {
        query += ` AND b.location_id = $${paramIndex++}`;
        params.push(location_id);
      }

      query += ` ORDER BY b.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
      params.push(limit, offset);

      const result = await pool.query(query, params);
      
      res.json({ success: true, data: result.rows });
    } catch (error) {
      logger.error('Error fetching batches:', error);
      next(error);
    }
  }

  // Get batch by ID
  static async getBatchById(req, res, next) {
    try {
      const { id } = req.params;
      
      const result = await pool.query(`
        SELECT b.*, u.code as unit_code, u.name as unit_name, p.name as product_name,
               l.zone, l.rack, l.position
        FROM product_batches b
        LEFT JOIN product_units u ON b.unit_id = u.id
        LEFT JOIN products p ON b.product_sku = p.sku
        LEFT JOIN locations l ON b.location_id = l.id
        WHERE b.id = $1
      `, [id]);

      if (result.rows.length === 0) {
        throw new AppError('Batch not found', 404);
      }

      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      logger.error('Error fetching batch:', error);
      next(error);
    }
  }

  // Get batches by product SKU
  static async getBatchesByProduct(req, res, next) {
    try {
      const { sku } = req.params;
      const { status } = req.query;
      
      let query = `
        SELECT b.*, u.code as unit_code, u.name as unit_name
        FROM product_batches b
        LEFT JOIN product_units u ON b.unit_id = u.id
        WHERE b.product_sku = $1
      `;
      const params = [sku];

      if (status) {
        query += ' AND b.status = $2';
        params.push(status);
      }

      query += ' ORDER BY b.received_at ASC';

      const result = await pool.query(query, params);
      
      res.json({ success: true, data: result.rows });
    } catch (error) {
      logger.error('Error fetching batches by product:', error);
      next(error);
    }
  }

  // Create new batch
  static async createBatch(req, res, next) {
    try {
      const {
        product_sku,
        unit_id,
        initial_quantity,
        current_quantity,
        length_meters,
        weight_kg,
        location_id,
        notes
      } = req.body;

      // Validate required fields
      if (!product_sku || !unit_id || !initial_quantity) {
        throw new AppError('Missing required fields: product_sku, unit_id, initial_quantity', 400);
      }

      const result = await pool.query(`
        INSERT INTO product_batches 
        (product_sku, unit_id, initial_quantity, current_quantity, length_meters, weight_kg, location_id, notes, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'INTACT')
        RETURNING *
      `, [
        product_sku,
        unit_id,
        initial_quantity,
        current_quantity || initial_quantity,
        length_meters,
        weight_kg,
        location_id,
        notes
      ]);

      logger.info(`Batch created: ${result.rows[0].batch_number}`);
      res.status(201).json({ success: true, data: result.rows[0] });
    } catch (error) {
      logger.error('Error creating batch:', error);
      next(error);
    }
  }

  // Update batch
  static async updateBatch(req, res, next) {
    try {
      const { id } = req.params;
      const {
        current_quantity,
        status,
        location_id,
        notes,
        opened_at,
        emptied_at
      } = req.body;

      // Build dynamic update query
      const updates = [];
      const params = [];
      let paramIndex = 1;

      if (current_quantity !== undefined) {
        updates.push(`current_quantity = $${paramIndex++}`);
        params.push(current_quantity);
      }
      if (status) {
        updates.push(`status = $${paramIndex++}`);
        params.push(status);
      }
      if (location_id !== undefined) {
        updates.push(`location_id = $${paramIndex++}`);
        params.push(location_id);
      }
      if (notes !== undefined) {
        updates.push(`notes = $${paramIndex++}`);
        params.push(notes);
      }
      if (opened_at !== undefined) {
        updates.push(`opened_at = $${paramIndex++}`);
        params.push(opened_at);
      }
      if (emptied_at !== undefined) {
        updates.push(`emptied_at = $${paramIndex++}`);
        params.push(emptied_at);
      }

      if (updates.length === 0) {
        throw new AppError('No fields to update', 400);
      }

      updates.push(`updated_at = NOW()`);
      params.push(id);

      const query = `
        UPDATE product_batches 
        SET ${updates.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `;

      const result = await pool.query(query, params);

      if (result.rows.length === 0) {
        throw new AppError('Batch not found', 404);
      }

      logger.info(`Batch updated: ${result.rows[0].batch_number}`);
      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      logger.error('Error updating batch:', error);
      next(error);
    }
  }

  // Delete batch (soft delete - mark as EMPTY)
  static async deleteBatch(req, res, next) {
    try {
      const { id } = req.params;

      const result = await pool.query(`
        UPDATE product_batches 
        SET status = 'EMPTY', emptied_at = NOW(), updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `, [id]);

      if (result.rows.length === 0) {
        throw new AppError('Batch not found', 404);
      }

      logger.info(`Batch marked as EMPTY: ${result.rows[0].batch_number}`);
      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      logger.error('Error deleting batch:', error);
      next(error);
    }
  }

  // Get batch statistics
  static async getBatchStatistics(req, res, next) {
    try {
      const result = await pool.query(`
        SELECT 
          COUNT(*) as total_batches,
          COUNT(*) FILTER (WHERE status = 'INTACT') as intact_batches,
          COUNT(*) FILTER (WHERE status = 'CUT') as cut_batches,
          COUNT(*) FILTER (WHERE status = 'EMPTY') as empty_batches,
          SUM(current_quantity) as total_quantity,
          SUM(initial_quantity - current_quantity) as consumed_quantity
        FROM product_batches
      `);

      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      logger.error('Error fetching batch statistics:', error);
      next(error);
    }
  }

  // Select optimal batch (FIFO, MIN_WASTE, etc.)
  static async selectOptimalBatch(req, res, next) {
    try {
      const { product_sku, required_quantity, method = 'FIFO', preferred_location } = req.query;

      if (!product_sku || !required_quantity) {
        throw new AppError('Missing required parameters: product_sku, required_quantity', 400);
      }

      const result = await BatchSelectionService.selectOptimalBatch(
        product_sku,
        parseFloat(required_quantity),
        method,
        { preferredLocation: preferred_location }
      );

      if (!result.success) {
        return res.status(404).json(result);
      }

      res.json(result);
    } catch (error) {
      logger.error('Error selecting batch:', error);
      next(error);
    }
  }

  // GET /api/v1/batches/by-number/:batchNumber  — cautare batch dupa batch_number (pentru scan QR)
  static async getByBatchNumber(req, res, next) {
    try {
      const { batchNumber } = req.params;
      const result = await pool.query(
        `SELECT b.*, u.code as unit_code, u.name as unit_name,
                p.name as product_name,
                gr.nir_number, gr.supplier_name, gr.receipt_date,
                l.location_code, l.zone, l.rack, l.position
         FROM product_batches b
         LEFT JOIN product_units u  ON u.id = b.unit_id
         LEFT JOIN products p       ON p.sku = b.product_sku
         LEFT JOIN goods_receipt_lines grl ON grl.batch_id = b.id
         LEFT JOIN goods_receipts gr       ON gr.id = grl.receipt_id
         LEFT JOIN locations l             ON l.id = b.location_id
         WHERE b.batch_number = $1
         LIMIT 1`,
        [batchNumber]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Batch negasit: ' + batchNumber });
      }
      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      logger.error('Error fetching batch by number:', error);
      next(error);
    }
  }

  // GET /api/v1/batches/pending-putaway
  // Returneaza batches create din NIR-uri confirmate care nu au inca o locatie asignata
  static async getPendingPutaway(req, res, next) {
    try {
      const { limit = 100 } = req.query;
      const result = await pool.query(
        `SELECT
           b.id,
           b.batch_number,
           b.product_sku,
           b.current_quantity,
           b.length_meters,
           b.status,
           b.notes,
           b.created_at,
           p.name  AS product_name,
           gr.nir_number,
           gr.supplier_name,
           gr.receipt_date,
           gr.id   AS goods_receipt_id,
           grl.unit,
           grl.cant_received
         FROM product_batches b
         JOIN products p                  ON p.sku = b.product_sku
         JOIN goods_receipt_lines grl     ON grl.batch_id = b.id
         JOIN goods_receipts gr           ON gr.id = grl.receipt_id
         WHERE b.location_id IS NULL
           AND b.status = 'INTACT'
           AND gr.status = 'CONFIRMED'
         ORDER BY b.created_at DESC
         LIMIT $1`,
        [parseInt(limit)]
      );
      res.json({ success: true, data: result.rows });
    } catch (error) {
      logger.error('Error fetching pending putaway batches:', error);
      next(error);
    }
  }

  // GET /api/v1/batches/:id/label.pdf
  // Generates a single A6-sized label PDF for a batch (SKU, lot, qty, weight, QR)
  static async batchLabelPdf(req, res, next) {
    try {
      const { id } = req.params;
      const result = await pool.query(`
        SELECT b.*, p.name AS product_name, l.zone, l.rack, l.position
        FROM product_batches b
        LEFT JOIN products p ON p.sku = b.product_sku
        LEFT JOIN locations l ON l.id = b.location_id
        WHERE b.id = $1
      `, [id]);

      if (result.rows.length === 0) throw new AppError('Batch not found', 404);
      const b = result.rows[0];

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename=batch_${b.batch_number}_label.pdf`);

      // A6 landscape: 420 x 297 pt
      const doc = new PDFDocument({ size: [420, 297], margin: 16 });
      doc.pipe(res);

      const qrPayload = JSON.stringify({
        t: 'BATCH',
        id: b.id,
        batch: b.batch_number,
        sku: b.product_sku,
        qty: b.current_quantity,
      });

      // QR code top-right
      try {
        const qrPng = await QRCode.toBuffer(qrPayload, { type: 'png', margin: 0, width: 100, errorCorrectionLevel: 'M' });
        doc.image(qrPng, 420 - 16 - 100, 16, { width: 100, height: 100 });
      } catch (_) { /* skip QR if fails */ }

      const textW = 420 - 16 - 100 - 16 - 12; // width for text column

      // Batch number (large)
      doc.fontSize(20).font('Helvetica-Bold')
        .text(b.batch_number, 16, 16, { width: textW });

      // SKU + product name
      doc.fontSize(11).font('Helvetica-Bold')
        .text(b.product_sku, 16, 46, { width: textW });
      if (b.product_name) {
        doc.fontSize(9).font('Helvetica')
          .text(b.product_name, 16, 60, { width: textW });
      }

      let ty = 78;
      const row = (label, value) => {
        if (value === null || value === undefined || value === '') return;
        doc.fontSize(9).font('Helvetica-Bold').text(`${label}:`, 16, ty, { width: 90, continued: false });
        doc.fontSize(9).font('Helvetica').text(String(value), 106, ty, { width: textW - 90 });
        ty += 14;
      };

      const qty = Number(b.current_quantity);
      const uom = b.unit_code || b.unit_name || 'm';
      row('Cantitate', `${qty.toFixed(2)} ${uom}`);
      if (b.weight_kg) row('Greutate', `${Number(b.weight_kg).toFixed(2)} kg`);
      if (b.length_meters) row('Lungime', `${Number(b.length_meters).toFixed(2)} m`);
      if (b.lot_number) row('Lot', b.lot_number);
      row('Status', b.status);
      if (b.zone) row('Locație', [b.zone, b.rack, b.position].filter(Boolean).join(' / '));

      // Footer
      const createdDate = b.created_at ? new Date(b.created_at).toLocaleDateString('ro-RO') : '';
      doc.fontSize(8).font('Helvetica').fillColor('#888')
        .text(`WMS NK  •  ${createdDate}`, 16, 297 - 22, { width: 380 });

      // Border
      doc.rect(4, 4, 420 - 8, 297 - 8).lineWidth(1.5).stroke('#333');

      doc.end();
    } catch (error) {
      logger.error('Error generating batch label PDF:', error);
      next(error);
    }
  }
}

module.exports = BatchController;
