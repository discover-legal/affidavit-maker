# CLAUDE.md - AI Assistant Guide for Affidavit Maker

**Last Updated**: 2026-03-13
**Version**: 4.0.0

---

## Quick Reference

**Essential Commands**:
```bash
npm run dev           # Start backend (port 3001)
npm run client        # Start frontend (port 3000)
npm run dev:full      # Start both concurrently
npm test              # Run tests with coverage
npm run db:migrate    # Run database migrations
npm run lint:fix      # Auto-fix linting issues
```

**Jurisdictions**: 110 total directories in `templates/states/`
- **North America (64)**: 51 US (all 50 states + DC) + 13 CA (10 provinces + 3 territories)
- **International (46, behind `ENABLE_INTERNATIONAL` flag)**: UK (ENG, SCO, NIR), Ireland, New Zealand, Australia (8 states/territories), Singapore, Hong Kong, South Africa, Kenya, Ghana, Nigeria (12 jurisdictions), India (16 jurisdictions)

**Live URL**: `https://discover.legal` (canonical). The same SPA also serves `www.discover.legal` (301 → apex), `make.discover.legal` (legacy alias), `ca.discover.legal`, and `canada.discover.legal`. Marketing, app, and resources are all served by the React SPA — there is no separate marketing host.

**Key Directories**:
- `/routes/` - API endpoints (11 route files incl. `cases.js`, `catalog.js`)
- `/services/` - Business logic
- `/services/agents/` - 134 orchestrator/agent files (divorce orchestrators per jurisdiction + 16 matter orchestrators)
- `/middleware/` - Auth, validation, error handling
- `/templates/states/` - Jurisdiction-specific templates (110 directories)
- `/config/` - Feature flags (`jurisdictions.js`)
- `/client/src/components/` - React components

**Critical Security Notes**:
- Always use parameterized SQL queries
- Verify resource ownership (`user_id`) on all operations
- Server-side pricing only (never trust client prices)
- RLS enabled at database level for data isolation

---

## Project Overview

A **full-stack web application** at `discover.legal` that helps users create legally-compliant legal documents using AI assistance. The React SPA serves both marketing (landing page, resources, articles, brand, legal pages) and the authenticated app (dashboard, editor) — there is no separate marketing host.

Users can:
- Chat with an AI assistant to document facts
- Generate jurisdiction-specific affidavits (all 50 US states + DC, 13 Canadian provinces/territories)
- Create divorce petitions, divorce decrees, and other family law documents
- Access 16+ civil/family law matter types (custody, child support, DVRO, paternity, etc.)
- Validate facts for legal sufficiency
- Upload supporting evidence
- Generate professional PDFs
- Save and manage multiple documents and cases

### Tech Stack

**Backend**:
- Node.js + Express 4.21.2
- PostgreSQL (via pg 8.16.3)
- Auth0 (JWT authentication)
- OpenAI GPT-4 (with multi-provider support: OpenAI, Gemini, Anthropic)
- Stripe (payments)
- PDFKit + pdf-lib (PDF generation)

**Frontend**:
- React 18.2.0
- React Router DOM 7.x
- Tailwind CSS
- Auth0 React SDK 2.2.0
- Stripe React SDK 2.4.0
- React Helmet Async (meta tag management)
- Lucide React (icons)
- CRACO (CRA config override — needed for ESM package handling)

**Pre-rendering**: `react-snap` (devDependency) runs as a `postbuild` step. It uses headless Chromium to snapshot the public marketing routes (`/`, `/resources`, each `/resources/:slug`, `/privacy`, `/tos`, `/brand`) into static HTML at build time. The list lives in `client/package.json` under `reactSnap.include` — keep it in sync with `PRE_RENDERED_ROUTES` in `client/src/index.js`. Helmet meta tags (title, description, canonical, OG, Twitter, JSON-LD) are present per route; pre-rendering means crawlers see them without executing JS.

**Deployment**:
- Docker on Render.com (branch: `main`)
- PostgreSQL managed database (`affidavit-db`)
- `FRONTEND_URL=https://discover.legal`

---

## Architecture

**Monolithic full-stack**: Express serves both the REST API (`/api/*`) and the React SPA (`client/build/`).

### Request Flow

```
Browser → Auth0 (if unauthenticated) → React SPA
         → API call (/api/*)
         → Express middleware chain
           (trust proxy → request ID → response helpers →
            www redirect → helmet → CORS → compression →
            body parsing → morgan → CSRF → rate limiting)
         → Route handler → Auth middleware → Validation → Service → DB → Response
```

### Allowed Origins (CORS + CSRF + CSP)

All three configs (`server.js`, `middleware/csrfProtection.js`, `middleware/validation.js`) must stay in sync:
- `https://discover.legal` (canonical)
- `https://www.discover.legal`
- `https://make.discover.legal` (legacy alias)
- `https://ca.discover.legal` / `https://canada.discover.legal`

**If adding a new domain**, update all three files.

---

## Directory Structure

```
affidavit-maker/
├── server.js                    # Express app entry point
├── package.json                 # Backend dependencies
├── Dockerfile                   # Container build (installs Chromium for react-snap prerender)
├── render.yaml                  # Render.com deployment config
├── .env.example.sh              # Environment variable template
│
├── middleware/
│   ├── auth.js                  # Auth0 JWT verification (primary)
│   ├── auth0Middleware.js       # Auth wrapper
│   ├── csrfProtection.js        # CSRF — hardcoded allowed origins here
│   ├── errorMiddleware.js       # Error handling + custom error classes
│   ├── rateLimiting.js          # Rate limiters
│   └── validation.js            # Input validation + secondary CSP config
│
├── config/
│   └── jurisdictions.js         # Feature flags (ENABLE_INTERNATIONAL)
│
├── routes/
│   ├── auth.js                  # Legacy auth routes
│   ├── auth0-webhooks.js        # Auth0 lifecycle webhooks
│   ├── cases.js                 # Case profile CRUD (GET/POST/PUT /api/cases)
│   ├── catalog.js               # Matter/document type catalog (/api/catalog)
│   ├── chat.js                  # AI chat interface (country-aware routing)
│   ├── documents.js             # Document CRUD, preview, PDF
│   ├── evidence.js              # Evidence/exhibit uploads
│   ├── factRoutes.js            # Fact validation
│   ├── payment.js               # Stripe payment intents/webhooks
│   ├── templates.js             # Template metadata
│   └── validation.js            # Enhanced validation endpoint
│
├── services/
│   ├── DatabaseService.js       # PostgreSQL connection pool
│   ├── MultiProviderLLM.js      # OpenAI/Gemini/Anthropic wrapper
│   ├── ResilientOpenAIService.js # Circuit breaker, retry logic
│   ├── affidavitService.js      # Core affidavit/chat processing
│   ├── courtNameService.js      # Court name validation
│   ├── documentService.js       # Document business logic
│   ├── enhancedFactValidationService.js
│   ├── evidenceStorage.js       # File storage management
│   ├── pdfService.js            # Two-pass PDF generation
│   ├── previewRenderer.js       # HTML preview rendering
│   └── agents/                  # 134 files
│       ├── BaseMatterOrchestrator.js   # Base class for all matter orchestrators
│       ├── [XX]DivorceOrchestrator.js  # Per-jurisdiction divorce orchestrators (110)
│       ├── AdoptionOrchestrator.js     # Matter-type orchestrators (16)
│       ├── CustodyOrchestrator.js
│       ├── ChildSupportOrchestrator.js
│       ├── DVROOrchestrator.js
│       ├── PaternityOrchestrator.js
│       ├── LegalSeparationOrchestrator.js
│       ├── AnnulmentOrchestrator.js
│       ├── GuardianshipOrchestrator.js
│       ├── EmancipationOrchestrator.js
│       ├── SmallClaimsOrchestrator.js
│       ├── NameChangeOrchestrator.js
│       ├── DebtDefenseOrchestrator.js
│       ├── LandlordTenantOrchestrator.js
│       ├── CivilHarassmentOrchestrator.js
│       ├── GeneralCivilOrchestrator.js
│       ├── ProbateOrchestrator.js
│       ├── DocumentSelectionAgent.js
│       ├── FactOrganizer.js
│       └── AffidavitRequirementsChecker.js
│
├── templates/
│   ├── StateTemplateManager.js  # Master template coordinator
│   ├── initialize.js            # Auto-discovery loader
│   ├── core/
│   │   ├── BaseAffidavitTemplate.js
│   │   ├── TemplateRegistry.js
│   │   ├── TemplateLoader.js
│   │   └── validateMetadata.js
│   └── states/                  # 110 jurisdiction directories
│       └── [jurisdiction]/
│           ├── metadata.json
│           ├── divorce-metadata.json
│           ├── AffidavitTemplate.js
│           ├── DivorcePetitionTemplate.js
│           ├── DivorceDecreeTemplate.js
│           └── prompts/[xx]Divorce/index.js
│
├── utils/
│   ├── logger.js                # Winston structured logging
│   ├── factNormalizer.js        # Fact format normalization
│   ├── pathSecurity.js          # Path traversal prevention
│   └── responseHelpers.js       # Standard API responses
│
├── migrations/                  # 13 SQL migrations
│   ├── 000_initial_schema.sql
│   ├── 010_enable_rls_all_tables.sql  # Row Level Security
│   ├── 011_webhook_idempotency.sql
│   ├── 012_add_cases_table.sql        # Case profiles with RLS
│   └── 013_document_catalog.sql       # Matter/doc types, interview phases
│
├── scripts/
│   ├── migrate.js
│   └── cleanDatabase.js
│
├── __tests__/
│   ├── api/endpoints.test.js
│   ├── middleware/
│   ├── security/rls.test.js
│   ├── services/
│   ├── templates/
│   └── utils/
│
└── client/
    ├── package.json
    ├── craco.config.js          # Webpack ESM fix (fullySpecified: false)
    ├── public/
    │   ├── index.html
    │   ├── gtm.js               # Google Analytics init
    │   ├── manifest.json
    │   ├── robots.txt
    │   └── sitemap.xml
    └── src/
        ├── index.js             # createRoot only (no hydration)
        ├── App.js               # Root component, routing
        ├── components/          # 26+ React components
        ├── contexts/            # DocumentContext, TOSContext
        ├── hooks/               # useAffidavitData, useCountyValidation, useSaveDocument
        ├── services/authService.js
        ├── utils/               # analytics.js, factNormalizer.js
        ├── views/EditorView.js
        └── content/             # termsOfService.js, privacyPolicy.js
```

---

## Development Setup

### Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0
- PostgreSQL >= 12
- Auth0 account
- OpenAI API key (or Gemini/Anthropic)
- Stripe account

### Setup

```bash
git clone <repo-url> && cd affidavit-maker
npm install
cd client && npm install && cd ..
createdb affidavit_maker
cp .env.example.sh .env   # fill in credentials
npm run db:migrate
```

### Environment Variables

**Backend (.env)**:
```bash
NODE_ENV=development
PORT=3001
DATABASE_URL=postgresql://localhost:5432/affidavit_maker
AUTH0_DOMAIN=your-tenant.auth0.com
AUTH0_CLIENT_ID=...
AUTH0_CLIENT_SECRET=...
AUTH0_AUDIENCE=https://your-api-identifier
AUTH0_WEBHOOK_SECRET=whsec_...
LLM_PROVIDER=openai         # or gemini, anthropic
LLM_MODEL=gpt-4o-2024-08-06
OPENAI_API_KEY=sk-...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
FRONTEND_URL=http://localhost:3000
SESSION_SECRET=change-this
TRUSTED_PROXIES=1
ENABLE_INTERNATIONAL=false  # Set true to activate ~110 international jurisdictions
```

**Frontend (client/.env)**:
```bash
REACT_APP_API_URL=           # empty = relative URLs (proxies to :3001 in dev)
REACT_APP_AUTH0_DOMAIN=your-tenant.auth0.com
REACT_APP_AUTH0_CLIENT_ID=...
REACT_APP_AUTH0_AUDIENCE=https://your-api-identifier
REACT_APP_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

---

## Code Patterns & Conventions

- **Backend**: CommonJS (`require`/`module.exports`), camelCase files
- **Frontend**: ES6 modules, PascalCase component files
- **DB tables/columns**: snake_case
- **Indentation**: 2 spaces, single quotes

### API Response Format

```javascript
// Success
{ "success": true, "data": { ... }, "timestamp": "..." }

// Error
{ "success": false, "error": "...", "errorType": "...", "requestId": "...", "timestamp": "..." }
```

### Route Pattern

```javascript
router.post('/endpoint',
  rateLimiter,
  auth0Middleware,
  validateInput,
  asyncHandler(async (req, res) => {
    const result = await someService.doWork(req.user.id, req.body);
    res.sendSuccess(result);
  })
);
```

### Database — Always Parameterized

```javascript
// ✅ GOOD
await pool.query('SELECT * FROM documents WHERE user_id = $1 AND id = $2', [userId, docId]);

// ❌ NEVER
await pool.query(`SELECT * FROM documents WHERE user_id = ${userId}`);
```

### Error Classes

`AppError`, `ValidationError` (400), `AuthenticationError` (401), `AuthorizationError` (403), `NotFoundError` (404), `RateLimitError` (429), `ExternalServiceError` (503)

---

## Authentication & Authorization

**Flow**: Auth0 Universal Login → JWT issued → frontend stores in memory → `Authorization: Bearer <token>` on API requests → backend verifies RS256 JWT → looks up user via `user_identities` table → attaches `req.user`.

**Resource ownership**: Always verify `doc.user_id === req.user.id` before returning/modifying data.

**Duplicate email protection**: Signing up with an existing email via a different provider returns HTTP 409 (prevents account takeover).

---

## Database

**Core tables**: `users`, `user_identities`, `documents`, `cases`, `payments`, `audit_log`, `processed_webhooks`, `document_catalog`, `interview_phases`

**RLS**: Row Level Security enabled (migration 010) — database-level isolation.

**Migrations**: Numbered SQL files in `/migrations/`. Run with `npm run db:migrate`. Each runs exactly once via the `migrations` tracking table.

**JSONB fields**:
- `documents.content` — `{ affiantName, state, county, facts[], caseNumber, courtName }`
- `documents.conversation_history` — `[{ role, content }]`

---

## AI/LLM Integration

**Providers**: OpenAI (default), Gemini, Anthropic — configured via `LLM_PROVIDER` env var.

**Resilience** (`ResilientOpenAIService`): circuit breaker, 3 retries with exponential backoff, 45s timeout.

**Chat flow**: message + history + affidavit data → chunk to 6000 tokens / last 20 messages → LLM → extract facts → return response + updated data.

---

## Template System

**Auto-discovery**: `templates/initialize.js` scans `templates/states/` on startup — no manual registration needed. Always registry mode (no legacy `USE_NEW_TEMPLATE_SYSTEM` flag).

**Each jurisdiction has up to 7 files**:
1. `metadata.json` — general legal requirements
2. `divorce-metadata.json` — divorce-specific requirements (grounds, fees, waiting periods)
3. `AffidavitTemplate.js` — extends `BaseAffidavitTemplate`
4. `DivorcePetitionTemplate.js` — divorce petition generation
5. `DivorceDecreeTemplate.js` — divorce decree generation
6. `[XX]DivorceOrchestrator.js` — in `services/agents/`, interview flow for that jurisdiction
7. `prompts/[xx]Divorce/index.js` — LLM prompts for divorce interviews

**Adding a jurisdiction**:
1. `mkdir templates/states/[jurisdiction-name]`
2. Create the template files above (at minimum `metadata.json` + `AffidavitTemplate.js`)
3. For divorce support: add all 7 files + the orchestrator in `services/agents/`
4. Add tests in `__tests__/templates/states/[jurisdiction-name]/`
5. For international jurisdictions: add to `config/jurisdictions.js` mapping

**Feature flag**: `ENABLE_INTERNATIONAL=false` (default) hides non-NA jurisdictions. Gated at:
- `TemplateLoader` — skips international directories
- `catalog.js` — filters `ALL_JURISDICTIONS`
- `chat.js` — clamps `detectCountry()` to US/CA

**Country-aware routing**: `detectCountry()` in `chat.js` uses subdomain and `countryCode` to default to ON (Ontario) for Canadian users, TX for US users.

---

## Payment Processing

**Server-side pricing only** — client sends `documentType`, server looks up price from `PRICING_CONFIG`. Never accept amounts from the client.

**Webhook security**: verify `stripe-signature` header using raw body buffer (`req.rawBody`), not parsed JSON.

**Idempotency**: `processed_webhooks` table (migration 011) prevents duplicate processing.

---

## Security

**Always**:
- Parameterized SQL queries
- Verify `user_id` ownership on every resource operation
- Server-side pricing
- Verify webhook signatures (Stripe, Auth0)
- Rate limit all endpoints

**Never**:
- Commit `.env` files
- Log passwords, tokens, card numbers
- String concatenate SQL
- Trust client-supplied prices or IDs for authorization

**Rate limits**: Standard 100/15min, Strict 20/15min, Chat 50/15min, Payment 5/hour, PDF 10/hour, Auth 10/15min.

---

## Deployment

**Platform**: Render.com, Docker, branch `main`

**Build process**:
1. Docker build (installs deps, runs `craco build`)
2. Pre-deploy: `node scripts/migrate.js`
3. Start: `node server.js`
4. Health check: `/health`

**Chromium in Docker** — installed via apt for react-snap's headless prerender. `PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true` and `PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium` point Puppeteer at the system Chromium so the build doesn't try to download its own (which fails on Render).

**REACT_APP_* vars are baked into the JS bundle at build time** via Docker `--build-arg`. If they change, a full redeploy is required.

**Custom domains** (all on the same Render service): `discover.legal` (apex, canonical), `www.discover.legal` (301 → apex), `make.discover.legal` (legacy alias), `ca.discover.legal`, `canada.discover.legal`. See `docs/DNS_SETTINGS.md`.

**Auth0 required URLs**:
- Allowed Callback URLs: `https://discover.legal`, `https://make.discover.legal` (and `/callback` paths if the redirect_uri is updated)
- Allowed Logout URLs:   `https://discover.legal`, `https://make.discover.legal`
- Allowed Web Origins:   `https://discover.legal`, `https://make.discover.legal`

---

## Troubleshooting

**White/blank page**: Check Render build logs. If Docker build failed, the old container stays live. Most common cause is react-snap failing during `postbuild` — usually a missing Chromium dep, a route in `reactSnap.include` that throws on render, or Auth0/Stripe network calls timing out. Check the Docker apt install step and the prerender output.

**Hydration mismatch warnings in console**: If the static HTML produced by react-snap doesn't match what React renders on hydrate, you'll see a mismatch warning. Usually caused by code that branches on `window`, `navigator.userAgent`, or `Date.now()` during render. Move that logic into `useEffect` so it only runs client-side.

**"Unexpected token 'export'"**: ESM package not handled by webpack. Fix is in `craco.config.js` (`fullySpecified: false`). If a new ESM-only package is added, it's handled automatically.

**Auth0 JWT fails**: Check `AUTH0_DOMAIN`, `AUTH0_AUDIENCE` match. Verify JWKS endpoint is reachable. Token must not be expired. Algorithm must be RS256.

**Stripe webhook 400**: Must use raw body (`req.rawBody`), not parsed JSON. `STRIPE_WEBHOOK_SECRET` must match Render env var, not local `.env`.

**CORS blocked**: `discover.legal` (and any subdomain you serve) must be in all three places: `server.js` `getAllowedOrigins()`, `middleware/csrfProtection.js`, `middleware/validation.js` `connectSrc`.

**"Database pool not available"**: `app.locals.pool` must be set before routes load — it is, at line `app.locals.pool = dbService.pool` in `server.js`.

**PDF generation fails**: Check facts are normalized, template jurisdiction is recognized, `documents/` dir is writable. Note: PDFService currently only handles affidavit-style layouts; international A4 options are defined but not yet wired up.

---

## Version History

### v4.2.0 (2026-05-04) — current branch
- **SEO**: Restored react-snap pre-rendering. The 11 public marketing routes are snapshotted at build time so crawlers see real HTML without executing JS. Hydration logic is back in `client/src/index.js`; PaymentModal and `gtm.js` once again skip themselves under the prerender user-agent. Dockerfile reinstalls Chromium + libs and points Puppeteer at it via `PUPPETEER_EXECUTABLE_PATH`.
- **Sitemap generator**: `client/scripts/generate-sitemap.js` now uses `https://discover.legal` as the canonical base.

### v4.1.0 (2026-05-04)
- **Hosting consolidation**: Retired Webflow. The Render-hosted SPA now serves marketing + app from `https://discover.legal` (canonical apex). `www`, `make`, `ca`, and `canada` subdomains all point to the same service.
- **Routing**: `/` now renders `LandingPage` (the existing component, already wired with Helmet + structured data) for unauthenticated visitors and shows a "Dashboard" CTA for logged-in users. Auth0 callbacks at `/?code=&state=…` are still detected and deferred to the loading handler. Catch-all `*` redirects to `/`.
- **Canonicalization**: All canonical URLs, sitemap, and robots.txt now use `https://discover.legal`. `FRONTEND_URL` env var updated.
- **DNS**: New `docs/DNS_SETTINGS.md` documents the single-SPA zone (apex via ALIAS/ANAME or A `216.24.57.1`, plus CNAMEs for `www`, `make`, `ca`, `canada`).
- **SEO**: SPA-only — search engines must client-render. Helmet meta tags (title, description, canonical, OG, Twitter, JSON-LD) are present on every public route. Pre-rendering / SSR is intentionally deferred.

### v4.0.0 (2026-03-13)
- **Jurisdictions**: Expanded from 7 to 110 directories (64 NA + 46 international)
  - All 50 US states + DC with full divorce support
  - 13 Canadian provinces/territories (10 provinces + NT, YT, NU)
  - Wave 1 international: UK, Ireland, NZ, Australia, Singapore, Hong Kong, South Africa, Kenya, Ghana, Nigeria, India
- **Divorce orchestration**: Per-jurisdiction interview orchestrators with state-specific legal requirements
- **Matter types**: 16 civil/family law orchestrators (custody, child support, DVRO, paternity, legal separation, annulment, guardianship, adoption, emancipation, small claims, name change, debt defense, landlord-tenant, civil harassment, general civil, probate)
- **Catalog API**: In-memory catalog at `/api/catalog/matters` and `/api/catalog/states/:state/matters`
- **Cases**: New `cases` table (migration 012) with RLS for case profile management
- **Document catalog**: DB-backed catalog (migration 013) for matter/doc types and interview phases
- **Triage orchestrator**: Routes users to correct matter type when intent is unknown
- **Country-aware routing**: `detectCountry()` defaults Canadian users to ON, US users to TX
- **Feature flag**: `ENABLE_INTERNATIONAL=false` gates non-NA jurisdictions
- **Security**: `pathSecurity.js` path traversal prevention utility
- **Legal audit**: 160+ corrections across 130 files (filing fees, statute citations, waiting periods, court names)

### v3.2.0 (2026-03-02)
- **Deployment**: App moved to `make.discover.legal`; landing page migrated to Webflow
- **Build**: Removed react-snap and Chromium/Puppeteer from Docker — faster builds, no more build failures
- **Build**: Added CRACO webpack config to handle ESM-only packages (react-markdown v10+)
- **Security**: Added `make.discover.legal` to CORS, CSRF, and CSP configs across all three middleware files
- **Frontend**: Simplified `index.js` to pure `createRoot` (no hydration logic)
- **Frontend**: Removed pre-render guards from PaymentModal and gtm.js

### v3.1.0 (2026-01-26)
- State support expanded to 7 (added CA, FL, IL, NY)
- Row Level Security via migration 010
- Webhook idempotency via migration 011
- React Helmet Async, sitemap generation, GTM integration
- BrandAssetsPage, ResourcesPage, ArticlePage components

### v3.0.0 (2026-01-08)
- Initial comprehensive documentation
- Dynamic template discovery
- Multi-provider LLM support
- Auth0 with duplicate email protection
- Stripe with server-side pricing
