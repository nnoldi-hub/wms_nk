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
        SELECT b.*, u.code as unit_code, u.name as unit_name, p.name as product_name,
               l.location_code, l.zone, l.rack, l.position
        FROM product_batches b
        LEFT JOIN product_units u ON b.unit_id = u.id
        LEFT JOIN products p ON b.product_sku = p.sku
        LEFT JOIN locations l ON b.location_id = l.id
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
  // GET /api/v1/batches/dashboard-stats
  // Agregată statistici pentru dashboard: resturi, PENDING_PUTAWAY, stoc per zonă (S4.4)
  static async getDashboardStats(req, res, next) {
    try {
      const [resturiRes, pendingRes, zoneRes] = await Promise.all([
        pool.query(`
          SELECT
            COUNT(*)                              AS resturi_count,
            COALESCE(SUM(current_quantity), 0)    AS resturi_total_qty
          FROM product_batches
          WHERE (batch_number ILIKE 'REST-%'
                 OR notes ILIKE '%rest dup%')
            AND current_quantity > 0
            AND status NOT IN ('EMPTY','DAMAGED','CUT')
        `),
        pool.query(`
          SELECT COUNT(*) AS pending_count
          FROM product_batches
          WHERE status IN ('PENDING_PUTAWAY','INTACT')
            AND location_id IS NULL
        `),
        pool.query(`
          SELECT
            COALESCE(l.zone, 'F\u0103r\u0103 zon\u0103') AS zone,
            COUNT(DISTINCT b.id)                   AS batch_count,
            ROUND(SUM(b.current_quantity))          AS total_qty
          FROM product_batches b
          LEFT JOIN locations l ON l.id = b.location_id
          WHERE b.status NOT IN ('EMPTY','DAMAGED')
            AND b.current_quantity > 0
          GROUP BY l.zone
          ORDER BY total_qty DESC
          LIMIT 10
        `),
      ]);
      res.json({
        success: true,
        data: {
          resturi_count:    parseInt(resturiRes.rows[0].resturi_count),
          resturi_total_qty: parseFloat(resturiRes.rows[0].resturi_total_qty),
          pending_putaway:  parseInt(pendingRes.rows[0].pending_count),
          stock_by_zone:    zoneRes.rows,
        },
      });
    } catch (error) {
      logger.error('Error fetching dashboard stats:', error);
      next(error);
    }
  }

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
           COALESCE(p.name, grl.material_name, b.product_sku, 'Produs necunoscut') AS product_name,
           gr.nir_number,
           gr.supplier_name,
           gr.receipt_date,
           gr.id   AS goods_receipt_id,
           COALESCE(grl.unit, 'Buc') AS unit,
           COALESCE(grl.cant_received, b.current_quantity) AS cant_received
         FROM product_batches b
         LEFT JOIN products p                  ON p.sku = b.product_sku
         LEFT JOIN goods_receipt_lines grl     ON grl.batch_id = b.id
         LEFT JOIN goods_receipts gr           ON gr.id = grl.receipt_id
         WHERE b.status IN ('PENDING_PUTAWAY', 'INTACT')
           AND b.location_id IS NULL
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

  // POST /api/v1/batches/:id/confirm-putaway
  // Confirms putaway: sets location_id, status=INTACT, putaway_at, putaway_by
  static async confirmPutaway(req, res, next) {
    try {
      const { id } = req.params;
      const { location_id } = req.body;
      const userId = req.user?.id;

      if (!location_id) {
        return res.status(400).json({ error: 'location_id este obligatoriu' });
      }

      // Verify location exists
      const locCheck = await pool.query(
        'SELECT id FROM locations WHERE id = $1',
        [location_id]
      );
      if (!locCheck.rows.length) {
        return res.status(404).json({ error: 'Loca\u021bia nu exist\u0103' });
      }

      const result = await pool.query(
        `UPDATE product_batches
         SET location_id = $1,
             status = 'INTACT',
             putaway_at = CURRENT_TIMESTAMP,
             putaway_by = $2,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $3
           AND status IN ('PENDING_PUTAWAY', 'INTACT')
         RETURNING *`,
        [location_id, userId || null, id]
      );

      if (!result.rows.length) {
        return res.status(404).json({ error: 'Lot neg\u0103sit sau status invalid' });
      }

      logger.info(`Putaway confirmat: lot ${id} \u2192 loca\u021bia ${location_id} de user ${userId}`);
      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      logger.error('Error confirming putaway:', error);
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

  // -------------------------------------------------------
  // BULK ASSIGN: POST /api/v1/batches/bulk-assign
  // Body: { assignments: [{batch_id, location_id}] }
  // Asignează în masă locații pentru mai multe batches — o singură tranzacție
  // -------------------------------------------------------
  static async bulkAssign(req, res, next) {
    const client = await pool.connect();
    try {
      const { assignments } = req.body;

      if (!Array.isArray(assignments) || assignments.length === 0) {
        throw new AppError('assignments trebuie să fie un array nevid de {batch_id, location_id}', 400);
      }

      // Validare rapidă input
      for (const a of assignments) {
        if (!a.batch_id || !a.location_id) {
          throw new AppError('Fiecare assignment trebuie să conțină batch_id și location_id', 400);
        }
      }

      await client.query('BEGIN');

      // Verifică că locațiile există și sunt disponibile
      const locationIds = [...new Set(assignments.map(a => a.location_id))];
      const locCheck = await client.query(
        `SELECT id, location_code, status FROM locations WHERE id = ANY($1::varchar[])`,
        [locationIds]
      );
      const validLocMap = {};
      for (const loc of locCheck.rows) {
        if (loc.status === 'BLOCKED' || loc.status === 'MAINTENANCE') {
          throw new AppError(`Locația ${loc.location_code} nu este disponibilă (status: ${loc.status})`, 400);
        }
        validLocMap[loc.id] = loc;
      }
      const missingLocs = locationIds.filter(id => !validLocMap[id]);
      if (missingLocs.length > 0) {
        throw new AppError(`Locații inexistente: ${missingLocs.join(', ')}`, 400);
      }

      const results = [];
      const userId = req.user?.id;

      // Rezolvă location_id din palet dacă nu a fost furnizat direct
      const palletCache = {};
      const getPalletInfo = async (pid) => {
        if (!pid) return null;
        if (!palletCache[pid]) {
          const pr = await client.query(
            `SELECT id, location_id, primary_product_sku FROM pallets WHERE id = $1`,
            [pid]
          );
          palletCache[pid] = pr.rows[0] || null;
        }
        return palletCache[pid];
      };

      for (const { batch_id, pallet_id } of assignments) {
        let { location_id } = assignments.find(a => a.batch_id === batch_id) || {};

        // Dacă location_id nu e furnizat, îl luăm din palet
        if (!location_id && pallet_id) {
          const palInfo = await getPalletInfo(pallet_id);
          location_id = palInfo?.location_id || null;
        }

        if (!location_id) continue; // nu putem asigna fără locație

        const updateFields = ['location_id = $2', 'updated_at = NOW()'];
        const params = [batch_id, location_id];
        let pi = 3;

        if (pallet_id !== undefined) {
          updateFields.push(`pallet_id = $${pi++}`);
          params.push(pallet_id);
        }

        const r = await client.query(
          `UPDATE product_batches
             SET ${updateFields.join(', ')}
           WHERE id = $1 AND location_id IS NULL
           RETURNING id, batch_number, product_sku, location_id, current_quantity`,
          params
        );

        if (r.rows.length > 0) {
          results.push(r.rows[0]);

          // Audit log
          await client.query(
            `INSERT INTO wms_ops_audit
               (action_type, entity_type, entity_id, entity_code, service, changes, user_id)
             VALUES ('BULK_PUTAWAY', 'batch', $1, $2, 'inventory', $3, $4)`,
            [
              batch_id,
              r.rows[0].batch_number,
              JSON.stringify({ location_id, pallet_id: pallet_id || null }),
              userId || null,
            ]
          );

          // Setează primary_product_sku pe palet dacă e primul produs
          if (pallet_id) {
            await client.query(
              `UPDATE pallets
                 SET primary_product_sku = COALESCE(primary_product_sku, $2),
                     status = 'IN_USE', updated_at = NOW()
               WHERE id = $1`,
              [pallet_id, r.rows[0].product_sku]
            );
          }
        }
      }

      // Marchează locațiile ca OCCUPIED
      if (locationIds.length > 0) {
        await client.query(
          `UPDATE locations SET status = 'OCCUPIED', updated_at = NOW()
           WHERE id = ANY($1::varchar[])`,
          [locationIds]
        );
      }

      await client.query('COMMIT');

      logger.info(`Bulk putaway: ${results.length}/${assignments.length} batches asignate de user ${userId}`);
      res.json({
        success: true,
        assigned_count: results.length,
        skipped_count: assignments.length - results.length,
        data: results,
      });
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error bulk-assign batches:', error);
      next(error);
    } finally {
      client.release();
    }
  }

  // -------------------------------------------------------
  // AUTO PLAN: POST /api/v1/batches/auto-plan
  // Body: { goods_receipt_id? } sau { batch_ids?: string[] }
  // Calculează plan optim de putaway (grupat pe produs → locație sugerată)
  // fără să modifice baza de date — returnează doar planul propus
  // -------------------------------------------------------
  static async autoPlan(req, res, next) {
    try {
      const { goods_receipt_id, batch_ids } = req.body;

      if (!goods_receipt_id && (!batch_ids || batch_ids.length === 0)) {
        throw new AppError('Furnizați goods_receipt_id sau batch_ids', 400);
      }

      // Preia batchurile fără locație
      let batchQuery = `
        SELECT
          b.id, b.batch_number, b.product_sku, b.current_quantity,
          b.length_meters, b.weight_kg, b.status,
          COALESCE(p.name, grl.material_name, b.product_sku) AS product_name,
          COALESCE(grl.unit, 'Buc') AS unit,
          COALESCE(grl.cant_received, b.current_quantity) AS cant_received,
          gr.nir_number
        FROM product_batches b
        LEFT JOIN products p ON p.sku = b.product_sku
        LEFT JOIN goods_receipt_lines grl ON grl.batch_id = b.id
        LEFT JOIN goods_receipts gr ON gr.id = grl.receipt_id
        WHERE b.location_id IS NULL AND b.status = 'INTACT'
      `;
      const params = [];

      if (goods_receipt_id) {
        batchQuery += ` AND gr.id = $1`;
        params.push(goods_receipt_id);
      } else if (batch_ids) {
        batchQuery += ` AND b.id = ANY($1::uuid[])`;
        params.push(batch_ids);
      }

      batchQuery += ' ORDER BY b.product_sku, b.created_at ASC';
      const batchResult = await pool.query(batchQuery, params);
      const batches = batchResult.rows;

      if (batches.length === 0) {
        return res.json({ success: true, plan: [], total_batches: 0, message: 'Nu există batches fără locație' });
      }

      // Determină warehouse_id din primul depozit activ
      const whRow = await pool.query(`SELECT id FROM warehouses ORDER BY created_at LIMIT 1`);
      const warehouseId = whRow.rows[0]?.id || '00000000-0000-0000-0000-000000000001';

      // Grupează pe product_sku
      const groups = {};
      for (const b of batches) {
        if (!groups[b.product_sku]) {
          groups[b.product_sku] = {
            product_sku: b.product_sku,
            product_name: b.product_name,
            batches: [],
            unit: b.unit,
          };
        }
        groups[b.product_sku].batches.push(b);
      }

      // Caută paleți existenți cu loc liber — prioritate: SKU potrivit, apoi orice palet așezat pe raft
      const skus = Object.keys(groups);
      const palletsResult = await pool.query(
        `SELECT p.id, p.pallet_code, p.max_slots, p.current_slots,
                p.primary_product_sku, p.status, p.location_id,
                l.location_code, l.zone, l.rack
         FROM pallets p
         LEFT JOIN locations l ON l.id = p.location_id
         WHERE p.status IN ('IN_USE', 'EMPTY')
           AND p.location_id IS NOT NULL
           AND p.current_slots < p.max_slots
         ORDER BY
           CASE WHEN p.primary_product_sku = ANY($1::varchar[]) THEN 0
                WHEN p.primary_product_sku IS NULL THEN 1
                ELSE 2 END,
           p.current_slots DESC`,
        [skus]
      );
      const existingPallets = palletsResult.rows;

      // Încarcă configurațiile de capacitate pe produs
      const configResult = await pool.query(
        `SELECT product_sku, pallet_type, units_per_pallet, max_weight_kg, unit_weight_kg, stacking_allowed
         FROM pallet_product_config
         WHERE product_sku = ANY($1::varchar[])
           AND (warehouse_id = $2 OR warehouse_id IS NULL)
         ORDER BY warehouse_id NULLS LAST, product_sku`,
        [skus, warehouseId]
      );
      // Map: sku → config (prefer warehouse-specific over global)
      const capacityMap = {};
      for (const cfg of configResult.rows) {
        if (!capacityMap[cfg.product_sku]) capacityMap[cfg.product_sku] = cfg;
      }

      // Obține sugestii locații de la warehouse-config
      const WH_API = process.env.WAREHOUSE_CONFIG_URL || 'http://warehouse-config:3000';
      const plan = [];
      let planIndex = 1;

      for (const [sku, group] of Object.entries(groups)) {
        let batchesLeft = [...group.batches];

        // 1. Completează paleți existenți: preferă cei cu SKU potrivit, apoi cei goali
        const matchingPallets = existingPallets.filter(
          p => p.primary_product_sku === sku || p.primary_product_sku === null
        );
        for (const pallet of matchingPallets) {
          if (batchesLeft.length === 0) break;
          const availableSlots = pallet.max_slots - pallet.current_slots;
          const toAssign = batchesLeft.splice(0, availableSlots);

          plan.push({
            plan_index: planIndex++,
            type: 'EXISTING_PALLET',
            pallet_id: pallet.id,
            pallet_code: pallet.pallet_code,
            location_id: pallet.location_id,
            location_code: pallet.location_code,
            zone: pallet.zone,
            batches: toAssign.map(b => ({
              batch_id: b.id,
              batch_number: b.batch_number,
              product_sku: b.product_sku,
              product_name: b.product_name,
              quantity: b.cant_received || b.current_quantity,
              unit: b.unit,
            })),
            available_slots_before: availableSlots,
            confidence: 'HIGH',
            message: `Palet existent cu ${availableSlots} locuri libere`,
          });
        }

        // 2. Restul → sugestii locații noi via PutawayEngine
        if (batchesLeft.length > 0) {
          let suggestedLocations = [];
          try {
            const token = req.headers.authorization;
            const resp = await fetch(`${WH_API}/api/v1/suggest/putaway`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: token },
              body: JSON.stringify({
                warehouse_id: warehouseId,
                product_sku: sku,
                quantity: batchesLeft.length,
                product: { name: group.product_name, category: 'CABLU' },
                limit: 3,
              }),
            });
            const j = await resp.json();
            suggestedLocations = j.suggestions || j.data || [];
          } catch (e) {
            logger.warn(`Auto-plan: nu s-au putut obține sugestii pentru ${sku}: ${e.message}`);
          }

          // Împarte batchesLeft pe locații sugerate (folosind capacitatea configurată per produs)
          const cfg = capacityMap[sku];
          const SLOTS_PER_PALLET = cfg ? cfg.units_per_pallet : 10;
          const capacityNote = cfg
            ? `Capacitate configurată: ${SLOTS_PER_PALLET} buc/palet`
            : 'Capacitate implicită: 10 buc/palet (nicio configurație pentru acest produs)';
          let batchIdx = 0;
          let locSuggIdx = 0;

          while (batchIdx < batchesLeft.length) {
            const chunk = batchesLeft.slice(batchIdx, batchIdx + SLOTS_PER_PALLET);
            const sugLoc = suggestedLocations[locSuggIdx] || null;
            const locObj = sugLoc?.location || sugLoc || {};

            plan.push({
              plan_index: planIndex++,
              type: 'NEW_PALLET',
              pallet_id: null,
              pallet_code: `PAL-NOU-${planIndex}`,
              location_id: locObj.id || null,
              location_code: locObj.location_code || 'NEALOCAT',
              zone: locObj.zone || null,
              score: sugLoc?.score || 0,
              slots_per_pallet: SLOTS_PER_PALLET,
              capacity_configured: !!cfg,
              batches: chunk.map(b => ({
                batch_id: b.id,
                batch_number: b.batch_number,
                product_sku: b.product_sku,
                product_name: b.product_name,
                quantity: b.cant_received || b.current_quantity,
                unit: b.unit,
              })),
              available_slots_before: SLOTS_PER_PALLET,
              confidence: sugLoc ? 'MEDIUM' : 'LOW',
              message: sugLoc
                ? `Locație sugerată de WMS (scor: ${sugLoc.score || 0}) — ${capacityNote}`
                : `Nicio sugestie disponibilă — alegeți manual locația. ${capacityNote}`,
            });

            batchIdx += SLOTS_PER_PALLET;
            if (locSuggIdx < suggestedLocations.length - 1) locSuggIdx++;
          }
        }
      }

      res.json({
        success: true,
        warehouse_id: warehouseId,
        total_batches: batches.length,
        plan_groups: plan.length,
        plan,
      });
    } catch (error) {
      logger.error('Error auto-plan putaway:', error);
      next(error);
    }
  }
}

module.exports = BatchController;
