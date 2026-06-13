-- ============================================================================
-- Migration 015: Marketplace Foundation
-- ============================================================================
-- Date: 2026-06-12
-- Description: Foundational schema for the document marketplace. Self-contained
--              (depends only on 000 + 010) so it lands cleanly on the Next.js
--              `main` line ahead of the larger lawyer-profile / payouts /
--              affiliate subsystems, which arrive in later migrations.
--
--              Adds:
--                1. users.user_role  (client | lawyer | admin) + current_user_role()
--                2. marketplace_templates  (lawyer-authored, client-purchasable)
--                3. Full-text search vector + GIN/btree indexes
--                4. RLS: published templates are world-readable; writes are
--                   restricted to the owning lawyer / admin.
--
--              The schema is INERT until the application enables it: every
--              marketplace Route Handler and page is gated behind the
--              ENABLE_MARKETPLACE feature flag (config/marketplace.js). The
--              table existing costs nothing while the flag is off.
--
-- Dependencies: 000_initial_schema.sql (users, update_updated_at_column),
--               010_enable_rls_all_tables.sql
--                 (current_user_id, current_user_is_admin, bypass_rls_enabled)
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. User roles
-- ----------------------------------------------------------------------------
-- Roles: client (default) | lawyer | admin. Affiliate status, when it arrives,
-- is tracked separately — it is not a user role.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS user_role VARCHAR(20) NOT NULL DEFAULT 'client'
    CHECK (user_role IN ('client', 'lawyer', 'admin'));

CREATE INDEX IF NOT EXISTS idx_users_role ON users(user_role);

-- RLS helper: the application SETs app.user_role inside the request transaction
-- (see withMarketplaceRLSContext). Defaults to 'client' when unset.
CREATE OR REPLACE FUNCTION current_user_role()
RETURNS TEXT AS $$
BEGIN
  RETURN COALESCE(current_setting('app.user_role', TRUE), 'client');
EXCEPTION WHEN OTHERS THEN
  RETURN 'client';
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION current_user_role() TO PUBLIC;

-- ----------------------------------------------------------------------------
-- 2. marketplace_templates
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS marketplace_templates (
  id                    SERIAL PRIMARY KEY,
  lawyer_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Identity
  title                 VARCHAR(500) NOT NULL,
  slug                  VARCHAR(500) UNIQUE NOT NULL,
  description           TEXT,
  short_description     VARCHAR(300),

  -- Classification
  matter_type           VARCHAR(50) NOT NULL,
  practice_area         VARCHAR(20) NOT NULL DEFAULT 'civil'
                          CHECK (practice_area IN ('family', 'civil')),
  jurisdictions         TEXT[] NOT NULL DEFAULT '{}',

  -- Interview config / field definitions / prompts
  template_config       JSONB NOT NULL DEFAULT '{}',

  -- Pricing ($1 flat fee = 100 cents default; server-side authority only)
  price_cents           INTEGER NOT NULL DEFAULT 100 CHECK (price_cents >= 0),

  -- Lifecycle
  status                VARCHAR(20) NOT NULL DEFAULT 'draft'
                          CHECK (status IN (
                            'draft', 'pending_review', 'published',
                            'suspended', 'archived', 'deleted'
                          )),
  version               INTEGER NOT NULL DEFAULT 1,

  -- Display
  cover_image_url       VARCHAR(1000),
  tags                  TEXT[] DEFAULT '{}',
  estimated_minutes     INTEGER DEFAULT 15,
  difficulty_level      VARCHAR(10) DEFAULT 'standard'
                          CHECK (difficulty_level IN ('basic', 'standard', 'complex')),

  -- Denormalized aggregates for fast listing
  total_purchases       INTEGER NOT NULL DEFAULT 0,
  total_revenue_cents   INTEGER NOT NULL DEFAULT 0,
  avg_rating            NUMERIC(3,2) NOT NULL DEFAULT 0.00,
  rating_count          INTEGER NOT NULL DEFAULT 0,

  -- Lifecycle timestamps
  published_at          TIMESTAMP,
  suspended_at          TIMESTAMP,
  suspension_reason     TEXT,

  created_at            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at            TIMESTAMP
);

-- Weighted full-text search: title (A) > description/short (B) > tags (C)
ALTER TABLE marketplace_templates
  ADD COLUMN IF NOT EXISTS search_vector tsvector
    GENERATED ALWAYS AS (
      setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
      setweight(to_tsvector('english', coalesce(description, '')), 'B') ||
      setweight(to_tsvector('english', coalesce(short_description, '')), 'B') ||
      setweight(to_tsvector('english', coalesce(array_to_string(tags, ' '), '')), 'C')
    ) STORED;

-- Indexes -------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_mkt_templates_lawyer
  ON marketplace_templates(lawyer_id);
CREATE INDEX IF NOT EXISTS idx_mkt_templates_status
  ON marketplace_templates(status) WHERE status = 'published';
CREATE INDEX IF NOT EXISTS idx_mkt_templates_matter
  ON marketplace_templates(matter_type);
CREATE INDEX IF NOT EXISTS idx_mkt_templates_practice
  ON marketplace_templates(practice_area);
CREATE INDEX IF NOT EXISTS idx_mkt_templates_rating
  ON marketplace_templates(avg_rating DESC) WHERE status = 'published';
CREATE INDEX IF NOT EXISTS idx_mkt_templates_purchases
  ON marketplace_templates(total_purchases DESC) WHERE status = 'published';
CREATE INDEX IF NOT EXISTS idx_mkt_templates_published_at
  ON marketplace_templates(published_at DESC) WHERE status = 'published';
CREATE INDEX IF NOT EXISTS idx_mkt_templates_jurisdictions
  ON marketplace_templates USING GIN(jurisdictions);
CREATE INDEX IF NOT EXISTS idx_mkt_templates_tags
  ON marketplace_templates USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_mkt_templates_config
  ON marketplace_templates USING GIN(template_config jsonb_path_ops);
CREATE INDEX IF NOT EXISTS idx_mkt_templates_search
  ON marketplace_templates USING GIN(search_vector);

-- ----------------------------------------------------------------------------
-- 3. Row Level Security
-- ----------------------------------------------------------------------------
ALTER TABLE marketplace_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_templates FORCE ROW LEVEL SECURITY;

-- SELECT: published rows are public; drafts/suspended visible to owner + admin.
DROP POLICY IF EXISTS mkt_templates_read ON marketplace_templates;
CREATE POLICY mkt_templates_read ON marketplace_templates
  FOR SELECT USING (
    (status = 'published' AND deleted_at IS NULL)
    OR lawyer_id = current_user_id()
    OR current_user_is_admin()
    OR bypass_rls_enabled()
  );

-- INSERT: only lawyers / admins, and only for themselves.
DROP POLICY IF EXISTS mkt_templates_insert ON marketplace_templates;
CREATE POLICY mkt_templates_insert ON marketplace_templates
  FOR INSERT WITH CHECK (
    (lawyer_id = current_user_id() AND current_user_role() IN ('lawyer', 'admin'))
    OR bypass_rls_enabled()
  );

-- UPDATE: own rows or admin.
DROP POLICY IF EXISTS mkt_templates_update ON marketplace_templates;
CREATE POLICY mkt_templates_update ON marketplace_templates
  FOR UPDATE USING (
    lawyer_id = current_user_id()
    OR current_user_is_admin()
    OR bypass_rls_enabled()
  );

-- DELETE: own rows or admin (soft-delete is preferred at the app layer).
DROP POLICY IF EXISTS mkt_templates_delete ON marketplace_templates;
CREATE POLICY mkt_templates_delete ON marketplace_templates
  FOR DELETE USING (
    lawyer_id = current_user_id()
    OR current_user_is_admin()
  );

-- ----------------------------------------------------------------------------
-- 4. updated_at trigger (reuse helper from migration 000)
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS mkt_templates_updated_at ON marketplace_templates;
CREATE TRIGGER mkt_templates_updated_at
  BEFORE UPDATE ON marketplace_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMIT;
