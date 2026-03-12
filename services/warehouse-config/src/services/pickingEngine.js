'use strict';

/**
 * Picking Engine — Selecție stoc optim pentru o linie de comandă
 *
 * Flux:
 *  1. Preia regulile active cu scope=PICKING din DB
 *  2. Construiește contextul din linia de comandă
 *  3. Aplică regulile → obține strategia de picking (PICK_STRATEGY)
 *  4. Caută stocul disponibil din inventory_items + product_batches
 *  5. Sortează sau filtrează stocul conform strategiei
 *  6. Calculează cum se împarte cantitatea cerută pe loturi (combinare automată)
 *  7. Returnează picking-task-urile recomandate
 */

const db = require('../config/database');
const logger = require('../config/logger');
const { applyRules, buildContext, getAction, hasAction } = require('./ruleEngine');
const cache = require('./cache');

// ─── Strategii de picking ─────────────────────────────────────────────────────

/**
 * Sortare stoc conform strategiei.
 * Returnează stocul sortat, cel mai bun primul.
 */
function applyPickStrategy(stockItems, strategy, requestedQty) {
  let sorted = [...stockItems];

  switch (strategy) {
    case 'USE_REMAINS_FIRST':
      // Resturi (status CUT sau parțiale) înaintea tamburilor întregi
      sorted.sort((a, b) => {
        const aIsRest = (a.lot_status || a.status || '').includes('CUT') ||
                        (a.lot_status || a.status || '') === 'PARTIAL';
        const bIsRest = (b.lot_status || b.status || '').includes('CUT') ||
                        (b.lot_status || b.status || '') === 'PARTIAL';
        if (aIsRest && !bIsRest) return -1;
        if (!aIsRest && bIsRest) return 1;
        // Secundar: cel mai aproape de cantitatea cerută (min waste)
        const aWaste = Math.abs(parseFloat(a.available_qty || a.quantity) - requestedQty);
        const bWaste = Math.abs(parseFloat(b.available_qty || b.quantity) - requestedQty);
        return aWaste - bWaste;
      });
      break;

    case 'MIN_WASTE':
      // Alege lotul a cărui cantitate disponibilă e cel mai aproape de ce s-a cerut
      sorted.sort((a, b) => {
        const aQt = parseFloat(a.available_qty || a.quantity);
        const bQt = parseFloat(b.available_qty || b.quantity);
        const aWaste = Math.abs(aQt - requestedQty);
        const bWaste = Math.abs(bQt - requestedQty);
        return aWaste - bWaste;
      });
      break;

    case 'FIFO':
    default:
      // Cel mai vechi lot primul (received_at ASC)
      sorted.sort((a, b) => {
        const aDate = new Date(a.received_at || a.created_at || 0);
        const bDate = new Date(b.received_at || b.created_at || 0);
        return aDate - bDate;
      });
      break;
  }

  return sorted;
}

/**
 * Distribuie cantitatea cerută pe loturi disponibile (min waste, combinare).
 * Returnează lista de "picks": { inventory_item_id, lot_number, pick_qty, location_id, ... }
 */
function allocateStock(sortedStock, requestedQty, allowMultiLot = true) {
  const picks = [];
  let remaining = requestedQty;

  for (const item of sortedStock) {
    if (remaining <= 0) break;

    const available = parseFloat(item.available_qty || item.quantity) -
                      parseFloat(item.reserved_qty || 0);
    if (available <= 0) continue;

    const pickQty = Math.min(available, remaining);

    picks.push({
      inventory_item_id: item.id,
      lot_number: item.lot_number,
      location_id: item.location_id,
      location_code: item.location_code,
      zone_code: item.zone_code,
      zone_name: item.zone_name,
      lot_status: item.lot_status || item.status,
      available_qty: available,
      pick_qty: pickQty,
      uom: item.uom || 'm',
    });

    remaining -= pickQty;

    if (!allowMultiLot) break;
  }

  return {
    picks,
    total_picked: requestedQty - remaining,
    remaining_unfulfilled: Math.max(0, remaining),
    fully_fulfilled: remaining <= 0,
  };
}

// ─── Funcție principală ───────────────────────────────────────────────────────

/**
 * Sugerează stocul optim pentru o linie de comandă.
 *
 * @param {Object} opts
 * @param {string} opts.productSku - SKU produs
 * @param {number} opts.requestedQty - cantitate cerută
 * @param {string} [opts.uom='m'] - unitate de măsură
 * @param {Object} [opts.product={}] - date produs (category, etc.)
 * @param {Object} [opts.orderLine={}] - date linie comandă
 * @param {string} [opts.warehouseId] - filtrare după depozit (opțional)
 * @returns {Promise<{ picks, strategy, matchedRules, actions, allocation }>}
 */
async function suggestPicking({ productSku, requestedQty, uom = 'm', product = {}, orderLine = {}, warehouseId }) {
  // 1. Preia regulile PICKING active (cu cache Redis)
  const rules = await cache.getOrLoad(
    'rules:PICKING:true:all',
    async () => {
      const r = await db.query(
        `SELECT id, name, rule_type, scope, priority, conditions, actions, is_active
         FROM wms_rules
         WHERE scope = 'PICKING' AND is_active = true
         ORDER BY priority DESC`,
        []
      );
      return r.rows;
    },
    cache.TTL.RULES
  );

  // 2. Construiește contextul
  const context = buildContext({
    product,
    stock: {},
    orderLine: { ...orderLine, requested_length_m: requestedQty, requested_qty: requestedQty, uom },
  });

  // 3. Aplică regulile
  const { matchedRules, actions } = applyRules(rules, context);

  // Fallback: dacă nicio regulă nu s-a potrivit → preia default_strategy din zona depozitului
  let strategy = getAction(actions, 'PICK_STRATEGY');
  if (!strategy) {
    if (warehouseId) {
      const zoneStrategy = await db.query(
        `SELECT default_strategy FROM warehouse_zones
         WHERE warehouse_id = $1 AND is_active = true
         ORDER BY created_at ASC LIMIT 1`,
        [warehouseId]
      );
      strategy = zoneStrategy.rows[0]?.default_strategy || 'FIFO';
    } else {
      strategy = 'FIFO';
    }
  }

  const allowMultiLot = hasAction(actions, 'PICK_STRATEGY') &&
    actions.some(a => a.type === 'PICK_STRATEGY' && a.value === 'ALLOW_MULTI_LOT');
  const excludePackaging = getAction(actions, 'EXCLUDE_PACKAGING');

  logger.info('[PickingEngine]', { productSku, requestedQty, strategy, matchedRules: matchedRules.length });

  // 4. Preia stocul disponibil
  let stockQuery = `
    SELECT
      ii.id,
      ii.product_sku,
      ii.quantity,
      ii.reserved_qty,
      (ii.quantity - COALESCE(ii.reserved_qty, 0)) AS available_qty,
      ii.lot_number,
      ii.received_at,
      ii.location_id,
      l.location_code,
      wz.zone_code,
      wz.zone_name,
      pb.status        AS lot_status,
      $2               AS uom
    FROM inventory_items ii
    LEFT JOIN locations l ON ii.location_id::text = l.id::text OR ii.location_id = l.location_code
    LEFT JOIN warehouse_zones wz ON ii.zone_id = wz.id
    LEFT JOIN product_batches pb ON ii.lot_number = pb.batch_number AND ii.product_sku = pb.product_sku
    WHERE ii.product_sku = $1
      AND (ii.quantity - COALESCE(ii.reserved_qty, 0)) > 0
  `;
  const params = [productSku, uom];
  let idx = 3;

  if (warehouseId) {
    stockQuery += ` AND ii.warehouse_id = $${idx}`;
    params.push(warehouseId);
    idx++;
  }

  // excludePackaging filter not supported (column removed from schema)

  stockQuery += ' ORDER BY ii.received_at ASC';

  const stockResult = await db.query(stockQuery, params);
  let stockItems = stockResult.rows;

  // 5. Aplică strategia de sortare
  stockItems = applyPickStrategy(stockItems, strategy, requestedQty);

  // 6. Alocare cantități
  const allocation = allocateStock(stockItems, requestedQty, allowMultiLot || matchedRules.length === 0);

  // 7. Răspuns
  return {
    product_sku: productSku,
    requested_qty: requestedQty,
    uom,
    strategy,
    strategy_source: matchedRules.length > 0 ? 'rules' : 'zone_default',
    allow_multi_lot: allowMultiLot,
    matchedRules,
    actions,
    allocation,
    // Toate loturile disponibile (pentru UI — operatorul poate alege altceva)
    available_stock: stockItems.map(s => ({
      inventory_item_id: s.id,
      lot_number: s.lot_number,
      location_id: s.location_id,
      location_code: s.location_code,
      zone_code: s.zone_code,
      zone_name: s.zone_name,
      available_qty: parseFloat(s.available_qty),
      lot_status: s.lot_status,
      received_at: s.received_at,
    })),
  };
}

module.exports = { suggestPicking, applyPickStrategy, allocateStock };
