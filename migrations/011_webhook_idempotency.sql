-- ============================================================================
-- Migration 011: Add Webhook Idempotency Protection
-- ============================================================================
-- Date: 2026-01-21
-- Description: Prevents duplicate webhook processing by tracking processed
--              events. Stripe may send the same webhook multiple times due
--              to network issues, timeouts, or retries.
--
-- CRITICAL SECURITY FIX: Without idempotency, webhooks could be processed
--                        multiple times, leading to:
--                        - Duplicate payment credits
--                        - Data corruption
--                        - Race conditions
--
-- ============================================================================

BEGIN;

-- ============================================================================
-- Step 1: Create Processed Webhook Events Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS processed_webhook_events (
    id SERIAL PRIMARY KEY,

    -- Stripe event ID (globally unique)
    stripe_event_id VARCHAR(255) UNIQUE NOT NULL,

    -- Event type for quick filtering
    event_type VARCHAR(100) NOT NULL,

    -- When this event was processed
    processed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Additional metadata about processing
    metadata JSONB DEFAULT '{}'::jsonb,

    -- Processing status (success, failed, skipped)
    status VARCHAR(50) DEFAULT 'success',

    -- Error message if processing failed
    error_message TEXT,

    -- Created timestamp
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Index for cleanup
    CONSTRAINT chk_status CHECK (status IN ('success', 'failed', 'skipped', 'duplicate'))
);

-- ============================================================================
-- Step 2: Create Indexes
-- ============================================================================

-- Primary lookup index (used on every webhook)
CREATE INDEX IF NOT EXISTS idx_webhook_events_stripe_id
ON processed_webhook_events(stripe_event_id);

-- For cleanup queries
CREATE INDEX IF NOT EXISTS idx_webhook_events_created_at
ON processed_webhook_events(created_at);

-- For monitoring and analytics
CREATE INDEX IF NOT EXISTS idx_webhook_events_type_status
ON processed_webhook_events(event_type, status);

-- ============================================================================
-- Step 3: Create Cleanup Function
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_old_webhook_events()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Delete events older than 30 days
    -- Stripe recommends keeping webhook logs for at least 30 days
    DELETE FROM processed_webhook_events
    WHERE created_at < NOW() - INTERVAL '30 days'
    AND status = 'success';  -- Only delete successful ones

    GET DIAGNOSTICS deleted_count = ROW_COUNT;

    RAISE NOTICE 'Cleaned up % old webhook events', deleted_count;

    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Step 4: Create Helper Function to Check if Event is Processed
-- ============================================================================

CREATE OR REPLACE FUNCTION is_webhook_event_processed(p_event_id VARCHAR)
RETURNS BOOLEAN AS $$
DECLARE
    event_exists BOOLEAN;
BEGIN
    SELECT EXISTS(
        SELECT 1 FROM processed_webhook_events
        WHERE stripe_event_id = p_event_id
    ) INTO event_exists;

    RETURN event_exists;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- Step 5: Create Function to Record Webhook Processing
-- ============================================================================

CREATE OR REPLACE FUNCTION record_webhook_event(
    p_event_id VARCHAR,
    p_event_type VARCHAR,
    p_status VARCHAR DEFAULT 'success',
    p_metadata JSONB DEFAULT '{}'::jsonb,
    p_error_message TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO processed_webhook_events (
        stripe_event_id,
        event_type,
        status,
        metadata,
        error_message,
        processed_at
    ) VALUES (
        p_event_id,
        p_event_type,
        p_status,
        p_metadata,
        p_error_message,
        NOW()
    )
    ON CONFLICT (stripe_event_id) DO UPDATE
    SET
        -- If duplicate, update status to 'duplicate'
        status = 'duplicate',
        metadata = jsonb_set(
            processed_webhook_events.metadata,
            '{duplicate_attempts}',
            COALESCE(
                (processed_webhook_events.metadata->>'duplicate_attempts')::int + 1,
                1
            )::text::jsonb
        ),
        processed_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Step 6: Enable RLS on Webhook Events Table (if RLS migration ran)
-- ============================================================================

DO $$
BEGIN
    -- Check if RLS functions exist (from migration 010)
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'bypass_rls_enabled') THEN
        -- Enable RLS
        ALTER TABLE processed_webhook_events ENABLE ROW LEVEL SECURITY;

        -- Only system/admin can access webhook events
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'processed_webhook_events' AND policyname = 'webhook_events_system_only') THEN
            CREATE POLICY webhook_events_system_only ON processed_webhook_events
                FOR ALL
                USING (
                    bypass_rls_enabled()
                    OR current_user_is_admin()
                );
            RAISE NOTICE 'RLS policy created for processed_webhook_events';
        END IF;
    ELSE
        RAISE NOTICE 'RLS functions not found, skipping RLS for webhook events table';
    END IF;
END $$;

-- ============================================================================
-- Step 7: Create View for Monitoring
-- ============================================================================

CREATE OR REPLACE VIEW webhook_processing_stats AS
SELECT
    event_type,
    status,
    COUNT(*) as count,
    MIN(created_at) as first_seen,
    MAX(created_at) as last_seen,
    MAX(created_at) - MIN(created_at) as time_span
FROM processed_webhook_events
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY event_type, status
ORDER BY event_type, status;

GRANT SELECT ON webhook_processing_stats TO PUBLIC;

-- ============================================================================
-- Step 8: Log Migration Success
-- ============================================================================

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'migrations') THEN
        INSERT INTO migrations (name, executed_at)
        VALUES ('011_webhook_idempotency', NOW())
        ON CONFLICT (name) DO NOTHING;
        RAISE NOTICE 'Migration 011 logged successfully';
    ELSE
        RAISE NOTICE 'Migrations table does not exist, skipping log';
    END IF;
END $$;

COMMIT;

-- ============================================================================
-- Usage Examples
-- ============================================================================

/*
-- Check if event already processed (in webhook handler):
SELECT is_webhook_event_processed('evt_1234567890abcdef');

-- Record successful webhook processing:
SELECT record_webhook_event(
    'evt_1234567890abcdef',
    'payment_intent.succeeded',
    'success',
    '{"amount": 7900, "document_id": 123}'::jsonb
);

-- Record failed webhook processing:
SELECT record_webhook_event(
    'evt_abcdefghijk12345',
    'payment_intent.failed',
    'failed',
    '{}'::jsonb,
    'Database connection timeout'
);

-- View webhook processing stats:
SELECT * FROM webhook_processing_stats;

-- Manual cleanup (run as cron job):
SELECT cleanup_old_webhook_events();

-- Check recent duplicate attempts:
SELECT * FROM processed_webhook_events
WHERE status = 'duplicate'
AND created_at > NOW() - INTERVAL '1 day'
ORDER BY processed_at DESC;
*/

-- ============================================================================
-- Verification
-- ============================================================================

-- Verify table created
-- SELECT COUNT(*) FROM processed_webhook_events;

-- Verify indexes
-- SELECT indexname FROM pg_indexes WHERE tablename = 'processed_webhook_events';

-- Verify functions
-- SELECT proname FROM pg_proc WHERE proname LIKE '%webhook%';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
