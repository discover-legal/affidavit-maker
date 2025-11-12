-- Migration: Add research consent tracking
-- Created: 2025-11-12

-- Add research consent fields to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS research_consent BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS research_consent_at TIMESTAMP NULL;

-- Add research consent to TOS acceptance log
ALTER TABLE tos_acceptance_log
ADD COLUMN IF NOT EXISTS research_consent BOOLEAN DEFAULT false;

-- Create index for finding users who consented to research
CREATE INDEX IF NOT EXISTS idx_users_research_consent ON users(research_consent) WHERE research_consent = true;

-- Add comments to explain the schema
COMMENT ON COLUMN users.research_consent IS 'Whether user consented to de-identified data usage for academic research';
COMMENT ON COLUMN users.research_consent_at IS 'Timestamp when user provided research consent';
COMMENT ON COLUMN tos_acceptance_log.research_consent IS 'Research consent status at time of TOS acceptance';
