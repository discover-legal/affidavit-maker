# CLAUDE.md - AI Assistant Guide for Affidavit Maker

**Last Updated**: 2026-01-08
**Version**: 3.0.0
**Purpose**: Comprehensive guide for AI assistants working on this codebase

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture](#architecture)
3. [Directory Structure](#directory-structure)
4. [Development Setup](#development-setup)
5. [Code Patterns & Conventions](#code-patterns--conventions)
6. [Authentication & Authorization](#authentication--authorization)
7. [Database](#database)
8. [AI/LLM Integration](#aillm-integration)
9. [Payment Processing](#payment-processing)
10. [Security Guidelines](#security-guidelines)
11. [Testing](#testing)
12. [Deployment](#deployment)
13. [Common Tasks](#common-tasks)
14. [Troubleshooting](#troubleshooting)

---

## Project Overview

### What is Affidavit Maker?

A **full-stack web application** that helps users create legally-compliant affidavits using AI assistance. Users can:
- Chat with an AI assistant to document facts
- Generate state-specific affidavits (Texas, Utah, Arizona)
- Validate facts for legal sufficiency
- Upload supporting evidence
- Generate professional PDFs
- Save and manage multiple documents

### Tech Stack

**Backend**:
- Node.js + Express 4.21.2
- PostgreSQL (via pg 8.16.3)
- Auth0 (JWT authentication)
- OpenAI GPT-4 (with multi-provider support)
- Stripe (payments)
- PDFKit + pdf-lib (PDF generation)

**Frontend**:
- React 18.2.0
- React Router DOM 7.8.1
- Tailwind CSS
- Auth0 React SDK
- Stripe React SDK
- react-snap (pre-rendering for SEO)

**Deployment**:
- Docker containers on Render.com
- PostgreSQL managed database
- Ephemeral file storage (documents/)

---

## Architecture

### Application Type

**Monolithic full-stack application** where:
- Backend serves REST API on `/api/*` routes
- Frontend built as static files served from `client/build/`
- Single Express server handles both API and static file serving
- PostgreSQL database for persistence
- External services: Auth0, OpenAI, Stripe

### Request Flow

```
User Browser
    ↓
Auth0 Universal Login (if not authenticated)
    ↓
React App (client/build/)
    ↓
API Request (/api/*)
    ↓
Express Middleware Chain:
    - Trust proxy
    - Request ID
    - Response helpers
    - WWW redirect
    - Helmet (security)
    - CORS
    - Compression
    - Body parsing
    - Morgan logging
    - CSRF protection
    - Rate limiting
    ↓
Route Handler (routes/*.js)
    ↓
Auth Middleware (validates JWT)
    ↓
Validation Middleware
    ↓
Service Layer (services/*.js)
    ↓
Database (PostgreSQL)
    ↓
Response (JSON)
```

### Key Architectural Patterns

1. **Layered Architecture**:
   - Routes → Services → Database
   - Middleware for cross-cutting concerns
   - Utilities for shared logic

2. **Service-Oriented**:
   - Each service handles one domain (documents, payments, AI, etc.)
   - Services are stateless and reusable
   - Database access centralized in DatabaseService

3. **Multi-Provider LLM**:
   - Abstraction layer supports OpenAI, Gemini, Anthropic
   - Resilience patterns (circuit breaker, retry, timeout)
   - Graceful degradation

4. **Context-Split React State**:
   - Single DocumentContext split into 5 sub-contexts
   - Prevents unnecessary re-renders
   - Actions separated from state

---

## Directory Structure

```
affidavit-maker/
├── server.js                    # Express app entry point
├── package.json                 # Backend dependencies
├── Dockerfile                   # Container build config
├── render.yaml                  # Render.com deployment config
├── .env.example.sh              # Environment variable template
│
├── middleware/                  # Express middleware
│   ├── auth.js                  # Auth0 JWT verification (primary)
│   ├── auth0Middleware.js       # Alternative auth wrapper
│   ├── csrfProtection.js        # CSRF protection
│   ├── errorMiddleware.js       # Error handling
│   ├── rateLimiting.js          # Rate limiters
│   └── validation.js            # Input validation rules
│
├── routes/                      # API route handlers
│   ├── auth.js                  # Legacy auth routes
│   ├── auth0-webhooks.js        # Auth0 lifecycle webhooks
│   ├── chat.js                  # AI chat interface
│   ├── documents.js             # Document CRUD, preview, PDF
│   ├── evidence.js              # Evidence/exhibit uploads
│   ├── factRoutes.js            # Fact validation
│   ├── payment.js               # Stripe payment intents/webhooks
│   ├── templates.js             # Template metadata
│   └── validation.js            # Enhanced validation endpoint
│
├── services/                    # Business logic layer
│   ├── DatabaseService.js       # PostgreSQL connection pool
│   ├── MultiProviderLLM.js      # Multi-provider LLM wrapper
│   ├── ResilientOpenAIService.js # Circuit breaker, retry logic
│   ├── affidavitService.js      # Core affidavit processing
│   ├── courtNameService.js      # Court name validation
│   ├── documentService.js       # Document business logic
│   ├── enhancedFactValidationService.js # AI fact validation
│   ├── evidenceStorage.js       # File storage management
│   ├── pdfService.js            # Two-pass PDF generation
│   └── previewRenderer.js       # HTML preview rendering
│
├── templates/                   # State-specific legal templates
│   ├── StateTemplateManager.js  # Legacy template manager
│   ├── initialize.js            # Auto-discovery loader
│   ├── core/                    # Base template classes
│   └── states/                  # State-specific templates
│       ├── texas/
│       ├── utah/
│       └── arizona/
│
├── utils/                       # Shared utilities
│   ├── logger.js                # Winston structured logging
│   ├── factNormalizer.js        # Fact format normalization
│   └── responseHelpers.js       # Standard API responses
│
├── migrations/                  # Database migrations
│   ├── README.md                # Migration guide
│   ├── 000_initial_schema.sql
│   ├── 001_add_user_identities_and_audit_log.sql
│   └── ...
│
├── scripts/                     # Utility scripts
│   ├── migrate.js               # Run database migrations
│   ├── cleanDatabase.js         # Database cleanup
│   └── ...
│
├── __tests__/                   # Backend unit tests
│   ├── api/
│   ├── middleware/
│   ├── services/
│   └── utils/
│
├── types/                       # TypeScript type definitions
│   └── index.d.ts
│
└── client/                      # React frontend
    ├── package.json             # Frontend dependencies
    ├── public/                  # Static assets
    │   ├── index.html
    │   ├── manifest.json
    │   └── ...
    └── src/
        ├── index.js             # React entry point
        ├── App.js               # Root component, routing
        ├── components/          # React components
        │   ├── AffidavitForm.js
        │   ├── ChatInterface.js
        │   ├── DocumentPreview.js
        │   ├── UserDashboard.js
        │   └── ...
        ├── contexts/            # Global state management
        │   ├── DocumentContext.js
        │   └── TOSContext.js
        ├── hooks/               # Custom React hooks
        │   ├── useAffidavitData.js
        │   ├── useCountyValidation.js
        │   └── useSaveDocument.js
        ├── services/            # Client-side services
        │   └── authService.js   # Authenticated API wrapper
        ├── utils/               # Client utilities
        │   ├── analytics.js
        │   └── factNormalizer.js
        ├── views/               # Page-level components
        │   └── EditorView.js
        └── content/             # Static content
            ├── termsOfService.js
            └── privacyPolicy.js
```

---

## Development Setup

### Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0
- PostgreSQL >= 12
- Auth0 account
- OpenAI API key (or Gemini/Anthropic)
- Stripe account (for payment testing)

### Initial Setup

```bash
# 1. Clone repository
git clone <repository-url>
cd affidavit-maker

# 2. Install backend dependencies
npm install

# 3. Install frontend dependencies
cd client && npm install && cd ..

# 4. Create PostgreSQL database
createdb affidavit_maker

# 5. Copy environment template
cp .env.example.sh .env

# 6. Configure .env (see Environment Variables section)
# Edit .env with your credentials

# 7. Run database migrations
npm run db:migrate

# 8. Configure client/.env
cd client
cp .env.example .env
# Edit with your frontend config
cd ..
```

### Environment Variables

**Backend (.env)**:

```bash
# Server
NODE_ENV=development
PORT=3001
LOG_LEVEL=info

# Database
DATABASE_URL=postgresql://localhost:5432/affidavit_maker
DATABASE_POOL_MAX=20

# Auth0
AUTH0_DOMAIN=your-tenant.auth0.com
AUTH0_CLIENT_ID=your_client_id
AUTH0_CLIENT_SECRET=your_client_secret
AUTH0_AUDIENCE=https://your-api-identifier
AUTH0_WEBHOOK_SECRET=whsec_your_webhook_secret

# LLM Provider (multi-provider support)
LLM_PROVIDER=openai  # or gemini, anthropic
LLM_MODEL=gpt-4o-2024-08-06
OPENAI_API_KEY=sk-your-api-key
# GEMINI_API_KEY=...  (if using Gemini)
# ANTHROPIC_API_KEY=... (if using Anthropic)

# Stripe
STRIPE_SECRET_KEY=sk_test_your_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# Frontend
FRONTEND_URL=http://localhost:3000

# Security
SESSION_SECRET=your-session-secret-change-this
TRUSTED_PROXIES=1

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Feature Flags
ENABLE_WEBHOOKS=true
ENABLE_ANALYTICS=true
```

**Frontend (client/.env)**:

```bash
# Leave empty for relative URLs (proxies to backend in dev)
REACT_APP_API_URL=

# Auth0 (must match backend)
REACT_APP_AUTH0_DOMAIN=your-tenant.auth0.com
REACT_APP_AUTH0_CLIENT_ID=your_client_id
REACT_APP_AUTH0_AUDIENCE=https://your-api-identifier

# Stripe
REACT_APP_STRIPE_PUBLISHABLE_KEY=pk_test_your_key
```

### Running Locally

```bash
# Option 1: Run backend and frontend separately
# Terminal 1: Backend (port 3001)
npm run dev

# Terminal 2: Frontend (port 3000)
npm run client

# Option 2: Run both concurrently
npm run dev:full
```

### Available Scripts

**Backend**:
```bash
npm start              # Production server
npm run dev            # Development with nodemon
npm run dev:full       # Backend + frontend concurrently
npm run client         # Frontend only
npm run build          # Build frontend
npm test               # Run tests with coverage
npm run test:watch     # Watch mode
npm run lint           # ESLint check
npm run lint:fix       # ESLint auto-fix
npm run format         # Prettier format
npm run db:migrate     # Run database migrations
npm run db:cleanup     # Clean old data
```

**Frontend** (in client/):
```bash
npm start              # Development server (port 3000)
npm run build          # Production build
npm run postbuild      # Pre-render with react-snap
npm test               # Run tests
```

---

## Code Patterns & Conventions

### Naming Conventions

- **Files**:
  - Backend: camelCase.js (e.g., `affidavitService.js`)
  - React components: PascalCase.js (e.g., `DocumentPreview.js`)
- **Variables**: camelCase
- **Constants**: UPPER_SNAKE_CASE
- **React Components**: PascalCase
- **Database tables**: snake_case, plural (e.g., `documents`, `user_identities`)
- **Database columns**: snake_case

### Code Style

- **Module system**:
  - Backend: CommonJS (`require`/`module.exports`)
  - Frontend: ES6 (`import`/`export`)
- **Indentation**: 2 spaces
- **Strings**: Single quotes preferred
- **Line length**: ~100 characters max
- **Comments**: JSDoc for functions, inline for complex logic

### API Response Format

**Success**:
```javascript
{
  "success": true,
  "data": { ... },
  "timestamp": "2024-01-01T12:00:00Z"
}
```

**Error**:
```javascript
{
  "success": false,
  "error": "User-friendly message",
  "errorType": "validation_error",
  "requestId": "uuid",
  "timestamp": "2024-01-01T12:00:00Z"
}
```

**Paginated**:
```javascript
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 100,
    "pages": 10
  }
}
```

### Route Pattern

**Standard route structure**:

```javascript
const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../middleware/errorMiddleware');
const { auth0Middleware } = require('../middleware/auth0Middleware');
const { rateLimiter } = require('../middleware/rateLimiting');

// Middleware order: rate limiting → auth → validation → handler
router.post('/endpoint',
  rateLimiter,           // 1. Rate limiting
  auth0Middleware,       // 2. Authentication
  validateInput,         // 3. Input validation
  asyncHandler(async (req, res) => {
    // 4. Business logic
    const result = await someService.doWork(req.user.id, req.body);

    // 5. Response
    res.sendSuccess(result);  // Uses responseHelpers
  })
);

module.exports = router;
```

### Database Query Pattern

**Always use parameterized queries**:

```javascript
// ✅ GOOD - Safe from SQL injection
const result = await pool.query(
  'SELECT * FROM documents WHERE user_id = $1 AND id = $2',
  [userId, documentId]
);

// ❌ BAD - SQL injection vulnerability
const result = await pool.query(
  `SELECT * FROM documents WHERE user_id = ${userId}`  // NEVER DO THIS
);
```

**Transaction pattern**:

```javascript
await dbService.transaction(async (client) => {
  const user = await client.query(
    'INSERT INTO users (...) VALUES (...) RETURNING *',
    [...]
  );

  await client.query(
    'INSERT INTO user_identities (...) VALUES (...)',
    [user.rows[0].id, ...]
  );

  // Auto-commit on success, auto-rollback on error
});
```

### Error Handling Pattern

**Use custom error classes**:

```javascript
const {
  ValidationError,
  AuthenticationError,
  NotFoundError
} = require('../middleware/errorMiddleware');

// In route handlers
if (!documentId) {
  throw new ValidationError('Document ID is required');
}

const doc = await getDocument(documentId);
if (!doc) {
  throw new NotFoundError('Document not found');
}

if (doc.user_id !== req.user.id) {
  throw new AuthorizationError('Access denied');
}
```

**Error classes available**:
- `AppError` - Base class
- `ValidationError` (400)
- `AuthenticationError` (401)
- `AuthorizationError` (403)
- `NotFoundError` (404)
- `RateLimitError` (429)
- `ExternalServiceError` (503)

### React Component Pattern

**Functional components with hooks**:

```javascript
import React, { useState, useEffect, useCallback } from 'react';
import { useDocumentData, useDocumentActions } from '../contexts/DocumentContext';

export default function MyComponent({ initialValue }) {
  // 1. State hooks
  const [localState, setLocalState] = useState(initialValue);

  // 2. Context hooks
  const { currentDocument } = useDocumentData();
  const { saveDocument } = useDocumentActions();

  // 3. Memoized callbacks
  const handleSave = useCallback(async () => {
    await saveDocument(currentDocument.id, localState);
  }, [currentDocument.id, localState, saveDocument]);

  // 4. Effects
  useEffect(() => {
    // Side effects here
  }, [dependencies]);

  // 5. Render
  return (
    <div>
      {/* JSX */}
    </div>
  );
}
```

---

## Authentication & Authorization

### Auth0 Configuration

**Authentication Flow**:

1. User clicks "Sign In" → Redirects to Auth0 Universal Login
2. User authenticates → Auth0 issues JWT
3. Frontend receives JWT → Stores in memory (Auth0 SDK)
4. API requests include `Authorization: Bearer <token>`
5. Backend middleware verifies JWT → Extracts user
6. Route handler accesses `req.user`

### JWT Verification (middleware/auth.js)

**Verification steps**:

1. Extract Bearer token from `Authorization` header
2. Fetch JWKS (JSON Web Key Set) from Auth0
3. Verify JWT signature using public key
4. Validate audience, issuer, algorithm (RS256)
5. Extract `sub` (subject) as auth0_id
6. Look up user in database
7. Attach `req.user`, `req.auth`, `req.userId` to request

**User lookup process**:

```javascript
// Lookup in user_identities table (primary)
const identity = await pool.query(
  'SELECT user_id FROM user_identities WHERE auth0_id = $1',
  [auth0Id]
);

// Fallback to legacy users.auth0_id
if (!identity.rows.length) {
  const user = await pool.query(
    'SELECT id FROM users WHERE auth0_id = $1',
    [auth0Id]
  );
}

// Create new user if doesn't exist
if (!user) {
  await createUser(auth0Id, email, name);
}
```

### Security Fix: Duplicate Email Protection

**CRITICAL**: The codebase previously had an account takeover vulnerability where duplicate email signups would overwrite the existing user's `auth0_id`. This has been fixed.

**Current behavior**:

```javascript
// If user tries to sign up with existing email via different provider
if (error.code === '23505' && error.constraint === 'users_email_key') {
  logger.warn('SECURITY: Blocked duplicate email signup', { email });

  await logAuditEvent(pool, null, 'duplicate_email_signup_blocked', {
    email,
    auth0_id: newAuth0Id,
    provider: extractProvider(newAuth0Id)
  });

  return res.status(409).json({
    success: false,
    error: 'An account with this email already exists. Please sign in using your original authentication method.',
    errorType: 'account_exists'
  });
}
```

**See**: `SECURITY_ANALYSIS_CRITICAL.md` and `CHANGES.md` for full details.

### Authorization Patterns

**Route protection**:

```javascript
// Required authentication
router.get('/documents',
  auth0Middleware,  // Returns 401 if not authenticated
  asyncHandler(async (req, res) => {
    // req.user is guaranteed to exist
  })
);

// Optional authentication
router.get('/public-data',
  optionalAuth,  // Sets req.user if authenticated, null otherwise
  asyncHandler(async (req, res) => {
    // Handle both cases
  })
);
```

**Resource ownership verification**:

```javascript
// ALWAYS verify user owns the resource
const doc = await pool.query(
  'SELECT user_id FROM documents WHERE id = $1',
  [documentId]
);

if (!doc.rows.length) {
  throw new NotFoundError('Document not found');
}

if (doc.rows[0].user_id !== req.user.id) {
  throw new AuthorizationError('Access denied');
}
```

### Multi-Provider Support

The system supports multiple authentication providers via the `user_identities` table:

- `auth0|*` - Email/password
- `google-oauth2|*` - Google
- `facebook|*` - Facebook
- etc.

Users can only have ONE identity per account. Attempting to sign up with a duplicate email using a different provider will be rejected with HTTP 409.

---

## Database

### PostgreSQL Schema

**Core tables**:

1. **users** - User accounts
   - Primary: `id`, `auth0_id`, `email`, `name`
   - Subscription: `subscription_tier`, `documents_remaining`
   - Tracking: `total_documents_created`, `total_amount_spent_cents`
   - TOS: `tos_accepted_at`, `tos_accepted_version`
   - Timestamps: `created_at`, `updated_at`, `last_login`

2. **user_identities** - Multi-provider authentication
   - Links: `user_id` → `users.id`
   - Auth: `auth0_id` (unique), `provider`
   - Status: `is_primary`, `verified`, `last_used_at`

3. **documents** - Affidavit drafts and completed docs
   - Ownership: `user_id` → `users.id`
   - Metadata: `title`, `document_type`, `template_state`
   - Content: `content` (JSONB), `conversation_history` (JSONB)
   - AI: `extraction_metadata`, `validation_results`
   - Status: `status`, `completion_percentage`
   - Payment: `payment_required`, `payment_completed`, `payment_id`
   - PDF: `pdf_generated`, `pdf_file_path`, `pdf_generation_date`

4. **payments** - Payment transactions
   - Links: `user_id`, `document_id`
   - Stripe: `stripe_payment_intent_id`, `stripe_customer_id`
   - Amount: `amount_cents`, `currency`, `status`
   - Minimal PII: `billing_postal_code` only

5. **audit_log** - Security audit trail
   - Who: `user_id`
   - What: `event_type`, `event_category`, `description`
   - When: `created_at`
   - Details: `metadata` (JSONB)

**See**: `database_schema_complete.sql` for full schema.

### Migration System

**How it works**:

1. Migrations stored as numbered SQL files in `/migrations/`
2. Naming: `000_description.sql`, `001_description.sql`, etc.
3. Execution: `npm run db:migrate` runs `scripts/migrate.js`
4. Tracking: `migrations` table records executed migrations
5. Idempotent: Each migration runs exactly once

**Creating a migration**:

```sql
-- migrations/007_add_new_feature.sql

-- Use IF NOT EXISTS for idempotency
ALTER TABLE users
ADD COLUMN IF NOT EXISTS new_field VARCHAR(255);

CREATE TABLE IF NOT EXISTS new_table (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_new_table_user
ON new_table(user_id);
```

**Running migrations**:

```bash
# Locally
npm run db:migrate

# Production (automatic via render.yaml preDeployCommand)
# Runs before each deployment
```

### Database Access Pattern

**Use DatabaseService for resilience**:

```javascript
const { dbService } = require('./services/DatabaseService');

// Standard query (auto-retry on transient errors)
const result = await dbService.query(
  'SELECT * FROM documents WHERE user_id = $1',
  [userId]
);

// Transaction
await dbService.transaction(async (client) => {
  await client.query('INSERT INTO users ...');
  await client.query('INSERT INTO user_identities ...');
  // Auto-commit or rollback
});

// Direct pool access (if needed)
const pool = dbService.pool;
```

### JSONB Fields

**documents.content structure**:

```json
{
  "affiantName": "John Doe",
  "state": "Texas",
  "county": "Travis",
  "facts": [
    {
      "id": "uuid",
      "content": "On January 1, 2024, I witnessed...",
      "category": "event",
      "timestamp": "2024-01-01T12:00:00Z"
    }
  ],
  "caseNumber": "12345",
  "courtName": "District Court of Travis County"
}
```

**documents.conversation_history structure**:

```json
[
  {
    "role": "system",
    "content": "You are a legal assistant..."
  },
  {
    "role": "user",
    "content": "I need to document a car accident"
  },
  {
    "role": "assistant",
    "content": "I can help you with that..."
  }
]
```

---

## AI/LLM Integration

### Multi-Provider Architecture

**Supported providers** (services/MultiProviderLLM.js):

- **OpenAI** (default): GPT-4o, GPT-4 Turbo
- **Google Gemini**: gemini-pro
- **Anthropic**: Claude 3 Sonnet

**Configuration**:

```bash
LLM_PROVIDER=openai  # or gemini, anthropic
LLM_MODEL=gpt-4o-2024-08-06

# Provider-specific API keys
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=...
ANTHROPIC_API_KEY=...
```

**Usage**:

```javascript
const llm = new MultiProviderLLM();

const response = await llm.chat.completions.create({
  model: 'gpt-4o-2024-08-06',
  messages: [
    { role: 'system', content: 'You are a legal assistant.' },
    { role: 'user', content: 'Help me draft an affidavit.' }
  ],
  max_tokens: 1000,
  temperature: 0.7
});

const text = response.choices[0].message.content;
```

### Resilience Patterns

**ResilientOpenAIService features**:

- **Circuit breaker**: Opens after consecutive failures, auto-recovers
- **Retry logic**: Max 3 retries with exponential backoff (1s, 2s, 4s)
- **Timeout handling**: 45s timeout for chat requests
- **Error categorization**: Different handling for rate limits, auth errors, etc.

**Example**:

```javascript
const { ResilientOpenAIService } = require('./services/ResilientOpenAIService');
const openaiService = new ResilientOpenAIService();

try {
  const completion = await openaiService.createChatCompletion({
    model: 'gpt-4o-2024-08-06',
    messages: [...],
    max_tokens: 1000
  });
} catch (error) {
  if (error.type === 'rate_limit') {
    // Retry after error.retryAfter seconds
  } else if (error.type === 'timeout') {
    // Request took too long
  } else {
    // Other error
  }
}
```

### Chat Interface

**Conversation flow** (routes/chat.js + services/affidavitService.js):

1. Client sends message + conversation history + current affidavit data
2. Backend chunks conversation (max 6000 tokens, last 20 messages)
3. Builds system prompt with affidavit context
4. Calls LLM with full context
5. Extracts facts from response
6. Updates affidavit data
7. Returns response + updated data + new facts

**Request format**:

```javascript
POST /api/chat
{
  "message": "I was in a car accident on January 1st",
  "conversationHistory": [
    { role: 'system', content: '...' },
    { role: 'user', content: 'Previous message' },
    { role: 'assistant', content: 'Previous response' }
  ],
  "affidavitData": {
    "affiantName": "John Doe",
    "state": "Texas",
    "facts": [...]
  }
}
```

**Response format**:

```javascript
{
  "success": true,
  "response": "I can help you document that...",
  "affidavitData": { /* updated */ },
  "newFacts": [
    { content: "On January 1, 2024...", category: "event" }
  ],
  "processingTime": 3245,
  "sessionId": "chat_123456_789"
}
```

### Fact Validation

**Enhanced validation** (services/enhancedFactValidationService.js):

Validates each fact for:
- **Legal sufficiency**: First-person knowledge, not hearsay
- **Temporal consistency**: Dates make sense
- **Logical coherence**: No contradictions
- **Specificity**: Concrete details vs vague statements

**Validation result**:

```javascript
{
  isValid: true,
  confidence: 0.85,
  issues: [
    {
      type: 'vague',
      severity: 'warning',
      message: 'Consider adding specific time'
    }
  ],
  suggestions: ['Add exact date and time', 'Use first-person language']
}
```

---

## Payment Processing

### Stripe Integration

**Payment flow**:

1. Client creates payment intent → `POST /api/payment/create-intent`
2. Backend creates Stripe PaymentIntent (server-side pricing)
3. Client collects payment with Stripe Elements
4. Stripe processes payment → Sends webhook to backend
5. Backend webhook updates database → Unlocks document

### Server-Side Pricing (CRITICAL)

**NEVER accept prices from client**:

```javascript
// routes/payment.js
const PRICING_CONFIG = {
  single_affidavit: 7900,      // $79.00 in cents
  family_law_package: 11999,   // $119.99
  all_state_access: 19999      // $199.99
};

// Client sends documentType, server determines price
router.post('/create-intent', auth0Middleware, asyncHandler(async (req, res) => {
  const { documentType } = req.body;

  // ✅ Server-side pricing prevents manipulation
  const amount = PRICING_CONFIG[documentType] || PRICING_CONFIG.single_affidavit;

  const paymentIntent = await stripe.paymentIntents.create({
    amount,  // Server-determined amount
    currency: 'usd',
    customer: stripeCustomerId,
    metadata: { userId, documentId, documentType }
  });

  res.sendSuccess({ clientSecret: paymentIntent.client_secret });
}));
```

### Webhook Handling

**Signature verification** (CRITICAL for security):

```javascript
// routes/payment.js
router.post('/webhook',
  express.raw({ type: 'application/json' }),  // Must use raw body
  asyncHandler(async (req, res) => {
    const sig = req.headers['stripe-signature'];

    // Verify signature
    const event = stripe.webhooks.constructEvent(
      req.rawBody,  // Raw buffer, not parsed JSON
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );

    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentSuccess(event.data.object);
        break;
      case 'payment_intent.payment_failed':
        await handlePaymentFailure(event.data.object);
        break;
    }

    res.json({ received: true });
  })
);
```

**Supported events**:
- `payment_intent.succeeded` - Payment completed
- `payment_intent.payment_failed` - Payment failed
- `payment_intent.canceled` - Payment canceled

### Customer Management

**Auto-create Stripe customers**:

```javascript
// First payment creates customer
let customerId = user.stripe_customer_id;

if (!customerId) {
  const customer = await stripe.customers.create({
    email: user.email,
    metadata: { userId: user.id }
  });

  // Store for future payments
  await pool.query(
    'UPDATE users SET stripe_customer_id = $1 WHERE id = $2',
    [customer.id, user.id]
  );

  customerId = customer.id;
}
```

### Payment States

```
pending → succeeded
        → failed
        → canceled
```

Database tracking:
- `payments.status` - Updated via webhooks
- `documents.payment_status` - Set to 'paid' on success
- `audit_log` - All payment events logged

### Minimal PII Storage

**Only store minimal billing information**:
- Postal code (for tax purposes)
- Last 4 digits of card (for reference)
- NO full card numbers
- NO CVV codes
- Stripe handles all sensitive data

---

## Security Guidelines

### Security Checklist

**ALWAYS**:
- ✅ Use parameterized SQL queries (prevents injection)
- ✅ Verify resource ownership (check `user_id`)
- ✅ Validate all user input (express-validator)
- ✅ Use server-side pricing for payments
- ✅ Verify webhook signatures (Stripe, Auth0)
- ✅ Rate limit all endpoints
- ✅ Sanitize logs (remove passwords, tokens, API keys)
- ✅ Use HTTPS in production
- ✅ Set Content-Security-Policy headers
- ✅ Implement CSRF protection

**NEVER**:
- ❌ Commit `.env` files to git
- ❌ Log sensitive data (passwords, tokens, credit cards)
- ❌ Use string concatenation in SQL queries
- ❌ Accept prices from client
- ❌ Trust client-side data for authorization
- ❌ Use `eval()` or `Function()` constructor
- ❌ Allow HTML injection without sanitization
- ❌ Expose internal error details to users
- ❌ Skip authentication/authorization checks
- ❌ Use weak session secrets

### Security Measures in Place

**1. Authentication**:
- Auth0 JWT verification (RS256)
- Token expiry validation
- User ownership verification
- Duplicate email protection (prevents account takeover)

**2. CSRF Protection**:
- Origin/Referer validation (middleware/csrfProtection.js)
- Whitelisted origins (matches CORS config)
- Skipped for webhooks (have signature verification)

**3. Input Validation**:
- Express-validator on all inputs
- Max length limits
- Type validation
- Sanitization (removes HTML/scripts)

**4. Rate Limiting**:
- Standard: 100 req/15min
- Strict: 20 req/15min (sensitive endpoints)
- Chat: 50 msg/15min
- Payment: 5 attempts/hour
- PDF: 10 generations/hour
- Auth: 10 attempts/15min

**5. Content Security Policy**:
- Restricts script sources
- Blocks inline scripts (except dev)
- Allows only trusted domains
- Prevents clickjacking

**6. Secrets Management**:
- Environment variables only
- API key hashing in database
- Webhook signature verification
- Log sanitization

**7. Database Security**:
- Parameterized queries
- Connection pooling with limits
- Minimal PII storage
- Audit logging

**8. Payment Security**:
- Server-side pricing
- Stripe PCI compliance
- Webhook signature verification
- Idempotent webhook handling

### Known Security Issues

**FIXED**: Account takeover vulnerability via duplicate email signup (see `SECURITY_ANALYSIS_CRITICAL.md` and `CHANGES.md`)

**Current status**: The system now properly rejects duplicate email signups with HTTP 409 and logs the attempt to the audit log.

---

## Testing

### Test Structure

```
__tests__/                # Backend tests
├── api/                  # Route tests
├── middleware/           # Middleware tests
├── services/             # Service tests
└── utils/                # Utility tests

client/src/**/__tests__/  # Frontend component tests
```

### Running Tests

```bash
# Backend tests
npm test                  # All tests with coverage
npm run test:watch        # Watch mode

# Frontend tests
cd client && npm test
```

### Test Patterns

**Backend route test**:

```javascript
const request = require('supertest');
const app = require('../server');

describe('POST /api/documents/preview', () => {
  it('generates preview for valid affidavit data', async () => {
    const response = await request(app)
      .post('/api/documents/preview')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ affidavitData: mockData })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.preview).toBeDefined();
  });

  it('returns 401 without auth', async () => {
    await request(app)
      .post('/api/documents/preview')
      .send({ affidavitData: mockData })
      .expect(401);
  });
});
```

**Frontend component test**:

```javascript
import { render, screen } from '@testing-library/react';
import DocumentPreview from '../DocumentPreview';

describe('DocumentPreview', () => {
  it('renders preview sections', () => {
    render(<DocumentPreview preview={mockPreview} />);
    expect(screen.getByText(/AFFIDAVIT/i)).toBeInTheDocument();
  });
});
```

### Coverage Requirements

**jest.config.js**:
```javascript
coverageThreshold: {
  global: {
    branches: 25,
    functions: 35,
    lines: 45,
    statements: 45
  }
}
```

---

## Deployment

### Render.com Deployment

**Configuration**: `render.yaml`

**Services**:
1. Web service (Docker)
2. PostgreSQL database

**Build process**:
1. Build Docker image (includes frontend build)
2. Run migrations (`node scripts/migrate.js`)
3. Start Express server
4. Health check on `/health`

**Environment variables**: Set in Render dashboard (see `DEPLOYMENT.md`)

**CRITICAL**: Frontend build requires `REACT_APP_*` variables as build arguments:
- `REACT_APP_AUTH0_DOMAIN`
- `REACT_APP_AUTH0_CLIENT_ID`
- `REACT_APP_AUTH0_AUDIENCE`
- `REACT_APP_STRIPE_PUBLISHABLE_KEY`

These get baked into the JavaScript bundle during build.

### Docker Build

**Dockerfile highlights**:
- Multi-stage build
- Node 18 LTS (bullseye-slim)
- Chromium for react-snap pre-rendering
- Build args for React env vars
- Health check endpoint

**Building locally**:

```bash
docker build \
  --build-arg REACT_APP_AUTH0_DOMAIN=... \
  --build-arg REACT_APP_AUTH0_CLIENT_ID=... \
  --build-arg REACT_APP_AUTH0_AUDIENCE=... \
  --build-arg REACT_APP_STRIPE_PUBLISHABLE_KEY=... \
  -t affidavit-maker .
```

### Post-Deployment Configuration

**1. Auth0**:
- Add callback URLs: `https://your-app.onrender.com/callback`
- Add logout URLs: `https://your-app.onrender.com`
- Add web origins: `https://your-app.onrender.com`

**2. Stripe**:
- Add webhook endpoint: `https://your-app.onrender.com/api/payment/webhook`
- Listen for: `payment_intent.succeeded`, `payment_intent.payment_failed`
- Copy webhook secret to `STRIPE_WEBHOOK_SECRET`

**See**: `DEPLOYMENT.md` for full deployment guide.

---

## Common Tasks

### Adding a New API Route

1. **Create route file** in `routes/`:

```javascript
// routes/myFeature.js
const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../middleware/errorMiddleware');
const { auth0Middleware } = require('../middleware/auth0Middleware');
const { rateLimiter } = require('../middleware/rateLimiting');

router.post('/my-endpoint',
  rateLimiter,
  auth0Middleware,
  asyncHandler(async (req, res) => {
    // Business logic
    res.sendSuccess({ result: 'data' });
  })
);

module.exports = router;
```

2. **Register in server.js**:

```javascript
const myFeatureRoutes = require('./routes/myFeature');
app.use('/api/my-feature', myFeatureRoutes);
```

3. **Add tests** in `__tests__/api/myFeature.test.js`

### Adding a New Service

1. **Create service file** in `services/`:

```javascript
// services/myService.js
const logger = require('../utils/logger');
const { dbService } = require('./DatabaseService');

class MyService {
  constructor() {
    this.pool = dbService.pool;
  }

  async doSomething(userId, data) {
    logger.info('Doing something', { userId });

    const result = await this.pool.query(
      'SELECT * FROM table WHERE user_id = $1',
      [userId]
    );

    return result.rows;
  }
}

module.exports = new MyService();
```

2. **Use in routes**:

```javascript
const myService = require('../services/myService');

router.get('/data', auth0Middleware, asyncHandler(async (req, res) => {
  const data = await myService.doSomething(req.user.id, req.body);
  res.sendSuccess(data);
}));
```

### Adding a Database Migration

1. **Create migration file**:

```bash
# migrations/008_add_my_feature.sql
ALTER TABLE users
ADD COLUMN IF NOT EXISTS new_field VARCHAR(255);

CREATE TABLE IF NOT EXISTS new_table (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  data JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_new_table_user
ON new_table(user_id);
```

2. **Run migration**:

```bash
npm run db:migrate
```

3. **Verify**:

```bash
psql $DATABASE_URL -c "\d new_table"
```

### Adding a React Component

1. **Create component** in `client/src/components/`:

```javascript
// client/src/components/MyComponent.js
import React from 'react';

export default function MyComponent({ prop1, prop2 }) {
  return (
    <div className="my-component">
      {/* JSX */}
    </div>
  );
}
```

2. **Add styles** if needed (inline or separate CSS file)

3. **Import and use**:

```javascript
import MyComponent from './components/MyComponent';

function App() {
  return <MyComponent prop1="value" />;
}
```

### Working with LLM Providers

**Switching providers**:

```bash
# .env
LLM_PROVIDER=gemini  # or openai, anthropic
LLM_MODEL=gemini-pro
GEMINI_API_KEY=your-key
```

**Adding a new provider**:

1. Edit `services/MultiProviderLLM.js`
2. Add provider case in `getClient()`
3. Implement provider-specific client
4. Update documentation

---

## Troubleshooting

### Common Issues

**1. "Database pool not available"**

**Cause**: `app.locals.pool` not set before routes load
**Fix**: Ensure database initialization happens before route imports in `server.js`

```javascript
// server.js
const { dbService } = require('./services/DatabaseService');
app.locals.pool = dbService.pool;  // Must be before route imports
```

**2. Auth0 JWT verification fails**

**Checks**:
- ✅ `AUTH0_DOMAIN`, `AUTH0_AUDIENCE`, `AUTH0_ISSUER_BASE_URL` match
- ✅ JWKS endpoint reachable: `https://{domain}/.well-known/jwks.json`
- ✅ Token not expired
- ✅ Algorithm is RS256

**3. Stripe webhook signature fails**

**Checks**:
- ✅ Using `req.rawBody` (not parsed JSON)
- ✅ `STRIPE_WEBHOOK_SECRET` matches dashboard
- ✅ Webhook route not parsed by `express.json()`

**Fix in server.js**:
```javascript
app.use((req, res, next) => {
  if (req.originalUrl === '/api/payment/webhook') {
    req.rawBody = '';
    req.on('data', chunk => { req.rawBody += chunk; });
  }
  next();
});
```

**4. CORS errors**

**Checks**:
- ✅ Origin matches `allowedOrigins` in `server.js`
- ✅ `FRONTEND_URL` set correctly
- ✅ No trailing slashes in URLs

**5. Chat requests timeout**

**Checks**:
- ✅ OpenAI API key valid
- ✅ `LLM_PROVIDER` configured correctly
- ✅ Conversation history not too long (max 6000 tokens)

**6. PDF generation fails**

**Checks**:
- ✅ Facts are normalized (use `factNormalizer.js`)
- ✅ Template state (TX/UT/AZ) exists
- ✅ `documents/` directory writable

**7. Frontend shows "undefined" for Auth0**

**Cause**: Frontend build missing `REACT_APP_*` environment variables
**Fix**: Set build args in Render dashboard and trigger rebuild

**8. "User sees other people's affidavits"**

**Status**: FIXED (see `SECURITY_ANALYSIS_CRITICAL.md`)
**Previous cause**: Account takeover via duplicate email signup
**Current**: Duplicate emails properly rejected with HTTP 409

### Debugging Tips

**Backend logs**:
```bash
# Local
tail -f logs/app.log

# Render
# Dashboard → Logs tab
```

**Database queries**:
```bash
# Local
psql $DATABASE_URL

# Check migrations
SELECT * FROM migrations ORDER BY executed_at DESC;

# Check audit log
SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 10;

# Check user identities
SELECT u.email, ui.auth0_id, ui.provider
FROM users u
JOIN user_identities ui ON u.id = ui.user_id;
```

**Test API endpoints**:
```bash
# Get auth token from browser dev tools (Application → Local Storage)
export TOKEN="your-jwt-token"

# Test endpoint
curl -H "Authorization: Bearer $TOKEN" \
     http://localhost:3001/api/documents
```

---

## Key Files Reference

**Most important files for understanding the codebase**:

**Backend Core**:
- `/server.js` - Application entry point, middleware setup
- `/services/DatabaseService.js` - Database connection
- `/middleware/auth.js` - Auth0 JWT verification (primary)
- `/middleware/errorMiddleware.js` - Error handling
- `/routes/documents.js` - Document operations
- `/routes/payment.js` - Stripe integration

**Frontend Core**:
- `/client/src/App.js` - Root component, routing
- `/client/src/contexts/DocumentContext.js` - State management
- `/client/src/components/AffidavitForm.js` - Main editor
- `/client/src/components/DocumentPreview.js` - Preview renderer

**AI/LLM**:
- `/services/MultiProviderLLM.js` - Multi-provider wrapper
- `/services/ResilientOpenAIService.js` - Circuit breaker
- `/services/affidavitService.js` - Chat processing

**Configuration**:
- `.env.example.sh` - Environment variables reference
- `render.yaml` - Deployment config
- `Dockerfile` - Container build
- `database_schema_complete.sql` - Database structure

**Documentation**:
- `DEPLOYMENT.md` - Deployment guide
- `SECURITY_ANALYSIS_CRITICAL.md` - Security vulnerability analysis
- `CHANGES.md` - Recent changes and fixes
- `TEMPLATE_REFACTORING_PLAN.md` - Template system refactoring

---

## Additional Resources

**External Documentation**:
- Auth0: https://auth0.com/docs
- Stripe: https://stripe.com/docs
- OpenAI: https://platform.openai.com/docs
- PostgreSQL: https://www.postgresql.org/docs/
- React: https://react.dev/
- Express: https://expressjs.com/

**Internal Documentation**:
- `/migrations/README.md` - Migration guide
- `/templates/README.md` - Template system
- `/templates/ADDING_A_STATE.md` - Adding new state templates
- `/docs/` - Additional documentation

---

## Getting Help

**For AI assistants working on this codebase**:

1. **Read this file first** - It covers 90% of common tasks
2. **Check security guidelines** - Especially before modifying auth or payment code
3. **Follow existing patterns** - Don't reinvent the wheel
4. **Test thoroughly** - Especially auth, payments, and data access
5. **Document changes** - Update this file if you add new patterns

**Red flags that require extra caution**:
- 🚩 Modifying authentication logic
- 🚩 Changing payment processing
- 🚩 Altering database queries (SQL injection risk)
- 🚩 Adding new external API calls
- 🚩 Changing CORS or CSP configuration
- 🚩 Modifying user ownership checks

**When in doubt**:
- ✅ Ask the user for clarification
- ✅ Reference existing code as examples
- ✅ Add tests for new functionality
- ✅ Check logs for errors
- ✅ Review security implications

---

**End of CLAUDE.md**
