const express = require('express');
const router = express.Router();

const { mintToken } = require('../controllers/devController');
const { validate } = require('../validators');
const Joi = require('joi');

const mintSchema = Joi.object({
  role: Joi.string().valid('admin', 'manager', 'user').default('admin'),
  id: Joi.string().guid({ version: 'uuidv4' }).optional(),
  email: Joi.string().email().optional(),
  expiresIn: Joi.string().pattern(/^[0-9]+(s|m|h|d)$/).optional()
});

router.post('/token', validate(mintSchema), mintToken);

module.exports = router;
