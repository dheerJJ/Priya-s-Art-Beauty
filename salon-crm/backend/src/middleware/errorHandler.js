'use strict';
const logger = require('../utils/logger');

/**
 * Global error handler middleware.
 * Must be the last middleware registered.
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || err.status || 500;

  logger.error('Unhandled error:', {
    message: err.message,
    stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined,
    path: req.path,
    method: req.method,
  });

  // Never expose internal details in production
  const message =
    statusCode < 500
      ? err.message
      : 'An internal server error occurred. Please try again.';

  return res.status(statusCode).json({
    success: false,
    message,
  });
}

/**
 * 404 handler
 */
function notFound(req, res) {
  return res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.path} not found`,
  });
}

module.exports = { errorHandler, notFound };
