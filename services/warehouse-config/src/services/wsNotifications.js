'use strict';
/**
 * wsNotifications.js — WebSocket Notification Server (Faza 6.3)
 *
 * Ataseaza un WebSocket server la serverul HTTP Express existent.
 * Autentificare: token JWT ca query param (?token=...) la conectare.
 * Emite periodic alertele dinamice catre toti clientii autentificati.
 *
 * Endpoint WS: ws://host:port/ws
 */

const { WebSocketServer } = require('ws');
const jwt = require('jsonwebtoken');
const logger = require('../config/logger');
const db = require('../config/database');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const BROADCAST_INTERVAL_MS = 30_000; // 30 secunde

/** Returneaza alertele dinamice (reutilizeaza logica din DynamicRulesController) */
async function computeAlerts() {
  const alerts = [];

  // ZONE_FULL_FALLBACK
  try {
    const result = await db.query(`
      SELECT
        wz.id AS zone_id,
        wz.zone_name,
        wz.zone_code,
        wz.warehouse_id,
        ROUND(
          100.0 * COUNT(CASE WHEN l.status != 'AVAILABLE' THEN 1 END)
                / NULLIF(COUNT(l.id), 0), 1
        ) AS occupancy_pct
      FROM warehouse_zones wz
      LEFT JOIN locations l ON l.zone_id = wz.id
      GROUP BY wz.id, wz.zone_name, wz.zone_code, wz.warehouse_id
      HAVING COUNT(l.id) > 0
        AND ROUND(100.0 * COUNT(CASE WHEN l.status != 'AVAILABLE' THEN 1 END) / NULLIF(COUNT(l.id), 0), 1) >= 85
      ORDER BY occupancy_pct DESC
      LIMIT 5
    `);
    for (const row of result.rows) {
      alerts.push({
        id: `ZONE_FULL_${row.zone_id}`,
        type: 'ZONE_FULL_FALLBACK',
        severity: row.occupancy_pct >= 95 ? 'CRITICAL' : 'WARNING',
        title: `Zonă plină: ${row.zone_name}`,
        message: `Zona ${row.zone_code} este ${row.occupancy_pct}% ocupată`,
        recommendation: 'Redistribuiți produsele în zone alternative',
        data: { zone_id: row.zone_id, zone_name: row.zone_name, occupancy_pct: row.occupancy_pct },
      });
    }
  } catch (err) {
    logger.warn('[WS] ZONE_FULL check failed:', err.message);
  }

  // LOT_EXPIRED_QUARANTINE
  try {
    const result = await db.query(`
      SELECT
        pb.id AS batch_id,
        pb.lot_number,
        p.name AS product_name,
        pb.expiry_date,
        EXTRACT(DAY FROM pb.expiry_date - NOW()) AS days_until_expiry
      FROM product_batches pb
      JOIN products p ON p.id = pb.product_id
      WHERE pb.expiry_date IS NOT NULL
        AND pb.status NOT IN ('QUARANTINE', 'CONSUMED', 'EXPIRED')
        AND pb.expiry_date <= NOW() + INTERVAL '30 days'
      ORDER BY pb.expiry_date ASC
      LIMIT 10
    `);
    for (const row of result.rows) {
      const days = Math.round(row.days_until_expiry);
      alerts.push({
        id: `LOT_EXP_${row.batch_id}`,
        type: 'LOT_EXPIRED_QUARANTINE',
        severity: days <= 0 ? 'CRITICAL' : days <= 7 ? 'WARNING' : 'INFO',
        title: days <= 0 ? `Lot expirat: ${row.lot_number}` : `Lot expiră în ${days} zile`,
        message: `${row.product_name} — lot ${row.lot_number}`,
        recommendation: days <= 0 ? 'Mutați lot în carantină imediat' : 'Prioritizați consumul acestui lot',
        data: { batch_id: row.batch_id, lot_number: row.lot_number, days_until_expiry: days },
      });
    }
  } catch (err) {
    logger.warn('[WS] LOT_EXPIRY check failed:', err.message);
  }

  return alerts;
}

/**
 * Initializeaza WebSocket server si il ataseaza la serverul HTTP existent.
 * @param {http.Server} httpServer
 */
function attachWebSocketServer(httpServer) {
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  // Map: ws -> { userId, role, alive }
  const clients = new Map();

  // ── Autentificare la conectare ──────────────────────────────────────────────
  wss.on('connection', (ws, req) => {
    const url = new URL(req.url, `http://localhost`);
    const token = url.searchParams.get('token');

    if (!token) {
      ws.close(4001, 'Missing token');
      return;
    }

    let payload;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch {
      ws.close(4003, 'Invalid token');
      return;
    }

    clients.set(ws, { userId: payload.id || payload.sub, role: payload.role, alive: true });
    logger.info(`[WS] Client conectat: user=${payload.id || payload.sub} role=${payload.role}`);

    // Trimite un mesaj de bun-venit cu ultimele alerte
    sendAlerts(ws);

    // Heartbeat — detecteaza clienti deconectati
    ws.on('pong', () => {
      const meta = clients.get(ws);
      if (meta) meta.alive = true;
    });

    ws.on('close', () => {
      clients.delete(ws);
      logger.info(`[WS] Client deconectat: user=${payload.id || payload.sub}`);
    });

    ws.on('error', (err) => {
      logger.warn('[WS] Eroare client:', err.message);
      clients.delete(ws);
    });
  });

  // ── Heartbeat interval (ping/pong) ─────────────────────────────────────────
  const heartbeat = setInterval(() => {
    for (const [ws, meta] of clients.entries()) {
      if (!meta.alive) {
        clients.delete(ws);
        ws.terminate();
        continue;
      }
      meta.alive = false;
      ws.ping();
    }
  }, 30_000);

  // ── Broadcast periodic alerte ───────────────────────────────────────────────
  const broadcast = setInterval(async () => {
    if (clients.size === 0) return;
    try {
      const alerts = await computeAlerts();
      const payload = JSON.stringify({ type: 'ALERTS_UPDATE', alerts, timestamp: new Date().toISOString() });
      for (const [ws] of clients.entries()) {
        if (ws.readyState === ws.OPEN) {
          ws.send(payload);
        }
      }
    } catch (err) {
      logger.error('[WS] Broadcast error:', err.message);
    }
  }, BROADCAST_INTERVAL_MS);

  // Cleanup la shutdown
  wss.on('close', () => {
    clearInterval(heartbeat);
    clearInterval(broadcast);
  });

  logger.info('[WS] WebSocket server atașat pe /ws');
  return wss;
}

/** Trimite alertele curente unui singur client */
async function sendAlerts(ws) {
  try {
    const alerts = await computeAlerts();
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({ type: 'ALERTS_UPDATE', alerts, timestamp: new Date().toISOString() }));
    }
  } catch (err) {
    logger.warn('[WS] sendAlerts error:', err.message);
  }
}

module.exports = { attachWebSocketServer };
