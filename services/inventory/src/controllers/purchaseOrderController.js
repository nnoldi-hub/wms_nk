const { pool } = require('../config/database');
const logger = require('../utils/logger');

class PurchaseOrderController {
  // GET /api/v1/purchase-orders/suppliers  — autocomplet furnizori existenti
  static async getSuppliers(req, res, next) {
    try {
      const result = await pool.query(
        `SELECT DISTINCT supplier_name FROM supplier_orders ORDER BY supplier_name`
      );
      res.json({ success: true, data: result.rows.map((r) => r.supplier_name) });
    } catch (error) {
      next(error);
    }
  }

  // GET /api/v1/purchase-orders/next-number  — sugereaza numarul urmator CA_XXXX
  static async nextNumber(req, res, next) {
    try {
      const result = await pool.query(
        `SELECT order_number FROM supplier_orders
         WHERE order_number ~ '^CA_[0-9]+$'
         ORDER BY CAST(substring(order_number FROM 4) AS INTEGER) DESC
         LIMIT 1`
      );
      let nextNum = 1;
      if (result.rows.length > 0) {
        const last = parseInt(result.rows[0].order_number.replace('CA_', ''), 10);
        nextNum = last + 1;
      }
      res.json({ success: true, data: `CA_${nextNum}` });
    } catch (error) {
      next(error);
    }
  }

  // GET /api/v1/purchase-orders
  static async list(req, res, next) {
    try {
      const { status, supplier, page = 1, limit = 50 } = req.query;
      const offset = (parseInt(page) - 1) * parseInt(limit);

      const conditions = [];
      const params = [];
      let idx = 1;

      if (status) { conditions.push(`so.status = $${idx++}`); params.push(status); }
      if (supplier) { conditions.push(`so.supplier_name ILIKE $${idx++}`); params.push(`%${supplier}%`); }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const result = await pool.query(
        `SELECT so.*,
                COUNT(sol.id)::int AS line_count,
                COALESCE(SUM(sol.line_value), 0) AS computed_total
         FROM supplier_orders so
         LEFT JOIN supplier_order_lines sol ON sol.order_id = so.id
         ${whereClause}
         GROUP BY so.id
         ORDER BY so.order_date DESC, so.created_at DESC
         LIMIT $${idx++} OFFSET $${idx++}`,
        [...params, parseInt(limit), offset]
      );

      const countResult = await pool.query(
        `SELECT COUNT(*) FROM supplier_orders so ${whereClause}`,
        params
      );

      res.json({
        success: true,
        data: result.rows,
        total: parseInt(countResult.rows[0].count),
        page: parseInt(page),
        limit: parseInt(limit),
      });
    } catch (error) {
      logger.error('PO list error:', error);
      next(error);
    }
  }

  // GET /api/v1/purchase-orders/:id
  static async getById(req, res, next) {
    try {
      const { id } = req.params;

      const orderResult = await pool.query(
        'SELECT * FROM supplier_orders WHERE id = $1',
        [id]
      );
      if (orderResult.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Comanda furnizor negasita' });
      }

      const linesResult = await pool.query(
        'SELECT * FROM supplier_order_lines WHERE order_id = $1 ORDER BY line_number',
        [id]
      );

      res.json({
        success: true,
        data: { ...orderResult.rows[0], lines: linesResult.rows },
      });
    } catch (error) {
      logger.error('PO getById error:', error);
      next(error);
    }
  }

  // POST /api/v1/purchase-orders
  static async create(req, res, next) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const {
        order_number, supplier_name, supplier_cui, supplier_address,
        order_date, delivery_date, currency = 'RON', notes, created_by,
        lines = [],
      } = req.body;

      if (!order_number || !supplier_name) {
        return res.status(400).json({
          success: false,
          message: 'Numarul comenzii si furnizorul sunt obligatorii',
        });
      }

      const orderResult = await client.query(
        `INSERT INTO supplier_orders
           (order_number, supplier_name, supplier_cui, supplier_address,
            order_date, delivery_date, currency, notes, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         RETURNING *`,
        [order_number, supplier_name, supplier_cui || null, supplier_address || null,
         order_date || new Date(), delivery_date || null, currency, notes || null, created_by || null]
      );

      const order = orderResult.rows[0];
      const linesCreated = [];

      for (let i = 0; i < lines.length; i++) {
        const l = lines[i];
        const qty = parseFloat(l.quantity) || 0;
        const unitPrice = parseFloat(l.unit_price) || 0;
        const lineValue = Math.round(qty * unitPrice * 100) / 100;

        const lineResult = await client.query(
          `INSERT INTO supplier_order_lines
             (order_id, line_number, product_sku, product_name, quantity, unit,
              list_price, discount_pct, unit_price, line_value, packaging_type, notes)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
           RETURNING *`,
          [order.id, l.line_number || (i + 1), l.product_sku || null, l.product_name,
           qty, l.unit || 'Km', parseFloat(l.list_price) || 0, parseFloat(l.discount_pct) || 0,
           unitPrice, lineValue, l.packaging_type || null, l.notes || null]
        );
        linesCreated.push(lineResult.rows[0]);
      }

      const totalValue = linesCreated.reduce((s, l) => s + (parseFloat(l.line_value) || 0), 0);
      await client.query(
        'UPDATE supplier_orders SET total_value = $1 WHERE id = $2',
        [Math.round(totalValue * 100) / 100, order.id]
      );

      await client.query('COMMIT');

      res.status(201).json({
        success: true,
        data: { ...order, total_value: totalValue, lines: linesCreated },
      });
    } catch (error) {
      await client.query('ROLLBACK');
      if (error.code === '23505') {
        return res.status(409).json({
          success: false,
          message: 'Numarul comenzii exista deja in sistem',
        });
      }
      logger.error('PO create error:', error);
      next(error);
    } finally {
      client.release();
    }
  }

  // POST /api/v1/purchase-orders/import-bulk
  // Body: { orders: [ { order_number, supplier_name, order_date, delivery_date, currency, notes, lines: [...] } ] }
  static async importBulk(req, res, next) {
    const client = await pool.connect();
    try {
      const { orders = [], source = 'MANUAL_IMPORT' } = req.body;
      if (!Array.isArray(orders) || orders.length === 0) {
        return res.status(400).json({ success: false, message: 'Lista de comenzi este goala' });
      }

      await client.query('BEGIN');
      const created = [];
      const skipped = [];

      for (const po of orders) {
        if (!po.order_number) {
          skipped.push({ order_number: po.order_number, reason: 'Nr. comanda lipsa' });
          continue;
        }
        // Supplier_name optional la import bulk (PDF poate să nu-l conțină)
        if (!po.supplier_name) {
          po.supplier_name = 'Furnizor neidentificat';
        }
        // Skip duplicates
        const exists = await client.query(
          'SELECT id FROM supplier_orders WHERE order_number = $1',
          [po.order_number]
        );
        if (exists.rows.length > 0) {
          skipped.push({ order_number: po.order_number, reason: 'Comanda exista deja' });
          continue;
        }

        const orderResult = await client.query(
          `INSERT INTO supplier_orders
             (order_number, supplier_name, order_date, delivery_date, currency, notes, status)
           VALUES ($1,$2,$3,$4,$5,$6,'CONFIRMED')
           RETURNING *`,
          [
            po.order_number, po.supplier_name,
            po.order_date || new Date(),
            po.delivery_date || null,
            po.currency || 'RON',
            po.notes ? `[${source}] ${po.notes}` : `[${source}]`,
          ]
        );
        const order = orderResult.rows[0];
        const lines = po.lines || [];
        let totalValue = 0;

        for (let i = 0; i < lines.length; i++) {
          const l = lines[i];
          const qty = parseFloat(l.quantity) || 0;
          const up = parseFloat(l.unit_price) || 0;
          const lv = Math.round(qty * up * 100) / 100;
          totalValue += lv;
          await client.query(
            `INSERT INTO supplier_order_lines
               (order_id, line_number, product_sku, product_name, quantity, unit,
                list_price, discount_pct, unit_price, line_value, packaging_type)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
            [
              order.id, l.line_number || (i + 1),
              l.product_sku || null, l.product_name || 'Produs necunoscut',
              qty, l.unit || 'Km',
              parseFloat(l.list_price) || 0, parseFloat(l.discount_pct) || 0,
              up, lv, l.packaging_type || null,
            ]
          );
        }
        await client.query(
          'UPDATE supplier_orders SET total_value = $1 WHERE id = $2',
          [Math.round(totalValue * 100) / 100, order.id]
        );
        created.push({ id: order.id, order_number: order.order_number, supplier_name: order.supplier_name });
      }

      await client.query('COMMIT');
      logger.info(`importBulk: ${created.length} created, ${skipped.length} skipped (source: ${source})`);
      res.status(201).json({
        success: true,
        data: { created, skipped, total_created: created.length, total_skipped: skipped.length },
      });
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('PO importBulk error:', error);
      next(error);
    } finally {
      client.release();
    }
  }

  // PATCH /api/v1/purchase-orders/:id/status
  static async updateStatus(req, res, next) {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const validStatuses = ['DRAFT', 'CONFIRMED', 'RECEIVING', 'RECEIVED', 'CLOSED', 'CANCELLED'];

      if (!validStatuses.includes(status)) {
        return res.status(400).json({ success: false, message: `Status invalid: ${status}` });
      }

      const result = await pool.query(
        'UPDATE supplier_orders SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
        [status, id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Comanda negasita' });
      }

      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      logger.error('PO status update error:', error);
      next(error);
    }
  }
}

module.exports = PurchaseOrderController;
