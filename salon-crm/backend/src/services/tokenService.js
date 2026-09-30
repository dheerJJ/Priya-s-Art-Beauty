'use strict';
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const pool = require('../db/pool');
const logger = require('../utils/logger');

const ACCESS_TOKEN_SECRET = () => process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET;
const ACCESS_TOKEN_EXPIRY = () => process.env.JWT_ACCESS_EXPIRY || '15m';
const REFRESH_EXPIRY_DAYS = () => parseInt(process.env.REFRESH_TOKEN_EXPIRY_DAYS || '30', 10);
const ABSOLUTE_SESSION_DAYS = () => parseInt(process.env.ABSOLUTE_SESSION_EXPIRY_DAYS || '90', 10);

/**
 * Generate a short-lived access JWT (15-minute default).
 */
function generateAccessToken(payload) {
  return jwt.sign(
    {
      userId: payload.userId || payload.id,
      role: payload.role,
      salonId: payload.salonId || payload.salon_id,
    },
    ACCESS_TOKEN_SECRET(),
    { expiresIn: ACCESS_TOKEN_EXPIRY() }
  );
}

/**
 * Verify an access JWT.
 */
function verifyAccessToken(token) {
  return jwt.verify(token, ACCESS_TOKEN_SECRET());
}

/**
 * Hash a raw refresh token using SHA-256 before storage or lookup.
 */
function hashToken(rawToken) {
  return crypto.createHash('sha256').update(String(rawToken)).digest('hex');
}

/**
 * Generate a cryptographically secure 64-byte random refresh token.
 */
function generateRawRefreshToken() {
  return crypto.randomBytes(64).toString('hex');
}

/**
 * Create a new refresh token family for a user upon login or registration.
 */
async function createRefreshTokenFamily(userId, { userAgent = null, ip = null } = {}, client = pool) {
  const rawToken = generateRawRefreshToken();
  const tokenHash = hashToken(rawToken);
  const familyId = uuidv4();

  const familyExpiresAt = new Date(Date.now() + ABSOLUTE_SESSION_DAYS() * 24 * 60 * 60 * 1000);
  const expiresAt = new Date(Date.now() + REFRESH_EXPIRY_DAYS() * 24 * 60 * 60 * 1000);

  await client.query(`
    INSERT INTO refresh_tokens (
      user_id, token_hash, family_id, family_expires_at, expires_at, user_agent, ip
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
  `, [userId, tokenHash, familyId, familyExpiresAt, expiresAt, userAgent, ip]);

  return {
    rawToken,
    familyId,
    expiresAt,
    familyExpiresAt,
  };
}

/**
 * Rotate a refresh token:
 * - Validates hash, expiry, and revocation status
 * - Detects reuse: if an already revoked/used token is presented, revokes the entire family
 * - Enforces absolute session lifetime of 90 days from original login
 * - Issues a new rotated refresh token in the same family and invalidates the old one
 */
async function rotateRefreshToken(rawToken, { userAgent = null, ip = null } = {}) {
  if (!rawToken || typeof rawToken !== 'string') {
    return { success: false, status: 401, message: 'Refresh token is required' };
  }

  const tokenHash = hashToken(rawToken);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Lock the token row to serialize concurrent rotation attempts
    const result = await client.query(`
      SELECT id, user_id, token_hash, family_id, family_expires_at, expires_at, revoked_at, replaced_by
      FROM refresh_tokens
      WHERE token_hash = $1
      FOR UPDATE
    `, [tokenHash]);

    const tokenRecord = result.rows[0];

    // Case 1: Token not found
    if (!tokenRecord) {
      await client.query('ROLLBACK');
      return { success: false, status: 401, message: 'Invalid refresh token' };
    }

    // Case 2: REUSE DETECTED! Token has already been used or revoked.
    if (tokenRecord.revoked_at !== null) {
      // Invalidate the entire family to protect the user against token theft
      await client.query(`
        UPDATE refresh_tokens
        SET revoked_at = NOW()
        WHERE family_id = $1 AND revoked_at IS NULL
      `, [tokenRecord.family_id]);

      await client.query('COMMIT');

      logger.warn('SECURITY ALERT: Refresh token reuse detected! Revoked token family.', {
        userId: tokenRecord.user_id,
        familyId: tokenRecord.family_id,
        ip,
        userAgent,
      });

      return {
        success: false,
        status: 403,
        reuseDetected: true,
        message: 'Security violation: Refresh token reuse detected. All sessions in this group have been terminated. Please log in again.',
      };
    }

    const now = new Date();

    // Case 3: Absolute session lifetime exceeded (90 days from initial login)
    if (new Date(tokenRecord.family_expires_at) <= now) {
      await client.query(`
        UPDATE refresh_tokens
        SET revoked_at = NOW()
        WHERE family_id = $1 AND revoked_at IS NULL
      `, [tokenRecord.family_id]);

      await client.query('COMMIT');
      return {
        success: false,
        status: 401,
        message: 'Maximum session duration reached (90 days). Please log in again.',
      };
    }

    // Case 4: Token inactivity expiry exceeded
    if (new Date(tokenRecord.expires_at) <= now) {
      await client.query(`
        UPDATE refresh_tokens
        SET revoked_at = NOW()
        WHERE id = $1
      `, [tokenRecord.id]);

      await client.query('COMMIT');
      return {
        success: false,
        status: 401,
        message: 'Refresh token has expired due to inactivity. Please log in again.',
      };
    }

    // Case 5: Verify user account is still active and exists
    const userRes = await client.query(`
      SELECT u.id, u.name, u.email, u.role, u.is_active, u.salon_id, s.name as salon_name
      FROM users u
      LEFT JOIN salons s ON u.salon_id = s.id
      WHERE u.id = $1
    `, [tokenRecord.user_id]);

    const user = userRes.rows[0];
    if (!user || !user.is_active) {
      await client.query(`
        UPDATE refresh_tokens
        SET revoked_at = NOW()
        WHERE user_id = $1 AND revoked_at IS NULL
      `, [tokenRecord.user_id]);

      await client.query('COMMIT');
      return {
        success: false,
        status: 401,
        message: 'Account is deactivated or not found.',
      };
    }

    // Issue new rotated refresh token within the same family and same family_expires_at
    const newRawToken = generateRawRefreshToken();
    const newTokenHash = hashToken(newRawToken);
    const newExpiresAt = new Date(Date.now() + REFRESH_EXPIRY_DAYS() * 24 * 60 * 60 * 1000);

    // Mark current token as revoked and replaced
    await client.query(`
      UPDATE refresh_tokens
      SET revoked_at = NOW(), replaced_by = $1
      WHERE id = $2
    `, [newTokenHash, tokenRecord.id]);

    // Insert new rotated token
    await client.query(`
      INSERT INTO refresh_tokens (
        user_id, token_hash, family_id, family_expires_at, expires_at, user_agent, ip
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      user.id,
      newTokenHash,
      tokenRecord.family_id,
      tokenRecord.family_expires_at,
      newExpiresAt,
      userAgent,
      ip,
    ]);

    await client.query('COMMIT');

    // Generate new access token
    const newAccessToken = generateAccessToken(user);

    return {
      success: true,
      accessToken: newAccessToken,
      newRawToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        salon_id: user.salon_id,
        salon_name: user.salon_name,
      },
    };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    logger.error('Error rotating refresh token:', { error: err.message });
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Revoke a single refresh token by raw value.
 */
async function revokeRefreshToken(rawToken) {
  if (!rawToken) return;
  const tokenHash = hashToken(rawToken);
  await pool.query(`
    UPDATE refresh_tokens
    SET revoked_at = NOW()
    WHERE token_hash = $1 AND revoked_at IS NULL
  `, [tokenHash]);
}

/**
 * Revoke all active refresh tokens for a user (sign out all devices / password change / deactivate).
 */
async function revokeAllUserTokens(userId) {
  if (!userId) return;
  await pool.query(`
    UPDATE refresh_tokens
    SET revoked_at = NOW()
    WHERE user_id = $1 AND revoked_at IS NULL
  `, [userId]);
}

/**
 * Cookie options helper.
 */
function getCookieOptions() {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: 'strict',
    path: '/api/auth',
    maxAge: ABSOLUTE_SESSION_DAYS() * 24 * 60 * 60 * 1000,
  };
}

function setRefreshTokenCookie(res, rawToken) {
  res.cookie('refreshToken', rawToken, getCookieOptions());
}

function clearRefreshTokenCookie(res) {
  const options = getCookieOptions();
  delete options.maxAge;
  res.clearCookie('refreshToken', options);
}

module.exports = {
  generateAccessToken,
  verifyAccessToken,
  hashToken,
  createRefreshTokenFamily,
  rotateRefreshToken,
  revokeRefreshToken,
  revokeAllUserTokens,
  setRefreshTokenCookie,
  clearRefreshTokenCookie,
};
