# Security Audit — 2026-05-22

**Application:** affidavit-maker (discover.legal)
**Stack:** Next.js 14 App Router, TypeScript, PostgreSQL (RLS FORCE), Auth0, Stripe, OpenAI
**Branch audited:** `claude/security-audit-mobile-state-s3vOP`

This audit reviews route-handler auth-gating, SQL safety, CSP, CSRF, webhook
verification, file uploads, rate-limiting, secrets handling, prompt
injection, open redirects, session/cookie hygiene, PII logging, and
dependency hygiene.

Findings are graded **CRITICAL / HIGH / MEDIUM / LOW**. Each cites
`file:line` and a one- to two-sentence remediation.

---

## CRITICAL

### C1. Vulnerable Next.js + transitive dependencies

- **Where:** `package.json` (`next` 14.2.x, `uuid` <11.1.1)
- **What:** Next 14.2.x has known advisories — HTTP request smuggling in
  rewrites (GHSA-ggv3-7p47-pfv8), DoS via Server Components
  (GHSA-q4gf-8mx6-v5v3, GHSA-8h8q-6873-q5fj), RSC cache poisoning
  (GHSA-vfv6-92ff-j949), SSRF in WebSocket upgrades (GHSA-c4j6-fc7j-m34r).
  Transitive `uuid` exposes uninitialized memory disclosure
  (GHSA-w5hq-g745-h8pq) — used by `services/evidenceStorage.js` and
  `lib/api/evidence.ts`.
- **Fix:** Pin `next` to ≥ 14.2.25 (or the latest 14.2.x patch) and `uuid`
  to ≥ 11.1.1. Run `npm audit --omit=dev` after upgrade and re-run the
  Stripe webhook + Auth0 callback paths in staging before deploy. A full
  jump to Next 16 is breaking (Turbopack default, middleware → proxy
  rename) and is **not** the right immediate move.

---

## HIGH

### H1. `processPaymentFailed` updates payments without user_id scope

- **Where:** `app/api/payment/webhook/route.ts:99-104`
- **What:**
  ```sql
  UPDATE payments SET status = 'failed' WHERE stripe_payment_intent_id = $1
  ```
  Unlike `processPaymentSucceeded` (which fetches the payment row, compares
  `metadata.userId`, and rejects on mismatch), the failed-payment path
  trusts the intent ID alone.
- **Risk framing:** The Stripe signature check at line 124-130 gates this
  code, so the path is not directly exploitable without the webhook secret
  — this is defense-in-depth, not an open vulnerability. But signature
  bypass / secret leak / future replay weakness would let an attacker flip
  arbitrary users' payments to `failed` knowing only the intent ID.
- **Fix:** Mirror the success path:
  ```sql
  UPDATE payments SET status = 'failed', updated_at = NOW()
  WHERE stripe_payment_intent_id = $1 AND user_id = $2
  ```
  …or first SELECT the row, verify `metadata.userId` matches, then UPDATE
  inside the same transaction the success path uses.

### H2. CSP still relies on `'unsafe-inline'` for script-src and style-src

- **Where:** `next.config.mjs:36-54` (script-src/style-src directives)
- **What:** Required today for Next's runtime + inline JSON-LD; comment
  acknowledges "tighten with nonces later." Combined with the Stripe and
  GTM third-party scripts, an XSS in any one of them executes freely.
- **Fix:** Move to nonce-based CSP — generate a per-request nonce in
  `middleware.ts`, propagate it via response header + `next/script`'s
  `nonce` prop, drop `'unsafe-inline'`. Non-trivial; track as a hardening
  task rather than blocking a deploy.

### H3. Evidence upload trusts magic-byte sniff without size/structure check

- **Where:** `app/api/evidence/upload/route.ts:139-150`
- **What:** `file-type.fromBuffer()` validates the file's signature
  bytes, then the MIME is checked against `ALLOWED_MIMES`. A polyglot
  (e.g. valid PDF header + JS payload) can pass the sniff. The read
  endpoint already returns `Content-Disposition: attachment` and
  `X-Content-Type-Options: nosniff`, which mitigates the most obvious
  serving-side abuse — but downstream PDF tooling or the user's own
  viewer is still exposed.
- **Fix:** Keep magic-byte sniff. Add (a) explicit size cap (the route
  reads the body into memory; cap at e.g. 25 MB), (b) reject PDFs with
  JavaScript actions via a quick `/JavaScript|/JS|/AA|/OpenAction` regex
  pass before storing, (c) ensure the evidence GET handler keeps the
  `Content-Security-Policy: default-src 'none'` it already sets.

### H4. In-memory rate limiter is per-instance

- **Where:** `lib/api/rateLimit.ts:1-10`
- **What:** Plain `Map` bucket store. The header comment acknowledges this:
  "If the app ever scales to multiple instances on Render, swap this for
  @upstash/ratelimit or similar." Render currently runs a single
  instance, so the effective limits hold today, but the moment scale
  ≥ 2 the per-IP limits split N-ways.
- **Fix:** Before bumping `numInstances` in `render.yaml`, port to
  Upstash or Postgres-backed limiter. Until then, document a hard-stop on
  horizontal scaling in `render.yaml`.

---

## MEDIUM

### M1. CSP allows wildcarded `*.gravatar.com` for img-src

- **Where:** `next.config.mjs:64`
- **What:** Permits image loads from any Gravatar subdomain. If a flow
  ever embeds a Gravatar URL constructed from a user-supplied email,
  Gravatar's federated infra becomes a side-channel.
- **Fix:** Remove the entry — Gravatar isn't used by the marketing or
  app surface today (confirmed by grep). Re-add scoped if needed.

### M2. Stripe webhook secret only validated at request time

- **Where:** `app/api/payment/webhook/route.ts:117-124`
- **What:** Missing `STRIPE_WEBHOOK_SECRET` returns 503 at request time.
  Stripe retries with exponential backoff and stops after ~3 days, so a
  misconfigured deploy can drop payment events silently.
- **Fix:** Add a startup validator (`scripts/validate-env.ts`) that
  asserts the presence of `STRIPE_WEBHOOK_SECRET`, `AUTH0_SECRET`,
  `DATABASE_URL`, `OPENAI_API_KEY` and `exit(1)`s if any are missing.
  Wire it into the Render pre-deploy script alongside `migrate.js`.

### M3. RLS is robust but has no static check for missing wrappers

- **Where:** `lib/db.ts:withRLSContext / withRLSBypass`, every Route Handler
- **What:** Forgetting `withRLSContext` in a new authed handler doesn't
  silently leak — FORCE RLS denies — but the failure mode is a runtime
  permission error that a hurried dev might misdiagnose and try to
  "fix" by reading from a service that bypasses RLS.
- **Fix:** Add an ESLint custom rule (or a unit test that imports each
  `app/api/**/route.ts` and asserts the exported handlers are wrapped by
  `withAuth` / `withRLSBypass` / a documented public-rate-limited
  helper). Cheap insurance.

### M4. Chat handler accepts a 256 KB `affidavitData` blob with arbitrary keys

- **Where:** `app/api/chat/route.ts:418-432`
- **What:** Zod `.record(z.unknown()).passthrough()` with a byte-size
  ceiling. Bound is enforced, but the schema doesn't cap field count,
  so an adversary can craft a payload that serializes just under 256 KB
  with many small fields.
- **Fix:** Add a property-count cap (e.g. ≤ 200 keys) inside the schema
  refinement that runs before the byte check. Low priority — 256 KB is
  already small.

### M5. Logger redaction set doesn't cover PII field names

- **Where:** `lib/logger.ts:65-100`
- **What:** Secrets (`authorization`, `cookie`, `api_key`, etc.) are
  redacted, but `affiantName`, `caseNumber`, `documentContent`,
  `firstName`, `lastName` are not. Code in `services/` and route
  handlers logs object summaries, not full payloads — current practice
  is fine — but the safety net leaks if someone logs `currentDocument`
  directly.
- **Fix:** Either (a) extend `REDACT_KEYS` to include the canonical PII
  field names and accept the debugging hit, or (b) add a lint rule that
  warns on `console.log`/`logger.*` of any object that includes a
  `currentDocument`/`affidavitData` field.

### M6. Open-redirect protection in `/api/auth/login` flow

- **Where:** `app/api/auth/[auth0]/route.ts` (Auth0 SDK handles `returnTo`)
- **What:** The SDK validates `returnTo` against `AUTH0_BASE_URL` by
  default. Verified — no manual `redirect()` calls with user-controlled
  URLs elsewhere in the codebase (`grep -rn "redirect(" app/api`).
- **Fix:** None. Spot-check on the next dependency upgrade in case the
  SDK changes default behavior.

---

## LOW / INFO

### L1. Evidence path-traversal protection is solid

- **Where:** `app/api/evidence/[documentId]/[fileKey]/route.ts:113-117`,
  `services/evidenceStorage.js:assertWithin`
- **Status:** ✅ Confirmed safe. `fileKey` is matched against
  `/^[a-zA-Z0-9._-]+$/` before joining, and `assertWithin` re-checks the
  resolved path stays inside the user's directory.

### L2. Document ID regex is strict

- **Where:** `app/api/documents/[id]/route.ts:26`
- **Status:** ✅ `/^[1-9]\d{0,9}$/` — positive integers ≤ 2^31-1. Good.

### L3. CSRF middleware rejects missing Origin/Referer

- **Where:** `middleware.ts:106-124`
- **Status:** ✅ Correct production behavior. Curl/Postman in dev need
  `-H "Origin: http://localhost:3000"`.

### L4. Auth0 webhook IP rate limit can collapse on proxy misconfig

- **Where:** `lib/api/auth0-webhook.ts:141`
- **Status:** ℹ️ Acceptable. `rateLimitKey` returns a no-IP token
  shared across callers when client IP is unresolvable. Render's proxy
  is configured today; revisit if traffic flow changes.

### L5. `path.posix.join` for evidence storage

- **Where:** `app/api/evidence/[documentId]/[fileKey]/route.ts:113-117`
- **Status:** ✅ Correct — forward-slash normalization across hosts.

### L6. DB pool connection timeout < statement_timeout

- **Where:** `lib/db.ts:142,149`
- **Status:** ✅ `connectionTimeoutMillis = 10s` fires before
  `statement_timeout = 30s`. Intended.

### L7. No `security.txt` published

- **Where:** `middleware.ts:59` blocks `/.well-known/security.txt.`
  (note trailing dot — that's the scanner-noise variant).
- **Status:** ℹ️ Best practice (RFC 9116) is to publish one at
  `/.well-known/security.txt` listing contact/PGP/policy. Optional.

### L8. Payment metadata only carries server-derived fields

- **Where:** `app/api/payment/create-intent/route.ts:107-114`
- **Status:** ✅ `userEmail`, `locale` come from session/config — no
  user-controlled passthrough into Stripe metadata.

### L9. JWT verification is fully delegated to Auth0 SDK

- **Where:** `lib/auth.ts`
- **Status:** ✅ No hand-rolled JWT parsing anywhere in the repo.

---

## What the codebase already does well

- **RLS FORCE** on every user-scoped table (migrations 010 + 014) plus
  `withRLSContext` wrapper — strong defense-in-depth.
- **Parameterized SQL** everywhere — `grep -rn "query(\`" lib services app`
  produced zero template-literal queries with interpolation.
- **Stripe webhook** uses raw `await req.text()` before
  `constructEvent`, and the idempotency check (`processed_webhook_events`)
  runs in the same transaction as the row updates.
- **Auth0 webhook** verifies HMAC with `crypto.timingSafeEqual`
  (`lib/api/auth0-webhook.ts`).
- **Trusted client IP** lives in `lib/util/clientIp.ts` — no naive
  `x-forwarded-for[0]` parsing across the codebase.
- **Auth-gating discipline** — every Route Handler under
  `app/api/*` either uses `withAuth`, an HMAC-verified webhook path, or
  is explicitly public+rate-limited (`/api/catalog/*`, `/api/health`).
- **Zod input validation** on every body-accepting handler; errors flow
  through `lib/api/errors.toErrorResponse` so stack traces never reach
  the client.
- **Logger redaction** scrubs tokens / cookies / api keys; error
  responses carry only `requestId` not internals.

---

## Priority queue

1. **Now:** C1 (dependency upgrade) — pin `next` and `uuid`, run audit.
2. **Within 1 week:** H1 (payment_failed user_id scope), M2 (env validator
   at startup).
3. **Within 1 month:** H2 (nonce CSP), M1 (drop Gravatar src), M3 (RLS
   wrapper static check), M5 (logger PII redaction list).
4. **Before scaling > 1 instance:** H4 (Redis-backed rate limiter).
5. **Hardening / nice-to-haves:** H3 (PDF JavaScript stripper), L7
   (`security.txt`).

No findings indicate active exploitation or production-blocking risk.
The C1 upgrade is the only item that should land before the next deploy.
