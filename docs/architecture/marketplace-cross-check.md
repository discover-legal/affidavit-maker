# Marketplace Planning -- Hermeneutic Cross-Check

**Date**: 2026-03-26
**Author**: Code Review Agent
**Documents Reviewed**:
1. `marketplace-prd.md` (PRD)
2. `marketplace-technical-architecture.md` (Tech Arch)
3. `marketplace-api-design.md` (API Design)
4. `marketplace-frontend-architecture.md` (Frontend Arch)
5. `marketplace-business-model.md` (Business Model)
6. `marketplace-ux-frontend-architecture.md` (UX Arch)

**Context**: `project_marketplace_saas.md` (project memory)

---

## Summary

- **21 contradictions** found
- **14 gaps** identified
- **9 alignment issues** (terminology, naming, phase assignment)
- **8 alignment confirmations** (things that are consistent)

---

## Critical Issues (must resolve before implementation)

### C1. Endpoint Count Mismatch (3-way conflict)

- **Project Memory** says "92 new API endpoints"
- **PRD Appendix B** counts 86 endpoints (8 + 14 + 10 + 6 + 6 + 6 + 4 + 2 + 8 + 6 + 12 + 4 = 86)
- **API Design doc** defines approximately 101 endpoints when individually counted (it includes endpoints not listed in the PRD, such as `GET /api/v1/marketplace/trending`, `GET /api/v1/marketplace/new`, gamification endpoints under `/api/v1/gamification/*`, and several SSE/webhook endpoints)

**Impact**: Implementation scope is ambiguous. The PRD will be used for sprint planning; if it undercounts by 15+ endpoints, timelines will slip.

**Resolution**: Adopt the API Design doc as the authoritative endpoint source. Update the PRD Appendix B to match. Update the project memory from 92 to the accurate count from the API Design doc. Explicitly mark any API endpoints that are Phase 2+ so they do not inflate Phase 1 scope.

---

### C2. Clio Integration Tier -- $5/month vs $25/month (multi-document conflict)

This is the single most impactful pricing contradiction across the planning documents:

- **PRD** (line 607): "$5/month: Clio integration"
- **PRD** (line 1222): Clio Integration price_clio_monthly = "$5/month"
- **PRD** (line 1647): Phase 3 includes "Clio integration ($5/month tier)"
- **Tech Arch** (line 394): tier_code `clio` = $5
- **Tech Arch** (line 1490): `dl_tier_clio: $5/mo`
- **API Design** (line 3430): "Clio integration requires the $5/mo subscription tier"
- **Business Model** (line 144): Enterprise tier ($25/mo) includes "Clio integration"
- **Business Model** (line 169): "Clio integration is bundled here because firms that use Clio are already paying $49-$149/month for Clio and view $25 as a rounding error"
- **Business Model** (line 1340): "Clio integration is included in the $25/mo Enterprise tier"
- **Business Model** (line 1403): Lists the component sum as "$25 (embed + Clio)"
- **Project Memory**: "$5/mo: Clio integration"

**Conflict**: The PRD, Tech Arch, API Design, and Project Memory all say Clio is $5/month as a standalone tier. The Business Model says Clio is only available at $25/month (bundled with white-label embed in the Enterprise tier). These are fundamentally different pricing positions -- $5 standalone vs $25 bundled is a 5x difference.

**Impact**: Critical. This affects the database schema (tier_code names), Stripe product configuration, feature gating middleware, frontend pricing page, and the business model projections.

**Resolution**: Pick one. The Business Model makes the stronger strategic argument (Clio users are established firms who can justify $25/month). However, 4 out of 6 documents say $5. Recommended: Keep Clio at $5/month as a standalone tier (matching the majority of documents), and also include it in the $25 Enterprise bundle. Update the Business Model to reflect this. The Enterprise tier at $25 would then be "white-label embed + Clio + everything below" -- Clio at $5 is the entry point, Enterprise at $25 is the bundle.

---

### C3. Subscription Model -- Additive Tiers vs Cumulative Tiers (structural conflict)

- **PRD** (line 612): "Tiers are additive: subscribing to $10/month analytics does NOT include $3/month branding (unless on $49 bundle)"
- **Business Model** (line 136-146): Describes tiers as CUMULATIVE -- each tier says "Everything in [previous tier] +" (e.g., Professional at $3 = "Everything in Starter + custom branding")
- **Tech Arch** (line 358): "Each tier is a separate Stripe subscription item so lawyers can mix and match"
- **Tech Arch** (line 1484): "Lawyers can subscribe to multiple tiers independently"

**Conflict**: The PRD and Tech Arch say tiers are independent add-ons (a la carte). The Business Model says each higher tier includes all lower tiers (cumulative). These require completely different Stripe configurations, different UI, and different feature gating logic.

**Impact**: Critical. This determines the entire subscription architecture -- whether a lawyer pays $10 for analytics alone, or $10 for analytics + branding + prompts.

**Resolution**: The Business Model's cumulative model is the better UX (simpler for lawyers, clearer value proposition, standard SaaS pattern). However, the PRD and Tech Arch's additive model is what the database schema was designed around (separate `tier_code` rows per feature). Recommended: Adopt the cumulative model from the Business Model. Restructure the `lawyer_subscriptions` table to store a single active tier per lawyer (not multiple rows). Update the PRD, Tech Arch, and API Design to match. The tier codes become: `free`, `starter`, `professional`, `growth`, `scale`, `enterprise`, `ultimate` instead of `prompts`, `branding`, `clio`, `analytics`, `api`, `pro`.

---

### C4. Affiliate Table Names Mismatch (PRD vs Tech Arch)

- **PRD** (line 646): references `affiliate_conversions` table
- **PRD** (line 1797): Migration 020 creates `affiliate_codes`, `affiliate_conversions`
- **Tech Arch** (line 473-542): Defines `affiliate_accounts`, `affiliate_referrals`, `affiliate_payouts`
- **Tech Arch** (line 2036): Migration 021 creates `affiliate_accounts`, `affiliate_referrals`, `affiliate_payouts`
- **API Design** (line 4461): references `affiliate_conversions` table

**Conflict**: The PRD and API Design reference tables (`affiliate_codes`, `affiliate_conversions`) that do not exist in the Tech Arch schema. The Tech Arch defines different tables (`affiliate_accounts`, `affiliate_referrals`, `affiliate_payouts`). The migration numbers also differ (020 in PRD vs 021 in Tech Arch).

**Impact**: Implementation will fail if developers follow the PRD table names but the migrations create different tables.

**Resolution**: Adopt the Tech Arch table names (`affiliate_accounts`, `affiliate_referrals`, `affiliate_payouts`) as they are fully defined with SQL schemas. Update the PRD and API Design to use these names. Note: The Tech Arch has three affiliate tables vs the PRD's two, so the PRD is also missing the `affiliate_payouts` table.

---

### C5. Migration Content Mismatch Between PRD and Tech Arch

**PRD Appendix A** migration plan:
| Migration | Tables |
|-----------|--------|
| 014 | `lawyer_profiles` |
| 015 | `marketplace_templates` |
| 016 | `marketplace_templates` indexes |
| 017 | `template_versions` |
| 018 | `template_reviews` |
| 019 | `lawyer_subscriptions` |
| 020 | `affiliate_codes`, `affiliate_conversions` |
| 021 | `clio_connections` |
| 022 | `lawyer_achievements` |
| 023 | `refund_requests` |
| 024 | `marketplace_analytics_daily` |
| 025 | RLS policies |

**Tech Arch** migration plan (line 2036+):
| Migration | Tables |
|-----------|--------|
| 014 | ALTER `users` (add `user_role` column) |
| 015 | `lawyer_profiles` |
| 016 | `marketplace_templates` |
| 017 | `template_versions`, FK additions |
| 018 | `template_purchases` |
| 019 | `template_reviews` |
| 020 | `lawyer_subscriptions` |
| 021 | `affiliate_accounts`, `affiliate_referrals`, `affiliate_payouts` |
| 022 | `clio_connections` |
| 023 | `template_analytics`, `lawyer_achievements`, `leaderboard_snapshots` |
| 024 | `payout_batches`, `template_categories`, `featured_placements`, `template_flags` |
| 025 | `interview_sessions`, RLS policies |

**Conflicts**:
1. Migration 014: PRD says `lawyer_profiles`; Tech Arch says ALTER `users` (add `user_role`)
2. Every subsequent migration is off by one between the two documents
3. PRD is missing `template_purchases` (a critical table)
4. PRD is missing `interview_sessions`
5. PRD is missing `payout_batches`, `template_categories`, `featured_placements`, `template_flags`
6. PRD references `refund_requests` which does not exist in Tech Arch
7. PRD references `marketplace_analytics_daily`; Tech Arch calls it `template_analytics`
8. PRD lists `affiliate_codes` + `affiliate_conversions`; Tech Arch lists `affiliate_accounts` + `affiliate_referrals` + `affiliate_payouts`

**Impact**: Critical. The migration plan is the execution blueprint. If the two documents disagree on what each migration creates, developers will be confused about which to follow.

**Resolution**: Adopt the Tech Arch migration plan as authoritative (it has full SQL DDL). Update the PRD Appendix A to match the Tech Arch exactly.

---

### C6. Revenue Split for Low-Price Templates -- Contradictory Models

- **PRD** (line 569): "Platform takes $1 flat fee per document (not deducted from lawyer price -- added on top for client)"
- **PRD** (line 1962-1984, Appendix E): Clear breakdown showing platform fee is ADDITIVE. Client pays template_price + $1 + Stripe. Lawyer receives full template_price.
- **Business Model** (sections 2.1, 2.3): Consistent with PRD -- $1 is additive.
- **Tech Arch** (line 436-445): For a "$1.00 Document," shows a COMPLETELY DIFFERENT split: Stripe 33c, Platform 27c, Lawyer 40c, total $1.00. This is a percentage-based split, not flat fee + additive.

**Conflict**: The Tech Arch section 4.1.6 describes a revenue split for a "$1.00 Document" that contradicts every other document. It shows the platform getting only 27 cents and the lawyer getting 40 cents. Under the established model ($1 additive), a $1 template would mean: client pays $1 (template) + $1 (platform) + Stripe fees. The lawyer gets $1, platform gets $1. The Tech Arch seems to describe a scenario where the total charge is $1 and the revenue is split from that, which contradicts the additive model.

**Impact**: This will cause incorrect Stripe PaymentIntent configuration for low-price templates.

**Resolution**: The Tech Arch section 4.1.6 revenue split table appears to be an error or describes an edge case inconsistently. The correct model per all other documents: for a $1 template, client pays $1 + $1 + Stripe = ~$2.33. Lawyer gets $1. Platform gets $1. Stripe gets ~$0.33. Remove or correct the conflicting table in the Tech Arch.

---

### C7. API Path Prefix -- Versioned vs Unversioned

- **API Design** (line 68-82): All new endpoints use `/api/v1/` prefix (e.g., `/api/v1/marketplace/templates`, `/api/v1/lawyer/templates`)
- **PRD Appendix B** (line 1807-1914): All endpoints use `/api/` without version prefix (e.g., `/api/marketplace/search`, `/api/lawyer/templates`)
- **Tech Arch** (line 190-204): Route groups listed without `/v1/` prefix (e.g., `/api/marketplace/templates`, `/api/lawyer/profile`)
- **UX Arch** (line 429): References `/api/lawyer/dashboard` (no version)
- **Frontend Arch** (line 3418): References `/api/marketplace/*` and `/api/lawyer/*` (no version)

**Conflict**: The API Design doc is the only document that uses `/api/v1/` prefix. All other documents use `/api/` directly.

**Impact**: Every frontend API call will use the wrong path if the mismatch is not resolved.

**Resolution**: Given that existing endpoints are at `/api/` without versioning, and 5 out of 6 documents use `/api/`, adopt the unversioned `/api/` prefix. Update the API Design doc to remove `/v1/` from all paths. Add `X-API-Version` header support as described in the API Design for future versioning needs.

---

## Moderate Issues (should resolve early in implementation)

### M1. Affiliate Role -- Four Roles vs Three Roles

- **Tech Arch** (line 121, 223): Defines four roles: `client`, `lawyer`, `affiliate`, `admin`. The `user_role` CHECK constraint includes `affiliate`.
- **API Design** (line 100-104): Defines three roles: `client`, `lawyer`, `admin`. No `affiliate` role.
- **UX Arch** (line 99-104): Defines three roles: `client`, `lawyer`, `admin`.
- **Frontend Arch**: RoleProvider tracks `isClient`, `isLawyer`, `isAdmin` -- no `isAffiliate`.
- **PRD** (line 635-640): Affiliate links are generated by lawyers. Affiliates are not a separate role.

**Conflict**: The Tech Arch treats `affiliate` as a distinct user role. All other documents treat affiliate functionality as something any authenticated user (primarily lawyers) can do, not a separate role.

**Resolution**: Remove `affiliate` from the user_role CHECK constraint. Affiliate status is tracked in the `affiliate_accounts` table, not as a user role. Any user can become an affiliate by registering. This matches the majority of documents.

---

### M2. Review Schema Mismatch (PRD vs Tech Arch)

- **PRD** (line 1289-1304): `template_reviews` table has `client_id`, `document_id`, `review_text`, `lawyer_response`, `moderation_status`, UNIQUE on `(template_id, client_id)`
- **Tech Arch** (line 447-471): `template_reviews` table has `purchase_id`, `reviewer_id`, `title`, `body`, `lawyer_reply`, `helpful_count`, UNIQUE on `(purchase_id)`

**Differences**:
1. FK reference: PRD uses `client_id` + `document_id`; Tech Arch uses `purchase_id` + `reviewer_id`
2. Review text: PRD has `review_text`; Tech Arch has `title` + `body` (two separate fields)
3. Lawyer response: PRD has `lawyer_response`; Tech Arch has `lawyer_reply`
4. Unique constraint: PRD is `(template_id, client_id)` (one review per client per template); Tech Arch is `(purchase_id)` (one review per purchase)
5. Tech Arch has `helpful_count`; PRD does not
6. PRD has `moderation_status`; Tech Arch has `is_visible`

**Impact**: These are different table designs that will produce different behavior. The unique constraint difference is particularly important -- the PRD prevents a client from reviewing the same template twice even if they buy it twice, while the Tech Arch allows one review per purchase.

**Resolution**: Adopt the Tech Arch schema (it is more complete). A review per purchase is more correct than per client+template. Update the PRD schema to match.

---

### M3. Template Status Values Mismatch

- **Tech Arch** (line 244): `status IN ('draft', 'review', 'published', 'suspended', 'archived')`
- **API Design** (line 1000): Status filter values include `pending_review`
- **API Design** (line 1163-1188): Soft delete sets status to `deleted`
- **PRD** (line 508): References `unpublished` as a status
- **UX Arch** (line 364): TemplateContext has statuses: `draft`, `published`, `archived`

**Conflicts**:
1. `review` vs `pending_review` -- different names for the same state
2. `deleted` -- exists in API Design but not in Tech Arch CHECK constraint
3. `unpublished` -- referenced in PRD but not in Tech Arch
4. `suspended` -- in Tech Arch but not in UX Arch

**Resolution**: Establish a single canonical set: `draft`, `pending_review`, `published`, `suspended`, `archived`, `deleted`. Update the Tech Arch CHECK constraint, the API Design, and the UX Arch to use this set.

---

### M4. Component Count Mismatch

- **Project Memory**: "~80 new React components"
- **PRD Appendix C**: ~73 new components (15 + 25 + 10 + 15 + 8 = 73)
- **Frontend Arch** (directory listing): ~62 new components (16 shared + 10 marketplace + 6 lawyer root + 13 templateBuilder + 5 client + 4 admin + 4 gamification = ~58, plus 3 views)
- **UX Arch**: Lists ~65 new components

**Discrepancy**: Four different counts across four documents (62, 65, 73, 80). The Frontend Arch and UX Arch have different component lists.

**Resolution**: Reconcile the Frontend Arch and UX Arch component lists into a single master list. Update the PRD and project memory with the accurate count. Components present in one doc but not the other need to be explicitly included or excluded.

---

### M5. Search Endpoint Duplication

- **API Design**: Defines BOTH `GET /api/v1/marketplace/templates?q=...` (section 7.1) AND `GET /api/v1/marketplace/search` (section 7.6) -- calling 7.1 "a simpler alias" of 7.6.
- **PRD**: Lists only `GET /api/marketplace/search`
- **UX Arch**: Frontend calls reference the search endpoint

**Issue**: Having two search endpoints that do the same thing creates confusion. The API Design says 7.6 is the "primary" and 7.1 with `?q=` is an "alias," but they have different response schemas.

**Resolution**: Keep one canonical search endpoint. Either make `/marketplace/templates` the combined browse+search endpoint (when `q` is present, full-text search activates), or keep them separate with clearly distinct purposes. The former is simpler.

---

### M6. Marketplace Search Rate Limit Inconsistency

- **API Design** (line 215): `marketplaceBrowseLimiter` = 300/15min
- **PRD** (line 1404): "Marketplace search: 60 requests/minute per IP"

**Conflict**: 300 per 15 minutes = 20/minute. The PRD says 60/minute. These are 3x different.

**Resolution**: 300/15min (from API Design) is the conservative option. 60/minute (from PRD) is more permissive. Pick one and update both documents.

---

### M7. Payment Flow -- Destination Charges vs Application Fee

- **UX Arch** (line 557): "PaymentModal is modified to support Stripe Connect destination charges (platform takes a percentage, remainder goes to lawyer's connected account)"

**Conflict**: The phrase "platform takes a percentage" contradicts the universal $1 flat fee model. Destination charges with `application_fee_amount: 100` (cents) is the correct pattern described in all other documents.

**Resolution**: Update the UX Arch description to say "platform takes a $1 flat application fee" instead of "a percentage."

---

### M8. Phase Assignment Conflicts for Features

Several features are assigned to different phases across documents:

| Feature | PRD | Business Model | Tech Arch |
|---------|-----|---------------|-----------|
| Reviews/Ratings | Phase 2 | Phase 1 (badges mention reviews) | Phase 1 (table in migration 019) |
| Affiliate System | Phase 3 | Phase 1 (section 2.13, "ADOPTED Phase 1") | Phase 1 (table in migration 021) |
| Leaderboards | Phase 2 | Phase 1 (badges/gamification) | Phase 1 (table in migration 023) |
| Subscriptions | Phase 2 | Phase 1 (business model) | Phase 1 (table in migration 020) |
| Template Bundles | Not mentioned | Phase 1 (section 2.15) | Not in schema |

The PRD Phase 1 explicitly says "Does not include: Subscription tiers, AI prompt editor, Custom branding, Clio integration, Affiliate system, Reviews and ratings, Gamification." But the Tech Arch creates ALL tables for these features in migrations 014-025, which the PRD says are all in Phase 1.

**Conflict**: Either all 12 migrations ship in Phase 1 (meaning the tables exist but the API/frontend does not expose them yet), or the migrations are phased (some ship later). This is ambiguous.

**Resolution**: Ship all 12 migrations in Phase 1 (creating all tables is low risk and avoids future migration coordination problems). The Phase 1/2/3 distinction should be about API endpoints and frontend features, not database tables. Document this decision explicitly.

---

### M9. Existing `email_notifications` Table Reference

- **PRD** (line 504): "Notifications use the existing `email_notifications` table"

**Issue**: There is no `email_notifications` table in the existing database. The existing migrations (000-013) do not create such a table.

**Resolution**: Either create this table in the marketplace migrations, or remove the reference and handle email notifications through a service (e.g., SendGrid, AWS SES) without a dedicated table.

---

### M10. Template Price Range Conflict

- **API Design** (line 912): `price_cents` validation is 100-99900 ($1.00 - $999.00). Minimum $1.
- **PRD** (line 348): "Price field accepts values from $0 (free) to $500"
- **Tech Arch** (line 242): `price_cents INTEGER NOT NULL DEFAULT 100` -- default is $1 but no CHECK constraint enforcing a minimum.
- **Business Model** (line 92): Suggests minimum template price should be $10.

**Conflicts**:
1. Minimum: $0 (PRD) vs $1 (API Design) vs no minimum (Tech Arch) vs $10 recommended (Business Model)
2. Maximum: $500 (PRD) vs $999 (API Design)

**Resolution**: Allow $0 (free templates are an explicit use case in the PRD personas -- Devon Jackson's legal aid nonprofit). Set maximum at $999 (more headroom). Document the $10 recommendation as a soft suggestion, not a hard floor. Update API Design validation to 0-99900.

---

## Minor Issues (can resolve as encountered)

### N1. Hook Names for Marketplace Contexts

The Frontend Arch and UX Arch disagree on hook names:
- Frontend Arch: `useMarketplace` (line 221)
- UX Arch: `useMarketplaceSearch` (line 274)
- Frontend Arch: `useLawyerDashboard` (line 223)
- UX Arch: `useLawyerAnalytics` (line 276)

**Resolution**: Pick one name per hook during implementation. The Frontend Arch names are more general; prefer those.

---

### N2. `InterviewContext` vs `InterviewShell`

- **Frontend Arch** (line 212): Lists `InterviewContext.js` as a new context
- **UX Arch**: Does not list `InterviewContext` -- instead references `DocumentContext` modifications
- **PRD** (line 1079): References `InterviewShell` as a component name for the refactored `EditorView`

These are not contradictory but should be reconciled -- is the interview state in a context or in the existing DocumentContext?

**Resolution**: Create `InterviewContext` as described in Frontend Arch. Keep `DocumentContext` for backward compatibility with existing interviews.

---

### N3. `AdminPortalView` Referenced But Not Listed

- **Frontend Arch** (line 289): `AdminPortalView` is lazy-loaded
- **Frontend Arch** directory listing: No `AdminPortalView.js` in the views directory
- **UX Arch**: No admin portal view defined

**Resolution**: Add `AdminPortalView.js` to the directory listing. It is Phase 4+, so it can be a placeholder initially.

---

### N4. Container Diagram Table Count

- **Tech Arch** container diagram (line 184): Shows "31 tables" in the PostgreSQL box
- **Tech Arch** (line 2652): "Total tables after migration: 31"
- Existing tables: 13 (from CLAUDE.md: users, user_identities, documents, cases, payments, audit_log, processed_webhooks, document_catalog, interview_phases, plus tables from migration 000 including document_templates, migrations)

18 new + 13 existing = 31. This is consistent, but the existing table count of 13 is approximate. The exact count should be verified against the actual database.

---

### N5. Frontend Service Files Mismatch

- **Frontend Arch** lists 9 new API service files (apiClient, marketplaceApi, lawyerApi, templateApi, payoutApi, reviewApi, affiliateApi, clioApi, realtimeService)
- **UX Arch** does not define service files at all

**Resolution**: Use the Frontend Arch service file list as authoritative.

---

### N6. Zustand vs Context Conflict

- **Frontend Arch** (line 342): Introduces Zustand for template builder state
- **UX Arch** (line 353-391): Uses `TemplateContext` (React Context) for template builder state

**Resolution**: The Frontend Arch decision to use Zustand for the template builder is better justified (deep nested state, undo/redo). Keep Zustand for the builder, Context for everything else. Update UX Arch to reference Zustand.

---

### N7. `GamificationContext` Phase Mismatch

- **Frontend Arch** (line 214): `GamificationContext.js` is marked "Phase 4"
- **PRD** (line 1634-1636): Leaderboards and achievements are Phase 2
- **Tech Arch**: Gamification tables created in Phase 1 migrations

**Resolution**: Move `GamificationContext` to Phase 2 to align with the PRD.

---

### N8. Practice Area Values

- **Tech Arch** (line 239): `practice_area` default is `'civil'`, CHECK not shown
- **API Design** (line 333): `practice_area` must be `family` or `civil`
- **Business Model** / **UX Arch**: Also reference "Family Law" and "Civil Law" categories

This is consistent, but the PRD's category browser (line 869-871) also mentions "Real Estate" as a potential category. Real estate is not in the CHECK constraint.

**Resolution**: Add a note that `practice_area` may need to expand beyond `family`/`civil` in future phases. For now, the two values are sufficient for the 16 matter types.

---

### N9. Marketplace Route Structure

- **UX Arch** (line 152-162): Uses `/marketplace/:templateId` for template detail
- **PRD** (line 881): Uses `/marketplace/t/{slug}` for template detail (slug-based, with `/t/` prefix)

**Resolution**: Use slug-based URLs for SEO (`/marketplace/t/{slug}`). The `:templateId` parameter in UX Arch routes should be the slug, not a numeric ID. Update the UX Arch to clarify.

---

## Gaps (features with no technical coverage)

### G1. Template Bundles -- PRD Feature, No Schema

The Business Model (section 2.15) extensively describes template bundles and they are marked as "ADOPTED Phase 1." However:
- No `template_bundles` table exists in the Tech Arch
- No bundle-related API endpoints exist in the API Design
- No bundle UI components exist in the Frontend Arch

**Impact**: A Phase 1 feature with zero technical design.

**Resolution**: Add a `template_bundles` and `template_bundle_items` table to the Tech Arch. Add CRUD endpoints to the API Design. Add bundle management components to the Frontend Arch.

---

### G2. Claimed Template Fee ($0.50) -- Business Model Feature, No Technical Coverage

The Business Model (section 2.27) describes a $0.50 additional platform fee for templates claimed from the platform library. This is "ADOPTED Phase 2." However:
- No `is_claimed` column exists in the Tech Arch schema
- No conditional `application_fee_amount` logic is described in the Tech Arch Stripe integration
- The API Design does not mention differential pricing for claimed vs original templates

**Resolution**: Add `is_claimed BOOLEAN DEFAULT false` and `claimed_from_template_id INTEGER` to `marketplace_templates`. Document the conditional fee in the Stripe integration section.

---

### G3. Expert Review Add-on -- Business Model Feature, No Technical Coverage

The Business Model (section 2.14) describes an "Expert Review" add-on ($29-$99) that is "ADOPTED Phase 2." No schema, API endpoints, or frontend components exist for this feature.

**Resolution**: Defer full technical design to Phase 2 planning. Note the feature in the Tech Arch as a Phase 2 item so the schema can accommodate it.

---

### G4. Dormancy Reactivation -- Business Model Feature, No Technical Coverage

The Business Model (section 2.28) describes dormancy detection and reactivation emails as "ADOPTED Phase 2." No background job, email template, or ranking decay logic is described in the Tech Arch.

**Resolution**: Add to Phase 2 technical planning.

---

### G5. Boost/Promote Listings -- Business Model Feature, Partial Technical Coverage

The Business Model (section 2.8) describes listing boosts ($3/$5/$10) as "ADOPTED Phase 2." The Tech Arch has a `featured_placements` table that could support this, but there is no explicit boost pricing or endpoint in the API Design.

**Resolution**: Map the `featured_placements` table to the boost feature. Add boost endpoints to the API Design in Phase 2.

---

### G6. Pioneer Program -- Business Model Feature, No Schema

The Business Model (section 2.22) describes a Pioneer program with optional $25 paid sponsorship, 90-day exclusivity. No `pioneer_claims` table or related schema exists.

**Resolution**: This can be implemented with columns on `template_categories` or a new `pioneer_claims` table. Design during Phase 1 implementation since it is "ADOPTED Phase 1."

---

### G7. Quality Score -- PRD Feature, No Computation Service

The PRD (section 5.12.2) defines a Quality Score algorithm with specific weights (40% rating, 30% completion, 20% refund, 10% credentials). No service in the Tech Arch computes or stores this score.

**Resolution**: Add a `quality_score NUMERIC(5,2)` column to `marketplace_templates` and a cron job to the GamificationService that recomputes it nightly.

---

### G8. Compare Templates Feature -- PRD User Story, No Technical Design

User story US-MD-06 in the PRD describes a "compare templates" feature (up to 3 side-by-side). No API endpoint, frontend component, or route exists for this.

**Resolution**: This can be implemented client-side (fetch 3 template details and render a comparison table). Add a `TemplateCompare` component (already in PRD Appendix C) and a `/marketplace/compare` route.

---

### G9. Refund Requests Table Missing from Tech Arch

The PRD (line 1800) lists `refund_requests` in migration 023. The Tech Arch does not define this table. The `template_purchases` table has `refund_status` and `refunded_amount_cents` but no separate refund request workflow table.

**Resolution**: If refund requests need a queue (admin review before processing), add a `refund_requests` table. If refunds are simple status changes on `template_purchases`, remove the reference from the PRD.

---

### G10. SSE (Server-Sent Events) Endpoint Not in API Design

The Frontend Arch (section 8) describes SSE for real-time revenue notifications and view counts. The API Design does not define an SSE endpoint.

**Resolution**: Add `GET /api/v1/lawyer/events/stream` (SSE) to the API Design doc.

---

### G11. `email_notifications` Table Does Not Exist

As noted in M9, the PRD references this table but it does not exist in the codebase or any migration.

---

### G12. Existing PRICING_CONFIG Not Addressed

The existing codebase has `PRICING_CONFIG` with `single_affidavit: 7900, divorce_package: 24900, all_state_access: 19999`. No document addresses how this existing pricing coexists with marketplace pricing. Do existing non-marketplace documents still use this pricing? Does the marketplace replace it?

**Resolution**: Document that existing PRICING_CONFIG applies to first-party templates only. Marketplace templates use lawyer-set pricing. Both paths coexist.

---

### G13. Existing `document_templates` Table Reuse

The PRD (line 82, 1957) notes that the existing `document_templates` table already has `is_public`, `is_premium`, `price_cents`, `applicable_states` columns. However, the Tech Arch creates a NEW `marketplace_templates` table rather than extending the existing one.

**Issue**: Should the marketplace use the existing table or the new one? No document explicitly addresses this.

**Resolution**: Use the new `marketplace_templates` table for marketplace content. The existing `document_templates` table continues to serve first-party templates. Document this coexistence.

---

### G14. `InterviewShell` Not in Component Lists

The PRD (line 1079, 1946) references `InterviewShell` as the refactored name for `EditorView`. Neither the Frontend Arch nor UX Arch includes a component named `InterviewShell` -- they both reference the existing `EditorView` being modified.

**Resolution**: Decide whether to rename `EditorView` to `InterviewShell` or keep the existing name. If renaming, update both frontend docs.

---

## Alignment Confirmations

These are items that ARE consistent across all documents -- good to document as settled:

### A1. $1 Platform Fee
All 6 documents agree: the platform charges a flat $1.00 per document, additive on top of the lawyer's price. The only exception is the Tech Arch's revenue split table for "$1.00 documents" (flagged in C6).

### A2. Subscription Tier Prices
All documents agree on the price points: Free / $1 / $3 / $5 / $10 / $25 / $49 per month. (The feature mapping at each tier varies -- see C2 and C3.)

### A3. Affiliate Commission
All documents agree: $0.25 flat per conversion, platform-funded from the $1 fee, 30-day last-click attribution, minimum $10 payout threshold. Lawyer can increase up to $5.00 (excess from their revenue).

### A4. Lawyer-to-Lawyer Referral
All documents agree: $5 one-time per referred lawyer who publishes their first template.

### A5. Stripe Connect Express
All documents agree: Lawyer payouts use Stripe Connect Express with destination charges. `application_fee_amount: 100` (cents).

### A6. Auth0 JWT with Custom Claims
All documents agree on the claims namespace `https://discover.legal/` and the role extraction pattern.

### A7. DynamicOrchestrator Pattern
The PRD, Tech Arch, and UX Arch all agree on the pattern: `OrchestratorFactory` checks for `marketplaceTemplateId`, loads JSONB config from DB, instantiates `DynamicOrchestrator` which extends `BaseMatterOrchestrator`. Existing 134 orchestrator files remain as fallback.

### A8. 12 Migrations (014-025)
All documents agree on 12 new migrations numbered 014-025. (The content of each migration differs -- see C5.)

---

## Recommended Resolutions

### Priority 1 (before any implementation begins):

| Issue | Action | Update Docs |
|-------|--------|-------------|
| C2 (Clio tier) | Decide: $5 standalone (majority) or $25 bundle only. Recommended: $5 standalone, also in $25+ bundle. | Business Model |
| C3 (tier model) | Decide: additive or cumulative. Recommended: cumulative (Business Model pattern). | PRD, Tech Arch, API Design |
| C5 (migration plan) | Adopt Tech Arch migration plan as authoritative. | PRD |
| C7 (API prefix) | Use `/api/` without version prefix. | API Design |
| C1 (endpoint count) | Recount from API Design, update PRD appendix. | PRD, Project Memory |

### Priority 2 (during Phase 1 implementation):

| Issue | Action | Update Docs |
|-------|--------|-------------|
| C4 (affiliate tables) | Use Tech Arch table names. | PRD, API Design |
| C6 (revenue split) | Remove/correct Tech Arch section 4.1.6 table. | Tech Arch |
| M1 (affiliate role) | Remove `affiliate` from user_role CHECK. | Tech Arch |
| M2 (review schema) | Use Tech Arch schema. | PRD |
| M3 (status values) | Establish canonical set of 6 statuses. | All docs |
| G1 (bundles schema) | Design bundle tables. | Tech Arch, API Design |
| G6 (pioneer schema) | Design pioneer tracking. | Tech Arch |
| M8 (phase assignments) | Ship all migrations in Phase 1; phase the features. | PRD, Tech Arch |

### Priority 3 (before Phase 2 begins):

| Issue | Action | Update Docs |
|-------|--------|-------------|
| G2 (claimed fee) | Add `is_claimed` column and conditional fee logic. | Tech Arch |
| G3 (expert review) | Full technical design for expert review add-on. | Tech Arch, API Design |
| G5 (boost listings) | Map featured_placements to boost feature, add endpoints. | API Design |
| G7 (quality score) | Add score column and computation job. | Tech Arch |
| G10 (SSE endpoint) | Add SSE endpoint to API Design. | API Design |
