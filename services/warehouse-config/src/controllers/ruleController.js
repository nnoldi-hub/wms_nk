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
const cache = require('../services/cache');

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
      const cacheKey = cache.keys.rules(scope, is_active, rule_type);

      const data = await cache.getOrLoad(cacheKey, async () => {
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
        return result.rows;
      }, cache.TTL.RULES);

      res.json({ success: true, data, total: data.length });
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
      await cache.invalidatePrefix(cache.prefixes.rules);
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
      const { name, rule_type, scope, priority, conditions, actions, description, is_active, change_reason } = req.body;

      const existing = await db.query(
        `SELECT id, name, rule_type, scope, priority, conditions, actions, description, is_active, version_number
         FROM wms_rules WHERE id = $1`,
        [id]
      );
      if (existing.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Regula nu a fost găsită' });
      }

      if (scope && !VALID_SCOPES.includes(scope.toUpperCase())) {
        return res.status(400).json({ success: false, error: `Scope invalid. Valori permise: ${VALID_SCOPES.join(', ')}` });
      }

      const prev = existing.rows[0];
      const nextVersion = (prev.version_number || 1) + 1;

      // Salvează versiunea anterioară
      await db.query(
        `INSERT INTO wms_rule_versions
           (rule_id, version, name, rule_type, scope, priority, conditions, actions, description, is_active, changed_by, change_reason)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          id, prev.version_number || 1,
          prev.name, prev.rule_type, prev.scope, prev.priority,
          prev.conditions, prev.actions, prev.description, prev.is_active,
          req.user?.userId ?? null,
          change_reason || null,
        ]
      );

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

      sets.push(`version_number = $${idx}`); params.push(nextVersion); idx++;
      sets.push(`updated_at = NOW()`);
      params.push(id);

      const result = await db.query(
        `UPDATE wms_rules SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
        params
      );

      await cache.invalidatePrefix(cache.prefixes.rules);
      res.json({ success: true, data: result.rows[0] });
    } catch (err) {
      logger.error('[RuleController] update error:', err);
      next(err);
    }
  }

  // ─── GET VERSIONS ─────────────────────────────────────────────────────────

  async getVersions(req, res, next) {
    try {
      const { id } = req.params;
      const exists = await db.query('SELECT id FROM wms_rules WHERE id = $1', [id]);
      if (exists.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Regula nu a fost găsită' });
      }

      const result = await db.query(
        `SELECT v.*, u.username AS changed_by_name
         FROM wms_rule_versions v
         LEFT JOIN users u ON v.changed_by = u.id
         WHERE v.rule_id = $1
         ORDER BY v.version DESC`,
        [id]
      );

      res.json({ success: true, data: result.rows, total: result.rows.length });
    } catch (err) {
      logger.error('[RuleController] getVersions error:', err);
      next(err);
    }
  }

  // ─── RESTORE VERSION ──────────────────────────────────────────────────────

  async restore(req, res, next) {
    try {
      const { id, version } = req.params;

      const versionRow = await db.query(
        `SELECT * FROM wms_rule_versions WHERE rule_id = $1 AND version = $2`,
        [id, parseInt(version, 10)]
      );
      if (versionRow.rows.length === 0) {
        return res.status(404).json({ success: false, error: `Versiunea ${version} nu există pentru această regulă` });
      }

      const v = versionRow.rows[0];

      // Salvează starea curentă ca versiune nouă înainte de restore
      const current = await db.query(
        `SELECT name, rule_type, scope, priority, conditions, actions, description, is_active, version_number
         FROM wms_rules WHERE id = $1`,
        [id]
      );
      if (current.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Regula nu a fost găsită' });
      }
      const cur = current.rows[0];
      const nextVersion = (cur.version_number || 1) + 1;

      await db.query(
        `INSERT INTO wms_rule_versions
           (rule_id, version, name, rule_type, scope, priority, conditions, actions, description, is_active, changed_by, change_reason)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          id, cur.version_number || 1,
          cur.name, cur.rule_type, cur.scope, cur.priority,
          cur.conditions, cur.actions, cur.description, cur.is_active,
          req.user?.userId ?? null,
          `Restore la versiunea ${version}`,
        ]
      );

      const restored = await db.query(
        `UPDATE wms_rules
         SET name=$1, rule_type=$2, scope=$3, priority=$4,
             conditions=$5, actions=$6, description=$7, is_active=$8,
             version_number=$9, updated_at=NOW()
         WHERE id=$10
         RETURNING *`,
        [
          v.name, v.rule_type, v.scope, v.priority,
          v.conditions, v.actions, v.description, v.is_active,
          nextVersion, id,
        ]
      );

      await cache.invalidatePrefix(cache.prefixes.rules);
      logger.info('[RuleController] Restored rule to version', { id, version });
      res.json({ success: true, data: restored.rows[0], restored_from_version: parseInt(version, 10) });
    } catch (err) {
      logger.error('[RuleController] restore error:', err);
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
      await cache.invalidatePrefix(cache.prefixes.rules);
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
