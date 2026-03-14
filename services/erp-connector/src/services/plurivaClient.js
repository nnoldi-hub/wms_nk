'use strict';
/**
 * plurivaClient.js — Client HTTP pentru API-ul Pluriva ERP
 *
 * Toate apelurile catre Pluriva trec prin acest modul.
 * Configurabil prin variabile de mediu:
 *   PLURIVA_API_URL  — baza URL
 *   PLURIVA_API_KEY  — cheie API
 *
 * Cand PLURIVA_API_KEY = "demo" sau nu e setat → modul simulare (date fictive).
 */

const axios = require('axios');
const logger = require('../config/logger');

const BASE_URL = process.env.PLURIVA_API_URL || 'https://api.pluriva.com/v1';
const API_KEY  = process.env.PLURIVA_API_KEY  || '';
const IS_DEMO  = !API_KEY || API_KEY === 'your_pluriva_api_key_here' || API_KEY === 'demo';

if (IS_DEMO) {
  logger.warn('[Pluriva] Mod DEMO — fara cheie API reala, raspunsuri simulate');
}

const client = axios.create({
  baseURL: BASE_URL,
  timeout: 10_000,
  headers: {
    'Authorization': `Bearer ${API_KEY}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

// ─── Simulare (demo data) ─────────────────────────────────────────────────────

function demoOrders() {
  const now = new Date();
  return [
    {
      erp_po_id: `PO-ERP-${now.getFullYear()}-001`,
      supplier_name: 'CABLU SRL',
      supplier_code: 'CS001',
      order_date: new Date(now - 7 * 86400_000).toISOString(),
      expected_delivery: new Date(now + 3 * 86400_000).toISOString(),
      status: 'CONFIRMED',
      lines: [
        { line_no: 1, product_code: 'CBL-001', product_name: 'Cablu FTP Cat6 305m', qty: 10, unit: 'rola', unit_price: 285.00 },
        { line_no: 2, product_code: 'CBL-002', product_name: 'Cablu UTP Cat5e 305m', qty: 5, unit: 'rola', unit_price: 180.00 },
      ],
    },
    {
      erp_po_id: `PO-ERP-${now.getFullYear()}-002`,
      supplier_name: 'ELECTRO IMPORT',
      supplier_code: 'EI002',
      order_date: new Date(now - 2 * 86400_000).toISOString(),
      expected_delivery: new Date(now + 7 * 86400_000).toISOString(),
      status: 'SENT',
      lines: [
        { line_no: 1, product_code: 'CON-001', product_name: 'Conector RJ45', qty: 1000, unit: 'buc', unit_price: 0.35 },
      ],
    },
  ];
}

// ─── API Wrappers ─────────────────────────────────────────────────────────────

/**
 * Preia comenzile de aprovizionare noi/modificate din ERP.
 * @param {string} [sinceDate] — ISO date, returneaza doar PO-urile modificate dupa aceasta data
 */
async function fetchPurchaseOrders(sinceDate) {
  if (IS_DEMO) {
    await new Promise(r => setTimeout(r, 300)); // simuleaza latenta
    return demoOrders();
  }

  const params = sinceDate ? { updated_since: sinceDate } : {};
  const response = await client.get('/purchase-orders', { params });
  return response.data?.data || response.data || [];
}

/**
 * Trimite confirmarea NIR catre ERP dupa receptia marfii.
 * @param {object} nir — { erp_po_id, received_date, lines: [{line_no, qty_received, lot_number}] }
 */
async function confirmReceipt(nir) {
  if (IS_DEMO) {
    logger.info('[Pluriva DEMO] NIR trimis (simulat)', { erp_po_id: nir.erp_po_id });
    return { success: true, erp_nir_id: `NIR-DEMO-${Date.now()}` };
  }

  const response = await client.post('/goods-receipts', nir);
  return response.data;
}

/**
 * Trimite confirmarea livrarii catre ERP.
 * @param {object} delivery — { erp_order_id, delivered_date, lines, tracking_number }
 */
async function confirmDelivery(delivery) {
  if (IS_DEMO) {
    logger.info('[Pluriva DEMO] Livrare confirmata (simulata)', { erp_order_id: delivery.erp_order_id });
    return { success: true, erp_delivery_id: `DEL-DEMO-${Date.now()}` };
  }

  const response = await client.post('/deliveries', delivery);
  return response.data;
}

/**
 * Actualizare stoc in ERP (push din WMS).
 * @param {Array} stockLines — [{ product_code, location_code, qty, lot_number }]
 */
async function pushStockUpdate(stockLines) {
  if (IS_DEMO) {
    logger.info('[Pluriva DEMO] Stoc actualizat (simulat)', { lines: stockLines.length });
    return { success: true, updated: stockLines.length };
  }

  const response = await client.put('/stock', { lines: stockLines });
  return response.data;
}

/**
 * Verifica conectivitatea cu ERP-ul.
 */
async function ping() {
  if (IS_DEMO) {
    return { connected: true, mode: 'demo', api_url: BASE_URL };
  }
  const response = await client.get('/ping');
  return { connected: true, mode: 'live', api_url: BASE_URL, ...response.data };
}

module.exports = { fetchPurchaseOrders, confirmReceipt, confirmDelivery, pushStockUpdate, ping, IS_DEMO };
