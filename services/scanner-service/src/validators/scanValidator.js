const Joi = require('joi');

const scanSchema = Joi.object({
  code: Joi.string().required().min(1).max(100),
  type: Joi.string().valid('BARCODE', 'QR_CODE', 'EAN13', 'CODE128', 'CODE39', 'UPC_A').required(),
  userId: Joi.number().integer().positive(),
  metadata: Joi.object({
    deviceId: Joi.string(),
    timestamp: Joi.date().iso(),
    location: Joi.object({
      latitude: Joi.number(),
      longitude: Joi.number(),
    }),
  }).optional(),
});

const validateScan = (req, res, next) => {
  const { error, value } = scanSchema.validate(req.body);

  if (error) {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: error.details.map(detail => detail.message),
    });
  }

  req.validatedData = value;
  next();
};

module.exports = { validateScan };
