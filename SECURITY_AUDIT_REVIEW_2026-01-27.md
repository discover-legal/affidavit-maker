# Comprehensive Security Audit Report

**Date**: 2026-01-27
**Auditor**: Claude (Automated Security Review)
**Repository**: affidavit-maker
**Scope**: Full codebase security assessment

---

## Executive Summary

This security audit identified **47 findings** across 10 security domains. The codebase demonstrates **strong foundational security practices** with proper authentication, parameterized queries, and layered defenses. However, several issues require remediation:

| Severity | Count | Status |
|----------|-------|--------|
| **CRITICAL** | 3 | Requires immediate attention |
| **HIGH** | 8 | Fix within 1 week |
| **MEDIUM** | 18 | Fix within 2-4 weeks |
| **LOW** | 18 | Fix as resources allow |

**Overall Security Posture**: **B+ (Good with room for improvement)**

---

## Table of Contents

1. [Critical Findings](#1-critical-findings)
2. [High Severity Findings](#2-high-severity-findings)
3. [Medium Severity Findings](#3-medium-severity-findings)
4. [Low Severity Findings](#4-low-severity-findings)
5. [Security Strengths](#5-security-strengths)
6. [Remediation Plan](#6-remediation-plan)
7. [Detailed Findings by Category](#7-detailed-findings-by-category)

---

## 1. Critical Findings

### CRIT-01: Dependency Vulnerability - react-snap (CVSS 9.8)

**File**: `client/package.json`
**Package**: react-snap v1.23.0
**Issue**: Contains minimist v1.2.8 with Prototype Pollution vulnerability allowing Remote Code Execution during build process.

**Impact**: Attackers could execute arbitrary code during `npm run build` via crafted input.

**Remediation**:
```bash
cd client && npm update react-snap
# OR remove if pre-rendering not essential
```

### CRIT-02: Dependency Vulnerability - react-router XSS (CVSS 7.6)

**File**: `client/package.json`
**Package**: react-router v7.8.1
**Issue**: XSS vulnerability (GHSA-3cgp-3xvw-98x8) and open redirect (GHSA-9jcx-v3wj-wh4m).

**Impact**: Session token theft, authentication bypass, phishing via redirects.

**Remediation**:
```bash
cd client && npm install react-router-dom@7.9.6
```

### CRIT-03: Unauthenticated Debug Endpoint Exposing Configuration

**File**: `/home/user/affidavit-maker/server.js`
**Lines**: 412-425
**Endpoint**: `GET /api/debug/cors`

**Issue**: Publicly accessible endpoint exposes:
- Environment mode (development/production)
- Frontend URL
- Complete list of allowed CORS origins
- Request headers

**Impact**: Infrastructure reconnaissance, CORS bypass planning.

**Remediation**:
```javascript
// Option 1: Remove endpoint entirely
// Option 2: Add authentication
app.get('/api/debug/cors', auth0Middleware, (req, res) => { ... });
```

---

## 2. High Severity Findings

### HIGH-01: Race Condition in Payment Webhook Processing

**File**: `/home/user/affidavit-maker/routes/payment.js`
**Lines**: 426-464

**Issue**: Payment status and document status updates are separate queries without transaction wrapper.

**Impact**: Document remains unpaid despite successful payment if connection drops between queries.

**Remediation**:
```javascript
await client.query('BEGIN');
try {
  await client.query('UPDATE payments SET status = $1 ...', ['succeeded', ...]);
  await client.query('UPDATE documents SET payment_status = $1 ...', ['paid', ...]);
  await client.query('COMMIT');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
}
```

### HIGH-02: Unsafe Webhook Signature Fallback

**File**: `/home/user/affidavit-maker/routes/auth0-webhooks.js`
**Lines**: 44-50

**Issue**: Falls back to `JSON.stringify(req.body)` if `rawBody` unavailable, which can produce different bytes than original request.

**Remediation**: Reject requests without rawBody instead of fallback.

### HIGH-03: Missing Rate Limiting on Multiple Endpoints

**Files**: Multiple routes
**Endpoints without rate limiting**:
- `GET /api/chat/session/:sessionId`
- `DELETE /api/chat/session/:sessionId`
- `GET /api/chat/metrics`
- `GET /api/evidence/:documentId/:fileKey`
- `DELETE /api/evidence/:documentId/:evidenceId`
- `GET /api/evidence/document/:documentId`
- `GET /api/payment/pricing`
- `GET /api/templates/requirements/:state`

**Impact**: DoS attacks, resource exhaustion, enumeration attacks.

**Remediation**: Apply `standardLimiter` or `chatLimiter` to all endpoints.

### HIGH-04: Missing Global Request Timeout (Slowloris Vulnerability)

**File**: `/home/user/affidavit-maker/server.js`

**Issue**: No global request timeout configured, allowing slow HTTP attacks.

**Remediation**:
```javascript
const timeout = require('connect-timeout');
app.use(timeout('30s'));
```

### HIGH-05: Missing Database Query Timeout

**File**: `/home/user/affidavit-maker/services/DatabaseService.js`

**Issue**: No query timeout on PostgreSQL connection pool.

**Impact**: Slow queries can exhaust connection pool.

**Remediation**:
```javascript
const pool = new Pool({
  ...config,
  statement_timeout: 30000, // 30 seconds
});
```

### HIGH-06: JWS HMAC Signature Bypass Vulnerability

**Package**: jws v3.2.2
**Advisory**: GHSA-869p-cjfg-cm3x

**Issue**: Improper HMAC signature verification could allow JWT spoofing.

**Remediation**: Upgrade to jws >= 3.2.3

### HIGH-07: Health Check Endpoint Reveals Service Details

**File**: `/home/user/affidavit-maker/server.js`
**Lines**: 397-410
**Endpoint**: `GET /health`

**Issue**: Reveals which services are connected/configured (database, Stripe, Auth0, OpenAI).

**Remediation**: Return only `{ status: 'OK' }` without service details.

### HIGH-08: Stack Traces Logged in Production

**File**: `/home/user/affidavit-maker/routes/documents.js`
**Lines**: 308, 466

**Issue**: Full stack traces logged even in production, revealing code structure if logs are exposed.

**Remediation**: Use error middleware exclusively; remove `stack: error.stack` from route-level logging.

---

## 3. Medium Severity Findings

### MED-01: Missing Chat Session Ownership Verification

**File**: `/home/user/affidavit-maker/routes/chat.js`
**Lines**: 260-292

**Issue**: GET/DELETE `/session/:sessionId` don't verify user owns the session.

### MED-02: ReDoS Vulnerability in Script Tag Detection

**File**: `/home/user/affidavit-maker/middleware/validation.js`
**Line**: 552

**Pattern**: `/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi`

**Issue**: Nested quantifiers with negative lookahead can cause catastrophic backtracking.

**Remediation**: Use simpler pattern or HTML parser library.

### MED-03: Missing Permissions-Policy Header

**File**: `/home/user/affidavit-maker/server.js`

**Issue**: Browser APIs (camera, microphone, geolocation) not restricted.

**Remediation**:
```javascript
app.use(helmet({
  permissionsPolicy: {
    camera: [],
    microphone: [],
    geolocation: [],
    payment: ['self'],
  }
}));
```

### MED-04: CSP Uses unsafe-eval

**File**: `/home/user/affidavit-maker/server.js`
**Line**: 85

**Issue**: `'unsafe-eval'` in scriptSrc weakens XSS protection (required for gtag.js).

### MED-05: CSP Uses unsafe-inline for Styles

**File**: `/home/user/affidavit-maker/server.js`
**Line**: 75

**Issue**: `'unsafe-inline'` in styleSrc enables CSS injection.

### MED-06: Temp Directory Not in .gitignore

**File**: `/home/user/affidavit-maker/.gitignore`

**Issue**: `temp/` directory for uploads not excluded from version control.

### MED-07: Multer Default Filename Generation

**File**: `/home/user/affidavit-maker/routes/evidence.js`
**Lines**: 52-65

**Issue**: No explicit storage engine configured.

### MED-08: File Permissions Not Explicitly Set

**File**: `/home/user/affidavit-maker/services/evidenceStorage.js`
**Lines**: 36-77

**Issue**: No explicit file permissions (0o600) set on uploaded files.

### MED-09: RLS Database Client Cleanup Lacks Timeout

**File**: `/home/user/affidavit-maker/middleware/auth0Middleware.js`
**Lines**: 555-591

**Issue**: Database client cleanup relies on response events without timeout fallback.

### MED-10: Payment Error Messages in Logs

**File**: `/home/user/affidavit-maker/routes/payment.js`
**Line**: 486

**Issue**: Stripe error messages logged, could reveal customer financial details.

### MED-11: Dead Code in CSRF Whitelist

**File**: `/home/user/affidavit-maker/middleware/csrfProtection.js`
**Line**: 58

**Issue**: `/api/auth0-webhooks/user-delete` whitelisted but route doesn't exist.

### MED-12: Missing Validation on Auth0 Webhook User Creation

**File**: `/home/user/affidavit-maker/routes/auth0-webhooks.js`
**Lines**: 114-163

**Issue**: Email format not validated before user creation.

### MED-13: Chat Metrics Exposes System Information

**File**: `/home/user/affidavit-maker/routes/chat.js`
**Lines**: 297-312

**Issue**: Memory usage and uptime exposed (even though authenticated).

### MED-14: Open Redirect in Auth0 Callback

**File**: `/home/user/affidavit-maker/client/src/App.js`
**Lines**: 34-41

**Issue**: `appState.returnTo` not validated before redirect.

### MED-15: Unvalidated State Parameter Echo

**File**: `/home/user/affidavit-maker/routes/templates.js`
**Line**: 121

**Issue**: User-supplied `state` parameter echoed in error message.

### MED-16: Hardcoded Test Secrets

**File**: `/home/user/affidavit-maker/tests/setup.js`
**Lines**: 6-12

**Issue**: Test secrets hardcoded in repository.

### MED-17: Jest Configuration Secrets

**File**: `/home/user/affidavit-maker/jest.config.js`
**Lines**: 55-62

**Issue**: Test environment variables hardcoded.

### MED-18: Lodash Prototype Pollution

**Package**: lodash v4.17.21
**Advisory**: GHSA-xxjr-mmjv-4gpg

**Issue**: _.unset and _.omit vulnerable to prototype pollution.

---

## 4. Low Severity Findings

### LOW-01: Missing Session ID Validation

**File**: `/home/user/affidavit-maker/routes/chat.js`
**Lines**: 260, 279

### LOW-02: No Temp Directory Cleanup Job

**File**: `/home/user/affidavit-maker/routes/evidence.js`

### LOW-03: Placeholder Thumbnail File Format

**File**: `/home/user/affidavit-maker/services/evidenceStorage.js`
**Lines**: 161, 191

### LOW-04: Directory Structure Reveals User Relationships

**File**: `/home/user/affidavit-maker/services/evidenceStorage.js`
**Lines**: 55-57

### LOW-05: File Extension from Client

**File**: `/home/user/affidavit-maker/services/evidenceStorage.js`
**Line**: 72

### LOW-06: Perplexity CDN in fontSrc

**File**: `/home/user/affidavit-maker/server.js`
**Line**: 102

### LOW-07: Account Enumeration Message

**File**: `/home/user/affidavit-maker/middleware/auth0Middleware.js`
**Line**: 265

### LOW-08: Stripe Error Logging

**File**: `/home/user/affidavit-maker/routes/payment.js`
**Line**: 24

### LOW-09 to LOW-18: Various outdated dependencies

- openai (4.104.0 → 6.16.0)
- file-type (16.5.4 → 21.3.0)
- express-rate-limit (7.5.1 → 8.2.1)
- helmet (7.2.0 → 8.1.0)
- stripe (14.25.0 → 20.2.0)
- @stripe/stripe-js (2.4.0 → 8.6.4)
- @stripe/react-stripe-js (2.4.0 → 5.5.0)
- @auth0/auth0-react (2.2.0 → 2.11.0)
- lucide-react (0.263.1 → 0.563.0)
- uuid (9.0.1 → 13.0.0)

---

## 5. Security Strengths

The codebase demonstrates excellent security practices in many areas:

### Authentication & Authorization ✅
- Proper JWT verification with RS256 and JWKS
- Resource ownership verified on all document/payment operations
- Row Level Security (RLS) enforced at database level
- Duplicate email protection prevents account takeover

### SQL Injection Prevention ✅
- **Zero SQL injection vulnerabilities found**
- All queries use parameterized placeholders ($1, $2, etc.)
- Input validation with express-validator

### CSRF Protection ✅
- Origin/Referer header validation
- Webhook paths correctly exempted (use signature verification)

### Webhook Security ✅
- Stripe webhook signature verification
- Auth0 webhook HMAC verification with timing-safe comparison
- Idempotency protection via `processed_webhook_events` table

### Payment Security ✅
- Server-side pricing enforcement (client cannot set prices)
- Stripe handles all sensitive card data
- Minimal PII storage (postal code only)

### File Upload Security ✅
- Magic byte validation (prevents MIME spoofing)
- PDF bomb detection (page count and compression ratio)
- Path traversal protection with multiple validation layers
- File size limits (25MB per file)

### Logging Security ✅
- Automatic sanitization of 15+ sensitive patterns
- Recursive redaction of nested objects
- Environment-aware stack trace handling

### Error Handling ✅
- Production errors sanitized before response
- PostgreSQL error codes translated to safe messages
- Internal details hidden from users

---

## 6. Remediation Plan

### Phase 1: Critical (Immediate - 48 Hours)

| ID | Issue | File | Effort |
|----|-------|------|--------|
| CRIT-01 | Update/remove react-snap | client/package.json | 30 min |
| CRIT-02 | Update react-router | client/package.json | 15 min |
| CRIT-03 | Secure/remove debug endpoint | server.js:412-425 | 10 min |

**Commands**:
```bash
# Fix CRIT-01 and CRIT-02
cd client
npm install react-router-dom@7.9.6
npm update react-snap
npm audit fix
cd ..

# Fix CRIT-03: Edit server.js to add auth or remove endpoint
```

### Phase 2: High (Week 1)

| ID | Issue | File | Effort |
|----|-------|------|--------|
| HIGH-01 | Transaction for payment webhook | routes/payment.js | 1 hour |
| HIGH-02 | Remove webhook signature fallback | routes/auth0-webhooks.js | 30 min |
| HIGH-03 | Add rate limiting to 8 endpoints | Multiple routes | 2 hours |
| HIGH-04 | Add global request timeout | server.js | 30 min |
| HIGH-05 | Add database query timeout | DatabaseService.js | 30 min |
| HIGH-06 | Update jws dependency | package.json | 15 min |
| HIGH-07 | Simplify health endpoint | server.js | 15 min |
| HIGH-08 | Remove stack traces from routes | routes/documents.js | 30 min |

**Estimated Total**: 6 hours

### Phase 3: Medium (Weeks 2-3)

| ID | Issue | Effort |
|----|-------|--------|
| MED-01 | Chat session ownership | 1 hour |
| MED-02 | Fix ReDoS pattern | 30 min |
| MED-03 | Add Permissions-Policy | 15 min |
| MED-04/05 | Document CSP trade-offs | 30 min |
| MED-06 | Add temp/ to .gitignore | 5 min |
| MED-07/08 | Multer config and file permissions | 1 hour |
| MED-09 | DB client cleanup timeout | 1 hour |
| MED-10 | Sanitize payment error logs | 30 min |
| MED-11 | Remove dead CSRF code | 5 min |
| MED-12 | Webhook email validation | 30 min |
| MED-13 | Restrict metrics endpoint | 15 min |
| MED-14 | Validate redirect paths | 30 min |
| MED-15 | Don't echo state in errors | 15 min |
| MED-16/17 | Move test secrets to env | 1 hour |
| MED-18 | Update lodash | 15 min |

**Estimated Total**: 8 hours

### Phase 4: Low & Maintenance (Month 1)

- Update all outdated dependencies
- Implement temp file cleanup job
- Add centralized monitoring
- Document security decisions
- Regular dependency audits

**Estimated Total**: 4-8 hours

---

## 7. Detailed Findings by Category

### 7.1 Authentication & Authorization
- ✅ JWT verification: SECURE
- ✅ Resource ownership: SECURE
- ✅ RLS enforcement: SECURE
- ⚠️ Chat session ownership: NEEDS FIX (MED-01)
- ⚠️ DB client cleanup: NEEDS ENHANCEMENT (MED-09)

### 7.2 SQL Injection
- ✅ All queries parameterized: SECURE
- ✅ Input validation in place: SECURE
- **No vulnerabilities found**

### 7.3 Input Validation
- ✅ Express-validator coverage: GOOD
- ⚠️ Session ID validation: MISSING (LOW-01)
- ⚠️ ReDoS vulnerability: EXISTS (MED-02)
- ⚠️ State parameter echo: EXISTS (MED-15)

### 7.4 Payment & Webhooks
- ✅ Server-side pricing: SECURE
- ✅ Signature verification: SECURE
- ✅ Idempotency: SECURE
- ⚠️ Race condition: EXISTS (HIGH-01)
- ⚠️ Signature fallback: UNSAFE (HIGH-02)

### 7.5 Rate Limiting & DoS
- ✅ Core limiters defined: GOOD
- ⚠️ 8 endpoints missing limits: EXISTS (HIGH-03)
- ⚠️ No global timeout: EXISTS (HIGH-04)
- ⚠️ No query timeout: EXISTS (HIGH-05)

### 7.6 File Upload & Storage
- ✅ Path traversal protection: EXCELLENT
- ✅ MIME validation: SECURE
- ✅ PDF bomb detection: SECURE
- ⚠️ File permissions: NOT SET (MED-08)
- ⚠️ Temp directory: NOT IN GITIGNORE (MED-06)

### 7.7 Error Handling & Info Disclosure
- ✅ Production error sanitization: GOOD
- ⚠️ Debug endpoint exposed: CRITICAL (CRIT-03)
- ⚠️ Health check verbose: EXISTS (HIGH-07)
- ⚠️ Stack traces in logs: EXISTS (HIGH-08)

### 7.8 Security Headers & CSP
- ✅ HSTS, X-Frame-Options: EXCELLENT
- ✅ CORS configuration: GOOD
- ⚠️ Permissions-Policy: MISSING (MED-03)
- ⚠️ unsafe-eval/inline: DOCUMENTED RISK (MED-04/05)
- ⚠️ Open redirect: EXISTS (MED-14)

### 7.9 Dependencies
- ⚠️ react-snap: CRITICAL (CRIT-01)
- ⚠️ react-router: CRITICAL (CRIT-02)
- ⚠️ jws: HIGH (HIGH-06)
- ⚠️ lodash: MEDIUM (MED-18)
- ⚠️ 10+ outdated packages: LOW (LOW-09 to LOW-18)

### 7.10 Secrets & Environment
- ✅ .gitignore coverage: GOOD
- ✅ Log sanitization: EXCELLENT
- ✅ Env var validation: GOOD
- ⚠️ Test secrets hardcoded: MEDIUM (MED-16/17)

---

## Appendix A: Files Requiring Changes

| File | Changes Needed | Priority |
|------|---------------|----------|
| server.js | Remove debug endpoint, add Permissions-Policy, simplify health, add timeout | CRITICAL/HIGH |
| routes/payment.js | Transaction wrapper, error log sanitization | HIGH |
| routes/auth0-webhooks.js | Remove signature fallback, add email validation | HIGH |
| routes/chat.js | Add rate limiting, ownership verification | HIGH/MEDIUM |
| routes/evidence.js | Add rate limiting | HIGH |
| routes/documents.js | Remove stack trace logging | HIGH |
| routes/templates.js | Don't echo state, add rate limiting | HIGH/MEDIUM |
| middleware/validation.js | Fix ReDoS pattern | MEDIUM |
| middleware/csrfProtection.js | Remove dead code | MEDIUM |
| middleware/auth0Middleware.js | Add cleanup timeout | MEDIUM |
| services/DatabaseService.js | Add query timeout | HIGH |
| services/evidenceStorage.js | Set file permissions | MEDIUM |
| client/src/App.js | Validate redirect paths | MEDIUM |
| client/package.json | Update react-router, react-snap | CRITICAL |
| package.json | Update jws, lodash | HIGH/MEDIUM |
| .gitignore | Add temp/ | MEDIUM |
| tests/setup.js | Move secrets to env | MEDIUM |
| jest.config.js | Move secrets to env | MEDIUM |

---

## Appendix B: Security Testing Checklist

After remediation, verify:

- [ ] `npm audit` shows no critical/high vulnerabilities (both root and client)
- [ ] `/api/debug/cors` returns 401 or 404
- [ ] `/health` returns minimal information
- [ ] All endpoints have rate limiting (test with repeated requests)
- [ ] Payment webhook updates both tables atomically
- [ ] Request timeout works (test with slow client)
- [ ] Database query timeout works (test with slow query)
- [ ] File uploads set 0600 permissions
- [ ] temp/ directory is in .gitignore
- [ ] Auth0 callback validates redirect paths
- [ ] No stack traces in production logs

---

## Conclusion

This audit identified 47 security findings requiring attention. While the codebase has strong foundational security (parameterized queries, JWT verification, RLS), several areas need immediate remediation:

1. **Critical**: Update vulnerable dependencies (react-snap, react-router)
2. **Critical**: Remove or secure debug endpoint
3. **High**: Fix race condition in payment processing
4. **High**: Add missing rate limiting and timeouts

Following the remediation plan will significantly strengthen the application's security posture. Regular security audits and dependency updates are recommended going forward.

---

**Report Generated**: 2026-01-27
**Next Audit Recommended**: 2026-04-27 (90 days)
