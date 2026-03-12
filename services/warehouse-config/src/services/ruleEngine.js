'use strict';

/**
 * WMS Rule Engine — Evaluator de condiții și acțiuni
 *
 * O regulă arată astfel:
 * {
 *   scope: 'PICKING',
 *   priority: 100,
 *   conditions: [
 *     { field: 'product.category', operator: '=', value: 'cable' },
 *     { field: 'stock.length_m', operator: '>', value: 50 }
 *   ],
 *   actions: [
 *     { type: 'PICK_STRATEGY', value: 'USE_REMAINS_FIRST' }
 *   ]
 * }
 *
 * Contextul evaluat arată astfel:
 * {
 *   product: { category: 'cable', sku: 'CBL-001', ... },
 *   stock:   { length_m: 120, packaging_type: 'DRUM', status: 'INTACT', ... },
 *   order_line: { requested_length_m: 80, uom: 'm', ... },
 *   location: { zone_type: 'STORAGE', zone_code: 'TAMBURI', ... }
 * }
 */

// ─── Operatori suportați ──────────────────────────────────────────────────────

const OPERATORS = {
  '=':         (a, b) => a == b,
  '!=':        (a, b) => a != b,
  '>':         (a, b) => Number(a) > Number(b),
  '>=':        (a, b) => Number(a) >= Number(b),
  '<':         (a, b) => Number(a) < Number(b),
  '<=':        (a, b) => Number(a) <= Number(b),
  'IN':        (a, b) => Array.isArray(b) ? b.includes(a) : String(b).split(',').map(s => s.trim()).includes(String(a)),
  'NOT_IN':    (a, b) => Array.isArray(b) ? !b.includes(a) : !String(b).split(',').map(s => s.trim()).includes(String(a)),
  'CONTAINS':  (a, b) => String(a).toLowerCase().includes(String(b).toLowerCase()),
  'STARTS_WITH': (a, b) => String(a).toLowerCase().startsWith(String(b).toLowerCase()),
  'IS_NULL':   (a)    => a == null || a === '',
  'IS_NOT_NULL': (a)  => a != null && a !== '',
  // Operatori speciali — nu evaluează o condiție, ci influențează sortarea
  'ORDER_BY_ASC':  () => true,
  'ORDER_BY_DESC': () => true,
  'MINIMIZE':      () => true,
};

// ─── Rezolvare câmp din context ───────────────────────────────────────────────

/**
 * Extrage valoarea unui câmp dot-notation din context.
 * Ex: getFieldValue({ product: { category: 'cable' } }, 'product.category') → 'cable'
 */
function getFieldValue(context, fieldPath) {
  const parts = fieldPath.split('.');
  let current = context;
  for (const part of parts) {
    if (current == null) return undefined;
    current = current[part];
  }
  return current;
}

// ─── Evaluare condiție individuală ───────────────────────────────────────────

/**
 * Evaluează o singură condiție față de context.
 * @returns {boolean}
 */
function evaluateCondition(condition, context) {
  const { field, operator, value } = condition;

  if (!OPERATORS[operator]) {
    // Operator necunoscut — ignorăm condiția (permisivă)
    return true;
  }

  const fieldValue = getFieldValue(context, field);
  return OPERATORS[operator](fieldValue, value);
}

// ─── Evaluare regulă completă ─────────────────────────────────────────────────

/**
 * Returnează true dacă TOATE condițiile regulii sunt îndeplinite.
 * @param {Object} rule - regula din DB
 * @param {Object} context - contextul operațiunii
 * @returns {boolean}
 */
function evaluateRule(rule, context) {
  const conditions = Array.isArray(rule.conditions) ? rule.conditions : [];

  // O regulă fără condiții se aplică mereu
  if (conditions.length === 0) return true;

  return conditions.every(cond => evaluateCondition(cond, context));
}

// ─── Aplicare reguli pe un set de reguli ─────────────────────────────────────

/**
 * Filtrează și sortează regulile după prioritate, evaluează fiecare față de context.
 * Returnează lista de acțiuni colectate din toate regulile care se potrivesc.
 *
 * @param {Array} rules - toate regulile din DB pentru un scope
 * @param {Object} context - contextul operațiunii
 * @returns {{ matchedRules: Array, actions: Array }}
 */
function applyRules(rules, context) {
  // Sortare descrescătoare după prioritate
  const sorted = [...rules]
    .filter(r => r.is_active !== false)
    .sort((a, b) => (b.priority || 0) - (a.priority || 0));

  const matchedRules = [];
  const actionMap = {}; // tip → ultimă valoare (prioritate mai mare câștigă)

  for (const rule of sorted) {
    if (evaluateRule(rule, context)) {
      matchedRules.push({
        id: rule.id,
        name: rule.name,
        rule_type: rule.rule_type,
        priority: rule.priority,
      });

      const ruleActions = Array.isArray(rule.actions) ? rule.actions : [];
      for (const action of ruleActions) {
        // Dacă tipul nu a fost setat încă (prioritate mai mare câștigă)
        if (!actionMap[action.type]) {
          actionMap[action.type] = { ...action, from_rule: rule.name };
        }
      }
    }
  }

  const actions = Object.values(actionMap);

  return { matchedRules, actions };
}

// ─── Helper: extrage o acțiune specifică ─────────────────────────────────────

/**
 * Extrage valoarea unei acțiuni specifice din rezultatul applyRules.
 * @param {Array} actions
 * @param {string} actionType
 * @returns {*} valoarea acțiunii sau undefined
 */
function getAction(actions, actionType) {
  const found = actions.find(a => a.type === actionType);
  return found ? found.value : undefined;
}

/**
 * Returnează true dacă acțiunea de tipul dat există în lista de acțiuni.
 */
function hasAction(actions, actionType) {
  return actions.some(a => a.type === actionType);
}

// ─── Construire context standard ─────────────────────────────────────────────

/**
 * Construiește contextul standard pentru motorul de reguli din date brute.
 *
 * @param {Object} opts
 * @param {Object} opts.product - rândul din tabela products
 * @param {Object} [opts.stock] - rândul din inventory_items sau product_batches
 * @param {Object} [opts.orderLine] - linia din sales_order_lines
 * @param {Object} [opts.location] - locația curentă sau destinație propusă
 * @returns {Object} context standard
 */
function buildContext({ product = {}, stock = {}, orderLine = {}, location = {} } = {}) {
  return {
    product: {
      category:    product.category || product.product_category || null,
      sku:         product.sku || null,
      brand:       product.brand || null,
      cable_section: product.cable_section || product.cross_section_mm2 || null,
      voltage:     product.voltage || product.rated_voltage || null,
      name:        product.name || product.product_name || null,
    },
    stock: {
      length_m:       parseFloat(stock.length_m || stock.quantity || 0),
      quantity:        parseFloat(stock.quantity || 0),
      packaging_type:  stock.packaging_type || stock.packaging_code || null,
      status:          stock.status || stock.lot_status || null,
      location_zone:   stock.location_zone || stock.zone_code || null,
      received_at:     stock.received_at || stock.created_at || null,
    },
    order_line: {
      requested_length_m: parseFloat(orderLine.requested_length_m || orderLine.quantity || 0),
      requested_qty:       parseFloat(orderLine.quantity || orderLine.requested_qty || 0),
      uom:                 orderLine.uom || orderLine.unit || 'm',
    },
    location: {
      zone_type:   location.zone_type || null,
      zone_code:   location.zone_code || null,
      type:        location.type || location.location_type || null,
      accessibility: location.accessibility || 'MEDIUM',
      allowed_categories: location.allowed_categories || null,
      allowed_packaging:  location.allowed_packaging || null,
    },
  };
}

// ─── Validare locație față de constrângeri ────────────────────────────────────

/**
 * Verifică dacă o locație acceptă un produs cu ambalajul dat.
 * Returnează { valid: bool, reason: string }
 */
function validateLocationForProduct(location, { productCategory, packagingType }) {
  const allowed_categories = location.allowed_categories;
  const allowed_packaging = location.allowed_packaging;

  if (allowed_categories && productCategory) {
    const cats = Array.isArray(allowed_categories) ? allowed_categories : [];
    if (cats.length > 0 && !cats.includes(productCategory)) {
      return {
        valid: false,
        reason: `Locația acceptă doar categoriile: ${cats.join(', ')}`,
      };
    }
  }

  if (allowed_packaging && packagingType) {
    const pkgs = Array.isArray(allowed_packaging) ? allowed_packaging : [];
    if (pkgs.length > 0 && !pkgs.includes(packagingType)) {
      return {
        valid: false,
        reason: `Locația acceptă doar ambalajele: ${pkgs.join(', ')}`,
      };
    }
  }

  return { valid: true, reason: null };
}

// ─── BLOCK_OPERATION checker ─────────────────────────────────────────────────

/**
 * Verifică dacă printre acțiunile rezultate există BLOCK_OPERATION.
 * Dacă da, aruncă o eroare cu mesajul specificat în acțiune.
 *
 * @param {Array} actions - lista de acțiuni din applyRules
 * @param {string} [defaultMsg] - mesaj fallback
 * @throws {Error} dacă operațiunea e blocată
 */
function enforceBlockOperation(actions, defaultMsg = 'Operațiunea a fost blocată de o regulă WMS.') {
  const block = actions.find(a => a.type === 'BLOCK_OPERATION');
  if (block) {
    const err = new Error(block.value || defaultMsg);
    err.code = 'RULE_BLOCK';
    err.rule = block.from_rule;
    throw err;
  }
}

/**
 * Verifică dacă e necesară aprobare manager (REQUIRE_APPROVAL).
 * @param {Array} actions
 * @returns {{ required: boolean, reason: string|null }}
 */
function checkRequireApproval(actions) {
  const approval = actions.find(a => a.type === 'REQUIRE_APPROVAL');
  return {
    required: !!approval,
    reason: approval ? (approval.value || 'Aprobare necesară') : null,
    from_rule: approval ? approval.from_rule : null,
  };
}

// ─── Export ───────────────────────────────────────────────────────────────────

module.exports = {
  evaluateRule,
  evaluateCondition,
  getFieldValue,
  applyRules,
  getAction,
  hasAction,
  buildContext,
  validateLocationForProduct,
  enforceBlockOperation,
  checkRequireApproval,
  OPERATORS,
};
