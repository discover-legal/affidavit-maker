-- Complete Fresh Database Schema for Affidavit SaaS Template System
-- Run this on a fresh PostgreSQL database

-- Drop existing tables if they exist (careful!)
DROP TABLE IF EXISTS template_usage CASCADE;
DROP TABLE IF EXISTS activity_logs CASCADE;
DROP TABLE IF EXISTS document_shares CASCADE;
DROP TABLE IF EXISTS template_reviews CASCADE;
DROP TABLE IF EXISTS template_purchases CASCADE;
DROP TABLE IF EXISTS templates CASCADE;
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS subscriptions CASCADE;
DROP TABLE IF EXISTS documents CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Users table (Auth0 integration)
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    auth0_id VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    subscription_status VARCHAR(50) DEFAULT 'active',
    subscription_tier VARCHAR(50) DEFAULT 'pay_per_use', -- pay_per_use, family_law_package, all_state_access
    subscription_expires_at TIMESTAMP,
    preferences JSONB DEFAULT '{}',
    billing_address JSONB,
    payment_method_id VARCHAR(255), -- Stripe payment method
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP
);

-- Documents table (enhanced for template system)
CREATE TABLE documents (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    
    -- Document content and metadata
    content JSONB NOT NULL, -- Original user input data
    generated_text TEXT, -- Final generated affidavit text
    file_path VARCHAR(500), -- PDF file path
    
    -- Template system fields
    template_state VARCHAR(5), -- TX, UT, AZ
    template_version VARCHAR(20) DEFAULT '1.0.0',
    document_type VARCHAR(50) DEFAULT 'divorce', -- divorce, custody, child_support, etc.
    validation_results JSONB, -- Template validation results
    generation_metadata JSONB, -- AI generation metadata
    
    -- Status and timing
    status VARCHAR(50) DEFAULT 'draft', -- draft, completed, paid, downloaded
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    downloaded_at TIMESTAMP
);

-- Subscriptions table (for package deals)
CREATE TABLE subscriptions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    
    -- Subscription details
    tier VARCHAR(50) NOT NULL, -- family_law_package, all_state_access, law_firm_white_label
    status VARCHAR(50) DEFAULT 'active', -- active, cancelled, expired, past_due
    
    -- Stripe integration
    stripe_subscription_id VARCHAR(255) UNIQUE,
    stripe_customer_id VARCHAR(255),
    
    -- Billing cycle
    current_period_start TIMESTAMP,
    current_period_end TIMESTAMP,
    
    -- Usage tracking
    documents_used_this_period INTEGER DEFAULT 0,
    documents_included INTEGER, -- NULL for unlimited
    
    -- Pricing
    amount_cents INTEGER, -- Amount in cents
    currency VARCHAR(3) DEFAULT 'usd',
    
    -- White label settings (for law firms)
    white_label_config JSONB, -- Firm branding, letterhead, etc.
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Payments table (for individual document purchases)
CREATE TABLE payments (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    document_id INTEGER REFERENCES documents(id) ON DELETE SET NULL,
    
    -- Stripe payment details
    stripe_payment_intent_id VARCHAR(255) UNIQUE,
    stripe_charge_id VARCHAR(255),
    
    -- Payment details
    amount_cents INTEGER NOT NULL, -- Amount in cents
    currency VARCHAR(3) DEFAULT 'usd',
    status VARCHAR(50) NOT NULL, -- succeeded, failed, pending, refunded
    
    -- Payment type and metadata
    payment_type VARCHAR(50) NOT NULL, -- single_document, family_law_package, all_state_access
    product_details JSONB, -- What was purchased
    
    -- Billing information
    billing_address JSONB,
    payment_method_details JSONB,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Templates table (for future premium template marketplace)
CREATE TABLE templates (
    id SERIAL PRIMARY KEY,
    created_by INTEGER REFERENCES users(id) ON DELETE CASCADE,
    
    -- Template metadata
    title VARCHAR(255) NOT NULL,
    description TEXT,
    document_type VARCHAR(100) NOT NULL, -- divorce, custody, etc.
    state VARCHAR(5) NOT NULL, -- TX, UT, AZ
    
    -- Template content
    base_content JSONB NOT NULL, -- Template structure and rules
    sample_output TEXT, -- Example generated document
    
    -- Marketplace details
    price_cents INTEGER DEFAULT 0, -- Price in cents, 0 = included
    tier_required VARCHAR(50), -- Which subscription tier gets access
    tags TEXT[], -- Searchable tags
    
    -- Usage and quality metrics
    usage_count INTEGER DEFAULT 0,
    avg_rating DECIMAL(3,2) DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    is_featured BOOLEAN DEFAULT false,
    
    -- Template versioning
    version VARCHAR(20) DEFAULT '1.0.0',
    parent_template_id INTEGER REFERENCES templates(id),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Template purchases (for individual template sales)
CREATE TABLE template_purchases (
    id SERIAL PRIMARY KEY,
    template_id INTEGER REFERENCES templates(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    
    -- Purchase details
    purchase_price_cents INTEGER NOT NULL,
    stripe_payment_intent_id VARCHAR(255),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure user can't buy same template twice
    UNIQUE(template_id, user_id)
);

-- Template reviews and ratings
CREATE TABLE template_reviews (
    id SERIAL PRIMARY KEY,
    template_id INTEGER REFERENCES templates(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    
    -- Review content
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    review_text TEXT,
    is_verified_purchase BOOLEAN DEFAULT false,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- One review per user per template
    UNIQUE(template_id, user_id)
);

-- Document sharing (for collaboration features)
CREATE TABLE document_shares (
    id SERIAL PRIMARY KEY,
    document_id INTEGER REFERENCES documents(id) ON DELETE CASCADE,
    shared_by INTEGER REFERENCES users(id) ON DELETE CASCADE,
    
    -- Share settings
    access_token VARCHAR(255) UNIQUE NOT NULL,
    permission VARCHAR(20) DEFAULT 'view', -- view, download, edit
    password_hash VARCHAR(255), -- Optional password protection
    
    -- Expiration and access control
    expires_at TIMESTAMP,
    max_views INTEGER,
    current_views INTEGER DEFAULT 0,
    
    -- Access tracking
    accessed_at TIMESTAMP,
    accessed_from_ip INET,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Activity logs (for audit trail and analytics)
CREATE TABLE activity_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    
    -- Activity details
    action VARCHAR(100) NOT NULL, -- login, document_created, payment_completed, etc.
    resource_type VARCHAR(50), -- document, payment, template, etc.
    resource_id INTEGER,
    
    -- Request details
    ip_address INET,
    user_agent TEXT,
    
    -- Additional context
    metadata JSONB, -- Extra details about the action
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Template usage analytics (for business intelligence)
CREATE TABLE template_usage (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    document_id INTEGER REFERENCES documents(id) ON DELETE CASCADE,
    
    -- Usage details
    state VARCHAR(5) NOT NULL,
    document_type VARCHAR(50) NOT NULL,
    template_version VARCHAR(20),
    
    -- Generation details
    generation_strategy VARCHAR(50), -- simple, detailed, persuasive, legal
    generation_time_ms INTEGER, -- How long generation took
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    
    -- User experience metrics
    user_satisfaction_rating INTEGER CHECK (user_satisfaction_rating >= 1 AND user_satisfaction_rating <= 5),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Family law specific tables

-- Case information (for better document generation)
CREATE TABLE family_law_cases (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    
    -- Case basics
    case_number VARCHAR(100),
    court_name VARCHAR(255),
    county VARCHAR(100),
    state VARCHAR(5),
    
    -- Parties
    petitioner_name VARCHAR(255),
    respondent_name VARCHAR(255),
    children JSONB, -- Array of child information
    
    -- Case details
    case_type VARCHAR(50), -- divorce, custody_modification, support_modification
    marriage_date DATE,
    separation_date DATE,
    filing_date DATE,
    
    -- Financial information
    monthly_income_petitioner INTEGER, -- In cents
    monthly_income_respondent INTEGER,
    monthly_expenses INTEGER,
    assets JSONB, -- Property, vehicles, accounts, etc.
    debts JSONB, -- Credit cards, loans, etc.
    
    -- Current arrangements
    current_custody_arrangement TEXT,
    current_support_amount INTEGER, -- In cents
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Link documents to family law cases
ALTER TABLE documents ADD COLUMN family_law_case_id INTEGER REFERENCES family_law_cases(id) ON DELETE SET NULL;

-- Create indexes for performance
CREATE INDEX idx_users_auth0_id ON users(auth0_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_subscription_status ON users(subscription_status);

CREATE INDEX idx_documents_user_id ON documents(user_id);
CREATE INDEX idx_documents_status ON documents(status);
CREATE INDEX idx_documents_template_state ON documents(template_state);
CREATE INDEX idx_documents_document_type ON documents(document_type);
CREATE INDEX idx_documents_created_at ON documents(created_at);
CREATE INDEX idx_documents_validation ON documents USING GIN(validation_results);

CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_stripe_id ON subscriptions(stripe_subscription_id);

CREATE INDEX idx_payments_user_id ON payments(user_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_stripe_payment_intent ON payments(stripe_payment_intent_id);
CREATE INDEX idx_payments_created_at ON payments(created_at);

CREATE INDEX idx_templates_document_type ON templates(document_type);
CREATE INDEX idx_templates_state ON templates(state);
CREATE INDEX idx_templates_is_active ON templates(is_active);
CREATE INDEX idx_templates_tier_required ON templates(tier_required);

CREATE INDEX idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX idx_activity_logs_action ON activity_logs(action);
CREATE INDEX idx_activity_logs_created_at ON activity_logs(created_at);

CREATE INDEX idx_template_usage_state ON template_usage(state);
CREATE INDEX idx_template_usage_document_type ON template_usage(document_type);
CREATE INDEX idx_template_usage_created_at ON template_usage(created_at);

CREATE INDEX idx_family_law_cases_user_id ON family_law_cases(user_id);
CREATE INDEX idx_family_law_cases_state ON family_law_cases(state);
CREATE INDEX idx_family_law_cases_case_type ON family_law_cases(case_type);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers for updated_at columns
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON documents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_templates_updated_at BEFORE UPDATE ON templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_template_reviews_updated_at BEFORE UPDATE ON template_reviews
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_family_law_cases_updated_at BEFORE UPDATE ON family_law_cases
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default templates for each state and family law document type
INSERT INTO templates (created_by, title, description, document_type, state, base_content, tier_required, version) VALUES
-- Texas Templates
(NULL, 'Texas Divorce Affidavit', 'Standard divorce affidavit compliant with Texas Family Code', 'divorce', 'TX', '{"requirements": {"residency": "6 months", "grounds": true, "property_disclosure": true}}', 'pay_per_use', '1.0.0'),
(NULL, 'Texas Custody Affidavit', 'Child custody affidavit focusing on best interests of the child', 'custody', 'TX', '{"requirements": {"best_interests": true, "parenting_plan": true}}', 'pay_per_use', '1.0.0'),
(NULL, 'Texas Child Support Affidavit', 'Child support calculation and modification affidavit', 'child_support', 'TX', '{"requirements": {"income_verification": true, "child_needs": true}}', 'pay_per_use', '1.0.0'),
(NULL, 'Texas Spousal Support Affidavit', 'Spousal maintenance affidavit per Texas Family Code', 'spousal_support', 'TX', '{"requirements": {"duration_marriage": true, "financial_need": true}}', 'pay_per_use', '1.0.0'),
(NULL, 'Texas Property Division Affidavit', 'Community property division affidavit', 'property_division', 'TX', '{"requirements": {"community_property": true, "separate_property": true}}', 'pay_per_use', '1.0.0'),

-- Utah Templates  
(NULL, 'Utah Divorce Affidavit', 'Utah divorce affidavit compliant with Utah Code', 'divorce', 'UT', '{"requirements": {"residency": "3 months", "grounds": true}}', 'pay_per_use', '1.0.0'),
(NULL, 'Utah Custody Affidavit', 'Child custody affidavit under Utah custody standards', 'custody', 'UT', '{"requirements": {"best_interests": true, "joint_custody_preference": true}}', 'pay_per_use', '1.0.0'),
(NULL, 'Utah Child Support Affidavit', 'Utah child support worksheet affidavit', 'child_support', 'UT', '{"requirements": {"utah_guidelines": true, "income_verification": true}}', 'pay_per_use', '1.0.0'),

-- Arizona Templates
(NULL, 'Arizona Divorce Affidavit', 'Arizona dissolution of marriage affidavit', 'divorce', 'AZ', '{"requirements": {"covenant_marriage": false, "residency": "90 days"}}', 'pay_per_use', '1.0.0'),
(NULL, 'Arizona Custody Affidavit', 'Arizona parenting time affidavit', 'custody', 'AZ', '{"requirements": {"parenting_plan": true, "best_interests": true}}', 'pay_per_use', '1.0.0'),
(NULL, 'Arizona Child Support Affidavit', 'Arizona child support guidelines affidavit', 'child_support', 'AZ', '{"requirements": {"arizona_guidelines": true, "gross_income": true}}', 'pay_per_use', '1.0.0');

-- Sample law firm white label subscription (for testing)
INSERT INTO users (auth0_id, email, name, subscription_status, subscription_tier) VALUES 
('law_firm_demo', 'demo@familylawfirm.com', 'Family Law Firm Demo', 'active', 'law_firm_white_label');

INSERT INTO subscriptions (user_id, tier, status, stripe_subscription_id, amount_cents, white_label_config) VALUES 
(1, 'law_firm_white_label', 'active', 'sub_demo123', 200000, '{"firm_name": "Smith & Associates Family Law", "attorney_name": "Sarah Smith", "bar_number": "TX12345678", "letterhead": true, "custom_footer": "Document prepared by Smith & Associates Family Law"}');

-- Create views for common queries

-- Active users with subscription info
CREATE VIEW active_users_with_subscriptions AS
SELECT 
    u.id,
    u.email,
    u.name,
    u.subscription_tier,
    s.status as subscription_status,
    s.current_period_end,
    s.documents_used_this_period,
    s.white_label_config IS NOT NULL as is_white_label
FROM users u
LEFT JOIN subscriptions s ON u.id = s.user_id AND s.status = 'active'
WHERE u.subscription_status = 'active';

-- Document generation analytics
CREATE VIEW document_analytics AS
SELECT 
    d.template_state,
    d.document_type,
    COUNT(*) as total_documents,
    COUNT(CASE WHEN d.status = 'completed' THEN 1 END) as completed_documents,
    COUNT(CASE WHEN d.status = 'paid' THEN 1 END) as paid_documents,
    AVG(CASE WHEN tu.generation_time_ms IS NOT NULL THEN tu.generation_time_ms END) as avg_generation_time_ms,
    AVG(CASE WHEN tu.user_satisfaction_rating IS NOT NULL THEN tu.user_satisfaction_rating END) as avg_satisfaction
FROM documents d
LEFT JOIN template_usage tu ON d.id = tu.document_id
GROUP BY d.template_state, d.document_type;

-- Revenue analytics
CREATE VIEW revenue_analytics AS
SELECT 
    DATE_TRUNC('month', p.created_at) as month,
    p.payment_type,
    COUNT(*) as transaction_count,
    SUM(p.amount_cents) as total_revenue_cents,
    AVG(p.amount_cents) as avg_transaction_cents
FROM payments p
WHERE p.status = 'succeeded'
GROUP BY DATE_TRUNC('month', p.created_at), p.payment_type
ORDER BY month DESC;

-- Grant permissions (adjust username as needed)
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO your_username;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO your_username;

-- Display table summary
SELECT 
    schemaname,
    tablename,
    hasindexes,
    hasrules,
    hastriggers
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;