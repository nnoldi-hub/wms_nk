const logger = require('../config/logger');

const errorHandler = (err, req, res, next) => {
  logger.error('Error:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    body: req.body,
    user: req.user?.id,
    code: err.code
  });

  // Joi validation error
  if (err.isJoi) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation error',
        details: err.details?.map(d => d.message)
      }
    });
  }

  // Database constraint error (Postgres 23xxx)
  if (err.code && String(err.code).startsWith('23')) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'DB_CONSTRAINT',
        message: 'Database constraint violation',
        details: err.detail || err.message
      }
    });
  }

  // Default error
  res.status(err.status || 500).json({
    success: false,
    error: {
      code: err.code || 'INTERNAL_ERROR',
      message: err.message || 'Internal server error',
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    }
  });
};

const notFound = (req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'Route not found',
      details: { path: req.path }
    }
  });
};

module.exports = {
  errorHandler,
  notFound
};
