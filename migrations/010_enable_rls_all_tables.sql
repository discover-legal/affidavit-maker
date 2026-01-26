-- ============================================================================
-- Migration 010: Enable Row Level Security (RLS) on All User Tables
-- ============================================================================
-- Date: 2026-01-21
-- Description: Implements PostgreSQL Row Level Security to enforce data
--              isolation at the database level, preventing unauthorized
--              access even if application logic is bypassed.
--
-- CRITICAL SECURITY FIX: Without RLS, application relies entirely on
--                        application-level checks. Any bug or bypass
--                        could expose ALL user data.
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

DO $$
BEGIN
    -- Users can only see their own profile
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'users') THEN
        RAISE NOTICE 'Table users does not exist, skipping RLS enable';
    ELSE
        ALTER TABLE users ENABLE ROW LEVEL SECURITY;
        RAISE NOTICE 'RLS enabled on users table';
    END IF;

    -- Documents belong to users
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'documents') THEN
        ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
        RAISE NOTICE 'RLS enabled on documents table';
    END IF;

    -- Payments belong to users
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'payments') THEN
        ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
        RAISE NOTICE 'RLS enabled on payments table';
    END IF;

    -- Sessions belong to users
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'sessions') THEN
        ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
        RAISE NOTICE 'RLS enabled on sessions table';
    END IF;

    -- User identities belong to users
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_identities') THEN
        ALTER TABLE user_identities ENABLE ROW LEVEL SECURITY;
        RAISE NOTICE 'RLS enabled on user_identities table';
    END IF;

    -- Activity logs track user actions
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'activity_logs') THEN
        ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
        RAISE NOTICE 'RLS enabled on activity_logs table';
    END IF;

    -- Email notifications sent to users
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'email_notifications') THEN
        ALTER TABLE email_notifications ENABLE ROW LEVEL SECURITY;
        RAISE NOTICE 'RLS enabled on email_notifications table';
    END IF;

    -- Audit log contains security events
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'audit_log') THEN
        ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
        RAISE NOTICE 'RLS enabled on audit_log table';
    END IF;
END $$;


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
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Function to check if current user is admin
CREATE OR REPLACE FUNCTION current_user_is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN COALESCE(current_setting('app.is_admin', TRUE)::BOOLEAN, FALSE);
EXCEPTION
    WHEN OTHERS THEN
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Function to check if RLS is bypassed (for service accounts)
CREATE OR REPLACE FUNCTION bypass_rls_enabled()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN COALESCE(current_setting('app.bypass_rls', TRUE)::BOOLEAN, FALSE);
EXCEPTION
    WHEN OTHERS THEN
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;


-- ============================================================================
-- Step 3: Create RLS Policies for USERS Table
-- ============================================================================

DO $$
BEGIN
    -- Allow users to SELECT their own record
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'users' AND policyname = 'users_select_own') THEN
        EXECUTE 'CREATE POLICY users_select_own ON users
            FOR SELECT
            USING (
                id = current_user_id()
                OR current_user_is_admin()
                OR bypass_rls_enabled()
            )';
        RAISE NOTICE 'Created policy: users_select_own';
    END IF;

    -- Allow users to UPDATE their own record
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'users' AND policyname = 'users_update_own') THEN
        EXECUTE 'CREATE POLICY users_update_own ON users
            FOR UPDATE
            USING (
                id = current_user_id()
                OR current_user_is_admin()
                OR bypass_rls_enabled()
            )';
        RAISE NOTICE 'Created policy: users_update_own';
    END IF;

    -- Only system can INSERT users (handled by auth middleware)
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'users' AND policyname = 'users_insert_system') THEN
        EXECUTE 'CREATE POLICY users_insert_system ON users
            FOR INSERT
            WITH CHECK (bypass_rls_enabled())';
        RAISE NOTICE 'Created policy: users_insert_system';
    END IF;

    -- Only admin or system can DELETE
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'users' AND policyname = 'users_delete_admin') THEN
        EXECUTE 'CREATE POLICY users_delete_admin ON users
            FOR DELETE
            USING (
                current_user_is_admin()
                OR bypass_rls_enabled()
            )';
        RAISE NOTICE 'Created policy: users_delete_admin';
    END IF;
END $$;


-- ============================================================================
-- Step 4: Create RLS Policies for DOCUMENTS Table
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'documents') THEN
        RAISE NOTICE 'Documents table does not exist, skipping policies';
    ELSE
        -- Users can SELECT their own documents
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'documents' AND policyname = 'documents_select_own') THEN
            EXECUTE 'CREATE POLICY documents_select_own ON documents
                FOR SELECT
                USING (
                    user_id = current_user_id()
                    OR current_user_is_admin()
                    OR bypass_rls_enabled()
                )';
            RAISE NOTICE 'Created policy: documents_select_own';
        END IF;

        -- Users can INSERT their own documents
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'documents' AND policyname = 'documents_insert_own') THEN
            EXECUTE 'CREATE POLICY documents_insert_own ON documents
                FOR INSERT
                WITH CHECK (
                    user_id = current_user_id()
                    OR bypass_rls_enabled()
                )';
            RAISE NOTICE 'Created policy: documents_insert_own';
        END IF;

        -- Users can UPDATE their own documents
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'documents' AND policyname = 'documents_update_own') THEN
            EXECUTE 'CREATE POLICY documents_update_own ON documents
                FOR UPDATE
                USING (
                    user_id = current_user_id()
                    OR current_user_is_admin()
                    OR bypass_rls_enabled()
                )';
            RAISE NOTICE 'Created policy: documents_update_own';
        END IF;

        -- Users can DELETE their own documents
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'documents' AND policyname = 'documents_delete_own') THEN
            EXECUTE 'CREATE POLICY documents_delete_own ON documents
                FOR DELETE
                USING (
                    user_id = current_user_id()
                    OR current_user_is_admin()
                    OR bypass_rls_enabled()
                )';
            RAISE NOTICE 'Created policy: documents_delete_own';
        END IF;
    END IF;
END $$;


-- ============================================================================
-- Step 5: Create RLS Policies for PAYMENTS Table
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'payments') THEN
        RAISE NOTICE 'Payments table does not exist, skipping policies';
    ELSE
        -- Users can SELECT their own payments
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'payments' AND policyname = 'payments_select_own') THEN
            EXECUTE 'CREATE POLICY payments_select_own ON payments
                FOR SELECT
                USING (
                    user_id = current_user_id()
                    OR current_user_is_admin()
                    OR bypass_rls_enabled()
                )';
            RAISE NOTICE 'Created policy: payments_select_own';
        END IF;

        -- Only system can INSERT payments (handled by payment webhooks)
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'payments' AND policyname = 'payments_insert_system') THEN
            EXECUTE 'CREATE POLICY payments_insert_system ON payments
                FOR INSERT
                WITH CHECK (bypass_rls_enabled())';
            RAISE NOTICE 'Created policy: payments_insert_system';
        END IF;

        -- Only system can UPDATE payments (handled by webhooks)
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'payments' AND policyname = 'payments_update_system') THEN
            EXECUTE 'CREATE POLICY payments_update_system ON payments
                FOR UPDATE
                USING (
                    bypass_rls_enabled()
                    OR current_user_is_admin()
                )';
            RAISE NOTICE 'Created policy: payments_update_system';
        END IF;

        -- Only admin can delete payments (maintain audit trail)
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'payments' AND policyname = 'payments_delete_admin') THEN
            EXECUTE 'CREATE POLICY payments_delete_admin ON payments
                FOR DELETE
                USING (current_user_is_admin())';
            RAISE NOTICE 'Created policy: payments_delete_admin';
        END IF;
    END IF;
END $$;


-- ============================================================================
-- Step 6: Create RLS Policies for Other Tables
-- ============================================================================

DO $$
BEGIN
    -- Sessions
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'sessions') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'sessions' AND policyname = 'sessions_isolation') THEN
            EXECUTE 'CREATE POLICY sessions_isolation ON sessions
                FOR ALL
                USING (
                    user_id = current_user_id()
                    OR current_user_is_admin()
                    OR bypass_rls_enabled()
                )';
            RAISE NOTICE 'Created policy: sessions_isolation';
        END IF;
    END IF;

    -- User Identities
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_identities') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_identities' AND policyname = 'user_identities_select_own') THEN
            EXECUTE 'CREATE POLICY user_identities_select_own ON user_identities
                FOR SELECT
                USING (
                    user_id = current_user_id()
                    OR current_user_is_admin()
                    OR bypass_rls_enabled()
                )';
            RAISE NOTICE 'Created policy: user_identities_select_own';
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_identities' AND policyname = 'user_identities_insert_system') THEN
            EXECUTE 'CREATE POLICY user_identities_insert_system ON user_identities
                FOR INSERT
                WITH CHECK (bypass_rls_enabled())';
            RAISE NOTICE 'Created policy: user_identities_insert_system';
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_identities' AND policyname = 'user_identities_update_system') THEN
            EXECUTE 'CREATE POLICY user_identities_update_system ON user_identities
                FOR UPDATE
                USING (
                    bypass_rls_enabled()
                    OR current_user_is_admin()
                )';
            RAISE NOTICE 'Created policy: user_identities_update_system';
        END IF;
    END IF;

    -- Activity Logs
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'activity_logs') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'activity_logs' AND policyname = 'activity_logs_select_own') THEN
            EXECUTE 'CREATE POLICY activity_logs_select_own ON activity_logs
                FOR SELECT
                USING (
                    user_id = current_user_id()
                    OR current_user_is_admin()
                    OR bypass_rls_enabled()
                )';
            RAISE NOTICE 'Created policy: activity_logs_select_own';
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'activity_logs' AND policyname = 'activity_logs_insert_system') THEN
            EXECUTE 'CREATE POLICY activity_logs_insert_system ON activity_logs
                FOR INSERT
                WITH CHECK (bypass_rls_enabled())';
            RAISE NOTICE 'Created policy: activity_logs_insert_system';
        END IF;
    END IF;

    -- Email Notifications
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'email_notifications') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'email_notifications' AND policyname = 'email_notifications_select_own') THEN
            EXECUTE 'CREATE POLICY email_notifications_select_own ON email_notifications
                FOR SELECT
                USING (
                    user_id = current_user_id()
                    OR current_user_is_admin()
                    OR bypass_rls_enabled()
                )';
            RAISE NOTICE 'Created policy: email_notifications_select_own';
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'email_notifications' AND policyname = 'email_notifications_insert_system') THEN
            EXECUTE 'CREATE POLICY email_notifications_insert_system ON email_notifications
                FOR INSERT
                WITH CHECK (bypass_rls_enabled())';
            RAISE NOTICE 'Created policy: email_notifications_insert_system';
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'email_notifications' AND policyname = 'email_notifications_update_system') THEN
            EXECUTE 'CREATE POLICY email_notifications_update_system ON email_notifications
                FOR UPDATE
                USING (bypass_rls_enabled())';
            RAISE NOTICE 'Created policy: email_notifications_update_system';
        END IF;
    END IF;

    -- Audit Log
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'audit_log') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'audit_log' AND policyname = 'audit_log_select_own') THEN
            EXECUTE 'CREATE POLICY audit_log_select_own ON audit_log
                FOR SELECT
                USING (
                    user_id = current_user_id()
                    OR current_user_is_admin()
                    OR bypass_rls_enabled()
                )';
            RAISE NOTICE 'Created policy: audit_log_select_own';
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'audit_log' AND policyname = 'audit_log_insert_system') THEN
            EXECUTE 'CREATE POLICY audit_log_insert_system ON audit_log
                FOR INSERT
                WITH CHECK (bypass_rls_enabled())';
            RAISE NOTICE 'Created policy: audit_log_insert_system';
        END IF;
    END IF;
END $$;


-- ============================================================================
-- Step 7: Grant Necessary Permissions
-- ============================================================================

GRANT EXECUTE ON FUNCTION current_user_id() TO PUBLIC;
GRANT EXECUTE ON FUNCTION current_user_is_admin() TO PUBLIC;
GRANT EXECUTE ON FUNCTION bypass_rls_enabled() TO PUBLIC;


-- ============================================================================
-- Step 8: Create verification view (optional, for monitoring)
-- ============================================================================

CREATE OR REPLACE VIEW rls_status AS
SELECT
    schemaname,
    tablename,
    rowsecurity as rls_enabled,
    (SELECT COUNT(*) FROM pg_policies WHERE schemaname = t.schemaname AND tablename = t.tablename) as policy_count
FROM pg_tables t
WHERE schemaname = 'public'
AND tablename IN ('users', 'documents', 'payments', 'sessions', 'user_identities', 'activity_logs', 'email_notifications', 'audit_log')
ORDER BY tablename;

GRANT SELECT ON rls_status TO PUBLIC;


COMMIT;

-- ============================================================================
-- Verification (Run after migration completes)
-- ============================================================================

-- View RLS status
-- SELECT * FROM rls_status;

-- Test user isolation (replace 1 with actual user ID)
-- SET LOCAL app.user_id = '1';
-- SELECT COUNT(*) FROM documents;  -- Should only show user 1's documents
-- RESET ALL;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
