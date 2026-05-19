# Security

## Reporting a vulnerability

Please email security@discover.legal with a description of the issue
and (if possible) a proof-of-concept. We try to respond within two
business days. Please do not file a public GitHub issue.

If you need PGP, contact us first and we will share a key.

## Scope

In-scope:
- `discover.legal`, `www.discover.legal`, `ca.discover.legal`,
  `canada.discover.legal`, and any service they forward to.
- The Next.js application at the repository root (`app/`,
  `components/`, `lib/`, `services/`, `templates/`).

Out of scope:
- Automated scanner findings without a working PoC.
- Reports against `*.auth0.com`, Stripe, OpenAI, Render or other
  third-party providers — please report those directly upstream.
- Self-XSS against your own account.
- Volume-based DoS that does not bypass per-user rate limits.

## Known posture / non-secrets

The repository's security boundaries are documented in code:

| Concern | File |
| --- | --- |
| AuthZ on every authed route | `lib/api/auth.ts`, `withAuth` wrapper |
| Tenant isolation at the DB | `migrations/010`, `migrations/014` (FORCE RLS) |
| Server-side payment pricing | `lib/pricing.ts`, `lib/api/stripe.ts` |
| Stripe webhook signature + idempotency | `app/api/payment/webhook/route.ts` |
| Auth0 webhook signature + HMAC constant-time compare | `lib/api/auth0-webhook.ts` |
| Trusted client IP | `lib/util/clientIp.ts` |
| CSP / security headers | `next.config.mjs` |
| Body-size + CSRF + scanner blocks at the edge | `middleware.ts` |
| Evidence upload validation | `app/api/evidence/upload/route.ts` |
| Path-traversal guard for evidence storage | `services/evidenceStorage.js` |
| Logger redaction | `lib/logger.ts` |

The branch `claude/security-audit-review-DmR9d` carries the latest
audit and remediation log; the most recent comprehensive sweep
(2026-05-19) addresses findings C-1..L-9 from the project's internal
audit. Historical write-ups live under `SECURITY_*.md`.

## Things we don't do

- We do not store passwords. Auth is delegated to Auth0.
- We do not store full credit card numbers. Payment data lives in
  Stripe; we only persist their PaymentIntent ID + minimal status.
- We do not log raw fact content or evidence file contents in
  application logs (only lengths and IDs).

## Known follow-ups (not active vulns)

- **Render free Postgres plan**: `render.yaml:databases[0].plan: free`
  must be promoted to a paid plan before storing production customer
  data. Free plans expire after 90 days and lack backups.
- **Local-disk evidence storage**: `DOCUMENTS_PATH=/app/documents`
  relies on a persistent disk being mounted in the Render dashboard.
  Plan migration to object storage before scaling beyond 1 replica.
- **Next.js advisories**: `npm audit` reports several high-severity
  CVEs in `next@14` that are only patched in `next@15+`. None of the
  vulnerable features (next/image remotePatterns, WebSocket SSRF,
  Pages Router i18n) are in use, but tracking the upgrade is
  recommended.
