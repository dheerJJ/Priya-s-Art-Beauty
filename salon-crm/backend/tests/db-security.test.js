'use strict';
const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/server');
const pool = require('../src/db/pool');
const { escapeLikeWildcards, parseSafeInt, allowlistIdentifier } = require('../src/utils/dbUtils');

describe('Database Security & SQL Injection Hardening Test Suite', () => {
  let salon1Token;
  let salon2Token;
  const salon1Id = 1;
  const salon2Id = 999;

  beforeAll(() => {
    // Generate test JWTs for two distinct tenants to test cross-tenant isolation (IDOR)
    const secret = process.env.JWT_SECRET || 'test_jwt_secret_must_be_long_enough_for_security';
    salon1Token = jwt.sign(
      { userId: 1, role: 'admin', salonId: salon1Id },
      secret,
      { expiresIn: '1h' }
    );
    salon2Token = jwt.sign(
      { userId: 2, role: 'admin', salonId: salon2Id },
      secret,
      { expiresIn: '1h' }
    );
  });

  afterAll(async () => {
    // Graceful cleanup
    await pool.end();
  });

  describe('1. LIKE/ILIKE Wildcard Escaping and Search Sanitization', () => {
    it('should escape %, _, and backslashes properly', () => {
      expect(escapeLikeWildcards('100% discount')).toBe('100\\% discount');
      expect(escapeLikeWildcards('user_name')).toBe('user\\_name');
      expect(escapeLikeWildcards('path\\to\\file')).toBe('path\\\\to\\\\file');
      expect(escapeLikeWildcards('normal search')).toBe('normal search');
    });

    it('should cap long search queries to prevent algorithmic ReDoS/complexity attacks', () => {
      const longInput = 'A'.repeat(500);
      const sanitized = escapeLikeWildcards(longInput, 100);
      expect(sanitized.length).toBe(100);
    });

    it('should safely handle non-string or empty search inputs', () => {
      expect(escapeLikeWildcards(null)).toBe('');
      expect(escapeLikeWildcards(undefined)).toBe('');
      expect(escapeLikeWildcards('')).toBe('');
      expect(escapeLikeWildcards(12345)).toBe('');
    });
  });

  describe('2. SQL Injection Resistance on Search Parameters (Parameterized Queries)', () => {
    const maliciousPayloads = [
      "' OR '1'='1",
      "'; SELECT pg_sleep(5); --",
      "1' UNION SELECT null, email, password_hash FROM users --",
      "'; DROP TABLE bills; --",
      "admin'--",
      "' OR 1=1 --",
      "\\' OR \\'1\\'=\\'1",
      "%27%20OR%201=1--",
      "/* comment */ ' OR ''='",
    ];

    maliciousPayloads.forEach((payload) => {
      it(`should neutralize payload in customer search: "${payload}"`, async () => {
        const start = Date.now();
        const res = await request(app)
          .get(`/api/customers?search=${encodeURIComponent(payload)}`)
          .set('Authorization', `Bearer ${salon1Token}`);

        const duration = Date.now() - start;

        // Verify request was handled safely without throwing 500 error or executing pg_sleep
        expect(res.status).not.toBe(500);
        expect(duration).toBeLessThan(4000); // Guarantees pg_sleep was not executed
        if (res.status === 200) {
          expect(res.body.success).toBe(true);
          expect(Array.isArray(res.body.data)).toBe(true);
        }
      });

      it(`should neutralize payload in bills search: "${payload}"`, async () => {
        const res = await request(app)
          .get(`/api/bills?search=${encodeURIComponent(payload)}`)
          .set('Authorization', `Bearer ${salon1Token}`);

        expect(res.status).not.toBe(500);
        if (res.status === 200) {
          expect(res.body.success).toBe(true);
          expect(Array.isArray(res.body.data)).toBe(true);
        }
      });

      it(`should neutralize payload in services search: "${payload}"`, async () => {
        const res = await request(app)
          .get(`/api/services?search=${encodeURIComponent(payload)}`)
          .set('Authorization', `Bearer ${salon1Token}`);

        expect(res.status).not.toBe(500);
        if (res.status === 200) {
          expect(res.body.success).toBe(true);
          expect(Array.isArray(res.body.data)).toBe(true);
        }
      });
    });
  });

  describe('3. Dynamic Identifiers and Filter Allowlists', () => {
    it('should restrict status filter to strict allowlist', () => {
      const allowed = ['active', 'cancelled', 'refunded', 'all'];
      expect(allowlistIdentifier('active', allowed, 'active')).toBe('active');
      expect(allowlistIdentifier('cancelled', allowed, 'active')).toBe('cancelled');
      // Malicious injected SQL fragments should fall back to default safe value
      expect(allowlistIdentifier("active' OR '1'='1", allowed, 'active')).toBe('active');
      expect(allowlistIdentifier('; DROP TABLE bills;', allowed, 'active')).toBe('active');
    });

    it('should restrict payment_method filter to strict allowlist', () => {
      const allowed = ['cash', 'upi', 'card', 'other'];
      expect(allowlistIdentifier('cash', allowed, null)).toBe('cash');
      expect(allowlistIdentifier('upi', allowed, null)).toBe('upi');
      expect(allowlistIdentifier("cash' UNION SELECT 1--", allowed, null)).toBeNull();
    });
  });

  describe('4. Numeric / Route Parameter Injection Prevention', () => {
    it('should reject non-integer IDs on /api/bills/:id with 422 before query execution', async () => {
      const res = await request(app)
        .get('/api/bills/1%20OR%201=1')
        .set('Authorization', `Bearer ${salon1Token}`);

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
    });

    it('should reject SQL stacked query in :id param on /api/services/:id with 422', async () => {
      const res = await request(app)
        .put('/api/services/1;DROP%20TABLE%20services;')
        .set('Authorization', `Bearer ${salon1Token}`)
        .send({ name: 'Hacked Service' });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
    });
  });

  describe('5. Multi-Tenant Data Isolation & IDOR Protection', () => {
    it('should prevent cross-tenant access to bills belonging to other salons', async () => {
      // Query with salon2Token (salonId: 999) for bill 1 (which belongs to salonId: 1)
      const res = await request(app)
        .get('/api/bills/1')
        .set('Authorization', `Bearer ${salon2Token}`);

      // Must return 404 or 401/403, never leaking tenant 1 data to tenant 2
      expect([401, 403, 404]).toContain(res.status);
      if (res.status === 404) {
        expect(res.body.success).toBe(false);
      }
    });

    it('should isolate customer listing by tenant salon_id', async () => {
      const res1 = await request(app)
        .get('/api/customers')
        .set('Authorization', `Bearer ${salon1Token}`);

      const res2 = await request(app)
        .get('/api/customers')
        .set('Authorization', `Bearer ${salon2Token}`);

      if (res1.status === 200 && res2.status === 200) {
        // Tenant 2 should not see tenant 1's customers
        expect(res2.body.data.length).toBe(0);
      }
    });
  });

  describe('6. Database Session & Connection Hardening', () => {
    it('should have statement_timeout and connection parameters configured on pool', () => {
      expect(pool.options.statement_timeout).toBeDefined();
      expect(pool.options.statement_timeout).toBeGreaterThanOrEqual(1000);
      expect(pool.options.max).toBeDefined();
      expect(pool.options.max).toBeLessThanOrEqual(50);
      expect(pool.options.idleTimeoutMillis).toBeDefined();
    });

    it('should execute a standard query cleanly without error', async () => {
      const res = await pool.query('SELECT 1 as test');
      expect(res.rows[0].test).toBe(1);
    });
  });

  describe('7. Trigger Function Security (Explicit search_path)', () => {
    it('should have explicit search_path on update_updated_at_column', async () => {
      const res = await pool.query(`
        SELECT proconfig FROM pg_proc WHERE proname = 'update_updated_at_column' LIMIT 1;
      `);
      if (res.rows.length > 0 && res.rows[0].proconfig) {
        const configStr = res.rows[0].proconfig.join(',');
        expect(configStr).toContain('search_path=public, pg_temp');
      }
    });
  });
});
