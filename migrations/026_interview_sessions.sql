-- ============================================================================
-- Migration 026: Interview Sessions
-- ============================================================================
-- Date: 2026-03-26
-- Description: Tracks AI-guided interview sessions that walk clients through
--              a purchased template's question flow. Each session is tied to a
--              purchase and produces a document. Stores phase progression,
--              conversation history, and completion metrics.
--
-- Dependencies: 000_initial_schema.sql (users, documents tables),
--               010_enable_rls_all_tables.sql (RLS helper functions),
--               015_add_user_roles.sql (current_user_role()),
--               017_marketplace_templates.sql (marketplace_templates table),
--               018_template_versions.sql (template_versions table),
--               019_template_purchases.sql (template_purchases table)
-- ============================================================================

BEGIN;

-- ============================================================================
-- Step 1: Create interview_sessions Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS interview_sessions (
  id                      SERIAL PRIMARY KEY,
  client_id               INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  template_id             INTEGER NOT NULL REFERENCES marketplace_templates(id),
  template_version_id     INTEGER REFERENCES template_versions(id),
  purchase_id             INTEGER REFERENCES template_purchases(id),
  document_id             INTEGER REFERENCES documents(id) ON DELETE SET NULL,
  current_phase           VARCHAR(50) NOT NULL DEFAULT 'INTAKE',
  completed_phases        TEXT[] DEFAULT '{}',
  phase_history           JSONB DEFAULT '[]',
  interview_data          JSONB DEFAULT '{}',
  conversation_history    JSONB DEFAULT '[]',
  status                  VARCHAR(20) DEFAULT 'active'
                            CHECK (status IN ('active', 'completed', 'abandoned', 'expired')),
  started_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at            TIMESTAMP,
  last_activity_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  total_messages          INTEGER DEFAULT 0,
  total_duration_seconds  INTEGER DEFAULT 0
);

-- ============================================================================
-- Step 2: Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_interview_client   ON interview_sessions(client_id);
CREATE INDEX IF NOT EXISTS idx_interview_template ON interview_sessions(template_id);
CREATE INDEX IF NOT EXISTS idx_interview_status   ON interview_sessions(status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_interview_purchase ON interview_sessions(purchase_id);

-- ============================================================================
-- Step 3: Enable Row Level Security
-- ============================================================================

ALTER TABLE interview_sessions ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Step 4: RLS Policies
-- ============================================================================
-- Rules:
--   SELECT: Client can see their own sessions.
--           Lawyer can see sessions for templates they own (for analytics/support).
--           Admins see all.
--   INSERT: Client can create sessions for themselves. System can create via bypass.
--   UPDATE: Client can update their own sessions (phase progression).
--           System can update via bypass (status changes, metrics).
--   DELETE: Admin only.

DO $$
BEGIN
    -- SELECT: client sees own, lawyer sees sessions for their templates, admin sees all
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'interview_sessions' AND policyname = 'interview_sessions_select_own') THEN
        EXECUTE 'CREATE POLICY interview_sessions_select_own ON interview_sessions
            FOR SELECT
            USING (
                client_id = current_user_id()
                OR EXISTS (
                    SELECT 1 FROM marketplace_templates mt
                    WHERE mt.id = interview_sessions.template_id
                      AND mt.lawyer_id = current_user_id()
                )
                OR current_user_is_admin()
                OR bypass_rls_enabled()
            )';
        RAISE NOTICE 'Created policy: interview_sessions_select_own';
    END IF;

    -- INSERT: client inserts own sessions
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'interview_sessions' AND policyname = 'interview_sessions_insert_own') THEN
        EXECUTE 'CREATE POLICY interview_sessions_insert_own ON interview_sessions
            FOR INSERT
            WITH CHECK (
                client_id = current_user_id()
                OR bypass_rls_enabled()
            )';
        RAISE NOTICE 'Created policy: interview_sessions_insert_own';
    END IF;

    -- UPDATE: client updates own sessions, system via bypass
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'interview_sessions' AND policyname = 'interview_sessions_update_own') THEN
        EXECUTE 'CREATE POLICY interview_sessions_update_own ON interview_sessions
            FOR UPDATE
            USING (
                client_id = current_user_id()
                OR current_user_is_admin()
                OR bypass_rls_enabled()
            )';
        RAISE NOTICE 'Created policy: interview_sessions_update_own';
    END IF;

    -- DELETE: admin only
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'interview_sessions' AND policyname = 'interview_sessions_delete_admin') THEN
        EXECUTE 'CREATE POLICY interview_sessions_delete_admin ON interview_sessions
            FOR DELETE
            USING (
                current_user_is_admin()
                OR bypass_rls_enabled()
            )';
        RAISE NOTICE 'Created policy: interview_sessions_delete_admin';
    END IF;
END $$;

COMMIT;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
