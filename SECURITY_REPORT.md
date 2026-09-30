# Application Security Hardening & Audit Report

**Date:** September 30, 2026  
**Auditor:** Senior Application Security Engineer  
**Target Environment:** Local Dev / Localhost Testing  
**Git Branch:** `security-hardening`  
**Test Suite Status:** 14/14 Application Security Tests Passing (53/53 Total Project Security Tests)  

---

## 1. Stack Detection

| Component | Technology | Version / Configuration |
|---|---|---|
| **Backend Framework** | Node.js / Express | Express 4.18.2 |
| **Frontend Framework** | React / Vite | Vite 8.3.1, React 19 |
| **Database** | PostgreSQL | `node-postgres` (`pg` v8.12.0) |
| **Authentication** | JWT (JSON Web Tokens) | `jsonwebtoken` v9.0.2 with HS256 and minimum secret entropy validation |
| **Password Hashing** | bcrypt | `bcryptjs` v2.4.3 (12 rounds) |
| **Security Headers** | Helmet | Helmet v7.1.0 (strict CSP, HSTS, frameguard, nosniff, referrer-policy) |
| **Rate Limiting** | express-rate-limit | v7.3.1 (global 200/15min, auth 10/15min, password 5/15min, webhook/resend limits) |
| **Audit Logging** | Winston | Winston v3.13.0 with automatic deep secret scrubbing |
| **Test Framework** | Jest + Supertest | Jest v29.7.0, Supertest v7.0.0 |

---

## 2. Vulnerability Findings & Hardening Applied

### Finding 1: Dependency Vulnerability CVE GHSA-w5hq-g745-h8pq (High)
- **Component:** `uuid` v9.0.1
- **Issue:** Predictable random numbers or prototype pollution vectors present in older versions.
- **Fix:** Upgraded `uuid` to latest v14.0.2. Verified `npm audit` reports 0 vulnerabilities.

### Finding 2: Unauthenticated Public Invoice PDF Route & Directory Traversal (High)
- **Component:** `backend/src/server.js` and `backend/src/services/pdfService.js`
- **Issue:** Express had `app.use('/invoices', express.static(STORAGE_PATH))` exposing all customer invoices without authentication. In addition, PDF path retrieval did not check for path traversal patterns.
- **Fix:**
  - Removed public `/invoices` static route. Invoices now strictly require authentication and tenant validation via `/api/bills/:id/invoice-pdf`.
  - Added strict path traversal validation in `getSafePDFPath()` in `pdfService.js` that rejects `..`, `/`, and `\` sequences and verifies storage directory containment.

### Finding 3: Timing Attack Vulnerability in Webhook HMAC Verification (Medium)
- **Component:** `backend/src/controllers/webhookController.js`
- **Issue:** Using `crypto.timingSafeEqual()` directly on buffers of differing lengths throws an unhandled `RangeError`, which could crash the process or allow timing discrepancies.
- **Fix:** Implemented double-hash constant-time verification pattern: hashing both buffers with SHA-256 before comparison ensures equal length and prevents timing analysis and crashes.

### Finding 4: Sensitive Data Exposure in Application Logs (Medium)
- **Component:** `backend/src/utils/logger.js`
- **Issue:** Unredacted request bodies or error logs could inadvertently record passwords, tokens, or WhatsApp access tokens.
- **Fix:** Added custom Winston sanitization format that deeply scrubs fields matching `password`, `token`, `secret`, `jwt`, `api_key`, and `authorization` headers.

### Finding 5: Missing Request Body Size Limits & DoS Vectors (Medium)
- **Component:** `backend/src/server.js`
- **Issue:** Unlimited JSON/URL-encoded payload size allowed possible denial-of-service via huge memory allocation.
- **Fix:** Set `limit: '1mb'` on `express.json()` and `express.urlencoded()`.

### Finding 6: Unrestricted Route Parameters and Rate Limiting (Medium)
- **Component:** `backend/src/routes/` and `backend/src/controllers/`
- **Issue:** Missing endpoint rate limits on sensitive endpoints (`/api/auth/login`, `/api/auth/change-password`, `/api/bills/:id/resend-whatsapp`), and missing parameter validation.
- **Fix:**
  - Added dedicated rate limiters for login (10 attempts/15 min) and password change (5 attempts/15 min).
  - Added integer validation middleware on numeric route parameters (`:id`).
  - Added last-administrator lockout protection in `settingsController.js`.

---

## 3. Automated Test Verification

All 14 tests in [`backend/tests/security.test.js`](file:///d:/Downloads/whatsapp-intigratin-application/salon-crm/backend/tests/security.test.js) pass:
- HTTP defensive headers (X-Frame-Options: DENY, X-Content-Type-Options: nosniff, CSP).
- Invoices route decommission check (returns 404 unauthenticated).
- CORS origin enforcement (approves localhost:3000, rejects malicious origins).
- Path traversal defense in PDF service.
- Authentication & JWT validation (rejects invalid tokens and unauthenticated calls).
- Input validation on auth endpoints.
- Webhook HMAC signature verification and length safety.
- Request payload size rejection (returns 413 for bodies > 1MB).

Run tests at any time:
```bash
npm run security
```
