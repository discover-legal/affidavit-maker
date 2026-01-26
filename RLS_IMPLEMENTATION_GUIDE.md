# Row Level Security (RLS) Implementation Guide

**Priority**: 🔴 **CRITICAL**
**Estimated Time**: 4-6 hours
**Risk Level**: Medium (requires careful testing)

---

## Overview

This guide provides step-by-step instructions for implementing PostgreSQL Row Level Security (RLS) on the Affidavit Maker application. RLS is a **critical security control** that prevents unauthorized data access at the database layer, even if application logic is bypassed.

### Why RLS is Critical

Without RLS, the application relies entirely on application-level checks (`WHERE user_id = $1`). If ANY of these fail:
- ✅ Authentication middleware bug
- ✅ New endpoint without auth
- ✅ SQL injection vulnerability
- ✅ Direct database access (compromised credentials)
- ✅ Admin tool without proper checks

→ **ALL user data is exposed**

With RLS:
- 🛡️ Database enforces isolation automatically
- 🛡️ Even `SELECT * FROM documents` returns only user's own data
- 🛡️ Defense-in-depth: Application + Database security

---

## Prerequisites

- PostgreSQL 9.5+ (RLS introduced in 9.5)
- Database admin access
- Staging environment for testing
- Backup of production database

---

## Phase 1: Preparation

### Step 1.1: Create Database Backup

```bash
# Production backup
pg_dump $DATABASE_URL > backup_before_rls_$(date +%Y%m%d_%H%M%S).sql

# Or using Render.com backup feature
# Dashboard → Database → Backups → Create Manual Backup
```

### Step 1.2: Verify Current User Query Patterns

Review all queries to ensure they set user context:

```bash
# Search for all database queries
grep -r "pool.query" . --include="*.js" | grep -v node_modules
```

Check that all authenticated endpoints will have `req.user.id` available.

### Step 1.3: Create Test Scenarios

Document test cases:
- User A accesses their own documents ✓
- User A tries to access User B's documents ✗
- Unauthenticated access (webhooks, cron jobs) - need special handling
- Admin access to all data

---

## Phase 2: Database Migration

### Step 2.1: Create Migration File

Create `migrations/010_enable_rls_all_tables.sql`:

```sql
-- ============================================================================
-- Migration 010: Enable Row Level Security (RLS) on All User Tables
-- ============================================================================
-- Date: 2026-01-21
-- Description: Implements PostgreSQL Row Level Security to enforce data
--              isolation at the database level, preventing unauthorized
--              access even if application logic is bypassed.
--
-- IMPORTANT: This migration changes how data access works. All application
--            code must set 'app.user_id' session variable after authentication.
--
-- Rollback: Run rollback script if issues occur (see bottom of file)
-- ============================================================================

BEGIN;

-- ============================================================================
-- Step 1: Enable RLS on All User-Data Tables
-- ============================================================================

-- Users can only see their own profile
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Documents belong to users
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Payments belong to users
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Sessions belong to users
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

-- User identities belong to users
ALTER TABLE user_identities ENABLE ROW LEVEL SECURITY;

-- Activity logs track user actions
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- Email notifications sent to users
ALTER TABLE email_notifications ENABLE ROW LEVEL SECURITY;

-- Audit log contains security events
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;


-- ============================================================================
-- Step 2: Create Helper Functions
-- ============================================================================

-- Function to get current user ID from session variable
CREATE OR REPLACE FUNCTION current_user_id()
RETURNS INTEGER AS $$
BEGIN
    RETURN current_setting('app.user_id', TRUE)::INTEGER;
EXCEPTION
    WHEN OTHERS THEN
        RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to check if current user is admin
CREATE OR REPLACE FUNCTION current_user_is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN current_setting('app.is_admin', TRUE)::BOOLEAN;
EXCEPTION
    WHEN OTHERS THEN
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to check if RLS is bypassed (for service accounts)
CREATE OR REPLACE FUNCTION bypass_rls_enabled()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN current_setting('app.bypass_rls', TRUE)::BOOLEAN;
EXCEPTION
    WHEN OTHERS THEN
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql STABLE;


-- ============================================================================
-- Step 3: Create RLS Policies for USERS Table
-- ============================================================================

-- Allow users to SELECT their own record
CREATE POLICY users_select_own ON users
    FOR SELECT
    USING (
        id = current_user_id()
        OR current_user_is_admin()
        OR bypass_rls_enabled()
    );

-- Allow users to UPDATE their own record (but not sensitive fields)
CREATE POLICY users_update_own ON users
    FOR UPDATE
    USING (
        id = current_user_id()
        OR current_user_is_admin()
        OR bypass_rls_enabled()
    );

-- Only system can INSERT users (handled by auth middleware)
CREATE POLICY users_insert_system ON users
    FOR INSERT
    WITH CHECK (
        bypass_rls_enabled()
    );

-- Users cannot delete their own account (must use soft delete)
-- Only admin or system can DELETE
CREATE POLICY users_delete_admin ON users
    FOR DELETE
    USING (
        current_user_is_admin()
        OR bypass_rls_enabled()
    );


-- ============================================================================
-- Step 4: Create RLS Policies for DOCUMENTS Table
-- ============================================================================

-- Users can SELECT their own documents
CREATE POLICY documents_select_own ON documents
    FOR SELECT
    USING (
        user_id = current_user_id()
        OR current_user_is_admin()
        OR bypass_rls_enabled()
    );

-- Users can INSERT their own documents
CREATE POLICY documents_insert_own ON documents
    FOR INSERT
    WITH CHECK (
        user_id = current_user_id()
        OR bypass_rls_enabled()
    );

-- Users can UPDATE their own documents
CREATE POLICY documents_update_own ON documents
    FOR UPDATE
    USING (
        user_id = current_user_id()
        OR current_user_is_admin()
        OR bypass_rls_enabled()
    );

-- Users can DELETE their own documents
CREATE POLICY documents_delete_own ON documents
    FOR DELETE
    USING (
        user_id = current_user_id()
        OR current_user_is_admin()
        OR bypass_rls_enabled()
    );


-- ============================================================================
-- Step 5: Create RLS Policies for PAYMENTS Table
-- ============================================================================

-- Users can SELECT their own payments
CREATE POLICY payments_select_own ON payments
    FOR SELECT
    USING (
        user_id = current_user_id()
        OR current_user_is_admin()
        OR bypass_rls_enabled()
    );

-- Only system can INSERT payments (handled by payment webhooks)
CREATE POLICY payments_insert_system ON payments
    FOR INSERT
    WITH CHECK (
        bypass_rls_enabled()
    );

-- Only system can UPDATE payments (handled by webhooks)
CREATE POLICY payments_update_system ON payments
    FOR UPDATE
    USING (
        bypass_rls_enabled()
        OR current_user_is_admin()
    );

-- Payments cannot be deleted (maintain audit trail)
-- Only admin can delete if absolutely necessary
CREATE POLICY payments_delete_admin ON payments
    FOR DELETE
    USING (
        current_user_is_admin()
    );


-- ============================================================================
-- Step 6: Create RLS Policies for SESSIONS Table
-- ============================================================================

-- Users can access their own sessions
CREATE POLICY sessions_isolation ON sessions
    FOR ALL
    USING (
        user_id = current_user_id()
        OR current_user_is_admin()
        OR bypass_rls_enabled()
    );


-- ============================================================================
-- Step 7: Create RLS Policies for USER_IDENTITIES Table
-- ============================================================================

-- Users can SELECT their own identities
CREATE POLICY user_identities_select_own ON user_identities
    FOR SELECT
    USING (
        user_id = current_user_id()
        OR current_user_is_admin()
        OR bypass_rls_enabled()
    );

-- Only system can INSERT identities (during account creation/linking)
CREATE POLICY user_identities_insert_system ON user_identities
    FOR INSERT
    WITH CHECK (
        bypass_rls_enabled()
    );

-- Only system can UPDATE identities
CREATE POLICY user_identities_update_system ON user_identities
    FOR UPDATE
    USING (
        bypass_rls_enabled()
        OR current_user_is_admin()
    );


-- ============================================================================
-- Step 8: Create RLS Policies for ACTIVITY_LOGS Table
-- ============================================================================

-- Users can SELECT their own activity logs
CREATE POLICY activity_logs_select_own ON activity_logs
    FOR SELECT
    USING (
        user_id = current_user_id()
        OR current_user_is_admin()
        OR bypass_rls_enabled()
    );

-- Only system can INSERT activity logs
CREATE POLICY activity_logs_insert_system ON activity_logs
    FOR INSERT
    WITH CHECK (
        bypass_rls_enabled()
    );

-- Activity logs cannot be updated or deleted (maintain audit trail)


-- ============================================================================
-- Step 9: Create RLS Policies for EMAIL_NOTIFICATIONS Table
-- ============================================================================

-- Users can SELECT their own email notifications
CREATE POLICY email_notifications_select_own ON email_notifications
    FOR SELECT
    USING (
        user_id = current_user_id()
        OR current_user_is_admin()
        OR bypass_rls_enabled()
    );

-- Only system can INSERT email notifications
CREATE POLICY email_notifications_insert_system ON email_notifications
    FOR INSERT
    WITH CHECK (
        bypass_rls_enabled()
    );

-- Only system can UPDATE email notifications (delivery status)
CREATE POLICY email_notifications_update_system ON email_notifications
    FOR UPDATE
    USING (
        bypass_rls_enabled()
    );


-- ============================================================================
-- Step 10: Create RLS Policies for AUDIT_LOG Table
-- ============================================================================

-- Users can SELECT their own audit logs, admins can see all
CREATE POLICY audit_log_select_own ON audit_log
    FOR SELECT
    USING (
        user_id = current_user_id()
        OR current_user_is_admin()
        OR bypass_rls_enabled()
    );

-- Only system can INSERT audit logs
CREATE POLICY audit_log_insert_system ON audit_log
    FOR INSERT
    WITH CHECK (
        bypass_rls_enabled()
    );

-- Audit logs cannot be updated or deleted (immutable audit trail)


-- ============================================================================
-- Step 11: Grant Necessary Permissions
-- ============================================================================

-- Grant execute on helper functions to PUBLIC
GRANT EXECUTE ON FUNCTION current_user_id() TO PUBLIC;
GRANT EXECUTE ON FUNCTION current_user_is_admin() TO PUBLIC;
GRANT EXECUTE ON FUNCTION bypass_rls_enabled() TO PUBLIC;


-- ============================================================================
-- Step 12: Log Migration Success
-- ============================================================================

INSERT INTO migrations (name, executed_at)
VALUES ('010_enable_rls_all_tables', NOW())
ON CONFLICT (name) DO NOTHING;

COMMIT;


-- ============================================================================
-- Verification Queries (Run After Migration)
-- ============================================================================

-- Test 1: Verify RLS is enabled
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('users', 'documents', 'payments', 'sessions', 'user_identities', 'activity_logs', 'email_notifications', 'audit_log');
-- Expected: rowsecurity = true for all tables


-- Test 2: Verify policies exist
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
-- Expected: Multiple policies for each table


-- Test 3: Simulate user access
-- Set user context
SET LOCAL app.user_id = '1';
SET LOCAL app.is_admin = 'false';

-- This should return only user 1's documents
SELECT COUNT(*) FROM documents;

-- Reset
RESET ALL;


-- ============================================================================
-- Rollback Script (Use Only If Issues Occur)
-- ============================================================================

/*
-- Rollback: Disable RLS and drop policies

BEGIN;

-- Disable RLS on all tables
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE documents DISABLE ROW LEVEL SECURITY;
ALTER TABLE payments DISABLE ROW LEVEL SECURITY;
ALTER TABLE sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_identities DISABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE email_notifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log DISABLE ROW LEVEL SECURITY;

-- Drop all policies (this will drop ALL policies, adjust if needed)
DROP POLICY IF EXISTS users_select_own ON users;
DROP POLICY IF EXISTS users_update_own ON users;
DROP POLICY IF EXISTS users_insert_system ON users;
DROP POLICY IF EXISTS users_delete_admin ON users;

DROP POLICY IF EXISTS documents_select_own ON documents;
DROP POLICY IF EXISTS documents_insert_own ON documents;
DROP POLICY IF EXISTS documents_update_own ON documents;
DROP POLICY IF EXISTS documents_delete_own ON documents;

DROP POLICY IF EXISTS payments_select_own ON payments;
DROP POLICY IF EXISTS payments_insert_system ON payments;
DROP POLICY IF EXISTS payments_update_system ON payments;
DROP POLICY IF EXISTS payments_delete_admin ON payments;

DROP POLICY IF EXISTS sessions_isolation ON sessions;

DROP POLICY IF EXISTS user_identities_select_own ON user_identities;
DROP POLICY IF EXISTS user_identities_insert_system ON user_identities;
DROP POLICY IF EXISTS user_identities_update_system ON user_identities;

DROP POLICY IF EXISTS activity_logs_select_own ON activity_logs;
DROP POLICY IF EXISTS activity_logs_insert_system ON activity_logs;

DROP POLICY IF EXISTS email_notifications_select_own ON email_notifications;
DROP POLICY IF EXISTS email_notifications_insert_system ON email_notifications;
DROP POLICY IF EXISTS email_notifications_update_system ON email_notifications;

DROP POLICY IF EXISTS audit_log_select_own ON audit_log;
DROP POLICY IF EXISTS audit_log_insert_system ON audit_log;

-- Drop helper functions
DROP FUNCTION IF EXISTS current_user_id();
DROP FUNCTION IF EXISTS current_user_is_admin();
DROP FUNCTION IF EXISTS bypass_rls_enabled();

-- Remove migration record
DELETE FROM migrations WHERE name = '010_enable_rls_all_tables';

COMMIT;
*/
```

### Step 2.2: Run Migration in Development

```bash
# Development environment
psql $DATABASE_URL -f migrations/010_enable_rls_all_tables.sql

# Check for errors
echo $?  # Should be 0
```

---

## Phase 3: Application Code Changes

### Step 3.1: Update Authentication Middleware

Modify `middleware/auth.js`:

```javascript
// Add this function after getUserFromAuth
async function setUserContext(client, userId, isAdmin = false) {
  try {
    // Set session variables for RLS
    // Use LOCAL scope so it only applies to current transaction
    await client.query('SELECT set_config($1, $2, TRUE)', ['app.user_id', userId.toString()]);
    await client.query('SELECT set_config($1, $2, TRUE)', ['app.is_admin', isAdmin.toString()]);

    logger.debug('RLS context set', { userId, isAdmin });
  } catch (error) {
    logger.error('Failed to set RLS context', { error: error.message, userId });
    throw new Error('Failed to set security context');
  }
}

// Modify checkJwt middleware - add after line 240 (after req.user = user;):
// Original:
//   const user = await getUserFromAuth(pool, decoded.sub, decoded);
//   req.user = user;

// New:
const user = await getUserFromAuth(pool, decoded.sub, decoded);

if (!user) {
  return res.status(401).json({
    success: false,
    error: 'User verification failed',
    requestId: req.id
  });
}

req.user = user;

// SET RLS CONTEXT - CRITICAL FOR SECURITY
const client = await pool.connect();
try {
  await setUserContext(client, user.id, user.is_admin || false);

  // Store client in request for this transaction
  req.dbClient = client;
} catch (contextError) {
  client.release();
  logger.error('Failed to set user context', { error: contextError.message });
  return res.status(500).json({
    success: false,
    error: 'Security context initialization failed',
    requestId: req.id
  });
}

next();

// Export setUserContext for use elsewhere
module.exports = {
  checkJwt,
  optionalAuth,
  checkAdmin,
  getUserFromAuth,
  setUserContext  // ADD THIS
};
```

### Step 3.2: Update Database Service to Use Transactions

Modify `services/DatabaseService.js`:

```javascript
// Add method to get client with user context
async queryAsUser(userId, sql, params) {
  const client = await this.pool.connect();

  try {
    await client.query('BEGIN');
    await client.query('SELECT set_config($1, $2, TRUE)', ['app.user_id', userId.toString()]);

    const result = await client.query(sql, params);

    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
```

### Step 3.3: Update Webhook Handlers

Modify `routes/payment.js` webhook handler:

```javascript
// At start of webhook handler (line 335):
router.post('/webhook',
  strictLimiter,
  asyncHandler(async (req, res) => {
    // ... signature verification ...

    const pool = req.app.locals.pool;

    // CRITICAL: Set bypass flag for webhook processing
    // Webhooks don't have user context, so we bypass RLS
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      await client.query('SELECT set_config($1, $2, TRUE)', ['app.bypass_rls', 'true']);

      // Process webhook events using this client
      switch (event.type) {
        case 'payment_intent.succeeded':
          await handlePaymentSuccess(client, event.data.object);
          break;
        // ... other cases ...
      }

      await client.query('COMMIT');
      res.status(200).send('Webhook processed');

    } catch (error) {
      await client.query('ROLLBACK');
      logger.logError(error, { type: 'webhook_processing_error' });
      res.status(500).send('Webhook processing failed');
    } finally {
      client.release();
    }
  })
);

// Update handlePaymentSuccess to accept client
async function handlePaymentSuccess(client, paymentIntent) {
  // Use client instead of pool for all queries
  const updateResult = await client.query(
    `UPDATE payments SET status = 'succeeded' WHERE stripe_payment_intent_id = $1`,
    [paymentIntent.id]
  );
  // ... rest of function ...
}
```

### Step 3.4: Update All Route Handlers

For all routes, ensure they use the transaction-scoped client:

```javascript
// OLD PATTERN:
router.get('/:id',
  auth0Middleware,
  asyncHandler(async (req, res) => {
    const pool = req.app.locals.pool;
    const result = await pool.query(/*...*/);
  })
);

// NEW PATTERN (if using transaction middleware):
router.get('/:id',
  auth0Middleware,
  asyncHandler(async (req, res) => {
    // Use req.dbClient if available (from auth middleware)
    // Otherwise, use pool with explicit context setting
    const client = req.dbClient || await req.app.locals.pool.connect();

    try {
      if (!req.dbClient) {
        await client.query('SELECT set_config($1, $2, TRUE)', ['app.user_id', req.user.id.toString()]);
      }

      const result = await client.query(/*...*/);

      res.json(result.rows[0]);
    } finally {
      if (!req.dbClient) {
        client.release();
      }
    }
  })
);
```

**Note**: If auth middleware already sets up `req.dbClient` with proper context, routes can use it directly without additional setup.

---

## Phase 4: Testing

### Step 4.1: Unit Tests

Create `__tests__/security/rls.test.js`:

```javascript
const { Pool } = require('pg');

describe('Row Level Security', () => {
  let pool;

  beforeAll(() => {
    pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
  });

  afterAll(async () => {
    await pool.end();
  });

  test('User can access own documents', async () => {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      await client.query('SELECT set_config($1, $2, TRUE)', ['app.user_id', '1']);

      const result = await client.query('SELECT * FROM documents WHERE user_id = 1');
      expect(result.rows.length).toBeGreaterThan(0);

      await client.query('COMMIT');
    } finally {
      client.release();
    }
  });

  test('User CANNOT access other user documents', async () => {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      await client.query('SELECT set_config($1, $2, TRUE)', ['app.user_id', '1']);

      // Try to access user 2's documents
      const result = await client.query('SELECT * FROM documents WHERE user_id = 2');

      // RLS should prevent access - should return 0 rows
      expect(result.rows.length).toBe(0);

      await client.query('COMMIT');
    } finally {
      client.release();
    }
  });

  test('Bypass flag allows system access', async () => {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      await client.query('SELECT set_config($1, $2, TRUE)', ['app.bypass_rls', 'true']);

      // Should access all documents
      const result = await client.query('SELECT COUNT(*) FROM documents');
      expect(parseInt(result.rows[0].count)).toBeGreaterThan(0);

      await client.query('COMMIT');
    } finally {
      client.release();
    }
  });

  test('Admin can access all user data', async () => {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      await client.query('SELECT set_config($1, $2, TRUE)', ['app.user_id', '999']);  // Admin user
      await client.query('SELECT set_config($1, $2, TRUE)', ['app.is_admin', 'true']);

      // Should access all documents
      const result = await client.query('SELECT COUNT(*) FROM documents');
      expect(parseInt(result.rows[0].count)).toBeGreaterThan(0);

      await client.query('COMMIT');
    } finally {
      client.release();
    }
  });
});
```

Run tests:

```bash
npm test -- __tests__/security/rls.test.js
```

### Step 4.2: Integration Tests

Test all API endpoints:

```bash
# Test normal user flow
curl -H "Authorization: Bearer $TOKEN" http://localhost:3001/api/documents

# Test document access
curl -H "Authorization: Bearer $TOKEN" http://localhost:3001/api/documents/123

# Test create document
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"affidavitData": {...}}' \
  http://localhost:3001/api/documents/save
```

### Step 4.3: Manual Testing Checklist

- [ ] User can log in
- [ ] User can see their documents list
- [ ] User can create a new document
- [ ] User can update their own document
- [ ] User can delete their own document
- [ ] User cannot access another user's document (returns 404, not 403)
- [ ] Webhooks still work (Stripe payment processing)
- [ ] Chat functionality works
- [ ] PDF generation works
- [ ] Payment flow works end-to-end

---

## Phase 5: Deployment

### Step 5.1: Deploy to Staging

```bash
# Run migration on staging database
psql $STAGING_DATABASE_URL -f migrations/010_enable_rls_all_tables.sql

# Deploy application code
git push staging main

# Run full test suite
npm run test:integration
```

### Step 5.2: Monitor Staging

Monitor for 24-48 hours:
- Application logs for RLS errors
- Database slow query log
- API response times (RLS adds ~1-2ms overhead)
- Error rates

### Step 5.3: Deploy to Production

Choose low-traffic window (e.g., Sunday 2 AM):

```bash
# 1. Announce maintenance (if needed)

# 2. Run migration
psql $PRODUCTION_DATABASE_URL -f migrations/010_enable_rls_all_tables.sql

# 3. Deploy application code
git push production main

# 4. Monitor closely for first hour
# Watch logs, error rates, response times

# 5. Run smoke tests
./scripts/smoke-test-production.sh
```

---

## Phase 6: Verification

### Step 6.1: Verify RLS is Active

```sql
-- Connect to production database
psql $PRODUCTION_DATABASE_URL

-- Check RLS is enabled
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('users', 'documents', 'payments');

-- Expected: rowsecurity = true
```

### Step 6.2: Verify Policies

```sql
SELECT tablename, policyname, cmd, qual::text
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Should see multiple policies for each table
```

### Step 6.3: Test Data Isolation

```sql
-- Test as regular user
SET LOCAL app.user_id = '123';
SET LOCAL app.is_admin = 'false';

SELECT COUNT(*) FROM documents;
-- Should return only user 123's documents

SELECT * FROM documents WHERE user_id = 456;
-- Should return 0 rows (user 123 cannot see user 456's data)

RESET ALL;
```

---

## Troubleshooting

### Problem: "Error: Failed to set security context"

**Cause**: Database connection issues or permissions
**Solution**:
```sql
-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION current_user_id() TO your_app_user;
GRANT EXECUTE ON FUNCTION current_user_is_admin() TO your_app_user;
GRANT EXECUTE ON FUNCTION bypass_rls_enabled() TO your_app_user;
```

### Problem: Webhooks Fail with "Permission Denied"

**Cause**: Bypass flag not set
**Solution**: Ensure webhook handler sets `app.bypass_rls = true` before queries

### Problem: Existing Tests Fail

**Cause**: Test setup doesn't set user context
**Solution**: Update test setup:
```javascript
beforeEach(async () => {
  const client = await pool.connect();
  await client.query('SELECT set_config($1, $2, TRUE)', ['app.user_id', testUserId.toString()]);
  await client.query('SELECT set_config($1, $2, TRUE)', ['app.bypass_rls', 'true']);  // For setup
  // ... create test data ...
  client.release();
});
```

### Problem: Performance Degradation

**Cause**: RLS policy evaluation overhead
**Mitigation**:
- RLS adds ~1-2ms per query (acceptable)
- If significant slowdown, check query plans:
```sql
EXPLAIN ANALYZE SELECT * FROM documents WHERE user_id = 123;
```
- Ensure indexes exist on `user_id` columns
- Consider caching for frequently accessed data

### Problem: Admin Cannot See All Data

**Cause**: `app.is_admin` not set
**Solution**: Ensure admin middleware sets flag:
```javascript
await client.query('SELECT set_config($1, $2, TRUE)', ['app.is_admin', 'true']);
```

---

## Rollback Plan

If critical issues occur:

### Step 1: Disable RLS Immediately

```sql
-- Emergency rollback: Disable RLS but keep policies
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE documents DISABLE ROW LEVEL SECURITY;
ALTER TABLE payments DISABLE ROW LEVEL SECURITY;
-- ... etc for all tables
```

This immediately restores pre-RLS behavior while preserving policies for later re-enablement.

### Step 2: Revert Application Code

```bash
git revert <commit-hash>
git push production main
```

### Step 3: Full Rollback (if needed)

Run the rollback script from migration file (commented section at bottom).

---

## Maintenance

### Regular Checks

**Monthly**:
- Review RLS policies for any gaps
- Check audit_log for RLS-related errors
- Verify performance metrics

**Quarterly**:
- Security audit of RLS policies
- Test data isolation with penetration tests
- Review and update policies for new tables

### Policy Updates

When adding new tables:
1. Enable RLS immediately
2. Create appropriate policies
3. Test thoroughly before deploying

---

## Success Criteria

✅ RLS enabled on all user-data tables
✅ All policies created and active
✅ Application code sets user context correctly
✅ All tests pass
✅ No data access errors in logs
✅ Performance impact < 5%
✅ Webhooks and cron jobs work
✅ Manual testing confirms data isolation

---

## Resources

- [PostgreSQL RLS Documentation](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [RLS Best Practices](https://www.postgresql.org/docs/current/sql-createpolicy.html)
- [RLS Performance](https://www.postgresql.org/docs/current/rowsecurity.html)

---

**END OF RLS IMPLEMENTATION GUIDE**
