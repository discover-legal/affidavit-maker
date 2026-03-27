-- ============================================================================
-- Migration 025: Marketplace Infrastructure
-- ============================================================================
-- Date: 2026-03-26
-- Description: Four supporting tables for marketplace operations:
--   1. payout_batches      — Tracks batch payouts to lawyers and affiliates
--   2. template_categories — Taxonomy for template organization (seeded)
--   3. featured_placements — Paid/editorial featured template slots
--   4. template_flags      — Moderation flags for content review
--
-- Dependencies: 000_initial_schema.sql (users table),
--               010_enable_rls_all_tables.sql (RLS helper functions),
--               017_marketplace_templates.sql (marketplace_templates table)
-- ============================================================================

BEGIN;

-- ============================================================================
-- Step 1: Create payout_batches Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS payout_batches (
  id                  SERIAL PRIMARY KEY,
  batch_type          VARCHAR(20) NOT NULL CHECK (batch_type IN ('lawyer', 'affiliate')),
  period_start        DATE NOT NULL,
  period_end          DATE NOT NULL,
  total_amount_cents  INTEGER NOT NULL,
  recipient_count     INTEGER NOT NULL,
  status              VARCHAR(20) DEFAULT 'pending'
                        CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'partial')),
  stripe_batch_id     VARCHAR(255),
  error_details       JSONB,
  created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at        TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payout_batches_status ON payout_batches(status);
CREATE INDEX IF NOT EXISTS idx_payout_batches_period ON payout_batches(period_start, period_end);

-- ============================================================================
-- Step 2: Create template_categories Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS template_categories (
  id            SERIAL PRIMARY KEY,
  slug          VARCHAR(100) UNIQUE NOT NULL,
  display_name  VARCHAR(200) NOT NULL,
  description   TEXT,
  parent_id     INTEGER REFERENCES template_categories(id),
  icon_name     VARCHAR(50),
  sort_order    INTEGER DEFAULT 0,
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_categories_parent ON template_categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_categories_slug   ON template_categories(slug);

-- Seed top-level categories
INSERT INTO template_categories (slug, display_name, description, sort_order) VALUES
  ('family', 'Family Law', 'Divorce, custody, child support, and family matters', 1),
  ('civil', 'Civil Law', 'General civil matters, small claims, and disputes', 2)
ON CONFLICT (slug) DO NOTHING;

-- Seed child categories
INSERT INTO template_categories (slug, display_name, description, parent_id, sort_order) VALUES
  ('divorce', 'Divorce', 'Divorce petitions, decrees, and related documents', (SELECT id FROM template_categories WHERE slug = 'family'), 1),
  ('custody', 'Custody', 'Child custody and visitation agreements', (SELECT id FROM template_categories WHERE slug = 'family'), 2),
  ('child-support', 'Child Support', 'Child support calculations and modifications', (SELECT id FROM template_categories WHERE slug = 'family'), 3),
  ('dvro', 'Domestic Violence', 'Protective and restraining orders', (SELECT id FROM template_categories WHERE slug = 'family'), 4),
  ('paternity', 'Paternity', 'Paternity establishment and acknowledgment', (SELECT id FROM template_categories WHERE slug = 'family'), 5),
  ('adoption', 'Adoption', 'Adoption petitions and proceedings', (SELECT id FROM template_categories WHERE slug = 'family'), 6),
  ('guardianship', 'Guardianship', 'Minor guardianship petitions', (SELECT id FROM template_categories WHERE slug = 'family'), 7),
  ('name-change', 'Name Change', 'Legal name change petitions', (SELECT id FROM template_categories WHERE slug = 'civil'), 1),
  ('small-claims', 'Small Claims', 'Small claims court filings', (SELECT id FROM template_categories WHERE slug = 'civil'), 2),
  ('landlord-tenant', 'Landlord-Tenant', 'Eviction, lease disputes, security deposits', (SELECT id FROM template_categories WHERE slug = 'civil'), 3),
  ('debt-defense', 'Debt Defense', 'Debt collection defense and disputes', (SELECT id FROM template_categories WHERE slug = 'civil'), 4),
  ('general-civil', 'General Civil', 'General civil complaints and motions', (SELECT id FROM template_categories WHERE slug = 'civil'), 5)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- Step 3: Create featured_placements Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS featured_placements (
  id              SERIAL PRIMARY KEY,
  template_id     INTEGER NOT NULL REFERENCES marketplace_templates(id) ON DELETE CASCADE,
  placement_type  VARCHAR(30) NOT NULL
                    CHECK (placement_type IN ('homepage_hero', 'category_top', 'search_boost', 'sidebar', 'editorial')),
  position        INTEGER DEFAULT 0,
  starts_at       TIMESTAMP NOT NULL,
  ends_at         TIMESTAMP NOT NULL,
  is_paid         BOOLEAN DEFAULT false,
  cost_cents      INTEGER DEFAULT 0,
  impressions     INTEGER DEFAULT 0,
  clicks          INTEGER DEFAULT 0,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS idx_featured_active ON featured_placements(placement_type, starts_at, ends_at)
  WHERE ends_at > CURRENT_TIMESTAMP;
CREATE INDEX IF NOT EXISTS idx_featured_template ON featured_placements(template_id);

-- ============================================================================
-- Step 4: Create template_flags Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS template_flags (
  id              SERIAL PRIMARY KEY,
  template_id     INTEGER NOT NULL REFERENCES marketplace_templates(id) ON DELETE CASCADE,
  flagged_by      INTEGER REFERENCES users(id),
  flag_type       VARCHAR(30) NOT NULL
                    CHECK (flag_type IN (
                      'upl_concern', 'inaccurate', 'offensive', 'spam',
                      'copyright', 'outdated', 'automated_quality', 'other'
                    )),
  description     TEXT,
  severity        VARCHAR(10) DEFAULT 'medium'
                    CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  status          VARCHAR(20) DEFAULT 'open'
                    CHECK (status IN ('open', 'investigating', 'resolved', 'dismissed')),
  resolution      TEXT,
  resolved_by     INTEGER REFERENCES users(id),
  resolved_at     TIMESTAMP,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_flags_template ON template_flags(template_id);
CREATE INDEX IF NOT EXISTS idx_flags_status   ON template_flags(status) WHERE status IN ('open', 'investigating');
CREATE INDEX IF NOT EXISTS idx_flags_type     ON template_flags(flag_type);

-- ============================================================================
-- Step 5: Enable Row Level Security
-- ============================================================================

ALTER TABLE payout_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE featured_placements ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_flags ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Step 6: RLS Policies — payout_batches
-- ============================================================================
-- Rules:
--   ALL operations: Admin only. Payout data is sensitive financial records.

DO $$
BEGIN
    -- SELECT: admin only
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'payout_batches' AND policyname = 'payout_batches_select_admin') THEN
        EXECUTE 'CREATE POLICY payout_batches_select_admin ON payout_batches
            FOR SELECT
            USING (
                current_user_is_admin()
                OR bypass_rls_enabled()
            )';
        RAISE NOTICE 'Created policy: payout_batches_select_admin';
    END IF;

    -- INSERT: system only
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'payout_batches' AND policyname = 'payout_batches_insert_system') THEN
        EXECUTE 'CREATE POLICY payout_batches_insert_system ON payout_batches
            FOR INSERT
            WITH CHECK (bypass_rls_enabled())';
        RAISE NOTICE 'Created policy: payout_batches_insert_system';
    END IF;

    -- UPDATE: system or admin
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'payout_batches' AND policyname = 'payout_batches_update_system') THEN
        EXECUTE 'CREATE POLICY payout_batches_update_system ON payout_batches
            FOR UPDATE
            USING (
                current_user_is_admin()
                OR bypass_rls_enabled()
            )';
        RAISE NOTICE 'Created policy: payout_batches_update_system';
    END IF;

    -- DELETE: admin only
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'payout_batches' AND policyname = 'payout_batches_delete_admin') THEN
        EXECUTE 'CREATE POLICY payout_batches_delete_admin ON payout_batches
            FOR DELETE
            USING (current_user_is_admin())';
        RAISE NOTICE 'Created policy: payout_batches_delete_admin';
    END IF;
END $$;

-- ============================================================================
-- Step 7: RLS Policies — template_categories
-- ============================================================================
-- Rules:
--   SELECT: Public read (categories are part of the marketplace UI).
--   INSERT/UPDATE/DELETE: Admin only.

DO $$
BEGIN
    -- SELECT: public read
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'template_categories' AND policyname = 'template_categories_select_public') THEN
        EXECUTE 'CREATE POLICY template_categories_select_public ON template_categories
            FOR SELECT
            USING (true)';
        RAISE NOTICE 'Created policy: template_categories_select_public';
    END IF;

    -- INSERT: admin only
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'template_categories' AND policyname = 'template_categories_insert_admin') THEN
        EXECUTE 'CREATE POLICY template_categories_insert_admin ON template_categories
            FOR INSERT
            WITH CHECK (
                current_user_is_admin()
                OR bypass_rls_enabled()
            )';
        RAISE NOTICE 'Created policy: template_categories_insert_admin';
    END IF;

    -- UPDATE: admin only
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'template_categories' AND policyname = 'template_categories_update_admin') THEN
        EXECUTE 'CREATE POLICY template_categories_update_admin ON template_categories
            FOR UPDATE
            USING (
                current_user_is_admin()
                OR bypass_rls_enabled()
            )';
        RAISE NOTICE 'Created policy: template_categories_update_admin';
    END IF;

    -- DELETE: admin only
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'template_categories' AND policyname = 'template_categories_delete_admin') THEN
        EXECUTE 'CREATE POLICY template_categories_delete_admin ON template_categories
            FOR DELETE
            USING (current_user_is_admin())';
        RAISE NOTICE 'Created policy: template_categories_delete_admin';
    END IF;
END $$;

-- ============================================================================
-- Step 8: RLS Policies — featured_placements
-- ============================================================================
-- Rules:
--   SELECT: Public read for active placements (drives marketplace UI).
--   INSERT/UPDATE/DELETE: Admin only.

DO $$
BEGIN
    -- SELECT: public read
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'featured_placements' AND policyname = 'featured_placements_select_public') THEN
        EXECUTE 'CREATE POLICY featured_placements_select_public ON featured_placements
            FOR SELECT
            USING (true)';
        RAISE NOTICE 'Created policy: featured_placements_select_public';
    END IF;

    -- INSERT: admin only
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'featured_placements' AND policyname = 'featured_placements_insert_admin') THEN
        EXECUTE 'CREATE POLICY featured_placements_insert_admin ON featured_placements
            FOR INSERT
            WITH CHECK (
                current_user_is_admin()
                OR bypass_rls_enabled()
            )';
        RAISE NOTICE 'Created policy: featured_placements_insert_admin';
    END IF;

    -- UPDATE: admin or system (impressions/clicks updated by server)
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'featured_placements' AND policyname = 'featured_placements_update_admin') THEN
        EXECUTE 'CREATE POLICY featured_placements_update_admin ON featured_placements
            FOR UPDATE
            USING (
                current_user_is_admin()
                OR bypass_rls_enabled()
            )';
        RAISE NOTICE 'Created policy: featured_placements_update_admin';
    END IF;

    -- DELETE: admin only
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'featured_placements' AND policyname = 'featured_placements_delete_admin') THEN
        EXECUTE 'CREATE POLICY featured_placements_delete_admin ON featured_placements
            FOR DELETE
            USING (current_user_is_admin())';
        RAISE NOTICE 'Created policy: featured_placements_delete_admin';
    END IF;
END $$;

-- ============================================================================
-- Step 9: RLS Policies — template_flags
-- ============================================================================
-- Rules:
--   SELECT: User who flagged can see their own flags. Admins see all.
--   INSERT: Any authenticated user can flag a template.
--   UPDATE: Admin only (for resolution).
--   DELETE: Admin only.

DO $$
BEGIN
    -- SELECT: own flags or admin
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'template_flags' AND policyname = 'template_flags_select_own') THEN
        EXECUTE 'CREATE POLICY template_flags_select_own ON template_flags
            FOR SELECT
            USING (
                flagged_by = current_user_id()
                OR current_user_is_admin()
                OR bypass_rls_enabled()
            )';
        RAISE NOTICE 'Created policy: template_flags_select_own';
    END IF;

    -- INSERT: any authenticated user can flag
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'template_flags' AND policyname = 'template_flags_insert_authenticated') THEN
        EXECUTE 'CREATE POLICY template_flags_insert_authenticated ON template_flags
            FOR INSERT
            WITH CHECK (
                flagged_by = current_user_id()
                OR bypass_rls_enabled()
            )';
        RAISE NOTICE 'Created policy: template_flags_insert_authenticated';
    END IF;

    -- UPDATE: admin only (resolution workflow)
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'template_flags' AND policyname = 'template_flags_update_admin') THEN
        EXECUTE 'CREATE POLICY template_flags_update_admin ON template_flags
            FOR UPDATE
            USING (
                current_user_is_admin()
                OR bypass_rls_enabled()
            )';
        RAISE NOTICE 'Created policy: template_flags_update_admin';
    END IF;

    -- DELETE: admin only
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'template_flags' AND policyname = 'template_flags_delete_admin') THEN
        EXECUTE 'CREATE POLICY template_flags_delete_admin ON template_flags
            FOR DELETE
            USING (current_user_is_admin())';
        RAISE NOTICE 'Created policy: template_flags_delete_admin';
    END IF;
END $$;

COMMIT;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
