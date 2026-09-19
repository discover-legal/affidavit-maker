# 04 — App surface and platform

Functional specification (observable behavior, not implementation) for everything outside the interview brain and document composition. Companion to `01-conversation-and-interviews.md`, `02-facts-and-life-story.md`, `03-documents-and-rendering.md`. Items marked **UNVERIFIED** were not confirmed by reading a test or running the code.

Conventions used below: every JSON error is `{ success:false, error, errorType?, requestId?, timestamp? }` (`lib/api/errors.ts`). "Auth" means a valid Auth0 session cookie. IDs in URLs must be positive 32-bit integers or the route answers 400.

---

## 1. Auth, provisioning and Terms gating

### 1.1 Sign-in / sign-up / sign-out
*Statement.* Auth0 owns identity; the app keeps a rolling cookie session (`lib/auth0.ts`: absolute 24 h, inactivity 1 h, both env-tunable). Routes are `/api/auth/login`, `/api/auth/logout`, `/api/auth/callback`, `/api/auth/me` (profile). `/api/auth/signup` is a redirect to login with `screen_hint=signup` (`proxy.ts`). After login the user lands on `/dashboard` unless `returnTo` was given.
*Acceptance.*
- Unauthenticated GET `/dashboard`, `/editor/*`, `/profile`, `/respond`, `/serve`, `/hearing`, `/payment-success` → 302 to `/api/auth/login?returnTo=<path+query>` (proxy prefix list, plus `requirePageAuth` in every `app/(app)/*/page.tsx`, which also covers `/legal-profile`).
- GET `/api/auth/signup` → 302 to `/api/auth/login?screen_hint=signup`.
- GET `/auth/profile` (SDK default path) is served as `/api/auth/me`, never 404.
- In non-production with `E2E_AUTH_BYPASS=1` every request carries a fixed test identity (`e2e|discover-legal-test-user`); impossible in production (`lib/auth.ts:5-8`).

### 1.2 Route-handler gating (`withAuth`, `lib/api/auth.ts`)
*Statement.* An authed handler resolves the session, provisions the user row if missing, checks TOS, acquires a concurrency slot, then runs inside an RLS-scoped transaction.
*Acceptance.*
- No session → 401 `{ success:false, error:'Authentication required' }`.
- Session present, TOS not accepted at current `TOS_VERSION` → 403 `{ errorType:'terms_required', tosVersion }` for every route except `accept-tos`, `tos-status`, `firm/config` (which use `withBasicAuth`).
- 5th simultaneous in-flight request from the same user, or pool-wide cap (`DATABASE_POOL_MAX − 8`, min 1) reached → 429 `{ errorType:'concurrency_limit' }`.
- Malformed `sub` (fails `provider|id` shape, `lib/auth.ts:130-134`) → 500 `'User provisioning failed'`.

### 1.3 User provisioning and Auth0 webhooks
*Statement.* First authed call inserts `users(auth0_id,email,name,email_verified)` idempotently (`ON CONFLICT (auth0_id)`). Auth0 Actions POST to `/api/auth/webhook/user-update` and `/api/auth/webhook/email-update` (`lib/api/auth0-webhook.ts`).
*Acceptance.*
- Missing `auth0-signature` → 401; bad HMAC-SHA256(body) → 401; `AUTH0_WEBHOOK_SECRET` unset → 500.
- Body without `updateTime`, or `updateTime` > now+5 min → 400; `updateTime` older than 24 h → 200 `{ success:true, ignored:true, reason:'stale_event' }`.
- Older event than stored `auth0_updated_at` → 200 `{ success:true, ignored:true }` (user-update) and no row change.
- Rate limit: 10 per 15 min per trusted IP (bucket `auth0-webhook`) → 429.

### 1.4 Terms of Service acceptance
*Statement.* `TOSGuard` (client) calls `GET /api/auth/tos-status`; if `tosAccepted` is false (or the call fails) it shows `TermsOfServiceModal`, which blocks the app until acceptance. The accept checkbox and the optional research-consent checkbox are disabled until the terms panel is scrolled to within 10 px of the bottom.
*Acceptance.*
- `GET /api/auth/tos-status` → 200 `{ success, tosAccepted, tosAcceptedAt, tosVersionAccepted, currentTosVersion }`; `tosAccepted` is true only when the stored version equals `TOS_VERSION`.
- `POST /api/auth/accept-tos { tosVersion:'<older>' }` → 400 (`ValidationError`).
- `POST { tosVersion: TOS_VERSION, researchConsent:true }` → 200 `{ tosAccepted:true, tosVersion, researchConsent:true }`; `users.tos_*` updated and one `tos_acceptance_log` row upserted per (user, version) with trusted IP + user agent.
- 11th accept call in 15 min → 429.

---

## 2. Dashboard (`components/app/UserDashboard.js`, `CaseStepper.tsx`)

*Statement.* Authed landing page. Loads `GET /api/documents`, `GET /api/cases`, `GET /api/profile`, `GET /api/procedure/<state>` (state from profile, else `UT`), `GET /api/payment/pricing`, and, in firm mode, `GET /api/firm/submissions`.

*Visible elements and rules.*
- Header shows "Dashboard" with the **Beta** stage badge (`components/StageBadge.tsx`). Quick links: "Your life story" (`/profile`), "Serve the papers" (`/serve`), "Respond to the papers" (`/respond`), "Your day in court" (`/hearing`); firm mode adds "My Legal Profile" (`/legal-profile`).
- **Case stepper** renders only when profile + procedure loaded and (`profile.keyEvents.length>0` or `documents.length>0`); steps come from `computeNextSteps` (§4.2). Current step = first not-done; overdue/≤7-day answer step is flagged urgent; due dates show as "Due <date>".
- **New Document**: "Family Law" → "General Affidavit" or "Divorce Package" cards (price badges only when `pricing.paymentsEnabled===true`); "Civil Litigation" card is disabled with "Coming Soon". Selecting navigates to `/editor/new?type=<affidavit|divorce_package>&caseType=family`. There is no jurisdiction picker on the dashboard; jurisdiction is chosen in the editor (§3.2).
- **My Cases** section lists cases (title, court · county · state) with their linked documents; "Other Documents"/"Your Documents" lists documents with `case_id` null. Rows show display title (custom title, else "<Party> — <Type>" / "<Party>'s <Type>", else "<Type> #id"), "Updated <date>", Rename (inline, Enter/Escape), Delete (confirm dialog "Delete document?"), "Case packet" button, and "Continue" (or "View" when `status==='completed'`) → `/editor/<id>`.
- Firm-mode pill per document from submission status: `received`→"Sent to firm", `conflict_hold`→"Conflict hold", `in_review`→"In review", `ready`→"Ready", `rejected`→"Declined"; unknown → "In review".
- Case packet: `POST /api/documents/packet { documentId }` → downloads `case-packet-<id>.pdf`; 404/501 hides all packet buttons; other failure shows an inline error for 4 s.

*Acceptance.*
- `JURISDICTION_ALLOWLIST=ON,UT`: dashboard unchanged (no jurisdiction UI); `GET /api/catalog/matters/divorce` → `supported_states:['UT','ON']` (order of the full list filtered); `GET /api/catalog/states/TX/matters` → 404.
- Delete of a document with a payment in `pending` → 409 `{ errorType:'PaymentInProgress' }`, row remains.
- Rename with empty title → 400 `'Invalid title'`; success → 200 `{ success:true, id, title }`.

---

## 3. Editor (`EditorView.js`, `DocumentContext.js`, panels)

### 3.1 Layout and tabs
Three panels: **Chat**, **Preview**, **Validation** (`role=tab`, arrow/Home/End keyboard nav). Desktop shows chat + preview side by side with a resizable divider and the validation sidebar; narrow screens show one panel. Header: Back to dashboard, save-status text (`'Saving...'`, `'Unsaved changes'`, `'Saved just now'`, `'Save conflict — action required'`), Save button, Download button (label per active sub-document, e.g. "Download Petition draft"), and in firm mode "Send to My Lawyer". `LegalReviewBadge` appears when a state is set. `QuickExit` appears when `matterTypeCode ∈ {dvro, civil_harassment}` or `hasProtectiveOrder===true`. Below the header a notice lists "A lawyer's advice is recommended for: …" when `advisorFlags` is non-empty (contested custody, contested property, safety/protective orders).

### 3.2 New document creation and jurisdiction
*Statement.* `/editor/new?type=…` immediately creates a row via `POST /api/documents/save` seeded from the life-story profile, then opens `/editor/<id>`. Jurisdiction is picked in chat: seven quick-pick buttons (UT, TX, AZ, CA, FL, IL, NY) plus a dropdown of every other code from `GET /api/templates/states`. **UNVERIFIED**: the quick-pick buttons are hard-coded and are not filtered by `JURISDICTION_ALLOWLIST`; only the dropdown reflects the server list. `UnsupportedStateMessage` lists supported jurisdictions when chat reports an unsupported one.
*Acceptance.*
- `POST /api/documents/save` with no `documentId` → 201 `{ success:true, document:{ id, edit_revision:1, payment_status:'unpaid', … } }`.
- `POST /api/documents/generate` with `state:'TX'` under `JURISDICTION_ALLOWLIST=ON,UT` → 200 (generate checks the NA list + international flag, **not** the allowlist; `app/api/documents/generate/route.ts:295-310`). **UNVERIFIED** whether chat refuses TX in that configuration.

### 3.3 Saving, revisions, conflicts
*Statement.* Autosave fires 2 s after the last change; every save sends `expectedRevision` when known; server bumps `edit_revision` and, when content changed, resets `payment_status` from anything except `'free'` to `'unpaid'`. Transcript (`conversationHistory`, ≤60 msgs, ≤6000 chars each) is persisted with the document and restored on reopen.
*Acceptance.*
- Save with stale `expectedRevision` → 409 `{ errorType:'DocumentConflict', currentRevision }`; client pauses autosave, disables Save, shows "A newer version exists in another tab or device." with "Reload server version".
- Content > 1 MiB, validation blob > 1 MiB, or transcript > 256 KiB → 400.
- Rename/payment/generate do not change `edit_revision` (migration 019).

### 3.4 Facts list, reordering, evidence and rewrite (Validation sidebar)
- Each non-evidence fact card: edit, delete, "Generate professional rewrite" (`POST /api/facts/rewrite`), showing the suggestion with **Apply**. "Rewrite All Facts" (hidden for divorce docs) runs sequentially with a progress counter and asks for confirmation when all facts already have rewrites.
- Drag-and-drop reorders facts and evidence items (`reorderFacts`), marking the document unsaved.
- Evidence items (`fact.type==='evidence'`) show upload/edit-description/delete; the upload modal accepts `.pdf/.jpg/.jpeg/.png`, client cap 25 MB, and posts multipart `{ file, documentId, evidenceId }`.
- Requirements checklist: "Name provided", "State selected", "At least 3 facts (n/3)", and "All evidence files uploaded (k/n)" when evidence exists.
*Acceptance.*
- `POST /api/facts/rewrite { fact:{ content:'' } }` → 400; valid → 200 `{ success:true, professionalRewrite }`; 51st call in 15 min or 251st in 24 h → 429.

### 3.5 Server validation (`POST /api/validate`)
*Statement.* Runs the jurisdiction template's `validateAffidavitData` (state defaults to `TX` when unset) and, when facts exist, `validateFactsBatchProfessional` (local heuristics + LLM, §9). Response `{ success:true, validation:{ isValid, errors[], warnings[], factValidation:{ isValid, results[], criticalIssues, … } } }`; any critical fact flips `isValid=false`. Limits: 50/15 min and 250/day per user, fail-closed when the limiter store is down.

### 3.6 County input
`CountyValidationInput` loads `GET /api/counties/<state>` for autocomplete (curated list exists for AZ only; other states get `counties:[]`) and, 800 ms after typing stops, `POST /api/validate/county { county, state }` → `{ success, validation:{ isValid, county, normalizedCounty, confidence, reasoning, suggestions } }`. Success renders "✓ <Normalized> County, <ST>"; a different normalized value offers "Did you mean …?". Batch variant accepts up to 100 names. Both are public with IP (or `auth:<sub>`) keyed limits.

### 3.7 Download, review gate, purchase, send to lawyer
*Statement.* Download requires a saved document, a jurisdiction, the user's own name and ≥1 fact (`getDownloadReadiness`). Flow: save if dirty → firm mode? download directly : check `GET /api/documents/<id>` `payment_status ∈ {paid,completed,free,succeeded}` → if not paid, read `GET /api/payment/pricing`; `paymentsEnabled:false` → ReviewGate; `true` → PaymentModal then ReviewGate. ReviewGate lists key fields (affiant, petitioner, respondent, state, county, marriage/separation dates, grounds, custody, child support) and enables "confirm" only after the checkbox "These statements are true and in my own words" is ticked; then `POST /api/documents/generate` streams `application/pdf` (or DOCX with `format=docx`). After a completed download a "Buy us a coffee" link appears when `NEXT_PUBLIC_DONATION_URL` is set.
*Acceptance.*
- Missing name → inline notice "Complete your name before download." and no request.
- `PAYMENTS_ENABLED=true`, `payment_status:'unpaid'` → `POST /generate` 402 `{ errorType:'payment_required', documentId }`.
- `PAYMENTS_ENABLED` unset → same document → 200 PDF and a `document_generate_payment_gate_bypassed` log line.
- `documentType:'case_packet'` to `/generate` → 400 `{ errorType:'WrongEndpoint' }`.
- Firm mode: "Send to My Lawyer" → save → `POST /api/firm/submit { documentId }` → button reads "Sent" and message "Sent to <firm> — status: <status>".

### 3.8 Legal review badge and Quick Exit
- Badge: `GET /api/templates/validation/<state>` → "Law verified <relative>" colored green ≤120 days, amber ≤365, red after; panel lists claim categories, corrections and sources. No entry → badge absent.
- Quick Exit: button or Esc pressed twice replaces the page with a neutral search URL via `location.replace` (no history entry).

---

## 4. Guides and procedure

### 4.1 Procedure data (`GET /api/procedure/<state>`)
Public, IP-limited. Registry contains **UT** and **ON** only (`lib/api/procedure/index.ts:33-36`). Shape: residency, waiting period (UT 30 d waivable; ON 31 d), answer deadline `{ inState, outOfState }` (UT 21/30; ON 30/60), education, mediation, service methods, default judgment, unsworn declaration, financial disclosure, filing. Any other two-letter code → 404 `'No procedure information is available for XX yet.'`; non-2-letter → 400.

### 4.2 Next steps and calendar
*Statement.* `computeNextSteps(profile, procedure)` (pure) derives ordered steps from profile `keyEvents` labels/dates, `children`, `serviceMethod`, `role`. Respondent perspective (role `respondent`, or an event reading "served on you"/"you were served") leads with "File your answer"; petitioner sees serve → answer → default (when past due, no answer) → mediation (if answered and required) → waiting period → education (minor children) → financial declaration → finish. Deadlines are day-granular; urgent = due within 7 days.
*Calendar.* `GET /api/profile/deadlines` → `text/calendar` attachment `my-deadlines.ics` with all-day events and a `-P3D` alarm; 404 `'No dated deadlines yet'` when nothing is dated. Linked from `/profile` as "Add my deadlines to my calendar".
*Acceptance.*
- Profile `keyEvents:[{label:'Filed', date:'2026-09-01'}]`, UT → `waiting` step `due:'2026-10-01'`, `done:false` on 2026-09-19.
- `served` 2026-09-10, no answer, petitioner, UT, today 2026-10-05 → `default` step present, `answer.done:false`.
- Event date `'a few months ago'` → no `due` on dependent steps (unparseable dates are dropped).

### 4.3 /serve, /respond, /hearing
- **/serve** (`ServeGuideClient`): state from `?state=XX` else profile else `UT`; loads procedure; per service-method card offers PDF helpers via `POST /api/documents/support` (`acceptance_of_service` when method key contains "accept", `certificate_of_service` for "certificate"/"proof"). Unknown state → "Serving instructions for <state> aren't written yet" with generic copy. EN/ES toggle.
- **/respond** (`RespondClient`): reads served date from profile events, computes answer due = served + inState days, shows "Answer generally due: <date>", urgent ≤7 days, and a stale warning when more than 183 days past. Lets the user mark themselves respondent (`PATCH /api/profile { role:'respondent' }`), enter paragraph admit/deny positions, and download an Answer draft (`kind:'answer'`); 400/404 → "unavailable" state. Non-UT states show the official-forms link from `lib/officialForms.ts` (60 jurisdictions; LA and NU intentionally absent).
- **/hearing** (`HearingPrepClient`): personalized checklist (minor children, copies, arrival, childcare), waiting-period reminder (falls back to 30 d for UT), deterministic practice questions built from profile (marriage, separation, residency, children, …), LawHelp.org link omitted for Canadian codes. Works fully without profile/procedure (generic copy).

### 4.4 Supporting documents (`/api/documents/support`)
- `GET ?state=XX` → `{ success:true, data:{ kinds:[{ kind, title, description, … }] } }`. UT: acceptance_of_service, certificate_of_service, financial_declaration, default_package, child_support_worksheet, answer, fee_waiver_motion, finalization_prep; FL/GA/NY/CA/TX/ON/AB: `answer`; every state: `lawyer_handoff` (state-agnostic case summary for attorney review, not a filing). Unknown state → `kinds:[lawyer_handoff]` only. **UNVERIFIED** exact list for unknown states.
- `POST { kind, state, documentId?, signatureStyle?:'unsworn'|'notary', extra? }` → `application/pdf`; data = profile merged under saved document content. (state, kind) without a builder → 400 `'Supporting documents are not yet available for this state'`. Limits: 10/h and 40/day (pdf bucket).
- **Utah child support estimator** (`services/childSupport/utah.js`): statutory table lookup, sole vs joint model (joint when both parents ≥111 overnights or plan `equal`, which deems 183/182), returns `{ insufficient:true, missing[] }` when incomes/children are unknown, adds a note instead of a number when combined income exceeds the table, always carries the ESTIMATE disclaimer and official calculator URL. Split custody is not computed.
- **Utah fee waiver**: household size = 1 + children; eligibility *hint* (not the legal test) at 150 % of 2025 FPG; income placeholders are rendered blank with an instruction when the movant's own income is unknown.

---

## 5. Evidence
*Statement.* Files attach to an owned document and a fact (`evidenceId` = `[A-Za-z0-9_-]`). Server sniffs magic bytes (`utils/allowedFileType.js`): PDF `%PDF`, JPEG `FF D8 FF`, PNG signature; only `application/pdf`, `image/jpeg`, `image/png` are stored; stored extension derives from the sniffed type, not the filename. Filename must match `[A-Za-z0-9._\- ()]+`. Size cap `MAX_FILE_SIZE` (default 10 MB; proxy allows +1 MB multipart overhead). Storage quotas (`services/evidenceStorage.js`): 100 MB / 100 files per document, 250 MB / 1000 files per user (env-tunable); PDFs over 500 pages or malformed, images over 10 000 px or 25 MP are rejected. Files live under `DOCUMENTS_PATH/.affidavit-storage/<user>/<document>/`.
*Acceptance.*
- Upload `.exe` renamed `.pdf` → 400 (sniff fails); valid PNG → 200 `{ success:true, evidence:{ fileKey, mime, … } }`.
- `GET /api/evidence/<doc>/<fileKey>` by another user → 404 (no existence oracle); owner → 200 with `content-disposition: inline`, `x-content-type-options: nosniff`.
- `GET /api/evidence/document/<doc>` → `{ success:true, evidence:[…] }`; `DELETE …/<fileKey>` → `{ success:true, deleted:fileKey }`.
- Deleting a document removes its evidence directory first, then the row; a cleanup failure leaves the row (retryable).

---

## 6. Payments (dormant)
*Statement.* `PAYMENTS_ENABLED=true` arms Stripe. Prices are server-side (`lib/pricing.ts`: single affidavit $15.80, divorce package $49.80; CAD table exists but `getLocale()` always returns `us`). Product is inferred from the document type (`divorce_*` → divorce package). Ledger row per PaymentIntent; entitlement granted only by webhook `payment_intent.succeeded` (or status poll) after `assertPaymentIntentBinding` checks user, amount, currency, documentType, documentId; refunds/disputes revoke (`documents.payment_status`), dispute won restores. Webhook idempotency via `processed_webhook_events` in the same transaction.
*Acceptance.*
- `GET /api/payment/pricing` with flag off → `{ paymentsEnabled:false, pricing:null }`; on → amounts + labels.
- `POST /api/payment/create-intent` flag off → 503 `{ errorType:'payments_disabled' }`; on, unsaved doc → 400; wrong product for the document → 400; already paid → 400; success → `{ clientSecret, paymentIntentId, amount, currency, originalAmount, … }`. Limit 10/h fail-closed.
- Webhook without `stripe-signature` → 400; bad signature → 400; body > 256 KiB → 413; replayed event id → 200 `'Event already processed'`.
- `GET /api/payment/status/<pi>` for another user's intent → 404; refunded → `{ status:'refunded', entitlementReady:false }`.
- Editing content after payment resets `payment_status` to `unpaid` (except `'free'`), so a paid ID cannot be reused for different content.

---

## 7. Firm mode (`lib/biglaw`, `app/api/firm`, `LegalProfileClient.tsx`)
*Statement.* Active only when `BIGLAW_API_URL` and `BIGLAW_INTAKE_SECRET` are both set; requests are HMAC-signed (`v1=…`), 15 s timeout. `GET /api/firm/config` → `{ firmMode, firmName }` (default name "Your law firm"). Submit renders the draft, seeds ≤20 non-evidence facts as `matter` CRM facts, upserts `firm_submissions` (one per document), sets `payment_status='free'`. Submission statuses: received, conflict_hold, in_review, ready, rejected; unknown → in_review. `/legal-profile` shows the CRM profile with "Pending your approval" (lawyer proposals: approve/reject) and lets the client propose facts (category from `FACT_CATEGORIES`, predicate ≤64, value ≤2000, ≤20 per call), which start pending lawyer approval.
*Acceptance.*
- Any `/api/firm/*` except `config` with firm mode off → 503 `ExternalServiceError`.
- `POST /api/firm/submit` → 201 `{ success:true, data:{ submission:{ id, status, conflict } } }`.
- `GET /api/firm/submissions` when BigLaw is unreachable → 200 with stored rows and `live:false`; dashboard pills still render; nothing else breaks.
- Decision on a proposal BigLaw answers 403 for → 403 `'This proposal is not yours to decide'`.

---

## 8. Platform rules

### 8.1 Edge proxy (`proxy.ts`)
- `MAINTENANCE_MODE=true` → every path except `/api/health` returns 503 HTML "back soon" with `retry-after: 3600`, `noindex`.
- Header `x-middleware-subrequest` → 400; paths `/.git/`, `/.env`, `/wp-admin`, `/wp-includes`, `/phpmyadmin` → 404.
- State-changing `/api/*` (except the three webhook paths) must carry an `Origin` (or parseable `Referer`) in the allow-list (`https://discover.legal`, `www`, `ca`, `canada`; localhost variants outside production) → otherwise 403 `CsrfError`.
- Non-safe `/api/*` methods: `Transfer-Encoding` → 411; missing `Content-Length` → 411 (except DELETE and `POST /api/documents/<id>/render`); `0` body where a body is required → 400; over cap → 413. Caps: 5 MiB JSON default, evidence upload `MAX_FILE_SIZE`+1 MiB, `/api/profile/ingest` 12 MiB, webhooks 1 MiB, global ceiling `API_MAX_BODY_BYTES` (25 MiB). Handlers apply tighter streaming caps (`readJsonBody`: 1 MiB default; chat 512 KiB with `affidavitData` ≤256 KiB; rewrite 512 KiB; create-intent 64 KiB).
- Every response carries `x-request-id`.
- `www.discover.legal/*` → 301 to `https://discover.legal/`. `/api/auth/*` and `/api/payment/*` responses are `no-store`.

### 8.2 Rate limits (`lib/api/rateLimit.ts`)
Shared PostgreSQL fixed-window counters (`api_rate_limits`, migration 018); on store failure read-only buckets fall back to an in-process limiter and `failClosed` buckets deny. Profiles: standard 100/15 min; strict 20/15 min; chat 50/15 min + chatDaily 250/24 h (closed); payment 10/h (closed); pdf 10/h + pdfDaily 40/24 h (closed); auth 10/15 min. Keys: user id for authed routes, trusted client IP (`lib/util/clientIp.ts`: rightmost XFF hop, private ranges rejected in production; unresolvable IPs share one `noip:<label>` key) for public ones. Over limit → 429 `{ success:false, error:'Too many requests' }`.

### 8.3 Ownership and RLS
Every table has RLS enabled and forced (migrations 010, 014); handlers still filter by `user_id`; non-owned rows answer 404 (documents, evidence, payments) or 403 (`cases`, chat session). Webhooks, rate limiting, user provisioning and payment writes use a transaction-scoped bypass.

### 8.4 Logging redaction (`lib/logger.ts`)
JSON lines in production. Keys such as password, token(s), authorization, cookie, stripe/auth0 signatures, secrets, `database_url`, SSN/card fields are replaced with `[redacted]` at any depth (≤8); strings matching Stripe/OpenAI/GitHub/Slack key shapes or JWTs become `[redacted-secret]`.

### 8.5 Health and readiness
- `GET /api/health` → 200 `{ status:'ok', timestamp }` always (no DB), survives maintenance mode.
- `GET /api/ready` → 200/503 `{ ready, checkedAt, checks:{ configuration, database, storage } }`, cached 10 s; configuration requires all listed env vars, `PAYMENTS_MODE` ∈ {live,test} matching key prefixes, HTTPS base URL; storage requires writable documents dir (and a real mount when `REQUIRE_PERSISTENT_STORAGE=true`).

### 8.6 i18n and locale
Language: `getInitialLang()` = stored `dl_lang` ∈ {en,es}, else browser language starting with `es`, else `en`; server always renders `en` first. Used by `/profile`, `/serve`, `/respond`, `/hearing`, stepper. Country/locale: `getLocale()` and `detectLocaleClient()` return `'us'` unconditionally; `defaultJurisdictionFor()` returns `''` (never pre-fills a state).

### 8.7 Marketing pages that matter
`/resources` lists 70 articles (`lib/content/articles.js`) with a client-side category filter; `/resources/<slug>` is SSG. Official-forms links (`lib/officialForms.ts`) surface on `/respond` (non-UT) — **UNVERIFIED** whether the editor also renders them. `/privacy`, `/tos`, `/brand` are static; sitemap/robots generated (robots disallows `/api/`, `/dashboard`, `/editor/`, `/payment-success`).

### 8.8 API inventory

| Endpoint | Auth | Limit (bucket) | Purpose / notable outcome |
|---|---|---|---|
| GET/POST `/api/auth/login|logout|callback|me` | – | – | Auth0 SDK routes |
| GET `/api/auth/signup` | – | – | 302 → login `screen_hint=signup` |
| GET `/api/auth/tos-status` | basic | – | acceptance state |
| POST `/api/auth/accept-tos` | basic | auth (user) | record acceptance; wrong version 400 |
| POST `/api/auth/webhook/user-update|email-update` | HMAC | auth (IP) | upsert / email change; stale → ignored |
| GET `/api/health` | – | – | liveness |
| GET `/api/ready` | – | – | readiness 200/503 |
| GET `/api/catalog/matters[?practice_area]` | – | standard (IP) | matter cards; bad area 400 |
| GET `/api/catalog/matters/:code` | – | standard | matter + docs + `supported_states` (allowlist-filtered); 404 |
| GET `/api/catalog/matters/:code/documents` | – | standard | doc codes |
| GET `/api/catalog/states/:state/matters` | – | standard | matters for state; inactive state 404 |
| GET `/api/catalog/document-types/:code` | – | standard | `used_in_matters` |
| GET `/api/templates/states` | – | standard | `[ {stateCode,stateName,requirements} ]` |
| GET `/api/templates/affidavit-types[/by-category|/:typeId]` | – | standard | registry lookups |
| GET `/api/templates/document-types` | – | standard | list |
| POST `/api/templates/validate` | withAuth | standard | template validation |
| GET `/api/templates/validation[/:state]` | – | standard | legal-review history |
| GET `/api/templates/divorce/states|requirements/:state|document-types/:state` | – | standard | divorce metadata |
| POST `/api/templates/divorce/validate` | – | standard | divorce data validation |
| GET `/api/procedure/:state` | – | standard | UT/ON procedure; else 404 |
| GET `/api/counties/:state` | – | standard | curated counties (AZ) or `[]` |
| POST `/api/validate/county`, `/counties/batch` | optional | standard (sub or IP) | title-case normalization |
| POST `/api/validate` | withAuth | chat + ai-daily | template + fact validation |
| POST `/api/facts/rewrite` | withAuth | chat + ai-daily | professional rewrite |
| GET `/api/cases`, POST | withAuth | standard | list / create (201) |
| GET/PUT `/api/cases/:id` | withAuth | standard | 404 / 403 non-owner; empty PUT 400 |
| POST `/api/cases/:id/documents` | withAuth | standard | link document |
| GET `/api/documents` | withAuth | standard | ≤200 docs, newest first |
| POST `/api/documents/save` | withAuth | standard | create 201 / update; 409 conflict |
| GET/DELETE `/api/documents/:id` | withAuth | standard | 404 non-owner; 409 active payment |
| PUT `/api/documents/:id/rename` | withAuth | standard | `{ id, title }` |
| POST `/api/documents/:id/render` | withAuth | standard | `{ formatted, items }`; bodyless |
| POST `/api/documents/preview` | withAuth | standard | preview structure |
| POST `/api/documents/generate` | withAuth | pdf + pdfDaily | PDF/DOCX; 402 when unpaid & armed |
| POST `/api/documents/packet` | withAuth | pdf | cover + TOC + exhibits PDF; 402 rule as above |
| GET/POST `/api/documents/support` | withAuth | standard / pdf | kinds list / support PDF |
| POST `/api/evidence/upload` | withAuth | standard | sniffed upload |
| GET/DELETE `/api/evidence/:doc/:fileKey` | withAuth | standard | stream / delete |
| GET `/api/evidence/document/:doc` | withAuth | standard | list |
| POST `/api/chat` | withAuth | chat + chat-daily (closed) | interview turn (spec 01) |
| GET/DELETE `/api/chat/session/:id` | withAuth | chat | id `chat_<ts>_<userId>` else 403; GET returns `messages:[]` |
| GET/PATCH/DELETE `/api/profile` | withAuth | standard | life story; PATCH ≤64 KiB |
| GET `/api/profile/deadlines` | withAuth | standard | `.ics` or 404 |
| POST `/api/profile/ingest` | withAuth | 10/15 min | text ≤20 000 chars or image ≤8 MB |
| GET `/api/payment/pricing` | – | standard (IP) | prices only when armed |
| POST `/api/payment/create-intent` | withAuth | payment (closed) | 503 when disabled |
| GET `/api/payment/status/:pi` | withAuth | standard | poll; 404 non-owner |
| GET `/api/payment/history` | withAuth | – | last 100 |
| POST `/api/payment/webhook` | Stripe sig | – | idempotent ledger updates |
| GET `/api/firm/config` | basic | standard | mode probe |
| POST `/api/firm/submit` | withAuth | standard | 201; 503 off |
| GET `/api/firm/submissions` | withAuth | standard | rows + `live` |
| GET `/api/firm/profile`, POST `/profile/propose` (201), POST `/profile/proposals/:id/decision` | withAuth | standard | CRM |

---

## 9. Semantic judgments currently done by pattern-matching

Each item: the judgment being made → the heuristic, with location.

1. **Fact category** (financial/property/relational/temporal/witness, sub-category income/assets/debts/real_estate/vehicles/custody/divorce) → keyword regexes on fact text; `services/enhancedFactValidationService.js:167-213`.
2. **Fact quality / severity** → profanity list = critical (`:239`); missing leading capital (`:246`) and terminal punctuation (`:253`) = info; hedging words "I think/maybe/probably…" (`:260`) and slang "kinda/gonna/stuff…" (`:267`) = warning; vague quantifiers "some/many/about…" (`:273`) = warning. Critical severity alone makes `isValid=false` (`:372, :546`).
3. **Professional rewrite fallback** (used when the LLM is unavailable) → word substitutions (`i`→`I`, `dont`→`don't`, "i think"→"I state that", drop "maybe/probably"), and choosing "I …"/"I witnessed that …"/"I state that …" by verb-class regexes; `services/enhancedFactValidationService.js:288-340`.
4. **Is this county name valid?** → strip the word "county", title-case, length ≥2 ⇒ valid; no cross-check against a county list; `app/api/validate/county/route.ts:27,47-74`, batch `:16-22`.
5. **Court name matches state / district number** → `/district court.*texas/i` etc. (`services/courtNameService.js:178-184`), ordinal district `/(\d+)(st|nd|rd|th)\s*district/i` (`:194, :220`), county normalization strip `/\scounty$/i` (`:291-299`), city→county by lowercase lookup (`:280`).
6. **Which procedural event is "filed / served / answered / education / financial / mediation"** → substring regexes `/fil/i`, `/serv/i`, `/answer/i`, `/educat|orient/i`, `/financial/i`, `/mediat/i` on `keyEvents.label`; `lib/api/procedure/index.ts:168-173`.
7. **Is the user the respondent?** → `role==='respondent'` or event text matching `/served on you|you were served/i`; `lib/api/procedure/index.ts:126-143`.
8. **Service method chosen** → `/waiv|accept/` vs `/personal|formal/` on method keys; `lib/api/procedure/index.ts:209-213`; guide helper-form choice by `includes('accept')`/`includes('certificate')||includes('proof')`; `components/app/ServeGuideClient.tsx:222-227`.
9. **Date parsing** → strict ISO / US numeric / "Month D, YYYY" with round-trip check in `lib/api/procedure/index.ts:81-103` and `components/app/lifeStory.ts:209-224`; but `new Date(string)` lenient parsing in `app/api/profile/deadlines/route.ts:8-17` and `components/app/RespondClient.tsx:283-289` (accepts "early spring 2010" as a date).
10. **Fee-waiver hint** → annual income ≤150 % of 2025 FPG for household 1+children; `components/app/lifeStory.ts:1315-1340`, `services/supportDocs/utahFeeWaiver.js:67-73`.
11. **Lawyer-advice flags** → field value string-equals `'contested'`; `components/app/lifeStory.ts:1288-1294`. **Safety matter** → matter code ∈ {dvro, civil_harassment} or `hasProtectiveOrder===true`; `components/app/EditorView.js:725-728`.
12. **Whose income is this line / is the stored total a household figure?** → `person` contains "respondent"/"petitioner" (`services/supportDocs/partyIncome.js:69-75, :266-269`); scalar ≈ sum of both sides within 2 % ⇒ household total (`:82-83, :144-150`); scalar ≈ other side's sum ⇒ misattributed (`:180-200`).
13. **Which parent is payor / child ages / joint custody** → `matchesParty` substring match on role or name (`services/childSupport/utah.js:139-146`); age from birth year/date (`:94-108`); joint when both overnights ≥111 or plan `equal` (`:60-65, :169-198`).
14. **Affiant name sanity for respondents** → if affiant equals petitioner caption and differs from respondent, substitute respondent; `components/app/lifeStory.ts:359-375`.
15. **Document display title / type label** → fixed map of type codes; `components/app/UserDashboard.js:24-31, :59-68`. **Product for a document** → `divorce_*` codes ⇒ divorce package; `app/api/payment/create-intent/route.ts:34-38`.
16. **CRM seed facts** → every non-evidence fact becomes a `matter` fact, predicate from content, capped at 20; jurisdiction label `US-`/`CA-` prefix by list membership; `app/api/firm/submit/route.ts:75-105`. **Submission status** → unknown strings ⇒ `in_review`; `lib/biglaw/types.ts:38-46`.
17. **Legal-review freshness** → 120/365-day thresholds; `components/app/LegalReviewBadge.js:14-17`.
18. **Language** → `navigator.language` starts with `es`; `lib/i18n.ts:380-381`.
19. **Identity / input shape guards** → Auth0 sub regex (`lib/auth.ts:130-134`, `lib/api/auth0-webhook.ts:30-33`); chat session id `/^chat_(\d{1,17})_(\d+)$/` (`app/api/chat/session/[sessionId]/route.ts:19`); PaymentIntent id `/^pi_[A-Za-z0-9]{14,80}$/` (`app/api/payment/status/[paymentIntentId]/route.ts:20`); evidence filename `/^[A-Za-z0-9._\- ()]+$/` (`app/api/evidence/upload/route.ts:24`); PDF filename slug (`app/api/documents/generate/route.ts:64`, `support/route.ts:63`); bodyless-POST path (`proxy.ts:50-52`).
20. **File type** → magic bytes only (PDF/JPEG/PNG); `utils/allowedFileType.js:8-29`; client pre-check by browser MIME (`components/app/EvidenceUploadModal.js:40-58`).
21. **Client IP trust** → IPv4/IPv6 shape regexes and RFC1918/loopback rejection; `lib/util/clientIp.ts:45-63`.
22. **Secrets in logs** → key-name set and value regexes (Stripe, OpenAI, GitHub, Slack, JWT); `lib/logger.ts:61-119`.
23. **Jurisdiction allowlist parsing** → comma split, trim, uppercase; empty ⇒ unset; `lib/api/catalog-data.ts:123-129`, `config/jurisdictions.js:42-51`.
24. **Hearing practice questions and checklist** → built from fixed profile fields (marriage/separation dates, residency months, minor vs adult children by birth date); `components/app/HearingPrepClient.tsx:371-470, :596-598, :649-675`.
