-- Migration script to secure API key storage
-- This script removes the plaintext api_key column and ensures only hashed keys are stored
--
-- WARNING: This will invalidate all existing API keys!
-- Users will need to regenerate their API keys after this migration.
--
-- Run this script AFTER deploying the new application code that handles
-- API key creation and verification using hashes only.

BEGIN;

-- Check if the old schema exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'api_keys' 
        AND column_name = 'api_key'
    ) THEN
        RAISE NOTICE 'Old api_key column found. Starting migration...';
        
        -- Check if key_hash column exists (old name)
        IF EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_name = 'api_keys' 
            AND column_name = 'key_hash'
        ) THEN
            -- Rename key_hash to api_key_hash
            ALTER TABLE api_keys RENAME COLUMN key_hash TO api_key_hash;
            RAISE NOTICE 'Renamed key_hash to api_key_hash';
        END IF;
        
        -- Drop the plaintext api_key column
        ALTER TABLE api_keys DROP COLUMN api_key;
        RAISE NOTICE 'Dropped plaintext api_key column';
        
        -- Optional: Clear all existing API keys (since they cannot be verified anymore)
        -- Uncomment the next line if you want to clear all existing keys
        -- DELETE FROM api_keys;
        -- RAISE NOTICE 'Cleared all existing API keys';
        
    ELSE
        RAISE NOTICE 'Already using secure API key storage. No migration needed.';
    END IF;
    
    -- Verify the new schema
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'api_keys' 
        AND column_name = 'api_key_hash'
    ) THEN
        RAISE EXCEPTION 'Migration failed: api_key_hash column not found';
    END IF;
    
    RAISE NOTICE 'Migration completed successfully!';
END $$;

COMMIT;

-- Display the current schema for verification
SELECT 
    column_name, 
    data_type, 
    character_maximum_length,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'api_keys'
ORDER BY ordinal_position;
