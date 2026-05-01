-- ============================================================================
-- Migration 024: Analytics and Gamification
-- ============================================================================
-- Date: 2026-03-26
-- Description: Three tables supporting marketplace analytics and engagement:
--   1. template_analytics   — Daily aggregated metrics per template
--   2. lawyer_achievements  — Gamification badges/milestones
--   3. leaderboard_snapshots — Materialized leaderboard rankings (cron-driven)
--
-- Dependencies: 000_initial_schema.sql (users table),
--               010_enable_rls_all_tables.sql (RLS helper functions),
--               015_add_user_roles.sql (current_user_role()),
--               017_marketplace_templates.sql (marketplace_templates table)
-- ============================================================================

BEGIN;

-- ============================================================================
-- Step 1: Create template_analytics Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS template_analytics (
  id                      SERIAL PRIMARY KEY,
  template_id             INTEGER NOT NULL REFERENCES marketplace_templates(id) ON DELETE CASCADE,
  date                    DATE NOT NULL DEFAULT CURRENT_DATE,
  views                   INTEGER DEFAULT 0,
  detail_views            INTEGER DEFAULT 0,
  purchases               INTEGER DEFAULT 0,
  completions             INTEGER DEFAULT 0,
  revenue_cents           INTEGER DEFAULT 0,
  avg_completion_minutes  NUMERIC(6,2),
  refunds                 INTEGER DEFAULT 0,
  UNIQUE(template_id, date)
);

CREATE INDEX IF NOT EXISTS idx_analytics_template_date ON template_analytics(template_id, date);
CREATE INDEX IF NOT EXISTS idx_analytics_date          ON template_analytics(date);

-- ============================================================================
-- Step 2: Create lawyer_achievements Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS lawyer_achievements (
  id                SERIAL PRIMARY KEY,
  lawyer_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  achievement_code  VARCHAR(50) NOT NULL,
  achievement_name  VARCHAR(200) NOT NULL,
  description       TEXT,
  tier              VARCHAR(10) DEFAULT 'bronze'
                      CHECK (tier IN ('bronze', 'silver', 'gold', 'platinum')),
  unlocked_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  metadata          JSONB DEFAULT '{}',
  UNIQUE(lawyer_id, achievement_code)
);

CREATE INDEX IF NOT EXISTS idx_achievements_lawyer ON lawyer_achievements(lawyer_id);

-- ============================================================================
-- Step 3: Create leaderboard_snapshots Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS leaderboard_snapshots (
  id              SERIAL PRIMARY KEY,
  period_type     VARCHAR(10) NOT NULL CHECK (period_type IN ('daily', 'weekly', 'monthly', 'alltime')),
  period_start    DATE NOT NULL,
  period_end      DATE NOT NULL,
  category        VARCHAR(30) NOT NULL DEFAULT 'overall',
  rankings        JSONB NOT NULL,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(period_type, period_start, category)
);

CREATE INDEX IF NOT EXISTS idx_leaderboard_period ON leaderboard_snapshots(period_type, period_start);

-- ============================================================================
-- Step 4: Enable Row Level Security
-- ============================================================================

ALTER TABLE template_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE lawyer_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE leaderboard_snapshots ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Step 5: RLS Policies — template_analytics
-- ============================================================================
-- Rules:
--   SELECT: Lawyers can see analytics for templates they own. Admins see all.
--   INSERT/UPDATE: System only (bypass_rls) — populated by background aggregation.
--   DELETE: Admin only.

DO $$
BEGIN
    -- SELECT: lawyer sees own template analytics, admin sees all
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'template_analytics' AND policyname = 'template_analytics_select_own') THEN
        EXECUTE 'CREATE POLICY template_analytics_select_own ON template_analytics
            FOR SELECT
            USING (
                EXISTS (
                    SELECT 1 FROM marketplace_templates mt
                    WHERE mt.id = template_analytics.template_id
                      AND mt.lawyer_id = current_user_id()
                )
                OR current_user_is_admin()
                OR bypass_rls_enabled()
            )';
        RAISE NOTICE 'Created policy: template_analytics_select_own';
    END IF;

    -- INSERT: system only
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'template_analytics' AND policyname = 'template_analytics_insert_system') THEN
        EXECUTE 'CREATE POLICY template_analytics_insert_system ON template_analytics
            FOR INSERT
            WITH CHECK (bypass_rls_enabled())';
        RAISE NOTICE 'Created policy: template_analytics_insert_system';
    END IF;

    -- UPDATE: system only
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'template_analytics' AND policyname = 'template_analytics_update_system') THEN
        EXECUTE 'CREATE POLICY template_analytics_update_system ON template_analytics
            FOR UPDATE
            USING (bypass_rls_enabled())';
        RAISE NOTICE 'Created policy: template_analytics_update_system';
    END IF;

    -- DELETE: admin only
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'template_analytics' AND policyname = 'template_analytics_delete_admin') THEN
        EXECUTE 'CREATE POLICY template_analytics_delete_admin ON template_analytics
            FOR DELETE
            USING (current_user_is_admin())';
        RAISE NOTICE 'Created policy: template_analytics_delete_admin';
    END IF;
END $$;

-- ============================================================================
-- Step 6: RLS Policies — lawyer_achievements
-- ============================================================================
-- Rules:
--   SELECT: Public read (achievements are visible on profiles).
--   INSERT: System only (bypass_rls) — unlocked by server-side game logic.
--   UPDATE: System only.
--   DELETE: Admin only.

DO $$
BEGIN
    -- SELECT: public read (anyone can view achievements)
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'lawyer_achievements' AND policyname = 'lawyer_achievements_select_public') THEN
        EXECUTE 'CREATE POLICY lawyer_achievements_select_public ON lawyer_achievements
            FOR SELECT
            USING (true)';
        RAISE NOTICE 'Created policy: lawyer_achievements_select_public';
    END IF;

    -- INSERT: system only
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'lawyer_achievements' AND policyname = 'lawyer_achievements_insert_system') THEN
        EXECUTE 'CREATE POLICY lawyer_achievements_insert_system ON lawyer_achievements
            FOR INSERT
            WITH CHECK (bypass_rls_enabled())';
        RAISE NOTICE 'Created policy: lawyer_achievements_insert_system';
    END IF;

    -- UPDATE: system only
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'lawyer_achievements' AND policyname = 'lawyer_achievements_update_system') THEN
        EXECUTE 'CREATE POLICY lawyer_achievements_update_system ON lawyer_achievements
            FOR UPDATE
            USING (bypass_rls_enabled())';
        RAISE NOTICE 'Created policy: lawyer_achievements_update_system';
    END IF;

    -- DELETE: admin only
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'lawyer_achievements' AND policyname = 'lawyer_achievements_delete_admin') THEN
        EXECUTE 'CREATE POLICY lawyer_achievements_delete_admin ON lawyer_achievements
            FOR DELETE
            USING (current_user_is_admin())';
        RAISE NOTICE 'Created policy: lawyer_achievements_delete_admin';
    END IF;
END $$;

-- ============================================================================
-- Step 7: RLS Policies — leaderboard_snapshots
-- ============================================================================
-- Rules:
--   SELECT: Public read (leaderboards are publicly visible).
--   INSERT/UPDATE: System only (populated by cron job).
--   DELETE: Admin only.

DO $$
BEGIN
    -- SELECT: public read
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'leaderboard_snapshots' AND policyname = 'leaderboard_snapshots_select_public') THEN
        EXECUTE 'CREATE POLICY leaderboard_snapshots_select_public ON leaderboard_snapshots
            FOR SELECT
            USING (true)';
        RAISE NOTICE 'Created policy: leaderboard_snapshots_select_public';
    END IF;

    -- INSERT: system only
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'leaderboard_snapshots' AND policyname = 'leaderboard_snapshots_insert_system') THEN
        EXECUTE 'CREATE POLICY leaderboard_snapshots_insert_system ON leaderboard_snapshots
            FOR INSERT
            WITH CHECK (bypass_rls_enabled())';
        RAISE NOTICE 'Created policy: leaderboard_snapshots_insert_system';
    END IF;

    -- UPDATE: system only
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'leaderboard_snapshots' AND policyname = 'leaderboard_snapshots_update_system') THEN
        EXECUTE 'CREATE POLICY leaderboard_snapshots_update_system ON leaderboard_snapshots
            FOR UPDATE
            USING (bypass_rls_enabled())';
        RAISE NOTICE 'Created policy: leaderboard_snapshots_update_system';
    END IF;

    -- DELETE: admin only
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'leaderboard_snapshots' AND policyname = 'leaderboard_snapshots_delete_admin') THEN
        EXECUTE 'CREATE POLICY leaderboard_snapshots_delete_admin ON leaderboard_snapshots
            FOR DELETE
            USING (current_user_is_admin())';
        RAISE NOTICE 'Created policy: leaderboard_snapshots_delete_admin';
    END IF;
END $$;

COMMIT;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
