# Security Remediation Plan

**Date**: 2026-01-21
**Priority**: 🔴 CRITICAL
**Owner**: Development Team
**Review Date**: Weekly until complete

---

## Overview

This document provides a **prioritized, actionable plan** to address all security vulnerabilities identified in the comprehensive security audit. The plan is organized by urgency and includes time estimates, resource requirements, and success criteria.

---

## Executive Summary

| Priority | Issues | Estimated Time | Status |
|----------|--------|----------------|--------|
| 🔴 CRITICAL | 2 | 8-12 hours | ⏳ Not Started |
| 🟠 HIGH | 5 | 16-24 hours | ⏳ Not Started |
| 🟡 MEDIUM | 8 | 32-40 hours | ⏳ Not Started |
| 🟢 LOW | 4 | 8-16 hours | ⏳ Not Started |

**Total Estimated Time**: 64-92 hours (8-12 working days)
**Recommended Timeline**: 4 weeks (with testing and validation)

---

## 🔴 CRITICAL - Week 1 (Must Fix Immediately)

### Issue #1: Missing Row Level Security (RLS)

**Risk**: Complete data breach if application logic bypassed
**CVSS**: 9.8 (Critical)
**Time**: 6-8 hours
**Owner**: Backend Lead + Database Admin

#### Tasks

1. **Day 1 (4 hours)**:
   - [ ] Review `RLS_IMPLEMENTATION_GUIDE.md`
   - [ ] Create backup of production database
   - [ ] Create `migrations/010_enable_rls_all_tables.sql`
   - [ ] Test migration in local development environment

2. **Day 2 (4 hours)**:
   - [ ] Update `middleware/auth.js` to set user context
   - [ ] Add `setUserContext()` function
   - [ ] Update webhook handlers to use bypass flag
   - [ ] Update `DatabaseService.js` with RLS-aware methods

3. **Day 3 (2 hours)**:
   - [ ] Create RLS unit tests (`__tests__/security/rls.test.js`)
   - [ ] Run test suite locally
   - [ ] Fix any failing tests

4. **Day 4 (2 hours)**:
   - [ ] Deploy to staging environment
   - [ ] Run integration tests
   - [ ] Manual testing: user isolation, webhooks, admin access

5. **Day 5 (2 hours)**:
   - [ ] Monitor staging for 24 hours
   - [ ] Review logs for errors
   - [ ] Performance testing (ensure < 5% impact)

6. **Day 6 (2 hours)**:
   - [ ] Deploy to production during low-traffic window
   - [ ] Monitor logs in real-time
   - [ ] Run smoke tests
   - [ ] Verify data isolation with test queries

#### Success Criteria

- ✅ All tables have RLS enabled
- ✅ All unit tests pass
- ✅ All integration tests pass
- ✅ Manual testing confirms users cannot access other users' data
- ✅ Webhooks and cron jobs work correctly
- ✅ Performance impact < 5%
- ✅ No errors in production logs after 48 hours

#### Dependencies

- PostgreSQL 9.5+
- Staging environment
- Database backup

---

### Issue #2: Webhook Idempotency Not Enforced

**Risk**: Duplicate payment processing, data corruption
**CVSS**: 7.5 (High)
**Time**: 2-4 hours
**Owner**: Backend Lead

#### Tasks

1. **Day 1 (1 hour)**:
   - [ ] Create `processed_webhook_events` table migration
   - [ ] Add unique index on `stripe_event_id`

```sql
-- migrations/011_webhook_idempotency.sql
CREATE TABLE IF NOT EXISTS processed_webhook_events (
    id SERIAL PRIMARY KEY,
    stripe_event_id VARCHAR(255) UNIQUE NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    processed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_webhook_events_stripe_id ON processed_webhook_events(stripe_event_id);
CREATE INDEX idx_webhook_events_created_at ON processed_webhook_events(created_at);

-- Cleanup old events (older than 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_webhook_events()
RETURNS void AS $$
BEGIN
    DELETE FROM processed_webhook_events
    WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;
```

2. **Day 1 (2 hours)**:
   - [ ] Update `routes/payment.js` webhook handler
   - [ ] Add idempotency check before processing
   - [ ] Add event recording after successful processing

```javascript
// In routes/payment.js webhook handler (line ~335)
// Before processing event:
const existingEvent = await pool.query(
  'SELECT id FROM processed_webhook_events WHERE stripe_event_id = $1',
  [event.id]
);

if (existingEvent.rows.length > 0) {
  logger.info('Webhook already processed (idempotent check)', {
    eventId: event.id,
    eventType: event.type
  });
  return res.status(200).send('Already processed');
}

// ... process event ...

// After successful processing:
await pool.query(
  `INSERT INTO processed_webhook_events (stripe_event_id, event_type, metadata)
   VALUES ($1, $2, $3)`,
  [event.id, event.type, JSON.stringify({ processed_at: new Date().toISOString() })]
);
```

3. **Day 2 (1 hour)**:
   - [ ] Test webhook idempotency
   - [ ] Use Stripe CLI to send duplicate events
   - [ ] Verify only one processing occurs

```bash
# Test with Stripe CLI
stripe trigger payment_intent.succeeded
# Send same event twice
stripe events resend <event_id>
# Verify only one entry in processed_webhook_events
```

4. **Day 2 (30 mins)**:
   - [ ] Deploy to staging
   - [ ] Test end-to-end payment flow
   - [ ] Verify no duplicate processing

5. **Day 3 (30 mins)**:
   - [ ] Deploy to production
   - [ ] Monitor webhook processing
   - [ ] Verify idempotency in production logs

#### Success Criteria

- ✅ Duplicate webhook events logged but not processed twice
- ✅ All payments processed exactly once
- ✅ No race conditions in concurrent webhook deliveries
- ✅ Cleanup function removes old events

#### Dependencies

- Stripe CLI for testing
- Access to Stripe webhook logs

---

## 🟠 HIGH Priority - Week 2

### Issue #3: Rate Limiting Based on IP Only

**Risk**: Resource exhaustion via IP rotation, legitimate users blocked
**CVSS**: 6.5 (Medium-High)
**Time**: 3-4 hours
**Owner**: Backend Developer

#### Tasks

1. **Update rate limiting strategy** (2 hours):
   ```javascript
   // middleware/rateLimiting.js
   const createSmartRateLimiter = (options) => {
     return rateLimit({
       ...options,
       keyGenerator: (req) => {
         // Use user ID if authenticated, otherwise IP
         if (req.user?.id) {
           return `user:${req.user.id}`;
         }
         return `ip:${req.ip}`;
       },
       handler: (req, res) => {
         const key = req.user?.id ? `User ${req.user.id}` : `IP ${req.ip}`;
         logger.logSecurity('rate_limit_exceeded', {
           key,
           path: req.path,
           method: req.method
         });

         res.status(429).json({
           success: false,
           error: 'Rate limit exceeded',
           retryAfter: Math.ceil(options.windowMs / 1000)
         });
       }
     });
   };
   ```

2. **Apply to all rate limiters** (1 hour)
3. **Test with authenticated and unauthenticated requests** (1 hour)
4. **Deploy and monitor** (30 mins)

---

### Issue #4: Missing Rate Limiting on Critical Endpoints

**Risk**: DDoS, resource exhaustion
**CVSS**: 7.0 (High)
**Time**: 2 hours
**Owner**: Backend Developer

#### Tasks

1. **Add rate limiting to missing endpoints**:
   - `GET /api/documents/:id` → Add `strictLimiter`
   - `GET /api/payment/pricing` → Add `standardLimiter`
   - `POST /api/documents/preview` → Add `pdfLimiter`

2. **Test each endpoint for rate limit enforcement**
3. **Deploy and verify in production**

---

### Issue #5: Document ID Enumeration

**Risk**: Information disclosure, user enumeration
**CVSS**: 6.5 (Medium-High)
**Time**: 4-6 hours
**Owner**: Backend Lead + Database Admin

#### Option A: Switch to UUIDs (Recommended)

```sql
-- Migration to UUID
ALTER TABLE documents ALTER COLUMN id TYPE UUID USING (uuid_generate_v4());
ALTER TABLE documents ALTER COLUMN id SET DEFAULT uuid_generate_v4();
```

**Pros**: Complete prevention of enumeration
**Cons**: Requires updating foreign keys, application code changes

#### Option B: Consistent Error Messages (Quick Fix)

```javascript
// Return 404 for both "not found" and "not yours"
if (!doc || doc.user_id !== userId) {
  return res.status(404).json({
    success: false,
    error: 'Document not found'
  });
}
```

**Pros**: Quick fix, no database changes
**Cons**: Still possible to enumerate via timing attacks

#### Recommendation

- **Week 2**: Implement Option B (quick fix) - 1 hour
- **Week 4**: Plan UUID migration (Option A) - 3-5 hours

---

### Issue #6: File Upload Path Traversal Risk

**Risk**: Arbitrary file write, RCE
**CVSS**: 7.2 (High)
**Time**: 3 hours
**Owner**: Backend Developer

#### Tasks

1. **Add strict input validation** (1 hour):
   ```javascript
   // routes/evidence.js
   const validateFileInputs = (documentId, evidenceId) => {
     // Validate documentId is positive integer
     const docIdNum = parseInt(documentId);
     if (isNaN(docIdNum) || docIdNum < 1 || docIdNum > 2147483647) {
       throw new ValidationError('Invalid document ID');
     }

     // Validate evidenceId is safe alphanumeric
     if (!/^[a-zA-Z0-9_-]{1,64}$/.test(evidenceId)) {
       throw new ValidationError('Invalid evidence ID format');
     }

     return { documentId: docIdNum, evidenceId };
   };
   ```

2. **Add path verification** (1 hour):
   ```javascript
   const path = require('path');
   const EVIDENCE_ROOT = path.resolve(__dirname, '../evidence');

   function constructSafePath(userId, documentId, evidenceId, extension) {
     const filePath = path.join(
       EVIDENCE_ROOT,
       userId.toString(),
       documentId.toString(),
       `${evidenceId}_${Date.now()}${extension}`
     );

     // CRITICAL: Verify path is within EVIDENCE_ROOT
     const normalizedPath = path.normalize(filePath);
     if (!normalizedPath.startsWith(EVIDENCE_ROOT)) {
       throw new Error('Path traversal attempt detected');
     }

     return normalizedPath;
   }
   ```

3. **Add unit tests** (30 mins)
4. **Test with malicious inputs** (30 mins)

---

### Issue #7: Missing JSONB Content Validation

**Risk**: DoS, storage exhaustion, XSS
**CVSS**: 6.8 (Medium-High)
**Time**: 4 hours
**Owner**: Backend Developer

#### Tasks

1. **Install Ajv JSON schema validator** (5 mins):
   ```bash
   npm install ajv
   ```

2. **Create affidavit data schema** (1 hour):
   ```javascript
   // utils/schemas/affidavitSchema.js
   const affidavitSchema = {
     type: 'object',
     properties: {
       affiantName: { type: 'string', maxLength: 200 },
       state: { type: 'string', pattern: '^[A-Z]{2}$' },
       county: { type: 'string', maxLength: 100 },
       facts: {
         type: 'array',
         maxItems: 100,
         items: {
           type: 'object',
           properties: {
             content: { type: 'string', maxLength: 5000 },
             category: { type: 'string', maxLength: 50 }
           },
           required: ['content']
         }
       }
     },
     required: ['facts']
   };
   ```

3. **Add validation middleware** (1 hour)
4. **Test with malicious payloads** (1 hour)
5. **Add size limits to express.json()** (30 mins)

---

## 🟡 MEDIUM Priority - Week 3

### Issues #8-15

(Abbreviated - full details in SECURITY_AUDIT_COMPREHENSIVE.md)

1. **Session Management** (4 hours)
2. **Security Headers** (2 hours)
3. **Log Sanitization** (3 hours)
4. **CSRF Improvements** (2 hours)
5. **Account Lockout** (3 hours)
6. **Payment Validation** (3 hours)
7. **Soft Delete Implementation** (2 hours)
8. **Admin Privilege Protection** (3 hours)

---

## 🟢 LOW Priority - Week 4

### Issues #16-19

1. **Null Check Improvements** (2 hours)
2. **Pagination Hardening** (1 hour)
3. **Log Retention Automation** (2 hours)
4. **Security Monitoring Setup** (3 hours)

---

## Weekly Schedule

### Week 1: CRITICAL Issues

| Day | Tasks | Hours | Owner |
|-----|-------|-------|-------|
| Mon | RLS: Review, backup, create migration | 4 | Backend Lead |
| Tue | RLS: Application code changes | 4 | Backend Lead |
| Wed | RLS: Testing and bug fixes | 4 | Backend Lead |
| Thu | RLS: Deploy to staging, integration tests | 4 | Backend Lead + QA |
| Fri | Webhook idempotency: Implementation + testing | 4 | Backend Dev |
| --- | **Total** | **20 hours** | --- |

### Week 2: HIGH Priority Issues

| Day | Tasks | Hours | Owner |
|-----|-------|-------|-------|
| Mon | RLS: Production deployment + monitoring | 2 | Backend Lead |
| Mon-Tue | Rate limiting improvements | 4 | Backend Dev |
| Tue-Wed | Path traversal fixes | 3 | Backend Dev |
| Wed-Thu | JSONB validation | 4 | Backend Dev |
| Thu-Fri | Document ID enumeration fix | 2 | Backend Dev |
| --- | **Total** | **15 hours** | --- |

### Week 3: MEDIUM Priority Issues

| Day | Tasks | Hours | Owner |
|-----|-------|-------|-------|
| Mon-Tue | Session management + security headers | 6 | Backend Dev |
| Tue-Wed | Log sanitization + CSRF improvements | 5 | Backend Dev |
| Wed-Thu | Account lockout + payment validation | 6 | Backend Dev |
| Thu-Fri | Soft delete + admin privilege protection | 5 | Backend Dev |
| --- | **Total** | **22 hours** | --- |

### Week 4: LOW Priority + Documentation

| Day | Tasks | Hours | Owner |
|-----|-------|-------|-------|
| Mon | Low priority fixes (1-4) | 8 | Backend Dev |
| Tue | Final testing and documentation | 4 | Backend Lead |
| Wed | Security audit review meeting | 2 | Team |
| Thu-Fri | Buffer for any issues | 8 | Team |
| --- | **Total** | **22 hours** | --- |

---

## Risk Management

### Rollback Plans

Each critical change has a rollback plan:

1. **RLS**: `ALTER TABLE ... DISABLE ROW LEVEL SECURITY;`
2. **UUID Migration**: Restore from backup, revert application code
3. **Rate Limiting**: Revert middleware changes
4. **File Upload**: Revert validation logic

### Testing Requirements

Before each production deployment:

- ✅ Unit tests pass
- ✅ Integration tests pass
- ✅ Manual QA testing complete
- ✅ Staging environment stable for 24+ hours
- ✅ Rollback plan documented and tested
- ✅ Database backup created

### Monitoring Checklist

After each production deployment:

- [ ] Error rates (should not increase)
- [ ] Response times (should not degrade > 5%)
- [ ] Database query performance
- [ ] Security logs for anomalies
- [ ] User-reported issues

---

## Success Metrics

### Overall Success Criteria

- ✅ All CRITICAL issues resolved
- ✅ All HIGH issues resolved
- ✅ At least 75% of MEDIUM issues resolved
- ✅ No new security vulnerabilities introduced
- ✅ Application performance degradation < 5%
- ✅ Zero production incidents related to security changes
- ✅ All tests passing
- ✅ Documentation updated

### Key Performance Indicators (KPIs)

| Metric | Before | Target | Status |
|--------|--------|--------|--------|
| Overall Risk Level | 🔴 HIGH (9.8) | 🟢 LOW (< 3.0) | ⏳ Pending |
| RLS Enabled | ❌ No | ✅ Yes | ⏳ Pending |
| Idempotency | ❌ No | ✅ Yes | ⏳ Pending |
| Rate Limit Bypass | ⚠️ Easy | ✅ Hard | ⏳ Pending |
| Path Traversal Risk | ⚠️ High | ✅ Low | ⏳ Pending |
| Test Coverage | ~45% | > 70% | ⏳ Pending |

---

## Resource Requirements

### Team

- **Backend Lead**: 32 hours (RLS, critical reviews)
- **Backend Developer**: 48 hours (high/medium issues)
- **QA Engineer**: 16 hours (testing, validation)
- **DevOps**: 8 hours (deployment support)
- **Total**: ~104 hours over 4 weeks

### Tools & Infrastructure

- Staging environment (already have)
- Stripe CLI for webhook testing
- Monitoring tools (Sentry, DataDog recommended)
- Security scanning tools (optional but recommended)

---

## Communication Plan

### Stakeholders

1. **Development Team**: Daily standups, progress updates
2. **Product Manager**: Weekly summary reports
3. **Security Team**: Final audit review after completion
4. **Users**: No communication needed unless downtime required

### Reporting

- **Daily**: Update checklist, log blockers
- **Weekly**: Status report to management
- **Final**: Comprehensive security report with all fixes

---

## Post-Remediation

### Follow-Up Actions

1. **Month 1**: Monitor all changes in production
2. **Month 2**: Conduct penetration testing
3. **Month 3**: Re-audit with fresh eyes
4. **Quarterly**: Ongoing security audits

### Continuous Improvement

- Set up automated security scanning (Snyk, Dependabot)
- Implement security training for developers
- Create secure coding guidelines document
- Establish regular security review process

---

## Appendix: Quick Reference

### Critical Commands

```bash
# RLS Migration
psql $DATABASE_URL -f migrations/010_enable_rls_all_tables.sql

# Webhook Idempotency Migration
psql $DATABASE_URL -f migrations/011_webhook_idempotency.sql

# Verify RLS
psql $DATABASE_URL -c "SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname='public';"

# Test RLS
psql $DATABASE_URL -c "SET LOCAL app.user_id = '123'; SELECT COUNT(*) FROM documents;"

# Rollback RLS
psql $DATABASE_URL -c "ALTER TABLE documents DISABLE ROW LEVEL SECURITY;"
```

### Emergency Contacts

- Backend Lead: [contact info]
- Database Admin: [contact info]
- Security Team: [contact info]
- On-Call Engineer: [rotation schedule]

---

**END OF SECURITY REMEDIATION PLAN**

*This plan should be reviewed weekly and updated as progress is made.*
