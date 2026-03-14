'use strict';
/**
 * syncService.js — Sincronizare periodica WMS <-> Pluriva ERP (Faza 7)
 *
 * Directii:
 *  INBOUND  7.1: Preia PO-uri din ERP → creeaza comenzi furnizor in WMS
 *  OUTBOUND 7.2: Trimite NIR (receptie) si confirmare livrare catre ERP
 *
 * Ruleaza la intervalul SYNC_INTERVAL (default 5 min).
 */

const db           = require('../config/database');
const logger       = require('../config/logger');
const pluriva      = require('./plurivaClient');

const SYNC_INTERVAL_MS = parseInt(process.env.SYNC_INTERVAL || '300000'); // 5 min

let syncTimer = null;
let isSyncing = false;

// ─── Helpers DB ───────────────────────────────────────────────────────────────

async function logJob(type, status, records = 0, error = null) {
  try {
    const result = await db.query(
      `INSERT INTO erp_sync_jobs (type, status, records_synced, error_msg, started_at, completed_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       RETURNING id`,
      [type, status, records, error]
    );
    return result.rows[0]?.id;
  } catch (e) {
    logger.error('[Sync] Nu s-a putut loga job-ul', { err: e.message });
    return null;
  }
}

async function updateJob(id, status, records, error = null) {
  if (!id) return;
  try {
    await db.query(
      `UPDATE erp_sync_jobs SET status=$1, records_synced=$2, error_msg=$3, completed_at=NOW() WHERE id=$4`,
      [status, records, error, id]
    );
  } catch (e) {
    logger.warn('[Sync] updateJob failed', { err: e.message });
  }
}

async function getLastSyncDate(type) {
  try {
    const result = await db.query(
      `SELECT completed_at FROM erp_sync_jobs
       WHERE type=$1 AND status='SUCCESS'
       ORDER BY completed_at DESC LIMIT 1`,
      [type]
    );
    return result.rows[0]?.completed_at?.toISOString() || null;
  } catch {
    return null;
  }
}

// ─── 7.1 INBOUND: Preluare PO-uri din ERP ────────────────────────────────────

async function syncInboundPOs() {
  const jobId = await logJob('PO_INBOUND', 'RUNNING');
  let count = 0;
  try {
    const sinceDate = await getLastSyncDate('PO_INBOUND');
    const orders = await pluriva.fetchPurchaseOrders(sinceDate);
    logger.info(`[Sync] PO inbound: ${orders.length} ordine primite din ERP`);

    for (const po of orders) {
      // Verifica daca PO exista deja (evita duplicate)
      const existing = await db.query(
        `SELECT id FROM erp_po_mappings WHERE erp_po_id = $1`,
        [po.erp_po_id]
      );

      if (existing.rows.length > 0) {
        // Update status daca s-a schimbat
        await db.query(
          `UPDATE erp_po_mappings SET erp_status=$1, updated_at=NOW() WHERE erp_po_id=$2`,
          [po.status, po.erp_po_id]
        );
        continue;
      }

      // Inregistreaza mapping nou
      await db.query(
        `INSERT INTO erp_po_mappings
           (erp_po_id, supplier_name, supplier_code, erp_status, order_date,
            expected_delivery, lines_json)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (erp_po_id) DO NOTHING`,
        [
          po.erp_po_id,
          po.supplier_name,
          po.supplier_code,
          po.status,
          po.order_date,
          po.expected_delivery,
          JSON.stringify(po.lines || []),
        ]
      );
      count++;
      logger.info(`[Sync] PO importat: ${po.erp_po_id}`);
    }

    await updateJob(jobId, 'SUCCESS', count);
    return { success: true, imported: count, total: orders.length };
  } catch (err) {
    logger.error('[Sync] Eroare sync PO inbound', { err: err.message });
    await updateJob(jobId, 'ERROR', count, err.message);
    return { success: false, error: err.message };
  }
}

// ─── 7.2 OUTBOUND: Trimitere NIR catre ERP ───────────────────────────────────

async function syncOutboundNIRs() {
  const jobId = await logJob('NIR_OUTBOUND', 'RUNNING');
  let count = 0;
  try {
    // Preia NIR-urile confirmate care nu au fost inca trimise la ERP
    const result = await db.query(`
      SELECT
        gr.id,
        gr.po_id,
        gr.confirmation_date,
        gr.lines_json,
        pm.erp_po_id
      FROM goods_receipts gr
      JOIN erp_po_mappings pm ON pm.erp_po_id = gr.erp_po_id
      WHERE gr.erp_synced = FALSE
        AND gr.status = 'CONFIRMED'
      LIMIT 50
    `);

    for (const row of result.rows) {
      try {
        const erpResponse = await pluriva.confirmReceipt({
          erp_po_id:     row.erp_po_id,
          received_date: row.confirmation_date,
          wms_receipt_id: row.id,
          lines: JSON.parse(row.lines_json || '[]'),
        });

        await db.query(
          `UPDATE goods_receipts SET erp_synced=TRUE, erp_nir_id=$1, updated_at=NOW() WHERE id=$2`,
          [erpResponse.erp_nir_id, row.id]
        );
        count++;
        logger.info(`[Sync] NIR trimis la ERP: receipt=${row.id} erp_nir=${erpResponse.erp_nir_id}`);
      } catch (lineErr) {
        logger.warn(`[Sync] NIR eroare pt receipt ${row.id}`, { err: lineErr.message });
      }
    }

    await updateJob(jobId, 'SUCCESS', count);
    return { success: true, synced: count };
  } catch (err) {
    logger.error('[Sync] Eroare sync NIR outbound', { err: err.message });
    await updateJob(jobId, 'ERROR', count, err.message);
    return { success: false, error: err.message };
  }
}

// ─── 7.2 OUTBOUND: Confirmare livrari catre ERP ──────────────────────────────

async function syncOutboundDeliveries() {
  const jobId = await logJob('DELIVERY_OUTBOUND', 'RUNNING');
  let count = 0;
  try {
    const result = await db.query(`
      SELECT
        s.id,
        s.order_id,
        s.delivered_at,
        s.tracking_number,
        s.lines_json,
        o.erp_order_id
      FROM shipments s
      JOIN orders o ON o.id = s.order_id
      WHERE s.erp_synced = FALSE
        AND s.status = 'DELIVERED'
        AND o.erp_order_id IS NOT NULL
      LIMIT 50
    `);

    for (const row of result.rows) {
      try {
        const erpResponse = await pluriva.confirmDelivery({
          erp_order_id:    row.erp_order_id,
          delivered_date:  row.delivered_at,
          tracking_number: row.tracking_number,
          wms_shipment_id: row.id,
          lines: JSON.parse(row.lines_json || '[]'),
        });

        await db.query(
          `UPDATE shipments SET erp_synced=TRUE, erp_delivery_id=$1, updated_at=NOW() WHERE id=$2`,
          [erpResponse.erp_delivery_id, row.id]
        );
        count++;
        logger.info(`[Sync] Livrare confirmata in ERP: shipment=${row.id}`);
      } catch (lineErr) {
        logger.warn(`[Sync] Delivery eroare pt shipment ${row.id}`, { err: lineErr.message });
      }
    }

    await updateJob(jobId, 'SUCCESS', count);
    return { success: true, synced: count };
  } catch (err) {
    logger.error('[Sync] Eroare sync deliveries outbound', { err: err.message });
    await updateJob(jobId, 'ERROR', count, err.message);
    return { success: false, error: err.message };
  }
}

// ─── Ciclu principal ──────────────────────────────────────────────────────────

async function runAllSyncs() {
  if (isSyncing) {
    logger.warn('[Sync] Sync deja in curs, saltam acest ciclu');
    return;
  }
  isSyncing = true;
  logger.info('[Sync] Incepe ciclul de sincronizare ERP');
  try {
    await syncInboundPOs();
    await syncOutboundNIRs();
    await syncOutboundDeliveries();
    logger.info('[Sync] Ciclu sincronizare finalizat');
  } catch (err) {
    logger.error('[Sync] Eroare critica ciclu sync', { err: err.message });
  } finally {
    isSyncing = false;
  }
}

function start() {
  logger.info(`[Sync] Pornire sincronizare periodica (interval: ${SYNC_INTERVAL_MS}ms)`);
  runAllSyncs(); // Rulam imediat la start
  syncTimer = setInterval(runAllSyncs, SYNC_INTERVAL_MS);
}

function stop() {
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = null;
    logger.info('[Sync] Sincronizare oprita');
  }
}

module.exports = {
  start,
  stop,
  runAllSyncs,
  syncInboundPOs,
  syncOutboundNIRs,
  syncOutboundDeliveries,
};
