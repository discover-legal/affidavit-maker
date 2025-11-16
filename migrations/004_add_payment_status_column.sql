-- Migration: Add payment_status column to documents table
-- Fixes bug where payment status is not persisted, causing repeated payment prompts
-- Date: 2025-11-16

BEGIN;

-- Add payment_status column to documents table
ALTER TABLE documents
ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT 'unpaid';

-- Migrate existing data: If payment_completed is true, set status to 'paid'
UPDATE documents
SET payment_status = 'paid'
WHERE payment_completed = true;

-- Add index for performance (we query by payment_status frequently)
CREATE INDEX IF NOT EXISTS idx_documents_payment_status ON documents(payment_status);

-- Add comment for documentation
COMMENT ON COLUMN documents.payment_status IS 'Payment status for document download. Values: unpaid, paid, refunded. Replaces boolean payment_completed field.';

-- Note: We keep payment_completed and payment_required columns for backward compatibility
-- They can be removed in a future migration once all code references are updated

COMMIT;

-- Log completion
DO $$
BEGIN
    RAISE NOTICE 'Migration 004 completed: Added payment_status column to documents';
    RAISE NOTICE 'Migrated existing payment_completed data to payment_status';
    RAISE NOTICE 'Added index on payment_status for query performance';
END $$;
