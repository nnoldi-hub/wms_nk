const { pool } = require('../config/database');
const logger = require('../utils/logger');
const { AppError } = require('../middleware/errorHandler');

function normalizeUnit(unitRaw) {
  if (!unitRaw) return null;
  const u = String(unitRaw).toLowerCase().trim();
  if (['drum', 'tambur'].includes(u)) return 'DRUM';
  if (['roll', 'colac', 'sul'].includes(u)) return 'ROLL';
  if (['pallet', 'palet'].includes(u)) return 'PALLET';
  if (['box', 'cutie'].includes(u)) return 'BOX';
  if (['meter', 'm', 'metru', 'metri'].includes(u)) return 'METER';
  if (['kg', 'kilogram'].includes(u)) return 'KG';
  if (['piece', 'buc', 'bucata', 'bucată'].includes(u)) return 'PIECE';
  return u.toUpperCase();
}

class ImportController {
  static async importProducts(req, res, next) {
    const client = await pool.connect();
    try {
      const { rows } = req.body || {};
      if (!Array.isArray(rows) || rows.length === 0) {
        throw new AppError('Body must contain non-empty array: rows', 400);
      }

      await client.query('BEGIN');
      let createdProducts = 0;
      let createdBatches = 0;

      for (const r of rows) {
        const sku = (r.sku || '').trim();
        const name = (r.product_name || sku || '').trim();
        const qty = Number(r.quantity || 0);
        const unitCode = normalizeUnit(r.unit);
        const assoc = r.association ? String(r.association) : null;
        const notes = `Initial import${assoc ? ' - ' + assoc : ''}`;

        if (!sku) continue;

        // Upsert product with minimal fields
        const prodRes = await client.query(
          `INSERT INTO products (sku, name, uom)
           VALUES ($1, $2, $3)
           ON CONFLICT (sku) DO UPDATE SET name = EXCLUDED.name
           RETURNING sku`,
          [sku, name || sku, 'PIECE']
        );
        if (prodRes.rowCount > 0) {
          createdProducts += 1; // counts attempted upserts for simplicity
        }

        if (qty > 0 && unitCode) {
          // Resolve unit id
          const unitRes = await client.query(
            `SELECT id FROM product_units WHERE code = $1`,
            [unitCode]
          );
          const unitId = unitRes.rows[0]?.id;

          if (!unitId) {
            logger.warn(`Unknown unit code '${unitCode}' for SKU ${sku}, skipping batch`);
            continue;
          }

          // Create batch
          const batchRes = await client.query(
            `INSERT INTO product_batches
             (product_sku, unit_id, initial_quantity, current_quantity, notes, status)
             VALUES ($1, $2, $3, $3, $4, 'INTACT')
             RETURNING id`,
            [sku, unitId, qty, notes]
          );
          if (batchRes.rowCount > 0) createdBatches += 1;
        }
      }

      await client.query('COMMIT');
      return res.status(201).json({
        success: true,
        data: { createdProducts, createdBatches, processed: rows.length }
      });
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Import products error:', error);
      next(error);
    } finally {
      client.release();
    }
  }
}

module.exports = ImportController;
