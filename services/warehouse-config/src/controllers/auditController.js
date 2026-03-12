'use strict';

/**
 * Audit Controller — Endpoint-uri pentru logul de audit al motorului de reguli
 */

const db = require('../config/database');
const logger = require('../config/logger');
const { v4: uuidv4 } = require('uuid');

class AuditController {

  /**
   * GET /api/v1/rules/audit-log
   * Returnează log-ul de audit cu filtrare și paginare.
   *
   * Query params:
   *   - operation_type  : PUTAWAY | PICKING | CUTTING | EVALUATE
   *   - rule_id         : UUID regulă
   *   - entity_type     : picking_job | location | cutting_order
   *   - blocked         : true | false
   *   - from            : ISO date (created_at >=)
   *   - to              : ISO date (created_at <=)
   *   - limit           : default 50, max 200
   *   - offset          : default 0
   */
  async list(req, res, next) {
    try {
      const {
        operation_type,
        rule_id,
        entity_type,
        blocked,
        from,
        to,
        limit = 50,
        offset = 0,
      } = req.query;

      const params = [];
      let idx = 1;
      const conditions = ['1=1'];

      if (operation_type) {
        conditions.push(`a.operation_type = $${idx}`);
        params.push(operation_type.toUpperCase());
        idx++;
      }
      if (rule_id) {
        conditions.push(`a.rule_id = $${idx}`);
        params.push(rule_id);
        idx++;
      }
      if (entity_type) {
        conditions.push(`a.entity_type = $${idx}`);
        params.push(entity_type);
        idx++;
      }
      if (blocked !== undefined) {
        conditions.push(`a.blocked = $${idx}`);
        params.push(blocked === 'true' || blocked === true);
        idx++;
      }
      if (from) {
        conditions.push(`a.created_at >= $${idx}`);
        params.push(from);
        idx++;
      }
      if (to) {
        conditions.push(`a.created_at <= $${idx}`);
        params.push(to);
        idx++;
      }

      const pageLimit = Math.min(parseInt(limit) || 50, 200);
      const pageOffset = parseInt(offset) || 0;

      const whereClause = conditions.join(' AND ');

      const [dataRes, countRes] = await Promise.all([
        db.query(
          `SELECT a.*, r.name AS rule_name_current
           FROM wms_rule_audit_log a
           LEFT JOIN wms_rules r ON r.id = a.rule_id
           WHERE ${whereClause}
           ORDER BY a.created_at DESC
           LIMIT $${idx} OFFSET $${idx + 1}`,
          [...params, pageLimit, pageOffset]
        ),
        db.query(
          `SELECT COUNT(*) FROM wms_rule_audit_log a WHERE ${whereClause}`,
          params
        ),
      ]);

      res.json({
        success: true,
        data: dataRes.rows,
        pagination: {
          total: parseInt(countRes.rows[0].count),
          limit: pageLimit,
          offset: pageOffset,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/rules/audit-log
   * Inserează o înregistrare de audit (apelat intern de engines).
   * Poate fi apelat și de servicii externe pentru a loga decizii.
   */
  async create(req, res, next) {
    try {
      const {
        operation_type,
        entity_type,
        entity_id,
        rule_id,
        rule_name,
        rule_scope,
        rule_type,
        action_type,
        action_value,
        context_snapshot,
        matched = true,
        blocked = false,
      } = req.body;

      if (!operation_type) {
        return res.status(400).json({ success: false, message: 'operation_type este obligatoriu' });
      }

      const result = await db.query(
        `INSERT INTO wms_rule_audit_log
           (id, operation_type, entity_type, entity_id,
            rule_id, rule_name, rule_scope, rule_type,
            action_type, action_value, context_snapshot,
            matched, blocked,
            triggered_by, triggered_by_name)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
         RETURNING *`,
        [
          uuidv4(),
          operation_type.toUpperCase(),
          entity_type || null,
          entity_id ? String(entity_id) : null,
          rule_id || null,
          rule_name || null,
          rule_scope || null,
          rule_type || null,
          action_type || null,
          action_value ? String(action_value) : null,
          context_snapshot ? JSON.stringify(context_snapshot) : null,
          matched,
          blocked,
          req.user?.id || null,
          req.user?.username || null,
        ]
      );

      res.status(201).json({ success: true, data: result.rows[0] });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/rules/audit-log/stats
   * Statistici pentru dashboard: câte evenimente pe tip operație, câte blocate etc.
   */
  async stats(req, res, next) {
    try {
      const { from, to } = req.query;
      const params = [];
      let dateFilter = '';

      if (from) {
        params.push(from);
        dateFilter += ` AND created_at >= $${params.length}`;
      }
      if (to) {
        params.push(to);
        dateFilter += ` AND created_at <= $${params.length}`;
      }

      const [byOp, byRule, blockedCount, dailyCount] = await Promise.all([
        db.query(
          `SELECT operation_type, COUNT(*) AS count, SUM(CASE WHEN blocked THEN 1 ELSE 0 END) AS blocked
           FROM wms_rule_audit_log WHERE 1=1 ${dateFilter}
           GROUP BY operation_type ORDER BY count DESC`,
          params
        ),
        db.query(
          `SELECT rule_name, rule_scope, COUNT(*) AS count
           FROM wms_rule_audit_log
           WHERE rule_name IS NOT NULL ${dateFilter}
           GROUP BY rule_name, rule_scope ORDER BY count DESC LIMIT 10`,
          params
        ),
        db.query(
          `SELECT COUNT(*) AS total FROM wms_rule_audit_log WHERE blocked = true ${dateFilter}`,
          params
        ),
        db.query(
          `SELECT DATE_TRUNC('day', created_at) AS day, COUNT(*) AS count
           FROM wms_rule_audit_log WHERE 1=1 ${dateFilter}
           GROUP BY day ORDER BY day DESC LIMIT 30`,
          params
        ),
      ]);

      res.json({
        success: true,
        data: {
          by_operation: byOp.rows,
          top_rules:    byRule.rows,
          total_blocked: parseInt(blockedCount.rows[0]?.total || 0),
          daily_events:  dailyCount.rows,
        },
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new AuditController();

// ─── Helper pentru logare internă din engines ─────────────────────────────────

/**
 * Inserează o înregistrare de audit direct din DB (fără HTTP).
 * Folosit de putawayEngine, pickingEngine, cuttingEngine.
 */
async function logAuditEvent({ operationType, entityType, entityId, matchedRules, actions, contextSnapshot, blocked = false, triggeredBy = null }) {
  try {
    for (const rule of (matchedRules || [])) {
      for (const action of (actions || [])) {
        if (action.from_rule !== rule.name) continue;
        await db.query(
          `INSERT INTO wms_rule_audit_log
             (id, operation_type, entity_type, entity_id,
              rule_id, rule_name, rule_scope, rule_type,
              action_type, action_value, context_snapshot,
              matched, blocked, triggered_by_name)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
          [
            uuidv4(),
            operationType,
            entityType || null,
            entityId ? String(entityId) : null,
            rule.id || null,
            rule.name || null,
            null,
            rule.rule_type || null,
            action.type || null,
            action.value ? String(action.value) : null,
            contextSnapshot ? JSON.stringify(contextSnapshot) : null,
            true,
            blocked,
            triggeredBy || null,
          ]
        );
      }
    }
  } catch (err) {
    logger.warn('[audit] Eroare la logare audit:', err.message);
  }
}

module.exports.logAuditEvent = logAuditEvent;
