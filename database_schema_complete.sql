-- database-schema.sql - Complete database schema for Affidavit Maker
-- Run this file to set up all necessary tables and indexes

-- Enable UUID extension if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table - stores user account information
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    
    -- Auth0 integration
    auth0_id VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE,
    name VARCHAR(255) NOT NULL,
    
    -- User profile
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    phone VARCHAR(20),
    
    -- Account status
    is_active BOOLEAN DEFAULT true,
    is_admin BOOLEAN DEFAULT false,
    email_verified BOOLEAN DEFAULT false,
    
    -- Subscription info
    subscription_tier VARCHAR(50) DEFAULT 'free', -- free, pro, enterprise
    subscription_status VARCHAR(50) DEFAULT 'active',
    documents_remaining INTEGER,
    
    -- Usage tracking
    total_documents_created INTEGER DEFAULT 0,
    total_amount_spent_cents INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Soft delete
    deleted_at TIMESTAMP NULL
);

-- Documents table - stores affidavit drafts and completed documents
CREATE TABLE IF NOT EXISTS documents (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    
    -- Document metadata
    title VARCHAR(255),
    document_type VARCHAR(100) DEFAULT 'affidavit', -- affidavit, motion, contract, etc.
    template_state VARCHAR(2), -- TX, UT, AZ, etc.
    
    -- Document content (stored as JSONB for flexibility)
    content JSONB NOT NULL,
    
    -- AI processing metadata
    conversation_history JSONB, -- Chat messages and AI responses
    extraction_metadata JSONB, -- How facts were extracted
    validation_results JSONB, -- Template validation results
    generation_metadata JSONB, -- AI generation metadata
    
    -- Document status and workflow
    status VARCHAR(50) DEFAULT 'draft', -- draft, completed, paid, downloaded
    completion_percentage INTEGER DEFAULT 0,
    
    -- Legal requirements tracking
    required_fields_completed JSONB,
    validation_errors JSONB,
    
    -- File generation
    pdf_generated BOOLEAN DEFAULT false,
    pdf_file_path VARCHAR(500),
    pdf_generation_date TIMESTAMP,
    
    -- Payment tracking
    payment_required BOOLEAN DEFAULT true,
    payment_completed BOOLEAN DEFAULT false,
    payment_id INTEGER, -- References payments table
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    downloaded_at TIMESTAMP,
    
    -- Soft delete
    deleted_at TIMESTAMP NULL
);

-- Payments table - tracks all payment transactions
CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    document_id INTEGER REFERENCES documents(id) ON DELETE SET NULL,
    
    -- Stripe integration
    stripe_payment_intent_id VARCHAR(255) UNIQUE,
    stripe_charge_id VARCHAR(255),
    stripe_customer_id VARCHAR(255),
    
    -- Payment details
    amount_cents INTEGER NOT NULL, -- Amount in cents (e.g., 999 = $9.99)
    currency VARCHAR(3) DEFAULT 'usd',
    status VARCHAR(50) NOT NULL, -- pending, succeeded, failed, refunded, canceled
    
    -- Payment method
    payment_method_type VARCHAR(50), -- card, ach, etc.
    payment_method_details JSONB, -- Last 4 digits, brand, etc.
    
    -- Transaction metadata
    description TEXT,
    metadata JSONB,
    
    -- Billing information
    billing_address JSONB,
    
    -- Refund tracking
    refunded_amount_cents INTEGER DEFAULT 0,
    refund_reason TEXT,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    succeeded_at TIMESTAMP,
    failed_at TIMESTAMP,
    refunded_at TIMESTAMP
);

-- Activity logs table - tracks user actions for analytics and debugging
CREATE TABLE IF NOT EXISTS activity_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    
    -- Action details
    action VARCHAR(100) NOT NULL, -- login, create_document, generate_pdf, etc.
    resource_type VARCHAR(50), -- document, payment, user, etc.
    resource_id INTEGER,
    
    -- Request context
    ip_address INET,
    user_agent TEXT,
    request_id VARCHAR(255),
    
    -- Additional metadata
    metadata JSONB,
    
    -- Timestamp
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sessions table - for managing user sessions and drafts
CREATE TABLE IF NOT EXISTS sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    
    -- Session identification
    session_token VARCHAR(255) UNIQUE NOT NULL,
    
    -- Session data
    data JSONB NOT NULL,
    
    -- Expiration
    expires_at TIMESTAMP NOT NULL,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Email notifications table - tracks email communications
CREATE TABLE IF NOT EXISTS email_notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    
    -- Email details
    email_type VARCHAR(100) NOT NULL, -- welcome, document_ready, payment_failed, etc.
    recipient_email VARCHAR(255) NOT NULL,
    subject VARCHAR(500),
    
    -- Content
    template_name VARCHAR(100),
    template_variables JSONB,
    
    -- Delivery status
    status VARCHAR(50) DEFAULT 'pending', -- pending, sent, failed, bounced
    sent_at TIMESTAMP,
    opened_at TIMESTAMP,
    clicked_at TIMESTAMP,
    
    -- External service tracking
    external_id VARCHAR(255), -- Sendgrid/SES message ID
    error_message TEXT,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Document templates table - for custom templates (future feature)
CREATE TABLE IF NOT EXISTS document_templates (
    id SERIAL PRIMARY KEY,
    created_by INTEGER REFERENCES users(id) ON DELETE CASCADE,
    
    -- Template metadata
    name VARCHAR(255) NOT NULL,
    description TEXT,
    document_type VARCHAR(100) NOT NULL,
    applicable_states VARCHAR(100)[], -- Array of state codes
    
    -- Template structure
    template_structure JSONB NOT NULL,
    required_fields JSONB NOT NULL,
    validation_rules JSONB,
    
    -- Access control
    is_public BOOLEAN DEFAULT false,
    is_premium BOOLEAN DEFAULT false,
    price_cents INTEGER DEFAULT 0,
    
    -- Usage tracking
    usage_count INTEGER DEFAULT 0,
    
    -- Status
    status VARCHAR(50) DEFAULT 'draft', -- draft, active, deprecated
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- API keys table - for enterprise customers
-- NOTE: API keys are stored as hashes only for security. The plaintext key
-- should be shown to the user only once during creation and never stored.
CREATE TABLE IF NOT EXISTS api_keys (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    
    -- Key details
    key_name VARCHAR(255) NOT NULL,
    api_key_hash VARCHAR(255) UNIQUE NOT NULL, -- Hashed version for verification
    
    -- Permissions
    scopes VARCHAR(100)[], -- Array of allowed scopes
    rate_limit_per_hour INTEGER DEFAULT 100,
    
    -- Usage tracking
    total_requests INTEGER DEFAULT 0,
    last_used_at TIMESTAMP,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    expires_at TIMESTAMP,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    revoked_at TIMESTAMP
);

-- Webhooks table - for Stripe and other external service webhooks
CREATE TABLE IF NOT EXISTS webhook_events (
    id SERIAL PRIMARY KEY,
    
    -- Event details
    external_id VARCHAR(255) UNIQUE NOT NULL, -- Stripe event ID, etc.
    event_type VARCHAR(100) NOT NULL,
    source VARCHAR(50) NOT NULL, -- stripe, auth0, etc.
    
    -- Processing status
    status VARCHAR(50) DEFAULT 'pending', -- pending, processed, failed, ignored
    processed_at TIMESTAMP,
    retry_count INTEGER DEFAULT 0,
    
    -- Event data
    raw_data JSONB NOT NULL,
    processed_data JSONB,
    error_message TEXT,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

-- Users table indexes
CREATE INDEX IF NOT EXISTS idx_users_auth0_id ON users(auth0_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active) WHERE is_active = true;

-- Documents table indexes
CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_created_at ON documents(created_at);
CREATE INDEX IF NOT EXISTS idx_documents_updated_at ON documents(updated_at);
CREATE INDEX IF NOT EXISTS idx_documents_user_status ON documents(user_id, status);
CREATE INDEX IF NOT EXISTS idx_documents_template_state ON documents(template_state);

-- Payments table indexes
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_document_id ON payments(document_id);
CREATE INDEX IF NOT EXISTS idx_payments_stripe_intent ON payments(stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at);

-- Activity logs indexes
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON activity_logs(action);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_activity_logs_resource ON activity_logs(resource_type, resource_id);

-- Sessions table indexes
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

-- Email notifications indexes
CREATE INDEX IF NOT EXISTS idx_email_notifications_user_id ON email_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_email_notifications_status ON email_notifications(status);
CREATE INDEX IF NOT EXISTS idx_email_notifications_created_at ON email_notifications(created_at);

-- Webhook events indexes
CREATE INDEX IF NOT EXISTS idx_webhook_events_external_id ON webhook_events(external_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_status ON webhook_events(status);
CREATE INDEX IF NOT EXISTS idx_webhook_events_created_at ON webhook_events(created_at);

-- ============================================
-- TRIGGERS FOR AUTOMATIC TIMESTAMPS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$ language 'plpgsql';

-- Apply trigger to tables with updated_at column
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON documents 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sessions_updated_at BEFORE UPDATE ON sessions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_document_templates_updated_at BEFORE UPDATE ON document_templates 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- FUNCTIONS FOR COMMON OPERATIONS
-- ============================================

-- Function to get user document count
CREATE OR REPLACE FUNCTION get_user_document_count(user_id_param INTEGER)
RETURNS INTEGER AS $
BEGIN
    RETURN (
        SELECT COUNT(*)
        FROM documents 
        WHERE user_id = user_id_param 
        AND deleted_at IS NULL
    );
END;
$ LANGUAGE plpgsql;

-- Function to update user document count
CREATE OR REPLACE FUNCTION update_user_document_count()
RETURNS TRIGGER AS $
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE users 
        SET total_documents_created = total_documents_created + 1
        WHERE id = NEW.user_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE users 
        SET total_documents_created = total_documents_created - 1
        WHERE id = OLD.user_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$ LANGUAGE plpgsql;

-- Apply trigger to update document count
CREATE TRIGGER trigger_update_user_document_count
    AFTER INSERT OR DELETE ON documents
    FOR EACH ROW EXECUTE FUNCTION update_user_document_count();

-- ============================================
-- INITIAL DATA / SEED DATA
-- ============================================

-- Insert default document templates (after creating a default user first)
-- First create a system user for the templates
INSERT INTO users (auth0_id, email, name, is_admin, created_at)
VALUES ('system|templates', 'system@affidavit-maker.com', 'System Templates', true, CURRENT_TIMESTAMP)
ON CONFLICT (auth0_id) DO NOTHING;

-- Now insert templates with the system user ID
INSERT INTO document_templates (name, description, document_type, applicable_states, template_structure, required_fields, is_public, created_by)
SELECT 
    template_name,
    template_desc,
    template_type,
    template_states,
    template_struct,
    template_required,
    true,
    (SELECT id FROM users WHERE auth0_id = 'system|templates')
FROM (VALUES
    ('General Affidavit - Texas', 'Standard affidavit template for Texas state', 'affidavit', 
     ARRAY['TX'], '{"sections": ["header", "statement", "signature", "notary"]}', 
     '{"required": ["affiant_name", "county", "facts"]}'),
    ('General Affidavit - Utah', 'Standard affidavit template for Utah state', 'affidavit', 
     ARRAY['UT'], '{"sections": ["header", "statement", "signature", "notary"]}', 
     '{"required": ["affiant_name", "county", "facts"]}'),
    ('General Affidavit - Arizona', 'Standard affidavit template for Arizona state', 'affidavit', 
     ARRAY['AZ'], '{"sections": ["header", "statement", "signature", "notary"]}', 
     '{"required": ["affiant_name", "county", "facts"]}')
) AS templates(template_name, template_desc, template_type, template_states, template_struct, template_required)
ON CONFLICT DO NOTHING;

-- ============================================
-- VIEWS FOR COMMON QUERIES
-- ============================================

-- View for user dashboard data
CREATE OR REPLACE VIEW user_dashboard_stats AS
SELECT 
    u.id,
    u.email,
    u.name,
    u.subscription_tier,
    COUNT(d.id) as total_documents,
    COUNT(CASE WHEN d.status = 'completed' THEN 1 END) as completed_documents,
    COUNT(CASE WHEN d.status = 'draft' THEN 1 END) as draft_documents,
    COALESCE(SUM(p.amount_cents), 0) as total_spent_cents,
    u.created_at as member_since
FROM users u
LEFT JOIN documents d ON u.id = d.user_id AND d.deleted_at IS NULL
LEFT JOIN payments p ON u.id = p.user_id AND p.status = 'succeeded'
GROUP BY u.id;

-- View for recent activity
CREATE OR REPLACE VIEW recent_activity AS
SELECT 
    al.id,
    al.action,
    al.created_at,
    u.email as user_email,
    u.name as user_name,
    al.metadata
FROM activity_logs al
LEFT JOIN users u ON al.user_id = u.id
ORDER BY al.created_at DESC;

-- ============================================
-- CLEANUP PROCEDURES
-- ============================================

-- Function to clean up old sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS INTEGER AS $
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM sessions WHERE expires_at < CURRENT_TIMESTAMP;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$ LANGUAGE plpgsql;

-- Function to clean up old activity logs (keep last 90 days)
CREATE OR REPLACE FUNCTION cleanup_old_activity_logs()
RETURNS INTEGER AS $
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM activity_logs 
    WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '90 days';
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$ LANGUAGE plpgsql;

-- ============================================
-- GRANTS AND PERMISSIONS
-- ============================================

-- Create application user if needed (adjust as needed for your setup)
-- CREATE USER affidavit_app WITH PASSWORD 'your_secure_password';
-- GRANT CONNECT ON DATABASE affidavit_db TO affidavit_app;
-- GRANT USAGE ON SCHEMA public TO affidavit_app;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO affidavit_app;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO affidavit_app;

-- ============================================
-- COMPLETION MESSAGE
-- ============================================

-- Log schema creation
DO $
BEGIN
    RAISE NOTICE 'Affidavit Maker database schema created successfully!';
    RAISE NOTICE 'Tables created: users, documents, payments, activity_logs, sessions, email_notifications, document_templates, api_keys, webhook_events';
    RAISE NOTICE 'Indexes, triggers, and views have been set up for optimal performance.';
    RAISE NOTICE 'Run SELECT * FROM user_dashboard_stats; to test the setup.';
END $;