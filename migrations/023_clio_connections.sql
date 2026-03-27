-- ============================================================================
-- Migration 023: Clio Connections
-- ============================================================================
-- Date: 2026-03-26
-- Description: Stores OAuth2 connections to Clio (legal practice management
--              software). Tokens are AES-256-GCM encrypted at the application
--              layer before storage. One connection per user (UNIQUE on user_id).
--
-- Dependencies: 000_initial_schema.sql (users table),
--               010_enable_rls_all_tables.sql (RLS helper functions)
-- ============================================================================

BEGIN;

-- ============================================================================
-- Step 1: Create clio_connections Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS clio_connections (
  id                  SERIAL PRIMARY KEY,
  user_id             INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  clio_user_id        VARCHAR(255),
  access_token        TEXT NOT NULL,        -- AES-256-GCM encrypted (iv:ciphertext:tag)
  refresh_token       TEXT NOT NULL,        -- AES-256-GCM encrypted
  token_expires_at    TIMESTAMP NOT NULL,
  clio_instance_url   VARCHAR(1000),
  scopes              TEXT[] DEFAULT '{}',
  last_sync_at        TIMESTAMP,
  sync_status         VARCHAR(20) DEFAULT 'idle'
                        CHECK (sync_status IN ('idle', 'syncing', 'error')),
  sync_error          TEXT,
  is_active           BOOLEAN DEFAULT true,
  created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- Step 2: Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_clio_user ON clio_connections(user_id);

-- ============================================================================
-- Step 3: Enable Row Level Security
-- ============================================================================

ALTER TABLE clio_connections ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Step 4: RLS Policies
-- ============================================================================
-- Rules:
--   SELECT: User can see their own connection. Admins can see all (for support).
--   INSERT: User can insert their own connection only.
--   UPDATE: User can update their own connection only.
--   DELETE: User can delete their own connection. Admins can delete any.

DO $$
BEGIN
    -- SELECT: own row or admin
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'clio_connections' AND policyname = 'clio_connections_select_own') THEN
        EXECUTE 'CREATE POLICY clio_connections_select_own ON clio_connections
            FOR SELECT
            USING (
                user_id = current_user_id()
                OR current_user_is_admin()
                OR bypass_rls_enabled()
            )';
        RAISE NOTICE 'Created policy: clio_connections_select_own';
    END IF;

    -- INSERT: own row only
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'clio_connections' AND policyname = 'clio_connections_insert_own') THEN
        EXECUTE 'CREATE POLICY clio_connections_insert_own ON clio_connections
            FOR INSERT
            WITH CHECK (
                user_id = current_user_id()
                OR bypass_rls_enabled()
            )';
        RAISE NOTICE 'Created policy: clio_connections_insert_own';
    END IF;

    -- UPDATE: own row only
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'clio_connections' AND policyname = 'clio_connections_update_own') THEN
        EXECUTE 'CREATE POLICY clio_connections_update_own ON clio_connections
            FOR UPDATE
            USING (
                user_id = current_user_id()
                OR bypass_rls_enabled()
            )';
        RAISE NOTICE 'Created policy: clio_connections_update_own';
    END IF;

    -- DELETE: own row or admin
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'clio_connections' AND policyname = 'clio_connections_delete_own') THEN
        EXECUTE 'CREATE POLICY clio_connections_delete_own ON clio_connections
            FOR DELETE
            USING (
                user_id = current_user_id()
                OR current_user_is_admin()
                OR bypass_rls_enabled()
            )';
        RAISE NOTICE 'Created policy: clio_connections_delete_own';
    END IF;
END $$;

-- ============================================================================
-- Step 5: Updated_at trigger
-- ============================================================================
-- Reuse update_updated_at_column() from migration 000.

DROP TRIGGER IF EXISTS clio_connections_updated_at ON clio_connections;
CREATE TRIGGER clio_connections_updated_at
  BEFORE UPDATE ON clio_connections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMIT;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
