'use strict';

const express  = require('express');
const router   = express.Router();
const syncCtrl = require('../controllers/syncController');
const whCtrl   = require('../controllers/webhookController');

// ── Sync API ──────────────────────────────────────────────────────────────────
router.get('/sync/status',     syncCtrl.getStatus);
router.post('/sync/trigger',   syncCtrl.triggerSync);
router.get('/sync/jobs',       syncCtrl.getJobs);
router.get('/sync/pos',        syncCtrl.getPOs);
router.get('/webhooks/logs',   syncCtrl.getWebhookLogs);

// ── Webhook endpoint (public, semnat de Pluriva) ──────────────────────────────
router.post('/webhooks/pluriva', whCtrl.handlePlurива);

module.exports = router;
