'use strict';
/**
 * webhookController.js — Webhooks primite de la Pluriva ERP (Faza 7.3)
 *
 * POST /api/v1/webhooks/pluriva
 * Pluriva trimite evenimente la aceasta adresa la stari relevante.
 *
 * Evenimente suportate:
 *   PO_CONFIRMED    → actualizeaza statusul mapping-ului nostru
 *   PO_CANCELLED    → marcheaza PO anulat
 *   INVOICE_CREATED → logheaza, notifica managerul
 */

const db     = require('../config/database');
const logger = require('../config/logger');

const PLURIVA_WEBHOOK_SECRET = process.env.PLURIVA_WEBHOOK_SECRET || '';

exports.handlePlurива = async (req, res) => {
  try {
    // Validare semnatura (HMAC-SHA256) daca e configurat secret
    if (PLURIVA_WEBHOOK_SECRET) {
      const crypto = require('crypto');
      const sig = req.headers['x-pluriva-signature'] || '';
      const expected = crypto
        .createHmac('sha256', PLURIVA_WEBHOOK_SECRET)
        .update(JSON.stringify(req.body))
        .digest('hex');
      if (sig !== `sha256=${expected}`) {
        logger.warn('[Webhook] Semnatura invalida');
        return res.status(401).json({ error: 'Invalid signature' });
      }
    }

    const { event, data, timestamp } = req.body;

    if (!event || !data) {
      return res.status(400).json({ error: 'event si data sunt obligatorii' });
    }

    // Logeaza webhook-ul in DB
    await db.query(
      `INSERT INTO erp_webhook_logs (event_type, payload, received_at)
       VALUES ($1, $2, NOW())`,
      [event, JSON.stringify(req.body)]
    );

    logger.info(`[Webhook] Primit: ${event}`, { data });

    // Procesare per tip eveniment
    switch (event) {
      case 'PO_CONFIRMED':
        await db.query(
          `UPDATE erp_po_mappings SET erp_status='CONFIRMED', updated_at=NOW()
           WHERE erp_po_id=$1`,
          [data.po_id]
        );
        break;

      case 'PO_CANCELLED':
        await db.query(
          `UPDATE erp_po_mappings SET erp_status='CANCELLED', updated_at=NOW()
           WHERE erp_po_id=$1`,
          [data.po_id]
        );
        logger.warn(`[Webhook] PO anulat in ERP: ${data.po_id}`);
        break;

      case 'INVOICE_CREATED':
        logger.info(`[Webhook] Factura creata in ERP`, { invoice_id: data.invoice_id, po_id: data.po_id });
        // Trimitem notificare (opțional: via Redis pub/sub sau direct in DB)
        await db.query(
          `INSERT INTO erp_webhook_logs (event_type, payload, received_at, processed)
           VALUES ('INVOICE_NOTIFICATION', $1, NOW(), TRUE)
           ON CONFLICT DO NOTHING`,
          [JSON.stringify({ invoice_id: data.invoice_id, note: 'Factura creata in ERP' })]
        ).catch(() => {}); // ignoram daca tabela nu are aceasta coloana
        break;

      default:
        logger.warn(`[Webhook] Eveniment necunoscut: ${event}`);
    }

    res.json({ success: true, event, processed: true });
  } catch (err) {
    logger.error('[Webhook] Eroare procesare', { err: err.message });
    res.status(500).json({ error: 'Eroare interna' });
  }
};
