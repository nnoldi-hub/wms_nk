const logger = require('../utils/logger');

class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

const errorHandler = (err, req, res, next) => {
  logger.error('Error:', { message: err.message, stack: err.stack });
  res.status(err.statusCode || 500).json({ error: err.message || 'Internal Server Error' });
};

module.exports = { AppError, errorHandler };
