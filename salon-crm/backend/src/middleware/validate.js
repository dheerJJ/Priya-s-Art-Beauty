'use strict';
const { validationResult } = require('express-validator');

/**
 * Middleware to handle express-validator validation errors.
 * Returns 422 with structured error list if validation fails.
 */
function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const formatted = errors.array().map((e) => ({
      field: e.path || e.param,
      message: e.msg,
    }));
    return res.status(422).json({
      success: false,
      message: 'Validation failed',
      errors: formatted,
    });
  }
  next();
}

module.exports = validate;
