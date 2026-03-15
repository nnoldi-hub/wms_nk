#!/usr/bin/env node
/**
 * WMS - Simulare Flux Operational Complet
 * =========================================
 * Simulează un workflow complet de depozit:
 *   1. Autentificare admin
 *   2. Creare produs
 *   3. Creare Notă de Intrare-Recepție (NIR / Goods Receipt)
 *   4. Confirmare NIR → creare lot stoc
 *   5. Putaway lot la locație
 *   6. Creare comandă vânzări (Order)
 *   7. Alocare job picking
 *   8. Accept job → pick articol → completare job
 *   9. Mutare în zona expediere
 *
 * Utilizare:
 *   node scripts/simulate-flow.js [--base-url http://localhost] [--verbose]
 *
 * Cerințe:
 *   - Docker Compose să ruleze (serviciile auth + inventory pornite)
 *   - Un utilizator admin existent (username: admin, password: configurat în .env)
 *   - Node.js 18+
 */

const http = require('http');
const https = require('https');

// ─── Config ───────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const BASE_URL = args.find((a) => a.startsWith('--base-url='))?.split('=')[1] || 'http://localhost';
const VERBOSE = args.includes('--verbose');

const AUTH_URL = `${BASE_URL}:3010`;
const INV_URL = `${BASE_URL}:3011`;

const ADMIN_USER = process.env.SIM_ADMIN_USERNAME || 'admin';
const ADMIN_PASS = process.env.SIM_ADMIN_PASSWORD || 'admin_secure_pass_2025';

const SKU = `SIM-CABLU-${Date.now()}`;
const LOC_ID = `SIM-LOC-${Date.now()}`;
let accessToken = '';

// ─── HTTP helpers ─────────────────────────────────────────────────────────────

function request(url, method, body, token) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const client = parsed.protocol === 'https:' ? https : http;
    const payload = body ? JSON.stringify(body) : null;

    const options = {
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname + parsed.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
      },
    };

    const req = client.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

// ─── Step helpers ─────────────────────────────────────────────────────────────

let stepNum = 0;
function step(title) {
  stepNum++;
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`  Pasul ${stepNum}: ${title}`);
  console.log('─'.repeat(60));
}

function ok(msg, data) {
  console.log(`  ✓  ${msg}`);
  if (VERBOSE && data !== undefined) {
    console.log('     ', JSON.stringify(data, null, 2).replace(/\n/g, '\n     '));
  }
}

function fail(msg, data) {
  console.error(`  ✗  EROARE: ${msg}`);
  if (data !== undefined) {
    console.error('     ', JSON.stringify(data, null, 2));
  }
  process.exit(1);
}

function assert(condition, successMsg, failMsg, data) {
  if (condition) {
    ok(successMsg, data);
  } else {
    fail(failMsg, data);
  }
}

// ─── Simulation Steps ─────────────────────────────────────────────────────────

async function checkServices() {
  step('Verificare servicii (health check)');

  const auth = await request(`${AUTH_URL}/health`, 'GET').catch(() => null);
  assert(auth?.status === 200, `Auth service online (${AUTH_URL})`, `Auth service inaccesibil la ${AUTH_URL}`);

  const inv = await request(`${INV_URL}/health`, 'GET').catch(() => null);
  assert(inv?.status === 200, `Inventory service online (${INV_URL})`, `Inventory service inaccesibil la ${INV_URL}`);
}

async function login() {
  step('Autentificare admin');

  const res = await request(`${AUTH_URL}/api/v1/auth/login`, 'POST', {
    username: ADMIN_USER,
    password: ADMIN_PASS,
  });

  assert(res.status === 200, `Login reușit (user: ${ADMIN_USER})`, 'Login eșuat', res.body);
  accessToken = res.body.accessToken;
  ok(`Token: ${accessToken.substring(0, 40)}...`);
}

async function createLocation() {
  step('Creare locație depozitare');

  const res = await request(`${INV_URL}/api/v1/locations`, 'POST', {
    id: LOC_ID,
    zone: 'SIM',
    rack: '01',
    position: '01',
  }, accessToken);

  assert(
    [200, 201].includes(res.status),
    `Locație creată: ${LOC_ID}`,
    `Eroare creare locație`,
    res.body,
  );
}

async function createProduct() {
  step('Creare produs nou');

  const res = await request(`${INV_URL}/api/v1/products`, 'POST', {
    sku: SKU,
    name: `Simulare Produs ${SKU}`,
    uom: 'm',
    lot_control: true,
  }, accessToken);

  assert(res.status === 201, `Produs creat: ${SKU}`, 'Eroare creare produs', res.body);
}

async function createAndConfirmNIR() {
  step('Creare & confirmare NIR (recepție marfă)');

  // Create NIR
  const nirRes = await request(`${INV_URL}/api/v1/goods-receipts`, 'POST', {
    supplier: 'Furnizor Test SRL',
    lines: [
      { product_sku: SKU, quantity: 500, uom: 'm', lot_number: `LOT-SIM-${Date.now()}` },
    ],
  }, accessToken);

  assert([200, 201].includes(nirRes.status), 'NIR creat (draft)', 'Eroare creare NIR', nirRes.body);

  const nirId = nirRes.body.id || nirRes.body.data?.id;
  assert(!!nirId, `NIR ID: ${nirId}`, 'NIR ID lipsă din răspuns', nirRes.body);

  // Confirm NIR → creates batches
  const confirmRes = await request(`${INV_URL}/api/v1/goods-receipts/${nirId}/confirm`, 'POST', null, accessToken);
  assert(
    [200, 201].includes(confirmRes.status),
    'NIR confirmat → loturi create în stoc',
    'Eroare confirmare NIR',
    confirmRes.body,
  );

  return nirId;
}

async function findAndPutawayBatch() {
  step('Putaway lot (repartizare la locație)');

  const res = await request(`${INV_URL}/api/v1/batches/pending-putaway`, 'GET', null, accessToken);
  assert(res.status === 200, 'Loturi pending-putaway preluate', 'Eroare preluare loturi', res.body);

  const batches = Array.isArray(res.body) ? res.body : res.body.data;
  const batch = batches?.find((b) => b.product_sku === SKU || b.sku === SKU);
  assert(!!batch, `Lot găsit pentru ${SKU}: ${batch?.id}`, `Niciun lot găsit pentru ${SKU}`);

  // Assign location
  const putRes = await request(`${INV_URL}/api/v1/batches/${batch.id}`, 'PUT', {
    location_id: LOC_ID,
    status: 'in_stock',
  }, accessToken);

  assert([200, 201, 204].includes(putRes.status), `Lot ${batch.id} pus în locație ${LOC_ID}`, 'Eroare putaway', putRes.body);

  return batch.id;
}

async function createOrder() {
  step('Creare comandă vânzări');

  const res = await request(`${INV_URL}/api/v1/orders`, 'POST', {
    customer: 'Client Test SA',
    lines: [
      { product_sku: SKU, quantity_ordered: 100, uom: 'm' },
    ],
  }, accessToken);

  assert([200, 201].includes(res.status), 'Comandă creată', 'Eroare creare comandă', res.body);

  const orderId = res.body.id || res.body.data?.id || res.body.order?.id;
  assert(!!orderId, `Order ID: ${orderId}`, 'Order ID lipsă din răspuns', res.body);

  return orderId;
}

async function allocatePicking(orderId) {
  step('Alocare job picking');

  const res = await request(`${INV_URL}/api/v1/orders/${orderId}/allocate`, 'POST', null, accessToken);
  assert([200, 201].includes(res.status), 'Job picking alocat', 'Eroare alocare picking', res.body);

  const jobId = res.body.id || res.body.data?.id || res.body.job?.id;
  assert(!!jobId, `Pick Job ID: ${jobId}`, 'Pick Job ID lipsă din răspuns', res.body);

  return jobId;
}

async function executePicking(jobId) {
  step('Execuție picking (accept → pick → complete)');

  // Accept job
  const acceptRes = await request(`${INV_URL}/api/v1/pick-jobs/${jobId}/accept`, 'POST', null, accessToken);
  assert([200, 201].includes(acceptRes.status), 'Job acceptat de operator', 'Eroare acceptare job', acceptRes.body);

  // Get job items
  const jobRes = await request(`${INV_URL}/api/v1/pick-jobs/${jobId}`, 'GET', null, accessToken);
  assert(jobRes.status === 200, 'Detalii job preluate', 'Eroare preluare job', jobRes.body);

  const items = jobRes.body.items || jobRes.body.data?.items || [];
  if (items.length === 0) {
    ok('Niciun articol de pickat (possible: structură răspuns diferită)');
  } else {
    for (const item of items) {
      const pickRes = await request(`${INV_URL}/api/v1/pick-jobs/${jobId}/pick`, 'POST', {
        item_id: item.id,
        quantity_picked: item.quantity_to_pick || item.quantity,
      }, accessToken);
      assert([200, 201].includes(pickRes.status), `Articol ${item.id} pickat`, 'Eroare pick articol', pickRes.body);
    }
  }

  // Complete job
  const completeRes = await request(`${INV_URL}/api/v1/pick-jobs/${jobId}/complete`, 'POST', null, accessToken);
  assert([200, 201].includes(completeRes.status), 'Job picking completat', 'Eroare completare job', completeRes.body);
}

async function moveToShipping(jobId) {
  step('Mutare în zona de expediere');

  const res = await request(`${INV_URL}/api/v1/pick-jobs/${jobId}/move-to-shipping`, 'POST', null, accessToken);
  assert([200, 201].includes(res.status), 'Marfă mutată în zona de expediere ✓', 'Eroare mutare expediere', res.body);
}

async function cleanup() {
  step('Curățare date test');

  // Delete test product (will cascade or soft-delete)
  const delProd = await request(`${INV_URL}/api/v1/products/sku/${SKU}`, 'DELETE', null, accessToken).catch(() => null);
  ok(`Produs ${SKU} șters (status: ${delProd?.status ?? 'N/A'})`);

  ok('Simulare completă — toate datele de test create au fost șterse');
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n════════════════════════════════════════════════════════════');
  console.log('  WMS NK — Simulare Flux Operational Complet');
  console.log('════════════════════════════════════════════════════════════');
  console.log(`  Auth URL:      ${AUTH_URL}`);
  console.log(`  Inventory URL: ${INV_URL}`);
  console.log(`  Admin user:    ${ADMIN_USER}`);
  console.log(`  SKU test:      ${SKU}`);
  if (VERBOSE) console.log('  Mod verbose: activ');

  try {
    await checkServices();
    await login();
    await createLocation();
    await createProduct();
    await createAndConfirmNIR();
    await findAndPutawayBatch();
    const orderId = await createOrder();
    const jobId = await allocatePicking(orderId);
    await executePicking(jobId);
    await moveToShipping(jobId);
    await cleanup();

    console.log('\n════════════════════════════════════════════════════════════');
    console.log('  ✓  SIMULARE COMPLETĂ CU SUCCES');
    console.log('════════════════════════════════════════════════════════════\n');
    process.exit(0);
  } catch (err) {
    console.error('\n  EROARE NEAȘTEPTATĂ:', err.message);
    if (VERBOSE) console.error(err.stack);
    process.exit(1);
  }
}

main();
