'use strict';

/**
 * Reports Controller — Rapoarte pentru motorul de reguli
 *
 * 1. GET /api/v1/reports/rule-engine/picking-efficiency
 *    Câte joburi au folosit fiecare strategie (MIN_WASTE, FIFO, USE_REMAINS_FIRST).
 *
 * 2. GET /api/v1/reports/rule-engine/underused-locations
 *    Locații fără activitate (nicio mișcare) în ultimele N zile.
 *
 * 3. GET /api/v1/reports/rule-engine/large-remnants
 *    Loturi parțiale cu rest mare (> X metru) care nu s-au mișcat.
 */

const db = require('../config/database');
const logger = require('../config/logger');

class ReportsController {

  // ─── 1. Eficiență picking ─────────────────────────────────────────────────

  /**
   * GET /api/v1/reports/rule-engine/picking-efficiency
   *
   * Query params:
   *   - from  : ISO date (default ultimele 30 de zile)
   *   - to    : ISO date
   */
  async pickingEfficiency(req, res, next) {
    try {
      const { from, to } = req.query;
      const fromDate = from || new Date(Date.now() - 30 * 86400_000).toISOString();
      const toDate   = to   || new Date().toISOString();

      // Distribuție strategii pe picking_job_items
      const strategyRes = await db.query(
        `SELECT
           COALESCE(pji.pick_strategy, 'NONE') AS strategy,
           COUNT(*) AS item_count,
           COUNT(DISTINCT pji.job_id) AS job_count
         FROM picking_job_items pji
         JOIN picking_jobs pj ON pj.id = pji.job_id
         WHERE pj.created_at BETWEEN $1 AND $2
         GROUP BY pji.pick_strategy
         ORDER BY item_count DESC`,
        [fromDate, toDate]
      );

      // Distribuție reguli aplicate
      const ruleRes = await db.query(
        `SELECT
           COALESCE(pji.rule_applied_name, 'Fără regulă') AS rule_name,
           COUNT(*) AS count,
           COUNT(DISTINCT pji.job_id) AS jobs
         FROM picking_job_items pji
         JOIN picking_jobs pj ON pj.id = pji.job_id
         WHERE pj.created_at BETWEEN $1 AND $2
         GROUP BY pji.rule_applied_name
         ORDER BY count DESC
         LIMIT 20`,
        [fromDate, toDate]
      );

      // Statistici generale
      const statsRes = await db.query(
        `SELECT
           COUNT(DISTINCT pj.id)                                        AS total_jobs,
           COUNT(pji.id)                                                 AS total_items,
           COUNT(pji.id) FILTER (WHERE pji.pick_strategy IS NOT NULL)   AS items_with_rule,
           COUNT(pji.id) FILTER (WHERE pji.pick_strategy IS NULL)       AS items_no_rule,
           SUM((pji.engine_suggestion->>'waste_m')::numeric)
             FILTER (WHERE pji.engine_suggestion IS NOT NULL)           AS total_waste_m_engine
         FROM picking_jobs pj
         LEFT JOIN picking_job_items pji ON pji.job_id = pj.id
         WHERE pj.created_at BETWEEN $1 AND $2`,
        [fromDate, toDate]
      );

      res.json({
        success: true,
        data: {
          period: { from: fromDate, to: toDate },
          by_strategy:  strategyRes.rows,
          by_rule:      ruleRes.rows,
          summary:      statsRes.rows[0],
        },
      });
    } catch (err) {
      next(err);
    }
  }

  // ─── 2. Locații sub-utilizate ─────────────────────────────────────────────

  /**
   * GET /api/v1/reports/rule-engine/underused-locations
   *
   * Query params:
   *   - days        : număr zile inactivitate (default 30)
   *   - warehouse_id: UUID depozit (opțional)
   *   - limit       : default 50
   */
  async underusedLocations(req, res, next) {
    try {
      const { days = 30, warehouse_id, limit = 50 } = req.query;
      const thresholdDate = new Date(Date.now() - parseInt(days) * 86400_000).toISOString();

      const params = [thresholdDate, parseInt(limit) || 50];
      let warehouseFilter = '';
      if (warehouse_id) {
        params.push(warehouse_id);
        warehouseFilter = `AND w.id = $${params.length}`;
      }

      const result = await db.query(
        `SELECT
           l.id,
           l.code                                    AS location_code,
           wz.code                                   AS zone_code,
           w.name                                    AS warehouse_name,
           l.status,
           l.suggestion_label,
           l.current_occupancy_percent,
           MAX(m.created_at)                         AS last_movement_at,
           COUNT(m.id)                               AS total_movements,
           EXTRACT(DAY FROM NOW() - MAX(m.created_at)) AS days_inactive
         FROM locations l
         LEFT JOIN warehouse_zones wz ON wz.id = l.zone_id
         LEFT JOIN warehouses w       ON w.id = wz.warehouse_id
         LEFT JOIN inventory_movements m ON m.to_location_id = l.id OR m.from_location_id = l.id
         WHERE l.status = 'AVAILABLE'
           ${warehouseFilter}
         GROUP BY l.id, l.code, wz.code, w.name, l.status, l.suggestion_label, l.current_occupancy_percent
         HAVING MAX(m.created_at) < $1 OR MAX(m.created_at) IS NULL
         ORDER BY days_inactive DESC NULLS FIRST
         LIMIT $2`,
        params
      );

      res.json({
        success: true,
        data: {
          threshold_days: parseInt(days),
          threshold_date: thresholdDate,
          locations: result.rows,
          total: result.rows.length,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  // ─── 3. Resturi mari ──────────────────────────────────────────────────────

  /**
   * GET /api/v1/reports/rule-engine/large-remnants
   *
   * Loturi parțiale (status PARTIAL sau sub 30% din initial_quantity)
   * cu rest > min_meters, care nu s-au mișcat recent.
   *
   * Query params:
   *   - min_meters      : metru minim rest (default 10)
   *   - max_percent     : procent maxim față de inițial considerat "rest" (default 30)
   *   - inactive_days   : zile fără mișcare (default 14)
   *   - limit           : default 50
   */
  async largeRemnants(req, res, next) {
    try {
      const {
        min_meters   = 10,
        max_percent  = 30,
        inactive_days = 14,
        limit = 50,
      } = req.query;

      const thresholdDate = new Date(Date.now() - parseInt(inactive_days) * 86400_000).toISOString();

      const result = await db.query(
        `SELECT
           pb.id,
           pb.batch_number,
           pb.product_sku,
           pb.current_quantity                                         AS remaining_m,
           pb.initial_quantity                                         AS initial_m,
           pb.received_at,
           pb.status,
           ROUND(
             CASE WHEN pb.initial_quantity > 0
               THEN (pb.current_quantity / pb.initial_quantity) * 100
               ELSE 0
             END, 1
           )                                                           AS percent_remaining,
           l.code                                                      AS location_code,
           wz.code                                                     AS zone_code,
           w.name                                                      AS warehouse_name,
           EXTRACT(DAY FROM NOW() - pb.received_at)                   AS age_days
         FROM product_batches pb
         LEFT JOIN locations l    ON l.id = pb.location_id
         LEFT JOIN warehouse_zones wz ON wz.id = l.zone_id
         LEFT JOIN warehouses w   ON w.id = wz.warehouse_id
         WHERE pb.current_quantity >= $1
           AND pb.initial_quantity > 0
           AND (pb.current_quantity / pb.initial_quantity) * 100 <= $2
           AND pb.status IN ('PARTIAL', 'ACTIVE')
           AND pb.received_at < $3
         ORDER BY pb.current_quantity DESC
         LIMIT $4`,
        [
          parseFloat(min_meters),
          parseFloat(max_percent),
          thresholdDate,
          parseInt(limit) || 50,
        ]
      );

      // Sumar total resturi
      const summaryRes = await db.query(
        `SELECT
           COUNT(*) AS batch_count,
           SUM(pb.current_quantity) AS total_remaining_m,
           COUNT(DISTINCT pb.product_sku) AS distinct_skus
         FROM product_batches pb
         WHERE pb.current_quantity >= $1
           AND pb.initial_quantity > 0
           AND (pb.current_quantity / pb.initial_quantity) * 100 <= $2
           AND pb.status IN ('PARTIAL', 'ACTIVE')`,
        [parseFloat(min_meters), parseFloat(max_percent)]
      );

      res.json({
        success: true,
        data: {
          filters: {
            min_meters: parseFloat(min_meters),
            max_percent: parseFloat(max_percent),
            inactive_days: parseInt(inactive_days),
          },
          remnants: result.rows,
          summary:  summaryRes.rows[0],
        },
      });
    } catch (err) {
      next(err);
    }
  }

  // ─── 4. Sugestie tăiere ───────────────────────────────────────────────────

  /**
   * POST /api/v1/suggest/cutting
   * Sugerează planul de tăiere pentru o comandă.
   */
  async suggestCutting(req, res, next) {
    try {
      const { product_sku, requested_qty, uom, warehouse_id, product, order_line } = req.body;

      if (!product_sku || !requested_qty) {
        return res.status(400).json({
          success: false,
          message: 'product_sku și requested_qty sunt obligatorii',
        });
      }

      const { suggestCutting } = require('../services/cuttingEngine');
      const result = await suggestCutting({
        productSku: product_sku,
        requestedQty: parseFloat(requested_qty),
        uom: uom || 'm',
        warehouseId: warehouse_id,
        product: product || {},
        orderLine: order_line || {},
      });

      res.json({ success: true, data: result });
    } catch (err) {
      if (err.code === 'RULE_BLOCK') {
        return res.status(422).json({
          success: false,
          blocked: true,
          message: err.message,
          rule: err.rule,
        });
      }
      next(err);
    }
  }

  /**
   * PUT /api/v1/rules/reorder
   * Actualizează prioritatea mai multor reguli simultan.
   * Body: [{ id: UUID, priority: number }, ...]
   */
  async reorderRules(req, res, next) {
    try {
      const updates = req.body;

      if (!Array.isArray(updates) || updates.length === 0) {
        return res.status(400).json({ success: false, message: 'Trimiteți un array de { id, priority }' });
      }

      const client = await db.getClient();
      try {
        await client.query('BEGIN');
        for (const { id, priority } of updates) {
          if (!id || priority === undefined) continue;
          await client.query(
            `UPDATE wms_rules SET priority = $1, updated_at = NOW() WHERE id = $2`,
            [parseInt(priority), id]
          );
        }
        await client.query('COMMIT');
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }

      res.json({ success: true, message: `${updates.length} reguli reordonate` });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new ReportsController();
