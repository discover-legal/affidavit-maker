# API Key Security Documentation

## Overview
This document explains the secure handling of API keys in the Affidavit Maker application.

## Security Issue Fixed
**Previous Issue**: The `api_keys` table stored API keys in plaintext in the `api_key` column, which posed a significant security risk. If the database was compromised, all API keys would be exposed.

**Current Solution**: API keys are now stored as hashes only. The plaintext API key is shown to the user only once during creation and is never stored in the database.

## Database Schema
The `api_keys` table now stores:
- `api_key_hash`: A hashed version of the API key (SHA-256 or bcrypt recommended)
- Other metadata: key name, scopes, rate limits, usage stats, etc.

## Implementation Guidelines

### Creating an API Key
When creating a new API key:

1. Generate a cryptographically secure random API key:
   ```javascript
   const crypto = require('crypto');
   const apiKey = crypto.randomBytes(32).toString('hex');
   ```

2. Hash the API key before storing:
   ```javascript
   const bcrypt = require('bcrypt');
   const apiKeyHash = await bcrypt.hash(apiKey, 10);
   ```

3. Store only the hash in the database:
   ```javascript
   await db.query(
     'INSERT INTO api_keys (user_id, key_name, api_key_hash, scopes) VALUES ($1, $2, $3, $4)',
     [userId, keyName, apiKeyHash, scopes]
   );
   ```

4. Return the plaintext API key to the user **only once**:
   ```javascript
   return {
     apiKey: apiKey,  // Show this to the user ONCE
     message: 'Save this API key securely. You will not be able to see it again.'
   };
   ```

### Verifying an API Key
When a client makes a request with an API key:

1. Retrieve the API key from the request header:
   ```javascript
   const apiKey = req.headers['x-api-key'];
   ```

2. Query all API key hashes from the database (or implement a lookup mechanism):
   ```javascript
   const apiKeys = await db.query('SELECT id, api_key_hash FROM api_keys WHERE is_active = true');
   ```

3. Verify the API key against each hash:
   ```javascript
   const bcrypt = require('bcrypt');
   
   for (const row of apiKeys.rows) {
     const isMatch = await bcrypt.compare(apiKey, row.api_key_hash);
     if (isMatch) {
       // Valid API key found
       return row.id;
     }
   }
   // No match found
   throw new Error('Invalid API key');
   ```

### Best Practices

1. **Never Log API Keys**: Ensure API keys are not logged in application logs or error messages.

2. **Use HTTPS**: API keys should only be transmitted over HTTPS.

3. **Implement Rate Limiting**: Use the `rate_limit_per_hour` field to prevent abuse.

4. **Set Expiration**: Use the `expires_at` field to automatically expire old API keys.

5. **Track Usage**: Update `total_requests` and `last_used_at` for monitoring.

6. **Allow Revocation**: Use the `is_active` field and `revoked_at` timestamp to allow users to revoke compromised keys.

7. **Prefix API Keys**: Consider using a prefix for API keys (e.g., `affm_live_...` or `affm_test_...`) to make them easily identifiable.

## Migration Notes

If migrating from the old schema that stored plaintext API keys:

1. All existing API keys will need to be regenerated (since the plaintext values cannot be recovered from hashes).
2. Notify users that they need to generate new API keys.
3. Provide a migration period where both old and new keys work (if necessary).
4. Run the following SQL to update the schema:
   ```sql
   -- Remove the old api_key column
   ALTER TABLE api_keys DROP COLUMN IF EXISTS api_key;
   
   -- Rename key_hash to api_key_hash if it exists
   ALTER TABLE api_keys RENAME COLUMN key_hash TO api_key_hash;
   ```

## Security Considerations

- **Hash Algorithm**: Use bcrypt or Argon2 for hashing, as they are designed to be slow and resistant to brute-force attacks.
- **Salt**: bcrypt and Argon2 automatically handle salting, but if using SHA-256, ensure each hash has a unique salt.
- **Key Length**: Generate API keys with at least 256 bits (32 bytes) of entropy.
- **Constant-Time Comparison**: When verifying hashes, use constant-time comparison functions to prevent timing attacks.

## References
- [OWASP API Security Top 10](https://owasp.org/www-project-api-security/)
- [NIST Password Guidelines](https://pages.nist.gov/800-63-3/)
