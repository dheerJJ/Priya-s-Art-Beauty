'use strict';
const bcrypt = require('bcryptjs');
const pool = require('../db/pool');
const {
  generateAccessToken,
  createRefreshTokenFamily,
  rotateRefreshToken,
  revokeRefreshToken,
  revokeAllUserTokens,
  setRefreshTokenCookie,
  clearRefreshTokenCookie,
} = require('../services/tokenService');

/**
 * POST /api/auth/login
 */
async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    // Fetch user
    const result = await pool.query(
      `SELECT u.id, u.name, u.email, u.password_hash, u.role, u.is_active, u.salon_id,
              s.name as salon_name
       FROM users u
       LEFT JOIN salons s ON s.id = u.salon_id
       WHERE u.email = $1`,
      [email.toLowerCase().trim()]
    );

    const user = result.rows[0];

    // Use constant-time comparison even if user not found (prevent timing attacks)
    const dummyHash = '$2a$12$e80yZ1/X/VnN96rX6tAeu.vC0t6d5Ew4Y.a5Q6r7S8T9U0V1W2X3Y';
    const passwordMatch = await bcrypt.compare(
      password,
      user ? user.password_hash : dummyHash
    );

    if (!user || !passwordMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    if (!user.is_active) {
      return res.status(401).json({ success: false, message: 'Account is deactivated' });
    }

    // Generate 15-minute access JWT
    const accessToken = generateAccessToken(user);

    // Create cryptographically secure refresh token family
    const refreshTokenData = await createRefreshTokenFamily(user.id, {
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    });

    // Deliver refresh token via HttpOnly, Secure, SameSite=Strict cookie
    setRefreshTokenCookie(res, refreshTokenData.rawToken);

    // Log login
    await pool.query(
      `INSERT INTO audit_logs (salon_id, user_id, action, entity_type, ip_address)
       VALUES ($1, $2, 'user_login', 'user', $3)`,
      [user.salon_id, user.id, req.ip]
    );

    return res.json({
      success: true,
      data: {
        token: accessToken,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          salon_id: user.salon_id,
          salon_name: user.salon_name,
        },
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/auth/refresh
 * Validates, rotates refresh token, and returns fresh access token.
 */
async function refreshToken(req, res, next) {
  try {
    const rawToken = req.cookies?.refreshToken || req.body?.refreshToken;

    if (!rawToken) {
      return res.status(401).json({
        success: false,
        message: 'No refresh token provided',
      });
    }

    const rotationResult = await rotateRefreshToken(rawToken, {
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    });

    if (!rotationResult.success) {
      clearRefreshTokenCookie(res);
      return res.status(rotationResult.status || 401).json({
        success: false,
        message: rotationResult.message,
        reuseDetected: rotationResult.reuseDetected || false,
      });
    }

    // Set rotated refresh token in HttpOnly cookie
    setRefreshTokenCookie(res, rotationResult.newRawToken);

    return res.json({
      success: true,
      data: {
        token: rotationResult.accessToken,
        user: rotationResult.user,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/auth/logout
 * Revokes the presented refresh token and clears cookie.
 */
async function logout(req, res, next) {
  try {
    const rawToken = req.cookies?.refreshToken || req.body?.refreshToken;
    if (rawToken) {
      await revokeRefreshToken(rawToken);
    }

    clearRefreshTokenCookie(res);
    return res.json({ success: true, message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/auth/logout-all
 * Revokes all refresh tokens for the authenticated user (sign out all devices).
 */
async function logoutAll(req, res, next) {
  try {
    await revokeAllUserTokens(req.user.id);
    clearRefreshTokenCookie(res);
    return res.json({ success: true, message: 'All devices signed out successfully' });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/auth/me
 */
async function getMe(req, res) {
  const result = await pool.query(
    `SELECT u.id, u.name, u.email, u.role, u.salon_id, u.created_at,
            s.name as salon_name, s.address as salon_address, s.phone as salon_phone
     FROM users u
     LEFT JOIN salons s ON s.id = u.salon_id
     WHERE u.id = $1`,
    [req.user.id]
  );

  return res.json({ success: true, data: result.rows[0] });
}

/**
 * POST /api/auth/change-password
 */
async function changePassword(req, res, next) {
  try {
    const { currentPassword, newPassword } = req.body;

    const result = await pool.query(
      'SELECT password_hash FROM users WHERE id = $1',
      [req.user.id]
    );
    const user = result.rows[0];

    const valid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!valid) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect' });
    }

    const newHash = await bcrypt.hash(newPassword, 12);
    await pool.query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [newHash, req.user.id]
    );

    // Revoke all active sessions on password change
    await revokeAllUserTokens(req.user.id);
    clearRefreshTokenCookie(res);

    await pool.query(
      `INSERT INTO audit_logs (salon_id, user_id, action, entity_type, entity_id)
       VALUES ($1, $2, 'password_changed', 'user', $2)`,
      [req.user.salon_id, req.user.id]
    );

    return res.json({ success: true, message: 'Password changed successfully' });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/auth/register
 * Admin registration with new salon creation.
 */
async function register(req, res, next) {
  const client = await pool.connect();
  try {
    const { name, email, password, salonName, phone } = req.body;
    const cleanEmail = email.toLowerCase().trim();

    // Check if email already in use
    const existing = await client.query('SELECT id FROM users WHERE email = $1', [cleanEmail]);
    if (existing.rows.length > 0) {
      client.release();
      return res.status(409).json({ success: false, message: 'An account with this email already exists' });
    }

    await client.query('BEGIN');

    // 1. Generate an invoice prefix from the salon name (default to Priya's Art Beauty & Makeup Academy)
    const effectiveSalonName = (salonName && salonName.trim()) ? salonName.trim() : "Priya's Art Beauty & Makeup Academy";
    const rawPrefix = (salonName || 'PRIYA').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    const invoicePrefix = rawPrefix.slice(0, 6) || 'PRIYA';

    // 2. Insert new salon
    const salonResult = await client.query(`
      INSERT INTO salons (name, phone, email, invoice_prefix, currency, tax_rate)
      VALUES ($1, $2, $3, $4, 'INR', 0)
      RETURNING id, name, invoice_prefix, currency
    `, [effectiveSalonName, phone ? phone.trim() : null, cleanEmail, invoicePrefix]);

    const salon = salonResult.rows[0];

    // 3. Hash password with bcrypt
    const hash = await bcrypt.hash(password, 12);

    // 4. Create admin user
    const userResult = await client.query(`
      INSERT INTO users (name, email, password_hash, role, salon_id, is_active)
      VALUES ($1, $2, $3, 'admin', $4, true)
      RETURNING id, name, email, role, salon_id, created_at
    `, [name.trim(), cleanEmail, hash, salon.id]);

    const user = userResult.rows[0];

    // 5. Initialize invoice sequence
    await client.query(`
      INSERT INTO invoice_sequences (salon_id, year, last_seq)
      VALUES ($1, EXTRACT(YEAR FROM NOW())::INT, 0)
      ON CONFLICT (salon_id) DO NOTHING
    `, [salon.id]);

    // 6. Record audit log
    await client.query(`
      INSERT INTO audit_logs (salon_id, user_id, action, entity_type, ip_address)
      VALUES ($1, $2, 'admin_registered', 'user', $3)
    `, [salon.id, user.id, req.ip]);

    // 7. Create refresh token family within transaction
    const refreshTokenData = await createRefreshTokenFamily(user.id, {
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    }, client);

    await client.query('COMMIT');

    // Generate 15-minute access JWT
    const accessToken = generateAccessToken(user);

    // Deliver refresh token via cookie
    setRefreshTokenCookie(res, refreshTokenData.rawToken);

    return res.status(201).json({
      success: true,
      message: 'Admin account and salon created successfully',
      data: {
        token: accessToken,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          salon_id: user.salon_id,
          salon_name: salon.name,
        },
      },
    });
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) { /* ignore rollback error */ }
    if (err.code === '23505') {
      return res.status(409).json({ success: false, message: 'An account with this email already exists' });
    }
    next(err);
  } finally {
    try { client.release(); } catch (_) { /* ignore already released */ }
  }
}

module.exports = {
  login,
  register,
  getMe,
  changePassword,
  refreshToken,
  logout,
  logoutAll,
};
