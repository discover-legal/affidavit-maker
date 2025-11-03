-- Migration: Defer billing address to Stripe
-- Only keep postal code for tax compliance and analytics
-- Date: 2025-11-03

BEGIN;

-- Remove full billing address from payments (Stripe stores this)
ALTER TABLE payments
DROP COLUMN IF EXISTS billing_address;

-- Add lightweight postal code field for tax/analytics
ALTER TABLE payments
ADD COLUMN IF NOT EXISTS billing_postal_code VARCHAR(20);

-- Add Stripe customer ID to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255) UNIQUE;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_payments_postal_code ON payments(billing_postal_code);
CREATE INDEX IF NOT EXISTS idx_users_stripe_customer ON users(stripe_customer_id);

-- Add comments for documentation
COMMENT ON COLUMN payments.billing_postal_code IS 'Postal/ZIP code extracted from Stripe billing details. Used for tax compliance and geographic analytics. Full address stored in Stripe.';
COMMENT ON COLUMN payments.stripe_customer_id IS 'Stripe Customer ID from payment intent. Links payment to Stripe customer record.';
COMMENT ON COLUMN users.stripe_customer_id IS 'Stripe Customer ID. Created on first payment for easier recurring billing, customer portal access, and payment method reuse.';

COMMIT;

-- Log completion
DO $$
BEGIN
    RAISE NOTICE 'Migration 002 completed: Billing address deferred to Stripe';
    RAISE NOTICE 'Removed: billing_address (JSONB)';
    RAISE NOTICE 'Added: billing_postal_code (VARCHAR)';
END $$;
