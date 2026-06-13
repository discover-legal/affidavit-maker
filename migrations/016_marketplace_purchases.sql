-- ============================================================================
-- Migration 016: Marketplace Purchases
-- ============================================================================
-- Date: 2026-06-12
-- Description: One row per "$1/doc" purchase of a marketplace template. Records
--              the Stripe payment, the buyer's interview answers, and the
--              generated document. A buyer may purchase the same template
--              multiple times (each purchase = one completed document), so
--              there is intentionally NO unique (buyer, template) constraint.
--
--              Fulfillment reuses the existing Stripe webhook
--              (app/api/payment/webhook): on payment_intent.succeeded the
--              handler flips status -> 'paid' for the row matching the intent id
--              (metadata.kind = 'marketplace_purchase').
--
--              Inert until ENABLE_MARKETPLACE is on — every purchase/interview
--              Route Handler is flag-gated.
--
-- Dependencies: 000 (users), 010 (RLS helpers), 015 (marketplace_templates)
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS marketplace_purchases (
  id                        SERIAL PRIMARY KEY,
  template_id               INTEGER NOT NULL REFERENCES marketplace_templates(id) ON DELETE RESTRICT,
  buyer_id                  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Denormalized seller for fast "my sales" reads + payout attribution later.
  lawyer_id                 INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,

  -- Payment
  stripe_payment_intent_id  VARCHAR(255) UNIQUE,
  amount_cents              INTEGER NOT NULL CHECK (amount_cents >= 0),
  currency                  VARCHAR(3) NOT NULL DEFAULT 'usd',
  status                    VARCHAR(20) NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending', 'paid', 'failed', 'refunded')),

  -- Fulfillment
  interview_answers         JSONB NOT NULL DEFAULT '{}',
  completed_document        TEXT,
  document_generated_at     TIMESTAMP,

  created_at                TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  paid_at                   TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_mkt_purchases_buyer ON marketplace_purchases(buyer_id);
CREATE INDEX IF NOT EXISTS idx_mkt_purchases_template ON marketplace_purchases(template_id);
CREATE INDEX IF NOT EXISTS idx_mkt_purchases_lawyer ON marketplace_purchases(lawyer_id);
CREATE INDEX IF NOT EXISTS idx_mkt_purchases_status ON marketplace_purchases(status);

-- ----------------------------------------------------------------------------
-- Row Level Security
-- ----------------------------------------------------------------------------
ALTER TABLE marketplace_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_purchases FORCE ROW LEVEL SECURITY;

-- SELECT: the buyer sees their own purchases; the selling lawyer sees purchases
-- of their templates (read-only, for sales/analytics); admin + webhook bypass.
DROP POLICY IF EXISTS mkt_purchases_read ON marketplace_purchases;
CREATE POLICY mkt_purchases_read ON marketplace_purchases
  FOR SELECT USING (
    buyer_id = current_user_id()
    OR lawyer_id = current_user_id()
    OR current_user_is_admin()
    OR bypass_rls_enabled()
  );

-- INSERT: a buyer creates their own purchase row (checkout endpoint), or bypass.
DROP POLICY IF EXISTS mkt_purchases_insert ON marketplace_purchases;
CREATE POLICY mkt_purchases_insert ON marketplace_purchases
  FOR INSERT WITH CHECK (
    buyer_id = current_user_id()
    OR bypass_rls_enabled()
  );

-- UPDATE: the buyer updates their own row (answers/generate); admin + webhook
-- bypass (payment settlement). The selling lawyer may NOT mutate a buyer's row.
DROP POLICY IF EXISTS mkt_purchases_update ON marketplace_purchases;
CREATE POLICY mkt_purchases_update ON marketplace_purchases
  FOR UPDATE USING (
    buyer_id = current_user_id()
    OR current_user_is_admin()
    OR bypass_rls_enabled()
  );

DROP TRIGGER IF EXISTS mkt_purchases_updated_at ON marketplace_purchases;
CREATE TRIGGER mkt_purchases_updated_at
  BEFORE UPDATE ON marketplace_purchases
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMIT;
