-- database-schema-clean.sql - Clean working database schema
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
    subscription_tier VARCHAR(50) DEFAULT 'free',
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
    document_type VARCHAR(100) DEFAULT 'affidavit',
    template_state VARCHAR(2),
    
    -- Document content (stored as JSONB for flexibility)
    content JSONB NOT NULL,
    
    -- AI processing metadata
    conversation_history JSONB,
    extraction_metadata JSONB,
    validation_results JSONB,
    generation_metadata JSONB,
    
    -- Document status and workflow
    status VARCHAR(50) DEFAULT 'draft',
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
    payment_id INTEGER,
    
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
    amount_cents INTEGER NOT NULL,
    currency VARCHAR(3) DEFAULT 'usd',
    status VARCHAR(50) NOT NULL,
    
    -- Payment method
    payment_method_type VARCHAR(50),
    payment_method_details JSONB,
    
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
-- NOTE: Retention policy: 90 days. Run cleanup_old_activity_logs() regularly to prevent table bloat.
-- Use 'npm run db:cleanup' or schedule as a cron job: 0 2 * * * cd /path/to/app && npm run db:cleanup
CREATE TABLE IF NOT EXISTS activity_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    
    -- Action details
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50),
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
    email_type VARCHAR(100) NOT NULL,
    recipient_email VARCHAR(255) NOT NULL,
    subject VARCHAR(500),
    
    -- Content
    template_name VARCHAR(100),
    template_variables JSONB,
    
    -- Delivery status
    status VARCHAR(50) DEFAULT 'pending',
    sent_at TIMESTAMP,
    opened_at TIMESTAMP,
    clicked_at TIMESTAMP,
    
    -- External service tracking
    external_id VARCHAR(255),
    error_message TEXT,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Document templates table - for custom templates
CREATE TABLE IF NOT EXISTS document_templates (
    id SERIAL PRIMARY KEY,
    created_by INTEGER REFERENCES users(id) ON DELETE CASCADE,
    
    -- Template metadata
    name VARCHAR(255) NOT NULL,
    description TEXT,
    document_type VARCHAR(100) NOT NULL,
    applicable_states VARCHAR(100)[],
    
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
    status VARCHAR(50) DEFAULT 'draft',
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- API keys table - for enterprise customers
CREATE TABLE IF NOT EXISTS api_keys (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    
    -- Key details
    key_name VARCHAR(255) NOT NULL,
    api_key VARCHAR(255) UNIQUE NOT NULL,
    key_hash VARCHAR(255) NOT NULL,
    
    -- Permissions
    scopes VARCHAR(100)[],
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
    external_id VARCHAR(255) UNIQUE NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    source VARCHAR(50) NOT NULL,
    
    -- Processing status
    status VARCHAR(50) DEFAULT 'pending',
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
-- SIMPLE VIEWS (no complex functions for now)
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
-- SEED DATA
-- ============================================

-- Create a system user for templates
INSERT INTO users (auth0_id, email, name, is_admin, created_at)
VALUES ('system|templates', 'system@affidavit-maker.com', 'System Templates', true, CURRENT_TIMESTAMP)
ON CONFLICT (auth0_id) DO NOTHING;

-- Insert default document templates
INSERT INTO document_templates (name, description, document_type, applicable_states, template_structure, required_fields, is_public, created_by)
SELECT 
    'General Affidavit - Texas',
    'Standard affidavit template for Texas state',
    'affidavit',
    ARRAY['TX'],
    '{"sections": ["header", "statement", "signature", "notary"]}'::jsonb,
    '{"required": ["affiant_name", "county", "facts"]}'::jsonb,
    true,
    (SELECT id FROM users WHERE auth0_id = 'system|templates')
WHERE NOT EXISTS (SELECT 1 FROM document_templates WHERE name = 'General Affidavit - Texas');

INSERT INTO document_templates (name, description, document_type, applicable_states, template_structure, required_fields, is_public, created_by)
SELECT 
    'General Affidavit - Utah',
    'Standard affidavit template for Utah state',
    'affidavit',
    ARRAY['UT'],
    '{"sections": ["header", "statement", "signature", "notary"]}'::jsonb,
    '{"required": ["affiant_name", "county", "facts"]}'::jsonb,
    true,
    (SELECT id FROM users WHERE auth0_id = 'system|templates')
WHERE NOT EXISTS (SELECT 1 FROM document_templates WHERE name = 'General Affidavit - Utah');

INSERT INTO document_templates (name, description, document_type, applicable_states, template_structure, required_fields, is_public, created_by)
SELECT 
    'General Affidavit - Arizona',
    'Standard affidavit template for Arizona state',
    'affidavit',
    ARRAY['AZ'],
    '{"sections": ["header", "statement", "signature", "notary"]}'::jsonb,
    '{"required": ["affiant_name", "county", "facts"]}'::jsonb,
    true,
    (SELECT id FROM users WHERE auth0_id = 'system|templates')
WHERE NOT EXISTS (SELECT 1 FROM document_templates WHERE name = 'General Affidavit - Arizona');

-- Success message
SELECT 'Database schema created successfully!' as message;