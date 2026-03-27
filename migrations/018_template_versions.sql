-- ============================================================================
-- Migration 018: Template Versions
-- ============================================================================
-- Date: 2026-03-26
-- Description: Version history for marketplace templates. Each edit creates a
--              new version row so buyers always get the version they purchased
--              and lawyers can track changes. Also adds the FK from
--              marketplace_templates.current_version_id to this table.
--
-- Dependencies: 000_initial_schema.sql (users table),
--               010_enable_rls_all_tables.sql (RLS helper functions),
--               017_marketplace_templates.sql (marketplace_templates table)
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS template_versions (
  id                SERIAL PRIMARY KEY,
  template_id       INTEGER NOT NULL REFERENCES marketplace_templates(id) ON DELETE CASCADE,
  version_number    INTEGER NOT NULL,
  template_config   JSONB NOT NULL,
  change_summary    TEXT,
  created_by        INTEGER NOT NULL REFERENCES users(id),
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Each template can only have one row per version number
  UNIQUE(template_id, version_number)
);

-- ============================================================================
-- Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_tpl_versions_template
  ON template_versions(template_id);

CREATE INDEX IF NOT EXISTS idx_tpl_versions_created_by
  ON template_versions(created_by);

-- ============================================================================
-- Add FK from marketplace_templates.current_version_id
-- ============================================================================
-- This was deferred from migration 017 because template_versions did not
-- exist yet. Now we can safely add the constraint.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_mkt_templates_current_version'
      AND table_name = 'marketplace_templates'
  ) THEN
    ALTER TABLE marketplace_templates
      ADD CONSTRAINT fk_mkt_templates_current_version
        FOREIGN KEY (current_version_id) REFERENCES template_versions(id);
  END IF;
END $$;

-- ============================================================================
-- Row Level Security
-- ============================================================================

ALTER TABLE template_versions ENABLE ROW LEVEL SECURITY;

-- SELECT: visible if the parent template is visible to this user
-- (published templates' versions are public; draft versions only to owner/admin)
CREATE POLICY tpl_versions_select ON template_versions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM marketplace_templates mt
      WHERE mt.id = template_versions.template_id
        AND (
          mt.status = 'published'
          OR mt.lawyer_id = current_user_id()
          OR current_user_is_admin()
          OR bypass_rls_enabled()
        )
    )
  );

-- INSERT: only if the user owns the parent template (or bypass)
CREATE POLICY tpl_versions_insert ON template_versions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM marketplace_templates mt
      WHERE mt.id = template_versions.template_id
        AND (
          mt.lawyer_id = current_user_id()
          OR bypass_rls_enabled()
        )
    )
  );

-- UPDATE: own template versions or admin/bypass
CREATE POLICY tpl_versions_update ON template_versions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM marketplace_templates mt
      WHERE mt.id = template_versions.template_id
        AND (
          mt.lawyer_id = current_user_id()
          OR current_user_is_admin()
          OR bypass_rls_enabled()
        )
    )
  );

-- DELETE: admin/bypass only (version history should generally be preserved)
CREATE POLICY tpl_versions_delete ON template_versions
  FOR DELETE USING (
    current_user_is_admin()
    OR bypass_rls_enabled()
  );

COMMIT;
