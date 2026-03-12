const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const ImportController = require('../controllers/importController');
const stocCabluriController = require('../controllers/stocCabluriController');
const { authenticate, authorize } = require('../middleware/auth');

// Multer storage pentru upload CSV
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '..', '..', 'uploads');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, `stoc-${Date.now()}${path.extname(file.originalname)}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (path.extname(file.originalname).toLowerCase() === '.csv') cb(null, true);
    else cb(new Error('Doar fișiere CSV'));
  },
});

// Bulk import products and initial batches (JSON body)
router.post('/import-produse', ImportController.importProducts);

// ── Import stoc inițial cabluri ──────────────────────────────────────────────
// POST /api/v1/import-stoc-cabluri  → file upload CSV (Produs, Lot intrare, Cantitate)
router.post(
  '/import-stoc-cabluri',
  authenticate,
  authorize(['admin', 'manager']),
  upload.single('file'),
  (req, res, next) => stocCabluriController.importStocCabluri(req, res, next)
);

// POST /api/v1/import-stoc-cabluri/preview → JSON body rows[]
router.post(
  '/import-stoc-cabluri/preview',
  authenticate,
  authorize(['admin', 'manager']),
  (req, res, next) => stocCabluriController.preview(req, res, next)
);

module.exports = router;
