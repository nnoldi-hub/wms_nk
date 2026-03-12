'use strict';

/**
 * Cutting Engine — Strategie de tăiere optimă
 *
 * Flux:
 *  1. Preia regulile active cu scope=CUTTING din DB
 *  2. Construiește contextul din comanda de tăiere + stocul disponibil
 *  3. Aplică regulile → obține strategia recomandată (MINIMIZE_WASTE, FEWEST_CUTS, FIFO)
 *  4. Calculează planul de tăiere: ce loturi se taie, în ce ordine, câte resturi rămân
 *  5. Returnează planul ordonat + metadate (waste_m, cuts_count, rule_applied)
 *
 * Strategii suportate:
 *  - MINIMIZE_WASTE      : alege lotul cel mai apropiat de cantitatea cerută (cel mai mic rest)
 *  - FEWEST_CUTS         : alege cel mai mare lot disponibil (minim de tăieturi)
 *  - USE_REMAINS_FIRST   : prioritizează resturi (loturi parțiale, under 30% din lungimea inițială)
 *  - FIFO                : primul intrat, primul ieșit (după received_at)
 */

const db = require('../config/database');
const logger = require('../config/logger');
const { applyRules, buildContext, getAction } = require('./ruleEngine');

// ─── Conversii UOM ────────────────────────────────────────────────────────────

/**
 * Convertor UOM pentru cabluri/textile.
 * Returnează valoarea convertită în metru (unitatea internă de bază).
 *
 * @param {number} value - cantitatea
 * @param {string} fromUom - unitatea sursă
 * @param {Object} [productMeta] - metadata produs (density_kg_per_m, coils_per_drum etc.)
 * @returns {number} cantitate în metru
 */
function convertToMeters(value, fromUom, productMeta = {}) {
  const uom = (fromUom || 'm').toUpperCase();

  switch (uom) {
    case 'M':
    case 'METER':
    case 'METRU':
      return value;

    case 'KG':
    case 'KILOGRAM': {
      // Necesită densitate: kg/m (ex: 0.12 kg/m pentru cablu 4mm²)
      const kgPerMeter = productMeta.density_kg_per_m || productMeta.weight_per_meter || 1;
      return value / kgPerMeter;
    }

    case 'BUC':
    case 'PCS':
    case 'PIECE': {
      // O bucată = o rolă; necesită dimensiunea standard
      const metersPerPiece = productMeta.length_per_piece_m || productMeta.roll_length_m || 100;
      return value * metersPerPiece;
    }

    case 'ROLA':
    case 'ROLL':
    case 'COIL': {
      const metersPerRoll = productMeta.roll_length_m || productMeta.coil_length_m || 100;
      return value * metersPerRoll;
    }

    case 'TAMBUR':
    case 'DRUM': {
      const metersPerDrum = productMeta.drum_length_m || 500;
      return value * metersPerDrum;
    }

    default:
      // Fallback: tratăm ca metru
      logger.warn(`[cuttingEngine] UOM necunoscut: ${fromUom}, tratăm ca metru`);
      return value;
  }
}

/**
 * Convertor invers: din metru în altă unitate.
 */
function convertFromMeters(valueInMeters, toUom, productMeta = {}) {
  const uom = (toUom || 'm').toUpperCase();

  switch (uom) {
    case 'M':
    case 'METER':
      return valueInMeters;

    case 'KG':
    case 'KILOGRAM': {
      const kgPerMeter = productMeta.density_kg_per_m || productMeta.weight_per_meter || 1;
      return valueInMeters * kgPerMeter;
    }

    case 'BUC':
    case 'PCS': {
      const metersPerPiece = productMeta.length_per_piece_m || 100;
      return valueInMeters / metersPerPiece;
    }

    default:
      return valueInMeters;
  }
}

// ─── Calcul plan tăiere ───────────────────────────────────────────────────────

/**
 * Aplică strategia MINIMIZE_WASTE:
 * Sortează loturile după |available - needed| ASC pentru a minimiza restul.
 */
function sortMinimizeWaste(batches, neededMeters) {
  return [...batches].sort((a, b) => {
    const wasteA = Math.abs(a.available_m - neededMeters);
    const wasteB = Math.abs(b.available_m - neededMeters);
    return wasteA - wasteB;
  });
}

/**
 * Aplică strategia FEWEST_CUTS:
 * Sortează loturile descrescător după available_m (cel mai mare lot mai întâi).
 */
function sortFewestCuts(batches) {
  return [...batches].sort((a, b) => b.available_m - a.available_m);
}

/**
 * Aplică strategia USE_REMAINS_FIRST:
 * Prioritizează resturile (loturi parțiale sub 30% din lungimea inițială),
 * restul FIFO.
 */
function sortUseRemainsFirst(batches) {
  return [...batches].sort((a, b) => {
    const remainA = a.initial_m > 0 ? (a.available_m / a.initial_m) : 1;
    const remainB = b.initial_m > 0 ? (b.available_m / b.initial_m) : 1;
    const isRemainA = remainA < 0.30;
    const isRemainB = remainB < 0.30;

    if (isRemainA && !isRemainB) return -1; // restul A înainte
    if (!isRemainA && isRemainB) return 1;
    // Ambele resturi sau ambele normale: sortează după received_at
    return new Date(a.received_at) - new Date(b.received_at);
  });
}

/**
 * Aplică strategia FIFO:
 * Sortează loturile crescător după received_at.
 */
function sortFifo(batches) {
  return [...batches].sort((a, b) => new Date(a.received_at) - new Date(b.received_at));
}

/**
 * Construiește planul de tăiere: alocă loturi până la acoperirea cantității cerute.
 *
 * @param {Array} sortedBatches - loturi sortate după strategie
 * @param {number} neededMeters - metri necesari total
 * @returns {{ plan: Array, fulfilled_m: number, waste_m: number, cuts_count: number }}
 */
function buildCuttingPlan(sortedBatches, neededMeters) {
  let remaining = neededMeters;
  const plan = [];

  for (const batch of sortedBatches) {
    if (remaining <= 0) break;

    const takeMeters = Math.min(batch.available_m, remaining);
    const wasteMeters = batch.available_m >= neededMeters
      ? batch.available_m - neededMeters
      : 0;

    plan.push({
      batch_id:       batch.id,
      batch_number:   batch.batch_number,
      location_id:    batch.location_id,
      location_code:  batch.location_code,
      zone_code:      batch.zone_code,
      available_m:    batch.available_m,
      take_m:         Math.round(takeMeters * 100) / 100,
      waste_m:        Math.round(wasteMeters * 100) / 100,
      initial_m:      batch.initial_m,
      received_at:    batch.received_at,
      is_partial:     batch.initial_m > 0 && (batch.available_m / batch.initial_m) < 0.3,
    });

    remaining -= takeMeters;
  }

  const fulfilled_m = neededMeters - Math.max(0, remaining);
  const total_waste_m = plan.reduce((s, p) => s + p.waste_m, 0);

  return {
    plan,
    fulfilled_m:  Math.round(fulfilled_m * 100) / 100,
    unfulfilled_m: Math.round(Math.max(0, remaining) * 100) / 100,
    waste_m:      Math.round(total_waste_m * 100) / 100,
    cuts_count:   plan.length,
  };
}

// ─── Engine principal ─────────────────────────────────────────────────────────

/**
 * Sugerează planul de tăiere pentru o comandă.
 *
 * @param {Object} opts
 * @param {string} opts.productSku - SKU produs
 * @param {number} opts.requestedQty - cantitatea cerută
 * @param {string} opts.uom - unitatea de măsură a cererii
 * @param {string} [opts.warehouseId] - UUID depozit (opțional)
 * @param {Object} [opts.product] - metadata produs (density_kg_per_m, etc.)
 * @param {Object} [opts.orderLine] - date linie comandă
 * @returns {Promise<Object>} plan tăiere + metadate
 */
async function suggestCutting({ productSku, requestedQty, uom, warehouseId, product = {}, orderLine = {} } = {}) {
  // 1. Convertim cantitatea cerută în metru
  const neededMeters = convertToMeters(requestedQty, uom, product);
  logger.info(`[cuttingEngine] SKU=${productSku} cerere=${requestedQty}${uom} = ${neededMeters}m`);

  // 2. Preluăm regulile CUTTING active
  let rules = [];
  try {
    const rulesRes = await db.query(
      `SELECT * FROM wms_rules WHERE scope = 'CUTTING' AND is_active = true ORDER BY priority DESC`,
      []
    );
    rules = rulesRes.rows;
  } catch (err) {
    logger.warn('[cuttingEngine] Nu s-au putut prelua regulile CUTTING:', err.message);
  }

  // 3. Contextul pentru evaluare reguli
  const context = buildContext({
    product: { sku: productSku, ...product },
    orderLine: { requested_length_m: neededMeters, requested_qty: requestedQty, uom, ...orderLine },
  });

  // 4. Aplicăm regulile
  const { matchedRules, actions } = applyRules(rules, context);
  const strategy = getAction(actions, 'PICK_STRATEGY') || getAction(actions, 'CUT_STRATEGY') || 'MINIMIZE_WASTE';

  logger.info(`[cuttingEngine] Strategie aleasă: ${strategy} (${matchedRules.length} reguli potrivite)`);

  // 5. Preluăm loturile disponibile din DB
  let batches = [];
  try {
    const warehouseFilter = warehouseId
      ? `AND w.id = '${warehouseId}'`
      : '';

    const batchRes = await db.query(
      `SELECT
          pb.id,
          pb.batch_number,
          pb.product_sku,
          pb.current_quantity         AS available_m,
          pb.initial_quantity         AS initial_m,
          pb.received_at,
          pb.location_id,
          l.code                      AS location_code,
          wz.code                     AS zone_code
       FROM product_batches pb
       LEFT JOIN locations l    ON l.id = pb.location_id
       LEFT JOIN warehouse_zones wz ON wz.id = l.zone_id
       LEFT JOIN warehouses w   ON w.id = wz.warehouse_id
       WHERE pb.product_sku = $1
         AND pb.status IN ('ACTIVE', 'PARTIAL')
         AND pb.current_quantity > 0
         ${warehouseFilter}
       ORDER BY pb.received_at ASC`,
      [productSku]
    );
    batches = batchRes.rows.map(r => ({
      ...r,
      available_m: parseFloat(r.available_m || 0),
      initial_m:   parseFloat(r.initial_m || 0),
    }));
  } catch (err) {
    logger.error('[cuttingEngine] Eroare la preluarea loturilor:', err.message);
  }

  // 6. Sortăm loturile după strategie
  let sortedBatches;
  switch (strategy.toUpperCase()) {
    case 'FEWEST_CUTS':
      sortedBatches = sortFewestCuts(batches);
      break;
    case 'USE_REMAINS_FIRST':
      sortedBatches = sortUseRemainsFirst(batches);
      break;
    case 'FIFO':
      sortedBatches = sortFifo(batches);
      break;
    case 'MINIMIZE_WASTE':
    default:
      sortedBatches = sortMinimizeWaste(batches, neededMeters);
  }

  // 7. Construim planul de tăiere
  const { plan, fulfilled_m, unfulfilled_m, waste_m, cuts_count } = buildCuttingPlan(sortedBatches, neededMeters);

  const firstRule = matchedRules[0];

  return {
    product_sku:     productSku,
    requested_qty:   requestedQty,
    requested_uom:   uom,
    needed_meters:   neededMeters,
    strategy,
    rule_applied:    firstRule?.name || null,
    rule_applied_id: firstRule?.id || null,
    matched_rules:   matchedRules,
    cutting_plan:    plan,
    summary: {
      fulfilled_m,
      unfulfilled_m,
      waste_m,
      waste_percent: neededMeters > 0 ? Math.round((waste_m / neededMeters) * 100) : 0,
      cuts_count,
      is_fully_fulfilled: unfulfilled_m === 0,
    },
  };
}

module.exports = { suggestCutting, convertToMeters, convertFromMeters };
