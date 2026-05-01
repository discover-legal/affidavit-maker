-- ============================================================================
-- Migration 016: Lawyer Profiles
-- ============================================================================
-- Date: 2026-03-26
-- Description: Creates the lawyer_profiles table for marketplace lawyer
--              accounts. Stores bar verification, Stripe Connect payouts,
--              licensed jurisdictions, and aggregate marketplace stats.
--
-- Dependencies: 000_initial_schema.sql (users table),
--               010_enable_rls_all_tables.sql (RLS helper functions),
--               015_add_user_roles.sql (user_role column)
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS lawyer_profiles (
  id                          SERIAL PRIMARY KEY,
  user_id                     INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Bar admission
  bar_number                  VARCHAR(100),
  bar_state                   CHAR(2),
  bar_verified                BOOLEAN DEFAULT false,
  bar_verified_at             TIMESTAMP,
  licensed_jurisdictions      TEXT[] DEFAULT '{}',
  specialties                 TEXT[] DEFAULT '{}',

  -- Profile display
  firm_name                   VARCHAR(500),
  bio                         TEXT,
  avatar_url                  VARCHAR(1000),
  logo_url                    VARCHAR(1000),
  website_url                 VARCHAR(1000),
  display_name                VARCHAR(255),
  years_experience            INTEGER,

  -- Stripe Connect (payouts to lawyers)
  stripe_connect_id           VARCHAR(255) UNIQUE,
  stripe_onboarding_complete  BOOLEAN DEFAULT false,
  stripe_payouts_enabled      BOOLEAN DEFAULT false,
  payout_schedule             VARCHAR(20) DEFAULT 'weekly'
                                CHECK (payout_schedule IN ('daily', 'weekly', 'monthly')),

  -- Aggregate marketplace stats (denormalized for fast reads)
  total_templates             INTEGER DEFAULT 0,
  total_sales                 INTEGER DEFAULT 0,
  total_earned_cents          INTEGER DEFAULT 0,
  avg_template_rating         NUMERIC(3,2) DEFAULT 0.00,

  -- Featured placement
  is_featured                 BOOLEAN DEFAULT false,
  featured_until              TIMESTAMP,

  -- Timestamps
  created_at                  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at                  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_lawyer_profiles_user
  ON lawyer_profiles(user_id);

CREATE INDEX IF NOT EXISTS idx_lawyer_profiles_bar
  ON lawyer_profiles(bar_state, bar_number);

CREATE INDEX IF NOT EXISTS idx_lawyer_profiles_stripe
  ON lawyer_profiles(stripe_connect_id);

CREATE INDEX IF NOT EXISTS idx_lawyer_profiles_jurisdictions
  ON lawyer_profiles USING GIN(licensed_jurisdictions);

CREATE INDEX IF NOT EXISTS idx_lawyer_profiles_specialties
  ON lawyer_profiles USING GIN(specialties);

-- ============================================================================
-- Row Level Security
-- ============================================================================
-- Follows the same pattern as migration 010. Uses helper functions:
--   current_user_id(), current_user_is_admin(), bypass_rls_enabled()

ALTER TABLE lawyer_profiles ENABLE ROW LEVEL SECURITY;

-- SELECT: own profile, admin, bypass, OR any verified profile (public marketplace)
CREATE POLICY lawyer_profiles_select ON lawyer_profiles
  FOR SELECT USING (
    user_id = current_user_id()
    OR current_user_is_admin()
    OR bypass_rls_enabled()
    OR bar_verified = true
  );

-- INSERT: only the owning user or bypass (admin creates via bypass)
CREATE POLICY lawyer_profiles_insert ON lawyer_profiles
  FOR INSERT WITH CHECK (
    user_id = current_user_id()
    OR bypass_rls_enabled()
  );

-- UPDATE: own profile, admin, or bypass
CREATE POLICY lawyer_profiles_update ON lawyer_profiles
  FOR UPDATE USING (
    user_id = current_user_id()
    OR current_user_is_admin()
    OR bypass_rls_enabled()
  );

-- DELETE: admin or bypass only
CREATE POLICY lawyer_profiles_delete ON lawyer_profiles
  FOR DELETE USING (
    current_user_is_admin()
    OR bypass_rls_enabled()
  );

-- ============================================================================
-- Updated_at trigger
-- ============================================================================
-- Reuse update_updated_at_column() from migration 000 if it exists;
-- otherwise create a table-specific version.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
    -- Use existing shared trigger function
    EXECUTE 'DROP TRIGGER IF EXISTS lawyer_profiles_updated_at ON lawyer_profiles';
    EXECUTE 'CREATE TRIGGER lawyer_profiles_updated_at
      BEFORE UPDATE ON lawyer_profiles
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()';
  ELSE
    -- Create a table-specific function as fallback
    CREATE OR REPLACE FUNCTION update_lawyer_profiles_updated_at()
    RETURNS TRIGGER AS $fn$
    BEGIN
      NEW.updated_at = CURRENT_TIMESTAMP;
      RETURN NEW;
    END;
    $fn$ LANGUAGE plpgsql;

    EXECUTE 'DROP TRIGGER IF EXISTS lawyer_profiles_updated_at ON lawyer_profiles';
    EXECUTE 'CREATE TRIGGER lawyer_profiles_updated_at
      BEFORE UPDATE ON lawyer_profiles
      FOR EACH ROW EXECUTE FUNCTION update_lawyer_profiles_updated_at()';
  END IF;
END $$;

COMMIT;
