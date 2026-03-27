-- ============================================================================
-- Migration 015: Add User Roles for Marketplace
-- ============================================================================
-- Date: 2026-03-26
-- Description: Adds user_role column to the users table for marketplace role
--              differentiation. Roles: client (default), lawyer, admin.
--              Affiliate status is tracked separately in affiliate_accounts,
--              not as a user role.
--
-- Dependencies: 000_initial_schema.sql (users table)
-- ============================================================================

BEGIN;

-- Add user_role column with CHECK constraint
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS user_role VARCHAR(20) DEFAULT 'client'
    CHECK (user_role IN ('client', 'lawyer', 'admin'));

-- Index for role-based queries (e.g., listing all lawyers)
CREATE INDEX IF NOT EXISTS idx_users_role ON users(user_role);

-- Helper function for RLS policies that need the current user's marketplace role.
-- The application layer must SET app.user_role after authentication.
CREATE OR REPLACE FUNCTION current_user_role()
RETURNS TEXT AS $$
BEGIN
  RETURN COALESCE(current_setting('app.user_role', TRUE), 'client');
EXCEPTION WHEN OTHERS THEN
  RETURN 'client';
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION current_user_role() TO PUBLIC;

COMMIT;
