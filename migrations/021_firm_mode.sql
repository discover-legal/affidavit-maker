-- ============================================================================
-- Migration 015: Firm mode — local mirror of BigLaw intake submissions
-- ============================================================================
-- Date: 2026-08-03
--
-- When the deployment runs in firm mode (BIGLAW_API_URL + BIGLAW_INTAKE_SECRET
-- set), document drafts are submitted to the firm's BigLaw platform. This
-- table stores the local mirror of each submission — one row per document
-- (UNIQUE(document_id); re-submitting updates the row, matching BigLaw's
-- idempotent externalId behaviour) — so the dashboard can decorate document
-- rows with the last-known status even when BigLaw is unreachable.
--
-- Contract: docs/BIGLAW_INTEGRATION.md.
-- RLS follows migration 014's pattern exactly: per-command policies guarded
-- by pg_policies NOT EXISTS checks, then ENABLE + FORCE ROW LEVEL SECURITY.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS firm_submissions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    biglaw_submission_id VARCHAR(64) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'received',
    conflict BOOLEAN NOT NULL DEFAULT FALSE,
    firm_note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (document_id)
);

CREATE INDEX IF NOT EXISTS idx_firm_submissions_user_id
    ON firm_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_firm_submissions_biglaw_submission_id
    ON firm_submissions(biglaw_submission_id);

-- Reuse the shared updated_at trigger function from migration 000.
DROP TRIGGER IF EXISTS update_firm_submissions_updated_at ON firm_submissions;
CREATE TRIGGER update_firm_submissions_updated_at BEFORE UPDATE ON firm_submissions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ----------------------------------------------------------------------------
-- Row Level Security — user-isolation policies, per migration 014's pattern
-- (migrations/014_force_rls_all_tables.sql:69-107). Idempotent via
-- pg_policies NOT EXISTS guards.
-- ----------------------------------------------------------------------------

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'firm_submissions' AND policyname = 'firm_submissions_select_own') THEN
        EXECUTE 'CREATE POLICY firm_submissions_select_own ON firm_submissions
            FOR SELECT
            USING (
                user_id = current_user_id()
                OR current_user_is_admin()
                OR bypass_rls_enabled()
            )';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'firm_submissions' AND policyname = 'firm_submissions_insert_own') THEN
        EXECUTE 'CREATE POLICY firm_submissions_insert_own ON firm_submissions
            FOR INSERT
            WITH CHECK (
                user_id = current_user_id()
                OR bypass_rls_enabled()
            )';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'firm_submissions' AND policyname = 'firm_submissions_update_own') THEN
        EXECUTE 'CREATE POLICY firm_submissions_update_own ON firm_submissions
            FOR UPDATE
            USING (
                user_id = current_user_id()
                OR current_user_is_admin()
                OR bypass_rls_enabled()
            )';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'firm_submissions' AND policyname = 'firm_submissions_delete_own') THEN
        EXECUTE 'CREATE POLICY firm_submissions_delete_own ON firm_submissions
            FOR DELETE
            USING (
                user_id = current_user_id()
                OR current_user_is_admin()
                OR bypass_rls_enabled()
            )';
    END IF;
END $$;

ALTER TABLE firm_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE firm_submissions FORCE ROW LEVEL SECURITY;

COMMIT;

-- ============================================================================
-- Post-migration verification (run in psql):
--
--   SELECT relrowsecurity, relforcerowsecurity
--     FROM pg_class WHERE relname = 'firm_submissions';   -- t / t
--   SELECT policyname FROM pg_policies
--    WHERE tablename = 'firm_submissions';                -- 4 policies
-- ============================================================================
