-- PostgreSQL Database Schema for Affidavit SaaS
-- Run this script to set up your database

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auth0_id VARCHAR(255) UNIQUE, -- Auth0 user ID
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    phone VARCHAR(20),
    subscription_status VARCHAR(50) DEFAULT 'free', -- free, pro, unlimited
    subscription_expires_at TIMESTAMP,
    stripe_customer_id VARCHAR(255),
    total_documents_created INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP,
    preferences JSONB DEFAULT '{}', -- User preferences and settings
    is_active BOOLEAN DEFAULT true
);

-- Documents table
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    document_type VARCHAR(100) NOT NULL, -- affidavit, motion, petition, etc.
    state VARCHAR(2) NOT NULL, -- TX, UT, AZ, etc.
    case_number VARCHAR(100),
    case_type VARCHAR(100), -- divorce, custody, support, etc.
    affiant_name VARCHAR(255),
    content JSONB NOT NULL, -- Store all document data
    generated_text TEXT, -- Final generated affidavit text
    status VARCHAR(50) DEFAULT 'draft', -- draft, paid, completed, archived
    payment_id UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    metadata JSONB DEFAULT '{}' -- Additional metadata
);

-- Payments table
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
    amount DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    gateway VARCHAR(50) NOT NULL, -- stripe, square, authorize
    gateway_reference VARCHAR(255) UNIQUE,
    gateway_response JSONB, -- Store full gateway response
    status VARCHAR(50) NOT NULL, -- pending, completed, failed, refunded
    payment_type VARCHAR(50), -- single_document, subscription, template_purchase
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

-- Templates table (for marketplace)
CREATE TABLE templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_by UUID REFERENCES users(id) ON DELETE CASCADE,
    document_type VARCHAR(100) NOT NULL,
    state VARCHAR(2),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    base_content JSONB NOT NULL,
    preview_content TEXT, -- Sample preview
    price DECIMAL(10, 2) DEFAULT 0, -- 0 for free templates
    usage_count INTEGER DEFAULT 0,
    rating DECIMAL(3, 2),
    is_public BOOLEAN DEFAULT false,
    is_verified BOOLEAN DEFAULT false, -- Verified by legal professionals
    tags TEXT[], -- Array of tags for search
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Template purchases
CREATE TABLE template_purchases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_id UUID REFERENCES templates(id) ON DELETE CASCADE,
    purchased_by UUID REFERENCES users(id) ON DELETE CASCADE,
    payment_id UUID REFERENCES payments(id),
    purchase_price DECIMAL(10, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(template_id, purchased_by)
);

-- Subscriptions table
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    tier VARCHAR(50) NOT NULL, -- free, pro, unlimited
    stripe_subscription_id VARCHAR(255),
    status VARCHAR(50) NOT NULL, -- active, cancelled, past_due, paused
    current_period_start TIMESTAMP,
    current_period_end TIMESTAMP,
    documents_used_this_period INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Activity log for audit trail
CREATE TABLE activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    action VARCHAR(100) NOT NULL, -- login, create_document, download, payment, etc.
    resource_type VARCHAR(50), -- document, template, payment, etc.
    resource_id UUID,
    metadata JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Document shares (for collaboration)
CREATE TABLE document_shares (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    shared_by UUID REFERENCES users(id) ON DELETE CASCADE,
    shared_with_email VARCHAR(255),
    permission VARCHAR(50) DEFAULT 'view', -- view, edit
    access_token VARCHAR(255) UNIQUE,
    expires_at TIMESTAMP,
    accessed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Reviews for templates
CREATE TABLE template_reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_id UUID REFERENCES templates(id) ON DELETE CASCADE,
    reviewer_id UUID REFERENCES users(id) ON DELETE CASCADE,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    review_text TEXT,
    is_verified_purchase BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(template_id, reviewer_id)
);

-- Analytics table for data insights
CREATE TABLE analytics_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type VARCHAR(100) NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    session_id VARCHAR(255),
    properties JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_auth0_id ON users(auth0_id);
CREATE INDEX idx_documents_user_id ON documents(user_id);
CREATE INDEX idx_documents_status ON documents(status);
CREATE INDEX idx_documents_created_at ON documents(created_at DESC);
CREATE INDEX idx_payments_user_id ON payments(user_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_templates_document_type ON templates(document_type);
CREATE INDEX idx_templates_state ON templates(state);
CREATE INDEX idx_templates_is_public ON templates(is_public);
CREATE INDEX idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX idx_activity_logs_created_at ON activity_logs(created_at DESC);
CREATE INDEX idx_analytics_events_created_at ON analytics_events(created_at DESC);

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON documents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_templates_updated_at BEFORE UPDATE ON templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Views for common queries
CREATE VIEW user_document_summary AS
SELECT 
    u.id as user_id,
    u.email,
    u.subscription_status,
    COUNT(DISTINCT d.id) as total_documents,
    COUNT(DISTINCT d.id) FILTER (WHERE d.status = 'completed') as completed_documents,
    COUNT(DISTINCT d.id) FILTER (WHERE d.created_at >= CURRENT_TIMESTAMP - INTERVAL '30 days') as documents_last_30_days,
    MAX(d.created_at) as last_document_created
FROM users u
LEFT JOIN documents d ON u.id = d.user_id
GROUP BY u.id;

CREATE VIEW template_popularity AS
SELECT 
    t.id,
    t.title,
    t.document_type,
    t.state,
    t.price,
    t.usage_count,
    t.rating,
    COUNT(DISTINCT tp.purchased_by) as unique_purchases,
    COUNT(DISTINCT tr.id) as review_count
FROM templates t
LEFT JOIN template_purchases tp ON t.id = tp.template_id
LEFT JOIN template_reviews tr ON t.id = tr.template_id
WHERE t.is_public = true
GROUP BY t.id;

-- Sample data for subscription tiers (insert into a config table or use in application)
/*
Subscription Tiers:
- FREE: 1 document/month, no saves, basic templates
- PRO ($29.99/mo): 10 documents/month, save progress, premium templates, priority support
- UNLIMITED ($99.99/mo): Unlimited documents, all features, API access, white label option
*/