-- ============================================================================
-- Migration 019: Template Purchases
-- ============================================================================
-- Date: 2026-03-26
-- Description: Immutable purchase ledger for marketplace template transactions.
--              This is the financial source of truth — records template purchases,
--              fee splits (platform, Stripe, lawyer, affiliate), payout tracking,
--              and refund status. Includes triggers to update aggregate counters
--              on marketplace_templates and lawyer_profiles.
--
-- Dependencies: users, marketplace_templates, template_versions, documents,
--               lawyer_profiles (all from migrations 014-018)
--
-- RLS: Both client_id and lawyer_id can SELECT their own rows.
--       INSERT only via bypass_rls (server-side payment processing).
-- ============================================================================

BEGIN;

-- ============================================================================
-- Step 1: Create template_purchases Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS template_purchases (
  id                      SERIAL PRIMARY KEY,
  client_id               INTEGER NOT NULL REFERENCES users(id),
  template_id             INTEGER NOT NULL REFERENCES marketplace_templates(id),
  template_version_id     INTEGER REFERENCES template_versions(id),
  lawyer_id               INTEGER NOT NULL REFERENCES users(id),
  document_id             INTEGER REFERENCES documents(id) ON DELETE SET NULL,
  affiliate_id            INTEGER REFERENCES users(id),
  amount_cents            INTEGER NOT NULL,
  platform_fee_cents      INTEGER NOT NULL,
  stripe_fee_cents        INTEGER NOT NULL,
  lawyer_payout_cents     INTEGER NOT NULL,
  affiliate_payout_cents  INTEGER DEFAULT 0,
  stripe_payment_intent_id VARCHAR(255) UNIQUE,
  stripe_transfer_id      VARCHAR(255),
  payout_status           VARCHAR(20) DEFAULT 'pending'
                            CHECK (payout_status IN ('pending', 'transferred', 'paid', 'failed')),
  refund_status           VARCHAR(20) DEFAULT 'none'
                            CHECK (refund_status IN ('none', 'partial', 'full')),
  refunded_amount_cents   INTEGER DEFAULT 0,
  created_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- ============================================================================
-- Step 2: Create Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_purchases_client    ON template_purchases(client_id);
CREATE INDEX IF NOT EXISTS idx_purchases_template  ON template_purchases(template_id);
CREATE INDEX IF NOT EXISTS idx_purchases_lawyer    ON template_purchases(lawyer_id);
CREATE INDEX IF NOT EXISTS idx_purchases_affiliate ON template_purchases(affiliate_id) WHERE affiliate_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_purchases_stripe    ON template_purchases(stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_purchases_payout    ON template_purchases(payout_status) WHERE payout_status = 'pending';
CREATE INDEX IF NOT EXISTS idx_purchases_created   ON template_purchases(created_at);


-- ============================================================================
-- Step 3: Enable RLS
-- ============================================================================

ALTER TABLE template_purchases ENABLE ROW LEVEL SECURITY;


-- ============================================================================
-- Step 4: Create RLS Policies
-- ============================================================================

DO $$
BEGIN
    -- Clients can SELECT their own purchases
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'template_purchases' AND policyname = 'purchases_select_client') THEN
        EXECUTE 'CREATE POLICY purchases_select_client ON template_purchases
            FOR SELECT
            USING (
                client_id = current_user_id()
                OR current_user_is_admin()
                OR bypass_rls_enabled()
            )';
        RAISE NOTICE 'Created policy: purchases_select_client';
    END IF;

    -- Lawyers can SELECT purchases of their templates
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'template_purchases' AND policyname = 'purchases_select_lawyer') THEN
        EXECUTE 'CREATE POLICY purchases_select_lawyer ON template_purchases
            FOR SELECT
            USING (
                lawyer_id = current_user_id()
            )';
        RAISE NOTICE 'Created policy: purchases_select_lawyer';
    END IF;

    -- Only server-side (bypass_rls) can INSERT purchases (payment processing)
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'template_purchases' AND policyname = 'purchases_insert_system') THEN
        EXECUTE 'CREATE POLICY purchases_insert_system ON template_purchases
            FOR INSERT
            WITH CHECK (bypass_rls_enabled())';
        RAISE NOTICE 'Created policy: purchases_insert_system';
    END IF;

    -- Only server-side or admin can UPDATE (payout status, refunds)
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'template_purchases' AND policyname = 'purchases_update_system') THEN
        EXECUTE 'CREATE POLICY purchases_update_system ON template_purchases
            FOR UPDATE
            USING (
                bypass_rls_enabled()
                OR current_user_is_admin()
            )';
        RAISE NOTICE 'Created policy: purchases_update_system';
    END IF;

    -- No DELETE policy — purchase records are immutable (audit trail)
END $$;


-- ============================================================================
-- Step 5: Purchase Counter Trigger
-- ============================================================================
-- Updates aggregate counters on marketplace_templates and lawyer_profiles
-- whenever a new purchase is recorded.

CREATE OR REPLACE FUNCTION update_template_purchase_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE marketplace_templates
  SET total_purchases = total_purchases + 1,
      total_revenue_cents = total_revenue_cents + NEW.amount_cents
  WHERE id = NEW.template_id;

  UPDATE lawyer_profiles
  SET total_sales = total_sales + 1,
      total_earned_cents = total_earned_cents + NEW.lawyer_payout_cents
  WHERE user_id = NEW.lawyer_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_purchase_count ON template_purchases;
CREATE TRIGGER trigger_update_purchase_count
  AFTER INSERT ON template_purchases
  FOR EACH ROW EXECUTE FUNCTION update_template_purchase_count();


COMMIT;

-- ============================================================================
-- Verification
-- ============================================================================
-- SELECT * FROM rls_status;  -- Should show template_purchases with RLS enabled
-- SET LOCAL app.user_id = '1';
-- SELECT COUNT(*) FROM template_purchases;  -- Only user 1's purchases
-- RESET ALL;
-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
