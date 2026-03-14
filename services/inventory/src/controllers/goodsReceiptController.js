const { pool } = require('../config/database');
const logger = require('../utils/logger');

class GoodsReceiptController {
  // GET /api/v1/goods-receipts/next-number  — sugereaza urmatorul numar NIR
  static async nextNumber(_req, res, next) {
    try {
      const year = new Date().getFullYear().toString().slice(-2);
      const result = await pool.query(
        `SELECT nir_number FROM goods_receipts
         WHERE nir_number ~ $1
         ORDER BY CAST(substring(nir_number FROM '[0-9]+$') AS INTEGER) DESC
         LIMIT 1`,
        [`^NK${year}_[0-9]+$`]
      );
      let seq = 1;
      if (result.rows.length > 0) {
        const last = result.rows[0].nir_number;
        seq = parseInt(last.split('_')[1], 10) + 1;
      } else {
        // check sequence
        const seqRes = await pool.query(`SELECT last_value FROM nir_seq`);
        seq = parseInt(seqRes.rows[0].last_value, 10);
        if (seq < 1) seq = 1;
      }
      res.json({ success: true, data: `NK${year}_${seq}` });
    } catch (error) {
      next(error);
    }
  }

  // GET /api/v1/goods-receipts/gestiuni  — lista gestiuni disponibile
  static async getGestiuni(_req, res) {
    const gestiuni = [
      { code: 'VZCB_CMP', name: 'VZCB_CMP 01.Vanzari CABLURI (CMP)' },
      { code: 'AMB_CMP',  name: 'AMB_CMP 04.AMBALAJE (CMP)' },
      { code: 'PROD_CMP', name: 'PROD_CMP 02.Productie (CMP)' },
      { code: 'SCULE',    name: 'SCULE 05.Scule si SDV-uri' },
    ];
    res.json({ success: true, data: gestiuni });
  }

  // GET /api/v1/goods-receipts
  static async list(req, res, next) {
    try {
      const { status, supplier, from_date, to_date, page = 1, limit = 50 } = req.query;
      const offset = (parseInt(page) - 1) * parseInt(limit);

      const conditions = [];
      const params = [];
      let idx = 1;

      if (status)    { conditions.push(`gr.status = $${idx++}`);             params.push(status); }
      if (supplier)  { conditions.push(`gr.supplier_name ILIKE $${idx++}`);  params.push(`%${supplier}%`); }
      if (from_date) { conditions.push(`gr.receipt_date >= $${idx++}`);      params.push(from_date); }
      if (to_date)   { conditions.push(`gr.receipt_date <= $${idx++}`);      params.push(to_date); }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const result = await pool.query(
        `SELECT gr.*,
                COUNT(grl.id)::int AS line_count,
                so.order_number   AS po_number
         FROM goods_receipts gr
         LEFT JOIN goods_receipt_lines grl ON grl.receipt_id = gr.id
         LEFT JOIN supplier_orders so      ON so.id = gr.supplier_order_id
         ${whereClause}
         GROUP BY gr.id, so.order_number
         ORDER BY gr.receipt_date DESC, gr.created_at DESC
         LIMIT $${idx++} OFFSET $${idx++}`,
        [...params, parseInt(limit), offset]
      );

      res.json({ success: true, data: result.rows });
    } catch (error) {
      logger.error('GR list error:', error);
      next(error);
    }
  }

  // GET /api/v1/goods-receipts/:id
  static async getById(req, res, next) {
    try {
      const { id } = req.params;

      const grResult = await pool.query(
        `SELECT gr.*, so.order_number AS po_number
         FROM goods_receipts gr
         LEFT JOIN supplier_orders so ON so.id = gr.supplier_order_id
         WHERE gr.id = $1`,
        [id]
      );
      if (grResult.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'NIR negasit' });
      }

      const linesResult = await pool.query(
        `SELECT grl.*, dt.code AS drum_type_code, dt.name AS drum_type_name
         FROM goods_receipt_lines grl
         LEFT JOIN drum_types dt ON dt.id = grl.drum_type_id
         WHERE grl.receipt_id = $1
         ORDER BY grl.line_number`,
        [id]
      );

      res.json({
        success: true,
        data: { ...grResult.rows[0], lines: linesResult.rows },
      });
    } catch (error) {
      logger.error('GR getById error:', error);
      next(error);
    }
  }

  // POST /api/v1/goods-receipts  — creare NIR in stare DRAFT
  static async create(req, res, next) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const {
        supplier_order_id, supplier_name, invoice_number, invoice_date,
        receipt_date, gestiune, gestiune_code, transport_doc, notes, created_by,
        lines = [],
      } = req.body;

      if (!supplier_name) {
        return res.status(400).json({ success: false, message: 'supplier_name este obligatoriu' });
      }

      // Auto-generate NIR number if not provided
      let nirNum = req.body.nir_number;
      if (!nirNum) {
        const year = new Date().getFullYear().toString().slice(-2);
        const seqRes = await client.query(`SELECT nextval('nir_seq') AS seq`);
        nirNum = `NK${year}_${seqRes.rows[0].seq}`;
      }

      const grResult = await client.query(
        `INSERT INTO goods_receipts
           (nir_number, supplier_order_id, supplier_name, invoice_number, invoice_date,
            receipt_date, gestiune, gestiune_code, transport_doc, notes, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         RETURNING *`,
        [nirNum, supplier_order_id || null, supplier_name, invoice_number || null, invoice_date || null,
         receipt_date || new Date(), gestiune || null, gestiune_code || null,
         transport_doc || null, notes || null, created_by || null]
      );

      const gr = grResult.rows[0];
      const linesCreated = [];

      for (let i = 0; i < lines.length; i++) {
        const l = lines[i];
        const cantRec = parseFloat(l.cant_received) || 0;
        const pret    = parseFloat(l.price_intrare) || 0;
        const total   = Math.round(cantRec * pret * 100) / 100;

        const lineResult = await client.query(
          `INSERT INTO goods_receipt_lines
             (receipt_id, line_number, material_name, cod_material, cont_debitor,
              unit, cant_doc, cant_received, price_intrare, total_fara_tva,
              drum_type_id, drum_quantity, product_sku, order_line_id, notes)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
           RETURNING *`,
          [gr.id, l.line_number || (i + 1), l.material_name, l.cod_material || null,
           l.cont_debitor || null, l.unit || 'Buc',
           parseFloat(l.cant_doc) || 0, cantRec, pret, total,
           l.drum_type_id || null, l.drum_quantity || null,
           l.product_sku || null, l.order_line_id || null, l.notes || null]
        );
        linesCreated.push(lineResult.rows[0]);
      }

      const totalFaraTva = linesCreated.reduce((s, l) => s + (parseFloat(l.total_fara_tva) || 0), 0);
      await client.query(
        'UPDATE goods_receipts SET total_fara_tva = $1 WHERE id = $2',
        [Math.round(totalFaraTva * 100) / 100, gr.id]
      );

      await client.query('COMMIT');

      res.status(201).json({
        success: true,
        data: { ...gr, total_fara_tva: totalFaraTva, lines: linesCreated },
      });
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('GR create error:', error);
      next(error);
    } finally {
      client.release();
    }
  }

  // POST /api/v1/goods-receipts/:id/confirm
  // Confirma NIR: genereaza numar NK{YY}_{SEQ}, actualizeaza stoc (batches pentru cabluri)
  static async confirm(req, res, next) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { id } = req.params;

      const grResult = await client.query(
        'SELECT * FROM goods_receipts WHERE id = $1 FOR UPDATE',
        [id]
      );
      if (grResult.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'NIR negasit' });
      }
      const gr = grResult.rows[0];

      if (gr.status === 'CONFIRMED') {
        return res.status(409).json({ success: false, message: 'NIR-ul este deja confirmat' });
      }

      // Genereaza numar NIR: NK{YY}_{SEQ}
      const year = new Date().getFullYear() % 100;
      const seqResult = await client.query("SELECT nextval('nir_seq') AS seq");
      const nirNumber = `NK${year}_${seqResult.rows[0].seq}`;

      // Incarca liniile NIR
      const linesResult = await client.query(
        'SELECT * FROM goods_receipt_lines WHERE receipt_id = $1 ORDER BY line_number',
        [id]
      );

      // Pentru fiecare linie cu product_sku (cabluri), creeaza product_batch
      for (const line of linesResult.rows) {
        if (!line.product_sku || parseFloat(line.cant_received) <= 0) continue;

        // Verifica produsul
        const productCheck = await client.query(
          'SELECT sku FROM products WHERE sku = $1',
          [line.product_sku]
        );
        if (productCheck.rows.length === 0) continue;

        // Determina unit_id
        const unitCode = line.unit === 'Km' ? 'ROLL' : 'PIECE';
        const unitResult = await client.query(
          'SELECT id FROM product_units WHERE code = $1',
          [unitCode]
        );
        if (unitResult.rows.length === 0) continue;

        const unit_id = unitResult.rows[0].id;
        // Cantitate in unitati de baza (m pentru Km, buc pentru Buc)
        const cantReceptata = parseFloat(line.cant_received);
        const qty = line.unit === 'Km' ? cantReceptata * 1000 : cantReceptata;

        const batchNumber = `NIR-${nirNumber}-L${line.line_number}`;
        const batchNotes = [
          `NIR: ${nirNumber}`,
          `Furnizor: ${gr.supplier_name}`,
          gr.invoice_number ? `Factura: ${gr.invoice_number}` : null,
          gr.gestiune ? `Gestiune: ${gr.gestiune}` : null,
        ].filter(Boolean).join(' | ');

        const batchResult = await client.query(
          `INSERT INTO product_batches
             (batch_number, product_sku, unit_id, initial_quantity, current_quantity,
              length_meters, status, notes)
           VALUES ($1,$2,$3,$4,$4,$5,'INTACT',$6)
           RETURNING id`,
          [batchNumber, line.product_sku, unit_id, qty,
           line.unit === 'Km' ? qty : null, batchNotes]
        );

        await client.query(
          'UPDATE goods_receipt_lines SET batch_id = $1 WHERE id = $2',
          [batchResult.rows[0].id, line.id]
        );

        // Actualizeaza cantitatea receptionata pe linia comenzii furnizor
        if (line.order_line_id) {
          await client.query(
            `UPDATE supplier_order_lines
             SET received_qty = received_qty + $1
             WHERE id = $2`,
            [cantReceptata, line.order_line_id]
          );
        }
      }

      // Confirma NIR
      await client.query(
        `UPDATE goods_receipts
         SET status = 'CONFIRMED', nir_number = $1, updated_at = NOW()
         WHERE id = $2`,
        [nirNumber, id]
      );

      // Actualizeaza statusul comenzii furnizor daca este legata → RECEIVED
      if (gr.supplier_order_id) {
        await client.query(
          `UPDATE supplier_orders
           SET status = 'RECEIVED', updated_at = NOW()
           WHERE id = $1 AND status NOT IN ('CLOSED','CANCELLED')`,
          [gr.supplier_order_id]
        );
      }

      await client.query('COMMIT');

      // Returneaza NIR-ul complet confirmat
      const finalGR = await pool.query(
        `SELECT gr.*, so.order_number AS po_number
         FROM goods_receipts gr
         LEFT JOIN supplier_orders so ON so.id = gr.supplier_order_id
         WHERE gr.id = $1`,
        [id]
      );
      const finalLines = await pool.query(
        `SELECT grl.*, dt.code AS drum_type_code, dt.name AS drum_type_name
         FROM goods_receipt_lines grl
         LEFT JOIN drum_types dt ON dt.id = grl.drum_type_id
         WHERE grl.receipt_id = $1
         ORDER BY grl.line_number`,
        [id]
      );

      res.json({
        success: true,
        data: { ...finalGR.rows[0], lines: finalLines.rows },
      });
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('GR confirm error:', error);
      next(error);
    } finally {
      client.release();
    }
  }
}

module.exports = GoodsReceiptController;
