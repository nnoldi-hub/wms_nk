'use strict';
/**
 * syncController.js — API endpoints pentru status si control sync manual (Faza 7)
 *
 * GET  /api/v1/sync/status    — status curent + ultima sincronizare
 * POST /api/v1/sync/trigger   — declanseaza sync manual imediat
 * GET  /api/v1/sync/jobs      — lista job-uri last N
 * GET  /api/v1/sync/pos       — lista PO-uri importate din ERP
 * GET  /api/v1/webhooks/logs  — log webhook-uri primite
 */

const db          = require('../config/database');
const logger      = require('../config/logger');
const syncService = require('../services/syncService');
const pluriva     = require('../services/plurivaClient');

exports.getStatus = async (req, res) => {
  try {
    // Ultima sincronizare per tip
    const result = await db.query(`
      SELECT type,
             MAX(completed_at) AS last_sync,
             SUM(CASE WHEN status='SUCCESS' THEN 1 ELSE 0 END) AS total_success,
             SUM(CASE WHEN status='ERROR'   THEN 1 ELSE 0 END) AS total_error
      FROM erp_sync_jobs
      GROUP BY type
      ORDER BY type
    `);

    // Ping catre ERP
    let erpConnection = { connected: false };
    try {
      erpConnection = await pluriva.ping();
    } catch {
      erpConnection = { connected: false, error: 'Timeout / unreachable' };
    }

    // PO-uri in asteptare
    const pendingPos = await db.query(
      `SELECT COUNT(*) FROM erp_po_mappings WHERE erp_status NOT IN ('DELIVERED','CANCELLED')`
    );

    res.json({
      success: true,
      erp_connection: erpConnection,
      demo_mode: pluriva.IS_DEMO,
      sync_interval_ms: parseInt(process.env.SYNC_INTERVAL || '300000'),
      pending_pos: parseInt(pendingPos.rows[0].count),
      by_type: result.rows,
    });
  } catch (err) {
    logger.error('getStatus error', { err: err.message });
    res.status(500).json({ error: 'Eroare interna' });
  }
};

exports.triggerSync = async (req, res) => {
  const { type = 'ALL' } = req.body;
  logger.info(`[SyncCtrl] Sync manual declansat: type=${type}`);

  // Fire-and-forget, nu bloca raspunsul
  setImmediate(async () => {
    try {
      if (type === 'PO_INBOUND' || type === 'ALL') await syncService.syncInboundPOs();
      if (type === 'NIR_OUTBOUND' || type === 'ALL') await syncService.syncOutboundNIRs();
      if (type === 'DELIVERY_OUTBOUND' || type === 'ALL') await syncService.syncOutboundDeliveries();
    } catch (err) {
      logger.error('[SyncCtrl] Eroare sync manual', { err: err.message });
    }
  });

  res.json({ success: true, message: `Sync ${type} pornit in fundal`, started_at: new Date().toISOString() });
};

exports.getJobs = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '50'), 200);
    const result = await db.query(
      `SELECT id, type, status, records_synced, error_msg, started_at, completed_at
       FROM erp_sync_jobs
       ORDER BY started_at DESC
       LIMIT $1`,
      [limit]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    logger.error('getJobs error', { err: err.message });
    res.status(500).json({ error: 'Eroare interna' });
  }
};

exports.getPOs = async (req, res) => {
  try {
    const { status, limit = 50, page = 1 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const params = [];
    let where = 'WHERE 1=1';
    if (status) {
      params.push(status);
      where += ` AND erp_status = $${params.length}`;
    }
    params.push(parseInt(limit), offset);
    const result = await db.query(
      `SELECT id, erp_po_id, supplier_name, supplier_code, erp_status,
              order_date, expected_delivery, created_at, updated_at
       FROM erp_po_mappings
       ${where}
       ORDER BY created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    const count = await db.query(
      `SELECT COUNT(*) FROM erp_po_mappings ${where}`,
      params.slice(0, params.length - 2)
    );
    res.json({
      success: true,
      data: result.rows,
      pagination: {
        total: parseInt(count.rows[0].count),
        page: parseInt(page),
        limit: parseInt(limit),
      },
    });
  } catch (err) {
    logger.error('getPOs error', { err: err.message });
    res.status(500).json({ error: 'Eroare interna' });
  }
};

exports.getWebhookLogs = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '50'), 200);
    const result = await db.query(
      `SELECT id, event_type, received_at,
              LEFT(payload::text, 500) AS payload_preview
       FROM erp_webhook_logs
       ORDER BY received_at DESC
       LIMIT $1`,
      [limit]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    logger.error('getWebhookLogs error', { err: err.message });
    res.status(500).json({ error: 'Eroare interna' });
  }
};
