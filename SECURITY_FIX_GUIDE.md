# Security Fix Guide - Account Takeover Vulnerability

**Date**: 2026-01-03
**Severity**: CRITICAL (CVSS 9.1)
**Status**: ✅ FIXED

---

## Overview

This guide documents the fix for a critical account takeover vulnerability that allowed attackers to gain full access to user accounts by signing up with the same email address using a different authentication provider.

---

## What Was Fixed

### The Vulnerability
Both authentication middleware files contained insecure "account linking" logic that automatically overwrote existing users' Auth0 IDs when duplicate emails were detected, effectively transferring account ownership to attackers.

### The Fix
1. **Removed insecure account linking** - Duplicate email signups are now properly rejected
2. **Added proper multi-provider support** - New database schema allows secure account linking in the future
3. **Added audit logging** - All security events are now tracked
4. **Backwards compatible** - Existing users continue to work without migration

---

## Files Changed

### Core Security Fixes
1. `/middleware/auth0Middleware.js` - Fixed loadUser() function
2. `/middleware/auth.js` - Fixed getUserFromAuth() function

### New Database Schema
3. `/migrations/001_add_user_identities_and_audit_log.sql` - Database migration

### Documentation
4. `/SECURITY_ANALYSIS_CRITICAL.md` - Root cause analysis
5. `/SECURITY_FIX_GUIDE.md` - This file

---

## How to Apply the Fix

### Step 1: Review the Changes

**Before deploying**, review the code changes:

```bash
# Review middleware changes
git diff HEAD~1 middleware/auth0Middleware.js
git diff HEAD~1 middleware/auth.js

# Review migration script
cat migrations/001_add_user_identities_and_audit_log.sql
```

### Step 2: Run Database Migration

The migration script is **safe to run** on production. It:
- Creates new tables without modifying existing ones
- Migrates existing users automatically
- Adds helpful database functions
- Is idempotent (safe to run multiple times)

**Run the migration:**

```bash
# Development
psql -d affidavit_maker_dev -f migrations/001_add_user_identities_and_audit_log.sql

# Production (replace with your connection string)
psql $DATABASE_URL -f migrations/001_add_user_identities_and_audit_log.sql
```

### Step 3: Verify Migration Success

```sql
-- Check that new tables were created
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('user_identities', 'audit_log', 'account_linking_requests');

-- Verify existing users were migrated
SELECT COUNT(*) FROM user_identities;
SELECT COUNT(*) FROM users;
-- These counts should be equal

-- Check sample data
SELECT ui.*, u.email
FROM user_identities ui
JOIN users u ON ui.user_id = u.id
LIMIT 5;
```

### Step 4: Deploy Code Changes

Deploy the updated middleware files to your production environment.

```bash
# If using Docker
docker-compose down
docker-compose up -d --build

# If using PM2
pm2 restart affidavit-maker

# If using systemd
sudo systemctl restart affidavit-maker
```

### Step 5: Monitor for Issues

After deployment, monitor logs for:

```bash
# Look for blocked duplicate email attempts (expected)
grep "SECURITY: Attempted signup with existing email" logs/app.log

# Look for any authentication errors (investigate if found)
grep "User verification failed" logs/app.log

# Check audit log in database
SELECT * FROM audit_log
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;
```

---

## Testing the Fix

### Test 1: Verify Existing Users Still Work

1. Log in with an existing user account
2. Verify you can see your affidavits
3. Verify you can create/edit affidavits
4. Check logs for any errors

**Expected**: ✅ Everything works normally

### Test 2: Verify Duplicate Email Protection

1. Create a test account with `test@example.com` via email/password
2. Try to create another account with `test@example.com` via Google OAuth
3. Verify you receive a 409 error with message:
   ```
   "An account with this email address already exists.
   Please sign in using your original authentication method..."
   ```

**Expected**: ✅ Second signup is blocked with clear error message

### Test 3: Verify Audit Logging

```sql
-- Check recent audit events
SELECT * FROM audit_log
WHERE event_type IN ('account_created', 'duplicate_email_signup_blocked')
ORDER BY created_at DESC
LIMIT 10;
```

**Expected**: ✅ Audit log shows account creations and any blocked duplicate signups

### Test 4: Verify User Identities

```sql
-- Check user identities for a test account
SELECT u.email, ui.auth0_id, ui.provider, ui.is_primary, ui.verified
FROM users u
JOIN user_identities ui ON u.id = ui.user_id
WHERE u.email = 'test@example.com';
```

**Expected**: ✅ Each user has at least one identity record

---

## What Changed in the Code

### Before (VULNERABLE)

```javascript
// When duplicate email detected...
if (createError.code === '23505' && createError.constraint === 'users_email_key') {
  // ❌ OVERWRITES existing user's auth0_id
  const linkResult = await pool.query(
    `UPDATE users SET auth0_id = $1 WHERE email = $2`,
    [auth0Id, email]
  );
}
```

### After (SECURE)

```javascript
// When duplicate email detected...
if (createError.code === '23505' && createError.constraint === 'users_email_key') {
  // ✅ REJECTS signup and logs security event
  logger.warn('SECURITY: Attempted signup with existing email', { email, auth0Id });

  await logAuditEvent(pool, null, 'duplicate_email_signup_blocked', ...);

  return res.status(409).json({
    error: 'An account with this email already exists. Please sign in using your original authentication method.'
  });
}
```

---

## New Database Schema

### user_identities Table

Allows users to securely link multiple authentication providers:

```sql
CREATE TABLE user_identities (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    auth0_id VARCHAR(255) UNIQUE NOT NULL,
    provider VARCHAR(50) NOT NULL,
    is_primary BOOLEAN DEFAULT false,
    verified BOOLEAN DEFAULT false,
    linked_at TIMESTAMP,
    last_used_at TIMESTAMP
);
```

**Key Features:**
- One user can have multiple identities (future account linking)
- Each auth0_id is globally unique
- Primary identity is marked
- Tracks when each identity is used

### audit_log Table

Tracks all security-sensitive operations:

```sql
CREATE TABLE audit_log (
    id SERIAL PRIMARY KEY,
    user_id INTEGER,
    event_type VARCHAR(100) NOT NULL,
    event_category VARCHAR(50) NOT NULL,
    severity VARCHAR(20) DEFAULT 'info',
    description TEXT,
    metadata JSONB,
    ip_address VARCHAR(45),
    created_at TIMESTAMP
);
```

**Key Events Logged:**
- `account_created` - New user signup
- `duplicate_email_signup_blocked` - Security event
- `identity_linked` - Account linking (future)
- `auth0_id_changed` - Critical security event (should never happen)

### account_linking_requests Table

For future secure account linking feature:

```sql
CREATE TABLE account_linking_requests (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    new_auth0_id VARCHAR(255) NOT NULL,
    new_provider VARCHAR(50) NOT NULL,
    verification_token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    status VARCHAR(50) DEFAULT 'pending'
);
```

---

## Future: Secure Account Linking

If you want to allow users to link multiple authentication methods in the future, use this secure flow:

### User Flow

1. **User logs in** to their existing account
2. **User navigates** to Account Settings
3. **User clicks** "Link Google Account" (or other provider)
4. **System sends** verification email
5. **User confirms** via email link
6. **System creates** new identity in user_identities table
7. **User can now** log in with either method

### Implementation

Use the provided `link_identity_to_user()` database function:

```sql
SELECT link_identity_to_user(
    user_id := 123,
    p_auth0_id := 'google-oauth2|xyz789',
    p_provider := 'google-oauth2',
    p_ip_address := '192.168.1.1'
);
```

This function:
- ✅ Validates the identity isn't already linked
- ✅ Creates audit log entry
- ✅ Is secure and atomic

---

## Rollback Plan

If you need to rollback (not recommended unless critical issue):

### Step 1: Revert Code Changes

```bash
git revert HEAD
git push origin claude/investigate-visibility-bug-2Q4Vk
```

### Step 2: Remove Migration (Optional)

**⚠️ WARNING**: This will delete audit logs and user identities

```sql
-- Only if absolutely necessary
DROP TABLE IF EXISTS account_linking_requests;
DROP TABLE IF EXISTS audit_log CASCADE;
DROP TABLE IF EXISTS user_identities CASCADE;
DROP FUNCTION IF EXISTS log_audit_event;
DROP FUNCTION IF EXISTS link_identity_to_user;
DROP TRIGGER IF EXISTS log_auth0_id_changes ON users;
```

**Better approach**: Keep the new tables and functions. They don't hurt anything and provide security value.

---

## Monitoring and Alerts

### Recommended Alerts

Set up alerts for these audit log events:

```sql
-- Critical: auth0_id was changed (should NEVER happen now)
SELECT * FROM audit_log
WHERE event_type = 'auth0_id_changed'
AND severity = 'critical';

-- Warning: Duplicate email signup attempts
SELECT COUNT(*) FROM audit_log
WHERE event_type = 'duplicate_email_signup_blocked'
AND created_at > NOW() - INTERVAL '1 hour';
-- If > 10 per hour, possible attack
```

### Log Monitoring

Monitor application logs for:

```bash
# Security warnings
grep "SECURITY:" logs/app.log

# Duplicate email attempts
grep "duplicate_email_signup_blocked" logs/app.log

# Authentication failures
grep "User verification failed" logs/app.log
```

---

## FAQs

### Q: Will this break existing user logins?

**A:** No. The code includes backwards compatibility. It first checks `user_identities`, then falls back to legacy `users.auth0_id`.

### Q: Do I need to migrate existing data?

**A:** The migration script automatically migrates all existing users to the `user_identities` table. No manual data migration needed.

### Q: What happens if a user tries to sign up with an existing email?

**A:** They receive a clear 409 error message telling them to use their original authentication method. The signup is blocked and logged.

### Q: Can users link multiple accounts now?

**A:** Not yet. The infrastructure is in place, but the UI and verification flow need to be implemented. See "Future: Secure Account Linking" section.

### Q: Will the audit log table grow too large?

**A:** Monitor size and implement log rotation if needed:

```sql
-- Archive old logs (run monthly)
DELETE FROM audit_log
WHERE created_at < NOW() - INTERVAL '90 days'
AND severity NOT IN ('error', 'critical');
```

### Q: Is this fix backwards compatible?

**A:** Yes, 100%. Existing users, existing code, existing integrations all continue to work.

---

## Support

If you encounter any issues:

1. Check the audit_log table for security events
2. Review application logs for error messages
3. Verify database migration completed successfully
4. Test with a new test account to isolate the issue

---

## Summary

✅ **Vulnerability fixed** - Account takeover via duplicate email is now blocked
✅ **Audit logging added** - Security events are tracked
✅ **Future-proof** - Infrastructure for secure account linking is ready
✅ **Backwards compatible** - Existing users unaffected
✅ **Production ready** - Safe to deploy immediately

**The system is now secure against this attack vector.**
