# Marketplace Technical Architecture

**Document Type**: Architecture Design Document (ADD)
**Version**: 1.0.0
**Date**: 2026-03-26
**Status**: Draft
**Author**: System Architecture
**Branch**: `doc-marketplace`

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [System Context (C4 Level 1)](#2-system-context-c4-level-1)
3. [Container Diagram (C4 Level 2)](#3-container-diagram-c4-level-2)
4. [Database Architecture](#4-database-architecture)
5. [JSONB Template Config Schema](#5-jsonb-template-config-schema)
6. [DynamicOrchestrator Pattern](#6-dynamicorchestrator-pattern)
7. [Service Layer Design](#7-service-layer-design)
8. [Stripe Connect Integration](#8-stripe-connect-integration)
9. [Subscription & Microtransaction Tiers](#9-subscription--microtransaction-tiers)
10. [Affiliate System](#10-affiliate-system)
11. [Clio Integration](#11-clio-integration)
12. [Search Architecture](#12-search-architecture)
13. [Caching Strategy](#13-caching-strategy)
14. [File Storage](#14-file-storage)
15. [RLS for Multi-Tenant Marketplace](#15-rls-for-multi-tenant-marketplace)
16. [Template Lifecycle & Moderation](#16-template-lifecycle--moderation)
17. [Gamification & Leaderboards](#17-gamification--leaderboards)
18. [Migration Strategy](#18-migration-strategy)
19. [Migration SQL](#19-migration-sql)
20. [Security Architecture](#20-security-architecture)
21. [Deployment Architecture](#21-deployment-architecture)
22. [Performance Considerations](#22-performance-considerations)
23. [Monitoring & Alerting](#23-monitoring--alerting)
24. [Data Model Diagram](#24-data-model-diagram)
25. [Architecture Decision Records](#25-architecture-decision-records)
26. [Risk Register](#26-risk-register)
27. [Appendices](#27-appendices)

---

## 1. Executive Summary

This document describes the technical architecture for transforming the existing Discover Legal document-preparation SaaS (a monolithic Node.js/Express + React + PostgreSQL application) into a two-sided marketplace where:

- **Lawyers** create, publish, and monetize interview-based legal document templates.
- **Clients** (self-represented litigants) discover, purchase, and complete those templates to generate jurisdiction-specific legal documents.
- **Affiliates** refer traffic and earn commissions.

The marketplace operates on a flat `$1.00 per document` pricing model. Revenue is split between the platform, the lawyer, Stripe processing fees, and (optionally) an affiliate commission. Lawyers pay tiered monthly subscriptions to unlock premium features (custom branding, Clio integration, analytics, API access).

### Key Constraints

| Constraint | Detail |
|---|---|
| Existing database | 13 migrations (000-013) already deployed to production. New migrations must be additive (014+). |
| Auth0 JWT | Single authentication system. Lawyers and clients both authenticate via Auth0; role differentiation is handled by a `user_role` column and Auth0 metadata. |
| Stripe | Existing direct-charge model for document purchases. Marketplace adds Stripe Connect Express for lawyer payouts and Stripe Billing for subscriptions. |
| Monolith | No microservices migration. All marketplace features are added to the existing Express server. |
| RLS | Row Level Security is already enforced. New tables must follow the same pattern (`current_user_id()`, `current_user_is_admin()`, `bypass_rls_enabled()`). |
| Interview engine | `BaseMatterOrchestrator` is the existing interview engine. Marketplace templates must produce a JSONB config that this engine (or a thin wrapper around it) can consume without modification to the base class. |

### What Does NOT Change

- The 110 jurisdiction directories and 134 built-in orchestrator files remain as first-party content.
- The existing `documents`, `cases`, `payments`, `users` tables are not altered beyond adding foreign keys.
- The existing Auth0 + RS256 JWT flow is unchanged.
- The React SPA architecture (CRACO, Tailwind, React Router) is unchanged.

---

## 2. System Context (C4 Level 1)

```
+------------------+          +-------------------+          +-------------------+
|                  |  HTTPS   |                   |  HTTPS   |                   |
|     Client       +--------->+   Discover Legal  +--------->+   Stripe API      |
|  (SRL / public)  |          |   Marketplace     |          | (Connect, Billing)|
|                  |<---------+   (Express + React)|<---------+                   |
+------------------+          |                   |          +-------------------+
                              |                   |
+------------------+          |                   |          +-------------------+
|                  |  HTTPS   |                   |  HTTPS   |                   |
|     Lawyer       +--------->+                   +--------->+   OpenAI API      |
|  (template       |          |                   |          | (GPT-4 via        |
|   creator)       |<---------+                   |<---------+  ResilientService)|
+------------------+          |                   |          +-------------------+
                              |                   |
+------------------+          |                   |          +-------------------+
|                  |  HTTPS   |                   |  HTTPS   |                   |
|    Affiliate     +--------->+                   +--------->+   Auth0           |
|  (referral       |          |                   |          | (JWT, JWKS)       |
|   partner)       |<---------+                   |<---------+                   |
+------------------+          |                   |          +-------------------+
                              |                   |
                              |                   |          +-------------------+
                              |                   | OAuth2   |                   |
                              |                   +--------->+   Clio API        |
                              |                   |          | (Manage, Grow)    |
                              |                   |<---------+                   |
                              +-------------------+          +-------------------+
                                       |
                                       | SQL (pg)
                                       v
                              +-------------------+
                              |                   |
                              |   PostgreSQL      |
                              |   (Render managed)|
                              |                   |
                              +-------------------+
```

**Actors:**

| Actor | Description | Authentication |
|---|---|---|
| Client | Self-represented litigant purchasing and completing templates | Auth0 JWT (role: `client`, default) |
| Lawyer | Licensed attorney creating and selling templates | Auth0 JWT (role: `lawyer`, requires bar verification) |
| Affiliate | Referral partner driving traffic | Auth0 JWT (role: `affiliate`) or API key |
| Admin | Platform operator | Auth0 JWT (role: `admin`, `is_admin=true`) |

**External Systems:**

| System | Purpose | Protocol |
|---|---|---|
| Stripe Connect | Lawyer payout processing | REST, webhooks |
| Stripe Billing | Lawyer subscription management | REST, webhooks |
| Stripe Payments | Client document purchases (destination charges) | REST, webhooks |
| Auth0 | Authentication, user management | OIDC/JWT, webhooks |
| OpenAI | LLM for interview engine | REST (via ResilientOpenAIService) |
| Clio | Law practice management (contact/matter sync) | OAuth2, REST |
| S3/R2 | File storage for branding assets | S3-compatible API |

---

## 3. Container Diagram (C4 Level 2)

```
+------------------------------------------------------------------+
|  Discover Legal Platform (Docker on Render.com)                   |
|                                                                    |
|  +------------------------------+  +--------------------------+   |
|  |  React SPA (client/build/)   |  |  Express API Server      |   |
|  |                              |  |  (server.js)             |   |
|  |  - Marketplace Browse        |  |                          |   |
|  |  - Template Builder (lawyer) |  |  Existing Routes:        |   |
|  |  - Interview Runner          |  |  /api/chat               |   |
|  |  - Lawyer Dashboard          |  |  /api/documents          |   |
|  |  - Affiliate Dashboard       |  |  /api/payment            |   |
|  |  - Admin Panel               |  |  /api/cases              |   |
|  |                              |  |  /api/catalog            |   |
|  +------------------------------+  |  /api/templates          |   |
|                                    |                          |   |
|                                    |  New Routes:             |   |
|                                    |  /api/marketplace/*      |   |
|                                    |  /api/lawyer/*           |   |
|                                    |  /api/subscriptions/*    |   |
|                                    |  /api/affiliates/*       |   |
|                                    |  /api/clio/*             |   |
|                                    |  /api/reviews/*          |   |
|                                    |  /api/admin/marketplace/*|   |
|                                    |                          |   |
|                                    |  Services:               |   |
|                                    |  MarketplaceService      |   |
|                                    |  DynamicOrchestratorSvc  |   |
|                                    |  LawyerPayoutService     |   |
|                                    |  SubscriptionService     |   |
|                                    |  AffiliateService        |   |
|                                    |  ClioIntegrationService  |   |
|                                    |  TemplateReviewService   |   |
|                                    |  GamificationService     |   |
|                                    |  TemplateAnalyticsService|   |
|                                    |  TemplateVersioningService|  |
|                                    |  ModerationService       |   |
|                                    +--------------------------+   |
+------------------------------------------------------------------+
         |                    |                    |
         v                    v                    v
+----------------+  +------------------+  +------------------+
|  PostgreSQL    |  |  S3/R2 Bucket    |  |  Redis (optional)|
|  (Render)      |  |  (branding       |  |  (cache layer    |
|  31 tables     |  |   assets, logos)  |  |   leaderboards)  |
+----------------+  +------------------+  +------------------+
```

### New API Route Groups

| Route Prefix | Auth | Description |
|---|---|---|
| `/api/marketplace/templates` | Public (browse) / Auth (purchase) | Template discovery, search, detail, purchase |
| `/api/marketplace/featured` | Public | Featured and promoted templates |
| `/api/lawyer/profile` | Lawyer | Lawyer profile CRUD |
| `/api/lawyer/templates` | Lawyer | Template CRUD, versioning, analytics |
| `/api/lawyer/payouts` | Lawyer | Payout history, Stripe Connect onboarding |
| `/api/lawyer/subscriptions` | Lawyer | Subscription management |
| `/api/subscriptions/webhook` | Stripe signature | Stripe Billing webhooks |
| `/api/affiliates` | Affiliate | Affiliate dashboard, referral links |
| `/api/affiliates/webhook` | Internal | Conversion tracking callback |
| `/api/clio/oauth` | Lawyer | OAuth2 authorization flow |
| `/api/clio/sync` | Lawyer | Contact/matter import, document export |
| `/api/reviews` | Auth | Submit and read template reviews |
| `/api/admin/marketplace` | Admin | Moderation queue, analytics, configuration |

---

## 4. Database Architecture

### Overview

18 new tables across 12 migrations (014-025). All tables use `SERIAL PRIMARY KEY`, `TIMESTAMP DEFAULT CURRENT_TIMESTAMP`, and follow the existing naming convention of `snake_case` for tables and columns.

### 4.1 Complete Table Definitions

#### 4.1.1 users (ALTER -- add role column)

Migration 014 adds a `user_role` column to the existing `users` table:

```sql
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS user_role VARCHAR(20) DEFAULT 'client'
    CHECK (user_role IN ('client', 'lawyer', 'admin'));
```

> **Note:** Affiliate status is tracked in the `affiliate_accounts` table, not as a user role. Any authenticated user (client or lawyer) can register as an affiliate.

#### 4.1.2 marketplace_templates

The core marketplace table. Each row represents a lawyer-created template that, when published, becomes available for clients to purchase and use.

```sql
CREATE TABLE marketplace_templates (
  id                  SERIAL PRIMARY KEY,
  lawyer_id           INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title               VARCHAR(500) NOT NULL,
  slug                VARCHAR(500) UNIQUE NOT NULL,
  description         TEXT,
  short_description   VARCHAR(300),
  matter_type         VARCHAR(50) NOT NULL,
  practice_area       VARCHAR(20) NOT NULL DEFAULT 'civil',
  jurisdictions       TEXT[] NOT NULL DEFAULT '{}',
  template_config     JSONB NOT NULL DEFAULT '{}',
  price_cents         INTEGER NOT NULL DEFAULT 100,
  status              VARCHAR(20) NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft', 'pending_review', 'published', 'suspended', 'archived', 'deleted')),
  version             INTEGER NOT NULL DEFAULT 1,
  current_version_id  INTEGER,  -- FK added after template_versions is created
  cover_image_url     VARCHAR(1000),
  tags                TEXT[] DEFAULT '{}',
  estimated_minutes   INTEGER DEFAULT 15,
  difficulty_level    VARCHAR(10) DEFAULT 'standard'
                        CHECK (difficulty_level IN ('basic', 'standard', 'complex')),
  total_purchases     INTEGER DEFAULT 0,
  total_revenue_cents INTEGER DEFAULT 0,
  avg_rating          NUMERIC(3,2) DEFAULT 0.00,
  rating_count        INTEGER DEFAULT 0,
  published_at        TIMESTAMP,
  suspended_at        TIMESTAMP,
  suspension_reason   TEXT,
  created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at          TIMESTAMP
);

-- Indexes
CREATE INDEX idx_mkt_templates_lawyer      ON marketplace_templates(lawyer_id);
CREATE INDEX idx_mkt_templates_status      ON marketplace_templates(status) WHERE status = 'published';
CREATE INDEX idx_mkt_templates_matter      ON marketplace_templates(matter_type);
CREATE INDEX idx_mkt_templates_practice    ON marketplace_templates(practice_area);
CREATE INDEX idx_mkt_templates_slug        ON marketplace_templates(slug);
CREATE INDEX idx_mkt_templates_rating      ON marketplace_templates(avg_rating DESC) WHERE status = 'published';
CREATE INDEX idx_mkt_templates_purchases   ON marketplace_templates(total_purchases DESC) WHERE status = 'published';
CREATE INDEX idx_mkt_templates_jurisdictions ON marketplace_templates USING GIN(jurisdictions);
CREATE INDEX idx_mkt_templates_tags        ON marketplace_templates USING GIN(tags);
CREATE INDEX idx_mkt_templates_config      ON marketplace_templates USING GIN(template_config jsonb_path_ops);

-- Full-text search index
ALTER TABLE marketplace_templates
  ADD COLUMN IF NOT EXISTS search_vector tsvector
    GENERATED ALWAYS AS (
      setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
      setweight(to_tsvector('english', coalesce(description, '')), 'B') ||
      setweight(to_tsvector('english', coalesce(short_description, '')), 'B') ||
      setweight(to_tsvector('english', coalesce(array_to_string(tags, ' '), '')), 'C')
    ) STORED;

CREATE INDEX idx_mkt_templates_search ON marketplace_templates USING GIN(search_vector);
```

#### 4.1.3 template_versions

Immutable version history. Each publish creates a new version row. Rollback means pointing `current_version_id` at an older row.

```sql
CREATE TABLE template_versions (
  id                SERIAL PRIMARY KEY,
  template_id       INTEGER NOT NULL REFERENCES marketplace_templates(id) ON DELETE CASCADE,
  version_number    INTEGER NOT NULL,
  template_config   JSONB NOT NULL,
  change_summary    TEXT,
  created_by        INTEGER NOT NULL REFERENCES users(id),
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(template_id, version_number)
);

CREATE INDEX idx_tpl_versions_template ON template_versions(template_id);

-- Add FK from marketplace_templates.current_version_id
ALTER TABLE marketplace_templates
  ADD CONSTRAINT fk_mkt_templates_current_version
    FOREIGN KEY (current_version_id) REFERENCES template_versions(id);
```

#### 4.1.4 lawyer_profiles

Extended profile data for lawyer users. Separated from `users` to avoid bloating the core table.

```sql
CREATE TABLE lawyer_profiles (
  id                    SERIAL PRIMARY KEY,
  user_id               INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bar_number            VARCHAR(100),
  bar_state             CHAR(2),
  bar_verified          BOOLEAN DEFAULT false,
  bar_verified_at       TIMESTAMP,
  licensed_jurisdictions TEXT[] DEFAULT '{}',
  specialties           TEXT[] DEFAULT '{}',
  firm_name             VARCHAR(500),
  bio                   TEXT,
  avatar_url            VARCHAR(1000),
  logo_url              VARCHAR(1000),
  website_url           VARCHAR(1000),
  display_name          VARCHAR(255),
  years_experience      INTEGER,
  stripe_connect_id     VARCHAR(255) UNIQUE,
  stripe_onboarding_complete BOOLEAN DEFAULT false,
  stripe_payouts_enabled     BOOLEAN DEFAULT false,
  payout_schedule       VARCHAR(20) DEFAULT 'weekly'
                          CHECK (payout_schedule IN ('daily', 'weekly', 'monthly')),
  total_templates       INTEGER DEFAULT 0,
  total_sales           INTEGER DEFAULT 0,
  total_earned_cents    INTEGER DEFAULT 0,
  avg_template_rating   NUMERIC(3,2) DEFAULT 0.00,
  is_featured           BOOLEAN DEFAULT false,
  featured_until        TIMESTAMP,
  created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_lawyer_profiles_user      ON lawyer_profiles(user_id);
CREATE INDEX idx_lawyer_profiles_bar       ON lawyer_profiles(bar_state, bar_number);
CREATE INDEX idx_lawyer_profiles_stripe    ON lawyer_profiles(stripe_connect_id);
CREATE INDEX idx_lawyer_profiles_jurisdictions ON lawyer_profiles USING GIN(licensed_jurisdictions);
CREATE INDEX idx_lawyer_profiles_specialties  ON lawyer_profiles USING GIN(specialties);
```

#### 4.1.5 lawyer_subscriptions

Tracks which microtransaction tier each lawyer has active. Each tier is a separate Stripe subscription item so lawyers can mix and match.

```sql
CREATE TABLE lawyer_subscriptions (
  id                      SERIAL PRIMARY KEY,
  lawyer_id               INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tier_code               VARCHAR(30) NOT NULL
                            CHECK (tier_code IN (
                              'free', 'prompts', 'branding', 'clio',
                              'analytics', 'api', 'pro'
                            )),
  stripe_subscription_id  VARCHAR(255),
  stripe_price_id         VARCHAR(255),
  status                  VARCHAR(20) NOT NULL DEFAULT 'active'
                            CHECK (status IN ('active', 'past_due', 'canceled', 'trialing')),
  price_cents             INTEGER NOT NULL DEFAULT 0,
  current_period_start    TIMESTAMP,
  current_period_end      TIMESTAMP,
  cancel_at_period_end    BOOLEAN DEFAULT false,
  created_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(lawyer_id, tier_code)
);

CREATE INDEX idx_lawyer_subs_lawyer ON lawyer_subscriptions(lawyer_id);
CREATE INDEX idx_lawyer_subs_stripe ON lawyer_subscriptions(stripe_subscription_id);
CREATE INDEX idx_lawyer_subs_status ON lawyer_subscriptions(status) WHERE status = 'active';
```

**Tier Pricing:**

| Tier Code | Monthly Price | Feature |
|---|---|---|
| `free` | $0 | List templates, basic profile |
| `prompts` | $1 | Custom AI prompts in templates |
| `branding` | $3 | Custom logo, colors, PDF branding |
| `clio` | $5 | Clio integration (contact/matter sync) |
| `analytics` | $10 | Detailed analytics dashboard |
| `api` | $25 | API access for template management |
| `pro` | $49 | All features bundled + priority support |

#### 4.1.6 template_purchases

Immutable ledger of every purchase. The source of truth for revenue, payouts, and analytics.

```sql
CREATE TABLE template_purchases (
  id                      SERIAL PRIMARY KEY,
  client_id               INTEGER NOT NULL REFERENCES users(id),
  template_id             INTEGER NOT NULL REFERENCES marketplace_templates(id),
  template_version_id     INTEGER REFERENCES template_versions(id),
  lawyer_id               INTEGER NOT NULL REFERENCES users(id),
  document_id             INTEGER REFERENCES documents(id) ON DELETE SET NULL,
  affiliate_id            INTEGER REFERENCES users(id),
  amount_cents            INTEGER NOT NULL,
  platform_fee_cents      INTEGER NOT NULL,
  stripe_fee_cents        INTEGER NOT NULL,
  lawyer_payout_cents     INTEGER NOT NULL,
  affiliate_payout_cents  INTEGER DEFAULT 0,
  stripe_payment_intent_id VARCHAR(255) UNIQUE,
  stripe_transfer_id      VARCHAR(255),
  payout_status           VARCHAR(20) DEFAULT 'pending'
                            CHECK (payout_status IN ('pending', 'transferred', 'paid', 'failed')),
  refund_status           VARCHAR(20) DEFAULT 'none'
                            CHECK (refund_status IN ('none', 'partial', 'full')),
  refunded_amount_cents   INTEGER DEFAULT 0,
  created_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_purchases_client    ON template_purchases(client_id);
CREATE INDEX idx_purchases_template  ON template_purchases(template_id);
CREATE INDEX idx_purchases_lawyer    ON template_purchases(lawyer_id);
CREATE INDEX idx_purchases_affiliate ON template_purchases(affiliate_id) WHERE affiliate_id IS NOT NULL;
CREATE INDEX idx_purchases_stripe    ON template_purchases(stripe_payment_intent_id);
CREATE INDEX idx_purchases_payout    ON template_purchases(payout_status) WHERE payout_status = 'pending';
CREATE INDEX idx_purchases_created   ON template_purchases(created_at);
```

**Revenue Split for a $1.00 Template (Additive $1 Platform Fee Model):**

The client pays the template price **plus** a flat $1.00 platform fee. Stripe fees are calculated on the total charge.

| Component | Amount | Calculation |
|---|---|---|
| Template price (to lawyer) | $1.00 | Set by lawyer |
| Platform fee | $1.00 | Flat $1.00 per document |
| Stripe processing fee | $0.36 | 2.9% of $2.00 + $0.30 |
| **Client pays** | **$2.36** | Template + platform fee + Stripe |

If an affiliate is involved, the affiliate commission (10%, $0.20 of the $2.00 subtotal) is deducted from the platform fee, reducing it to $0.80.

> **Note:** For templates priced below $5, the platform fee exceeds the Stripe fee, making the $1 flat model favorable for the platform. For higher-priced templates the $1 flat fee becomes a small fraction of the total.

#### 4.1.7 template_reviews

```sql
CREATE TABLE template_reviews (
  id            SERIAL PRIMARY KEY,
  template_id   INTEGER NOT NULL REFERENCES marketplace_templates(id) ON DELETE CASCADE,
  purchase_id   INTEGER NOT NULL REFERENCES template_purchases(id) ON DELETE CASCADE,
  reviewer_id   INTEGER NOT NULL REFERENCES users(id),
  rating        SMALLINT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title         VARCHAR(200),
  body          TEXT,
  is_verified   BOOLEAN DEFAULT true,
  is_visible    BOOLEAN DEFAULT true,
  helpful_count INTEGER DEFAULT 0,
  lawyer_reply  TEXT,
  lawyer_reply_at TIMESTAMP,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(purchase_id)
);

CREATE INDEX idx_reviews_template ON template_reviews(template_id);
CREATE INDEX idx_reviews_reviewer ON template_reviews(reviewer_id);
CREATE INDEX idx_reviews_rating   ON template_reviews(template_id, rating);
```

#### 4.1.8 affiliate_accounts

```sql
CREATE TABLE affiliate_accounts (
  id                    SERIAL PRIMARY KEY,
  user_id               INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  affiliate_code        VARCHAR(50) UNIQUE NOT NULL,
  display_name          VARCHAR(255),
  website_url           VARCHAR(1000),
  commission_rate       NUMERIC(5,4) NOT NULL DEFAULT 0.1000,
  stripe_connect_id     VARCHAR(255) UNIQUE,
  stripe_onboarding_complete BOOLEAN DEFAULT false,
  total_clicks          INTEGER DEFAULT 0,
  total_conversions     INTEGER DEFAULT 0,
  total_earned_cents    INTEGER DEFAULT 0,
  status                VARCHAR(20) DEFAULT 'active'
                          CHECK (status IN ('active', 'suspended', 'closed')),
  created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_affiliate_code   ON affiliate_accounts(affiliate_code);
CREATE INDEX idx_affiliate_user   ON affiliate_accounts(user_id);
CREATE INDEX idx_affiliate_stripe ON affiliate_accounts(stripe_connect_id);
```

#### 4.1.9 affiliate_referrals

```sql
CREATE TABLE affiliate_referrals (
  id                SERIAL PRIMARY KEY,
  affiliate_id      INTEGER NOT NULL REFERENCES affiliate_accounts(id) ON DELETE CASCADE,
  visitor_fingerprint VARCHAR(64),
  landing_url       TEXT,
  referrer_url      TEXT,
  ip_address        INET,
  user_agent        TEXT,
  converted         BOOLEAN DEFAULT false,
  converted_user_id INTEGER REFERENCES users(id),
  purchase_id       INTEGER REFERENCES template_purchases(id),
  click_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  converted_at      TIMESTAMP,
  expires_at        TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL '30 days')
);

CREATE INDEX idx_referrals_affiliate  ON affiliate_referrals(affiliate_id);
CREATE INDEX idx_referrals_converted  ON affiliate_referrals(converted) WHERE converted = false;
CREATE INDEX idx_referrals_expires    ON affiliate_referrals(expires_at);
CREATE INDEX idx_referrals_visitor    ON affiliate_referrals(visitor_fingerprint);
```

#### 4.1.10 affiliate_payouts

```sql
CREATE TABLE affiliate_payouts (
  id                  SERIAL PRIMARY KEY,
  affiliate_id        INTEGER NOT NULL REFERENCES affiliate_accounts(id),
  amount_cents        INTEGER NOT NULL,
  stripe_transfer_id  VARCHAR(255),
  status              VARCHAR(20) DEFAULT 'pending'
                        CHECK (status IN ('pending', 'processing', 'paid', 'failed')),
  period_start        DATE NOT NULL,
  period_end          DATE NOT NULL,
  referral_count      INTEGER DEFAULT 0,
  created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  paid_at             TIMESTAMP
);

CREATE INDEX idx_aff_payouts_affiliate ON affiliate_payouts(affiliate_id);
CREATE INDEX idx_aff_payouts_status    ON affiliate_payouts(status);
```

#### 4.1.11 clio_connections

```sql
CREATE TABLE clio_connections (
  id                  SERIAL PRIMARY KEY,
  user_id             INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  clio_user_id        VARCHAR(255),
  access_token        TEXT NOT NULL,
  refresh_token       TEXT NOT NULL,
  token_expires_at    TIMESTAMP NOT NULL,
  clio_instance_url   VARCHAR(1000),
  scopes              TEXT[] DEFAULT '{}',
  last_sync_at        TIMESTAMP,
  sync_status         VARCHAR(20) DEFAULT 'idle'
                        CHECK (sync_status IN ('idle', 'syncing', 'error')),
  sync_error          TEXT,
  is_active           BOOLEAN DEFAULT true,
  created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_clio_user ON clio_connections(user_id);
```

**Security note:** `access_token` and `refresh_token` are encrypted at rest using AES-256-GCM with a key stored in environment variables. The columns store `iv:ciphertext:tag` as a single text value. See Section 20 for details.

#### 4.1.12 template_analytics

Aggregated daily analytics per template. Rolled up from raw events to keep query times low.

```sql
CREATE TABLE template_analytics (
  id                SERIAL PRIMARY KEY,
  template_id       INTEGER NOT NULL REFERENCES marketplace_templates(id) ON DELETE CASCADE,
  date              DATE NOT NULL DEFAULT CURRENT_DATE,
  views             INTEGER DEFAULT 0,
  detail_views      INTEGER DEFAULT 0,
  purchases         INTEGER DEFAULT 0,
  completions       INTEGER DEFAULT 0,
  revenue_cents     INTEGER DEFAULT 0,
  avg_completion_minutes NUMERIC(6,2),
  refunds           INTEGER DEFAULT 0,
  UNIQUE(template_id, date)
);

CREATE INDEX idx_analytics_template_date ON template_analytics(template_id, date);
CREATE INDEX idx_analytics_date          ON template_analytics(date);
```

#### 4.1.13 lawyer_achievements

```sql
CREATE TABLE lawyer_achievements (
  id              SERIAL PRIMARY KEY,
  lawyer_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  achievement_code VARCHAR(50) NOT NULL,
  achievement_name VARCHAR(200) NOT NULL,
  description     TEXT,
  tier            VARCHAR(10) DEFAULT 'bronze'
                    CHECK (tier IN ('bronze', 'silver', 'gold', 'platinum')),
  unlocked_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  metadata        JSONB DEFAULT '{}',
  UNIQUE(lawyer_id, achievement_code)
);

CREATE INDEX idx_achievements_lawyer ON lawyer_achievements(lawyer_id);
```

**Achievement codes (initial set):**

| Code | Name | Condition |
|---|---|---|
| `first_template` | Template Creator | Published 1 template |
| `ten_sales` | Rising Star | 10 total sales |
| `hundred_sales` | Top Seller | 100 total sales |
| `five_star` | Five Star | Avg rating >= 4.8 with 10+ reviews |
| `multi_jurisdiction` | Multi-Jurisdiction | Template covers 5+ jurisdictions |
| `streak_7` | Weekly Warrior | 7-day login streak |
| `streak_30` | Monthly Maven | 30-day login streak |
| `revenue_1k` | $1K Earner | Cumulative earnings >= $1,000 |
| `revenue_10k` | $10K Earner | Cumulative earnings >= $10,000 |

#### 4.1.14 leaderboard_snapshots

Materialized periodically (daily via cron) rather than computed on every request.

```sql
CREATE TABLE leaderboard_snapshots (
  id              SERIAL PRIMARY KEY,
  period_type     VARCHAR(10) NOT NULL CHECK (period_type IN ('daily', 'weekly', 'monthly', 'alltime')),
  period_start    DATE NOT NULL,
  period_end      DATE NOT NULL,
  category        VARCHAR(30) NOT NULL DEFAULT 'overall',
  rankings        JSONB NOT NULL,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(period_type, period_start, category)
);

CREATE INDEX idx_leaderboard_period ON leaderboard_snapshots(period_type, period_start);
```

The `rankings` JSONB structure:

```json
[
  {
    "rank": 1,
    "lawyer_id": 42,
    "display_name": "Jane Smith, Esq.",
    "avatar_url": "https://...",
    "sales_count": 312,
    "revenue_cents": 31200,
    "avg_rating": 4.92,
    "template_count": 8
  }
]
```

#### 4.1.15 payout_batches

```sql
CREATE TABLE payout_batches (
  id                  SERIAL PRIMARY KEY,
  batch_type          VARCHAR(20) NOT NULL CHECK (batch_type IN ('lawyer', 'affiliate')),
  period_start        DATE NOT NULL,
  period_end          DATE NOT NULL,
  total_amount_cents  INTEGER NOT NULL,
  recipient_count     INTEGER NOT NULL,
  status              VARCHAR(20) DEFAULT 'pending'
                        CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'partial')),
  stripe_batch_id     VARCHAR(255),
  error_details       JSONB,
  created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at        TIMESTAMP
);

CREATE INDEX idx_payout_batches_status ON payout_batches(status);
CREATE INDEX idx_payout_batches_period ON payout_batches(period_start, period_end);
```

#### 4.1.16 template_categories

```sql
CREATE TABLE template_categories (
  id            SERIAL PRIMARY KEY,
  slug          VARCHAR(100) UNIQUE NOT NULL,
  display_name  VARCHAR(200) NOT NULL,
  description   TEXT,
  parent_id     INTEGER REFERENCES template_categories(id),
  icon_name     VARCHAR(50),
  sort_order    INTEGER DEFAULT 0,
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_categories_parent ON template_categories(parent_id);
CREATE INDEX idx_categories_slug   ON template_categories(slug);
```

#### 4.1.17 featured_placements

```sql
CREATE TABLE featured_placements (
  id              SERIAL PRIMARY KEY,
  template_id     INTEGER NOT NULL REFERENCES marketplace_templates(id) ON DELETE CASCADE,
  placement_type  VARCHAR(30) NOT NULL
                    CHECK (placement_type IN ('homepage_hero', 'category_top', 'search_boost', 'sidebar', 'editorial')),
  position        INTEGER DEFAULT 0,
  starts_at       TIMESTAMP NOT NULL,
  ends_at         TIMESTAMP NOT NULL,
  is_paid         BOOLEAN DEFAULT false,
  cost_cents      INTEGER DEFAULT 0,
  impressions     INTEGER DEFAULT 0,
  clicks          INTEGER DEFAULT 0,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CHECK (ends_at > starts_at)
);

CREATE INDEX idx_featured_active ON featured_placements(placement_type, starts_at, ends_at)
  WHERE ends_at > CURRENT_TIMESTAMP;
CREATE INDEX idx_featured_template ON featured_placements(template_id);
```

#### 4.1.18 template_flags

```sql
CREATE TABLE template_flags (
  id              SERIAL PRIMARY KEY,
  template_id     INTEGER NOT NULL REFERENCES marketplace_templates(id) ON DELETE CASCADE,
  flagged_by      INTEGER REFERENCES users(id),
  flag_type       VARCHAR(30) NOT NULL
                    CHECK (flag_type IN (
                      'upl_concern', 'inaccurate', 'offensive', 'spam',
                      'copyright', 'outdated', 'automated_quality', 'other'
                    )),
  description     TEXT,
  severity        VARCHAR(10) DEFAULT 'medium'
                    CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  status          VARCHAR(20) DEFAULT 'open'
                    CHECK (status IN ('open', 'investigating', 'resolved', 'dismissed')),
  resolution      TEXT,
  resolved_by     INTEGER REFERENCES users(id),
  resolved_at     TIMESTAMP,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_flags_template ON template_flags(template_id);
CREATE INDEX idx_flags_status   ON template_flags(status) WHERE status IN ('open', 'investigating');
CREATE INDEX idx_flags_type     ON template_flags(flag_type);
```

#### 4.1.19 interview_sessions

Tracks client progress through a marketplace template interview. Separate from the existing `documents.conversation_history` because marketplace interviews need to track payment status, template version, and completion metrics independently.

```sql
CREATE TABLE interview_sessions (
  id                  SERIAL PRIMARY KEY,
  client_id           INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  template_id         INTEGER NOT NULL REFERENCES marketplace_templates(id),
  template_version_id INTEGER REFERENCES template_versions(id),
  purchase_id         INTEGER REFERENCES template_purchases(id),
  document_id         INTEGER REFERENCES documents(id) ON DELETE SET NULL,
  current_phase       VARCHAR(50) NOT NULL DEFAULT 'INTAKE',
  completed_phases    TEXT[] DEFAULT '{}',
  phase_history       JSONB DEFAULT '[]',
  interview_data      JSONB DEFAULT '{}',
  conversation_history JSONB DEFAULT '[]',
  status              VARCHAR(20) DEFAULT 'active'
                        CHECK (status IN ('active', 'completed', 'abandoned', 'expired')),
  started_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at        TIMESTAMP,
  last_activity_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  total_messages       INTEGER DEFAULT 0,
  total_duration_seconds INTEGER DEFAULT 0
);

CREATE INDEX idx_interview_client   ON interview_sessions(client_id);
CREATE INDEX idx_interview_template ON interview_sessions(template_id);
CREATE INDEX idx_interview_status   ON interview_sessions(status) WHERE status = 'active';
CREATE INDEX idx_interview_purchase ON interview_sessions(purchase_id);
```

---

## 5. JSONB Template Config Schema

The `template_config` column in `marketplace_templates` is the core innovation. It contains everything `BaseMatterOrchestrator` (or the `DynamicOrchestrator` wrapper) needs to run an interview. The schema is designed to be backwards-compatible with the existing orchestrator config structure.

### 5.1 Complete Schema Definition

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "MarketplaceTemplateConfig",
  "description": "JSONB schema for marketplace template interview configuration",
  "type": "object",
  "required": ["version", "matterTypeCode", "practiceArea", "phases", "phaseOrder", "fieldMap", "toolDefinition"],
  "properties": {
    "version": {
      "type": "string",
      "description": "Schema version for forwards-compatibility",
      "enum": ["1.0"]
    },
    "matterTypeCode": {
      "type": "string",
      "description": "Must match a matter_types.code from migration 013 or be a custom code prefixed with 'custom_'",
      "pattern": "^[a-z][a-z0-9_]*$"
    },
    "practiceArea": {
      "type": "string",
      "enum": ["family", "civil"]
    },
    "stateCode": {
      "type": "string",
      "description": "2-letter code or '*' for state-agnostic",
      "default": "*"
    },
    "stateName": {
      "type": ["string", "null"],
      "default": null
    },
    "phases": {
      "type": "object",
      "description": "Phase definitions keyed by phase code. Each phase contains the system prompt, display name, required fields, and optional skip logic.",
      "additionalProperties": {
        "type": "object",
        "required": ["prompt", "displayName"],
        "properties": {
          "name": { "type": "string" },
          "displayName": { "type": "string", "maxLength": 100 },
          "order": { "type": "integer", "minimum": 1 },
          "prompt": {
            "type": "string",
            "description": "The system prompt for the LLM during this phase. May contain placeholders like {{stateName}} and {{jurisdiction}} that the DynamicOrchestrator resolves at runtime."
          },
          "requiredFields": {
            "type": "array",
            "items": { "type": "string" },
            "default": []
          },
          "optional": { "type": "boolean", "default": false },
          "skipCondition": {
            "type": "object",
            "description": "Declarative skip logic replacing the code-based skipIf function. Evaluated by DynamicOrchestrator at runtime.",
            "properties": {
              "field": { "type": "string", "description": "camelCase field name in matterData" },
              "operator": { "type": "string", "enum": ["eq", "neq", "exists", "not_exists", "in", "not_in"] },
              "value": { "description": "The value to compare against" }
            },
            "required": ["field", "operator"]
          }
        }
      }
    },
    "phaseOrder": {
      "type": "array",
      "items": { "type": "string" },
      "description": "Ordered list of phase codes. Must reference keys in the phases object.",
      "minItems": 2
    },
    "fieldMap": {
      "type": "object",
      "description": "Maps snake_case field names (as returned by the LLM tool call) to camelCase field names (as stored in matterData). Keys are snake_case, values are camelCase.",
      "additionalProperties": { "type": "string" }
    },
    "toolDefinition": {
      "type": "object",
      "description": "OpenAI function tool definition. The DynamicOrchestrator wraps this as { type: 'function', function: <this value> }.",
      "required": ["name", "description", "parameters"],
      "properties": {
        "name": { "type": "string", "default": "process_matter_data" },
        "description": { "type": "string" },
        "parameters": {
          "type": "object",
          "description": "JSON Schema for the function parameters"
        }
      }
    },
    "branding": {
      "type": "object",
      "description": "Lawyer branding overrides (requires 'branding' subscription tier)",
      "properties": {
        "logoUrl": { "type": "string", "format": "uri" },
        "primaryColor": { "type": "string", "pattern": "^#[0-9a-fA-F]{6}$" },
        "firmName": { "type": "string" },
        "disclaimerText": { "type": "string" },
        "pdfHeaderHtml": { "type": "string" },
        "pdfFooterHtml": { "type": "string" }
      }
    },
    "metadata": {
      "type": "object",
      "description": "Arbitrary metadata for search, display, and analytics",
      "properties": {
        "estimatedMinutes": { "type": "integer" },
        "targetAudience": { "type": "string" },
        "legalDisclaimer": { "type": "string" },
        "seoDescription": { "type": "string", "maxLength": 160 }
      }
    }
  }
}
```

### 5.2 Example: Complete template_config for a Texas Custody Template

```json
{
  "version": "1.0",
  "matterTypeCode": "custody",
  "practiceArea": "family",
  "stateCode": "TX",
  "stateName": "Texas",
  "phases": {
    "INTAKE": {
      "name": "INTAKE",
      "displayName": "Getting Started",
      "order": 1,
      "prompt": "You are a document preparation assistant helping someone with a child custody matter in Texas.\n\nCOLLECT:\n1. Your full legal name (first and last) -- you are the Petitioner\n2. The other parent's full legal name -- they are the Respondent\n3. What county in Texas are you filing in?\n4. Is this to: (a) Establish custody for the FIRST TIME, (b) MODIFY an existing order, (c) ENFORCE an existing order?\n\nTEXAS-SPECIFIC: In Texas, the term is 'conservatorship.' Sole Managing Conservator (SMC) has primary custody rights; Possessing Conservator (PC) has visitation. Joint Managing Conservatorship (JMC) is the presumption (Tex. Fam. Code sec. 153.131).\n\nREQUIRED FIELDS: petitioner_first_name, petitioner_last_name, respondent_first_name, respondent_last_name, county\n\nOPENING: \"I am here to help you prepare your Texas child custody documents. What is your full legal name?\"",
      "requiredFields": ["petitionerFirstName", "petitionerLastName", "respondentFirstName", "respondentLastName", "county"],
      "optional": false
    },
    "EXISTING_ORDER": {
      "name": "EXISTING_ORDER",
      "displayName": "Existing Order Details",
      "order": 2,
      "prompt": "Collect details about the existing custody order...",
      "requiredFields": ["existingOrderTerms"],
      "optional": true,
      "skipCondition": {
        "field": "isModification",
        "operator": "not_exists"
      }
    },
    "CHILDREN": {
      "name": "CHILDREN",
      "displayName": "About the Children",
      "order": 3,
      "prompt": "Collect information about each child involved...",
      "requiredFields": ["children"],
      "optional": false
    },
    "SAFETY": {
      "name": "SAFETY",
      "displayName": "Safety Concerns",
      "order": 4,
      "prompt": "Collect any safety concerns. In Texas, family violence is defined in Tex. Fam. Code sec. 71.004...",
      "requiredFields": ["safetyConcernsConfirmed"],
      "optional": false
    },
    "PROPOSED_PLAN": {
      "name": "PROPOSED_PLAN",
      "displayName": "Proposed Conservatorship Plan",
      "order": 5,
      "prompt": "Collect the proposed custody arrangement. Texas uses Standard Possession Order (SPO) as the default for parents within 100 miles (Tex. Fam. Code sec. 153.312-153.317)...",
      "requiredFields": [],
      "optional": false
    },
    "REVIEW": {
      "name": "REVIEW",
      "displayName": "Review & Confirm",
      "order": 6,
      "prompt": "Summarize all collected information and ask for confirmation...",
      "requiredFields": ["userConfirmedReview"],
      "optional": false
    }
  },
  "phaseOrder": ["INTAKE", "EXISTING_ORDER", "CHILDREN", "SAFETY", "PROPOSED_PLAN", "REVIEW"],
  "fieldMap": {
    "petitioner_first_name": "petitionerFirstName",
    "petitioner_last_name": "petitionerLastName",
    "respondent_first_name": "respondentFirstName",
    "respondent_last_name": "respondentLastName",
    "state": "state",
    "county": "county",
    "children": "children",
    "safety_concerns_confirmed": "safetyConcernsConfirmed",
    "custody_type_requested": "custodyTypeRequested",
    "user_confirmed_review": "userConfirmedReview",
    "is_modification": "isModification",
    "existing_order_terms": "existingOrderTerms"
  },
  "toolDefinition": {
    "name": "process_matter_data",
    "description": "Extract Texas child custody interview information and provide a conversational response.",
    "parameters": {
      "type": "object",
      "required": ["response", "phase_complete"],
      "properties": {
        "response": { "type": "string" },
        "phase_complete": { "type": "boolean" },
        "petitioner_first_name": { "type": "string" },
        "petitioner_last_name": { "type": "string" },
        "respondent_first_name": { "type": "string" },
        "respondent_last_name": { "type": "string" },
        "county": { "type": "string" },
        "children": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "name": { "type": "string" },
              "dob": { "type": "string" },
              "age": { "type": "integer" }
            }
          }
        },
        "safety_concerns_confirmed": { "type": "boolean" },
        "custody_type_requested": { "type": "string" },
        "is_modification": { "type": "boolean" },
        "existing_order_terms": { "type": "string" },
        "user_confirmed_review": { "type": "boolean" },
        "extracted_facts": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "content": { "type": "string" },
              "category": { "type": "string" }
            }
          }
        }
      }
    }
  },
  "branding": {
    "firmName": "Smith Family Law, PLLC",
    "primaryColor": "#1a365d",
    "disclaimerText": "This template was created by a licensed Texas attorney. It does not constitute legal advice."
  },
  "metadata": {
    "estimatedMinutes": 20,
    "targetAudience": "Parents in Texas seeking to establish or modify child custody",
    "legalDisclaimer": "For informational purposes only. Consult a licensed attorney for advice specific to your situation."
  }
}
```

### 5.3 Backwards Compatibility

The `template_config` schema maps directly to the constructor parameters of `BaseMatterOrchestrator`:

| template_config field | BaseMatterOrchestrator param | Notes |
|---|---|---|
| `matterTypeCode` | `matterTypeCode` | Direct mapping |
| `practiceArea` | `practiceArea` | Direct mapping |
| `stateCode` | `stateCode` | Direct mapping |
| `stateName` | `stateName` | Direct mapping |
| `phases` | `phases` | `skipCondition` replaces `skipIf` (see Section 6) |
| `phaseOrder` | `phaseOrder` | Direct mapping |
| `fieldMap` | `fieldMap` | Direct mapping |
| `toolDefinition` | `buildTool()` return value | Wrapped in `{ type: 'function', function: ... }` |

The only difference is that `skipIf` (a JavaScript function) cannot be stored in JSONB. It is replaced by `skipCondition`, a declarative object that `DynamicOrchestrator` evaluates at runtime.

---

## 6. DynamicOrchestrator Pattern

### 6.1 Architecture

```
                   +-------------------------------+
                   |      OrchestratorFactory       |
                   |  (services/OrchestratorFactory.js) |
                   +-------------------------------+
                   |                               |
          static (built-in)              dynamic (marketplace)
                   |                               |
    +--------------+----------+      +-------------+-----------+
    | CustodyOrchestrator.js  |      | DynamicOrchestrator.js  |
    | DVROOrchestrator.js     |      |   extends               |
    | SmallClaimsOrch...      |      |   BaseMatterOrchestrator|
    | ... (134 files)         |      +-------------------------+
    +-------------------------+                |
                                               | reads
                                               v
                                      +-----------------+
                                      | template_config |
                                      | (JSONB from DB) |
                                      +-----------------+
```

### 6.2 OrchestratorFactory

```javascript
// services/OrchestratorFactory.js

const DynamicOrchestrator = require('./DynamicOrchestrator');

// Built-in orchestrators (existing code, unchanged)
const builtInOrchestrators = {
  custody: require('./agents/CustodyOrchestrator'),
  child_support: require('./agents/ChildSupportOrchestrator'),
  // ... all 16 matter types + divorce orchestrators
};

class OrchestratorFactory {
  /**
   * Returns an orchestrator for the given context.
   *
   * Priority:
   *   1. If marketplaceTemplateId is provided, load from DB and return DynamicOrchestrator
   *   2. If stateCode + matterTypeCode match a built-in orchestrator, return that
   *   3. If matterTypeCode matches a generic built-in, return that
   *   4. Throw
   */
  static async getOrchestrator({ matterTypeCode, stateCode, marketplaceTemplateId, pool }) {
    // Marketplace template takes priority
    if (marketplaceTemplateId) {
      const result = await pool.query(
        `SELECT mt.template_config, mt.id, mt.lawyer_id, tv.template_config as version_config
         FROM marketplace_templates mt
         LEFT JOIN template_versions tv ON tv.id = mt.current_version_id
         WHERE mt.id = $1 AND mt.status = 'published'`,
        [marketplaceTemplateId]
      );

      if (result.rows.length === 0) {
        throw new Error(`Marketplace template ${marketplaceTemplateId} not found or not published`);
      }

      const config = result.rows[0].version_config || result.rows[0].template_config;
      return DynamicOrchestrator.fromConfig(config);
    }

    // Built-in orchestrators
    const key = stateCode ? `${stateCode}_${matterTypeCode}` : matterTypeCode;
    if (builtInOrchestrators[key]) return builtInOrchestrators[key];
    if (builtInOrchestrators[matterTypeCode]) return builtInOrchestrators[matterTypeCode];

    throw new Error(`No orchestrator found for ${matterTypeCode} in ${stateCode || 'any state'}`);
  }
}
```

### 6.3 DynamicOrchestrator

```javascript
// services/DynamicOrchestrator.js

const BaseMatterOrchestrator = require('./agents/BaseMatterOrchestrator');

class DynamicOrchestrator extends BaseMatterOrchestrator {
  /**
   * Factory method: creates an orchestrator instance from a JSONB template_config.
   */
  static fromConfig(templateConfig) {
    const config = typeof templateConfig === 'string'
      ? JSON.parse(templateConfig)
      : templateConfig;

    // Convert declarative skipConditions to skipIf functions
    const phases = {};
    for (const [phaseCode, phaseConfig] of Object.entries(config.phases)) {
      phases[phaseCode] = { ...phaseConfig };

      if (phaseConfig.skipCondition) {
        phases[phaseCode].skipIf = DynamicOrchestrator._buildSkipFn(phaseConfig.skipCondition);
        // skipIf is what BaseMatterOrchestrator expects
      }
    }

    return new DynamicOrchestrator({
      stateCode:      config.stateCode || '*',
      stateName:      config.stateName || null,
      matterTypeCode: config.matterTypeCode,
      practiceArea:   config.practiceArea || 'civil',
      phases,
      phaseOrder:     config.phaseOrder,
      fieldMap:       config.fieldMap || {},
      buildTool:      () => ({
        type: 'function',
        function: config.toolDefinition
      }),
      // Marketplace-specific extensions
      branding:       config.branding || null,
      metadata:       config.metadata || null,
    });
  }

  /**
   * Converts a declarative skipCondition into a skipIf function.
   */
  static _buildSkipFn(condition) {
    return (matterData) => {
      const value = matterData[condition.field];
      switch (condition.operator) {
        case 'eq':         return value === condition.value;
        case 'neq':        return value !== condition.value;
        case 'exists':     return value !== undefined && value !== null;
        case 'not_exists': return value === undefined || value === null;
        case 'in':         return Array.isArray(condition.value) && condition.value.includes(value);
        case 'not_in':     return Array.isArray(condition.value) && !condition.value.includes(value);
        default:           return false;
      }
    };
  }

  constructor(config) {
    super(config);
    this.branding = config.branding;
    this.marketplaceMetadata = config.metadata;
  }
}
```

### 6.4 Integration with chat.js

The existing `routes/chat.js` currently routes messages based on `matterTypeCode`. The marketplace adds a new code path:

```javascript
// In routes/chat.js, after existing orchestrator loading:

// Marketplace template interview
if (affidavitData.marketplaceTemplateId) {
  const orchestrator = await OrchestratorFactory.getOrchestrator({
    marketplaceTemplateId: affidavitData.marketplaceTemplateId,
    pool: req.app.locals.pool
  });
  const result = await orchestrator.processMessage(
    message, conversationHistory, affidavitData, userId, sessionId
  );
  // ... return result
}
```

---

## 7. Service Layer Design

### 7.1 MarketplaceService

**Location:** `services/MarketplaceService.js`

**Responsibilities:**
- Template CRUD (create, read, update, soft-delete)
- Template search with full-text search and faceted filtering
- Template discovery (trending, new, top-rated, featured)
- Slug generation and uniqueness enforcement
- Purchase flow orchestration (validate template, create payment intent, record purchase)
- Revenue split calculation

**Key methods:**

| Method | Description |
|---|---|
| `createTemplate(lawyerId, data)` | Create draft template with validation |
| `updateTemplate(templateId, lawyerId, data)` | Update draft/suspended template |
| `submitForReview(templateId, lawyerId)` | Transition draft to review, trigger automated checks |
| `publishTemplate(templateId, adminOrSystem)` | Transition review to published |
| `suspendTemplate(templateId, adminId, reason)` | Suspend published template |
| `searchTemplates(query, filters, pagination)` | Full-text search with faceted results |
| `getTemplateDetail(slugOrId)` | Single template with lawyer profile, reviews, analytics |
| `getTrending(limit)` | Top templates by recent purchases |
| `getFeatured()` | Editorially or algorithmically featured templates |
| `purchaseTemplate(clientId, templateId, affiliateCode)` | Create Stripe payment intent, record purchase |
| `calculateRevenueSplit(grossCents, hasAffiliate)` | Compute platform/lawyer/affiliate/stripe split |

### 7.2 DynamicOrchestratorService

**Location:** `services/DynamicOrchestratorService.js`

Thin wrapper around `OrchestratorFactory` and `DynamicOrchestrator`. Manages interview session state in the `interview_sessions` table.

| Method | Description |
|---|---|
| `startInterview(clientId, templateId, purchaseId)` | Create interview_session row, load orchestrator |
| `processMessage(sessionId, message)` | Load session, delegate to orchestrator, persist state |
| `getSessionState(sessionId, clientId)` | Return current phase, progress, collected data |
| `abandonSession(sessionId, clientId)` | Mark session as abandoned |

### 7.3 LawyerPayoutService

**Location:** `services/LawyerPayoutService.js`

Manages Stripe Connect Express accounts and payout batching.

| Method | Description |
|---|---|
| `createConnectAccount(lawyerId)` | Create Stripe Connect Express account, return onboarding URL |
| `completeOnboarding(lawyerId, accountId)` | Verify account details, mark as onboarded |
| `getAccountStatus(lawyerId)` | Check Stripe Connect account status |
| `createTransfer(purchaseId)` | Transfer lawyer's share from platform to Connect account |
| `runPayoutBatch(periodStart, periodEnd)` | Batch all pending transfers for a period |
| `getPayoutHistory(lawyerId, pagination)` | Paginated payout history |

### 7.4 SubscriptionService

**Location:** `services/SubscriptionService.js`

| Method | Description |
|---|---|
| `getActiveTiers(lawyerId)` | List active subscription tiers |
| `subscribeTier(lawyerId, tierCode)` | Create Stripe subscription for tier |
| `cancelTier(lawyerId, tierCode)` | Cancel at period end |
| `hasFeature(lawyerId, featureCode)` | Check if lawyer has access to a feature |
| `handleWebhook(event)` | Process Stripe Billing webhook events |

**Feature-to-tier mapping:**

| Feature | Required Tier(s) |
|---|---|
| Custom prompts | `prompts` or `pro` |
| Logo/branding on PDFs | `branding` or `pro` |
| Clio sync | `clio` or `pro` |
| Analytics dashboard | `analytics` or `pro` |
| API access | `api` or `pro` |
| Priority support | `pro` |

### 7.5 AffiliateService

**Location:** `services/AffiliateService.js`

| Method | Description |
|---|---|
| `registerAffiliate(userId, code, websiteUrl)` | Create affiliate account |
| `trackClick(affiliateCode, req)` | Record referral click, set cookie |
| `attributeConversion(purchaseId, affiliateCode)` | Link purchase to affiliate |
| `getAffiliateStats(affiliateId)` | Clicks, conversions, earnings |
| `runAffiliatePayouts(periodStart, periodEnd)` | Batch affiliate payouts |

### 7.6 ClioIntegrationService

**Location:** `services/ClioIntegrationService.js`

| Method | Description |
|---|---|
| `getAuthorizationUrl(lawyerId)` | Generate Clio OAuth2 authorization URL |
| `handleCallback(code, state)` | Exchange code for tokens, store encrypted |
| `refreshToken(userId)` | Refresh expired access token |
| `importContacts(userId)` | Pull contacts from Clio into case pre-fill |
| `importMatters(userId)` | Pull matters from Clio |
| `exportDocument(userId, documentId, matterId)` | Push generated document to a Clio matter |
| `syncStatus(userId)` | Check connection health and last sync time |

### 7.7 TemplateReviewService

**Location:** `services/TemplateReviewService.js`

| Method | Description |
|---|---|
| `submitReview(reviewerId, purchaseId, rating, title, body)` | Create review, update template avg_rating |
| `getReviews(templateId, pagination, sortBy)` | Paginated reviews for a template |
| `replyToReview(lawyerId, reviewId, replyText)` | Lawyer replies to a review |
| `markHelpful(userId, reviewId)` | Increment helpful_count |
| `flagReview(userId, reviewId, reason)` | Flag review for moderation |
| `moderateReview(adminId, reviewId, action)` | Hide or restore review |

### 7.8 GamificationService

**Location:** `services/GamificationService.js`

| Method | Description |
|---|---|
| `checkAndUnlock(lawyerId)` | Evaluate all achievement conditions, unlock any new ones |
| `getAchievements(lawyerId)` | List unlocked achievements |
| `getLeaderboard(periodType, category)` | Return latest leaderboard snapshot |
| `refreshLeaderboard(periodType)` | Compute and store new leaderboard snapshot (cron job) |
| `recordStreak(lawyerId)` | Update login streak tracking |

### 7.9 TemplateAnalyticsService

**Location:** `services/TemplateAnalyticsService.js`

| Method | Description |
|---|---|
| `trackView(templateId, userId)` | Increment daily view count |
| `trackDetailView(templateId, userId)` | Increment daily detail view count |
| `trackCompletion(templateId, purchaseId, durationSeconds)` | Record interview completion |
| `getTemplateAnalytics(templateId, lawyerId, dateRange)` | Aggregated analytics for lawyer dashboard |
| `getConversionFunnel(templateId, dateRange)` | Views -> detail -> purchase -> completion |
| `rollUpDaily()` | Aggregate raw events into template_analytics rows (cron job) |

### 7.10 TemplateVersioningService

**Location:** `services/TemplateVersioningService.js`

| Method | Description |
|---|---|
| `createVersion(templateId, lawyerId, config, changeSummary)` | Save new version, increment version number |
| `getVersionHistory(templateId)` | List all versions with summaries |
| `getVersion(templateId, versionNumber)` | Get specific version's config |
| `rollback(templateId, lawyerId, versionNumber)` | Point current_version_id at older version |
| `diffVersions(templateId, v1, v2)` | Return structured diff of two version configs |

### 7.11 ModerationService

**Location:** `services/ModerationService.js`

| Method | Description |
|---|---|
| `runAutomatedChecks(templateId)` | UPL screening, completeness, jurisdiction verification |
| `screenForUPL(templateConfig)` | Check prompts for phrases that constitute legal advice |
| `validateCompleteness(templateConfig)` | Ensure all phases have prompts, fieldMap is consistent |
| `verifyJurisdictions(templateConfig, lawyerProfile)` | Lawyer is licensed in claimed jurisdictions |
| `getQueue(status, pagination)` | Get moderation queue for admins |
| `resolveFlag(flagId, adminId, resolution, action)` | Resolve a flag (dismiss, warn, suspend) |

**UPL Screening Keywords (initial set, configurable):**

The system checks template prompts for phrases that could constitute unauthorized practice of law:
- "you should file for..."
- "your best option is..."
- "I recommend filing..."
- "the court will likely..."
- "you will win if..."

Templates containing these phrases are flagged for manual review before publication.

---

## 8. Stripe Connect Integration

### 8.1 Flow: Lawyer Onboarding

```
1. Lawyer signs up, creates profile
2. Lawyer clicks "Set up payouts"
3. Backend calls stripe.accounts.create({ type: 'express' })
4. Backend stores stripe_connect_id in lawyer_profiles
5. Backend calls stripe.accountLinks.create() to get onboarding URL
6. Lawyer is redirected to Stripe-hosted onboarding flow
7. Stripe redirects back to /lawyer/onboarding/complete
8. Backend verifies account via stripe.accounts.retrieve()
9. stripe_onboarding_complete = true, stripe_payouts_enabled = true
```

### 8.2 Flow: Client Purchases a Template (Destination Charges)

```
1. Client clicks "Purchase" on template (price: $1.00 / 100 cents)
2. Backend calculates total charge:
   - Template price: 100 cents (to lawyer)
   - Platform fee: 100 cents (flat $1.00)
   - Subtotal: 200 cents
   - Stripe fee: 36 cents (2.9% of 200 + 30c) — absorbed by client
   - Total charge: 236 cents
   - Affiliate: 20 cents from platform fee if applicable (10% of subtotal)
3. Backend creates PaymentIntent:
   stripe.paymentIntents.create({
     amount: 236,
     currency: 'usd',
     application_fee_amount: 136,  // platform keeps 136c (100 platform + 36 Stripe)
     transfer_data: {
       destination: lawyer.stripe_connect_id  // 100c goes to lawyer
     },
     metadata: {
       template_id: '123',
       client_id: '456',
       affiliate_code: 'abc123'  // if present
     }
   })
4. Client completes payment via Stripe Elements
5. Webhook: payment_intent.succeeded
   - Insert into template_purchases
   - Increment marketplace_templates.total_purchases
   - Track affiliate conversion if applicable
   - Create interview_session
```

### 8.3 Why Destination Charges (not Separate Charges and Transfers)

| Factor | Destination Charges | Separate Charges + Transfers |
|---|---|---|
| Charge appears on client statement | Platform name | Platform name |
| Refund handling | Platform handles | Platform handles |
| Stripe fee charged to | Platform | Platform |
| Lawyer sees in Stripe dashboard | Transfer from platform | Transfer from platform |
| Complexity | Lower | Higher |
| Compliance (1099-K) | Stripe handles for Connect accounts | Stripe handles for Connect accounts |

Destination charges are simpler and sufficient for a marketplace where the platform collects all revenue and distributes to sellers.

---

## 9. Subscription & Microtransaction Tiers

### 9.1 Stripe Billing Setup

Each tier is a Stripe Product with a Stripe Price (monthly recurring). Lawyers can subscribe to multiple tiers independently (each is its own subscription) or subscribe to `pro` which bundles all features.

```
Stripe Products:
  - dl_tier_prompts:   $1/mo   (price_id: price_xxx_prompts)
  - dl_tier_branding:  $3/mo   (price_id: price_xxx_branding)
  - dl_tier_clio:      $5/mo   (price_id: price_xxx_clio)
  - dl_tier_analytics: $10/mo  (price_id: price_xxx_analytics)
  - dl_tier_api:       $25/mo  (price_id: price_xxx_api)
  - dl_tier_pro:       $49/mo  (price_id: price_xxx_pro)
```

### 9.2 Feature Gating

```javascript
// services/SubscriptionService.js

const TIER_FEATURES = {
  free:      ['basic_profile', 'list_templates', 'basic_analytics'],
  prompts:   ['custom_prompts'],
  branding:  ['custom_logo', 'custom_colors', 'pdf_branding'],
  clio:      ['clio_sync', 'clio_import', 'clio_export'],
  analytics: ['detailed_analytics', 'conversion_funnels', 'revenue_reports'],
  api:       ['api_access', 'api_keys', 'webhook_notifications'],
  pro:       ['custom_prompts', 'custom_logo', 'custom_colors', 'pdf_branding',
              'clio_sync', 'clio_import', 'clio_export', 'detailed_analytics',
              'conversion_funnels', 'revenue_reports', 'api_access', 'api_keys',
              'webhook_notifications', 'priority_support']
};

async hasFeature(lawyerId, featureCode) {
  const activeTiers = await this.getActiveTiers(lawyerId);
  return activeTiers.some(tier => TIER_FEATURES[tier.tier_code]?.includes(featureCode));
}
```

### 9.3 Webhook Handling

Stripe Billing webhooks are processed at `/api/subscriptions/webhook`:

| Event | Action |
|---|---|
| `customer.subscription.created` | Insert into `lawyer_subscriptions` |
| `customer.subscription.updated` | Update status, period dates |
| `customer.subscription.deleted` | Mark as canceled |
| `invoice.payment_succeeded` | Update status to active |
| `invoice.payment_failed` | Update status to past_due, send notification |

---

## 10. Affiliate System

### 10.1 Attribution Flow

```
1. Affiliate shares link: https://make.discover.legal/ref/abc123
2. Server records click in affiliate_referrals
3. Server sets cookie: dl_ref=abc123 (30-day expiry, HttpOnly, SameSite=Lax)
4. Visitor browses, signs up, purchases a template
5. At purchase time:
   a. Check for dl_ref cookie
   b. If present, look up active affiliate_referrals row
   c. Link purchase to affiliate
   d. affiliate_payout_cents = amount_cents * commission_rate (default 10%)
```

### 10.2 Anti-Fraud

- Deduplicate clicks by `(affiliate_id, visitor_fingerprint)` within 24 hours
- Cap referral window at 30 days
- No self-referral (affiliate cannot purchase their own referral link)
- Minimum $25 payout threshold before transfer

---

## 11. Clio Integration

### 11.1 OAuth2 Flow

```
1. Lawyer clicks "Connect to Clio"
2. Redirect to: https://app.clio.com/oauth/authorize?
     response_type=code
     &client_id=CLIO_CLIENT_ID
     &redirect_uri=https://make.discover.legal/api/clio/oauth/callback
     &state=<signed_jwt_with_user_id>
3. Lawyer authorizes in Clio
4. Clio redirects to callback with code
5. Backend exchanges code for access_token + refresh_token
6. Tokens are encrypted (AES-256-GCM) and stored in clio_connections
7. Connection is active
```

### 11.2 Token Security

```javascript
// Encryption: AES-256-GCM
const algorithm = 'aes-256-gcm';
const key = Buffer.from(process.env.CLIO_TOKEN_ENCRYPTION_KEY, 'hex'); // 32 bytes

function encrypt(plaintext) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${encrypted}:${tag}`;
}

function decrypt(ciphertext) {
  const [ivHex, encryptedHex, tagHex] = ciphertext.split(':');
  const decipher = crypto.createDecipheriv(algorithm, key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
```

### 11.3 Data Mapping

| Clio Entity | Discover Legal Entity | Direction |
|---|---|---|
| Clio Contact | Case petitioner/respondent | Import |
| Clio Matter | Case | Import |
| Clio Document | Generated PDF | Export |
| Clio Custom Field | Interview data fields | Import (pre-fill) |

---

## 12. Search Architecture

### 12.1 PostgreSQL Full-Text Search

The marketplace uses PostgreSQL's built-in full-text search via a generated `tsvector` column on `marketplace_templates`. This avoids the operational complexity of a separate search engine (Elasticsearch, Meilisearch) while providing good performance for the expected catalog size (hundreds to low thousands of templates).

### 12.2 Search Query

```sql
-- Full-text search with faceted filtering
SELECT
  mt.id, mt.slug, mt.title, mt.short_description,
  mt.matter_type, mt.jurisdictions, mt.price_cents,
  mt.avg_rating, mt.rating_count, mt.total_purchases,
  mt.estimated_minutes, mt.cover_image_url,
  lp.display_name AS lawyer_name, lp.avatar_url AS lawyer_avatar,
  lp.bar_verified,
  ts_rank(mt.search_vector, query) AS relevance
FROM marketplace_templates mt
JOIN lawyer_profiles lp ON lp.user_id = mt.lawyer_id
CROSS JOIN websearch_to_tsquery('english', $1) AS query
WHERE mt.status = 'published'
  AND mt.deleted_at IS NULL
  AND mt.search_vector @@ query
  -- Faceted filters (all optional)
  AND ($2::text IS NULL OR mt.matter_type = $2)
  AND ($3::text IS NULL OR mt.practice_area = $3)
  AND ($4::text[] IS NULL OR mt.jurisdictions && $4)  -- array overlap
  AND ($5::numeric IS NULL OR mt.avg_rating >= $5)
  AND ($6::integer IS NULL OR mt.price_cents <= $6)
ORDER BY relevance DESC, mt.total_purchases DESC
LIMIT $7 OFFSET $8;
```

### 12.3 Facet Counts

```sql
-- Return aggregate counts for filter sidebar
SELECT
  'matter_type' AS facet,
  mt.matter_type AS value,
  COUNT(*) AS count
FROM marketplace_templates mt
WHERE mt.status = 'published' AND mt.deleted_at IS NULL
  AND mt.search_vector @@ websearch_to_tsquery('english', $1)
GROUP BY mt.matter_type

UNION ALL

SELECT
  'practice_area' AS facet,
  mt.practice_area AS value,
  COUNT(*) AS count
FROM marketplace_templates mt
WHERE mt.status = 'published' AND mt.deleted_at IS NULL
  AND mt.search_vector @@ websearch_to_tsquery('english', $1)
GROUP BY mt.practice_area;
```

### 12.4 When to Migrate to a Dedicated Search Engine

Move to Elasticsearch or Meilisearch when any of these are true:
- Template catalog exceeds 10,000 published templates
- Search latency exceeds 200ms at p95
- Typo-tolerant search, synonyms, or faceted aggregation beyond simple GROUP BY are required
- Geospatial search is needed (e.g., "lawyers near me")

---

## 13. Caching Strategy

### 13.1 Caching Tiers

| Data | Cache Location | TTL | Invalidation |
|---|---|---|---|
| Template listings (search results) | In-process LRU (node-lru-cache) | 60 seconds | On any template publish/suspend/update |
| Template detail page | In-process LRU | 5 minutes | On template update, new review |
| Leaderboard snapshots | PostgreSQL (materialized) | 24 hours | Daily cron job |
| Lawyer profile (public) | In-process LRU | 10 minutes | On profile update |
| Feature flag checks (`hasFeature`) | In-process Map | 5 minutes | On subscription webhook |
| Affiliate click dedup | In-process Set | 24 hours | Self-expiring |
| Template analytics (daily) | PostgreSQL (aggregated) | End of day | Daily rollup cron |

### 13.2 Redis (Optional Future Enhancement)

If the application scales to multiple Render instances behind a load balancer, in-process caches become inconsistent. At that point, add a Redis instance (Render managed or Upstash) for:
- Shared cache across instances
- Pub/sub for cache invalidation
- Session storage for interview sessions (instead of DB)
- Rate limiting (replacing in-process rate limiters)

For the initial deployment on a single Render instance, in-process caching is sufficient and avoids the added infrastructure cost.

### 13.3 Implementation

```javascript
// utils/cache.js
const { LRUCache } = require('lru-cache');

const caches = {
  templateSearch: new LRUCache({ max: 500, ttl: 60_000 }),
  templateDetail: new LRUCache({ max: 200, ttl: 300_000 }),
  lawyerProfile:  new LRUCache({ max: 200, ttl: 600_000 }),
  featureFlags:   new LRUCache({ max: 100, ttl: 300_000 }),
};

function invalidate(cacheName, key) {
  if (key) {
    caches[cacheName]?.delete(key);
  } else {
    caches[cacheName]?.clear();
  }
}

module.exports = { caches, invalidate };
```

---

## 14. File Storage

### 14.1 What Gets Stored

| Asset Type | Owner | Example | Max Size |
|---|---|---|---|
| Lawyer logo | Lawyer | Firm logo for PDF branding | 2 MB |
| Lawyer avatar | Lawyer | Profile photo | 1 MB |
| Template cover image | Lawyer | Marketplace listing image | 5 MB |
| Generated PDFs | Client | Final legal documents | 10 MB |

### 14.2 Storage Backend

**Phase 1 (Launch):** Cloudflare R2 (S3-compatible, no egress fees, $0.015/GB/month storage).

**Why R2 over S3:**
- Zero egress fees (clients downloading PDFs is the dominant access pattern)
- S3-compatible API (same SDK, trivial migration path)
- Integrated with Cloudflare CDN if needed later

**Environment variables:**

```bash
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=discover-legal-assets
R2_PUBLIC_BUCKET_URL=https://assets.discover.legal  # optional custom domain
```

### 14.3 Security

- All uploads go through the Express API (no direct client-to-R2 upload)
- File type validation: only JPEG, PNG, SVG, PDF accepted
- File size limits enforced in middleware
- Filenames are hashed: `{userId}/{assetType}/{sha256}.{ext}`
- Generated PDFs are stored with a `private/` prefix and served via signed URLs (time-limited, 1 hour)
- Branding assets (logos, avatars) are stored with a `public/` prefix and served directly

---

## 15. RLS for Multi-Tenant Marketplace

### 15.1 Existing RLS Pattern

The application sets RLS context via session variables:

```sql
-- Set by auth middleware on each request
SET LOCAL app.user_id = '42';
SET LOCAL app.is_admin = 'false';
```

Policies reference `current_user_id()`, `current_user_is_admin()`, and `bypass_rls_enabled()` functions (defined in migration 010).

### 15.2 New Role-Based RLS

The marketplace introduces a new dimension: `user_role`. A new helper function:

```sql
CREATE OR REPLACE FUNCTION current_user_role()
RETURNS TEXT AS $$
BEGIN
  RETURN current_setting('app.user_role', TRUE);
EXCEPTION WHEN OTHERS THEN
  RETURN 'client';
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
```

Auth middleware addition:

```javascript
await client.query('SELECT set_config($1, $2, TRUE)',
  ['app.user_role', user.user_role || 'client']);
```

### 15.3 RLS Policies for Marketplace Tables

**marketplace_templates:**

```sql
-- Anyone can read published templates
CREATE POLICY mkt_templates_read_published ON marketplace_templates
  FOR SELECT USING (
    status = 'published'
    OR lawyer_id = current_user_id()
    OR current_user_is_admin()
    OR bypass_rls_enabled()
  );

-- Lawyers can insert their own templates
CREATE POLICY mkt_templates_insert_own ON marketplace_templates
  FOR INSERT WITH CHECK (
    lawyer_id = current_user_id()
    AND current_user_role() IN ('lawyer', 'admin')
  );

-- Lawyers can update their own templates
CREATE POLICY mkt_templates_update_own ON marketplace_templates
  FOR UPDATE USING (
    lawyer_id = current_user_id()
    OR current_user_is_admin()
    OR bypass_rls_enabled()
  );

-- Lawyers can soft-delete their own templates
CREATE POLICY mkt_templates_delete_own ON marketplace_templates
  FOR DELETE USING (
    lawyer_id = current_user_id()
    OR current_user_is_admin()
  );
```

**template_purchases:**

```sql
-- Clients see their own purchases; lawyers see purchases of their templates
CREATE POLICY purchases_read_own ON template_purchases
  FOR SELECT USING (
    client_id = current_user_id()
    OR lawyer_id = current_user_id()
    OR current_user_is_admin()
    OR bypass_rls_enabled()
  );

-- Only system (bypass) can insert purchases (handled by payment webhook/service)
CREATE POLICY purchases_insert_system ON template_purchases
  FOR INSERT WITH CHECK (bypass_rls_enabled());
```

**lawyer_profiles:**

```sql
-- Public read for published profiles
CREATE POLICY lawyer_profiles_read ON lawyer_profiles
  FOR SELECT USING (true);

-- Lawyers update their own profile
CREATE POLICY lawyer_profiles_update_own ON lawyer_profiles
  FOR UPDATE USING (
    user_id = current_user_id()
    OR current_user_is_admin()
    OR bypass_rls_enabled()
  );
```

**interview_sessions:**

```sql
-- Clients see their own sessions
CREATE POLICY interview_sessions_isolation ON interview_sessions
  FOR ALL USING (
    client_id = current_user_id()
    OR current_user_is_admin()
    OR bypass_rls_enabled()
  );
```

**clio_connections:**

```sql
-- Strictly private: only the owning user
CREATE POLICY clio_connections_isolation ON clio_connections
  FOR ALL USING (
    user_id = current_user_id()
    OR bypass_rls_enabled()
  );
```

---

## 16. Template Lifecycle & Moderation

### 16.1 State Machine

```
             +--------+    submitForReview()    +--------+
             |        +------------------------>+        |
     create  | DRAFT  |                         | REVIEW |
    +------->+        +<--+                     |        |
             +---+----+   |                     +---+----+
                 |         |                        |
                 |    requestChanges()         approve()
                 |         |                        |
                 |         |    +-----------+        |
                 |         +----+           |        v
                 |              | SUSPENDED |   +-----------+
                 |         +---->           |   |           |
                 |         |    +-----------+   | PUBLISHED |
                 |         |         ^          |           |
                 |    suspend()      |          +-----+-----+
                 |         |         |                |
                 |         +---------+           suspend()
                 |                                    |
                 |                               +----v------+
                 +------- archive() ------------>+ ARCHIVED  |
                                                 +-----------+
```

### 16.2 Automated Checks (Before Publish)

Run by `ModerationService.runAutomatedChecks()`:

1. **Completeness validation**: All phases in `phaseOrder` exist in `phases`. All `fieldMap` entries reference fields in `toolDefinition.parameters.properties`. At least 2 phases defined.

2. **UPL screening**: Scan all prompt text for phrases that constitute legal advice (see Section 7.11). Flag, do not auto-reject.

3. **Jurisdiction verification**: Each jurisdiction in `marketplace_templates.jurisdictions` must appear in `lawyer_profiles.licensed_jurisdictions`. Templates for jurisdictions where the lawyer is not licensed are rejected.

4. **Tool definition validation**: The `toolDefinition` must be valid JSON Schema. `process_matter_data` function name is required. `response` and `phase_complete` must be in `required`.

5. **Content safety**: Check for profanity, PII in prompts (SSN patterns, phone numbers), and excessively long prompts (>10,000 chars per phase).

### 16.3 Manual Review Queue

Templates that pass automated checks but are flagged (e.g., UPL keyword match) enter the admin moderation queue. Admins can:
- **Approve**: Move to published
- **Request changes**: Move back to draft with feedback
- **Reject**: Move to suspended with reason

---

## 17. Gamification & Leaderboards

### 17.1 Achievement Evaluation

`GamificationService.checkAndUnlock(lawyerId)` is called after:
- A template is published
- A purchase is recorded
- A review is submitted
- A lawyer logs in (streak tracking)

Achievement conditions are evaluated in-memory against aggregated data:

```javascript
const ACHIEVEMENT_CONDITIONS = {
  first_template: (stats) => stats.publishedTemplates >= 1,
  ten_sales:      (stats) => stats.totalSales >= 10,
  hundred_sales:  (stats) => stats.totalSales >= 100,
  five_star:      (stats) => stats.avgRating >= 4.8 && stats.ratingCount >= 10,
  multi_jurisdiction: (stats) => stats.maxJurisdictionCount >= 5,
  streak_7:       (stats) => stats.currentStreak >= 7,
  streak_30:      (stats) => stats.currentStreak >= 30,
  revenue_1k:     (stats) => stats.totalEarnedCents >= 100000,
  revenue_10k:    (stats) => stats.totalEarnedCents >= 1000000,
};
```

### 17.2 Leaderboard Computation (Daily Cron)

```sql
-- Weekly leaderboard computation
INSERT INTO leaderboard_snapshots (period_type, period_start, period_end, category, rankings)
SELECT
  'weekly',
  date_trunc('week', CURRENT_DATE)::date,
  (date_trunc('week', CURRENT_DATE) + INTERVAL '6 days')::date,
  'overall',
  jsonb_agg(
    jsonb_build_object(
      'rank', row_number() OVER (ORDER BY weekly_sales DESC),
      'lawyer_id', lp.user_id,
      'display_name', lp.display_name,
      'avatar_url', lp.avatar_url,
      'sales_count', weekly_sales,
      'revenue_cents', weekly_revenue,
      'avg_rating', lp.avg_template_rating,
      'template_count', lp.total_templates
    )
  )
FROM (
  SELECT
    tp.lawyer_id,
    COUNT(*) AS weekly_sales,
    SUM(tp.lawyer_payout_cents) AS weekly_revenue
  FROM template_purchases tp
  WHERE tp.created_at >= date_trunc('week', CURRENT_DATE)
  GROUP BY tp.lawyer_id
) sales
JOIN lawyer_profiles lp ON lp.user_id = sales.lawyer_id
WHERE weekly_sales > 0
ORDER BY weekly_sales DESC
LIMIT 50;
```

---

## 18. Migration Strategy

### 18.1 Migration Numbering

Existing migrations: 000 through 013 (14 files). New marketplace migrations continue the sequence:

| Migration | Tables / Changes |
|---|---|
| 014 | `users.user_role`, `current_user_role()` function |
| 015 | `lawyer_profiles` |
| 016 | `marketplace_templates` (with search_vector, indexes) |
| 017 | `template_versions`, FK on marketplace_templates |
| 018 | `lawyer_subscriptions` |
| 019 | `template_purchases` |
| 020 | `template_reviews` |
| 021 | `affiliate_accounts`, `affiliate_referrals`, `affiliate_payouts` |
| 022 | `clio_connections` |
| 023 | `template_analytics`, `template_categories`, `featured_placements`, `template_flags` |
| 024 | `interview_sessions` |
| 025 | `lawyer_achievements`, `leaderboard_snapshots`, `payout_batches`, RLS policies for all new tables |

### 18.2 Deployment Plan

1. **Pre-deployment**: Run all migrations against a staging database clone. Verify all 25 migrations execute successfully in order.

2. **Migration execution**: Render pre-deploy command already runs `node scripts/migrate.js`, which auto-discovers and runs new `.sql` files in order. Each migration runs in a single transaction (except 010 which uses explicit `BEGIN/COMMIT`).

3. **Rollback plan**: Each migration file includes a `-- ROLLBACK` section at the bottom with `DROP TABLE IF EXISTS` and `ALTER TABLE ... DROP COLUMN` statements. The `migrate.js` runner does not support automatic rollback; rollback is manual via `psql`.

4. **Zero-downtime**: All migrations are additive (new tables, new columns with defaults, new indexes). No existing columns are dropped or renamed. No data migrations. The existing application continues to function during migration.

5. **Feature flag**: New marketplace routes are gated behind `ENABLE_MARKETPLACE=true` environment variable until all migrations are verified and frontend code is deployed.

### 18.3 Compatibility

- New FK columns on existing tables (e.g., `documents.marketplace_template_id`) are added as nullable, so existing rows are unaffected.
- New `user_role` column defaults to `'client'`, so all existing users are clients by default.
- New RLS policies are additive; they do not modify existing policies on existing tables.

### 18.4 Pricing Coexistence

The existing `PRICING_CONFIG` in the payment route continues to apply to first-party document generation:

| Product | Price |
|---|---|
| Single affidavit | $79.00 |
| Divorce package | $249.00 |
| All-state access | $199.99 |

Marketplace templates use **lawyer-set pricing** with the additive $1 platform fee model described in section 4.1.6. Both pricing paths coexist: the payment route inspects whether a document is linked to a `marketplace_template_id`. If it is, the marketplace revenue-split logic applies; otherwise, the existing `PRICING_CONFIG` lookup is used.

---

## 19. Migration SQL

### 19.1 Migration 014: User Roles

```sql
-- Migration 014: Add user_role to users table
-- Enables role-based access control for marketplace (lawyer, admin)
-- Note: Affiliate status is tracked in affiliate_accounts, not as a user role

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS user_role VARCHAR(20) DEFAULT 'client'
    CHECK (user_role IN ('client', 'lawyer', 'admin'));

CREATE INDEX IF NOT EXISTS idx_users_role ON users(user_role);

-- Helper function for RLS policies
CREATE OR REPLACE FUNCTION current_user_role()
RETURNS TEXT AS $$
BEGIN
  RETURN COALESCE(current_setting('app.user_role', TRUE), 'client');
EXCEPTION WHEN OTHERS THEN
  RETURN 'client';
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION current_user_role() TO PUBLIC;
```

### 19.2 Migration 016: Marketplace Templates (key migration)

```sql
-- Migration 016: Marketplace templates
-- Core table for lawyer-created interview templates

CREATE TABLE IF NOT EXISTS marketplace_templates (
  id                  SERIAL PRIMARY KEY,
  lawyer_id           INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title               VARCHAR(500) NOT NULL,
  slug                VARCHAR(500) UNIQUE NOT NULL,
  description         TEXT,
  short_description   VARCHAR(300),
  matter_type         VARCHAR(50) NOT NULL,
  practice_area       VARCHAR(20) NOT NULL DEFAULT 'civil',
  jurisdictions       TEXT[] NOT NULL DEFAULT '{}',
  template_config     JSONB NOT NULL DEFAULT '{}',
  price_cents         INTEGER NOT NULL DEFAULT 100,
  status              VARCHAR(20) NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft', 'pending_review', 'published', 'suspended', 'archived', 'deleted')),
  version             INTEGER NOT NULL DEFAULT 1,
  current_version_id  INTEGER,
  cover_image_url     VARCHAR(1000),
  tags                TEXT[] DEFAULT '{}',
  estimated_minutes   INTEGER DEFAULT 15,
  difficulty_level    VARCHAR(10) DEFAULT 'standard'
                        CHECK (difficulty_level IN ('basic', 'standard', 'complex')),
  total_purchases     INTEGER DEFAULT 0,
  total_revenue_cents INTEGER DEFAULT 0,
  avg_rating          NUMERIC(3,2) DEFAULT 0.00,
  rating_count        INTEGER DEFAULT 0,
  published_at        TIMESTAMP,
  suspended_at        TIMESTAMP,
  suspension_reason   TEXT,
  created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at          TIMESTAMP
);

-- Generated tsvector column for full-text search
ALTER TABLE marketplace_templates
  ADD COLUMN IF NOT EXISTS search_vector tsvector
    GENERATED ALWAYS AS (
      setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
      setweight(to_tsvector('english', coalesce(description, '')), 'B') ||
      setweight(to_tsvector('english', coalesce(short_description, '')), 'B') ||
      setweight(to_tsvector('english', coalesce(array_to_string(tags, ' '), '')), 'C')
    ) STORED;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_mkt_templates_lawyer      ON marketplace_templates(lawyer_id);
CREATE INDEX IF NOT EXISTS idx_mkt_templates_status      ON marketplace_templates(status) WHERE status = 'published';
CREATE INDEX IF NOT EXISTS idx_mkt_templates_matter      ON marketplace_templates(matter_type);
CREATE INDEX IF NOT EXISTS idx_mkt_templates_practice    ON marketplace_templates(practice_area);
CREATE INDEX IF NOT EXISTS idx_mkt_templates_slug        ON marketplace_templates(slug);
CREATE INDEX IF NOT EXISTS idx_mkt_templates_rating      ON marketplace_templates(avg_rating DESC) WHERE status = 'published';
CREATE INDEX IF NOT EXISTS idx_mkt_templates_purchases   ON marketplace_templates(total_purchases DESC) WHERE status = 'published';
CREATE INDEX IF NOT EXISTS idx_mkt_templates_jurisdictions ON marketplace_templates USING GIN(jurisdictions);
CREATE INDEX IF NOT EXISTS idx_mkt_templates_tags        ON marketplace_templates USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_mkt_templates_config      ON marketplace_templates USING GIN(template_config jsonb_path_ops);
CREATE INDEX IF NOT EXISTS idx_mkt_templates_search      ON marketplace_templates USING GIN(search_vector);

-- RLS
ALTER TABLE marketplace_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY mkt_templates_read_published ON marketplace_templates
  FOR SELECT USING (
    status = 'published'
    OR lawyer_id = current_user_id()
    OR current_user_is_admin()
    OR bypass_rls_enabled()
  );

CREATE POLICY mkt_templates_insert_own ON marketplace_templates
  FOR INSERT WITH CHECK (
    (lawyer_id = current_user_id() AND current_user_role() IN ('lawyer', 'admin'))
    OR bypass_rls_enabled()
  );

CREATE POLICY mkt_templates_update_own ON marketplace_templates
  FOR UPDATE USING (
    lawyer_id = current_user_id()
    OR current_user_is_admin()
    OR bypass_rls_enabled()
  );

CREATE POLICY mkt_templates_delete_own ON marketplace_templates
  FOR DELETE USING (
    lawyer_id = current_user_id()
    OR current_user_is_admin()
  );

-- Updated_at trigger
DROP TRIGGER IF EXISTS mkt_templates_updated_at ON marketplace_templates;
CREATE TRIGGER mkt_templates_updated_at
  BEFORE UPDATE ON marketplace_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### 19.3 Migration 019: Template Purchases (key migration)

```sql
-- Migration 019: Template purchases
-- Immutable ledger of all marketplace template purchases

CREATE TABLE IF NOT EXISTS template_purchases (
  id                      SERIAL PRIMARY KEY,
  client_id               INTEGER NOT NULL REFERENCES users(id),
  template_id             INTEGER NOT NULL REFERENCES marketplace_templates(id),
  template_version_id     INTEGER REFERENCES template_versions(id),
  lawyer_id               INTEGER NOT NULL REFERENCES users(id),
  document_id             INTEGER REFERENCES documents(id) ON DELETE SET NULL,
  affiliate_id            INTEGER REFERENCES users(id),
  amount_cents            INTEGER NOT NULL,
  platform_fee_cents      INTEGER NOT NULL,
  stripe_fee_cents        INTEGER NOT NULL,
  lawyer_payout_cents     INTEGER NOT NULL,
  affiliate_payout_cents  INTEGER DEFAULT 0,
  stripe_payment_intent_id VARCHAR(255) UNIQUE,
  stripe_transfer_id      VARCHAR(255),
  payout_status           VARCHAR(20) DEFAULT 'pending'
                            CHECK (payout_status IN ('pending', 'transferred', 'paid', 'failed')),
  refund_status           VARCHAR(20) DEFAULT 'none'
                            CHECK (refund_status IN ('none', 'partial', 'full')),
  refunded_amount_cents   INTEGER DEFAULT 0,
  created_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_purchases_client    ON template_purchases(client_id);
CREATE INDEX IF NOT EXISTS idx_purchases_template  ON template_purchases(template_id);
CREATE INDEX IF NOT EXISTS idx_purchases_lawyer    ON template_purchases(lawyer_id);
CREATE INDEX IF NOT EXISTS idx_purchases_affiliate ON template_purchases(affiliate_id) WHERE affiliate_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_purchases_stripe    ON template_purchases(stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_purchases_payout    ON template_purchases(payout_status) WHERE payout_status = 'pending';
CREATE INDEX IF NOT EXISTS idx_purchases_created   ON template_purchases(created_at);

-- RLS
ALTER TABLE template_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY purchases_read_own ON template_purchases
  FOR SELECT USING (
    client_id = current_user_id()
    OR lawyer_id = current_user_id()
    OR current_user_is_admin()
    OR bypass_rls_enabled()
  );

CREATE POLICY purchases_insert_system ON template_purchases
  FOR INSERT WITH CHECK (bypass_rls_enabled());

-- Purchase counter trigger
CREATE OR REPLACE FUNCTION update_template_purchase_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE marketplace_templates
  SET total_purchases = total_purchases + 1,
      total_revenue_cents = total_revenue_cents + NEW.amount_cents
  WHERE id = NEW.template_id;

  UPDATE lawyer_profiles
  SET total_sales = total_sales + 1,
      total_earned_cents = total_earned_cents + NEW.lawyer_payout_cents
  WHERE user_id = NEW.lawyer_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_purchase_count ON template_purchases;
CREATE TRIGGER trigger_update_purchase_count
  AFTER INSERT ON template_purchases
  FOR EACH ROW EXECUTE FUNCTION update_template_purchase_count();
```

---

## 20. Security Architecture

### 20.1 New Attack Surfaces

| Surface | Threat | Mitigation |
|---|---|---|
| Lawyer-uploaded template prompts | Prompt injection via malicious system prompts | Sanitize prompts: strip `<script>`, limit length, UPL screening. Prompts run in LLM sandbox (no tool access beyond process_matter_data). |
| Lawyer-uploaded branding assets | XSS via SVG, path traversal via filename | Validate file type at magic-byte level (not just extension). Hash filenames. Serve SVGs with `Content-Type: image/svg+xml` and CSP `script-src 'none'`. |
| Stripe Connect onboarding | Fraudulent lawyer accounts | Verify bar number against state bar API (or manual verification for launch). Require `bar_verified=true` before allowing template publication. |
| Clio OAuth tokens | Token theft from database compromise | AES-256-GCM encryption at rest. Tokens never logged. Refresh tokens rotated on each use. |
| Affiliate referral fraud | Click farming, self-referral | Fingerprint dedup, 30-day cookie window, no self-referral, minimum payout threshold. |
| Template config JSONB | Arbitrary code execution via skipCondition | `skipCondition` uses a declarative operator set (eq, neq, exists, not_exists, in, not_in) -- no `eval()` or function construction. |
| Review content | XSS, spam, defamation | HTML-escape all review text on output. Rate-limit review submission. Flag system for moderation. |
| Admin panel | Privilege escalation | `is_admin` check at middleware level. All admin routes require both Auth0 JWT and `current_user_is_admin()` at DB level. |

### 20.2 Rate Limiting Additions

| Endpoint | Limit | Window |
|---|---|---|
| `POST /api/marketplace/templates` | 20 | 15 min |
| `POST /api/marketplace/purchase` | 10 | 15 min |
| `POST /api/reviews` | 5 | 15 min |
| `GET /api/marketplace/templates` (search) | 60 | 15 min |
| `POST /api/clio/sync` | 5 | 1 hour |
| `POST /api/affiliates/track` | 100 | 15 min |
| `GET /api/lawyer/analytics` | 30 | 15 min |

### 20.3 CORS / CSP Updates

New origins to add if subdomains are introduced:

```javascript
// In server.js getAllowedOrigins() and middleware/csrfProtection.js:
// No new origins needed at launch -- all marketplace routes are under make.discover.legal
```

New CSP `connect-src` additions:

```javascript
connectSrc: [
  // ... existing entries ...
  'https://api.clio.com',          // Clio API (server-side only, but listed for completeness)
  'https://connect.stripe.com',    // Stripe Connect onboarding
]
```

### 20.4 Input Validation

All JSONB inputs (`template_config`) are validated against the JSON Schema defined in Section 5.1 using `ajv` (Already JSON Schema Validator) before storage:

```javascript
const Ajv = require('ajv');
const ajv = new Ajv({ allErrors: true });
const validate = ajv.compile(require('./schemas/templateConfigSchema.json'));

function validateTemplateConfig(config) {
  const valid = validate(config);
  if (!valid) {
    throw new ValidationError(
      `Invalid template config: ${ajv.errorsText(validate.errors)}`
    );
  }
}
```

---

## 21. Deployment Architecture

### 21.1 Current State

```
Render.com
  +-- Web Service (Docker): affidavit-maker (branch: main)
  +-- PostgreSQL: affidavit-db (managed)
```

### 21.2 Marketplace Additions

```
Render.com
  +-- Web Service (Docker): affidavit-maker (branch: main)
  |     - ENABLE_MARKETPLACE=true
  |     - STRIPE_CONNECT_CLIENT_ID=ca_xxx
  |     - CLIO_CLIENT_ID=xxx
  |     - CLIO_CLIENT_SECRET=xxx
  |     - CLIO_TOKEN_ENCRYPTION_KEY=xxx (32-byte hex)
  |     - R2_ACCOUNT_ID=xxx
  |     - R2_ACCESS_KEY_ID=xxx
  |     - R2_SECRET_ACCESS_KEY=xxx
  |     - R2_BUCKET_NAME=discover-legal-assets
  |
  +-- PostgreSQL: affidavit-db (managed, same instance)
  |     - 12 new migrations (014-025)
  |     - ~18 new tables
  |
  +-- Cron Job: leaderboard + analytics rollup
  |     - Schedule: daily at 2:00 AM UTC
  |     - Command: node scripts/marketplace-cron.js
  |
  +-- Cloudflare R2 Bucket: discover-legal-assets
       - Public prefix: /public/ (logos, avatars, cover images)
       - Private prefix: /private/ (generated PDFs, encrypted docs)
```

### 21.3 New Environment Variables

| Variable | Required | Description |
|---|---|---|
| `ENABLE_MARKETPLACE` | Yes | Feature flag to enable marketplace routes |
| `STRIPE_CONNECT_CLIENT_ID` | Yes | Stripe Connect platform client ID |
| `CLIO_CLIENT_ID` | No | Clio OAuth2 client ID (required for Clio tier) |
| `CLIO_CLIENT_SECRET` | No | Clio OAuth2 client secret |
| `CLIO_TOKEN_ENCRYPTION_KEY` | No | 32-byte hex key for encrypting Clio tokens |
| `R2_ACCOUNT_ID` | Yes | Cloudflare R2 account ID |
| `R2_ACCESS_KEY_ID` | Yes | R2 S3-compatible access key |
| `R2_SECRET_ACCESS_KEY` | Yes | R2 S3-compatible secret key |
| `R2_BUCKET_NAME` | Yes | R2 bucket name |
| `MARKETPLACE_PLATFORM_FEE_CENTS` | No | Flat platform fee in cents (default: 100) |
| `MARKETPLACE_AFFILIATE_RATE` | No | Affiliate commission rate on subtotal (default: 0.10) |

---

## 22. Performance Considerations

### 22.1 JSONB Indexing

The `template_config` column uses a GIN index with `jsonb_path_ops`:

```sql
CREATE INDEX idx_mkt_templates_config ON marketplace_templates
  USING GIN(template_config jsonb_path_ops);
```

This index supports containment queries (`@>`) but not key-existence queries (`?`). For marketplace search, the primary query path uses `search_vector` (tsvector), not JSONB. The JSONB index is for admin queries like "find all templates using matter type X in their config."

### 22.2 Query Optimization

**Hot queries (high frequency):**

1. **Template search**: Uses `search_vector @@ query` with GIN index. Covered by composite filtering on indexed columns. Expected latency: <50ms for <10,000 templates.

2. **Template detail**: Single row lookup by `slug` (unique index). Expected latency: <5ms.

3. **Interview message processing**: Loads `template_config` JSONB once per session start, then operates in-memory. No per-message DB query for template config.

4. **Leaderboard**: Pre-computed in `leaderboard_snapshots`. Single row lookup by `(period_type, period_start)`. Expected latency: <5ms.

**Optimization for purchases (write-heavy):**

The `trigger_update_purchase_count` trigger on `template_purchases` updates two tables on each insert (marketplace_templates, lawyer_profiles). Under high write load, this could become a bottleneck. Mitigation: if purchase volume exceeds 100/minute, replace the trigger with an async job that batches counter updates every 30 seconds.

### 22.3 Connection Pooling

Current pool size: default `pg` pool (10 connections). With marketplace traffic, increase to:

```javascript
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,                    // Up from default 10
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});
```

Monitor with `SELECT count(*) FROM pg_stat_activity WHERE datname = 'affidavit_maker';` and adjust based on actual connection utilization.

### 22.4 Pagination

All list endpoints use cursor-based pagination (keyset pagination) for consistent performance:

```sql
-- Instead of OFFSET (which scans skipped rows):
SELECT * FROM marketplace_templates
WHERE status = 'published'
  AND (total_purchases, id) < ($1, $2)  -- cursor from previous page
ORDER BY total_purchases DESC, id DESC
LIMIT 20;
```

---

## 23. Monitoring & Alerting

### 23.1 New Metrics

| Metric | Type | Alert Threshold |
|---|---|---|
| `marketplace.purchases.count` | Counter | N/A (track trend) |
| `marketplace.purchases.revenue_cents` | Counter | N/A (track trend) |
| `marketplace.templates.published` | Gauge | N/A |
| `marketplace.search.latency_ms` | Histogram | p95 > 500ms |
| `marketplace.interview.active_sessions` | Gauge | > 500 |
| `marketplace.interview.completion_rate` | Gauge | < 30% (investigate) |
| `stripe.connect.transfer.failures` | Counter | > 0 (alert immediately) |
| `stripe.billing.webhook.failures` | Counter | > 5 in 15 min |
| `clio.oauth.token_refresh.failures` | Counter | > 0 (alert) |
| `moderation.queue.pending` | Gauge | > 50 (alert) |
| `affiliate.referrals.fraud_score` | Histogram | > 0.8 (investigate) |

### 23.2 Health Check Extension

Extend the existing `/health` endpoint:

```javascript
app.get('/health', async (req, res) => {
  const checks = {
    server: 'ok',
    database: 'unknown',
    marketplace: 'unknown',
    stripe_connect: 'unknown',
  };

  try {
    await pool.query('SELECT 1');
    checks.database = 'ok';
  } catch { checks.database = 'error'; }

  if (process.env.ENABLE_MARKETPLACE === 'true') {
    try {
      await pool.query('SELECT COUNT(*) FROM marketplace_templates WHERE status = $1', ['published']);
      checks.marketplace = 'ok';
    } catch { checks.marketplace = 'error'; }

    checks.stripe_connect = stripe ? 'configured' : 'not_configured';
  } else {
    checks.marketplace = 'disabled';
    checks.stripe_connect = 'disabled';
  }

  const status = Object.values(checks).every(v => v !== 'error') ? 200 : 503;
  res.status(status).json({ status: status === 200 ? 'healthy' : 'degraded', checks });
});
```

### 23.3 Structured Logging Additions

All new services log structured events via the existing Winston logger:

```javascript
logger.info('marketplace.purchase.completed', {
  purchaseId: purchase.id,
  templateId: template.id,
  clientId: client.id,
  lawyerId: lawyer.id,
  amountCents: 100,
  affiliateCode: affiliateCode || null,
  duration: `${Date.now() - startTime}ms`
});
```

---

## 24. Data Model Diagram

```
+----------------+         +----------------------+         +-------------------+
|    users       |         | marketplace_templates|         | template_versions |
+----------------+         +----------------------+         +-------------------+
| id (PK)        |<---+    | id (PK)              |<-----+  | id (PK)           |
| auth0_id       |    |    | lawyer_id (FK users)  |      |  | template_id (FK)  |
| email           |    |    | title                 |      |  | version_number    |
| user_role       |    |    | slug                  |      |  | template_config   |
| stripe_customer |    |    | template_config JSONB |      |  | change_summary    |
+----------------+    |    | price_cents           |      |  | created_by (FK)   |
        |             |    | status                |      |  +-------------------+
        |             |    | current_version_id ---+------+
        |             |    | jurisdictions[]       |
        |             |    | search_vector         |
        |             |    +----------------------+
        |             |             |
        |             |             |  1:N
        |             |             v
        |             |    +----------------------+
        |             |    | template_purchases   |
        |             |    +----------------------+
        |             +--->| client_id (FK users) |
        |             +--->| lawyer_id (FK users) |
        |             |    | template_id (FK)     |
        |             |    | amount_cents         |
        |             |    | platform_fee_cents   |
        |             |    | stripe_fee_cents     |
        |             |    | lawyer_payout_cents  |
        |             |    | affiliate_id (FK)    |
        |             |    +----------------------+
        |             |             |
        |             |             |  1:1
        |             |             v
        |             |    +----------------------+
        |             |    | template_reviews     |
        |             |    +----------------------+
        |             +--->| reviewer_id (FK)     |
        |             |    | template_id (FK)     |
        |             |    | purchase_id (FK)     |
        |             |    | rating (1-5)         |
        |             |    +----------------------+
        |             |
        |             |    +----------------------+
        |             |    | interview_sessions   |
        |             |    +----------------------+
        |             +--->| client_id (FK users) |
        |                  | template_id (FK)     |
        |                  | current_phase        |
        |                  | interview_data JSONB  |
        |                  +----------------------+
        |
        |             +----------------------+
        |             | lawyer_profiles      |
        |             +----------------------+
        +------------>| user_id (FK users)   |
        |             | bar_number           |
        |             | stripe_connect_id    |
        |             | licensed_jurisdictions|
        |             +----------------------+
        |
        |             +----------------------+
        |             | lawyer_subscriptions |
        |             +----------------------+
        +------------>| lawyer_id (FK users) |
        |             | tier_code            |
        |             | stripe_subscription_id|
        |             +----------------------+
        |
        |             +----------------------+
        |             | lawyer_achievements  |
        |             +----------------------+
        +------------>| lawyer_id (FK users) |
        |             | achievement_code     |
        |             | tier (bronze-plat)   |
        |             +----------------------+
        |
        |             +----------------------+
        |             | affiliate_accounts   |
        |             +----------------------+
        +------------>| user_id (FK users)   |
        |             | affiliate_code       |
        |             | stripe_connect_id    |
        |             | commission_rate      |
        |             +----------------------+
        |                      |
        |                      | 1:N
        |                      v
        |             +----------------------+
        |             | affiliate_referrals  |
        |             +----------------------+
        |             | affiliate_id (FK)    |
        |             | converted_user_id FK |
        |             | purchase_id (FK)     |
        |             +----------------------+
        |
        |             +----------------------+
        |             | affiliate_payouts    |
        |             +----------------------+
        |             | affiliate_id (FK)    |
        |             | amount_cents         |
        |             +----------------------+
        |
        |             +----------------------+
        |             | clio_connections     |
        |             +----------------------+
        +------------>| user_id (FK users)   |
                      | access_token (enc)   |
                      | refresh_token (enc)  |
                      +----------------------+

Stand-alone tables:
+----------------------+    +----------------------+    +-------------------+
| template_analytics   |    | template_categories  |    | featured_placements|
| template_id (FK)     |    | slug                 |    | template_id (FK)   |
| date                 |    | display_name         |    | placement_type     |
| views, purchases...  |    | parent_id (self FK)  |    | starts_at, ends_at |
+----------------------+    +----------------------+    +-------------------+

+----------------------+    +----------------------+
| template_flags       |    | leaderboard_snapshots|
| template_id (FK)     |    | period_type          |
| flag_type            |    | rankings JSONB       |
| severity, status     |    +----------------------+
+----------------------+
                            +----------------------+
                            | payout_batches       |
                            | batch_type           |
                            | total_amount_cents   |
                            +----------------------+
```

**Total tables after migration: 31**
- Existing: 13 (users, user_identities, documents, payments, activity_logs, sessions, email_notifications, document_templates, api_keys, webhook_events, cases, matter_types, document_type_catalog, state_document_support, interview_phase_configs, case_document_queue, audit_log, processed_webhooks, migrations)
- New: 18 (marketplace_templates, template_versions, lawyer_profiles, lawyer_subscriptions, template_purchases, template_reviews, affiliate_accounts, affiliate_referrals, affiliate_payouts, clio_connections, template_analytics, lawyer_achievements, leaderboard_snapshots, payout_batches, template_categories, featured_placements, template_flags, interview_sessions)

---

## 25. Architecture Decision Records

### ADR-001: JSONB for Template Config (vs. Relational Tables)

**Status:** Accepted

**Context:** Marketplace templates need to store a complex, variable-schema configuration (phases, prompts, field maps, tool definitions). The schema varies by matter type and evolves over time as lawyers iterate.

**Decision:** Store the complete template configuration as a single JSONB column (`template_config`) rather than normalizing into relational tables (one row per phase, one row per field, etc.).

**Consequences:**
- (+) Schema flexibility: lawyers can define arbitrary phases, fields, and prompts without migration
- (+) Single read: one query loads the entire config needed to run an interview
- (+) Version snapshots: copying a JSONB value to `template_versions` is atomic and simple
- (+) Backwards compatibility: the JSONB structure mirrors the existing in-code config objects
- (-) Cannot enforce relational constraints on the JSONB structure (e.g., "phaseOrder references phases keys")
- (-) Querying individual fields within JSONB is slower than querying indexed columns
- (-) Larger row size (typical template_config is 5-20 KB)

**Mitigation:** Validate JSONB against a JSON Schema (Section 5.1) at write time. Use `jsonb_path_ops` GIN index for containment queries. Individual field queries are rare (admin use only) and acceptable at GIN-indexed speed.

### ADR-002: Destination Charges (vs. Direct Charges, vs. Separate Charges and Transfers)

**Status:** Accepted

**Context:** The marketplace needs to collect payment from clients and distribute revenue to lawyers via Stripe.

**Decision:** Use Stripe Connect Destination Charges. The platform creates the PaymentIntent with `transfer_data.destination` pointing to the lawyer's Express account.

**Rationale:**
- Platform controls the full payment flow and refund process
- Single charge on the client's statement (platform name)
- Stripe handles 1099-K reporting for Connect accounts
- Simpler than Separate Charges and Transfers (no manual transfer creation needed)
- Compatible with Express accounts (no custom dashboard needed for lawyers)

### ADR-003: PostgreSQL Full-Text Search (vs. Elasticsearch / Meilisearch)

**Status:** Accepted

**Context:** Template search needs to support keyword queries, faceted filtering (jurisdiction, matter type, price, rating), and ranking by relevance.

**Decision:** Use PostgreSQL `tsvector`/`tsquery` with weighted fields and a generated stored column.

**Rationale:**
- No additional infrastructure (no Elasticsearch cluster to manage)
- Expected catalog size (<10,000 templates at launch) is well within PostgreSQL FTS performance
- Faceted filtering is handled by standard SQL `WHERE` clauses on indexed columns
- Migration path: if search needs outgrow PostgreSQL, the `search_vector` column can be mirrored to an external engine

**Trigger for reassessment:** Template catalog exceeds 10,000 published templates, or p95 search latency exceeds 200ms.

### ADR-004: DynamicOrchestrator (Wrapper vs. Fork of BaseMatterOrchestrator)

**Status:** Accepted

**Context:** Marketplace templates need to run through the interview engine. The engine is `BaseMatterOrchestrator`, which takes config in its constructor.

**Decision:** Create `DynamicOrchestrator` as a subclass of `BaseMatterOrchestrator`. It adds a `fromConfig()` factory method that deserializes JSONB into the constructor parameters. It does not modify the base class.

**Rationale:**
- Zero changes to existing code: `BaseMatterOrchestrator` and all 134 existing orchestrator files are untouched
- `DynamicOrchestrator` only adds: (1) `fromConfig()` factory, (2) `_buildSkipFn()` for declarative skip conditions, (3) `branding` and `metadata` extensions
- `OrchestratorFactory` routes between static (built-in) and dynamic (marketplace) orchestrators transparently
- The same `processMessage()` flow handles both built-in and marketplace templates

### ADR-005: Cloudflare R2 (vs. S3, vs. Local Filesystem)

**Status:** Accepted

**Context:** Lawyer branding assets and generated PDFs need persistent storage outside the ephemeral Docker container.

**Decision:** Cloudflare R2 with S3-compatible API.

**Rationale:**
- Zero egress fees (PDF downloads are the dominant access pattern)
- S3-compatible API (same AWS SDK, trivial to switch to S3 later)
- Lower storage cost than S3 ($0.015/GB vs. $0.023/GB)
- No CDN needed at launch (R2 public URLs are fast enough)

---

## 26. Risk Register

| Risk | Impact | Likelihood | Mitigation |
|---|---|---|---|
| Lawyer creates template with UPL content | High (legal liability) | Medium | Automated UPL screening + manual review queue + bar verification |
| Stripe Connect onboarding friction | Medium (lawyer drop-off) | High | Streamlined Express onboarding + clear setup guide + email reminders |
| Template quality variance | Medium (client trust) | High | Review system + moderation + editorial featured picks |
| JSONB schema evolution breaks old templates | High (interview failures) | Low | Schema versioning (version field) + forward-compatible validation |
| Affiliate fraud | Low (financial loss) | Medium | Fingerprint dedup + self-referral block + minimum payout threshold |
| Clio API rate limits | Low (sync delays) | Medium | Exponential backoff + sync queue + batch operations |
| PostgreSQL FTS performance at scale | Medium (slow search) | Low | GIN indexes + caching + migration path to Elasticsearch |
| Stripe fee increase | Medium (margin compression) | Low | Revenue split is configurable via env vars |

---

## 27. Appendices

### Appendix A: Revenue Split Calculation

```javascript
/**
 * Calculate revenue split for a template purchase.
 *
 * Uses the additive $1 platform fee model:
 *   Client pays: templatePrice + $1.00 platformFee + Stripe fee on the total.
 *   Lawyer receives: templatePrice (100% of their listed price).
 *   Platform receives: $1.00 flat fee (minus affiliate commission if applicable).
 *   Stripe receives: 2.9% + $0.30 on the total charge.
 *
 * @param {number} templatePriceCents - Lawyer's listed price in cents
 * @param {boolean} hasAffiliate - Whether an affiliate referred this purchase
 * @returns {{ totalChargeCents, stripeFee, platformFee, lawyerPayout, affiliatePayout }}
 */
function calculateRevenueSplit(templatePriceCents, hasAffiliate = false) {
  const PLATFORM_FEE_CENTS = 100; // flat $1.00
  const subtotalCents = templatePriceCents + PLATFORM_FEE_CENTS;

  // Stripe processing: 2.9% of total charge + 30 cents
  const stripeFee = Math.ceil(subtotalCents * 0.029 + 30);
  const totalChargeCents = subtotalCents + stripeFee;

  // Lawyer gets 100% of their listed price
  const lawyerPayout = templatePriceCents;

  // Affiliate gets 10% of subtotal (template + platform), deducted from platform fee
  const affiliatePayout = hasAffiliate ? Math.floor(subtotalCents * 0.10) : 0;

  // Platform gets flat $1.00 minus any affiliate commission
  const platformFee = PLATFORM_FEE_CENTS - affiliatePayout;

  return { totalChargeCents, stripeFee, platformFee, lawyerPayout, affiliatePayout };
}

// For a $1.00 template (100 cents):
// Without affiliate: { totalChargeCents: 236, stripeFee: 36, platformFee: 100, lawyerPayout: 100, affiliatePayout: 0 }
// With affiliate:    { totalChargeCents: 236, stripeFee: 36, platformFee: 80,  lawyerPayout: 100, affiliatePayout: 20 }
```

### Appendix B: New Environment Variables Summary

```bash
# Marketplace feature flag
ENABLE_MARKETPLACE=false

# Stripe Connect
STRIPE_CONNECT_CLIENT_ID=ca_xxx

# Clio integration (optional, required for clio tier)
CLIO_CLIENT_ID=
CLIO_CLIENT_SECRET=
CLIO_REDIRECT_URI=https://make.discover.legal/api/clio/oauth/callback
CLIO_TOKEN_ENCRYPTION_KEY=  # 32-byte hex string

# Cloudflare R2
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=discover-legal-assets
R2_PUBLIC_BUCKET_URL=  # optional custom domain

# Revenue split (configurable, defaults shown)
MARKETPLACE_PLATFORM_FEE_CENTS=100   # flat $1.00 per document
MARKETPLACE_AFFILIATE_RATE=0.10      # 10% of subtotal, deducted from platform fee

# Payout configuration
MARKETPLACE_MIN_PAYOUT_CENTS=2500  # $25 minimum payout
MARKETPLACE_PAYOUT_SCHEDULE=weekly  # daily, weekly, monthly
```

### Appendix C: Cron Job Schedule

```
# scripts/marketplace-cron.js
# Run via Render Cron Job or external scheduler

Daily at 02:00 UTC:
  1. GamificationService.refreshLeaderboard('daily')
  2. GamificationService.refreshLeaderboard('weekly')   -- only on Mondays
  3. GamificationService.refreshLeaderboard('monthly')  -- only on 1st of month
  4. TemplateAnalyticsService.rollUpDaily()
  5. cleanup_expired_sessions() -- existing function, extended for interview_sessions
  6. Expire affiliate referrals past 30 days

Weekly on Monday at 03:00 UTC:
  7. LawyerPayoutService.runPayoutBatch(lastWeek)
  8. AffiliateService.runAffiliatePayouts(lastWeek)
```

### Appendix D: File Organization for New Code

```
services/
  MarketplaceService.js
  DynamicOrchestrator.js
  DynamicOrchestratorService.js
  OrchestratorFactory.js
  LawyerPayoutService.js
  SubscriptionService.js
  AffiliateService.js
  ClioIntegrationService.js
  TemplateReviewService.js
  GamificationService.js
  TemplateAnalyticsService.js
  TemplateVersioningService.js
  ModerationService.js

routes/
  marketplace.js           # Public template browsing, search, purchase
  lawyer.js                # Lawyer dashboard, template CRUD, payouts
  subscriptions.js         # Stripe Billing webhook + management
  affiliates.js            # Affiliate dashboard, tracking
  clio.js                  # OAuth flow, sync endpoints
  reviews.js               # Review submission, listing
  admin/
    marketplace.js         # Moderation queue, analytics, config

middleware/
  requireRole.js           # Role-based route guard (lawyer, affiliate, admin)
  requireSubscription.js   # Feature-gating middleware (checks tier)

config/
  marketplace.js           # Pricing config, tier definitions, feature-tier mapping

schemas/
  templateConfigSchema.json # JSON Schema for template_config validation

scripts/
  marketplace-cron.js      # Daily/weekly cron tasks

migrations/
  014_user_roles.sql
  015_lawyer_profiles.sql
  016_marketplace_templates.sql
  017_template_versions.sql
  018_lawyer_subscriptions.sql
  019_template_purchases.sql
  020_template_reviews.sql
  021_affiliates.sql
  022_clio_connections.sql
  023_analytics_categories_featured_flags.sql
  024_interview_sessions.sql
  025_achievements_leaderboards_payouts_rls.sql

utils/
  cache.js                 # LRU cache utility
  encryption.js            # AES-256-GCM for Clio tokens
  slugify.js               # Slug generation for template URLs
```

---

*End of document.*
