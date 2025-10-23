# Security Fix: API Key Storage

## Issue Summary
The repository had a potential security vulnerability in the database schema where API keys were stored in plaintext in the `api_keys` table. This posed a significant risk if the database was ever compromised.

## Changes Made

### 1. Database Schema Updates
**Files Modified:**
- `database-schema.sql`
- `database_schema_complete.sql`

**Changes:**
- ❌ Removed: `api_key VARCHAR(255) UNIQUE NOT NULL` (plaintext storage)
- ✅ Kept: `api_key_hash VARCHAR(255) UNIQUE NOT NULL` (hashed version only)
- 📝 Added security comments explaining that keys should only be shown once during creation

**Before:**
```sql
CREATE TABLE IF NOT EXISTS api_keys (
    -- ...
    api_key VARCHAR(255) UNIQUE NOT NULL,
    key_hash VARCHAR(255) NOT NULL,
    -- ...
);
```

**After:**
```sql
-- NOTE: API keys are stored as hashes only for security. The plaintext key
-- should be shown to the user only once during creation and never stored.
CREATE TABLE IF NOT EXISTS api_keys (
    -- ...
    api_key_hash VARCHAR(255) UNIQUE NOT NULL, -- Hashed version for verification
    -- ...
);
```

### 2. Documentation Added
**New File:** `docs/API_KEY_SECURITY.md`

Comprehensive documentation covering:
- Implementation guidelines for creating and verifying API keys
- Best practices for API key management
- Security considerations (hashing algorithms, key length, etc.)
- Code examples for key generation and verification

### 3. Migration Script
**New File:** `migrations/001_secure_api_keys.sql`

A PostgreSQL migration script that:
- Automatically detects the old schema
- Renames `key_hash` to `api_key_hash` if needed
- Drops the plaintext `api_key` column
- Includes verification steps to ensure successful migration

## Security Impact

### Before
- ⚠️ API keys stored in plaintext
- ⚠️ Database compromise = all keys exposed
- ⚠️ No defense against SQL injection exposing keys

### After
- ✅ Only hashed values stored in database
- ✅ Keys shown to users only once during creation
- ✅ Database compromise does not expose working API keys
- ✅ Follows security best practices (OWASP, NIST)

## Next Steps for Implementation

When implementing API key functionality, developers should:

1. **Generate keys securely:**
   ```javascript
   const apiKey = crypto.randomBytes(32).toString('hex');
   ```

2. **Hash before storing:**
   ```javascript
   const apiKeyHash = await bcrypt.hash(apiKey, 10);
   ```

3. **Verify using constant-time comparison:**
   ```javascript
   const isValid = await bcrypt.compare(providedKey, storedHash);
   ```

4. **Show the key only once to the user**

See `docs/API_KEY_SECURITY.md` for complete implementation details.

## Migration for Existing Deployments

If you have an existing database with the old schema:

1. Deploy the new application code that handles hashed keys
2. Run `migrations/001_secure_api_keys.sql`
3. Notify users to regenerate their API keys
4. Monitor logs for any issues

**Note:** Existing API keys cannot be migrated (hashes cannot be reversed). Users must create new keys.

## References
- Original Issue: https://github.com/hordruma/affidavit-maker/issues/[number]
- Line Reference: https://github.com/hordruma/affidavit-maker/blob/f8f79a56951389e05d2214c0173b8557250d2275/database-schema.sql#L237
