-- Migration: Add Terms of Service acceptance tracking
-- Created: 2025-11-12

-- Add TOS acceptance fields to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS tos_accepted BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS tos_accepted_at TIMESTAMP NULL,
ADD COLUMN IF NOT EXISTS tos_version_accepted VARCHAR(20) NULL,
ADD COLUMN IF NOT EXISTS tos_ip_address VARCHAR(45) NULL;

-- Create index for quickly finding users who haven't accepted TOS
CREATE INDEX IF NOT EXISTS idx_users_tos_accepted ON users(tos_accepted);

-- Create a table to track TOS version history
CREATE TABLE IF NOT EXISTS tos_acceptance_log (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    tos_version VARCHAR(20) NOT NULL,
    accepted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip_address VARCHAR(45),
    user_agent TEXT,
    UNIQUE(user_id, tos_version)
);

-- Create index for TOS acceptance log
CREATE INDEX IF NOT EXISTS idx_tos_log_user_id ON tos_acceptance_log(user_id);
CREATE INDEX IF NOT EXISTS idx_tos_log_version ON tos_acceptance_log(tos_version);

-- Add comment to explain the schema
COMMENT ON COLUMN users.tos_accepted IS 'Whether user has accepted the current Terms of Service';
COMMENT ON COLUMN users.tos_accepted_at IS 'Timestamp when user accepted the current TOS';
COMMENT ON COLUMN users.tos_version_accepted IS 'Version of TOS that user accepted (e.g., 1.0.0)';
COMMENT ON COLUMN users.tos_ip_address IS 'IP address from which TOS was accepted (for legal records)';
COMMENT ON TABLE tos_acceptance_log IS 'Historical log of all TOS acceptances for audit trail';
