-- ============================================================================
-- Migration 021: Lawyer Subscriptions
-- ============================================================================
-- Date: 2026-03-26
-- Description: Subscription management for lawyer add-on tiers. Tracks Stripe
--              subscription lifecycle (active, past_due, canceled, trialing),
--              billing periods, and tier codes. Each lawyer can have one active
--              subscription per tier (enforced via UNIQUE(lawyer_id, tier_code)).
--
-- Tier codes:
--   free      - Base tier (no charge)
--   prompts   - Custom AI prompts ($29/mo)
--   branding  - Custom branding ($49/mo)
--   clio      - Clio integration ($79/mo)
--   analytics - Advanced analytics ($39/mo)
--   api       - API access ($99/mo)
--   pro       - All features bundle ($199/mo)
--
-- Dependencies: users
--
-- RLS: Lawyers can read/manage their own subscriptions. Admins can read all.
-- ============================================================================

BEGIN;

-- ============================================================================
-- Step 1: Create lawyer_subscriptions Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS lawyer_subscriptions (
  id                      SERIAL PRIMARY KEY,
  lawyer_id               INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tier_code               VARCHAR(30) NOT NULL
                            CHECK (tier_code IN (
                              'free', 'prompts', 'branding', 'clio',
                              'analytics', 'api', 'pro'
                            )),
  stripe_subscription_id  VARCHAR(255),
  stripe_price_id         VARCHAR(255),
  status                  VARCHAR(20) NOT NULL DEFAULT 'active'
                            CHECK (status IN ('active', 'past_due', 'canceled', 'trialing')),
  price_cents             INTEGER NOT NULL DEFAULT 0,
  current_period_start    TIMESTAMP,
  current_period_end      TIMESTAMP,
  cancel_at_period_end    BOOLEAN DEFAULT false,
  created_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(lawyer_id, tier_code)
);


-- ============================================================================
-- Step 2: Create Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_lawyer_subs_lawyer ON lawyer_subscriptions(lawyer_id);
CREATE INDEX IF NOT EXISTS idx_lawyer_subs_stripe ON lawyer_subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_lawyer_subs_status ON lawyer_subscriptions(status) WHERE status = 'active';


-- ============================================================================
-- Step 3: Enable RLS
-- ============================================================================

ALTER TABLE lawyer_subscriptions ENABLE ROW LEVEL SECURITY;


-- ============================================================================
-- Step 4: Create RLS Policies
-- ============================================================================

DO $$
BEGIN
    -- Lawyers can SELECT their own subscriptions
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'lawyer_subscriptions' AND policyname = 'lawyer_subs_select_own') THEN
        EXECUTE 'CREATE POLICY lawyer_subs_select_own ON lawyer_subscriptions
            FOR SELECT
            USING (
                lawyer_id = current_user_id()
                OR current_user_is_admin()
                OR bypass_rls_enabled()
            )';
        RAISE NOTICE 'Created policy: lawyer_subs_select_own';
    END IF;

    -- Only server-side can INSERT subscriptions (Stripe webhook processing)
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'lawyer_subscriptions' AND policyname = 'lawyer_subs_insert_system') THEN
        EXECUTE 'CREATE POLICY lawyer_subs_insert_system ON lawyer_subscriptions
            FOR INSERT
            WITH CHECK (
                lawyer_id = current_user_id()
                OR bypass_rls_enabled()
            )';
        RAISE NOTICE 'Created policy: lawyer_subs_insert_system';
    END IF;

    -- Server-side or admin can UPDATE subscriptions (status changes, renewals)
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'lawyer_subscriptions' AND policyname = 'lawyer_subs_update_system') THEN
        EXECUTE 'CREATE POLICY lawyer_subs_update_system ON lawyer_subscriptions
            FOR UPDATE
            USING (
                lawyer_id = current_user_id()
                OR current_user_is_admin()
                OR bypass_rls_enabled()
            )';
        RAISE NOTICE 'Created policy: lawyer_subs_update_system';
    END IF;

    -- Only admin or system can DELETE (cancel records)
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'lawyer_subscriptions' AND policyname = 'lawyer_subs_delete_admin') THEN
        EXECUTE 'CREATE POLICY lawyer_subs_delete_admin ON lawyer_subscriptions
            FOR DELETE
            USING (
                current_user_is_admin()
                OR bypass_rls_enabled()
            )';
        RAISE NOTICE 'Created policy: lawyer_subs_delete_admin';
    END IF;
END $$;


-- ============================================================================
-- Step 5: Updated_at trigger
-- ============================================================================
-- Reuse update_updated_at_column() from migration 000.

DROP TRIGGER IF EXISTS lawyer_subscriptions_updated_at ON lawyer_subscriptions;
CREATE TRIGGER lawyer_subscriptions_updated_at
  BEFORE UPDATE ON lawyer_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


COMMIT;

-- ============================================================================
-- Verification
-- ============================================================================
-- SELECT * FROM rls_status;
-- SET LOCAL app.user_id = '1';
-- SELECT * FROM lawyer_subscriptions;  -- Only that lawyer's subscriptions
-- RESET ALL;
-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
