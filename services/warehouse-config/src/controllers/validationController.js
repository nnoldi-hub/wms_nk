'use strict';

/**
 * Validation Controller — Faza 2.3: Validare Reguli <-> Harta
 *
 * GET /api/v1/rules/validate?warehouse_id=...
 *   Verifica consistenta intre regulile WMS, zone si locatii.
 *   Returneaza: { valid, errors[], warnings[], suggestions[], stats }
 *
 * GET /api/v1/rules/validate/summary
 *   Rezumat rapid (numar erori/warnings) fara detalii complete.
 */

const db = require('../config/database');
const logger = require('../config/logger');

// Tipuri de zone care AU NEVOIE de reguli de putaway
const ZONES_NEED_PUTAWAY = ['RECEIVING', 'STORAGE', 'QC', 'PRODUCTION'];
// Tipuri de zone care AU NEVOIE de reguli de picking
const ZONES_NEED_PICKING = ['STORAGE', 'PICKING', 'STAGING'];
// Reguli minime recomandate per tip zona
const RECOMMENDED_RULES = {
  RECEIVING: ['FIFO', 'MIN_WASTE', 'USE_REMAINS_FIRST'],
  STORAGE:   ['FIFO', 'MIN_WASTE', 'LOCATION_PROXIMITY'],
  PICKING:   ['FIFO', 'MIN_WASTE', 'USE_REMAINS_FIRST'],
  QC:        ['FIFO'],
  STAGING:   ['FIFO', 'LOCATION_PROXIMITY'],
};

class ValidationController {

  /**
   * GET /api/v1/rules/validate?warehouse_id=...
   */
  async validate(req, res, next) {
    try {
      const { warehouse_id } = req.query;

      // 1. Incarcam toate regulile active
      const rulesRes = await db.query(`
        SELECT id, name, scope, rule_type, is_active, conditions, actions
        FROM wms_rules
        WHERE is_active = true
        ORDER BY scope, rule_type
      `);
      const rules = rulesRes.rows;

      // 2. Incarcam toate zonele (filtrat dupa depozit daca e specificat)
      let zonesQuery = `
        SELECT z.id, z.zone_code, z.zone_name, z.zone_type, z.warehouse_id,
               w.warehouse_name, w.warehouse_code,
               COUNT(l.id) AS location_count
        FROM warehouse_zones z
        LEFT JOIN warehouses w ON w.id = z.warehouse_id
        LEFT JOIN locations l ON l.zone_id = z.id AND l.status != 'OCCUPIED'
        WHERE z.is_active = true
      `;
      const zonesParams = [];
      if (warehouse_id) {
        zonesQuery += ` AND z.warehouse_id = $1`;
        zonesParams.push(warehouse_id);
      }
      zonesQuery += ` GROUP BY z.id, z.zone_code, z.zone_name, z.zone_type, z.warehouse_id, w.warehouse_name, w.warehouse_code`;

      const zonesRes = await db.query(zonesQuery, zonesParams);
      const zones = zonesRes.rows;

      // 3. Incarcam locatiile pentru statistici
      let locQuery = `
        SELECT l.zone_id, lt.type_code, COUNT(l.id) AS cnt
        FROM locations l
        LEFT JOIN location_types lt ON lt.id = l.location_type_id
        WHERE l.is_active = true
      `;
      if (warehouse_id) {
        locQuery += ` AND l.warehouse_id = $1`;
      }
      locQuery += ` GROUP BY l.zone_id, lt.type_code`;
      const locRes = await db.query(locQuery, warehouse_id ? [warehouse_id] : []);
      // Map: zone_id -> [{ type_code, cnt }]
      const locationsByZone = {};
      for (const row of locRes.rows) {
        if (!locationsByZone[row.zone_id]) locationsByZone[row.zone_id] = [];
        locationsByZone[row.zone_id].push(row);
      }

      // 4. Parse reguli: extrage zone_type din conditions daca exista
      const putawayRulesByZoneType = {}; // zone_type -> [rule]
      const pickingRulesByZoneType = {};
      const globalPutaway = [];
      const globalPicking = [];

      for (const rule of rules) {
        const conditions = Array.isArray(rule.conditions) ? rule.conditions : [];
        // Gasim conditii de tip zone_type
        const zoneTypeConditions = conditions.filter(c =>
          c.field === 'zone_type' || c.field === 'zone.type' || c.field === 'location.zone_type'
        );

        if (rule.scope === 'PUTAWAY' || rule.scope === 'PICKING') {
          const targetScope = rule.scope === 'PUTAWAY' ? putawayRulesByZoneType : pickingRulesByZoneType;
          const globalArr = rule.scope === 'PUTAWAY' ? globalPutaway : globalPicking;

          if (zoneTypeConditions.length > 0) {
            for (const cond of zoneTypeConditions) {
              const zoneType = String(cond.value || '').toUpperCase();
              if (!targetScope[zoneType]) targetScope[zoneType] = [];
              targetScope[zoneType].push(rule);
            }
          } else {
            // Regula fara conditie de zona -> se aplica global
            globalArr.push(rule);
          }
        }
      }

      const errors = [];
      const warnings = [];
      const suggestions = [];

      // ─── Verificari per zona ────────────────────────────────────────────────

      for (const zone of zones) {
        const zoneType = (zone.zone_type || '').toUpperCase();

        // Reguli PUTAWAY pentru aceasta zona
        const putawayRules = [
          ...(putawayRulesByZoneType[zoneType] || []),
          ...globalPutaway,
        ];
        // Reguli PICKING pentru aceasta zona
        const pickingRules = [
          ...(pickingRulesByZoneType[zoneType] || []),
          ...globalPicking,
        ];

        const zoneLabel = `${zone.warehouse_code} > ${zone.zone_code} (${zoneType})`;

        // Verificare: zona de receptie/stocare fara reguli PUTAWAY
        if (ZONES_NEED_PUTAWAY.includes(zoneType) && putawayRules.length === 0) {
          errors.push({
            type: 'ZONE_NO_PUTAWAY_RULE',
            zone_id: zone.id,
            zone_code: zone.zone_code,
            zone_type: zoneType,
            warehouse_name: zone.warehouse_name,
            message: `Zona ${zoneLabel} nu are nicio regula PUTAWAY activa`,
          });
          // Sugeram regula recomandata
          const rec = RECOMMENDED_RULES[zoneType]?.[0];
          if (rec) {
            suggestions.push({
              type: 'ADD_PUTAWAY_RULE',
              zone_id: zone.id,
              zone_code: zone.zone_code,
              zone_type: zoneType,
              rule_type: rec,
              message: `Adauga regula ${rec} pe zona ${zone.zone_code} pentru a permite putaway automat`,
            });
          }
        }

        // Verificare: zona de picking/productie fara reguli PICKING
        if (ZONES_NEED_PICKING.includes(zoneType) && pickingRules.length === 0) {
          errors.push({
            type: 'ZONE_NO_PICKING_RULE',
            zone_id: zone.id,
            zone_code: zone.zone_code,
            zone_type: zoneType,
            warehouse_name: zone.warehouse_name,
            message: `Zona ${zoneLabel} nu are nicio regula PICKING activa`,
          });
          suggestions.push({
            type: 'ADD_PICKING_RULE',
            zone_id: zone.id,
            zone_code: zone.zone_code,
            zone_type: zoneType,
            rule_type: 'FIFO',
            message: `Adauga regula FIFO pe zona ${zone.zone_code} pentru picking corect`,
          });
        }

        // Verificare: zona fara locatii
        const locCount = Number(zone.location_count || 0);
        if (locCount === 0 && ['STORAGE', 'PICKING', 'RECEIVING'].includes(zoneType)) {
          warnings.push({
            type: 'ZONE_NO_LOCATIONS',
            zone_id: zone.id,
            zone_code: zone.zone_code,
            zone_type: zoneType,
            warehouse_name: zone.warehouse_name,
            message: `Zona ${zoneLabel} nu are locatii disponibile — operatiunile vor esua`,
          });
        }

        // Verificare: zona SHIPPING fara alta zona (expediere)
        if (zoneType === 'SHIPPING' && locCount === 0) {
          errors.push({
            type: 'SHIPPING_ZONE_EMPTY',
            zone_id: zone.id,
            zone_code: zone.zone_code,
            zone_type: zoneType,
            warehouse_name: zone.warehouse_name,
            message: `Zona de expediere ${zone.zone_code} nu are locatii — livrarea nu poate fi procesata`,
          });
        }
      }

      // ─── Verificari la nivel de reguli ─────────────────────────────────────

      // Reguli fara conditii de zona -> globale (warning ca pot fi prea permisive)
      if (globalPutaway.length > 2) {
        warnings.push({
          type: 'TOO_MANY_GLOBAL_PUTAWAY',
          message: `${globalPutaway.length} reguli PUTAWAY globale (fara conditie zona) — pot genera conflicte`,
          rule_names: globalPutaway.map(r => r.name),
        });
      }
      if (globalPicking.length > 2) {
        warnings.push({
          type: 'TOO_MANY_GLOBAL_PICKING',
          message: `${globalPicking.length} reguli PICKING globale — pot genera conflicte`,
          rule_names: globalPicking.map(r => r.name),
        });
      }

      // Verificare: zero reguli active total
      if (rules.length === 0) {
        errors.push({
          type: 'NO_ACTIVE_RULES',
          message: 'Nu exista nicio regula WMS activa — sistemul va folosi selectie manuala pentru tot',
        });
      }

      // Verificare: zero zone configurate
      if (zones.length === 0) {
        errors.push({
          type: 'NO_ZONES',
          message: 'Nicio zona de depozit configurata — configureaza depozitul mai intai',
        });
      }

      // ─── Verificare: depozit fara zona RECEIVING si SHIPPING ──────────────

      const warehouseIds = [...new Set(zones.map(z => z.warehouse_id))];
      for (const whId of warehouseIds) {
        const whZones = zones.filter(z => z.warehouse_id === whId);
        const whName = whZones[0]?.warehouse_name || whId;
        const zoneTypes = whZones.map(z => (z.zone_type || '').toUpperCase());

        if (!zoneTypes.includes('RECEIVING')) {
          warnings.push({
            type: 'NO_RECEIVING_ZONE',
            warehouse_id: whId,
            warehouse_name: whName,
            message: `Depozitul "${whName}" nu are zona RECEIVING — receptia marfii nu poate fi procesata`,
          });
          suggestions.push({
            type: 'ADD_ZONE',
            warehouse_id: whId,
            zone_type: 'RECEIVING',
            message: `Adauga o zona RECEIVING in depozitul "${whName}"`,
          });
        }
        if (!zoneTypes.includes('SHIPPING')) {
          warnings.push({
            type: 'NO_SHIPPING_ZONE',
            warehouse_id: whId,
            warehouse_name: whName,
            message: `Depozitul "${whName}" nu are zona SHIPPING — expedierile nu pot fi procesate`,
          });
          suggestions.push({
            type: 'ADD_ZONE',
            warehouse_id: whId,
            zone_type: 'SHIPPING',
            message: `Adauga o zona SHIPPING in depozitul "${whName}"`,
          });
        }
        if (!zoneTypes.includes('STORAGE')) {
          warnings.push({
            type: 'NO_STORAGE_ZONE',
            warehouse_id: whId,
            warehouse_name: whName,
            message: `Depozitul "${whName}" nu are zona STORAGE — stocarea normala nu e posibila`,
          });
        }
      }

      // ─── Sumar statistici ──────────────────────────────────────────────────

      const valid = errors.length === 0;
      const stats = {
        total_rules: rules.length,
        total_active_rules: rules.filter(r => r.is_active).length,
        putaway_rules: rules.filter(r => r.scope === 'PUTAWAY').length,
        picking_rules: rules.filter(r => r.scope === 'PICKING').length,
        total_zones: zones.length,
        total_locations: locRes.rows.reduce((s, r) => s + Number(r.cnt), 0),
        errors_count: errors.length,
        warnings_count: warnings.length,
        suggestions_count: suggestions.length,
        warehouses_count: warehouseIds.length,
      };

      logger.info(`[ValidationController] validate: ${errors.length} errors, ${warnings.length} warnings`);

      res.json({
        success: true,
        data: {
          valid,
          errors,
          warnings,
          suggestions,
          stats,
          validated_at: new Date().toISOString(),
        },
      });
    } catch (err) {
      logger.error('[ValidationController] validate error:', err);
      next(err);
    }
  }

  /**
   * GET /api/v1/rules/validate/summary
   * Rezumat rapid pentru badge-uri in UI (fara detalii).
   */
  async summary(req, res, next) {
    try {
      const { warehouse_id } = req.query;

      // Contor rapid reguli active
      const rulesRes = await db.query(`SELECT COUNT(*) AS cnt FROM wms_rules WHERE is_active = true`);
      const totalRules = Number(rulesRes.rows[0]?.cnt || 0);

      // Contor zone
      let zonesQuery = `SELECT COUNT(*) AS cnt FROM warehouse_zones WHERE is_active = true`;
      const zonesParams = [];
      if (warehouse_id) {
        zonesQuery = `SELECT COUNT(*) AS cnt FROM warehouse_zones WHERE is_active = true AND warehouse_id = $1`;
        zonesParams.push(warehouse_id);
      }
      const zonesRes = await db.query(zonesQuery, zonesParams);
      const totalZones = Number(zonesRes.rows[0]?.cnt || 0);

      // Contor locatii
      let locQuery = `SELECT COUNT(*) AS cnt FROM locations WHERE is_active = true`;
      if (warehouse_id) {
        locQuery = `SELECT COUNT(*) AS cnt FROM locations WHERE is_active = true AND warehouse_id = $1`;
      }
      const locRes = await db.query(locQuery, warehouse_id ? [warehouse_id] : []);
      const totalLocations = Number(locRes.rows[0]?.cnt || 0);

      // Stare simpla
      let status = 'OK';
      if (totalRules === 0 || totalZones === 0) status = 'ERROR';
      else if (totalLocations === 0) status = 'WARNING';

      res.json({
        success: true,
        data: {
          status,
          total_rules: totalRules,
          total_zones: totalZones,
          total_locations: totalLocations,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/validate/setup-check?warehouse_id=...
   *
   * Faza 3.2 — Validator configurare wizard:
   *  - Cel putin 1 zona RECEIVING, STORAGE, SHIPPING
   *  - Fiecare zona are cel putin 1 tip locatie asociat
   *  - Cel putin 1 regula PUTAWAY activa + 1 PICKING activa global
   *  - Coduri duplicate (zone, tipuri locatii)
   *  - Compatibilitate reguli <-> tipuri locatii per zona
   */
  async validateWarehouseConfig(req, res, next) {
    try {
      const { warehouse_id } = req.query;

      const errors = [];
      const warnings = [];
      const info = [];

      // ── 1. Reguli globale: minim 1 PUTAWAY activ si 1 PICKING activ ─────────
      const rulesRes = await db.query(`
        SELECT scope, rule_type, name, is_active FROM wms_rules WHERE is_active = true
      `);
      const rules = rulesRes.rows;
      const hasPutaway = rules.some(r => r.scope === 'PUTAWAY');
      const hasPicking = rules.some(r => r.scope === 'PICKING');
      if (!hasPutaway) {
        errors.push({ code: 'NO_PUTAWAY_RULE', message: 'Nu există nicio regulă PUTAWAY activă — sistemul nu va ști unde să depoziteze marfa la recepție.' });
      }
      if (!hasPicking) {
        errors.push({ code: 'NO_PICKING_RULE', message: 'Nu există nicio regulă PICKING activă — sistemul nu va putea selecta stocul optim la picking.' });
      }
      info.push({ code: 'RULES_OK', message: `${rules.length} reguli active (${rules.filter(r=>r.scope==='PUTAWAY').length} PUTAWAY, ${rules.filter(r=>r.scope==='PICKING').length} PICKING)` });

      // ── 2. Zone esențiale per depozit ────────────────────────────────────────
      const ESSENTIAL_ZONES = ['RECEIVING', 'STORAGE', 'SHIPPING'];
      let zonesQuery = `SELECT id, zone_code, zone_type, warehouse_id FROM warehouse_zones WHERE is_active = true`;
      const zonesParams = [];
      if (warehouse_id) { zonesQuery += ` AND warehouse_id = $1`; zonesParams.push(warehouse_id); }
      const zonesRes = await db.query(zonesQuery, zonesParams);
      const zones = zonesRes.rows;

      const warehouses = [...new Set(zones.map(z => z.warehouse_id))];
      for (const whId of warehouses) {
        const whZones = zones.filter(z => z.warehouse_id === whId);
        const presentTypes = whZones.map(z => (z.zone_type || '').toUpperCase());
        for (const essential of ESSENTIAL_ZONES) {
          if (!presentTypes.includes(essential)) {
            errors.push({ code: `MISSING_ZONE_${essential}`, message: `Lipsește zona ${essential} — este esențială pentru operarea depozitului.`, warehouse_id: whId });
          }
        }
      }

      // ── 3. Verificare coduri duplicate zone ───────────────────────────────────
      const zoneCodeCountRes = await db.query(`
        SELECT zone_code, COUNT(*) AS cnt FROM warehouse_zones
        ${warehouse_id ? 'WHERE warehouse_id = $1' : ''}
        GROUP BY zone_code HAVING COUNT(*) > 1
      `, warehouse_id ? [warehouse_id] : []);
      for (const dup of zoneCodeCountRes.rows) {
        errors.push({ code: 'DUPLICATE_ZONE_CODE', message: `Codul de zonă "${dup.zone_code}" apare de ${dup.cnt} ori — codurile trebuie să fie unice.` });
      }

      // ── 4. Verificare tipuri locatii asociate fiecarei zone ──────────────────
      // O zona trebuie sa aiba cel putin o locatie cu un location_type valid
      const locsByZoneRes = await db.query(`
        SELECT l.zone_id, z.zone_code, z.zone_type,
               COUNT(l.id) AS total_locs,
               COUNT(l.location_type_id) AS typed_locs
        FROM warehouse_zones z
        LEFT JOIN locations l ON l.zone_id = z.id AND l.is_active = true
        WHERE z.is_active = true
        ${warehouse_id ? 'AND z.warehouse_id = $1' : ''}
        GROUP BY l.zone_id, z.zone_code, z.zone_type
      `, warehouse_id ? [warehouse_id] : []);

      for (const zRow of locsByZoneRes.rows) {
        if (Number(zRow.total_locs) === 0 && ['RECEIVING','STORAGE','PICKING','SHIPPING'].includes(zRow.zone_type)) {
          warnings.push({ code: 'ZONE_NO_LOCATIONS', message: `Zona "${zRow.zone_code}" (${zRow.zone_type}) nu are locații configurate.` });
        } else if (Number(zRow.total_locs) > 0 && Number(zRow.typed_locs) === 0) {
          warnings.push({ code: 'ZONE_LOCATIONS_NO_TYPE', message: `Locațiile din zona "${zRow.zone_code}" nu au un tip de locație asociat — regulile de capacitate nu vor funcționa.` });
        }
      }

      // ── 5. Coduri duplicate tipuri locatii ────────────────────────────────────
      const ltDupRes = await db.query(`
        SELECT code, COUNT(*) AS cnt FROM location_types GROUP BY code HAVING COUNT(*) > 1
      `);
      for (const dup of ltDupRes.rows) {
        errors.push({ code: 'DUPLICATE_LOCATION_TYPE_CODE', message: `Codul de tip locație "${dup.code}" apare de ${dup.cnt} ori — trebuie să fie unic.` });
      }

      // ── 6. Compatibilitate reguli <-> tipuri locatii ──────────────────────────
      // Verificam daca exista reguli cu conditii de tip locatie dar niciun astfel de tip nu exista
      const ltCodesRes = await db.query(`SELECT DISTINCT code FROM location_types`);
      const existingLtCodes = new Set(ltCodesRes.rows.map(r => (r.code || '').toUpperCase()));

      for (const rule of rules) {
        const conditions = Array.isArray(rule.conditions) ? rule.conditions : [];
        for (const cond of conditions) {
          if ((cond.field === 'location_type' || cond.field === 'location.type_code') && cond.value) {
            const ltCode = String(cond.value).toUpperCase();
            if (!existingLtCodes.has(ltCode)) {
              warnings.push({
                code: 'RULE_REFERENCES_MISSING_LOC_TYPE',
                message: `Regula "${rule.name}" referențiază tipul de locație "${cond.value}" care nu există în sistem.`,
              });
            }
          }
        }
      }

      // ── 7. Rezumat ────────────────────────────────────────────────────────────
      const score = Math.max(0, 100 - errors.length * 20 - warnings.length * 5);
      const valid = errors.length === 0;

      res.json({
        success: true,
        data: {
          valid,
          score,
          errors,
          warnings,
          info,
          stats: {
            total_rules: rules.length,
            putaway_rules: rules.filter(r => r.scope === 'PUTAWAY').length,
            picking_rules: rules.filter(r => r.scope === 'PICKING').length,
            total_zones: zones.length,
            warehouses_count: warehouses.length,
          },
          checked_at: new Date().toISOString(),
        },
      });
    } catch (err) {
      logger.error('[ValidationController] validateWarehouseConfig error:', err);
      next(err);
    }
  }
}

module.exports = new ValidationController();
