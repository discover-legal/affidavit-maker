# CLAUDE.md - AI Assistant Guide for Affidavit Maker

**Last Updated**: 2026-05-04
**Version**: 5.0.0 — Next.js 14 + TypeScript

---

## Quick Reference

**Essential Commands**:
```bash
npm install           # First-time setup
npm run dev           # Next.js dev server on :3000
npm run build         # Production build (Next.js standalone)
npm start             # Run production server
npm test              # Jest (next/jest preset, jsdom)
npm run type-check    # tsc --noEmit
npm run lint          # next lint
npm run db:migrate    # Run database migrations
```

**Live URL**: `https://discover.legal` (canonical apex). Same Next.js service also serves `www.discover.legal` (301 → apex), `ca.discover.legal`, `canada.discover.legal`.

**Stack**: Next.js 14 App Router + TypeScript + Tailwind CSS + PostgreSQL + Auth0 (`@auth0/nextjs-auth0` v3) + OpenAI + Stripe.

**Key Directories**:
- `app/` — App Router (marketing pages at root, authed pages under `(app)/`, API routes under `api/`)
- `components/` — React components: `marketing/` (SSG-friendly) and `app/` (interactive)
- `lib/` — Shared modules: `db.ts`, `auth.ts`, `auth0-client.ts` shim, `api/*` (auth wrapper, errors, rate limit, services), `content/*`, `utils/*`
- `contexts/`, `hooks/` — Client-side React contexts and hooks (mostly `.js`, ported from CRA pending TS conversion)
- `services/` — CommonJS business-logic modules (LLM, PDF, validation, agents). Imported by Route Handlers via `lib/api/services.ts`.
- `templates/` — 110 jurisdiction directories + core base classes
- `migrations/` — 14 SQL migrations (015 adds `user_profiles` life-story table)
- `__tests__/` — Jest tests
- `docs/` — DNS, deployment, audit logs

**Critical Security Notes**:
- Always use parameterized SQL via `lib/db.ts`'s `query()` helper.
- Verify `user_id` ownership on every authed Route Handler. RLS is ON
  with FORCE (migrations 010 + 014), but treat it as defense-in-depth,
  not the only barrier.
- Server-side pricing only — never trust client-supplied amounts.
- Stripe webhook reads `await req.text()` (raw body) for signature
  verification — never `.json()`.
- Trusted client IP lives in `lib/util/clientIp.ts` — DO NOT roll your
  own `req.headers.get('x-forwarded-for')?.split(',')[0]`, it's
  client-spoofable on every reverse-proxy setup.
- Auth-gating: never write a new Route Handler under `/api/*` without
  one of: `withAuth`, a webhook HMAC verification, or a documented
  reason it's public + `rateLimitKey(req, …)` for the IP-based limit.
- CSP is enforced in `next.config.mjs.headers()`. Extend
  `CSP_DIRECTIVES` rather than dropping `'unsafe-eval'` or new
  `'unsafe-inline'` allowances.

---

## Project Overview

A **full-stack Next.js application** at `discover.legal` that helps users create legally-compliant legal documents using AI assistance.

**Positioning (2026-08, liability posture)**: free, donation-supported, and a
PREP tool — it organizes the user's story into draft documents; it is NOT the
filing conduit. Where a jurisdiction publishes official court forms
(`lib/officialForms.ts`, 60 verified jurisdictions), the UI links them and the
copy tells users to file on those, using our drafts as source material. Never
reintroduce "court-ready" / "ready to file" claims; the packet is a "Case
packet", downloads are "drafts". The same Next.js service serves marketing (landing, resources, articles, brand, legal), the authenticated app (dashboard, editor), and the API (`/api/*`).

Users can:
- Chat with an AI to document facts
- Generate jurisdiction-specific affidavits (all 50 US states + DC, 13 Canadian provinces/territories)
- Create divorce petitions, divorce decrees, and other family-law documents
- Access 16+ civil/family law matter types (custody, child support, DVRO, paternity, etc.)
- Validate facts for legal sufficiency
- Upload supporting evidence
- Generate professional PDFs
- Save and manage multiple documents and cases

### Tech Stack

**Application**:
- Next.js 14 (App Router) + TypeScript
- React 18, Tailwind CSS
- PostgreSQL (`pg` 8.16.3) with RLS
- Auth0 (`@auth0/nextjs-auth0` v3, cookie session)
- OpenAI GPT-4o (multi-provider via `services/MultiProviderLLM`)
- Stripe (payments + webhooks)
- PDFKit + pdf-lib (PDF generation)
- Zod (input validation in Route Handlers)
- React Helmet replaced by Next's `metadata` export

**Infrastructure**:
- Render.com — single web service, Docker (multi-stage, `output: 'standalone'`)
- PostgreSQL managed database (`affidavit-db`)
- DNS: apex `discover.legal` ALIAS/A → Render; CNAMEs for `www`, `make`, `ca`, `canada`. See `docs/DNS_SETTINGS.md`.

---

## Architecture

**Single Next.js service**: same process serves SSG marketing pages, server-rendered app pages (auth-gated via `withPageAuthRequired`), and API Route Handlers under `app/api/*`. There is no separate Express backend any more — `services/` modules are imported directly from Route Handlers.

### Request Flow

```
Browser → Next.js (middleware.ts: request id) → Route Handler / Page
       → withAuth (resolves Auth0 session, upserts user, attaches AppUser)
       → Zod input validation
       → service / db query
       → JSON / streaming response
```

### Allowed Hosts (Auth0 + DNS)

All point to the same Next.js Render service:
- `https://discover.legal` (canonical)
- `https://www.discover.legal` (Next config redirect → apex)
- `https://ca.discover.legal` / `https://canada.discover.legal`

CORS is unnecessary for same-origin API calls; Next.js Route Handlers accept the cookie session directly. CSP is set in `next.config.mjs` `headers()`.

---

## Directory Structure

```
affidavit-maker/
├── package.json                 # All deps (single root, no client/ subtree)
├── next.config.mjs              # Security headers + www→apex redirect
├── tsconfig.json                # Strict mode + @/ path aliases
├── tailwind.config.ts
├── postcss.config.js
├── middleware.ts                # Edge: request id, CSP passthrough
├── Dockerfile                   # Multi-stage standalone build
├── render.yaml
│
├── app/
│   ├── layout.tsx               # Root layout: metadata, GTM, UserProvider
│   ├── page.tsx                 # LandingPage (Server Component shell)
│   ├── error.tsx                # Global error boundary
│   ├── loading.tsx
│   ├── not-found.tsx
│   ├── sitemap.ts               # Generated sitemap.xml
│   ├── robots.ts                # Generated robots.txt
│   ├── globals.css
│   ├── providers.tsx            # UserProvider client wrapper
│   │
│   ├── privacy/page.tsx
│   ├── tos/page.tsx
│   ├── brand/page.tsx
│   ├── resources/
│   │   ├── page.tsx
│   │   └── [slug]/page.tsx      # generateStaticParams over ARTICLES
│   │
│   ├── (app)/                   # Auth-gated route group
│   │   ├── layout.tsx           # AppShell (TOSProvider + DocumentProvider + TOSGuard)
│   │   ├── AppShell.tsx
│   │   ├── dashboard/page.tsx
│   │   ├── editor/new/page.tsx
│   │   ├── editor/[documentId]/page.tsx
│   │   └── payment-success/page.tsx
│   │
│   └── api/
│       ├── auth/[auth0]/route.ts          # handleAuth() — login/logout/callback/me
│       ├── webhooks/auth0/route.ts        # HMAC-verified user upsert webhook
│       ├── health/route.ts
│       ├── catalog/                       # 5 read-only endpoints (matters, states, etc.)
│       ├── cases/                         # Full CRUD + linking
│       ├── templates/                     # Read-only metadata
│       ├── facts/rewrite/route.ts
│       ├── validate/                      # validation, validate/county, validate/counties/batch
│       ├── counties/[state]/route.ts      # county listing
│       ├── payment/                       # create-intent, status, history, pricing, webhook
│       ├── documents/                     # list/GET/save/rename/delete + preview + generate + render
│       ├── chat/                          # POST + session GET/DELETE
│       └── evidence/                      # upload + read/delete + list-by-document
│
├── components/
│   ├── marketing/               # MarketingHeader, LandingPage, ResourcesContent,
│   │                            # ArticleMarkdown, MarkdownContent, TermsMarkdown, Tooltip
│   └── app/                     # 19 ported app components + EditorClient/UserDashboardClient TS wrappers
│
├── contexts/                    # DocumentContext, TOSContext (legacy .js, pending TS conversion)
├── hooks/                       # useAffidavitData, useCountyValidation, useSaveDocument
│
├── lib/
│   ├── db.ts                    # pg.Pool singleton on globalThis
│   ├── auth.ts                  # getCurrentSession + getCurrentUser (auto-provisions row)
│   ├── auth0-client.ts          # Compat shim recreating @auth0/auth0-react surface
│   ├── responses.ts             # ok/fail JSON helpers
│   ├── api/
│   │   ├── auth.ts              # withAuth() Route Handler wrapper
│   │   ├── errors.ts            # AppError + Zod-aware toErrorResponse
│   │   ├── rateLimit.ts         # In-memory sliding-window limiter
│   │   ├── services.ts          # Lazy singletons of CommonJS services
│   │   ├── stripe.ts            # Stripe SDK + PRICING_CONFIG
│   │   ├── catalog-data.ts      # Matter types, docs-by-matter, jurisdictions
│   │   └── notImplemented.ts    # Structured 501 for stubbed routes
│   ├── content/                 # privacyPolicy.js, termsOfService.js, articles.js (with .d.ts)
│   ├── services/authService.ts  # useAuthenticatedApi() hook
│   └── utils/                   # analytics.js, factNormalizer.js
│
├── services/                    # Unchanged CommonJS business-logic
│   ├── DatabaseService.js       # Legacy; new code uses lib/db.ts directly
│   ├── MultiProviderLLM.js
│   ├── ResilientOpenAIService.js
│   ├── affidavitService.js
│   ├── enhancedFactValidationService.js
│   ├── pdfService.js
│   ├── previewRenderer.js
│   ├── courtNameService.js
│   ├── documentService.js
│   ├── evidenceStorage.js
│   ├── agents/                  # 134 orchestrators (per-jurisdiction divorce + 16 matter types)
│   └── affidavits/              # AffidavitTypeRegistry + per-type prompts
│
├── templates/                   # 110 jurisdiction directories
│
├── migrations/                  # 14 SQL files; runs via scripts/migrate.js (Render preDeployCommand)
├── scripts/
│   ├── migrate.js
│   ├── cleanDatabase.js
│   └── deploy.sh
│
├── __tests__/                   # next/jest, jsdom by default
│   ├── lib/api/catalog.test.ts
│   ├── marketing/sitemap.test.ts
│   └── (services/, templates/, utils/ — legacy backend tests, scoped for cleanup)
│
└── docs/                        # DNS_SETTINGS.md, etc.
```

---

## Development Setup

```bash
git clone <repo-url> && cd affidavit-maker
npm install
createdb affidavit_maker
cp .env.example.sh .env.local
npm run db:migrate
npm run dev
```

### Environment Variables (`.env.local`)

```bash
# Database
DATABASE_URL=postgresql://localhost:5432/affidavit_maker

# Auth0 — required by @auth0/nextjs-auth0
AUTH0_SECRET=               # openssl rand -hex 32
AUTH0_BASE_URL=http://localhost:3000
AUTH0_ISSUER_BASE_URL=https://your-tenant.auth0.com
AUTH0_CLIENT_ID=
AUTH0_CLIENT_SECRET=
AUTH0_AUDIENCE=             # optional API audience
AUTH0_WEBHOOK_SECRET=       # for /api/webhooks/auth0

# Auth0 — exposed to the client bundle
NEXT_PUBLIC_AUTH0_DOMAIN=your-tenant.auth0.com
NEXT_PUBLIC_AUTH0_CLIENT_ID=

# OpenAI
OPENAI_API_KEY=
LLM_PROVIDER=openai
LLM_MODEL=gpt-5.5

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...

# Feature flags
ENABLE_INTERNATIONAL=false  # Set true to activate ~110 international jurisdictions
PAYMENTS_ENABLED=false      # FREE by default (donation-supported). true re-arms
                            # Stripe charging; the payment infra stays dormant
NEXT_PUBLIC_DONATION_URL=   # "Buy us a coffee" link; coffee links render only when set
```

---

## Code Patterns & Conventions

- **TypeScript**: `app/`, `components/marketing/`, `lib/api/`, `lib/auth*.ts`, `lib/db.ts`, `lib/responses.ts` are TS. Legacy app components/contexts/hooks remain `.js` with `allowJs: true` until converted file-by-file.
- **Path aliases**: `@/lib/...`, `@/components/...`, `@/contexts/...`, `@/hooks/...`, `@/services/...`, `@/templates/...`, `@/utils/...`.
- **DB columns**: snake_case.
- **Indentation**: 2 spaces, single quotes, semicolons.

### API Response Format

Successful Route Handlers wrap data in:
```ts
{ success: true, data: {...}, timestamp: "..." }
```

Errors use `lib/api/errors.toErrorResponse()`:
```ts
{ success: false, error: "...", errorType: "...", requestId, timestamp }
```

### Route Handler Pattern

```ts
import { withAuth } from '@/lib/api/auth';
import { z } from 'zod';
import { toErrorResponse } from '@/lib/api/errors';
import { query } from '@/lib/db';

const bodySchema = z.object({ /* ... */ });

export const POST = withAuth(async (req, { user }) => {
  try {
    const body = bodySchema.parse(await req.json());
    const rows = await query('SELECT ... WHERE user_id = $1', [user.id]);
    return Response.json({ success: true, data: rows });
  } catch (err) {
    return toErrorResponse(err);
  }
});
```

### Auth0 Patterns

- **Server Components / Route Handlers**: `import { getSession } from '@auth0/nextjs-auth0'` or use `withAuth` which wraps `getCurrentUser()`.
- **Client Components**: `import { useUser } from '@auth0/nextjs-auth0/client'`. Legacy components still use the `useAuth0` shim from `@/lib/auth0-client`.
- **Page-level auth gating**: `withPageAuthRequired` from `@auth0/nextjs-auth0`.
- **Login/logout URLs**: `/api/auth/login`, `/api/auth/signup` (sets `screen_hint=signup`), `/api/auth/logout`, `/api/auth/callback`, `/api/auth/me`.

---

## Auth0 Required URLs (production)

- Allowed Callback URLs: `https://discover.legal/api/auth/callback`
- Allowed Logout URLs:   `https://discover.legal`
- Allowed Web Origins:   `https://discover.legal`

Add `http://localhost:3000` equivalents for development.

---

## Database

Same schema as before — Auth0 user provisioning is now in `lib/auth.ts` `getCurrentUser` (with idempotent ON CONFLICT) and the `/api/webhooks/auth0` route. RLS still enabled (migration `010`).

### Singleton pool

`lib/db.ts` exports a `pg.Pool` cached on `globalThis.__pgPool` so it survives Next.js HMR in dev.

```ts
import { query } from '@/lib/db';
const result = await query<{ id: string }>('SELECT id FROM users WHERE auth0_id = $1', [auth0Id]);
```

---

## Payment Processing

- Server-side pricing only (`lib/api/stripe.ts` `PRICING_CONFIG`).
- Stripe webhook: `app/api/payment/webhook/route.ts` reads `await req.text()` for signature verification (raw bytes), then `stripe.webhooks.constructEvent`. Idempotency via `processed_webhook_events` table inside the same transaction as the row updates.

---

## API routes (all ported)

Every endpoint the SPA calls is now backed by a Next.js Route Handler. Full inventory:

**Auth**: `[auth0]` (login/logout/callback/me via handleAuth), `accept-tos`, `tos-status`, `webhook/user-update`, `webhook/email-update`.

**Catalog**: `matters`, `matters/[code]`, `matters/[code]/documents`, `states/[state]/matters`, `document-types/[code]`.

**Cases**: list/create, GET/PUT `[id]`, POST `[id]/documents` (link).

**Documents**: list, GET/DELETE `[id]`, PUT `[id]/rename`, POST `[id]/render`, POST `save`, POST `preview`, POST `generate` (PDF, payment-gated).

**Chat**: POST (orchestrator dispatch — triage/divorce/matter/general), GET/DELETE `session/[sessionId]`.

**Evidence**: POST `upload` (Web FormData, magic-byte sniff, allow-listed MIMEs), GET/DELETE `[documentId]/[fileKey]`, GET `document/[documentId]`.

**Facts**: POST `rewrite` (LLM-backed, optional auth, rate-limited).

**Validation**: POST `validate` (LLM fact validation), POST `validate/county`, POST `validate/counties/batch`.

**Counties**: GET `counties/[state]` (curated list).

**Payment**: POST `create-intent`, GET `status/[paymentIntentId]`, GET `history`, GET `pricing`, POST `webhook` (raw-body Stripe verification + idempotency).

**Templates**: `affidavit-types`, `affidavit-types/by-category`, `affidavit-types/[typeId]`, `states`, `document-types`, `validate`, `divorce/states`, `divorce/requirements/[state]`, `divorce/document-types/[state]`, `divorce/validate`, `validation` + `validation/[state]` (legal-review changelog per jurisdiction — when each claim was last verified, what was corrected, sources; data from `templates/validation-history.json`, regenerated via `scripts/buildValidationHistory.js`, surfaced in the editor by `LegalReviewBadge`).

**Profile**: GET `/api/profile` (life-story profile: structured fields + accumulated facts, table `user_profiles`), DELETE `/api/profile` (privacy erase). The chat route hydrates every conversation from this profile and merges each turn's extractions back, so facts persist across sessions and documents (`lib/api/profile.ts`).

**Health**: GET `/api/health` (DB ping).

Common patterns:
- Authed handlers go through `withAuth` from `lib/api/auth.ts`, which resolves the user, sets per-request RLS context (`app.user_id` / `app.current_user_id`) inside a transaction via `withRLSContext` (lib/db.ts), and rolls back on thrown errors.
- Webhooks (Auth0 + Stripe) bypass RLS via `withRLSBypass` and authenticate by signature.
- Body validation uses Zod schemas; errors flow through `lib/api/errors.toErrorResponse` which produces the `{ success, error, errorType, requestId, timestamp }` shape the SPA expects.
- Rate-limited per endpoint via `lib/api/rateLimit.ts` (bucketed sliding-window, in-memory).

---

## Firm mode (BigLaw integration)

When `BIGLAW_API_URL` + `BIGLAW_INTAKE_SECRET` are **both** set, the deployment
becomes a law-firm client-intake portal: drafts are sent to the firm's BigLaw
platform for a lawyer ("Send to My Lawyer") instead of paywalled downloads, and
clients get a "My Legal Profile" CRM surface (`/profile`) with
bidirectional-consent fact updates. When unset, nothing changes — pure self-rep
product, zero firm UI, zero BigLaw calls.

**Env vars** (`.env.example.sh`): `BIGLAW_API_URL`, `BIGLAW_INTAKE_SECRET`
(HMAC-SHA256 request signing; never `NEXT_PUBLIC`, never logged),
`BIGLAW_FIRM_NAME` (display name, defaults to "Your law firm").

**Contract**: `docs/BIGLAW_INTEGRATION.md` (mirrored from the BigLaw repo's
`docs/integration/affidavit-intake.md`) — the authoritative intake/CRM API
spec, including the `v1=` signing scheme and the fact category vocabulary.

**File map**:
- `lib/biglaw/config.ts` — `isFirmMode()`, `firmName()`
- `lib/biglaw/client.ts` — `BigLawClient` (signed fetch, 15s timeout) +
  `getBigLawClient()` lazy singleton (null when firm mode off);
  `signIntakeRequest()` implements the HMAC scheme
- `lib/biglaw/types.ts` — contract types, `FACT_CATEGORIES`,
  `normalizeSubmissionStatus()` (unknown → `in_review`)
- `migrations/021_firm_mode.sql` — `firm_submissions` local status mirror
  (UNIQUE per document, FORCE RLS per migration 014's pattern)
- `app/api/firm/` — `config` (mode probe), `submit` (renders the draft via
  `services/previewRenderer`, seeds ≤20 CRM facts, sets
  `payment_status='free'`), `submissions` (local rows + 5s live refresh,
  `live` flag), `profile`, `profile/propose`,
  `profile/proposals/[proposalId]/decision` — all `withAuth` + rate-limited
- `contexts/FirmContext.js` — client-side `{ firmMode, firmName, loading }`
  from `/api/firm/config`; provider mounted in `app/(app)/AppShell.tsx`
- UI: `components/app/EditorView.js` ("Send to My Lawyer", payment-modal
  bypass in firm mode), `components/app/UserDashboard.js` (status pills +
  profile nav), `app/(app)/profile/page.tsx` + `components/app/LegalProfileClient.tsx`

Degradation rule: BigLaw being unreachable disables firm features for that
request (dashboard falls back to stored statuses, `live:false`) but never
breaks self-rep functionality. Tests: `__tests__/lib/biglaw-client.test.ts`.

---

## SEO

Built into Next.js — no react-snap, no Chromium, no postbuild hacks:

- Every public page exports `metadata` (or `generateMetadata` for dynamic).
- JSON-LD inlined per page via a `<script type="application/ld+json">`.
- `app/sitemap.ts` regenerates the sitemap on every build, driven by `lib/content/articles.js`.
- `app/robots.ts` disallows `/api/`, `/dashboard`, `/editor/`, `/payment-success`.
- All marketing pages are SSG by default (Server Components). Interactive bits (auth-aware nav, category filter) are isolated `'use client'` islands so the static HTML still ships full content.

---

## Deployment

**Platform**: Render.com, Docker (multi-stage), branch `main`.

**Build process** (`Dockerfile`):
1. Builder stage: `npm ci && next build` with `NEXT_PUBLIC_*` build-args baked in.
2. Runner stage: copy `.next/standalone` + `.next/static` + `public` + `scripts/` + `migrations/`. Runs as non-root `nextjs:nodejs`.
3. Pre-deploy: `node scripts/migrate.js`
4. Start: `node server.js` (the standalone bundle's entrypoint).
5. Health check: `/api/health`.

**REACT_APP_* → NEXT_PUBLIC_*** rename: client-bundled env vars now use the Next.js convention. Re-set them in Render dashboard.

**Custom domains** (all on the same Render service): `discover.legal`, `www.discover.legal`, `ca.discover.legal`, `canada.discover.legal`. See `docs/DNS_SETTINGS.md`.

---

## Troubleshooting

**Build fails with type errors**: `npm run type-check` locally. Strict mode is on; legacy `.js` files are untyped (allowJs).

**Auth0 redirects to localhost in production**: `AUTH0_BASE_URL` env var must be `https://discover.legal`, not the default.

**Stripe webhook 400**: `app/api/payment/webhook/route.ts` reads `await req.text()`. If you replaced that with `req.json()` you broke signature verification.

**`useUser()` returns `null` even after login**: `app/providers.tsx` (UserProvider) must wrap the tree. It's mounted by `app/layout.tsx`.

**`prisma`-style queries don't work**: this app uses raw `pg.Pool` via `lib/db.ts` — there's no ORM.

**Hydration mismatch on landing page**: most likely `country` detection running differently on server vs. client. The detection sits inside a `useEffect` so initial render matches; if you see this elsewhere, move browser-only logic into `useEffect`.

---

## Version History

### v5.0.0 (2026-05-04) — current
**Migration to Next.js 14 + TypeScript.** CRA + Express both retired.

- **Next.js 14 App Router** at the repo root. `app/` houses pages + API Route Handlers; legacy `client/` and `server.js` deleted.
- **TypeScript** with strict mode. New code (`app/`, `lib/api/`, `components/marketing/`) is TS; legacy app components/contexts/hooks remain `.js` with `allowJs` while incrementally converted.
- **`@auth0/nextjs-auth0`** replaces `@auth0/auth0-react`. Cookie-based session, no more bearer tokens on the client. `/api/auth/[auth0]/route.ts` exposes login/logout/callback/me. A compatibility shim (`lib/auth0-client.ts`) keeps unconverted legacy components working with the old `useAuth0()` surface.
- **Native SEO**: every page uses Next's `metadata` / `generateMetadata`. `app/sitemap.ts` and `app/robots.ts` replace static files. `react-snap` and Chromium are gone.
- **Single Render service**: same Next.js process serves marketing + app + API. No more Express. `services/` modules are imported by Route Handlers.
- **Phase-4 follow-up complete**: chat, document preview/generate/render, evidence upload/read/delete/list, every templates metadata endpoint, and the validate + counties endpoints are all live. See "API routes (all ported)" section above.
- **Dockerfile**: multi-stage with `output: 'standalone'`. No Chromium, faster builds.
- **Auth0 dashboard URL changes**: callback now `/api/auth/callback` (not `/callback`).
- **Env-var rename**: `REACT_APP_*` → `NEXT_PUBLIC_*`.

### v4.2.0 (2026-05-04)
- Restored react-snap pre-rendering for marketing routes (later replaced by native Next.js SSG in v5.0.0).

### v4.1.0 (2026-05-04)
- **Hosting consolidation**: Retired Webflow. Render-hosted SPA serves marketing + app from `https://discover.legal` (canonical apex).
- **DNS**: New `docs/DNS_SETTINGS.md` documents the single-SPA zone.

### v4.0.0 (2026-03-13)
- Jurisdictions: Expanded to 110 directories (64 NA + 46 international).
- Per-jurisdiction divorce orchestrators + 16 matter type orchestrators.
- Catalog API, cases table (migration 012), document_catalog (migration 013).
- Triage orchestrator, country-aware routing.

### v3.x and earlier
See `docs/audit-fix-log-2026-03-10.md` for the consolidated changelog.
