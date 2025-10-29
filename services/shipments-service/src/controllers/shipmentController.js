const { pool } = require('../config/database');
const logger = require('../utils/logger');
const { AppError } = require('../middleware/errorHandler');
const PDFDocument = require('pdfkit');

class ShipmentController {
  static async getShipments(req, res, next) {
    try {
      const { status, carrier, limit = 50, offset = 0 } = req.query;
      let query = 'SELECT * FROM shipments WHERE 1=1';
      const params = [];
      let paramIndex = 1;

      if (status) {
        query += ` AND status = $${paramIndex++}`;
        params.push(status);
      }
      if (carrier) {
        query += ` AND carrier = $${paramIndex++}`;
        params.push(carrier);
      }

      query += ` ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
      params.push(limit, offset);

      const result = await pool.query(query, params);
      res.json({ shipments: result.rows, count: result.rows.length });
    } catch (error) {
      next(error);
    }
  }

  static async createShipment(req, res, next) {
    try {
      const { customer_name, customer_address, customer_phone, carrier, items } = req.body;
      
      const result = await pool.query(
        `INSERT INTO shipments 
        (customer_name, customer_address, customer_phone, carrier, status, tracking_number) 
        VALUES ($1, $2, $3, $4, 'PENDING', $5) 
        RETURNING *`,
        [customer_name, customer_address, customer_phone, carrier, `TRK${Date.now()}`]
      );

      const shipmentId = result.rows[0].id;

      for (const item of items) {
        await pool.query(
          `INSERT INTO shipment_items (shipment_id, product_sku, quantity) VALUES ($1, $2, $3)`,
          [shipmentId, item.product_sku, item.quantity]
        );
      }

      logger.info(`Shipment created: ${shipmentId}`);
      res.status(201).json(result.rows[0]);
    } catch (error) {
      next(error);
    }
  }

  static async getShipmentById(req, res, next) {
    try {
      const { id } = req.params;
      const shipment = await pool.query('SELECT * FROM shipments WHERE id = $1', [id]);
      
      if (shipment.rows.length === 0) {
        throw new AppError('Shipment not found', 404);
      }

      const items = await pool.query('SELECT * FROM shipment_items WHERE shipment_id = $1', [id]);
      
      res.json({ ...shipment.rows[0], items: items.rows });
    } catch (error) {
      next(error);
    }
  }

  static async updateTracking(req, res, next) {
    try {
      const { id } = req.params;
      const { tracking_events } = req.body;
      
      const result = await pool.query(
        `UPDATE shipments 
        SET tracking_events = COALESCE(tracking_events, '[]'::jsonb) || $1::jsonb,
            updated_at = NOW()
        WHERE id = $2 
        RETURNING *`,
        [JSON.stringify(tracking_events), id]
      );

      if (result.rows.length === 0) {
        throw new AppError('Shipment not found', 404);
      }

      res.json(result.rows[0]);
    } catch (error) {
      next(error);
    }
  }

  static async markAsShipped(req, res, next) {
    try {
      const { id } = req.params;
      const { carrier_tracking_url } = req.body;
      
      const result = await pool.query(
        `UPDATE shipments 
        SET status = 'SHIPPED', 
            shipped_at = NOW(),
            carrier_tracking_url = $1,
            updated_at = NOW()
        WHERE id = $2 
        RETURNING *`,
        [carrier_tracking_url, id]
      );

      if (result.rows.length === 0) {
        throw new AppError('Shipment not found', 404);
      }

      logger.info(`Shipment shipped: ${id}`);
      res.json(result.rows[0]);
    } catch (error) {
      next(error);
    }
  }

  static async generateLabel(req, res, next) {
    try {
      const { id } = req.params;
      const result = await pool.query('SELECT * FROM shipments WHERE id = $1', [id]);
      
      if (result.rows.length === 0) {
        throw new AppError('Shipment not found', 404);
      }

      const shipment = result.rows[0];
      const doc = new PDFDocument();
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=label-${id}.pdf`);
      
      doc.pipe(res);
      doc.fontSize(16).text(`Shipping Label - ${shipment.tracking_number}`, { align: 'center' });
      doc.moveDown();
      doc.fontSize(12).text(`To: ${shipment.customer_name}`);
      doc.text(shipment.customer_address);
      doc.text(`Phone: ${shipment.customer_phone}`);
      doc.moveDown();
      doc.text(`Carrier: ${shipment.carrier}`);
      doc.text(`Tracking: ${shipment.tracking_number}`);
      doc.end();
    } catch (error) {
      next(error);
    }
  }
}

module.exports = ShipmentController;
