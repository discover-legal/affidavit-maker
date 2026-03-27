-- ============================================================================
-- Migration 020: Template Reviews
-- ============================================================================
-- Date: 2026-03-26
-- Description: Review system for marketplace templates. One review per purchase
--              (enforced via UNIQUE(purchase_id)). Supports star ratings, text
--              reviews, lawyer replies, and helpful counts. Includes a trigger
--              to maintain avg_rating and rating_count on marketplace_templates.
--
-- Dependencies: marketplace_templates, template_purchases, users
--
-- RLS: Reviewers can read/update own reviews. Lawyers can read reviews of
--       their templates. Public can read visible reviews (is_visible = true).
-- ============================================================================

BEGIN;

-- ============================================================================
-- Step 1: Create template_reviews Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS template_reviews (
  id              SERIAL PRIMARY KEY,
  template_id     INTEGER NOT NULL REFERENCES marketplace_templates(id) ON DELETE CASCADE,
  purchase_id     INTEGER NOT NULL REFERENCES template_purchases(id) ON DELETE CASCADE,
  reviewer_id     INTEGER NOT NULL REFERENCES users(id),
  rating          SMALLINT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title           VARCHAR(200),
  body            TEXT,
  is_verified     BOOLEAN DEFAULT true,
  is_visible      BOOLEAN DEFAULT true,
  helpful_count   INTEGER DEFAULT 0,
  lawyer_reply    TEXT,
  lawyer_reply_at TIMESTAMP,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(purchase_id)
);


-- ============================================================================
-- Step 2: Create Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_reviews_template ON template_reviews(template_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewer ON template_reviews(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_reviews_rating   ON template_reviews(template_id, rating);


-- ============================================================================
-- Step 3: Enable RLS
-- ============================================================================

ALTER TABLE template_reviews ENABLE ROW LEVEL SECURITY;


-- ============================================================================
-- Step 4: Create RLS Policies
-- ============================================================================

DO $$
BEGIN
    -- Anyone can read visible reviews (public listing)
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'template_reviews' AND policyname = 'reviews_select_visible') THEN
        EXECUTE 'CREATE POLICY reviews_select_visible ON template_reviews
            FOR SELECT
            USING (
                is_visible = true
                OR reviewer_id = current_user_id()
                OR current_user_is_admin()
                OR bypass_rls_enabled()
            )';
        RAISE NOTICE 'Created policy: reviews_select_visible';
    END IF;

    -- Lawyers can read all reviews on their templates (including hidden)
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'template_reviews' AND policyname = 'reviews_select_lawyer') THEN
        EXECUTE 'CREATE POLICY reviews_select_lawyer ON template_reviews
            FOR SELECT
            USING (
                template_id IN (
                    SELECT id FROM marketplace_templates
                    WHERE lawyer_id = current_user_id()
                )
            )';
        RAISE NOTICE 'Created policy: reviews_select_lawyer';
    END IF;

    -- Reviewers can INSERT their own review (one per purchase, enforced by UNIQUE)
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'template_reviews' AND policyname = 'reviews_insert_own') THEN
        EXECUTE 'CREATE POLICY reviews_insert_own ON template_reviews
            FOR INSERT
            WITH CHECK (
                reviewer_id = current_user_id()
                OR bypass_rls_enabled()
            )';
        RAISE NOTICE 'Created policy: reviews_insert_own';
    END IF;

    -- Reviewers can UPDATE their own review (edit text/rating)
    -- Lawyers can UPDATE reviews on their templates (to add lawyer_reply only —
    -- application logic must enforce that lawyers only modify lawyer_reply fields)
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'template_reviews' AND policyname = 'reviews_update_own') THEN
        EXECUTE 'CREATE POLICY reviews_update_own ON template_reviews
            FOR UPDATE
            USING (
                reviewer_id = current_user_id()
                OR template_id IN (
                    SELECT id FROM marketplace_templates
                    WHERE lawyer_id = current_user_id()
                )
                OR current_user_is_admin()
                OR bypass_rls_enabled()
            )';
        RAISE NOTICE 'Created policy: reviews_update_own';
    END IF;

    -- Only admin or system can DELETE reviews
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'template_reviews' AND policyname = 'reviews_delete_admin') THEN
        EXECUTE 'CREATE POLICY reviews_delete_admin ON template_reviews
            FOR DELETE
            USING (
                current_user_is_admin()
                OR bypass_rls_enabled()
            )';
        RAISE NOTICE 'Created policy: reviews_delete_admin';
    END IF;
END $$;


-- ============================================================================
-- Step 5: Average Rating Trigger
-- ============================================================================
-- Maintains avg_rating and rating_count on marketplace_templates whenever
-- a review is inserted, updated, or deleted.

CREATE OR REPLACE FUNCTION update_template_avg_rating()
RETURNS TRIGGER AS $$
DECLARE
  target_template_id INTEGER;
BEGIN
  -- Use NEW for INSERT/UPDATE, OLD for DELETE
  IF TG_OP = 'DELETE' THEN
    target_template_id := OLD.template_id;
  ELSE
    target_template_id := NEW.template_id;
  END IF;

  UPDATE marketplace_templates
  SET avg_rating = (
        SELECT COALESCE(AVG(rating)::NUMERIC(3,2), 0.00)
        FROM template_reviews
        WHERE template_id = target_template_id AND is_visible = true
      ),
      rating_count = (
        SELECT COUNT(*)
        FROM template_reviews
        WHERE template_id = target_template_id AND is_visible = true
      )
  WHERE id = target_template_id;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_avg_rating ON template_reviews;
CREATE TRIGGER trigger_update_avg_rating
  AFTER INSERT OR UPDATE OR DELETE ON template_reviews
  FOR EACH ROW EXECUTE FUNCTION update_template_avg_rating();

-- ============================================================================
-- Step 6: Updated_at trigger
-- ============================================================================
-- Reuse update_updated_at_column() from migration 000.

DROP TRIGGER IF EXISTS template_reviews_updated_at ON template_reviews;
CREATE TRIGGER template_reviews_updated_at
  BEFORE UPDATE ON template_reviews
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


COMMIT;

-- ============================================================================
-- Verification
-- ============================================================================
-- SELECT * FROM rls_status;
-- SET LOCAL app.user_id = '1';
-- SELECT COUNT(*) FROM template_reviews;
-- RESET ALL;
-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
