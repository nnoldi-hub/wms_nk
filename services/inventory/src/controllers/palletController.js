const { pool } = require('../config/database');
const logger = require('../utils/logger');
const { AppError } = require('../middleware/errorHandler');
const QRCode = require('qrcode');

class PalletController {
  // GET /api/v1/pallets
  // Listare paleți cu filtre: status, warehouse_id, product_sku, location_id
  static async getAllPallets(req, res, next) {
    try {
      const {
        status, warehouse_id, product_sku, location_id,
        limit = 50, offset = 0,
      } = req.query;

      let query = `
        SELECT
          p.*,
          l.location_code, l.zone, l.rack,
          COUNT(b.id) AS batch_count,
          w.warehouse_name
        FROM pallets p
        LEFT JOIN locations l ON l.id = p.location_id
        LEFT JOIN product_batches b ON b.pallet_id = p.id AND b.status NOT IN ('EMPTY','DAMAGED')
        LEFT JOIN warehouses w ON w.id = p.warehouse_id
        WHERE 1=1
      `;
      const params = [];
      let pi = 1;

      if (status) { query += ` AND p.status = $${pi++}`; params.push(status); }
      if (warehouse_id) { query += ` AND p.warehouse_id = $${pi++}`; params.push(warehouse_id); }
      if (product_sku) { query += ` AND p.primary_product_sku = $${pi++}`; params.push(product_sku); }
      if (location_id) { query += ` AND p.location_id = $${pi++}`; params.push(location_id); }

      query += ` GROUP BY p.id, l.location_code, l.zone, l.rack, w.warehouse_name`;
      query += ` ORDER BY p.created_at DESC LIMIT $${pi++} OFFSET $${pi++}`;
      params.push(parseInt(limit), parseInt(offset));

      const result = await pool.query(query, params);
      res.json({ success: true, data: result.rows });
    } catch (error) {
      logger.error('Error fetching pallets:', error);
      next(error);
    }
  }

  // GET /api/v1/pallets/:id
  static async getPalletById(req, res, next) {
    try {
      const { id } = req.params;

      const palletResult = await pool.query(`
        SELECT p.*, l.location_code, l.zone, l.rack, w.warehouse_name
        FROM pallets p
        LEFT JOIN locations l ON l.id = p.location_id
        LEFT JOIN warehouses w ON w.id = p.warehouse_id
        WHERE p.id = $1
      `, [id]);

      if (palletResult.rows.length === 0) throw new AppError('Paletul nu există', 404);
      const pallet = palletResult.rows[0];

      // Batches pe acest palet
      const batchesResult = await pool.query(`
        SELECT b.id, b.batch_number, b.product_sku, b.current_quantity,
               b.length_meters, b.slot_position, b.status,
               COALESCE(p.name, b.product_sku) AS product_name,
               COALESCE(grl.unit, 'Buc') AS unit
        FROM product_batches b
        LEFT JOIN products p ON p.sku = b.product_sku
        LEFT JOIN goods_receipt_lines grl ON grl.batch_id = b.id
        WHERE b.pallet_id = $1
        ORDER BY b.slot_position ASC NULLS LAST, b.created_at ASC
      `, [id]);

      // Istoricul mișcărilor
      const movementsResult = await pool.query(`
        SELECT pm.*, fl.location_code AS from_code, tl.location_code AS to_code
        FROM pallet_movements pm
        LEFT JOIN locations fl ON fl.id = pm.from_location_id
        LEFT JOIN locations tl ON tl.id = pm.to_location_id
        WHERE pm.pallet_id = $1
        ORDER BY pm.moved_at DESC
        LIMIT 20
      `, [id]);

      res.json({
        success: true,
        data: {
          ...pallet,
          batches: batchesResult.rows,
          movements: movementsResult.rows,
          occupancy_pct: pallet.max_slots > 0
            ? Math.round((pallet.current_slots / pallet.max_slots) * 100)
            : 0,
        },
      });
    } catch (error) {
      logger.error('Error fetching pallet:', error);
      next(error);
    }
  }

  // POST /api/v1/pallets
  // Creare palet nou cu cod generat automat
  static async createPallet(req, res, next) {
    const client = await pool.connect();
    try {
      const {
        warehouse_id, pallet_type = 'EURO',
        max_slots = 10, tare_weight_kg, notes,
      } = req.body;

      if (!warehouse_id) throw new AppError('warehouse_id este obligatoriu', 400);

      // Generează cod palet secvențial: PAL-2026-0001
      const year = new Date().getFullYear();
      const seqResult = await client.query(`SELECT nextval('pallet_seq') AS seq`);
      const seq = String(seqResult.rows[0].seq).padStart(4, '0');
      const pallet_code = `PAL-${year}-${seq}`;

      // Generează QR
      const qrPayload = JSON.stringify({ type: 'PALLET', code: pallet_code });
      const qrCode = await QRCode.toDataURL(qrPayload);

      await client.query('BEGIN');

      const result = await client.query(`
        INSERT INTO pallets
          (pallet_code, qr_code, warehouse_id, pallet_type, max_slots, tare_weight_kg, notes, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `, [
        pallet_code, qrCode, warehouse_id, pallet_type,
        max_slots, tare_weight_kg || null, notes || null,
        req.user?.id || null,
      ]);

      // Audit
      await client.query(
        `INSERT INTO wms_ops_audit
           (action_type, entity_type, entity_id, entity_code, service, changes, user_id)
         VALUES ('PALLET_CREATE', 'pallet', $1, $2, 'inventory', $3, $4)`,
        [result.rows[0].id, pallet_code, JSON.stringify({ max_slots, pallet_type }), req.user?.id || null]
      );

      await client.query('COMMIT');
      logger.info(`Palet creat: ${pallet_code}`);
      res.status(201).json({ success: true, data: result.rows[0] });
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error creating pallet:', error);
      next(error);
    } finally {
      client.release();
    }
  }

  // POST /api/v1/pallets/:id/add-batch
  // Adaugă un batch pe palet (scanare produs → palet)
  // Body: { batch_id, slot_position? }
  static async addBatch(req, res, next) {
    const client = await pool.connect();
    try {
      const { id: pallet_id } = req.params;
      const { batch_id, slot_position } = req.body;

      if (!batch_id) throw new AppError('batch_id este obligatoriu', 400);

      await client.query('BEGIN');

      // Verifică paletul
      const palletResult = await client.query(
        `SELECT * FROM pallets WHERE id = $1 FOR UPDATE`, [pallet_id]
      );
      if (palletResult.rows.length === 0) throw new AppError('Paletul nu există', 404);
      const pallet = palletResult.rows[0];

      if (pallet.status === 'FULL') throw new AppError('Paletul este plin', 409);
      if (pallet.status === 'RETIRED') throw new AppError('Paletul este retras din uz', 409);

      // Verifică batch-ul
      const batchResult = await client.query(
        `SELECT b.*, COALESCE(p.name, b.product_sku) AS product_name
         FROM product_batches b
         LEFT JOIN products p ON p.sku = b.product_sku
         WHERE b.id = $1`, [batch_id]
      );
      if (batchResult.rows.length === 0) throw new AppError('Batch-ul nu există', 404);
      const batch = batchResult.rows[0];
      if (batch.pallet_id) throw new AppError('Batch-ul este deja pe un palet', 409);

      // Calculează slot_position dacă nu e dat
      let position = slot_position;
      if (!position) {
        const maxPos = await client.query(
          `SELECT COALESCE(MAX(slot_position), 0) AS max_pos FROM product_batches WHERE pallet_id = $1`,
          [pallet_id]
        );
        position = (maxPos.rows[0].max_pos || 0) + 1;
      }

      // Asociaz batch cu palet
      await client.query(
        `UPDATE product_batches SET pallet_id = $1, slot_position = $2, updated_at = NOW()
         WHERE id = $3`,
        [pallet_id, position, batch_id]
      );

      // Dacă paletul are locație, o propagăm și la batch
      if (pallet.location_id && !batch.location_id) {
        await client.query(
          `UPDATE product_batches SET location_id = $1, updated_at = NOW() WHERE id = $2`,
          [pallet.location_id, batch_id]
        );
      }

      await client.query('COMMIT');

      logger.info(`Batch ${batch.batch_number} adăugat pe paletul ${pallet.pallet_code} (slot ${position})`);
      res.json({
        success: true,
        message: `Batch ${batch.batch_number} adăugat pe paletul ${pallet.pallet_code}`,
        pallet_code: pallet.pallet_code,
        slot_position: position,
      });
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error adding batch to pallet:', error);
      next(error);
    } finally {
      client.release();
    }
  }

  // POST /api/v1/pallets/:id/place
  // Plasează paletul la o locație (scan palet → scan locație)
  // Body: { location_id }
  static async placePallet(req, res, next) {
    const client = await pool.connect();
    try {
      const { id: pallet_id } = req.params;
      const { location_id } = req.body;

      if (!location_id) throw new AppError('location_id este obligatoriu', 400);

      await client.query('BEGIN');

      // Verifică paletul
      const palletResult = await client.query(
        `SELECT * FROM pallets WHERE id = $1 FOR UPDATE`, [pallet_id]
      );
      if (palletResult.rows.length === 0) throw new AppError('Paletul nu există', 404);
      const pallet = palletResult.rows[0];
      const prevLocationId = pallet.location_id;

      // Verifică locația
      const locResult = await client.query(
        `SELECT id, location_code, status FROM locations WHERE id = $1`, [location_id]
      );
      if (locResult.rows.length === 0) throw new AppError('Locația nu există', 404);
      const loc = locResult.rows[0];
      if (loc.status === 'BLOCKED' || loc.status === 'MAINTENANCE') {
        throw new AppError(`Locația ${loc.location_code} nu este disponibilă`, 400);
      }

      // Update palet
      await client.query(
        `UPDATE pallets SET location_id = $1, status = CASE WHEN current_slots = 0 THEN 'EMPTY' ELSE 'IN_USE' END, updated_at = NOW()
         WHERE id = $2`,
        [location_id, pallet_id]
      );

      // Propagă locația la toate batchurile de pe palet
      await client.query(
        `UPDATE product_batches SET location_id = $1, updated_at = NOW()
         WHERE pallet_id = $2 AND status = 'INTACT'`,
        [location_id, pallet_id]
      );

      // Marchează locația ca ocupată
      await client.query(
        `UPDATE locations SET status = 'OCCUPIED', updated_at = NOW() WHERE id = $1`,
        [location_id]
      );

      // Înregistrează mișcarea paletului
      await client.query(
        `INSERT INTO pallet_movements (pallet_id, from_location_id, to_location_id, moved_by, reason)
         VALUES ($1, $2, $3, $4, 'PUTAWAY')`,
        [pallet_id, prevLocationId || null, location_id, req.user?.id || null]
      );

      // Audit
      await client.query(
        `INSERT INTO wms_ops_audit
           (action_type, entity_type, entity_id, entity_code, service, changes, user_id)
         VALUES ('PALLET_PLACE', 'pallet', $1, $2, 'inventory', $3, $4)`,
        [
          pallet_id, pallet.pallet_code,
          JSON.stringify({ from_location_id: prevLocationId, to_location_id: location_id }),
          req.user?.id || null,
        ]
      );

      await client.query('COMMIT');
      logger.info(`Paletul ${pallet.pallet_code} plasat la locația ${loc.location_code}`);
      res.json({
        success: true,
        message: `Paletul ${pallet.pallet_code} a fost plasat la ${loc.location_code}`,
        pallet_code: pallet.pallet_code,
        location_code: loc.location_code,
      });
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error placing pallet:', error);
      next(error);
    } finally {
      client.release();
    }
  }

  // GET /api/v1/pallets/available-space
  // Paleți cu loc liber pentru un produs — folosit la recepție pentru sugestii
  // Query: ?product_sku=X&warehouse_id=Y
  static async getAvailableSpace(req, res, next) {
    try {
      const { product_sku, warehouse_id } = req.query;

      if (!product_sku) throw new AppError('product_sku este obligatoriu', 400);

      const result = await pool.query(`
        SELECT
          p.id, p.pallet_code, p.max_slots, p.current_slots,
          p.max_slots - p.current_slots AS free_slots,
          p.status, p.location_id,
          l.location_code, l.zone, l.rack,
          p.primary_product_sku,
          ROUND((p.current_slots::numeric / NULLIF(p.max_slots, 0)) * 100) AS occupancy_pct
        FROM pallets p
        LEFT JOIN locations l ON l.id = p.location_id
        WHERE p.primary_product_sku = $1
          AND p.status IN ('IN_USE', 'EMPTY')
          AND p.current_slots < p.max_slots
          ${warehouse_id ? 'AND p.warehouse_id = $2' : ''}
        ORDER BY p.current_slots DESC, p.created_at ASC
        LIMIT 10
      `, warehouse_id ? [product_sku, warehouse_id] : [product_sku]);

      res.json({ success: true, data: result.rows });
    } catch (error) {
      logger.error('Error fetching available pallet space:', error);
      next(error);
    }
  }

  // GET /api/v1/pallets/:id/qr
  // Returnează imaginea QR a paletului (data URL sau SVG)
  static async getPalletQR(req, res, next) {
    try {
      const { id } = req.params;
      const result = await pool.query(`SELECT pallet_code, qr_code FROM pallets WHERE id = $1`, [id]);
      if (result.rows.length === 0) throw new AppError('Paletul nu există', 404);

      const { pallet_code, qr_code } = result.rows[0];

      // Dacă nu are QR stocat, generează acum
      let qr = qr_code;
      if (!qr) {
        qr = await QRCode.toDataURL(JSON.stringify({ type: 'PALLET', code: pallet_code, id }));
        await pool.query(`UPDATE pallets SET qr_code = $1 WHERE id = $2`, [qr, id]);
      }

      res.json({ success: true, pallet_code, qr_code: qr });
    } catch (error) {
      logger.error('Error fetching pallet QR:', error);
      next(error);
    }
  }

  // ============================================================
  // PALLET PRODUCT CONFIG — configurare capacitate per produs
  // ============================================================

  // GET /api/v1/pallets/config?warehouse_id=&product_sku=
  static async getConfigs(req, res, next) {
    try {
      const { warehouse_id, product_sku, pallet_type } = req.query;
      let q = `
        SELECT c.*, p.name AS product_name
        FROM pallet_product_config c
        LEFT JOIN products p ON p.sku = c.product_sku
        WHERE 1=1
      `;
      const params = [];
      let pi = 1;
      if (warehouse_id) { q += ` AND (c.warehouse_id = $${pi++} OR c.warehouse_id IS NULL)`; params.push(warehouse_id); }
      if (product_sku)  { q += ` AND c.product_sku = $${pi++}`; params.push(product_sku); }
      if (pallet_type)  { q += ` AND c.pallet_type = $${pi++}`; params.push(pallet_type); }
      q += ' ORDER BY c.product_sku, c.pallet_type';
      const result = await pool.query(q, params);
      res.json({ success: true, data: result.rows });
    } catch (error) {
      logger.error('Error fetching pallet configs:', error);
      next(error);
    }
  }

  // POST /api/v1/pallets/config — creare sau upsert configurație
  static async upsertConfig(req, res, next) {
    try {
      const {
        product_sku, pallet_type = 'EURO', units_per_pallet,
        max_weight_kg, max_volume_m3, unit_weight_kg, unit_volume_m3,
        stacking_allowed = true, notes, warehouse_id,
      } = req.body;

      if (!product_sku) throw new AppError('product_sku obligatoriu', 400);
      if (!units_per_pallet || units_per_pallet < 1) throw new AppError('units_per_pallet trebuie să fie >= 1', 400);

      const result = await pool.query(
        `INSERT INTO pallet_product_config
           (product_sku, pallet_type, units_per_pallet, max_weight_kg, max_volume_m3,
            unit_weight_kg, unit_volume_m3, stacking_allowed, notes, warehouse_id, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         ON CONFLICT (product_sku, pallet_type, warehouse_id)
         DO UPDATE SET
           units_per_pallet = EXCLUDED.units_per_pallet,
           max_weight_kg    = EXCLUDED.max_weight_kg,
           max_volume_m3    = EXCLUDED.max_volume_m3,
           unit_weight_kg   = EXCLUDED.unit_weight_kg,
           unit_volume_m3   = EXCLUDED.unit_volume_m3,
           stacking_allowed = EXCLUDED.stacking_allowed,
           notes            = EXCLUDED.notes,
           updated_at       = NOW()
         RETURNING *`,
        [
          product_sku, pallet_type, units_per_pallet,
          max_weight_kg || null, max_volume_m3 || null,
          unit_weight_kg || null, unit_volume_m3 || null,
          stacking_allowed, notes || null, warehouse_id || null,
          req.user?.id || null,
        ]
      );

      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      logger.error('Error upserting pallet config:', error);
      next(error);
    }
  }

  // DELETE /api/v1/pallets/config/:configId
  static async deleteConfig(req, res, next) {
    try {
      const { configId } = req.params;
      const r = await pool.query('DELETE FROM pallet_product_config WHERE id = $1 RETURNING id', [configId]);
      if (r.rowCount === 0) throw new AppError('Configurație negăsită', 404);
      res.json({ success: true, message: 'Configurație ștearsă' });
    } catch (error) {
      logger.error('Error deleting pallet config:', error);
      next(error);
    }
  }
}

module.exports = PalletController;
