'use strict';
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db/pool');

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

    // Generate JWT
    const token = jwt.sign(
      { userId: user.id, role: user.role, salonId: user.salon_id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    // Log login
    await pool.query(
      `INSERT INTO audit_logs (salon_id, user_id, action, entity_type, ip_address)
       VALUES ($1, $2, 'user_login', 'user', $3)`,
      [user.salon_id, user.id, req.ip]
    );

    return res.json({
      success: true,
      data: {
        token,
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

module.exports = { login, getMe, changePassword };
