const Joi = require('joi');

const validateRequest = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body, { abortEarly: false });
    
    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));
      
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors
      });
    }
    
    next();
  };
};

// Product validation schemas
const createProductSchema = Joi.object({
  sku: Joi.string().required().max(100),
  name: Joi.string().required().max(255),
  description: Joi.string().allow('').max(1000),
  uom: Joi.string().max(20).default('m'),
  lot_control: Joi.boolean().default(false),
  weight_kg: Joi.number().min(0).allow(null),
  length_cm: Joi.number().min(0).allow(null),
  width_cm: Joi.number().min(0).allow(null),
  height_cm: Joi.number().min(0).allow(null)
});

const updateProductSchema = Joi.object({
  name: Joi.string().max(255),
  description: Joi.string().allow('').max(1000),
  uom: Joi.string().max(20),
  lot_control: Joi.boolean(),
  weight_kg: Joi.number().min(0).allow(null),
  length_cm: Joi.number().min(0).allow(null),
  width_cm: Joi.number().min(0).allow(null),
  height_cm: Joi.number().min(0).allow(null)
}).min(1);

// Location validation schemas
const createLocationSchema = Joi.object({
  id: Joi.string().required().max(50),
  zone: Joi.string().max(50).allow('', null),
  rack: Joi.string().max(50).allow('', null),
  position: Joi.string().max(50).allow('', null),
  allowed_types: Joi.array().items(Joi.string()).allow(null),
  capacity_m3: Joi.number().min(0).allow(null)
});

// Movement validation schemas
const createMovementSchema = Joi.object({
  product_sku: Joi.string().required().max(100),
  from_location: Joi.string().max(50).allow(null, ''),
  to_location: Joi.string().max(50).allow(null, ''),
  quantity: Joi.number().min(0.001).required(),
  lot_number: Joi.string().max(100).allow(null, ''),
  notes: Joi.string().max(1000).allow('', null),
  movement_type: Joi.string().valid('TRANSFER', 'INBOUND', 'OUTBOUND', 'ADJUSTMENT').default('TRANSFER')
}).custom((value, helpers) => {
  if (!value.from_location && !value.to_location) {
    return helpers.error('any.required', {
      message: 'At least one of from_location or to_location must be provided'
    });
  }
  return value;
});

const adjustInventorySchema = Joi.object({
  product_sku: Joi.string().required().max(100),
  location_id: Joi.string().required().max(50),
  new_quantity: Joi.number().min(0).required(),
  lot_number: Joi.string().max(100).allow(null, ''),
  reason: Joi.string().required().max(255),
  notes: Joi.string().max(1000).allow('', null)
});

module.exports = {
  validateRequest,
  createProductSchema,
  updateProductSchema,
  createLocationSchema,
  createMovementSchema,
  adjustInventorySchema
};
