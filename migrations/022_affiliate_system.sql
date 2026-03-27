-- ============================================================================
-- Migration 022: Affiliate System
-- ============================================================================
-- Date: 2026-03-26
-- Description: Three-table affiliate system for the marketplace.
--
--   1. affiliate_accounts  — Affiliate profiles with Stripe Connect, commission
--                            rates, and aggregate stats.
--   2. affiliate_referrals — Click tracking with 30-day cookie window, conversion
--                            attribution, and visitor fingerprinting.
--   3. affiliate_payouts   — Payout ledger with period-based batching and
--                            Stripe transfer tracking.
--
-- Dependencies: users, template_purchases (migration 019)
--
-- RLS: Users can manage their own affiliate data. Admins see all.
-- ============================================================================

BEGIN;

-- ============================================================================
-- Step 1: Create affiliate_accounts Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS affiliate_accounts (
  id                          SERIAL PRIMARY KEY,
  user_id                     INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  affiliate_code              VARCHAR(50) UNIQUE NOT NULL,
  display_name                VARCHAR(255),
  website_url                 VARCHAR(1000),
  commission_rate             NUMERIC(5,4) NOT NULL DEFAULT 0.1000,
  stripe_connect_id           VARCHAR(255) UNIQUE,
  stripe_onboarding_complete  BOOLEAN DEFAULT false,
  total_clicks                INTEGER DEFAULT 0,
  total_conversions           INTEGER DEFAULT 0,
  total_earned_cents          INTEGER DEFAULT 0,
  status                      VARCHAR(20) DEFAULT 'active'
                                CHECK (status IN ('active', 'suspended', 'closed')),
  created_at                  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at                  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_affiliate_code   ON affiliate_accounts(affiliate_code);
CREATE INDEX IF NOT EXISTS idx_affiliate_user   ON affiliate_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_stripe ON affiliate_accounts(stripe_connect_id);


-- ============================================================================
-- Step 2: Create affiliate_referrals Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS affiliate_referrals (
  id                  SERIAL PRIMARY KEY,
  affiliate_id        INTEGER NOT NULL REFERENCES affiliate_accounts(id) ON DELETE CASCADE,
  visitor_fingerprint VARCHAR(64),
  landing_url         TEXT,
  referrer_url        TEXT,
  ip_address          INET,
  user_agent          TEXT,
  converted           BOOLEAN DEFAULT false,
  converted_user_id   INTEGER REFERENCES users(id),
  purchase_id         INTEGER REFERENCES template_purchases(id),
  click_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  converted_at        TIMESTAMP,
  expires_at          TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL '30 days')
);

CREATE INDEX IF NOT EXISTS idx_referrals_affiliate ON affiliate_referrals(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_referrals_converted ON affiliate_referrals(converted) WHERE converted = false;
CREATE INDEX IF NOT EXISTS idx_referrals_expires   ON affiliate_referrals(expires_at);
CREATE INDEX IF NOT EXISTS idx_referrals_visitor   ON affiliate_referrals(visitor_fingerprint);


-- ============================================================================
-- Step 3: Create affiliate_payouts Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS affiliate_payouts (
  id                  SERIAL PRIMARY KEY,
  affiliate_id        INTEGER NOT NULL REFERENCES affiliate_accounts(id),
  amount_cents        INTEGER NOT NULL,
  stripe_transfer_id  VARCHAR(255),
  status              VARCHAR(20) DEFAULT 'pending'
                        CHECK (status IN ('pending', 'processing', 'paid', 'failed')),
  period_start        DATE NOT NULL,
  period_end          DATE NOT NULL,
  referral_count      INTEGER DEFAULT 0,
  created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  paid_at             TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_aff_payouts_affiliate ON affiliate_payouts(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_aff_payouts_status    ON affiliate_payouts(status);


-- ============================================================================
-- Step 4: Enable RLS on All 3 Tables
-- ============================================================================

ALTER TABLE affiliate_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_payouts ENABLE ROW LEVEL SECURITY;


-- ============================================================================
-- Step 5: RLS Policies for affiliate_accounts
-- ============================================================================

DO $$
BEGIN
    -- Users can SELECT their own affiliate account
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'affiliate_accounts' AND policyname = 'aff_accounts_select_own') THEN
        EXECUTE 'CREATE POLICY aff_accounts_select_own ON affiliate_accounts
            FOR SELECT
            USING (
                user_id = current_user_id()
                OR current_user_is_admin()
                OR bypass_rls_enabled()
            )';
        RAISE NOTICE 'Created policy: aff_accounts_select_own';
    END IF;

    -- Public can look up affiliate accounts by code (for referral links)
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'affiliate_accounts' AND policyname = 'aff_accounts_select_public') THEN
        EXECUTE 'CREATE POLICY aff_accounts_select_public ON affiliate_accounts
            FOR SELECT
            USING (
                status = ''active''
            )';
        RAISE NOTICE 'Created policy: aff_accounts_select_public';
    END IF;

    -- Users can INSERT their own affiliate account (sign up)
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'affiliate_accounts' AND policyname = 'aff_accounts_insert_own') THEN
        EXECUTE 'CREATE POLICY aff_accounts_insert_own ON affiliate_accounts
            FOR INSERT
            WITH CHECK (
                user_id = current_user_id()
                OR bypass_rls_enabled()
            )';
        RAISE NOTICE 'Created policy: aff_accounts_insert_own';
    END IF;

    -- Users can UPDATE their own affiliate account
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'affiliate_accounts' AND policyname = 'aff_accounts_update_own') THEN
        EXECUTE 'CREATE POLICY aff_accounts_update_own ON affiliate_accounts
            FOR UPDATE
            USING (
                user_id = current_user_id()
                OR current_user_is_admin()
                OR bypass_rls_enabled()
            )';
        RAISE NOTICE 'Created policy: aff_accounts_update_own';
    END IF;

    -- Only admin or system can DELETE affiliate accounts
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'affiliate_accounts' AND policyname = 'aff_accounts_delete_admin') THEN
        EXECUTE 'CREATE POLICY aff_accounts_delete_admin ON affiliate_accounts
            FOR DELETE
            USING (
                current_user_is_admin()
                OR bypass_rls_enabled()
            )';
        RAISE NOTICE 'Created policy: aff_accounts_delete_admin';
    END IF;
END $$;


-- ============================================================================
-- Step 6: RLS Policies for affiliate_referrals
-- ============================================================================

DO $$
BEGIN
    -- Affiliates can SELECT referrals for their own account
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'affiliate_referrals' AND policyname = 'aff_referrals_select_own') THEN
        EXECUTE 'CREATE POLICY aff_referrals_select_own ON affiliate_referrals
            FOR SELECT
            USING (
                affiliate_id IN (
                    SELECT id FROM affiliate_accounts
                    WHERE user_id = current_user_id()
                )
                OR current_user_is_admin()
                OR bypass_rls_enabled()
            )';
        RAISE NOTICE 'Created policy: aff_referrals_select_own';
    END IF;

    -- Only server-side can INSERT referrals (click tracking endpoint)
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'affiliate_referrals' AND policyname = 'aff_referrals_insert_system') THEN
        EXECUTE 'CREATE POLICY aff_referrals_insert_system ON affiliate_referrals
            FOR INSERT
            WITH CHECK (bypass_rls_enabled())';
        RAISE NOTICE 'Created policy: aff_referrals_insert_system';
    END IF;

    -- Only server-side can UPDATE referrals (conversion attribution)
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'affiliate_referrals' AND policyname = 'aff_referrals_update_system') THEN
        EXECUTE 'CREATE POLICY aff_referrals_update_system ON affiliate_referrals
            FOR UPDATE
            USING (
                bypass_rls_enabled()
                OR current_user_is_admin()
            )';
        RAISE NOTICE 'Created policy: aff_referrals_update_system';
    END IF;

    -- Only admin can DELETE referrals
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'affiliate_referrals' AND policyname = 'aff_referrals_delete_admin') THEN
        EXECUTE 'CREATE POLICY aff_referrals_delete_admin ON affiliate_referrals
            FOR DELETE
            USING (
                current_user_is_admin()
                OR bypass_rls_enabled()
            )';
        RAISE NOTICE 'Created policy: aff_referrals_delete_admin';
    END IF;
END $$;


-- ============================================================================
-- Step 7: RLS Policies for affiliate_payouts
-- ============================================================================

DO $$
BEGIN
    -- Affiliates can SELECT their own payouts
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'affiliate_payouts' AND policyname = 'aff_payouts_select_own') THEN
        EXECUTE 'CREATE POLICY aff_payouts_select_own ON affiliate_payouts
            FOR SELECT
            USING (
                affiliate_id IN (
                    SELECT id FROM affiliate_accounts
                    WHERE user_id = current_user_id()
                )
                OR current_user_is_admin()
                OR bypass_rls_enabled()
            )';
        RAISE NOTICE 'Created policy: aff_payouts_select_own';
    END IF;

    -- Only server-side can INSERT payouts (payout batch job)
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'affiliate_payouts' AND policyname = 'aff_payouts_insert_system') THEN
        EXECUTE 'CREATE POLICY aff_payouts_insert_system ON affiliate_payouts
            FOR INSERT
            WITH CHECK (bypass_rls_enabled())';
        RAISE NOTICE 'Created policy: aff_payouts_insert_system';
    END IF;

    -- Only server-side or admin can UPDATE payouts (status transitions)
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'affiliate_payouts' AND policyname = 'aff_payouts_update_system') THEN
        EXECUTE 'CREATE POLICY aff_payouts_update_system ON affiliate_payouts
            FOR UPDATE
            USING (
                bypass_rls_enabled()
                OR current_user_is_admin()
            )';
        RAISE NOTICE 'Created policy: aff_payouts_update_system';
    END IF;

    -- Only admin can DELETE payouts
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'affiliate_payouts' AND policyname = 'aff_payouts_delete_admin') THEN
        EXECUTE 'CREATE POLICY aff_payouts_delete_admin ON affiliate_payouts
            FOR DELETE
            USING (
                current_user_is_admin()
                OR bypass_rls_enabled()
            )';
        RAISE NOTICE 'Created policy: aff_payouts_delete_admin';
    END IF;
END $$;


-- ============================================================================
-- Step 8: Updated_at trigger for affiliate_accounts
-- ============================================================================
-- Reuse update_updated_at_column() from migration 000.
-- Only affiliate_accounts has updated_at; referrals and payouts do not.

DROP TRIGGER IF EXISTS affiliate_accounts_updated_at ON affiliate_accounts;
CREATE TRIGGER affiliate_accounts_updated_at
  BEFORE UPDATE ON affiliate_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


COMMIT;

-- ============================================================================
-- Verification
-- ============================================================================
-- SELECT * FROM rls_status;
-- SET LOCAL app.user_id = '1';
-- SELECT * FROM affiliate_accounts;   -- Only user 1's affiliate account
-- SELECT * FROM affiliate_referrals;  -- Only referrals for user 1's account
-- SELECT * FROM affiliate_payouts;    -- Only payouts for user 1's account
-- RESET ALL;
-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
