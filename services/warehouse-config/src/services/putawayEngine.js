'use strict';

/**
 * Putaway Engine — Sugestie locație la recepție
 *
 * Flux:
 *  1. Preia regulile active cu scope=PUTAWAY din DB
 *  2. Construiește contextul din produsul și ambalajul primit
 *  3. Aplică regulile → obține acțiuni (SUGGEST_ZONE, SUGGEST_LOCATION)
 *  4. Filtrează locațiile disponibile din DB care:
 *     - potrivesc zona sugerată (dacă există)
 *     - au constrângerile compatibile (allowed_categories, allowed_packaging)
 *     - sunt AVAILABLE
 *  5. Returnează lista ordonată de locații sugerate
 */

const db = require('../config/database');
const logger = require('../config/logger');
const { applyRules, buildContext, getAction, validateLocationForProduct } = require('./ruleEngine');

/**
 * Calculează scorul de potrivire al unei locații.
 * Mai mare = mai bun.
 */
function scoreLocation(location, suggestedZoneCode, suggestedLocationType) {
  let score = 0;

  // Locație în zona recomandată de reguli
  if (suggestedZoneCode && (location.zone_code || '').toUpperCase() === suggestedZoneCode.toUpperCase()) {
    score += 100;
  }

  // Tipul de locație potrivit
  if (suggestedLocationType && (location.type_name || location.location_type_code || '').toUpperCase() === suggestedLocationType.toUpperCase()) {
    score += 50;
  }

  // Locații cu constrângeri specifice sunt mai potrivite (înseamnă că sunt dedicate)
  if (location.allowed_categories || location.allowed_packaging) {
    score += 20;
  }

  // Preferăm locații mai puțin ocupate
  const occupancy = parseFloat(location.current_occupancy_percent || 0);
  score += Math.max(0, 30 - occupancy / 3);

  // Prioritatea locației
  score += parseInt(location.priority || 5) * 2;

  return score;
}

/**
 * Sugerează locații pentru putaway.
 *
 * @param {Object} opts
 * @param {string} opts.warehouseId - UUID depozit
 * @param {Object} opts.product - obiect produs { category, sku, ... }
 * @param {Object} opts.stock - { packaging_type, length_m, quantity, status }
 * @param {number} [opts.limit=5] - număr maxim de sugestii returnate
 * @returns {Promise<{ suggestions: Array, matchedRules: Array, actions: Array }>}
 */
async function suggestPutaway({ warehouseId, product, stock, limit = 5 }) {
  // 1. Preia regulile PUTAWAY active
  const rulesResult = await db.query(
    `SELECT id, name, rule_type, scope, priority, conditions, actions, is_active
     FROM wms_rules
     WHERE scope = 'PUTAWAY' AND is_active = true
     ORDER BY priority DESC`,
    []
  );
  const rules = rulesResult.rows;

  // 2. Construiește contextul
  const context = buildContext({ product, stock });

  // 3. Aplică regulile
  const { matchedRules, actions } = applyRules(rules, context);

  const suggestedZone = getAction(actions, 'SUGGEST_ZONE');
  const suggestedLocationType = getAction(actions, 'SUGGEST_LOCATION');

  logger.info('[PutawayEngine] Reguli aplicate', {
    total_rules: rules.length,
    matched: matchedRules.length,
    suggestedZone,
    suggestedLocationType,
  });

  // 4. Preia locațiile disponibile
  let locationQuery = `
    SELECT
      l.*,
      lt.name  AS type_name,
      lt.code  AS location_type_code,
      wz.zone_name,
      wz.zone_code,
      wz.zone_type
    FROM locations l
    LEFT JOIN location_types lt ON l.location_type_id = lt.id
    LEFT JOIN warehouse_zones wz ON l.zone_id = wz.id
    WHERE l.warehouse_id = $1
      AND l.status = 'AVAILABLE'
      AND (l.is_active IS NULL OR l.is_active = true)
  `;
  const params = [warehouseId];
  let idx = 2;

  // Filtrare după zona sugerată (dacă există)
  if (suggestedZone) {
    locationQuery += ` AND (UPPER(wz.zone_code) = $${idx} OR UPPER(wz.zone_name) LIKE $${idx + 1})`;
    params.push(suggestedZone.toUpperCase(), `%${suggestedZone.toUpperCase()}%`);
    idx += 2;
  }

  locationQuery += ' LIMIT 100'; // preluăm mai multe, le sortăm local

  const locationsResult = await db.query(locationQuery, params);
  let locations = locationsResult.rows;

  // 5. Filtrare după constrângerile locației
  const productCategory = product.category || product.product_category;
  const packagingType = stock.packaging_type || stock.packaging_code;

  locations = locations.filter(loc => {
    const { valid } = validateLocationForProduct(loc, { productCategory, packagingType });
    return valid;
  });

  // 6. Scoring și sortare
  locations = locations
    .map(loc => ({
      ...loc,
      _score: scoreLocation(loc, suggestedZone, suggestedLocationType),
    }))
    .sort((a, b) => b._score - a._score)
    .slice(0, limit);

  // 7. Construire răspuns
  const suggestions = locations.map((loc, index) => ({
    rank: index + 1,
    location_id: loc.id,
    location_code: loc.location_code || loc.id,
    zone_name: loc.zone_name,
    zone_code: loc.zone_code,
    type_name: loc.type_name,
    current_occupancy_percent: loc.current_occupancy_percent || 0,
    suggestion_label: loc.suggestion_label || null,
    score: Math.round(loc._score),
    is_recommended: index === 0,
  }));

  return {
    suggestions,
    matchedRules,
    actions,
    context: {
      product_category: productCategory,
      packaging_type: packagingType,
      suggested_zone: suggestedZone,
      suggested_location_type: suggestedLocationType,
    },
  };
}

module.exports = { suggestPutaway };
