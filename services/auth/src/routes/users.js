const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/', authenticate, authorize(['admin']), userController.getAllUsers);
router.post('/', authenticate, authorize(['admin']), userController.createUser);
router.get('/:id', authenticate, userController.getUserById);
router.put('/:id', authenticate, userController.updateUser);
router.delete('/:id', authenticate, authorize(['admin']), userController.deleteUser);

module.exports = router;
