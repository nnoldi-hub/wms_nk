const express = require('express');
const router = express.Router();
const PalletController = require('../controllers/palletController');
const { authenticate } = require('../middleware/auth');

// All pallet routes require authentication
router.use(authenticate);

// Paleți cu spațiu liber pentru un produs (folosit la recepție/sugestii)
router.get('/available-space', PalletController.getAvailableSpace);

// ---- Configurare capacitate per produs (fix routes before /:id) ----
router.get('/config', PalletController.getConfigs);
router.post('/config', PalletController.upsertConfig);
router.delete('/config/:configId', PalletController.deleteConfig);

// Toate listele cu filtre
router.get('/', PalletController.getAllPallets);

// Un palet după ID (cu batches + mișcări)
router.get('/:id', PalletController.getPalletById);

// QR-ul unui palet
router.get('/:id/qr', PalletController.getPalletQR);

// Creare palet nou
router.post('/', PalletController.createPallet);

// Adaugă un batch pe palet (scan produs → palet)
router.post('/:id/add-batch', PalletController.addBatch);

// Plasează paletul la o locație (scan palet → scan locație)
router.post('/:id/place', PalletController.placePallet);

module.exports = router;
