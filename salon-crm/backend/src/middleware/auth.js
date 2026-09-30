'use strict';
const jwt = require('jsonwebtoken');
const pool = require('../db/pool');
const logger = require('../utils/logger');
const { verifyAccessToken } = require('../services/tokenService');

/**
 * Authenticate requests using Bearer JWT token.
 */
async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const token = authHeader.slice(7);
    let decoded;
    try {
      decoded = verifyAccessToken(token);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ success: false, message: 'Session expired, please login again' });
      }
      return res.status(401).json({ success: false, message: 'Invalid authentication token' });
    }

    // Fetch user from DB to ensure account is still active
    const result = await pool.query(
      'SELECT id, name, email, role, salon_id, is_active FROM users WHERE id = $1',
      [decoded.userId]
    );

    const user = result.rows[0];
    if (!user || !user.is_active) {
      return res.status(401).json({ success: false, message: 'Account not found or deactivated' });
    }

    req.user = user;
    req.salonId = user.salon_id;
    next();
  } catch (err) {
    logger.error('Auth middleware error:', { error: err.message });
    return res.status(500).json({ success: false, message: 'Authentication error' });
  }
}

/**
 * Require a specific role (or array of roles).
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Insufficient permissions' });
    }
    next();
  };
}

module.exports = { authenticate, requireRole };
