'use strict';
const request = require('supertest');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const app = require('../src/server');
const pool = require('../src/db/pool');
const { getSafePDFPath } = require('../src/services/pdfService');

describe('Security Hardening Test Suite', () => {

  describe('A. Security HTTP Headers', () => {
    it('should include essential defensive security headers and strip X-Powered-By', async () => {
      const res = await request(app).get('/api/health');

      expect(res.headers['x-powered-by']).toBeUndefined();
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-frame-options']).toBe('DENY');
      expect(res.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
      expect(res.headers['content-security-policy']).toBeDefined();
      expect(res.headers['content-security-policy']).toContain("frame-ancestors 'none'");
    });
  });

  describe('B. Public Invoices Static Route Decommissioning', () => {
    it('should not serve /invoices publicly without authentication', async () => {
      const res = await request(app).get('/invoices/invoice-PRIYA-2026-000001.pdf');
      expect(res.status).toBe(404);
    });
  });

  describe('C. CORS Origin Enforcement', () => {
    it('should allow approved origins', async () => {
      const res = await request(app)
        .get('/api/health')
        .set('Origin', 'http://localhost:3000');

      expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    });

    it('should not reflect unapproved origins', async () => {
      const res = await request(app)
        .get('/api/health')
        .set('Origin', 'http://malicious-site.com');

      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });
  });

  describe('D. Path Traversal Defense in Storage & PDF Service', () => {
    it('should sanitize traversal characters and block escape outside storage directory', () => {
      expect(getSafePDFPath('../../etc/passwd')).toBeNull();
      expect(getSafePDFPath('../../../windows/win.ini')).toBeNull();
      expect(getSafePDFPath(null)).toBeNull();
      expect(getSafePDFPath('')).toBeNull();
    });
  });

  describe('E. Authentication & Authorization Enforcement', () => {
    it('should reject unauthenticated access to /api/bills with 401', async () => {
      const res = await request(app).get('/api/bills');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should reject unauthenticated access to /api/customers with 401', async () => {
      const res = await request(app).get('/api/customers');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should reject invalid bearer token with 401', async () => {
      const res = await request(app)
        .get('/api/bills')
        .set('Authorization', 'Bearer invalid-token-sample');

      expect(res.status).toBe(401);
      expect(res.body.message).toContain('Invalid authentication token');
    });
  });

  describe('F. Input Validation & Parameter Sanitization', () => {
    it('should reject invalid email format during login with 422', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'not-an-email', password: 'password123' });

      expect(res.status).toBe(422);
      expect(res.body.errors).toBeDefined();
    });

    it('should reject empty credentials during login with 422', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: '', password: '' });

      expect(res.status).toBe(422);
    });

    it('should reject admin registration with short password with 422', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Test Admin',
          email: 'admin@test.com',
          password: 'short',
        });

      expect(res.status).toBe(422);
      expect(res.body.errors).toBeDefined();
    });

    it('should reject admin registration with invalid email format with 422', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Test Admin',
          email: 'invalid-email-format',
          password: 'SecurePassword123',
        });

      expect(res.status).toBe(422);
      expect(res.body.errors).toBeDefined();
    });

    it('should neutralize SQL injection payloads during admin registration', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: "Admin'; DROP TABLE users; --",
          email: 'sql-test@example.com',
          password: 'SecurePassword123',
          phone: "919876543210' OR '1'='1",
        });

      // Handled safely via parameterized queries without SQL syntax error or 500
      expect(res.status).not.toBe(500);
      if (res.status === 201) {
        expect(res.body.success).toBe(true);
        expect(res.body.data.token).toBeDefined();
      }
    });

    it('should prevent duplicate email registration with HTTP 409', async () => {
      const dupEmail = 'duplicate-admin@example.com';
      // First registration
      const res1 = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'First Admin',
          email: dupEmail,
          password: 'SecurePassword123',
        });
      expect([201, 409]).toContain(res1.status);

      // Attempt second registration with same email
      const res2 = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Second Admin',
          email: dupEmail,
          password: 'SecurePassword123',
        });

      expect(res2.status).toBe(409);
      expect(res2.body.success).toBe(false);
      expect(res2.body.message).toContain('already exists');
    });
  });

  describe('G. Webhook HMAC Signature Validation', () => {
    it('should handle mismatched length signatures safely without throwing RangeError', async () => {
      process.env.META_APP_SECRET = 'test_secret_for_audit';

      const res = await request(app)
        .post('/api/webhooks/whatsapp')
        .set('x-hub-signature-256', 'sha256=tooshort')
        .send({ object: 'whatsapp_business_account' });

      // Immediate 200 returned to Meta, internal rejection safely logged without crash
      expect(res.status).toBe(200);
    });

    it('should verify webhook challenge on correct token', async () => {
      process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN = 'test_verify_token';

      const res = await request(app)
        .get('/api/webhooks/whatsapp')
        .query({
          'hub.mode': 'subscribe',
          'hub.verify_token': 'test_verify_token',
          'hub.challenge': 'challenge_code_123',
        });

      expect(res.status).toBe(200);
      expect(res.text).toBe('challenge_code_123');
    });

    it('should reject webhook challenge on incorrect token with 403', async () => {
      process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN = 'test_verify_token';

      const res = await request(app)
        .get('/api/webhooks/whatsapp')
        .query({
          'hub.mode': 'subscribe',
          'hub.verify_token': 'wrong_token',
          'hub.challenge': 'challenge_code_123',
        });

      expect(res.status).toBe(403);
    });
  });

  describe('H. Request Body Size Limit Defense', () => {
    it('should reject request bodies exceeding 1mb with 413 Payload Too Large', async () => {
      const largePayload = { data: 'A'.repeat(1.5 * 1024 * 1024) }; // ~1.5MB

      const res = await request(app)
        .post('/api/auth/login')
        .send(largePayload);

      expect(res.status).toBe(413);
    });
  });

  describe('I. WhatsApp Settings Security & Secret Leak Prevention', () => {
    const secret = process.env.JWT_SECRET || 'test_jwt_secret_must_be_long_enough_for_security';
    let adminToken;
    let staffToken;

    beforeAll(async () => {
      await pool.query(`
        INSERT INTO salons (id, name, invoice_prefix, currency, tax_rate)
        VALUES (1, 'Test Salon 1', 'TEST', 'INR', 0)
        ON CONFLICT (id) DO NOTHING
      `);
      await pool.query(`
        INSERT INTO users (id, name, email, password_hash, role, salon_id, is_active)
        VALUES (1, 'Test Admin', 'testadmin@example.com', '$2a$12$e80yZ1/X/VnN96rX6tAeu.vC0t6d5Ew4Y.a5Q6r7S8T9U0V1W2X3Y', 'admin', 1, true)
        ON CONFLICT (id) DO UPDATE SET role = 'admin', is_active = true
      `);
      await pool.query(`
        INSERT INTO users (id, name, email, password_hash, role, salon_id, is_active)
        VALUES (888, 'Test Staff', 'teststaff888@example.com', '$2a$12$e80yZ1/X/VnN96rX6tAeu.vC0t6d5Ew4Y.a5Q6r7S8T9U0V1W2X3Y', 'staff', 1, true)
        ON CONFLICT (id) DO UPDATE SET role = 'staff', is_active = true
      `);

      adminToken = jwt.sign({ userId: 1, role: 'admin', salonId: 1 }, secret, { expiresIn: '1h' });
      staffToken = jwt.sign({ userId: 888, role: 'staff', salonId: 1 }, secret, { expiresIn: '1h' });
    });

    it('should reject unauthenticated requests to /api/settings/whatsapp-status with 401', async () => {
      const res = await request(app).get('/api/settings/whatsapp-status');
      expect(res.status).toBe(401);
    });

    it('should reject non-admin (staff) requests to /api/settings/whatsapp-status with 403', async () => {
      const res = await request(app)
        .get('/api/settings/whatsapp-status')
        .set('Authorization', `Bearer ${staffToken}`);
      expect(res.status).toBe(403);
    });

    it('should allow admin requests and return strictly boolean connected and masked phone_number', async () => {
      const res = await request(app)
        .get('/api/settings/whatsapp-status')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();

      const dataKeys = Object.keys(res.body.data);
      // Must ONLY contain connected and phone_number
      expect(dataKeys.sort()).toEqual(['connected', 'phone_number'].sort());
      expect(typeof res.body.data.connected).toBe('boolean');

      if (res.body.data.connected) {
        expect(res.body.data.phone_number).toMatch(/XXX/);
      } else {
        expect(res.body.data.phone_number).toBeNull();
      }

      // Leak check: confirm NO sensitive fields or tokens in payload
      const jsonStr = JSON.stringify(res.body).toLowerCase();
      expect(jsonStr).not.toContain('access_token');
      expect(jsonStr).not.toContain('app_secret');
      expect(jsonStr).not.toContain('verify_token');
      expect(jsonStr).not.toContain('phone_number_id');
      expect(jsonStr).not.toContain('webhook_url');
    });

    it('should reject unauthenticated and staff requests to /api/settings/whatsapp-test', async () => {
      const unauth = await request(app).post('/api/settings/whatsapp-test').send({ phone: '9999999999' });
      expect(unauth.status).toBe(401);

      const staff = await request(app)
        .post('/api/settings/whatsapp-test')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ phone: '9999999999' });
      expect(staff.status).toBe(403);
    });

    it('should reject test message for admin when WhatsApp is not configured without leaking errors', async () => {
      const res = await request(app)
        .post('/api/settings/whatsapp-test')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ phone: '9999999999' });

      if (!res.body.success) {
        expect(res.status).toBe(400);
        expect(res.body.message).toContain('WhatsApp');
      }
    });

    it('should verify that frontend build bundle contains NO WhatsApp secrets or env setup instructions', () => {
      const distDir = path.resolve(__dirname, '../../frontend/dist/assets');
      if (fs.existsSync(distDir)) {
        const files = fs.readdirSync(distDir);
        for (const file of files) {
          if (file.endsWith('.js') || file.endsWith('.css')) {
            const content = fs.readFileSync(path.join(distDir, file), 'utf8');
            expect(content).not.toContain('WHATSAPP_ACCESS_TOKEN');
            expect(content).not.toContain('WHATSAPP_PHONE_NUMBER_ID');
            expect(content).not.toContain('WHATSAPP_APP_SECRET');
            expect(content).not.toContain('WHATSAPP_WEBHOOK_VERIFY_TOKEN');
            expect(content).not.toContain('your_meta_access_token');
            expect(content).not.toContain('restart the server');
          }
        }
      }
    });
  });
});
