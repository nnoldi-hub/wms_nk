'use strict';

/**
 * Ops Audit Controller — Endpoint-uri pentru wms_ops_audit (locații, loturi, picking)
 */

const db = require('../config/database');
const logger = require('../config/logger');

class OpsAuditController {

  /**
   * POST /api/v1/audit/ui-event
   * Înregistrează o acțiune efectuată de utilizator în interfața web.
   * Apelat direct din frontend pentru acțiuni UI (navigare, export, click-uri cheie).
   *
   * Body: { action_type, entity_type?, entity_id?, entity_code?, extra_info? }
   */
  async createUiEvent(req, res, next) {
    try {
      const { action_type, entity_type, entity_id, entity_code, extra_info } = req.body;
      if (!action_type) {
        return res.status(400).json({ success: false, error: 'action_type is required' });
      }

      const user = req.user || {};
      const user_id   = user.id || user.userId || 'anonymous';
      const user_name = user.username || user.email || user_id;
      const ip = (req.headers['x-forwarded-for'] || req.ip || null)
        ?.split(',')[0]?.trim() || null;

      await db.query(
        `INSERT INTO wms_ops_audit
           (action_type, entity_type, entity_id, entity_code, service, extra_info, user_id, user_name, ip_address)
         VALUES ($1, $2, $3, $4, 'ui', $5, $6, $7, $8::inet)`,
        [
          String(action_type).toUpperCase().slice(0, 100),
          entity_type || 'ui_action',
          entity_id   || null,
          entity_code || null,
          extra_info ? JSON.stringify(extra_info) : null,
          user_id,
          user_name,
          ip,
        ]
      );

      res.status(201).json({ success: true });
    } catch (err) {
      logger.error('opsAuditController.createUiEvent error:', err.message);
      next(err);
    }
  }

  /**
   * GET /api/v1/audit/events
   * Returnează evenimentele din wms_ops_audit cu filtrare și paginare.
   *
   * Query params:
   *   - action_type  : ex. CREATE_LOCATION, RECEIPT_BATCH, PICKING_COMPLETE …
   *   - entity_type  : location | batch | picking_job | goods_receipt
   *   - service      : warehouse-config | inventory | auth
   *   - user_id      : filtru după utilizator
   *   - from         : ISO date (created_at >=)
   *   - to           : ISO date (created_at <=)
   *   - q            : search în entity_code (ILIKE)
   *   - limit        : default 50, max 200
   *   - offset       : default 0
   */
  async list(req, res, next) {
    try {
      const {
        action_type,
        entity_type,
        service,
        user_id,
        from,
        to,
        q,
        limit = 50,
        offset = 0,
      } = req.query;

      const params = [];
      let idx = 1;
      const conditions = ['1=1'];

      if (action_type) {
        conditions.push(`a.action_type = $${idx}`);
        params.push(action_type.toUpperCase());
        idx++;
      }
      if (entity_type) {
        conditions.push(`a.entity_type = $${idx}`);
        params.push(entity_type);
        idx++;
      }
      if (service) {
        conditions.push(`a.service = $${idx}`);
        params.push(service);
        idx++;
      }
      if (user_id) {
        conditions.push(`a.user_id = $${idx}`);
        params.push(user_id);
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
      if (q) {
        conditions.push(`a.entity_code ILIKE $${idx}`);
        params.push(`%${q}%`);
        idx++;
      }

      const pageLimit = Math.min(parseInt(limit) || 50, 200);
      const pageOffset = parseInt(offset) || 0;

      const whereClause = conditions.join(' AND ');

      const [dataRes, countRes] = await Promise.all([
        db.query(
          `SELECT a.*
           FROM wms_ops_audit a
           WHERE ${whereClause}
           ORDER BY a.created_at DESC
           LIMIT $${idx} OFFSET $${idx + 1}`,
          [...params, pageLimit, pageOffset]
        ),
        db.query(
          `SELECT COUNT(*) FROM wms_ops_audit a WHERE ${whereClause}`,
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
      logger.error('opsAuditController.list error:', err.message);
      next(err);
    }
  }

  /**
   * GET /api/v1/audit/events/stats
   * Statistici rapide: top acțiuni, top utilizatori, activitate ultimele 7 zile.
   */
  async stats(req, res, next) {
    try {
      const [byAction, byService, byUser, daily] = await Promise.all([
        db.query(`
          SELECT action_type, COUNT(*)::int AS cnt
          FROM wms_ops_audit
          WHERE created_at >= NOW() - INTERVAL '30 days'
          GROUP BY action_type ORDER BY cnt DESC LIMIT 15
        `),
        db.query(`
          SELECT service, COUNT(*)::int AS cnt
          FROM wms_ops_audit
          WHERE created_at >= NOW() - INTERVAL '30 days'
          GROUP BY service ORDER BY cnt DESC
        `),
        db.query(`
          SELECT user_name, COUNT(*)::int AS cnt
          FROM wms_ops_audit
          WHERE created_at >= NOW() - INTERVAL '7 days'
          GROUP BY user_name ORDER BY cnt DESC LIMIT 10
        `),
        db.query(`
          SELECT date_trunc('day', created_at)::date AS day, COUNT(*)::int AS cnt
          FROM wms_ops_audit
          WHERE created_at >= NOW() - INTERVAL '30 days'
          GROUP BY 1 ORDER BY 1
        `),
      ]);

      res.json({
        success: true,
        data: {
          by_action: byAction.rows,
          by_service: byService.rows,
          by_user: byUser.rows,
          daily: daily.rows,
        },
      });
    } catch (err) {
      logger.error('opsAuditController.stats error:', err.message);
      next(err);
    }
  }
}

module.exports = new OpsAuditController();
