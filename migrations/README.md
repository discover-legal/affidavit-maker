# Database Migrations

## TOS Acceptance Migration

### Running the Migration

To add Terms of Service acceptance tracking to your database, run the following SQL migration:

```bash
psql $DATABASE_URL -f migrations/add_tos_acceptance.sql
```

Or if you're using a GUI tool like pgAdmin or TablePlus, simply execute the contents of `add_tos_acceptance.sql`.

### What This Migration Does

This migration adds the following features:

1. **User TOS Tracking Fields** - Adds to the `users` table:
   - `tos_accepted` (BOOLEAN) - Whether user has accepted current TOS
   - `tos_accepted_at` (TIMESTAMP) - When TOS was accepted
   - `tos_version_accepted` (VARCHAR) - Version of TOS accepted (e.g., "1.0.0")
   - `tos_ip_address` (VARCHAR) - IP address from which TOS was accepted

2. **TOS Acceptance Log Table** - Creates new `tos_acceptance_log` table:
   - Tracks historical record of all TOS acceptances
   - Useful for audit trail and compliance
   - Stores: user_id, version, timestamp, IP address, user agent

3. **Indexes** - Adds indexes for performance:
   - Index on `users.tos_accepted` for quick lookups
   - Indexes on `tos_acceptance_log` for audit queries

### Reverting the Migration

If you need to rollback this migration:

```sql
-- Remove indexes
DROP INDEX IF EXISTS idx_users_tos_accepted;
DROP INDEX IF EXISTS idx_tos_log_user_id;
DROP INDEX IF EXISTS idx_tos_log_version;

-- Drop TOS acceptance log table
DROP TABLE IF EXISTS tos_acceptance_log;

-- Remove TOS columns from users table
ALTER TABLE users
  DROP COLUMN IF EXISTS tos_accepted,
  DROP COLUMN IF EXISTS tos_accepted_at,
  DROP COLUMN IF EXISTS tos_version_accepted,
  DROP COLUMN IF EXISTS tos_ip_address;
```

### Testing the Migration

After running the migration, verify it worked:

```sql
-- Check that new columns exist
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'users'
  AND column_name LIKE 'tos%';

-- Check that new table exists
SELECT table_name
FROM information_schema.tables
WHERE table_name = 'tos_acceptance_log';
```

### Migration Notes

- This migration is **safe to run on production** - it only adds new columns with default values
- Existing users will have `tos_accepted = false` by default
- The migration uses `IF NOT EXISTS` and `IF EXISTS` clauses to be idempotent
- No data is deleted or modified, only new fields are added
