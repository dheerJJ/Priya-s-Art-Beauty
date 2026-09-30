'use strict';
const request = require('supertest');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const app = require('../src/server');
const pool = require('../src/db/pool');
const { hashToken } = require('../src/services/tokenService');

describe('Refresh Token Authentication Test Suite', () => {
  const testEmail = 'refresh-test-admin@example.com';
  const testPassword = 'Password123!';
  let userId;
  let salonId;

  beforeAll(async () => {
    // Clean up any previous test state
    await pool.query('DELETE FROM users WHERE email = $1', [testEmail]);

    // Create test salon and admin user
    const salonRes = await pool.query(`
      INSERT INTO salons (name, invoice_prefix, currency, tax_rate)
      VALUES ('Refresh Test Salon', 'REF', 'INR', 0)
      RETURNING id
    `);
    salonId = salonRes.rows[0].id;

    const bcrypt = require('bcryptjs');
    const hash = await bcrypt.hash(testPassword, 12);

    const userRes = await pool.query(`
      INSERT INTO users (name, email, password_hash, role, salon_id, is_active)
      VALUES ('Refresh Admin', $1, $2, 'admin', $3, true)
      RETURNING id
    `, [testEmail, hash, salonId]);
    userId = userRes.rows[0].id;
  });

  afterAll(async () => {
    // Cleanup
    if (userId) {
      await pool.query('DELETE FROM refresh_tokens WHERE user_id = $1', [userId]);
      await pool.query('DELETE FROM users WHERE id = $1', [userId]);
    }
    if (salonId) {
      await pool.query('DELETE FROM salons WHERE id = $1', [salonId]);
    }
  });

  function extractCookie(res, cookieName = 'refreshToken') {
    const cookies = res.headers['set-cookie'];
    if (!cookies) return null;
    for (const cookie of cookies) {
      if (cookie.startsWith(`${cookieName}=`)) {
        return cookie.split(';')[0].split('=')[1];
      }
    }
    return null;
  }

  // 1. Refresh works and rotates the token
  it('should issue a 15-minute access token and an HttpOnly refresh cookie on login, and rotate upon refresh', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: testEmail, password: testPassword });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.success).toBe(true);
    expect(loginRes.body.data.token).toBeDefined();

    // Verify access token expiry is ~15 minutes
    const decoded = jwt.decode(loginRes.body.data.token);
    const durationMinutes = (decoded.exp - decoded.iat) / 60;
    expect(durationMinutes).toBe(15);

    // Verify refresh token cookie attributes
    const setCookie = loginRes.headers['set-cookie'];
    expect(setCookie).toBeDefined();
    const cookieHeader = Array.isArray(setCookie) ? setCookie.join('; ') : setCookie;
    expect(cookieHeader).toContain('refreshToken=');
    expect(cookieHeader.toLowerCase()).toContain('httponly');
    expect(cookieHeader.toLowerCase()).toContain('samesite=strict');
    expect(cookieHeader).toContain('Path=/api/auth');

    const initialRefreshToken = extractCookie(loginRes);
    expect(initialRefreshToken).toBeDefined();
    expect(initialRefreshToken.length).toBe(128); // 64 bytes in hex = 128 chars

    // Now call /api/auth/refresh with the cookie
    const refreshRes = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', [`refreshToken=${initialRefreshToken}`]);

    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body.success).toBe(true);
    expect(refreshRes.body.data.token).toBeDefined();

    // Verify a NEW rotated refresh token was set in cookie
    const rotatedRefreshToken = extractCookie(refreshRes);
    expect(rotatedRefreshToken).toBeDefined();
    expect(rotatedRefreshToken).not.toBe(initialRefreshToken);

    // Verify database record: old token must be marked revoked with replaced_by
    const oldHash = hashToken(initialRefreshToken);
    const newHash = hashToken(rotatedRefreshToken);

    const oldRecord = await pool.query('SELECT * FROM refresh_tokens WHERE token_hash = $1', [oldHash]);
    expect(oldRecord.rows.length).toBe(1);
    expect(oldRecord.rows[0].revoked_at).not.toBeNull();
    expect(oldRecord.rows[0].replaced_by).toBe(newHash);

    const newRecord = await pool.query('SELECT * FROM refresh_tokens WHERE token_hash = $1', [newHash]);
    expect(newRecord.rows.length).toBe(1);
    expect(newRecord.rows[0].revoked_at).toBeNull();
    expect(newRecord.rows[0].family_id).toBe(oldRecord.rows[0].family_id);
  });

  // 2. The old refresh token fails after rotation
  it('should reject an old refresh token that has already been rotated', async () => {
    // Perform fresh login
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: testEmail, password: testPassword });
    const token1 = extractCookie(loginRes);

    // Rotate token1 -> token2
    const refreshRes1 = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', [`refreshToken=${token1}`]);
    expect(refreshRes1.status).toBe(200);

    // Attempt to use token1 again: must fail
    const replayedRes = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', [`refreshToken=${token1}`]);

    expect([401, 403]).toContain(replayedRes.status);
    expect(replayedRes.body.success).toBe(false);
  });

  // 3. Reuse of an old token revokes the whole family
  it('should detect reuse of an old token and revoke the entire token family', async () => {
    // 1. Fresh login -> Token A
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: testEmail, password: testPassword });
    const tokenA = extractCookie(loginRes);

    // 2. Legitimate client rotates: Token A -> Token B
    const refreshRes1 = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', [`refreshToken=${tokenA}`]);
    const tokenB = extractCookie(refreshRes1);

    // 3. Attacker replays compromised Token A
    const attackRes = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', [`refreshToken=${tokenA}`]);

    expect(attackRes.status).toBe(403);
    expect(attackRes.body.reuseDetected).toBe(true);

    // 4. Now legitimate client tries to use Token B: MUST BE REVOKED!
    const legitSubsequentRes = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', [`refreshToken=${tokenB}`]);

    expect([401, 403]).toContain(legitSubsequentRes.status);
    expect(legitSubsequentRes.body.success).toBe(false);

    // 5. Verify all tokens in this family in the DB are revoked
    const hashB = hashToken(tokenB);
    const rowB = await pool.query('SELECT family_id FROM refresh_tokens WHERE token_hash = $1', [hashB]);
    const familyId = rowB.rows[0].family_id;

    const unrevoked = await pool.query(
      'SELECT COUNT(*)::int as count FROM refresh_tokens WHERE family_id = $1 AND revoked_at IS NULL',
      [familyId]
    );
    expect(unrevoked.rows[0].count).toBe(0);
  });

  // 4. Expired, revoked, and tampered tokens are rejected
  it('should reject tampered, expired, and absolute lifetime expired tokens', async () => {
    // Tampered token
    const tamperedRes = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', ['refreshToken=bad_tampered_token_value_xyz123']);
    expect(tamperedRes.status).toBe(401);
    expect(tamperedRes.body.success).toBe(false);

    // Expired token (inactivity expiry)
    const rawExpired = crypto.randomBytes(64).toString('hex');
    const hashExpired = hashToken(rawExpired);

    await pool.query(`
      INSERT INTO refresh_tokens (
        user_id, token_hash, family_id, family_expires_at, expires_at
      ) VALUES ($1, $2, $3, NOW() + INTERVAL '90 days', NOW() - INTERVAL '1 hour')
    `, [userId, hashExpired, crypto.randomUUID()]);

    const expiredRes = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', [`refreshToken=${rawExpired}`]);
    expect(expiredRes.status).toBe(401);
    expect(expiredRes.body.message).toContain('expired');

    // Absolute 90-day lifetime expired token
    const rawAbsExpired = crypto.randomBytes(64).toString('hex');
    const hashAbsExpired = hashToken(rawAbsExpired);

    await pool.query(`
      INSERT INTO refresh_tokens (
        user_id, token_hash, family_id, family_expires_at, expires_at
      ) VALUES ($1, $2, $3, NOW() - INTERVAL '1 second', NOW() + INTERVAL '30 days')
    `, [userId, hashAbsExpired, crypto.randomUUID()]);

    const absExpiredRes = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', [`refreshToken=${rawAbsExpired}`]);
    expect(absExpiredRes.status).toBe(401);
    expect(absExpiredRes.body.message).toContain('Maximum session duration');
  });

  // 5. Logout invalidates the refresh token
  it('should revoke refresh token on logout and clear cookie', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: testEmail, password: testPassword });
    const token = extractCookie(loginRes);

    const logoutRes = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', [`refreshToken=${token}`]);

    expect(logoutRes.status).toBe(200);
    expect(logoutRes.body.success).toBe(true);

    // Verify token is revoked in DB
    const thash = hashToken(token);
    const dbRecord = await pool.query('SELECT revoked_at FROM refresh_tokens WHERE token_hash = $1', [thash]);
    expect(dbRecord.rows[0].revoked_at).not.toBeNull();

    // Verify subsequent refresh with this token fails
    const refreshRes = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', [`refreshToken=${token}`]);

    expect([401, 403]).toContain(refreshRes.status);
  });

  // 6. Logout all devices revokes all tokens for the user
  it('should revoke all refresh tokens for a user when sign out all devices is called', async () => {
    // Create 3 sessions
    const s1 = await request(app).post('/api/auth/login').send({ email: testEmail, password: testPassword });
    const s2 = await request(app).post('/api/auth/login').send({ email: testEmail, password: testPassword });
    const s3 = await request(app).post('/api/auth/login').send({ email: testEmail, password: testPassword });

    const t1 = extractCookie(s1);
    const t2 = extractCookie(s2);
    const accessToken = s3.body.data.token;

    // Call /api/auth/logout-all
    const logoutAllRes = await request(app)
      .post('/api/auth/logout-all')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(logoutAllRes.status).toBe(200);

    // Verify active count is 0
    const activeRes = await pool.query(
      'SELECT COUNT(*)::int as count FROM refresh_tokens WHERE user_id = $1 AND revoked_at IS NULL',
      [userId]
    );
    expect(activeRes.rows[0].count).toBe(0);

    // Both t1 and t2 must fail now
    const r1 = await request(app).post('/api/auth/refresh').set('Cookie', [`refreshToken=${t1}`]);
    const r2 = await request(app).post('/api/auth/refresh').set('Cookie', [`refreshToken=${t2}`]);

    expect([401, 403]).toContain(r1.status);
    expect([401, 403]).toContain(r2.status);
  });

  // 7. Password change revokes all active refresh tokens
  it('should revoke all refresh tokens for a user upon password change', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: testEmail, password: testPassword });
    const token = extractCookie(loginRes);
    const accessToken = loginRes.body.data.token;

    const newPass = 'NewSecurePass999!';
    const changeRes = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ currentPassword: testPassword, newPassword: newPass });

    expect(changeRes.status).toBe(200);

    // Refresh token should now be revoked
    const refreshRes = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', [`refreshToken=${token}`]);

    expect([401, 403]).toContain(refreshRes.status);

    // Reset password back for teardown
    const bcrypt = require('bcryptjs');
    const hash = await bcrypt.hash(testPassword, 12);
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, userId]);
  });

  // 8. Security leak test: no refresh token or secret appears in responses or bundle
  it('should never expose raw refresh tokens, token hashes, or JWT secrets in API response bodies', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: testEmail, password: testPassword });

    const rawToken = extractCookie(loginRes);
    const bodyStr = JSON.stringify(loginRes.body);

    expect(bodyStr).not.toContain(rawToken);
    expect(bodyStr).not.toContain(hashToken(rawToken));
    expect(bodyStr).not.toContain('jwt_access_secret');
    expect(bodyStr).not.toContain('jwt_secret');

    const refreshRes = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', [`refreshToken=${rawToken}`]);

    const refreshBodyStr = JSON.stringify(refreshRes.body);
    const newRawToken = extractCookie(refreshRes);

    expect(refreshBodyStr).not.toContain(newRawToken);
    expect(refreshBodyStr).not.toContain(hashToken(newRawToken));
  });

  it('should confirm no JWT secrets or refresh tokens exist in frontend production assets', () => {
    const distDir = path.resolve(__dirname, '../../frontend/dist/assets');
    if (fs.existsSync(distDir)) {
      const files = fs.readdirSync(distDir);
      for (const file of files) {
        if (file.endsWith('.js') || file.endsWith('.css')) {
          const content = fs.readFileSync(path.join(distDir, file), 'utf8');
          expect(content).not.toContain('JWT_ACCESS_SECRET');
          expect(content).not.toContain('JWT_SECRET');
          expect(content).not.toContain('refresh_tokens');
        }
      }
    }
  });
});
