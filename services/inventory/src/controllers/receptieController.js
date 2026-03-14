const { pool } = require('../config/database');
const logger = require('../utils/logger');

// ─── Helper audit ───────────────────────────────────────
async function auditOp(action_type, entity_type, entity_id, entity_code, changes, extra_info, req) {
  try {
    const user = req?.user || {};
    const user_id = user.userId || user.id || 'system';
    const user_name = user.username || user.email || user_id;
    const ip = (req?.headers?.['x-forwarded-for'] || req?.ip || null)?.split?.(',')[0]?.trim() || null;
    await pool.query(
      `INSERT INTO wms_ops_audit
         (action_type, entity_type, entity_id, entity_code, service, changes, extra_info, user_id, user_name, ip_address)
       VALUES ($1, $2, $3, $4, 'inventory', $5, $6, $7, $8, $9::inet)`,
      [action_type, entity_type, entity_id || null, entity_code || null,
       changes ? JSON.stringify(changes) : null,
       extra_info ? JSON.stringify(extra_info) : null,
       user_id, user_name, ip]
    );
  } catch (auditErr) {
    logger.warn('wms_ops_audit insert failed (non-critical):', auditErr.message);
  }
}

class ReceptieController {
  // GET /api/v1/receptie/units
  // Returns all product_units (DRUM, ROLL, BOX, etc.) with their UUIDs
  static async getUnits(req, res, next) {
    try {
      const result = await pool.query(
        'SELECT id, code, name, type, is_splittable, description FROM product_units ORDER BY code'
      );
      res.json({ success: true, data: result.rows });
    } catch (error) {
      logger.error('Error fetching product units:', error);
      next(error);
    }
  }

  // POST /api/v1/receptie
  // Creates a new batch on goods receipt.
  // Accepts unit_code (e.g. "DRUM") instead of unit_id UUID so the frontend
  // does not need to pre-fetch UUIDs.
  static async createReceptie(req, res, next) {
    try {
      const {
        product_sku,
        unit_code,      // e.g. "DRUM", "ROLL", "BOX"
        supplier,       // free-text supplier / manufacturer name
        length_meters,
        weight_kg,
        location_id,
        notes,
      } = req.body;

      if (!product_sku || !unit_code) {
        return res.status(400).json({
          success: false,
          message: 'product_sku și unit_code sunt obligatorii',
        });
      }

      // Resolve unit_id by code
      const unitResult = await pool.query(
        'SELECT id FROM product_units WHERE code = $1',
        [unit_code.toUpperCase()]
      );
      if (unitResult.rows.length === 0) {
        return res.status(400).json({
          success: false,
          message: `Tip ambalaj necunoscut: ${unit_code}`,
        });
      }
      const unit_id = unitResult.rows[0].id;

      // Verify the product exists
      const productResult = await pool.query(
        'SELECT sku FROM products WHERE sku = $1',
        [product_sku]
      );
      if (productResult.rows.length === 0) {
        return res.status(400).json({
          success: false,
          message: `Produsul cu SKU "${product_sku}" nu există`,
        });
      }

      // Build notes text including supplier
      const noteParts = [];
      if (supplier && supplier.trim()) {
        noteParts.push(`Furnizor: ${supplier.trim()}`);
      }
      if (notes && notes.trim()) {
        noteParts.push(notes.trim());
      }
      const finalNotes = noteParts.length > 0 ? noteParts.join('\n') : null;

      // The quantity for a drum is its length in meters (or 1 if not provided)
      const qty = parseFloat(length_meters) || 1;

      const result = await pool.query(
        `INSERT INTO product_batches
          (product_sku, unit_id, initial_quantity, current_quantity, length_meters, weight_kg, location_id, notes, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'INTACT')
         RETURNING *`,
        [
          product_sku,
          unit_id,
          qty,
          qty,
          length_meters ? parseFloat(length_meters) : null,
          weight_kg ? parseFloat(weight_kg) : null,
          location_id || null,
          finalNotes,
        ]
      );

      const batch = result.rows[0];
      logger.info(`Receptie: batch creat ${batch.batch_number} pentru ${product_sku}`);
      await auditOp('RECEIPT_BATCH', 'batch', batch.id, batch.batch_number,
        { product_sku, unit_code, qty, location_id: location_id || null },
        { supplier: supplier || null, length_meters: length_meters || null, weight_kg: weight_kg || null },
        req
      );

      res.status(201).json({ success: true, data: batch });
    } catch (error) {
      logger.error('Error creating receptie batch:', error);
      next(error);
    }
  }
}

module.exports = ReceptieController;
