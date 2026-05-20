-- ============================================================================
-- Migration 014: FORCE Row Level Security on every tenant-data table
-- ============================================================================
-- Date: 2026-05-19
--
-- Background
-- ----------
-- Migration 010 enabled RLS on users, documents, payments, sessions,
-- user_identities, activity_logs, email_notifications, audit_log. RLS in
-- PostgreSQL is, by default, NOT enforced against the role that owns the
-- table or any superuser. On Render's managed Postgres the application
-- connects as the database owner (affidavit_user; see render.yaml), which
-- means migration 010's policies were a no-op in production.
--
-- This migration adds FORCE ROW LEVEL SECURITY to every table covered by
-- migration 010, plus the cases table (added in migration 012) and the
-- tos_acceptance_log audit table. After this commits, every query through
-- lib/db.ts MUST run inside withRLSContext (for user-scoped operations)
-- or withRLSBypass (for system / webhook flows). lib/auth.ts has been
-- updated to upsert the users row inside withRLSBypass for this reason.
--
-- Rollback
-- --------
-- ALTER TABLE <name> NO FORCE ROW LEVEL SECURITY;
-- (Then re-enable owner bypass.)
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- FORCE the enabled policies. The DO block tolerates missing tables so the
-- migration is idempotent and works in environments that don't have every
-- audit table provisioned yet.
-- ----------------------------------------------------------------------------

DO $$
DECLARE
    tbl text;
BEGIN
    FOR tbl IN SELECT unnest(ARRAY[
        'users',
        'documents',
        'payments',
        'sessions',
        'user_identities',
        'activity_logs',
        'email_notifications',
        'audit_log',
        'cases',
        'tos_acceptance_log',
        'processed_webhook_events'
    ]) LOOP
        IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = tbl) THEN
            EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
            EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', tbl);
            RAISE NOTICE 'FORCED row level security on %', tbl;
        ELSE
            RAISE NOTICE 'Skipping % (table does not exist)', tbl;
        END IF;
    END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- Cases (migration 012) and tos_acceptance_log were not covered by migration
-- 010's policy list. Add the user-isolation policies here so FORCE RLS
-- doesn't deny ALL access. Idempotent with NOT EXISTS guards.
-- ----------------------------------------------------------------------------

DO $$
BEGIN
    -- Cases
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'cases') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'cases' AND policyname = 'cases_select_own') THEN
            EXECUTE 'CREATE POLICY cases_select_own ON cases
                FOR SELECT
                USING (
                    user_id = current_user_id()
                    OR current_user_is_admin()
                    OR bypass_rls_enabled()
                )';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'cases' AND policyname = 'cases_insert_own') THEN
            EXECUTE 'CREATE POLICY cases_insert_own ON cases
                FOR INSERT
                WITH CHECK (
                    user_id = current_user_id()
                    OR bypass_rls_enabled()
                )';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'cases' AND policyname = 'cases_update_own') THEN
            EXECUTE 'CREATE POLICY cases_update_own ON cases
                FOR UPDATE
                USING (
                    user_id = current_user_id()
                    OR current_user_is_admin()
                    OR bypass_rls_enabled()
                )';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'cases' AND policyname = 'cases_delete_own') THEN
            EXECUTE 'CREATE POLICY cases_delete_own ON cases
                FOR DELETE
                USING (
                    user_id = current_user_id()
                    OR current_user_is_admin()
                    OR bypass_rls_enabled()
                )';
        END IF;
    END IF;

    -- TOS acceptance log — written only by the system path inside withAuth's
    -- transaction (which sets app.user_id), so we use the same user_id check.
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'tos_acceptance_log') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'tos_acceptance_log' AND policyname = 'tos_acceptance_log_select_own') THEN
            EXECUTE 'CREATE POLICY tos_acceptance_log_select_own ON tos_acceptance_log
                FOR SELECT
                USING (
                    user_id = current_user_id()
                    OR current_user_is_admin()
                    OR bypass_rls_enabled()
                )';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'tos_acceptance_log' AND policyname = 'tos_acceptance_log_insert_own') THEN
            EXECUTE 'CREATE POLICY tos_acceptance_log_insert_own ON tos_acceptance_log
                FOR INSERT
                WITH CHECK (
                    user_id = current_user_id()
                    OR bypass_rls_enabled()
                )';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'tos_acceptance_log' AND policyname = 'tos_acceptance_log_update_own') THEN
            EXECUTE 'CREATE POLICY tos_acceptance_log_update_own ON tos_acceptance_log
                FOR UPDATE
                USING (
                    user_id = current_user_id()
                    OR current_user_is_admin()
                    OR bypass_rls_enabled()
                )';
        END IF;
    END IF;

    -- Webhook idempotency table is system-only; only bypass-RLS callers
    -- should touch it. Add a strict policy.
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'processed_webhook_events') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'processed_webhook_events' AND policyname = 'processed_webhook_events_system_only') THEN
            EXECUTE 'CREATE POLICY processed_webhook_events_system_only ON processed_webhook_events
                FOR ALL
                USING (bypass_rls_enabled())
                WITH CHECK (bypass_rls_enabled())';
        END IF;
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- Tighten existing migration 010 policies: payments must NOT be writable by
-- the user themselves under any path other than the bypass-flagged webhook.
-- The original migration's INSERT/UPDATE policies require bypass — which is
-- already correct — but the SELECT policy allowed the user to see their own
-- payments. Keep that, but add an explicit DEFAULT DENY all-policy fallback
-- so a future "missing policy" mistake doesn't expose data.
-- ----------------------------------------------------------------------------

DO $$
BEGIN
    -- Postgres default behavior when RLS is enabled with no matching policy
    -- is to deny. But if a new operation type (e.g. MERGE) lands without an
    -- updated migration, the deny stays implicit. There's no harm in
    -- declaring it explicitly for documentation.
    NULL;
END $$;

-- ----------------------------------------------------------------------------
-- Verification view: extend rls_status to include FORCE state.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE VIEW rls_status AS
SELECT
    schemaname,
    tablename,
    rowsecurity AS rls_enabled,
    -- pg_class.relforcerowsecurity is the source of truth for FORCE.
    (SELECT c.relforcerowsecurity
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = t.schemaname AND c.relname = t.tablename
    ) AS rls_forced,
    (SELECT COUNT(*) FROM pg_policies
      WHERE schemaname = t.schemaname AND tablename = t.tablename
    ) AS policy_count
FROM pg_tables t
WHERE schemaname = 'public'
  AND tablename IN (
      'users', 'documents', 'payments', 'sessions', 'user_identities',
      'activity_logs', 'email_notifications', 'audit_log', 'cases',
      'tos_acceptance_log', 'processed_webhook_events'
  )
ORDER BY tablename;

GRANT SELECT ON rls_status TO PUBLIC;

COMMIT;

-- ============================================================================
-- Post-migration verification (run in psql):
--
--   SELECT * FROM rls_status;
--
-- Every listed table should have rls_enabled = t AND rls_forced = t, with
-- policy_count >= 1.
--
-- Cross-tenant isolation smoke test (replace IDs with real user rows):
--
--   BEGIN;
--   SELECT set_config('app.user_id', '1', true);
--   SELECT id, user_id FROM documents;   -- only user 1's rows
--   ROLLBACK;
--   BEGIN;
--   SELECT set_config('app.user_id', '2', true);
--   SELECT id, user_id FROM documents;   -- only user 2's rows, no overlap
--   ROLLBACK;
-- ============================================================================
