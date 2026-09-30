'use strict';
const request = require('supertest');
const crypto = require('crypto');
const app = require('../src/server');
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
});
