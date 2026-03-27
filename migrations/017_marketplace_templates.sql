-- ============================================================================
-- Migration 017: Marketplace Templates
-- ============================================================================
-- Date: 2026-03-26
-- Description: Core marketplace table. Stores lawyer-created document
--              templates that clients can purchase. Includes full-text search,
--              GIN indexes for array/JSONB columns, and RLS policies that
--              allow public reads of published templates while restricting
--              writes to the owning lawyer.
--
-- Dependencies: 000_initial_schema.sql (users table, update_updated_at_column),
--               010_enable_rls_all_tables.sql (RLS helper functions),
--               015_add_user_roles.sql (current_user_role())
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS marketplace_templates (
  id                    SERIAL PRIMARY KEY,
  lawyer_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Template identity
  title                 VARCHAR(500) NOT NULL,
  slug                  VARCHAR(500) UNIQUE NOT NULL,
  description           TEXT,
  short_description     VARCHAR(300),

  -- Classification
  matter_type           VARCHAR(50) NOT NULL,
  practice_area         VARCHAR(20) NOT NULL DEFAULT 'civil'
                          CHECK (practice_area IN ('family', 'civil')),
  jurisdictions         TEXT[] NOT NULL DEFAULT '{}',

  -- Template content (interview config, field definitions, prompts, etc.)
  template_config       JSONB NOT NULL DEFAULT '{}',

  -- Pricing ($1 flat fee = 100 cents default)
  price_cents           INTEGER NOT NULL DEFAULT 100,

  -- Lifecycle status
  status                VARCHAR(20) NOT NULL DEFAULT 'draft'
                          CHECK (status IN (
                            'draft', 'pending_review', 'published',
                            'suspended', 'archived', 'deleted'
                          )),

  -- Versioning
  version               INTEGER NOT NULL DEFAULT 1,
  current_version_id    INTEGER, -- FK added in migration 018 after template_versions exists

  -- Display
  cover_image_url       VARCHAR(1000),
  tags                  TEXT[] DEFAULT '{}',
  estimated_minutes     INTEGER DEFAULT 15,
  difficulty_level      VARCHAR(10) DEFAULT 'standard'
                          CHECK (difficulty_level IN ('basic', 'standard', 'complex')),

  -- Aggregate stats (denormalized for fast marketplace listing queries)
  total_purchases       INTEGER DEFAULT 0,
  total_revenue_cents   INTEGER DEFAULT 0,
  avg_rating            NUMERIC(3,2) DEFAULT 0.00,
  rating_count          INTEGER DEFAULT 0,

  -- Lifecycle timestamps
  published_at          TIMESTAMP,
  suspended_at          TIMESTAMP,
  suspension_reason     TEXT,

  -- Standard timestamps
  created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at            TIMESTAMP
);

-- ============================================================================
-- Full-text search vector (generated, stored)
-- ============================================================================
-- Weighted: title (A) > description + short_description (B) > tags (C)

ALTER TABLE marketplace_templates
  ADD COLUMN IF NOT EXISTS search_vector tsvector
    GENERATED ALWAYS AS (
      setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
      setweight(to_tsvector('english', coalesce(description, '')), 'B') ||
      setweight(to_tsvector('english', coalesce(short_description, '')), 'B') ||
      setweight(to_tsvector('english', coalesce(array_to_string(tags, ' '), '')), 'C')
    ) STORED;

-- ============================================================================
-- Indexes
-- ============================================================================

-- Ownership lookups
CREATE INDEX IF NOT EXISTS idx_mkt_templates_lawyer
  ON marketplace_templates(lawyer_id);

-- Marketplace listing: published templates only
CREATE INDEX IF NOT EXISTS idx_mkt_templates_status
  ON marketplace_templates(status) WHERE status = 'published';

-- Filter by matter type / practice area
CREATE INDEX IF NOT EXISTS idx_mkt_templates_matter
  ON marketplace_templates(matter_type);

CREATE INDEX IF NOT EXISTS idx_mkt_templates_practice
  ON marketplace_templates(practice_area);

-- Slug lookup (unique constraint already creates an index, but explicit for clarity)
CREATE INDEX IF NOT EXISTS idx_mkt_templates_slug
  ON marketplace_templates(slug);

-- Sort by rating / popularity (published only)
CREATE INDEX IF NOT EXISTS idx_mkt_templates_rating
  ON marketplace_templates(avg_rating DESC) WHERE status = 'published';

CREATE INDEX IF NOT EXISTS idx_mkt_templates_purchases
  ON marketplace_templates(total_purchases DESC) WHERE status = 'published';

-- Array containment queries (e.g., "templates for TX")
CREATE INDEX IF NOT EXISTS idx_mkt_templates_jurisdictions
  ON marketplace_templates USING GIN(jurisdictions);

CREATE INDEX IF NOT EXISTS idx_mkt_templates_tags
  ON marketplace_templates USING GIN(tags);

-- JSONB path queries on template_config
CREATE INDEX IF NOT EXISTS idx_mkt_templates_config
  ON marketplace_templates USING GIN(template_config jsonb_path_ops);

-- Full-text search
CREATE INDEX IF NOT EXISTS idx_mkt_templates_search
  ON marketplace_templates USING GIN(search_vector);

-- ============================================================================
-- Row Level Security
-- ============================================================================

ALTER TABLE marketplace_templates ENABLE ROW LEVEL SECURITY;

-- SELECT: published templates are public; drafts visible only to owner/admin
CREATE POLICY mkt_templates_read_published ON marketplace_templates
  FOR SELECT USING (
    status = 'published'
    OR lawyer_id = current_user_id()
    OR current_user_is_admin()
    OR bypass_rls_enabled()
  );

-- INSERT: only lawyers and admins can create templates
CREATE POLICY mkt_templates_insert_own ON marketplace_templates
  FOR INSERT WITH CHECK (
    (lawyer_id = current_user_id() AND current_user_role() IN ('lawyer', 'admin'))
    OR bypass_rls_enabled()
  );

-- UPDATE: own templates or admin
CREATE POLICY mkt_templates_update_own ON marketplace_templates
  FOR UPDATE USING (
    lawyer_id = current_user_id()
    OR current_user_is_admin()
    OR bypass_rls_enabled()
  );

-- DELETE: own templates or admin (soft-delete preferred, but allow hard delete)
CREATE POLICY mkt_templates_delete_own ON marketplace_templates
  FOR DELETE USING (
    lawyer_id = current_user_id()
    OR current_user_is_admin()
  );

-- ============================================================================
-- Updated_at trigger
-- ============================================================================
-- Reuse update_updated_at_column() from migration 000.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
    CREATE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $fn$
    BEGIN
      NEW.updated_at = CURRENT_TIMESTAMP;
      RETURN NEW;
    END;
    $fn$ LANGUAGE plpgsql;
  END IF;
END $$;

DROP TRIGGER IF EXISTS mkt_templates_updated_at ON marketplace_templates;
CREATE TRIGGER mkt_templates_updated_at
  BEFORE UPDATE ON marketplace_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMIT;
