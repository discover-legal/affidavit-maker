-- Migration: Add secure multi-provider support and audit logging
-- Date: 2026-01-03
-- Purpose: Fix critical account takeover vulnerability and enable secure account linking

-- ============================================================================
-- PART 1: User Identities Table
-- ============================================================================
-- This table allows users to link multiple authentication providers to one account
-- while maintaining security and explicit user consent

CREATE TABLE IF NOT EXISTS user_identities (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    auth0_id VARCHAR(255) UNIQUE NOT NULL,
    provider VARCHAR(50) NOT NULL, -- 'auth0', 'google-oauth2', 'facebook', etc.
    provider_user_id VARCHAR(255), -- The user ID from the provider
    is_primary BOOLEAN DEFAULT false, -- The primary identity used for login
    verified BOOLEAN DEFAULT false, -- Whether this identity has been verified
    linked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Ensure each user can only have one primary identity per provider
    CONSTRAINT unique_user_provider UNIQUE(user_id, provider),

    -- Ensure auth0_id is globally unique
    CONSTRAINT unique_auth0_id UNIQUE(auth0_id)
);

-- Index for fast lookups by auth0_id (main authentication query)
CREATE INDEX IF NOT EXISTS idx_user_identities_auth0_id ON user_identities(auth0_id);

-- Index for fast lookups by user_id
CREATE INDEX IF NOT EXISTS idx_user_identities_user_id ON user_identities(user_id);

-- Index for finding primary identities
CREATE INDEX IF NOT EXISTS idx_user_identities_primary ON user_identities(user_id, is_primary) WHERE is_primary = true;


-- ============================================================================
-- PART 2: Audit Log Table
-- ============================================================================
-- Track all security-sensitive operations for compliance and forensics

CREATE TABLE IF NOT EXISTS audit_log (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    event_type VARCHAR(100) NOT NULL, -- 'account_created', 'identity_linked', 'auth0_id_changed', etc.
    event_category VARCHAR(50) NOT NULL, -- 'authentication', 'authorization', 'data_access', etc.
    severity VARCHAR(20) DEFAULT 'info', -- 'info', 'warning', 'error', 'critical'

    -- Event details
    description TEXT,
    metadata JSONB, -- Flexible storage for event-specific data

    -- Request context
    ip_address VARCHAR(45),
    user_agent TEXT,
    request_id VARCHAR(100),

    -- Old and new values for change tracking
    old_value TEXT,
    new_value TEXT,

    -- Success/failure tracking
    success BOOLEAN DEFAULT true,
    error_message TEXT,

    -- Timestamp
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_event_type ON audit_log(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_severity ON audit_log(severity) WHERE severity IN ('error', 'critical');


-- ============================================================================
-- PART 3: Account Linking Requests Table
-- ============================================================================
-- Track pending account linking requests that require user verification

CREATE TABLE IF NOT EXISTS account_linking_requests (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    new_auth0_id VARCHAR(255) NOT NULL,
    new_provider VARCHAR(50) NOT NULL,
    new_email VARCHAR(255),

    -- Security
    verification_token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,

    -- Status tracking
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'expired'
    approved_at TIMESTAMP,
    rejected_at TIMESTAMP,

    -- Request metadata
    ip_address VARCHAR(45),
    user_agent TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT unique_pending_link UNIQUE(user_id, new_auth0_id)
);

CREATE INDEX IF NOT EXISTS idx_linking_requests_user_id ON account_linking_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_linking_requests_token ON account_linking_requests(verification_token);
CREATE INDEX IF NOT EXISTS idx_linking_requests_status ON account_linking_requests(status) WHERE status = 'pending';


-- ============================================================================
-- PART 4: Migrate Existing Data
-- ============================================================================
-- Migrate existing users.auth0_id to user_identities table

-- Insert all existing users' auth0_ids as their primary identity
INSERT INTO user_identities (user_id, auth0_id, provider, is_primary, verified)
SELECT
    id,
    auth0_id,
    -- Extract provider from auth0_id (format: "provider|id")
    CASE
        WHEN auth0_id LIKE 'google-oauth2|%' THEN 'google-oauth2'
        WHEN auth0_id LIKE 'facebook|%' THEN 'facebook'
        WHEN auth0_id LIKE 'github|%' THEN 'github'
        WHEN auth0_id LIKE 'auth0|%' THEN 'auth0'
        WHEN auth0_id LIKE 'windowslive|%' THEN 'windowslive'
        ELSE 'unknown'
    END,
    true, -- is_primary
    true  -- verified (assume existing users are verified)
FROM users
WHERE auth0_id IS NOT NULL
ON CONFLICT (auth0_id) DO NOTHING;


-- ============================================================================
-- PART 5: Add Helper Functions
-- ============================================================================

-- Function to log audit events
CREATE OR REPLACE FUNCTION log_audit_event(
    p_user_id INTEGER,
    p_event_type VARCHAR,
    p_event_category VARCHAR,
    p_description TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT NULL,
    p_old_value TEXT DEFAULT NULL,
    p_new_value TEXT DEFAULT NULL,
    p_severity VARCHAR DEFAULT 'info',
    p_ip_address VARCHAR DEFAULT NULL
) RETURNS INTEGER AS $$
DECLARE
    v_audit_id INTEGER;
BEGIN
    INSERT INTO audit_log (
        user_id, event_type, event_category, description, metadata,
        old_value, new_value, severity, ip_address, created_at
    ) VALUES (
        p_user_id, p_event_type, p_event_category, p_description, p_metadata,
        p_old_value, p_new_value, p_severity, p_ip_address, NOW()
    ) RETURNING id INTO v_audit_id;

    RETURN v_audit_id;
END;
$$ LANGUAGE plpgsql;


-- Function to safely link a new identity to a user
CREATE OR REPLACE FUNCTION link_identity_to_user(
    p_user_id INTEGER,
    p_auth0_id VARCHAR,
    p_provider VARCHAR,
    p_ip_address VARCHAR DEFAULT NULL
) RETURNS INTEGER AS $$
DECLARE
    v_identity_id INTEGER;
    v_existing_user_id INTEGER;
BEGIN
    -- Check if this auth0_id is already linked to another user
    SELECT user_id INTO v_existing_user_id
    FROM user_identities
    WHERE auth0_id = p_auth0_id;

    IF v_existing_user_id IS NOT NULL AND v_existing_user_id != p_user_id THEN
        RAISE EXCEPTION 'This identity is already linked to another user';
    END IF;

    -- Insert or update the identity
    INSERT INTO user_identities (user_id, auth0_id, provider, is_primary, verified, linked_at)
    VALUES (p_user_id, p_auth0_id, p_provider, false, true, NOW())
    ON CONFLICT (auth0_id) DO UPDATE SET
        last_used_at = NOW()
    RETURNING id INTO v_identity_id;

    -- Log the event
    PERFORM log_audit_event(
        p_user_id,
        'identity_linked',
        'authentication',
        'New identity linked to account',
        jsonb_build_object('auth0_id', p_auth0_id, 'provider', p_provider),
        NULL,
        p_auth0_id,
        'info',
        p_ip_address
    );

    RETURN v_identity_id;
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- PART 6: Add Triggers for Audit Logging
-- ============================================================================

-- Trigger to log auth0_id changes in users table
CREATE OR REPLACE FUNCTION trigger_log_auth0_id_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.auth0_id IS DISTINCT FROM NEW.auth0_id THEN
        PERFORM log_audit_event(
            NEW.id,
            'auth0_id_changed',
            'authentication',
            'User auth0_id was changed - POTENTIAL SECURITY ISSUE',
            jsonb_build_object(
                'user_id', NEW.id,
                'email', NEW.email
            ),
            OLD.auth0_id,
            NEW.auth0_id,
            'critical',
            NULL
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER log_auth0_id_changes
    AFTER UPDATE ON users
    FOR EACH ROW
    WHEN (OLD.auth0_id IS DISTINCT FROM NEW.auth0_id)
    EXECUTE FUNCTION trigger_log_auth0_id_change();


-- ============================================================================
-- PART 7: Add Constraints and Comments
-- ============================================================================

-- Add comments for documentation
COMMENT ON TABLE user_identities IS 'Stores multiple authentication provider identities per user for secure account linking';
COMMENT ON TABLE audit_log IS 'Security audit log for tracking all sensitive operations';
COMMENT ON TABLE account_linking_requests IS 'Pending account linking requests requiring user verification';

COMMENT ON COLUMN user_identities.is_primary IS 'The primary identity used when the user logs in';
COMMENT ON COLUMN user_identities.auth0_id IS 'The Auth0 sub claim (format: provider|id)';

-- ============================================================================
-- Migration Complete
-- ============================================================================
