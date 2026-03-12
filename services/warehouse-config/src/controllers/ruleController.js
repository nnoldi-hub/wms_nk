'use strict';

/**
 * Rule Controller — CRUD reguli + endpoints sugestii
 */

const db = require('../config/database');
const logger = require('../config/logger');
const { v4: uuidv4 } = require('uuid');
const { applyRules, buildContext } = require('../services/ruleEngine');
const { suggestPutaway } = require('../services/putawayEngine');
const { suggestPicking } = require('../services/pickingEngine');

const VALID_SCOPES = ['PUTAWAY', 'PICKING', 'RECEIVING', 'CUTTING', 'SEWING', 'SHIPPING', 'GENERAL'];
const VALID_RULE_TYPES = [
  'FIFO', 'MIN_WASTE', 'LOCATION_PROXIMITY', 'BATCH_SIZE', 'CUSTOM',
  'USE_REMAINS_FIRST', 'SUGGEST_ZONE', 'SUGGEST_LOCATION',
  'BLOCK_OPERATION', 'REQUIRE_APPROVAL', 'PICK_STRATEGY',
];

class RuleController {
  // ─── LIST ──────────────────────────────────────────────────────────────────

  async getAll(req, res, next) {
    try {
      const { scope, is_active, rule_type } = req.query;

      let query = `
        SELECT r.*, u.username AS created_by_name
        FROM wms_rules r
        LEFT JOIN users u ON r.created_by = u.id
        WHERE 1=1
      `;
      const params = [];
      let idx = 1;

      if (scope) {
        query += ` AND r.scope = $${idx}`;
        params.push(scope.toUpperCase());
        idx++;
      }
      if (rule_type) {
        query += ` AND r.rule_type = $${idx}`;
        params.push(rule_type);
        idx++;
      }
      if (is_active !== undefined) {
        query += ` AND r.is_active = $${idx}`;
        params.push(is_active === 'true' || is_active === true);
        idx++;
      }

      query += ' ORDER BY r.scope, r.priority DESC, r.name';

      const result = await db.query(query, params);
      res.json({ success: true, data: result.rows, total: result.rows.length });
    } catch (err) {
      logger.error('[RuleController] getAll error:', err);
      next(err);
    }
  }

  // ─── GET BY ID ────────────────────────────────────────────────────────────

  async getById(req, res, next) {
    try {
      const { id } = req.params;
      const result = await db.query(
        `SELECT r.*, u.username AS created_by_name
         FROM wms_rules r
         LEFT JOIN users u ON r.created_by = u.id
         WHERE r.id = $1`,
        [id]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Regula nu a fost găsită' });
      }
      res.json({ success: true, data: result.rows[0] });
    } catch (err) {
      logger.error('[RuleController] getById error:', err);
      next(err);
    }
  }

  // ─── CREATE ───────────────────────────────────────────────────────────────

  async create(req, res, next) {
    try {
      const { name, rule_type, scope, priority, conditions, actions, description, is_active } = req.body;

      if (!name || !rule_type || !scope) {
        return res.status(400).json({ success: false, error: 'Câmpurile name, rule_type, scope sunt obligatorii' });
      }
      if (!VALID_SCOPES.includes(scope.toUpperCase())) {
        return res.status(400).json({ success: false, error: `Scope invalid. Valori permise: ${VALID_SCOPES.join(', ')}` });
      }
      if (!VALID_RULE_TYPES.includes(rule_type)) {
        return res.status(400).json({ success: false, error: `rule_type invalid. Valori permise: ${VALID_RULE_TYPES.join(', ')}` });
      }

      const id = uuidv4();
      const result = await db.query(
        `INSERT INTO wms_rules
           (id, name, rule_type, scope, priority, conditions, actions, description, is_active, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [
          id,
          name,
          rule_type,
          scope.toUpperCase(),
          priority ?? 50,
          JSON.stringify(conditions ?? []),
          JSON.stringify(actions ?? []),
          description ?? null,
          is_active !== false,
          req.user?.userId ?? null,
        ]
      );

      logger.info('[RuleController] Regulă creată:', { id, name, scope });
      res.status(201).json({ success: true, data: result.rows[0] });
    } catch (err) {
      logger.error('[RuleController] create error:', err);
      next(err);
    }
  }

  // ─── UPDATE ───────────────────────────────────────────────────────────────

  async update(req, res, next) {
    try {
      const { id } = req.params;
      const { name, rule_type, scope, priority, conditions, actions, description, is_active } = req.body;

      const existing = await db.query('SELECT id FROM wms_rules WHERE id = $1', [id]);
      if (existing.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Regula nu a fost găsită' });
      }

      if (scope && !VALID_SCOPES.includes(scope.toUpperCase())) {
        return res.status(400).json({ success: false, error: `Scope invalid. Valori permise: ${VALID_SCOPES.join(', ')}` });
      }

      const sets = [];
      const params = [];
      let idx = 1;

      if (name !== undefined)        { sets.push(`name = $${idx}`); params.push(name); idx++; }
      if (rule_type !== undefined)   { sets.push(`rule_type = $${idx}`); params.push(rule_type); idx++; }
      if (scope !== undefined)       { sets.push(`scope = $${idx}`); params.push(scope.toUpperCase()); idx++; }
      if (priority !== undefined)    { sets.push(`priority = $${idx}`); params.push(priority); idx++; }
      if (conditions !== undefined)  { sets.push(`conditions = $${idx}`); params.push(JSON.stringify(conditions)); idx++; }
      if (actions !== undefined)     { sets.push(`actions = $${idx}`); params.push(JSON.stringify(actions)); idx++; }
      if (description !== undefined) { sets.push(`description = $${idx}`); params.push(description); idx++; }
      if (is_active !== undefined)   { sets.push(`is_active = $${idx}`); params.push(is_active); idx++; }

      sets.push(`updated_at = NOW()`);
      params.push(id);

      const result = await db.query(
        `UPDATE wms_rules SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
        params
      );

      res.json({ success: true, data: result.rows[0] });
    } catch (err) {
      logger.error('[RuleController] update error:', err);
      next(err);
    }
  }

  // ─── DELETE ───────────────────────────────────────────────────────────────

  async remove(req, res, next) {
    try {
      const { id } = req.params;
      const result = await db.query('DELETE FROM wms_rules WHERE id = $1 RETURNING id', [id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Regula nu a fost găsită' });
      }
      res.json({ success: true, message: 'Regulă ștearsă' });
    } catch (err) {
      logger.error('[RuleController] remove error:', err);
      next(err);
    }
  }

  // ─── SUGGEST PUTAWAY ──────────────────────────────────────────────────────

  async suggestPutaway(req, res, next) {
    try {
      const { warehouse_id, product, stock, limit } = req.body;

      if (!warehouse_id || !product) {
        return res.status(400).json({
          success: false,
          error: 'Câmpurile warehouse_id și product sunt obligatorii',
        });
      }

      const result = await suggestPutaway({
        warehouseId: warehouse_id,
        product,
        stock: stock || {},
        limit: limit || 5,
      });

      res.json({ success: true, ...result });
    } catch (err) {
      logger.error('[RuleController] suggestPutaway error:', err);
      next(err);
    }
  }

  // ─── SUGGEST PICKING ──────────────────────────────────────────────────────

  async suggestPicking(req, res, next) {
    try {
      const { product_sku, requested_qty, uom, product, order_line, warehouse_id } = req.body;

      if (!product_sku || !requested_qty) {
        return res.status(400).json({
          success: false,
          error: 'Câmpurile product_sku și requested_qty sunt obligatorii',
        });
      }

      const result = await suggestPicking({
        productSku: product_sku,
        requestedQty: parseFloat(requested_qty),
        uom: uom || 'm',
        product: product || {},
        orderLine: order_line || {},
        warehouseId: warehouse_id || null,
      });

      res.json({ success: true, ...result });
    } catch (err) {
      logger.error('[RuleController] suggestPicking error:', err);
      next(err);
    }
  }

  // ─── EVALUATE (test manual) ───────────────────────────────────────────────

  async evaluate(req, res, next) {
    try {
      const { scope, context: rawContext } = req.body;

      if (!scope || !rawContext) {
        return res.status(400).json({ success: false, error: 'scope și context sunt obligatorii' });
      }

      // Preia regulile pentru scope-ul dat
      const rulesResult = await db.query(
        'SELECT * FROM wms_rules WHERE scope = $1 AND is_active = true ORDER BY priority DESC',
        [scope.toUpperCase()]
      );

      const { matchedRules, actions } = applyRules(rulesResult.rows, rawContext);

      res.json({
        success: true,
        scope,
        total_rules_evaluated: rulesResult.rows.length,
        matched_rules: matchedRules,
        resulting_actions: actions,
      });
    } catch (err) {
      logger.error('[RuleController] evaluate error:', err);
      next(err);
    }
  }
}

module.exports = new RuleController();
