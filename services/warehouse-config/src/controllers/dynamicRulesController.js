'use strict';
/**
 * dynamicRulesController.js — Faza 4.1: Reguli Dinamice
 *
 * Analizeaza periodic starea depozitului si genereaza alerte + recomandari:
 *  - ZONE_FULL_FALLBACK   : Zona plina (>N%) → sugereaza zona alternativa
 *  - REEL_DEPLETES        : Tambur aproape gol (<N m) → muta in zona resturi
 *  - HIGH_ROTATION_RELOCATE: Produs cu rotatie mare → reloca langa expediere
 *  - LOT_EXPIRED_QUARANTINE: Lot expirat sau aproape expirat → carantina
 */

const db = require('../config/database');
const logger = require('../config/logger');

class DynamicRulesController {
  /**
   * GET /api/v1/rules/dynamic/alerts?warehouse_id=...
   * Ruleaza toate verificarile dinamice si returneaza alertele detectate.
   */
  async getAlerts(req, res, next) {
    try {
      const {
        warehouse_id,
        zone_full_threshold = 85,      // % ocupare pentru ZONE_FULL
        reel_low_threshold = 50,       // metri ramasi pentru REEL_DEPLETES
        rotation_days = 7,             // zile pentru calcul rotatie
        high_rotation_picks = 5,       // nr. pick-uri in rotation_days
        expiry_warning_days = 30,      // zile pana la expirare pentru WARNING
      } = req.query;

      const alerts = [];

      // ─── 1. ZONE_FULL_FALLBACK ──────────────────────────────────────────────
      try {
        const threshold = parseFloat(zone_full_threshold);
        let zoneQuery = `
          SELECT
            wz.id             AS zone_id,
            wz.zone_name,
            wz.zone_code,
            wz.zone_type,
            wz.warehouse_id,
            COUNT(l.id)       AS total_locations,
            COUNT(CASE WHEN l.status != 'AVAILABLE' THEN 1 END) AS occupied_locations,
            ROUND(
              100.0 * COUNT(CASE WHEN l.status != 'AVAILABLE' THEN 1 END)
                    / NULLIF(COUNT(l.id), 0), 1
            ) AS occupancy_pct
          FROM warehouse_zones wz
          LEFT JOIN locations l ON l.zone_id = wz.id
          WHERE 1=1
        `;
        const zoneParams = [];
        if (warehouse_id) {
          zoneQuery += ` AND wz.warehouse_id = $1`;
          zoneParams.push(warehouse_id);
        }
        zoneQuery += `
          GROUP BY wz.id, wz.zone_name, wz.zone_code, wz.zone_type, wz.warehouse_id
          HAVING COUNT(l.id) > 0
            AND ROUND(100.0 * COUNT(CASE WHEN l.status != 'AVAILABLE' THEN 1 END) / NULLIF(COUNT(l.id), 0), 1) >= ${threshold}
          ORDER BY occupancy_pct DESC
        `;
        const zoneResult = await db.query(zoneQuery, zoneParams);
        for (const row of zoneResult.rows) {
          // Gaseste alternativa (zona de acelasi tip cu ocupare mai mica)
          const altQuery = `
            SELECT wz2.id, wz2.zone_name, wz2.zone_code,
              ROUND(100.0 * COUNT(CASE WHEN l2.status != 'AVAILABLE' THEN 1 END) / NULLIF(COUNT(l2.id), 0), 1) AS occupancy_pct
            FROM warehouse_zones wz2
            LEFT JOIN locations l2 ON l2.zone_id = wz2.id
            WHERE wz2.warehouse_id = $1 AND wz2.zone_type = $2 AND wz2.id != $3
            GROUP BY wz2.id, wz2.zone_name, wz2.zone_code
            HAVING ROUND(100.0 * COUNT(CASE WHEN l2.status != 'AVAILABLE' THEN 1 END) / NULLIF(COUNT(l2.id), 0), 1) < ${threshold}
            ORDER BY occupancy_pct ASC LIMIT 1
          `;
          let alternative = null;
          try {
            const altResult = await db.query(altQuery, [row.warehouse_id, row.zone_type, row.zone_id]);
            alternative = altResult.rows[0] || null;
          } catch (_) { /* ignore */ }

          alerts.push({
            id: `zone_full_${row.zone_id}`,
            type: 'ZONE_FULL_FALLBACK',
            severity: row.occupancy_pct >= 95 ? 'CRITICAL' : 'WARNING',
            title: `Zona ${row.zone_name} este ${row.occupancy_pct}% plina`,
            message: `Zona ${row.zone_code} (${row.zone_type}) are ${row.occupied_locations}/${row.total_locations} locatii ocupate (${row.occupancy_pct}%).`,
            recommendation: alternative
              ? `Fallback automat pe zona ${alternative.zone_name} (${alternative.zone_code}, ${alternative.occupancy_pct || 0}% ocupata)`
              : 'Nicio zona alternativa de acelasi tip disponibila. Considerati eliberarea de spatiu.',
            data: {
              zone_id: row.zone_id,
              zone_name: row.zone_name,
              zone_code: row.zone_code,
              zone_type: row.zone_type,
              occupancy_pct: row.occupancy_pct,
              total_locations: parseInt(row.total_locations),
              occupied_locations: parseInt(row.occupied_locations),
              alternative_zone: alternative,
            },
            action: alternative ? 'CONFIGURE_FALLBACK' : 'EXPAND_ZONE',
          });
        }
      } catch (err) {
        logger.warn('[DynamicRules] ZONE_FULL check failed:', err.message);
      }

      // ─── 2. REEL_DEPLETES ───────────────────────────────────────────────────
      try {
        const reelThreshold = parseFloat(reel_low_threshold);
        let reelQuery = `
          SELECT
            ii.id            AS item_id,
            ii.product_sku,
            ii.lot_number,
            ii.location_id,
            ii.quantity      AS remaining_qty,
            ii.uom,
            l.location_code,
            wz.zone_code,
            wz.zone_name,
            wz.zone_type
          FROM inventory_items ii
          LEFT JOIN locations l ON ii.location_id::text = l.id::text OR ii.location_id = l.location_code
          LEFT JOIN warehouse_zones wz ON l.zone_id = wz.id
          WHERE ii.quantity > 0 AND ii.quantity < $1
            AND (LOWER(ii.uom) = 'm' OR LOWER(ii.uom) = 'ml')
            AND wz.zone_type NOT IN ('SHIPPING', 'RETURNS', 'QUARANTINE')
        `;
        const reelParams = [reelThreshold];
        if (warehouse_id) {
          reelQuery += ` AND ii.warehouse_id = $2`;
          reelParams.push(warehouse_id);
        }
        reelQuery += ` ORDER BY ii.quantity ASC LIMIT 20`;

        const reelResult = await db.query(reelQuery, reelParams);
        for (const row of reelResult.rows) {
          alerts.push({
            id: `reel_low_${row.item_id}`,
            type: 'REEL_DEPLETES',
            severity: row.remaining_qty < reelThreshold / 4 ? 'CRITICAL' : 'INFO',
            title: `Rest mic: ${row.product_sku} — ${parseFloat(row.remaining_qty).toFixed(1)} ${row.uom}`,
            message: `Lot ${row.lot_number || 'fara lot'} din locatia ${row.location_code} (zona ${row.zone_code}) are doar ${parseFloat(row.remaining_qty).toFixed(1)} ${row.uom} ramasi.`,
            recommendation: `Mutati restul in zona de RESTURI/RETURNS pentru a elibera locatia si a evita picking-ul partial ineficient.`,
            data: {
              item_id: row.item_id,
              product_sku: row.product_sku,
              lot_number: row.lot_number,
              location_code: row.location_code,
              zone_code: row.zone_code,
              remaining_qty: parseFloat(row.remaining_qty),
              uom: row.uom,
            },
            action: 'MOVE_TO_REMNANTS',
          });
        }
      } catch (err) {
        logger.warn('[DynamicRules] REEL_DEPLETES check failed:', err.message);
      }

      // ─── 3. HIGH_ROTATION_RELOCATE ─────────────────────────────────────────
      try {
        const days = parseInt(rotation_days);
        const picks = parseInt(high_rotation_picks);
        const rotationQuery = `
          SELECT
            im.product_sku,
            COUNT(*)               AS pick_count,
            MAX(im.location_code)  AS current_location,
            MAX(wz.zone_code)      AS current_zone,
            MAX(wz.zone_type)      AS current_zone_type
          FROM inventory_movements im
          LEFT JOIN locations l ON im.location_id = l.id OR im.location_code = l.location_code
          LEFT JOIN warehouse_zones wz ON l.zone_id = wz.id
          WHERE im.movement_type IN ('PICK', 'PICKING', 'PICK_PARTIAL')
            AND im.created_at >= NOW() - INTERVAL '${days} days'
            ${warehouse_id ? `AND im.warehouse_id = '${warehouse_id}'` : ''}
          GROUP BY im.product_sku
          HAVING COUNT(*) >= ${picks}
            AND MAX(wz.zone_type) NOT IN ('PICKING', 'STAGING', 'SHIPPING')
          ORDER BY pick_count DESC
          LIMIT 10
        `;
        const rotResult = await db.query(rotationQuery, []);
        for (const row of rotResult.rows) {
          alerts.push({
            id: `high_rot_${row.product_sku}`,
            type: 'HIGH_ROTATION_RELOCATE',
            severity: 'INFO',
            title: `Rotatie mare: ${row.product_sku} — ${row.pick_count} pick-uri in ${days} zile`,
            message: `Produsul ${row.product_sku} are o rotatie ridicata dar este stocat in zona ${row.current_zone} (${row.current_zone_type}), departe de expediere.`,
            recommendation: `Relocati in zona PICKING sau STAGING pentru a reduce distanta de culegere si a imbunatati eficienta.`,
            data: {
              product_sku: row.product_sku,
              pick_count: parseInt(row.pick_count),
              current_location: row.current_location,
              current_zone: row.current_zone,
              days_analyzed: days,
            },
            action: 'SUGGEST_RELOCATION',
          });
        }
      } catch (err) {
        logger.warn('[DynamicRules] HIGH_ROTATION check failed:', err.message);
      }

      // ─── 4. LOT_EXPIRED_QUARANTINE ─────────────────────────────────────────
      try {
        const warnDays = parseInt(expiry_warning_days);
        const expiryQuery = `
          SELECT
            pb.id            AS batch_id,
            pb.batch_number,
            pb.product_sku,
            pb.expiry_date,
            pb.status        AS batch_status,
            ii.location_id,
            l.location_code,
            wz.zone_code,
            wz.zone_name,
            wz.zone_type,
            EXTRACT(DAY FROM (pb.expiry_date - NOW())) AS days_until_expiry
          FROM product_batches pb
          LEFT JOIN inventory_items ii ON ii.lot_number = pb.batch_number AND ii.product_sku = pb.product_sku
          LEFT JOIN locations l ON ii.location_id::text = l.id::text OR ii.location_id = l.location_code
          LEFT JOIN warehouse_zones wz ON l.zone_id = wz.id
          WHERE pb.expiry_date IS NOT NULL
            AND pb.status NOT IN ('QUARANTINE', 'EXPIRED', 'DISPOSED')
            AND pb.expiry_date <= NOW() + INTERVAL '${warnDays} days'
            ${warehouse_id ? `AND pb.warehouse_id = '${warehouse_id}'` : ''}
          ORDER BY pb.expiry_date ASC
          LIMIT 20
        `;
        const expResult = await db.query(expiryQuery, []);
        for (const row of expResult.rows) {
          const daysLeft = Math.floor(parseFloat(row.days_until_expiry));
          const isExpired = daysLeft < 0;
          alerts.push({
            id: `expiry_${row.batch_id}`,
            type: 'LOT_EXPIRED_QUARANTINE',
            severity: isExpired ? 'CRITICAL' : daysLeft < 7 ? 'WARNING' : 'INFO',
            title: isExpired
              ? `Lot EXPIRAT: ${row.batch_number} (${row.product_sku})`
              : `Lot expira in ${daysLeft} zile: ${row.batch_number} (${row.product_sku})`,
            message: isExpired
              ? `Lotul ${row.batch_number} a expirat pe ${new Date(row.expiry_date).toLocaleDateString('ro-RO')}. Locatie curenta: ${row.location_code || 'necunoscuta'} (${row.zone_name || ''}).`
              : `Lotul ${row.batch_number} expira pe ${new Date(row.expiry_date).toLocaleDateString('ro-RO')} (${daysLeft} zile). Locatie: ${row.location_code || 'necunoscuta'}.`,
            recommendation: isExpired
              ? 'Mutati IMEDIAT in carantina (QUARANTINE) si initiati procedura de rebuturi.'
              : `Emiteti comanda de picking prioritar SAU mutati in QUARANTINE pentru inspectie inainte de expirare.`,
            data: {
              batch_id: row.batch_id,
              batch_number: row.batch_number,
              product_sku: row.product_sku,
              expiry_date: row.expiry_date,
              days_until_expiry: daysLeft,
              location_code: row.location_code,
              zone_code: row.zone_code,
              zone_type: row.zone_type,
              is_expired: isExpired,
            },
            action: 'MOVE_TO_QUARANTINE',
          });
        }
      } catch (err) {
        logger.warn('[DynamicRules] EXPIRY check failed:', err.message);
      }

      // ─── Sortare si statistici ──────────────────────────────────────────────
      const SEVERITY_ORDER = { CRITICAL: 0, WARNING: 1, INFO: 2 };
      alerts.sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 3) - (SEVERITY_ORDER[b.severity] ?? 3));

      const stats = {
        total: alerts.length,
        critical: alerts.filter(a => a.severity === 'CRITICAL').length,
        warning: alerts.filter(a => a.severity === 'WARNING').length,
        info: alerts.filter(a => a.severity === 'INFO').length,
        by_type: {},
      };
      for (const a of alerts) {
        stats.by_type[a.type] = (stats.by_type[a.type] || 0) + 1;
      }

      res.json({
        success: true,
        generated_at: new Date().toISOString(),
        thresholds: {
          zone_full_threshold: parseFloat(zone_full_threshold),
          reel_low_threshold: parseFloat(reel_low_threshold),
          rotation_days: parseInt(rotation_days),
          high_rotation_picks: parseInt(high_rotation_picks),
          expiry_warning_days: parseInt(expiry_warning_days),
        },
        stats,
        alerts,
      });
    } catch (err) {
      logger.error('[DynamicRules] getAlerts error:', err);
      next(err);
    }
  }
}

module.exports = new DynamicRulesController();
