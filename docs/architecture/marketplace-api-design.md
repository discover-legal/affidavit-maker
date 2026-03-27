# Marketplace API Design

**Author**: Backend API Architecture
**Date**: 2026-03-26
**Status**: Proposal
**Branch**: doc-marketplace

---

## Table of Contents

1. [Design Principles](#1-design-principles)
2. [API Versioning Strategy](#2-api-versioning-strategy)
3. [Authentication and Role Model](#3-authentication-and-role-model)
4. [Pagination Pattern](#4-pagination-pattern)
5. [Rate Limiting Strategy](#5-rate-limiting-strategy)
6. [Error Code Catalog](#6-error-code-catalog)
7. [Marketplace Discovery Endpoints](#7-marketplace-discovery-endpoints)
8. [Lawyer Template Management](#8-lawyer-template-management)
9. [Lawyer Template Builder](#9-lawyer-template-builder)
10. [Lawyer Profile and Dashboard](#10-lawyer-profile-and-dashboard)
11. [Lawyer Payouts](#11-lawyer-payouts)
12. [Lawyer Subscriptions](#12-lawyer-subscriptions)
13. [Client Marketplace](#13-client-marketplace)
14. [Reviews and Ratings](#14-reviews-and-ratings)
15. [Affiliate System](#15-affiliate-system)
16. [Clio Integration](#16-clio-integration)
17. [Gamification and Engagement](#17-gamification-and-engagement)
18. [Admin and Moderation](#18-admin-and-moderation)
19. [Webhook Endpoints](#19-webhook-endpoints)
20. [Webhook Payload Schemas](#20-webhook-payload-schemas)
21. [OpenAPI Considerations](#21-openapi-considerations)

---

## 1. Design Principles

All new marketplace endpoints follow the conventions established in the existing codebase:

- **Response envelope**: Every response uses `{ success, data, timestamp }` on success and `{ success, error, errorType, requestId, timestamp }` on failure. Response helpers in `utils/responseHelpers.js` produce these.
- **Auth middleware chain**: `rateLimiter -> auth0Middleware -> requireDbClient -> validation -> asyncHandler(handler)`. Public endpoints substitute `optionalAuth` for `auth0Middleware`.
- **RLS**: All authenticated routes receive `req.dbClient` (an RLS-scoped database connection). Ownership checks (`user_id = $1`) are defense-in-depth on top of RLS policies.
- **Parameterized SQL**: Every query uses positional parameters (`$1`, `$2`). No string interpolation.
- **Server-side pricing**: Amounts are never accepted from the client. The server looks up prices from configuration or the database.
- **Route files**: Each domain area gets its own file in `/routes/`. The `server.js` mounts them under their prefix.

### Existing Endpoints (reference only -- not duplicated here)

| Prefix | Description |
|--------|-------------|
| `POST /api/auth/*` | Auth0 flows |
| `GET/POST/PUT /api/documents` | Document CRUD |
| `POST /api/chat` | AI chat interface |
| `GET/POST/PUT /api/cases` | Case profiles |
| `GET /api/catalog/*` | Matter/document type catalog |
| `POST /api/payment/*` | Stripe payment intents/webhooks |
| `GET /api/templates` | Template metadata |
| `POST /api/validation` | Enhanced validation |
| `POST /api/evidence` | Evidence uploads |

These continue to work unchanged. New marketplace routes are mounted alongside them.

---

## 2. API Versioning Strategy

### Approach: Shared `/api/` prefix

New marketplace endpoints use the same `/api/` prefix as existing endpoints, consistent with the current codebase. Future API versioning will use the `X-API-Version` header if needed, not URL prefixes.

```
# New marketplace endpoints
/api/marketplace/templates
/api/lawyer/templates
/api/client/purchases
/api/admin/templates/review

# Existing endpoints (unchanged)
/api/documents
/api/chat
/api/cases
```

### Version header (optional, advisory)

Clients may send `X-API-Version: 2026-03-26` to pin behavior for a specific API snapshot. The server includes `X-API-Version` in every response indicating the active version. This is informational for the initial release; it becomes functional if backward-incompatible changes are introduced later.

### Deprecation policy

- Deprecated endpoints return a `Sunset` header with the removal date.
- Deprecated endpoints return a `Deprecation: true` header.
- Minimum 90-day notice before removal.

---

## 3. Authentication and Role Model

### Roles

| Role | Assigned when | Access |
|------|---------------|--------|
| `client` | Default on signup | Browse marketplace, purchase templates, complete interviews |
| `lawyer` | After bar verification is approved by admin | Create/manage templates, view revenue, receive payouts |
| `admin` | Manual assignment | Moderate templates, manage lawyers, view platform analytics |

Roles are stored as Auth0 custom claims on the JWT:

```json
{
  "https://discover.legal/roles": ["lawyer"],
  "https://discover.legal/lawyer_id": "law_abc123",
  "https://discover.legal/stripe_account_id": "acct_1234"
}
```

### Role-checking middleware

A new `requireRole(role)` middleware is added to `/middleware/auth0Middleware.js`:

```javascript
const requireRole = (...roles) => (req, res, next) => {
  const userRoles = req.user?.roles || ['client'];
  if (!roles.some(r => userRoles.includes(r))) {
    throw new AuthorizationError('Insufficient permissions for this action');
  }
  next();
};
```

All `/api/lawyer/*` routes use `requireRole('lawyer')`. All `/api/admin/*` routes use `requireRole('admin')`. Public endpoints use `optionalAuth`.

### Role enforcement summary

| Prefix | Auth | Role |
|--------|------|------|
| `/api/marketplace/*` | `optionalAuth` (public reads) | none |
| `/api/lawyer/*` | `auth0Middleware` | `lawyer` |
| `/api/client/*` | `auth0Middleware` | `client` (or `lawyer` -- lawyers can also be clients) |
| `/api/affiliates/*` | `auth0Middleware` | any authenticated |
| `/api/gamification/*` | `auth0Middleware` | any authenticated |
| `/api/integrations/*` | `auth0Middleware` | `lawyer` |
| `/api/admin/*` | `auth0Middleware` | `admin` |
| `/api/webhooks/*` | Stripe/Clio signature verification | none (machine-to-machine) |

---

## 4. Pagination Pattern

### Cursor-based pagination (marketplace browse)

Marketplace listing endpoints use cursor-based pagination for stable, efficient page traversal over large and frequently-changing datasets.

**Query parameters**:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `cursor` | string | `null` | Opaque cursor from previous response. Omit for first page. |
| `limit` | integer | `20` | Items per page. Min 1, max 100. |
| `sort` | string | `relevance` | Sort field. Values: `relevance`, `newest`, `price_asc`, `price_desc`, `rating`, `popular`. |

**Response pagination block**:

```json
{
  "success": true,
  "data": [ ... ],
  "pagination": {
    "cursor": "eyJpZCI6MTIzLCJzIjoxNzExMjMwMDAwfQ==",
    "hasMore": true,
    "total": 847
  },
  "timestamp": "2026-03-26T12:00:00.000Z"
}
```

The cursor is a base64-encoded JSON object containing the last item's sort key and ID. The server decodes it to build a `WHERE (sort_col, id) > ($1, $2)` keyset clause. If `cursor` is null, the query starts from the beginning.

### Offset-based pagination (dashboard lists)

Lawyer dashboard and admin endpoints use traditional offset-based pagination because the datasets are smaller and page-number navigation is expected.

**Query parameters**:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | `1` | Page number. Min 1, max 1000. |
| `limit` | integer | `20` | Items per page. Min 1, max 100. |

**Response pagination block** (uses existing `res.sendPaginated`):

```json
{
  "success": true,
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 42,
    "totalPages": 3,
    "hasNext": true,
    "hasPrev": false
  },
  "timestamp": "2026-03-26T12:00:00.000Z"
}
```

---

## 5. Rate Limiting Strategy

New rate limiter tiers added to `middleware/rateLimiting.js`:

| Limiter | Window | Max | Endpoints |
|---------|--------|-----|-----------|
| `marketplaceBrowseLimiter` | 15 min | 300 | Public marketplace browse/search |
| `templateMutationLimiter` | 15 min | 30 | Lawyer template create/update/delete |
| `purchaseLimiter` | 1 hour | 10 | Client purchases (creation of payment intents) |
| `interviewChatLimiter` | 15 min | 60 | Interview chat messages |
| `reviewLimiter` | 1 hour | 5 | Review submission |
| `affiliateLimiter` | 15 min | 50 | Affiliate link/stats |
| `adminLimiter` | 15 min | 200 | Admin operations |
| `webhookLimiter` | 1 min | 100 | Inbound webhooks |
| `clioLimiter` | 15 min | 30 | Clio integration sync |

All limiters use the same `keyGenerator` pattern (user ID if authenticated, IP otherwise) and the same `rateLimitHandler` response format as existing limiters.

---

## 6. Error Code Catalog

New error types returned in the `errorType` field, extending the existing set.

### Existing error types (unchanged)

| errorType | HTTP | Description |
|-----------|------|-------------|
| `validation_error` | 400 | Input validation failure |
| `authentication_error` | 401 | Missing or invalid token |
| `authorization_error` | 403 | Insufficient permissions |
| `not_found_error` | 404 | Resource does not exist |
| `rate_limit_error` | 429 | Too many requests |
| `server_error` | 500 | Internal error |
| `external_service_error` | 503 | Third-party service down |
| `payment_error` | 400 | Stripe payment failure |
| `conflict_error` | 409 | Duplicate record |

### New marketplace error types

| errorType | HTTP | Description |
|-----------|------|-------------|
| `template_not_published` | 400 | Attempt to purchase an unpublished template |
| `template_already_published` | 409 | Attempt to publish a template that is already live |
| `template_under_review` | 409 | Template is pending moderation review |
| `template_suspended` | 403 | Template has been suspended by admin |
| `template_version_conflict` | 409 | Concurrent edit detected on template version |
| `purchase_already_exists` | 409 | Client already purchased this template |
| `interview_completed` | 400 | Interview is already completed; cannot send more messages |
| `interview_not_started` | 400 | Interview has not been started yet |
| `payout_not_ready` | 400 | Stripe Connect onboarding incomplete |
| `payout_insufficient_balance` | 400 | Insufficient balance for payout request |
| `subscription_required` | 403 | Feature requires a higher subscription tier |
| `subscription_already_active` | 409 | Already subscribed to this tier |
| `bar_verification_pending` | 403 | Bar verification not yet approved |
| `bar_verification_rejected` | 403 | Bar verification was rejected |
| `clio_not_connected` | 400 | Clio integration not connected |
| `clio_token_expired` | 401 | Clio OAuth token expired, reconnection needed |
| `affiliate_already_registered` | 409 | User is already an affiliate |
| `review_already_submitted` | 409 | User already reviewed this template |
| `review_not_purchaser` | 403 | User must purchase a template before reviewing it |
| `moderation_action_conflict` | 409 | Template already moderated in this state |
| `flag_already_resolved` | 409 | Flag has already been resolved |

### New error classes

Added to `middleware/errorMiddleware.js`:

```javascript
class SubscriptionRequiredError extends AppError {
  constructor(requiredTier, message) {
    super(message || `This feature requires a ${requiredTier} subscription`, 403, 'subscription_required');
    this.requiredTier = requiredTier;
  }
}

class TemplateStateError extends AppError {
  constructor(message, currentState) {
    super(message, 400, 'template_state_error');
    this.currentState = currentState;
  }
}
```

---

## 7. Marketplace Discovery Endpoints

Route file: `routes/marketplace.js`
Mounted at: `/api/marketplace`

All endpoints in this section are public (use `optionalAuth`). When an authenticated user makes the request, the response may include personalized data (e.g., whether the user already purchased a template).

---

### 7.1 GET /api/marketplace/templates

Browse and search marketplace templates with filtering.

**Auth**: Public (`optionalAuth`)
**Rate limit**: `marketplaceBrowseLimiter` (300/15min)

**Query parameters**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `cursor` | string | no | null | Pagination cursor |
| `limit` | integer | no | 20 | Items per page (1-100) |
| `sort` | string | no | `relevance` | Sort: `relevance`, `newest`, `price_asc`, `price_desc`, `rating`, `popular` |
| `q` | string | no | null | Full-text search query. Max 200 chars. |
| `jurisdiction` | string | no | null | Jurisdiction code (e.g., `TX`, `ON`, `CA`). Comma-separated for multiple. |
| `matter_type` | string | no | null | Matter type code (e.g., `divorce`, `custody`). Comma-separated for multiple. |
| `practice_area` | string | no | null | `family` or `civil` |
| `price_min` | integer | no | null | Minimum price in cents |
| `price_max` | integer | no | null | Maximum price in cents |
| `rating_min` | number | no | null | Minimum average rating (1.0-5.0) |
| `lawyer_id` | string | no | null | Filter by lawyer (show all templates by one lawyer) |
| `tag` | string | no | null | Filter by tag. Comma-separated for multiple. |

**Validation rules**:
- `limit`: integer, 1-100
- `q`: string, max 200 characters, sanitized (HTML stripped)
- `jurisdiction`: each code must match `/^[A-Z_]{2,5}$/`
- `matter_type`: each code must match `/^[a-z_]{2,30}$/`
- `practice_area`: must be one of `family`, `civil`
- `price_min`, `price_max`: integer >= 0; `price_min <= price_max` if both present
- `rating_min`: number 1.0-5.0, one decimal place

**Success response** (200):

```json
{
  "success": true,
  "data": [
    {
      "id": "tpl_abc123",
      "title": "Texas No-Fault Divorce Petition",
      "slug": "texas-no-fault-divorce-petition",
      "description": "Complete Texas divorce petition with...",
      "matter_type": "divorce",
      "practice_area": "family",
      "jurisdictions": ["TX"],
      "price_cents": 4900,
      "currency": "usd",
      "lawyer": {
        "id": "law_xyz789",
        "display_name": "Jane Smith, Esq.",
        "avatar_url": "https://...",
        "verified": true
      },
      "stats": {
        "avg_rating": 4.7,
        "review_count": 142,
        "purchase_count": 1893,
        "completion_rate": 0.94
      },
      "tags": ["no-fault", "uncontested", "no-children"],
      "featured": false,
      "created_at": "2026-02-15T10:00:00.000Z",
      "updated_at": "2026-03-20T14:30:00.000Z"
    }
  ],
  "pagination": {
    "cursor": "eyJpZCI6MTIzLCJzIjoxNzExMjMwMDAwfQ==",
    "hasMore": true,
    "total": 847
  },
  "facets": {
    "matter_types": [
      { "code": "divorce", "count": 312 },
      { "code": "custody", "count": 198 }
    ],
    "jurisdictions": [
      { "code": "TX", "count": 89 },
      { "code": "CA", "count": 76 }
    ],
    "price_ranges": [
      { "min": 0, "max": 2500, "count": 145 },
      { "min": 2500, "max": 5000, "count": 312 },
      { "min": 5000, "max": 10000, "count": 287 },
      { "min": 10000, "max": null, "count": 103 }
    ]
  },
  "timestamp": "2026-03-26T12:00:00.000Z"
}
```

**Error responses**:

| Status | errorType | Cause |
|--------|-----------|-------|
| 400 | `validation_error` | Invalid query parameters |
| 429 | `rate_limit_error` | Rate limit exceeded |

**Business logic**:
- Only returns templates with `status = 'published'`.
- `relevance` sort uses PostgreSQL full-text search ranking (`ts_rank`) when `q` is present, otherwise falls back to a composite score of recency, rating, and purchase count.
- Facet counts reflect the current filter state (excluding the facet's own filter).
- If `req.user` is present, each template object includes a `purchased: true/false` field.

**RLS**: Not applicable (public read from `marketplace_templates` where `status = 'published'`). The query runs against the pool directly, not an RLS-scoped client.

---

### 7.2 GET /api/marketplace/templates/:id

Get full detail for a single published template.

**Auth**: Public (`optionalAuth`)
**Rate limit**: `marketplaceBrowseLimiter`

**Path parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Template ID (format: `tpl_[a-zA-Z0-9]{10,20}`) |

**Success response** (200):

```json
{
  "success": true,
  "data": {
    "id": "tpl_abc123",
    "title": "Texas No-Fault Divorce Petition",
    "slug": "texas-no-fault-divorce-petition",
    "description": "Complete Texas divorce petition covering...",
    "long_description": "This template walks you through...",
    "matter_type": "divorce",
    "practice_area": "family",
    "jurisdictions": ["TX"],
    "document_types_produced": ["divorce_petition", "waiver_of_service"],
    "price_cents": 4900,
    "currency": "usd",
    "estimated_completion_minutes": 25,
    "phase_count": 6,
    "phase_names": ["Petitioner Info", "Respondent Info", "Marriage Details", "Children", "Property", "Review"],
    "lawyer": {
      "id": "law_xyz789",
      "display_name": "Jane Smith, Esq.",
      "firm_name": "Smith Family Law PLLC",
      "avatar_url": "https://...",
      "bio": "Board-certified family law attorney...",
      "bar_number": "12345678",
      "bar_state": "TX",
      "verified": true,
      "template_count": 12,
      "total_reviews": 456
    },
    "stats": {
      "avg_rating": 4.7,
      "review_count": 142,
      "purchase_count": 1893,
      "completion_rate": 0.94
    },
    "tags": ["no-fault", "uncontested", "no-children"],
    "requirements": [
      "Both spouses must have lived in Texas for at least 6 months",
      "You must know the county where you will file"
    ],
    "what_you_get": [
      "Original Petition for Divorce",
      "Waiver of Citation and Acceptance of Service",
      "Final Decree of Divorce"
    ],
    "faq": [
      {
        "question": "Do I need to serve my spouse?",
        "answer": "If your spouse signs the waiver..."
      }
    ],
    "similar_templates": [
      { "id": "tpl_def456", "title": "Texas Contested Divorce", "price_cents": 7900 }
    ],
    "purchased": false,
    "featured": false,
    "version": 3,
    "published_at": "2026-02-15T10:00:00.000Z",
    "updated_at": "2026-03-20T14:30:00.000Z"
  },
  "timestamp": "2026-03-26T12:00:00.000Z"
}
```

**Error responses**:

| Status | errorType | Cause |
|--------|-----------|-------|
| 400 | `validation_error` | Invalid template ID format |
| 404 | `not_found_error` | Template not found or not published |

**Business logic**:
- Only returns templates with `status = 'published'`.
- Increments `view_count` on the template (fire-and-forget, not blocking the response).
- `similar_templates` is a lightweight recommendation based on same jurisdiction + matter type, limited to 4 items.
- `purchased` is only present when `req.user` is authenticated.

---

### 7.3 GET /api/marketplace/templates/:id/preview

Preview the interview flow of a template before purchasing. Returns phase names and sample questions, but not the full AI prompts or internal configuration.

**Auth**: Public (`optionalAuth`)
**Rate limit**: `marketplaceBrowseLimiter`

**Path parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Template ID |

**Success response** (200):

```json
{
  "success": true,
  "data": {
    "template_id": "tpl_abc123",
    "title": "Texas No-Fault Divorce Petition",
    "phases": [
      {
        "name": "Petitioner Info",
        "description": "We will collect your personal information.",
        "estimated_minutes": 5,
        "sample_questions": [
          "What is your full legal name?",
          "What is your date of birth?"
        ]
      },
      {
        "name": "Marriage Details",
        "description": "Information about your marriage.",
        "estimated_minutes": 4,
        "sample_questions": [
          "When and where were you married?",
          "What are the grounds for divorce?"
        ]
      }
    ],
    "total_estimated_minutes": 25,
    "documents_produced": ["Original Petition for Divorce", "Final Decree of Divorce"]
  },
  "timestamp": "2026-03-26T12:00:00.000Z"
}
```

**Business logic**:
- Returns at most 2 sample questions per phase (not the full question list).
- AI prompt text is never exposed.

---

### 7.4 GET /api/marketplace/featured

Return featured/promoted templates. These are editorially selected or algorithmically boosted.

**Auth**: Public (`optionalAuth`)
**Rate limit**: `marketplaceBrowseLimiter`

**Query parameters**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `limit` | integer | no | 12 | Max items (1-50) |
| `jurisdiction` | string | no | null | Filter by jurisdiction |

**Success response** (200):

```json
{
  "success": true,
  "data": {
    "featured": [
      {
        "id": "tpl_abc123",
        "title": "Texas No-Fault Divorce Petition",
        "description": "...",
        "price_cents": 4900,
        "lawyer": { "display_name": "Jane Smith, Esq.", "verified": true },
        "stats": { "avg_rating": 4.7, "review_count": 142 },
        "featured_reason": "top_rated"
      }
    ],
    "categories": [
      {
        "name": "Most Popular in Texas",
        "templates": [ ... ]
      }
    ]
  },
  "timestamp": "2026-03-26T12:00:00.000Z"
}
```

**Business logic**:
- `featured_reason` values: `editor_pick`, `top_rated`, `most_purchased`, `trending`, `new_notable`.
- Personalized by jurisdiction if `req.user` has a stored state preference.

---

### 7.5 GET /api/marketplace/categories

Return all template categories with counts.

**Auth**: Public
**Rate limit**: `marketplaceBrowseLimiter`

**Success response** (200):

```json
{
  "success": true,
  "data": [
    {
      "code": "family",
      "display_name": "Family Law",
      "matters": [
        { "code": "divorce", "display_name": "Divorce", "template_count": 312 },
        { "code": "custody", "display_name": "Child Custody", "template_count": 198 }
      ],
      "total_templates": 892
    },
    {
      "code": "civil",
      "display_name": "Civil Law",
      "matters": [
        { "code": "small_claims", "display_name": "Small Claims", "template_count": 87 }
      ],
      "total_templates": 445
    }
  ],
  "timestamp": "2026-03-26T12:00:00.000Z"
}
```

**Business logic**:
- Category structure mirrors the existing `MATTER_TYPES` in `routes/catalog.js`.
- Counts reflect only published templates.
- Response is cached for 5 minutes in memory (categories change infrequently).

---

### 7.6 GET /api/marketplace/search (alias)

**Deprecated alias** for `GET /api/marketplace/templates?q=...`. This endpoint redirects to the combined browse+search endpoint (section 7.1) with the same query parameters. Clients should use `GET /api/marketplace/templates` directly.

When the `q` query parameter is present on `GET /api/marketplace/templates`, full-text search activates automatically:
- Uses PostgreSQL `tsvector` full-text search on `title`, `description`, `tags`, and `jurisdiction` fields.
- Response includes `highlight` (via `ts_headline`) and `relevance_score` for each result.
- `relevance` sort uses `ts_rank` when `q` is present.
- Faceted results (`facets` block) are included when `q` is present.
- Search queries are logged (anonymized) for analytics.

**Implementation**: The route handler for `/api/marketplace/search` internally calls the same service method as `/api/marketplace/templates`, passing all query parameters through. The response format is identical. This alias will be removed in a future release.

---

### 7.7 GET /api/marketplace/trending

Trending templates ranked by recent purchase velocity.

**Auth**: Public (`optionalAuth`)
**Rate limit**: `marketplaceBrowseLimiter`

**Query parameters**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `limit` | integer | no | 20 | Max items (1-50) |
| `period` | string | no | `week` | Time window: `day`, `week`, `month` |
| `jurisdiction` | string | no | null | Filter by jurisdiction |
| `matter_type` | string | no | null | Filter by matter type |

**Success response** (200):

```json
{
  "success": true,
  "data": [
    {
      "rank": 1,
      "id": "tpl_abc123",
      "title": "Texas No-Fault Divorce Petition",
      "price_cents": 4900,
      "lawyer": { "display_name": "Jane Smith, Esq.", "verified": true },
      "stats": { "avg_rating": 4.7, "purchases_this_period": 87 },
      "trend": "up"
    }
  ],
  "period": "week",
  "timestamp": "2026-03-26T12:00:00.000Z"
}
```

**Business logic**:
- Ranking uses a velocity formula: `purchases_in_period / days_in_period`, weighted by recency.
- `trend` is `up`, `down`, or `stable` compared to the previous period.
- Cached for 15 minutes.

---

### 7.8 GET /api/marketplace/new

Newly published templates.

**Auth**: Public (`optionalAuth`)
**Rate limit**: `marketplaceBrowseLimiter`

**Query parameters**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `limit` | integer | no | 20 | Max items (1-50) |
| `jurisdiction` | string | no | null | Filter by jurisdiction |
| `matter_type` | string | no | null | Filter by matter type |

**Success response** (200): Same shape as trending, sorted by `published_at` descending.

**Business logic**:
- Returns templates published within the last 30 days.

---

### 7.9 GET /api/marketplace/jurisdictions/:code

Templates available for a specific jurisdiction.

**Auth**: Public (`optionalAuth`)
**Rate limit**: `marketplaceBrowseLimiter`

**Path parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `code` | string | Jurisdiction code (e.g., `TX`, `ON`, `ENG`). Must match `/^[A-Z_]{2,5}$/`. |

**Query parameters**: Same as `GET /marketplace/templates` (cursor, limit, sort, matter_type, price_min, price_max, rating_min).

**Success response** (200):

```json
{
  "success": true,
  "data": {
    "jurisdiction": {
      "code": "TX",
      "name": "Texas",
      "country": "US",
      "template_count": 89
    },
    "templates": [ ... ],
    "popular_matter_types": [
      { "code": "divorce", "count": 34 },
      { "code": "custody", "count": 21 }
    ]
  },
  "pagination": { "cursor": "...", "hasMore": true, "total": 89 },
  "timestamp": "2026-03-26T12:00:00.000Z"
}
```

**Error responses**:

| Status | errorType | Cause |
|--------|-----------|-------|
| 400 | `validation_error` | Invalid jurisdiction code format |
| 404 | `not_found_error` | Unknown jurisdiction code |

**Business logic**:
- Jurisdiction codes are validated against the master list in `config/jurisdictions.js`.
- International jurisdictions return 404 when `ENABLE_INTERNATIONAL=false`.

---

### 7.10 GET /api/marketplace/matters/:type

Templates for a specific matter type.

**Auth**: Public (`optionalAuth`)
**Rate limit**: `marketplaceBrowseLimiter`

**Path parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `type` | string | Matter type code (e.g., `divorce`, `custody`). Must match `/^[a-z_]{2,30}$/`. |

**Query parameters**: Same as `GET /marketplace/templates` (cursor, limit, sort, jurisdiction, price_min, price_max, rating_min).

**Success response** (200):

```json
{
  "success": true,
  "data": {
    "matter_type": {
      "code": "divorce",
      "display_name": "Divorce / Dissolution of Marriage",
      "practice_area": "family",
      "template_count": 312
    },
    "templates": [ ... ],
    "popular_jurisdictions": [
      { "code": "TX", "count": 34 },
      { "code": "CA", "count": 28 }
    ]
  },
  "pagination": { "cursor": "...", "hasMore": true, "total": 312 },
  "timestamp": "2026-03-26T12:00:00.000Z"
}
```

**Error responses**:

| Status | errorType | Cause |
|--------|-----------|-------|
| 400 | `validation_error` | Invalid matter type format |
| 404 | `not_found_error` | Unknown matter type code |

---

## 8. Lawyer Template Management

Route file: `routes/lawyerTemplates.js`
Mounted at: `/api/lawyer/templates`

All endpoints require `auth0Middleware` + `requireRole('lawyer')`.

---

### 8.1 POST /api/lawyer/templates

Create a new template. Returns the template in draft state.

**Auth**: Lawyer
**Rate limit**: `templateMutationLimiter` (30/15min)

**Request body** (JSON):

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| `title` | string | yes | 3-200 chars, sanitized | Template title |
| `description` | string | yes | 10-2000 chars, sanitized | Short description |
| `long_description` | string | no | max 10000 chars | Detailed description (markdown) |
| `matter_type` | string | yes | Must match known matter type code | e.g., `divorce` |
| `jurisdictions` | string[] | yes | 1-20 items, each valid jurisdiction code | Jurisdictions this template serves |
| `price_cents` | integer | yes | 0-99900 | Price in cents ($0.00 - $999.00). 0 = free (legal aid use cases). |
| `currency` | string | no | `usd` (only supported value) | Currency |
| `tags` | string[] | no | 0-10 items, each 2-30 chars | Searchable tags |
| `requirements` | string[] | no | 0-20 items, each max 500 chars | Requirements shown to buyer |
| `what_you_get` | string[] | no | 0-20 items, each max 500 chars | Documents produced |
| `faq` | object[] | no | 0-20 items | FAQ pairs |
| `faq[].question` | string | conditional | max 500 chars | FAQ question |
| `faq[].answer` | string | conditional | max 2000 chars | FAQ answer |
| `estimated_completion_minutes` | integer | no | 5-120 | Estimated interview time |

**Example request**:

```json
{
  "title": "Texas No-Fault Divorce Petition",
  "description": "Complete uncontested divorce petition for Texas, including waiver of service.",
  "matter_type": "divorce",
  "jurisdictions": ["TX"],
  "price_cents": 4900,
  "tags": ["no-fault", "uncontested"],
  "requirements": [
    "Both spouses must have lived in Texas for at least 6 months"
  ],
  "what_you_get": [
    "Original Petition for Divorce",
    "Waiver of Citation",
    "Final Decree of Divorce"
  ],
  "estimated_completion_minutes": 25
}
```

**Success response** (201):

```json
{
  "success": true,
  "data": {
    "id": "tpl_abc123",
    "title": "Texas No-Fault Divorce Petition",
    "slug": "texas-no-fault-divorce-petition",
    "status": "draft",
    "version": 1,
    "lawyer_id": "law_xyz789",
    "matter_type": "divorce",
    "jurisdictions": ["TX"],
    "price_cents": 4900,
    "currency": "usd",
    "tags": ["no-fault", "uncontested"],
    "phases": [],
    "created_at": "2026-03-26T12:00:00.000Z",
    "updated_at": "2026-03-26T12:00:00.000Z"
  },
  "timestamp": "2026-03-26T12:00:00.000Z"
}
```

**Error responses**:

| Status | errorType | Cause |
|--------|-----------|-------|
| 400 | `validation_error` | Missing or invalid fields |
| 403 | `bar_verification_pending` | Lawyer not yet verified |
| 409 | `conflict_error` | Slug collision (auto-retries with suffix) |

**Business logic**:
- Slug is auto-generated from title using `slugify()`. On collision, appends `-2`, `-3`, etc.
- Template is created in `draft` status. No public visibility until published.
- `lawyer_id` is derived from `req.user`, never from the request body.
- Free tier lawyers are limited to 3 templates total. Exceeding returns 403 with `subscription_required`.

**RLS**: Insert uses `req.user.id` as `lawyer_user_id`. RLS policy ensures the lawyer can only see their own templates.

---

### 8.2 GET /api/lawyer/templates

List the authenticated lawyer's own templates (all statuses).

**Auth**: Lawyer
**Rate limit**: `standardLimiter`

**Query parameters**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `page` | integer | no | 1 | Page number |
| `limit` | integer | no | 20 | Items per page (1-100) |
| `status` | string | no | null | Filter: `draft`, `pending_review`, `published`, `unpublished`, `suspended` |
| `sort` | string | no | `updated_at_desc` | Sort: `updated_at_desc`, `created_at_desc`, `title_asc`, `revenue_desc` |

**Success response** (200):

```json
{
  "success": true,
  "data": [
    {
      "id": "tpl_abc123",
      "title": "Texas No-Fault Divorce Petition",
      "status": "published",
      "version": 3,
      "matter_type": "divorce",
      "jurisdictions": ["TX"],
      "price_cents": 4900,
      "stats": {
        "purchase_count": 142,
        "avg_rating": 4.7,
        "revenue_cents": 695800,
        "view_count": 3200
      },
      "created_at": "2026-02-15T10:00:00.000Z",
      "updated_at": "2026-03-20T14:30:00.000Z",
      "published_at": "2026-02-16T08:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 5,
    "totalPages": 1,
    "hasNext": false,
    "hasPrev": false
  },
  "timestamp": "2026-03-26T12:00:00.000Z"
}
```

**RLS**: Query filters by `lawyer_user_id = req.user.id`.

---

### 8.3 GET /api/lawyer/templates/:id

Get a template with full configuration (phases, prompts, branding). Only the owning lawyer can see draft/internal details.

**Auth**: Lawyer
**Rate limit**: `standardLimiter`

**Success response** (200):

```json
{
  "success": true,
  "data": {
    "id": "tpl_abc123",
    "title": "Texas No-Fault Divorce Petition",
    "slug": "texas-no-fault-divorce-petition",
    "status": "published",
    "version": 3,
    "description": "...",
    "long_description": "...",
    "matter_type": "divorce",
    "jurisdictions": ["TX"],
    "price_cents": 4900,
    "currency": "usd",
    "tags": ["no-fault", "uncontested"],
    "requirements": ["..."],
    "what_you_get": ["..."],
    "faq": [{ "question": "...", "answer": "..." }],
    "estimated_completion_minutes": 25,
    "phases": [
      {
        "id": "phase_001",
        "name": "Petitioner Info",
        "description": "Collect petitioner details",
        "order": 1,
        "questions": [
          {
            "id": "q_001",
            "text": "What is your full legal name?",
            "type": "text",
            "required": true,
            "field_key": "petitioner_name",
            "validation": { "min_length": 2, "max_length": 200 }
          }
        ],
        "ai_prompt": "You are collecting petitioner information for a Texas divorce...",
        "completion_criteria": ["petitioner_name", "petitioner_dob", "petitioner_address"]
      }
    ],
    "branding": {
      "logo_url": null,
      "primary_color": "#1a365d",
      "firm_name": null
    },
    "stats": {
      "purchase_count": 142,
      "avg_rating": 4.7,
      "revenue_cents": 695800,
      "view_count": 3200,
      "completion_rate": 0.94
    },
    "moderation": {
      "last_reviewed_at": "2026-02-16T07:00:00.000Z",
      "reviewer_notes": null
    },
    "created_at": "2026-02-15T10:00:00.000Z",
    "updated_at": "2026-03-20T14:30:00.000Z",
    "published_at": "2026-02-16T08:00:00.000Z"
  },
  "timestamp": "2026-03-26T12:00:00.000Z"
}
```

**Error responses**:

| Status | errorType | Cause |
|--------|-----------|-------|
| 404 | `not_found_error` | Template not found or does not belong to this lawyer |

**RLS**: Ownership enforced by `lawyer_user_id = req.user.id`.

---

### 8.4 PUT /api/lawyer/templates/:id

Update template metadata. Partial updates allowed (only send fields to change).

**Auth**: Lawyer
**Rate limit**: `templateMutationLimiter`

**Request body**: Same fields as POST (all optional). Published templates can be edited; changes take effect immediately for new purchases.

**Validation rules**:
- Cannot change `matter_type` on a published template (would break existing interviews).
- Cannot change `jurisdictions` on a published template (create a new template instead).
- `price_cents` changes on published templates take effect immediately for new purchases; existing purchases keep the old price.

**Success response** (200):

```json
{
  "success": true,
  "data": { "...updated template object..." },
  "timestamp": "2026-03-26T12:00:00.000Z"
}
```

**Error responses**:

| Status | errorType | Cause |
|--------|-----------|-------|
| 400 | `validation_error` | Invalid fields or attempted illegal field change |
| 404 | `not_found_error` | Template not found |
| 403 | `template_suspended` | Suspended templates cannot be edited |

---

### 8.5 DELETE /api/lawyer/templates/:id

Soft-delete a template. Sets `status = 'deleted'`. Existing purchases and interviews remain accessible; template is hidden from marketplace and lawyer's list.

**Auth**: Lawyer
**Rate limit**: `templateMutationLimiter`

**Success response** (200):

```json
{
  "success": true,
  "data": { "id": "tpl_abc123", "status": "deleted", "deleted_at": "2026-03-26T12:00:00.000Z" },
  "message": "Template deleted. Existing purchases remain accessible.",
  "timestamp": "2026-03-26T12:00:00.000Z"
}
```

**Error responses**:

| Status | errorType | Cause |
|--------|-----------|-------|
| 404 | `not_found_error` | Template not found |

**Business logic**:
- Soft delete only. The row stays in the database.
- Active interviews for this template continue to work.
- `deleted_at` timestamp is set. `status` changes to `deleted`.

---

### 8.6 POST /api/lawyer/templates/:id/publish

Submit template for review (if moderation is enabled) or publish directly.

**Auth**: Lawyer
**Rate limit**: `templateMutationLimiter`

**Request body**: None.

**Preconditions** (all must be true):
- Template status is `draft` or `unpublished`.
- Template has at least 1 phase with at least 1 question.
- Template has `title`, `description`, `matter_type`, `jurisdictions`, `price_cents`.
- Lawyer's bar verification is approved.

**Success response** (200):

```json
{
  "success": true,
  "data": {
    "id": "tpl_abc123",
    "status": "published",
    "published_at": "2026-03-26T12:00:00.000Z",
    "version": 3
  },
  "message": "Template is now live on the marketplace.",
  "timestamp": "2026-03-26T12:00:00.000Z"
}
```

If moderation is enabled, `status` becomes `pending_review` and the message reflects that.

**Error responses**:

| Status | errorType | Cause |
|--------|-----------|-------|
| 400 | `validation_error` | Missing required fields or phases |
| 403 | `bar_verification_pending` | Bar verification not approved |
| 409 | `template_already_published` | Template is already published |
| 409 | `template_under_review` | Template is already pending review |

---

### 8.7 POST /api/lawyer/templates/:id/unpublish

Take a published template offline. Existing purchases remain usable.

**Auth**: Lawyer
**Rate limit**: `templateMutationLimiter`

**Success response** (200):

```json
{
  "success": true,
  "data": { "id": "tpl_abc123", "status": "unpublished" },
  "message": "Template removed from marketplace. Existing purchases still work.",
  "timestamp": "2026-03-26T12:00:00.000Z"
}
```

**Error responses**:

| Status | errorType | Cause |
|--------|-----------|-------|
| 400 | `template_not_published` | Template is not currently published |

---

### 8.8 POST /api/lawyer/templates/:id/duplicate

Clone a template (including phases and questions) into a new draft.

**Auth**: Lawyer
**Rate limit**: `templateMutationLimiter`

**Request body**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | string | no | New title (default: `"Copy of {original_title}"`) |

**Success response** (201):

```json
{
  "success": true,
  "data": {
    "id": "tpl_new456",
    "title": "Copy of Texas No-Fault Divorce Petition",
    "status": "draft",
    "version": 1,
    "cloned_from": "tpl_abc123"
  },
  "timestamp": "2026-03-26T12:00:00.000Z"
}
```

**Business logic**:
- Duplicates all phases, questions, and prompts.
- Resets stats to zero.
- New template is in `draft` status.
- Counts toward the lawyer's template limit.

---

### 8.9 GET /api/lawyer/templates/:id/versions

Version history for a template.

**Auth**: Lawyer
**Rate limit**: `standardLimiter`

**Query parameters**: `page`, `limit` (offset pagination).

**Success response** (200):

```json
{
  "success": true,
  "data": [
    {
      "version": 3,
      "created_at": "2026-03-20T14:30:00.000Z",
      "change_summary": "Updated pricing from $39 to $49",
      "changed_fields": ["price_cents"],
      "is_current": true
    },
    {
      "version": 2,
      "created_at": "2026-03-01T09:00:00.000Z",
      "change_summary": "Added children phase",
      "changed_fields": ["phases"],
      "is_current": false
    },
    {
      "version": 1,
      "created_at": "2026-02-15T10:00:00.000Z",
      "change_summary": "Initial creation",
      "changed_fields": [],
      "is_current": false
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 3, "totalPages": 1, "hasNext": false, "hasPrev": false },
  "timestamp": "2026-03-26T12:00:00.000Z"
}
```

---

### 8.10 POST /api/lawyer/templates/:id/versions

Create a new version snapshot. This is called automatically on publish, but can also be called manually.

**Auth**: Lawyer
**Rate limit**: `templateMutationLimiter`

**Request body**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `change_summary` | string | no | Human-readable summary (max 500 chars) |

**Success response** (201):

```json
{
  "success": true,
  "data": { "version": 4, "created_at": "2026-03-26T12:00:00.000Z" },
  "timestamp": "2026-03-26T12:00:00.000Z"
}
```

---

### 8.11 PUT /api/lawyer/templates/:id/versions/:vid/restore

Restore a previous version, making it the current state.

**Auth**: Lawyer
**Rate limit**: `templateMutationLimiter`

**Path parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Template ID |
| `vid` | integer | Version number to restore |

**Success response** (200):

```json
{
  "success": true,
  "data": { "id": "tpl_abc123", "version": 5, "restored_from_version": 2 },
  "message": "Restored to version 2. This created version 5.",
  "timestamp": "2026-03-26T12:00:00.000Z"
}
```

**Business logic**:
- Restoring creates a new version (does not rewrite history).
- Published templates become `draft` after restore (must re-publish).

---

### 8.12 POST /api/lawyer/templates/:id/preview

Preview the template as a client would see it.

**Auth**: Lawyer
**Rate limit**: `standardLimiter`

**Success response** (200): Same shape as `GET /marketplace/templates/:id`, with full detail view as a client would see it.

---

## 9. Lawyer Template Builder

Route file: `routes/lawyerTemplateBuilder.js`
Mounted at: `/api/lawyer/templates/:id` (nested under template routes)

These endpoints manage the interview phase configuration for a template.

---

### 9.1 GET /api/lawyer/templates/:id/phases

Get all interview phases and their questions for a template.

**Auth**: Lawyer
**Rate limit**: `standardLimiter`

**Success response** (200):

```json
{
  "success": true,
  "data": {
    "template_id": "tpl_abc123",
    "phases": [
      {
        "id": "phase_001",
        "name": "Petitioner Info",
        "description": "Collect petitioner personal details",
        "order": 1,
        "ai_prompt": "You are collecting petitioner information...",
        "completion_criteria": ["petitioner_name", "petitioner_dob"],
        "questions": [
          {
            "id": "q_001",
            "text": "What is your full legal name?",
            "type": "text",
            "required": true,
            "field_key": "petitioner_name",
            "order": 1,
            "validation": { "min_length": 2, "max_length": 200 },
            "help_text": "Enter your name as it appears on your ID"
          }
        ]
      }
    ]
  },
  "timestamp": "2026-03-26T12:00:00.000Z"
}
```

---

### 9.2 PUT /api/lawyer/templates/:id/phases

Replace the entire phase configuration. This is the bulk-update endpoint for the template builder drag-and-drop interface.

**Auth**: Lawyer
**Rate limit**: `templateMutationLimiter`

**Request body**:

```json
{
  "phases": [
    {
      "id": "phase_001",
      "name": "Petitioner Info",
      "description": "Collect petitioner personal details",
      "order": 1,
      "completion_criteria": ["petitioner_name", "petitioner_dob"],
      "questions": [
        {
          "id": "q_001",
          "text": "What is your full legal name?",
          "type": "text",
          "required": true,
          "field_key": "petitioner_name",
          "order": 1,
          "validation": { "min_length": 2, "max_length": 200 },
          "help_text": "Enter your name as it appears on your ID"
        }
      ]
    }
  ]
}
```

**Validation rules**:
- `phases`: array, 1-20 items
- `phases[].name`: string, 2-100 chars, required
- `phases[].order`: integer, unique within the template
- `phases[].questions`: array, 0-50 items per phase
- `phases[].questions[].type`: enum `text`, `textarea`, `number`, `date`, `select`, `multiselect`, `radio`, `checkbox`, `address`, `phone`, `email`, `currency`, `file`
- `phases[].questions[].field_key`: string, 2-50 chars, `/^[a-z][a-z0-9_]*$/`, unique across all phases

**Success response** (200):

```json
{
  "success": true,
  "data": { "template_id": "tpl_abc123", "phase_count": 6, "question_count": 42, "version": 4 },
  "timestamp": "2026-03-26T12:00:00.000Z"
}
```

**Error responses**:

| Status | errorType | Cause |
|--------|-----------|-------|
| 400 | `validation_error` | Invalid phase structure, duplicate field keys, etc. |
| 409 | `template_version_conflict` | Template was modified by another session |

---

### 9.3 POST /api/lawyer/templates/:id/phases/:phaseId/questions

Add a question to a specific phase.

**Auth**: Lawyer
**Rate limit**: `templateMutationLimiter`

**Request body**:

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| `text` | string | yes | 5-500 chars | Question text |
| `type` | string | yes | See enum above | Input type |
| `required` | boolean | no | default `true` | Whether answer is required |
| `field_key` | string | yes | 2-50 chars, snake_case, unique | Data field key |
| `order` | integer | no | auto-assigned | Position within phase |
| `validation` | object | no | | Type-specific validation rules |
| `help_text` | string | no | max 500 chars | Help text shown to buyer |
| `options` | object[] | conditional | Required for select/multiselect/radio | Choice options |
| `options[].label` | string | conditional | max 200 chars | Display label |
| `options[].value` | string | conditional | max 100 chars | Stored value |
| `conditional` | object | no | | Show/hide logic |
| `conditional.field_key` | string | conditional | | Depends-on field |
| `conditional.operator` | string | conditional | `eq`, `neq`, `gt`, `lt`, `contains`, `exists` | Comparison |
| `conditional.value` | any | conditional | | Comparison value |

**Success response** (201):

```json
{
  "success": true,
  "data": {
    "id": "q_042",
    "text": "How many children do you have?",
    "type": "number",
    "field_key": "child_count",
    "order": 3,
    "phase_id": "phase_003"
  },
  "timestamp": "2026-03-26T12:00:00.000Z"
}
```

---

### 9.4 PUT /api/lawyer/templates/:id/phases/:phaseId/questions/:qid

Update a question.

**Auth**: Lawyer
**Rate limit**: `templateMutationLimiter`

**Request body**: Same fields as POST (all optional for partial update).

**Success response** (200): Updated question object.

---

### 9.5 DELETE /api/lawyer/templates/:id/phases/:phaseId/questions/:qid

Remove a question from a phase.

**Auth**: Lawyer
**Rate limit**: `templateMutationLimiter`

**Success response** (200):

```json
{
  "success": true,
  "data": { "deleted": true, "question_id": "q_042" },
  "timestamp": "2026-03-26T12:00:00.000Z"
}
```

---

### 9.6 PUT /api/lawyer/templates/:id/prompts

Update AI prompts for the template. Requires $1/mo subscription tier.

**Auth**: Lawyer
**Rate limit**: `templateMutationLimiter`

**Request body**:

```json
{
  "system_prompt": "You are a Texas family law assistant helping the user fill out a divorce petition...",
  "phases": {
    "phase_001": {
      "ai_prompt": "In this phase, collect the petitioner's personal information...",
      "extraction_rules": "Extract: petitioner_name, petitioner_dob, petitioner_address..."
    }
  }
}
```

**Validation rules**:
- `system_prompt`: max 5000 chars
- `phases[*].ai_prompt`: max 3000 chars per phase
- `phases[*].extraction_rules`: max 2000 chars per phase

**Success response** (200):

```json
{
  "success": true,
  "data": { "template_id": "tpl_abc123", "prompts_updated": 3 },
  "timestamp": "2026-03-26T12:00:00.000Z"
}
```

**Error responses**:

| Status | errorType | Cause |
|--------|-----------|-------|
| 403 | `subscription_required` | Requires $1/mo prompt editing tier |

---

### 9.7 PUT /api/lawyer/templates/:id/branding

Update branding on the template. Requires $3/mo subscription tier.

**Auth**: Lawyer
**Rate limit**: `templateMutationLimiter`

**Request body** (multipart/form-data or JSON):

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| `logo` | file | no | PNG/JPG/SVG, max 2MB, 200x200-1000x1000 | Firm logo |
| `primary_color` | string | no | Hex color, e.g. `#1a365d` | Brand color |
| `firm_name` | string | no | 2-200 chars | Firm name on PDF |
| `footer_text` | string | no | max 500 chars | Custom PDF footer |

**Success response** (200):

```json
{
  "success": true,
  "data": {
    "template_id": "tpl_abc123",
    "branding": {
      "logo_url": "https://cdn.discover.legal/logos/law_xyz789/logo.png",
      "primary_color": "#1a365d",
      "firm_name": "Smith Family Law PLLC",
      "footer_text": "Prepared by Smith Family Law PLLC"
    }
  },
  "timestamp": "2026-03-26T12:00:00.000Z"
}
```

**Error responses**:

| Status | errorType | Cause |
|--------|-----------|-------|
| 403 | `subscription_required` | Requires $3/mo branding tier |
| 400 | `validation_error` | Invalid image format/dimensions |

---

### 9.8 POST /api/lawyer/templates/:id/test-interview

Run a test interview session. Creates a temporary interview that does not count as a purchase.

**Auth**: Lawyer
**Rate limit**: `chatLimiter`

**Request body**:

```json
{
  "test_data": {
    "petitioner_name": "Jane Test",
    "state": "TX"
  }
}
```

**Success response** (201):

```json
{
  "success": true,
  "data": {
    "interview_id": "int_test_xyz",
    "template_id": "tpl_abc123",
    "is_test": true,
    "first_phase": "phase_001",
    "welcome_message": "Hello! I'm here to help you fill out your Texas divorce petition..."
  },
  "timestamp": "2026-03-26T12:00:00.000Z"
}
```

**Business logic**:
- Test interviews are auto-deleted after 24 hours.
- Test interviews do not appear in analytics.
- Limited to 10 active test interviews per lawyer.

---

## 10. Lawyer Profile and Dashboard

Route file: `routes/lawyerProfile.js`
Mounted at: `/api/lawyer`

---

### 10.1 GET /api/lawyer/profile

Get the lawyer's marketplace profile.

**Auth**: Lawyer
**Rate limit**: `standardLimiter`

**Success response** (200):

```json
{
  "success": true,
  "data": {
    "id": "law_xyz789",
    "user_id": 42,
    "display_name": "Jane Smith, Esq.",
    "firm_name": "Smith Family Law PLLC",
    "bio": "Board-certified family law attorney with 15 years of experience...",
    "avatar_url": "https://...",
    "website_url": "https://smithfamilylaw.com",
    "bar_state": "TX",
    "bar_number": "12345678",
    "bar_verified": true,
    "bar_verified_at": "2026-02-01T10:00:00.000Z",
    "practice_areas": ["family"],
    "jurisdictions": ["TX", "CA"],
    "profile_complete": true,
    "stripe_connected": true,
    "subscription_tier": "prompt_editing",
    "created_at": "2026-01-15T10:00:00.000Z"
  },
  "timestamp": "2026-03-26T12:00:00.000Z"
}
```

---

### 10.2 PUT /api/lawyer/profile

Update lawyer profile. Partial updates allowed.

**Auth**: Lawyer
**Rate limit**: `standardLimiter`

**Request body**:

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| `display_name` | string | no | 2-200 chars | Public display name |
| `firm_name` | string | no | 2-200 chars | Firm name |
| `bio` | string | no | max 2000 chars | Public bio |
| `avatar_url` | string | no | Valid URL | Profile image |
| `website_url` | string | no | Valid URL | Firm website |
| `practice_areas` | string[] | no | `family`, `civil` | Areas of practice |
| `jurisdictions` | string[] | no | Valid jurisdiction codes | Jurisdictions served |

**Success response** (200): Updated profile object.

---

### 10.3 POST /api/lawyer/profile/verify

Submit bar verification request.

**Auth**: Lawyer
**Rate limit**: `strictLimiter`

**Request body**:

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| `bar_state` | string | yes | Valid US state or CA province code | Jurisdiction of bar admission |
| `bar_number` | string | yes | 4-20 chars, alphanumeric | Bar number |
| `full_legal_name` | string | yes | 2-200 chars | Name as registered with bar |
| `supporting_url` | string | no | Valid URL | Link to bar directory listing |

**Success response** (200):

```json
{
  "success": true,
  "data": {
    "verification_id": "ver_abc123",
    "status": "pending",
    "submitted_at": "2026-03-26T12:00:00.000Z",
    "estimated_review_days": 3
  },
  "message": "Bar verification submitted. You will be notified when approved.",
  "timestamp": "2026-03-26T12:00:00.000Z"
}
```

**Error responses**:

| Status | errorType | Cause |
|--------|-----------|-------|
| 409 | `conflict_error` | Verification already pending or approved |

---

### 10.4 GET /api/lawyer/dashboard

Dashboard summary with aggregated metrics.

**Auth**: Lawyer
**Rate limit**: `standardLimiter`

**Success response** (200):

```json
{
  "success": true,
  "data": {
    "templates": {
      "total": 5,
      "published": 3,
      "draft": 2
    },
    "revenue": {
      "total_cents": 1234500,
      "this_month_cents": 245000,
      "last_month_cents": 198000,
      "pending_payout_cents": 45000
    },
    "stats": {
      "total_purchases": 892,
      "this_month_purchases": 67,
      "avg_rating": 4.6,
      "total_reviews": 234,
      "total_views": 15600
    },
    "recent_activity": [
      {
        "type": "purchase",
        "template_id": "tpl_abc123",
        "template_title": "Texas No-Fault Divorce",
        "amount_cents": 4900,
        "at": "2026-03-26T11:30:00.000Z"
      },
      {
        "type": "review",
        "template_id": "tpl_abc123",
        "rating": 5,
        "at": "2026-03-26T10:15:00.000Z"
      }
    ]
  },
  "timestamp": "2026-03-26T12:00:00.000Z"
}
```

---

### 10.5 GET /api/lawyer/dashboard/revenue

Detailed revenue breakdown.

**Auth**: Lawyer
**Rate limit**: `standardLimiter`

**Query parameters**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `period` | string | no | `monthly` | `daily`, `weekly`, `monthly` |
| `from` | string | no | 90 days ago | ISO date |
| `to` | string | no | today | ISO date |
| `template_id` | string | no | null | Filter by template |

**Success response** (200):

```json
{
  "success": true,
  "data": {
    "summary": {
      "total_cents": 1234500,
      "platform_fee_cents": 89200,
      "stripe_fee_cents": 42300,
      "net_cents": 1103000
    },
    "series": [
      { "date": "2026-03", "gross_cents": 245000, "net_cents": 220000, "purchases": 67 },
      { "date": "2026-02", "gross_cents": 198000, "net_cents": 178000, "purchases": 54 }
    ],
    "by_template": [
      { "template_id": "tpl_abc123", "title": "Texas No-Fault Divorce", "gross_cents": 145000, "purchases": 29 }
    ]
  },
  "timestamp": "2026-03-26T12:00:00.000Z"
}
```

---

### 10.6 GET /api/lawyer/dashboard/analytics

Template analytics: views, conversions, completion rates.

**Auth**: Lawyer
**Rate limit**: `standardLimiter`

**Query parameters**: Same as revenue (`period`, `from`, `to`, `template_id`).

**Success response** (200):

```json
{
  "success": true,
  "data": {
    "overview": {
      "total_views": 15600,
      "total_purchases": 892,
      "conversion_rate": 0.057,
      "avg_completion_rate": 0.94,
      "avg_time_to_complete_minutes": 22
    },
    "by_template": [
      {
        "template_id": "tpl_abc123",
        "title": "Texas No-Fault Divorce",
        "views": 3200,
        "purchases": 142,
        "conversion_rate": 0.044,
        "completion_rate": 0.94,
        "avg_time_minutes": 25,
        "drop_off_phase": "Property Division"
      }
    ],
    "funnel": {
      "viewed": 3200,
      "preview_clicked": 890,
      "purchase_started": 210,
      "purchase_completed": 142,
      "interview_started": 138,
      "interview_completed": 130,
      "document_generated": 128
    }
  },
  "timestamp": "2026-03-26T12:00:00.000Z"
}
```

---

### 10.7 GET /api/lawyer/dashboard/reviews

Reviews across all the lawyer's templates.

**Auth**: Lawyer
**Rate limit**: `standardLimiter`

**Query parameters**:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | 1 | Page |
| `limit` | integer | 20 | Per page |
| `rating` | integer | null | Filter by star rating (1-5) |
| `template_id` | string | null | Filter by template |
| `sort` | string | `newest` | `newest`, `oldest`, `highest`, `lowest` |

**Success response** (200):

```json
{
  "success": true,
  "data": [
    {
      "id": "rev_abc123",
      "template_id": "tpl_abc123",
      "template_title": "Texas No-Fault Divorce",
      "rating": 5,
      "title": "Exactly what I needed",
      "body": "The interview walked me through everything...",
      "reviewer": {
        "display_name": "J. Doe",
        "verified_purchase": true
      },
      "created_at": "2026-03-25T14:00:00.000Z"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 234, "totalPages": 12, "hasNext": true, "hasPrev": false },
  "timestamp": "2026-03-26T12:00:00.000Z"
}
```

---

### 10.8 GET /api/lawyer/dashboard/achievements

Lawyer's achievement/badge progress for gamification.

**Auth**: Lawyer
**Rate limit**: `standardLimiter`

**Success response** (200):

```json
{
  "success": true,
  "data": {
    "achievements": [
      {
        "id": "ach_first_sale",
        "name": "First Sale",
        "description": "Make your first template sale",
        "icon": "trophy",
        "earned": true,
        "earned_at": "2026-02-20T10:00:00.000Z"
      },
      {
        "id": "ach_100_sales",
        "name": "Century Club",
        "description": "Reach 100 template sales",
        "icon": "star",
        "earned": false,
        "progress": 0.89,
        "current": 89,
        "target": 100
      }
    ],
    "total_earned": 5,
    "total_available": 20
  },
  "timestamp": "2026-03-26T12:00:00.000Z"
}
```

---

### 10.9 GET /api/lawyer/events/stream

Server-Sent Events stream for real-time lawyer notifications.

**Auth**: Lawyer
**Rate limit**: `standardLimiter` (100/15min)

**Headers**:
- `Accept: text/event-stream`
- `Authorization: Bearer <token>`

**Event types**:

| Event | Description |
|-------|-------------|
| `revenue` | New purchase of lawyer's template |
| `view` | Template view count update (batched, every 30s) |
| `review` | New review submitted |
| `achievement` | Achievement unlocked |
| `template_status` | Template status changed (approved, rejected, etc.) |
| `leaderboard` | Ranking position changed |
| `payout` | Payout processed |

**Example event**:

```
event: revenue
data: {"template_id": "tmpl_abc", "amount_cents": 4900, "template_title": "Texas Divorce Petition", "timestamp": "2026-04-01T10:30:00Z"}
```

**Business logic**:
- Connection kept alive with heartbeat every 30s.
- Events buffered and delivered in order.
- Reconnection supported via `Last-Event-ID` header.
- Falls back to polling if SSE not supported.

---

## 11. Lawyer Payouts

Route file: `routes/lawyerPayouts.js`
Mounted at: `/api/lawyer/payouts`

All endpoints require `auth0Middleware` + `requireRole('lawyer')`.

---

### 11.1 POST /api/lawyer/payouts/onboard

Start Stripe Connect Express onboarding. Returns a URL to redirect the lawyer to.

**Auth**: Lawyer
**Rate limit**: `strictLimiter`

**Request body**: None.

**Success response** (200):

```json
{
  "success": true,
  "data": {
    "onboarding_url": "https://connect.stripe.com/express/onboarding/...",
    "expires_at": "2026-03-26T13:00:00.000Z"
  },
  "timestamp": "2026-03-26T12:00:00.000Z"
}
```

**Business logic**:
- Creates a Stripe Connect Express account if one does not exist.
- Generates an Account Link with `type: 'account_onboarding'`.
- `return_url` and `refresh_url` point to the lawyer portal.

---

### 11.2 GET /api/lawyer/payouts/onboard/return

Stripe Connect return URL handler. Verifies onboarding completion.

**Auth**: Lawyer
**Rate limit**: `standardLimiter`

**Success response** (200):

```json
{
  "success": true,
  "data": {
    "onboarding_complete": true,
    "charges_enabled": true,
    "payouts_enabled": true
  },
  "timestamp": "2026-03-26T12:00:00.000Z"
}
```

---

### 11.3 GET /api/lawyer/payouts/onboard/refresh

Generate a new Account Link if the previous one expired.

**Auth**: Lawyer
**Rate limit**: `strictLimiter`

**Success response** (200): Same as `POST /onboard`.

---

### 11.4 GET /api/lawyer/payouts/status

Check Stripe Connect account status.

**Auth**: Lawyer
**Rate limit**: `standardLimiter`

**Success response** (200):

```json
{
  "success": true,
  "data": {
    "stripe_account_id": "acct_1234",
    "charges_enabled": true,
    "payouts_enabled": true,
    "details_submitted": true,
    "requirements": {
      "currently_due": [],
      "eventually_due": [],
      "past_due": []
    },
    "default_currency": "usd",
    "payout_schedule": {
      "delay_days": 7,
      "interval": "daily"
    }
  },
  "timestamp": "2026-03-26T12:00:00.000Z"
}
```

---

### 11.5 GET /api/lawyer/payouts/history

Payout history from Stripe Connect.

**Auth**: Lawyer
**Rate limit**: `standardLimiter`

**Query parameters**:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | 1 | Page |
| `limit` | integer | 20 | Per page (max 100) |
| `status` | string | null | `paid`, `pending`, `in_transit`, `canceled`, `failed` |

**Success response** (200):

```json
{
  "success": true,
  "data": [
    {
      "id": "po_1234",
      "amount_cents": 45000,
      "currency": "usd",
      "status": "paid",
      "arrival_date": "2026-03-25",
      "created_at": "2026-03-20T10:00:00.000Z"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 12, "totalPages": 1, "hasNext": false, "hasPrev": false },
  "timestamp": "2026-03-26T12:00:00.000Z"
}
```

---

### 11.6 GET /api/lawyer/payouts/balance

Current available and pending balance.

**Auth**: Lawyer
**Rate limit**: `standardLimiter`

**Success response** (200):

```json
{
  "success": true,
  "data": {
    "available": [{ "amount_cents": 45000, "currency": "usd" }],
    "pending": [{ "amount_cents": 12000, "currency": "usd" }],
    "connect_reserved": [{ "amount_cents": 0, "currency": "usd" }]
  },
  "timestamp": "2026-03-26T12:00:00.000Z"
}
```

---

### 11.7 POST /api/lawyer/payouts/request

Request a manual payout (if automatic payouts are not configured or the lawyer wants an immediate transfer).

**Auth**: Lawyer
**Rate limit**: `paymentLimiter` (5/hour)

**Request body**:

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| `amount_cents` | integer | yes | Min 100, max available balance | Amount to pay out |
| `currency` | string | no | `usd` | Currency |

**Success response** (200):

```json
{
  "success": true,
  "data": {
    "payout_id": "po_5678",
    "amount_cents": 45000,
    "currency": "usd",
    "status": "pending",
    "estimated_arrival": "2026-03-28"
  },
  "timestamp": "2026-03-26T12:00:00.000Z"
}
```

**Error responses**:

| Status | errorType | Cause |
|--------|-----------|-------|
| 400 | `payout_not_ready` | Stripe Connect onboarding incomplete |
| 400 | `payout_insufficient_balance` | Requested amount exceeds available balance |

---

## 12. Lawyer Subscriptions

Route file: `routes/lawyerSubscriptions.js`
Mounted at: `/api/lawyer/subscriptions`

---

### 12.1 GET /api/lawyer/subscriptions/tiers

Available subscription tiers and pricing. Public endpoint (shown on lawyer signup page).

**Auth**: Public
**Rate limit**: `marketplaceBrowseLimiter`

**Success response** (200):

```json
{
  "success": true,
  "data": [
    {
      "id": "tier_free",
      "name": "Free",
      "price_cents": 0,
      "interval": null,
      "features": ["Visual editor", "3 template listings", "Basic stats"],
      "limits": { "max_templates": 3 }
    },
    {
      "id": "tier_prompt",
      "name": "Prompt Editing",
      "price_cents": 100,
      "interval": "month",
      "features": ["Everything in Free", "Edit AI prompts per phase"],
      "limits": { "max_templates": 10 }
    },
    {
      "id": "tier_branding",
      "name": "Custom Branding",
      "price_cents": 300,
      "interval": "month",
      "features": ["Everything in Prompt Editing", "Custom logo/colors on PDFs"],
      "limits": { "max_templates": 25 }
    },
    {
      "id": "tier_clio",
      "name": "Clio Integration",
      "price_cents": 500,
      "interval": "month",
      "features": ["Everything in Custom Branding", "Clio contact/matter sync"],
      "limits": { "max_templates": 50 }
    },
    {
      "id": "tier_analytics",
      "name": "Advanced Analytics",
      "price_cents": 1000,
      "interval": "month",
      "features": ["Everything in Clio", "Funnel analytics", "Drop-off analysis"],
      "limits": { "max_templates": 100 }
    },
    {
      "id": "tier_api",
      "name": "API Access",
      "price_cents": 2500,
      "interval": "month",
      "features": ["Everything in Advanced Analytics", "REST API", "White-label embed"],
      "limits": { "max_templates": null }
    },
    {
      "id": "tier_pro",
      "name": "Pro Bundle",
      "price_cents": 4900,
      "interval": "month",
      "features": ["Everything included"],
      "limits": { "max_templates": null }
    }
  ],
  "timestamp": "2026-03-26T12:00:00.000Z"
}
```

---

### 12.2 GET /api/lawyer/subscriptions

Current active subscriptions for the authenticated lawyer.

**Auth**: Lawyer
**Rate limit**: `standardLimiter`

**Success response** (200):

```json
{
  "success": true,
  "data": {
    "active_tier": "tier_branding",
    "stripe_subscription_id": "sub_1234",
    "status": "active",
    "current_period_start": "2026-03-01T00:00:00.000Z",
    "current_period_end": "2026-04-01T00:00:00.000Z",
    "cancel_at_period_end": false,
    "features_enabled": ["visual_editor", "prompt_editing", "custom_branding"],
    "limits": { "max_templates": 25 }
  },
  "timestamp": "2026-03-26T12:00:00.000Z"
}
```

---

### 12.3 POST /api/lawyer/subscriptions

Subscribe to a tier. Creates a Stripe Billing subscription.

**Auth**: Lawyer
**Rate limit**: `paymentLimiter`

**Request body**:

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| `tier_id` | string | yes | Must match known tier | Subscription tier to activate |
| `payment_method_id` | string | yes | Stripe PM token | Payment method from Stripe Elements |

**Success response** (201):

```json
{
  "success": true,
  "data": {
    "subscription_id": "sub_1234",
    "tier_id": "tier_branding",
    "status": "active",
    "current_period_end": "2026-04-26T12:00:00.000Z",
    "client_secret": null
  },
  "timestamp": "2026-03-26T12:00:00.000Z"
}
```

If the subscription requires 3D Secure authentication, `status` is `incomplete` and `client_secret` is provided for the frontend to complete authentication.

**Error responses**:

| Status | errorType | Cause |
|--------|-----------|-------|
| 400 | `validation_error` | Invalid tier or payment method |
| 409 | `subscription_already_active` | Already subscribed at this or higher tier |
| 400 | `payment_error` | Payment method declined |

**Business logic**:
- Server-side pricing: the server looks up the Stripe Price ID for the selected tier. The price is never taken from the client.
- Upgrading mid-cycle prorates automatically (Stripe handles this).

---

### 12.4 PUT /api/lawyer/subscriptions/:id

Change subscription tier (upgrade or downgrade).

**Auth**: Lawyer
**Rate limit**: `paymentLimiter`

**Request body**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `tier_id` | string | yes | New tier to switch to |

**Success response** (200):

```json
{
  "success": true,
  "data": {
    "subscription_id": "sub_1234",
    "previous_tier": "tier_branding",
    "new_tier": "tier_clio",
    "effective_at": "2026-03-26T12:00:00.000Z",
    "proration_amount_cents": 200
  },
  "timestamp": "2026-03-26T12:00:00.000Z"
}
```

---

### 12.5 DELETE /api/lawyer/subscriptions/:id

Cancel subscription. Cancels at end of billing period (not immediately).

**Auth**: Lawyer
**Rate limit**: `strictLimiter`

**Success response** (200):

```json
{
  "success": true,
  "data": {
    "subscription_id": "sub_1234",
    "status": "active",
    "cancel_at_period_end": true,
    "cancels_at": "2026-04-26T12:00:00.000Z"
  },
  "message": "Subscription will cancel at end of billing period. Features remain active until then.",
  "timestamp": "2026-03-26T12:00:00.000Z"
}
```

---

## 13. Client Marketplace

Route file: `routes/clientMarketplace.js`
Mounted at: `/api/client`

All endpoints require `auth0Middleware`. The `client` role is the default, so any authenticated user can access these.

---

### 13.1 POST /api/client/purchases

Purchase a template. Creates a Stripe PaymentIntent with a destination charge to the lawyer's Connect account.

**Auth**: Client (any authenticated user)
**Rate limit**: `purchaseLimiter` (10/hour)

**Request body**:

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| `template_id` | string | yes | Valid template ID | Template to purchase |
| `affiliate_code` | string | no | Valid referral code | Affiliate tracking |
| `disclaimerAccepted` | boolean | yes | Must be `true` | Legal disclaimer acknowledgment |

**Success response** (201):

```json
{
  "success": true,
  "data": {
    "purchase_id": "pur_abc123",
    "template_id": "tpl_abc123",
    "payment_intent_id": "pi_1234",
    "client_secret": "pi_1234_secret_5678",
    "amount_cents": 5232,
    "breakdown": {
      "template_price_cents": 4900,
      "platform_fee_cents": 100,
      "stripe_fee_cents": 232
    },
    "currency": "usd",
    "status": "requires_payment_method"
  },
  "timestamp": "2026-03-26T12:00:00.000Z"
}
```

**Error responses**:

| Status | errorType | Cause |
|--------|-----------|-------|
| 400 | `template_not_published` | Template is not published |
| 400 | `validation_error` | Missing disclaimer acceptance |
| 409 | `purchase_already_exists` | User already purchased this template |
| 503 | `external_service_error` | Stripe unavailable |

**Business logic**:
- Price is looked up server-side from `marketplace_templates.price_cents`.
- Platform fee: $1.00 flat (100 cents). Consumer pays `template_price + 100 + stripe_fee`.
- Stripe destination charge: `transfer_data.destination = lawyer_stripe_account_id`.
- `application_fee_amount = 100` (the $1 platform fee).
- Stripe fee is calculated by the server based on Stripe's published rates (2.9% + 30 cents for US cards).
- Affiliate attribution is recorded if `affiliate_code` is present and valid.
- Idempotency: if the user already has an unpaid PaymentIntent for this template, return it instead of creating a new one.

**RLS**: Purchase row is created with `user_id = req.user.id`.

---

### 13.2 GET /api/client/purchases

List the client's purchases.

**Auth**: Client
**Rate limit**: `standardLimiter`

**Query parameters**:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | 1 | Page |
| `limit` | integer | 20 | Per page |
| `status` | string | null | `completed`, `pending`, `refunded` |

**Success response** (200):

```json
{
  "success": true,
  "data": [
    {
      "id": "pur_abc123",
      "template_id": "tpl_abc123",
      "template_title": "Texas No-Fault Divorce Petition",
      "template_matter_type": "divorce",
      "amount_cents": 5232,
      "status": "completed",
      "interview_id": "int_xyz789",
      "interview_status": "in_progress",
      "purchased_at": "2026-03-20T10:00:00.000Z"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 3, "totalPages": 1, "hasNext": false, "hasPrev": false },
  "timestamp": "2026-03-26T12:00:00.000Z"
}
```

**RLS**: Filtered by `user_id = req.user.id`.

---

### 13.3 GET /api/client/purchases/:id

Get purchase detail including payment breakdown and interview status.

**Auth**: Client
**Rate limit**: `standardLimiter`

**Success response** (200):

```json
{
  "success": true,
  "data": {
    "id": "pur_abc123",
    "template_id": "tpl_abc123",
    "template_title": "Texas No-Fault Divorce Petition",
    "template_matter_type": "divorce",
    "template_jurisdictions": ["TX"],
    "lawyer": {
      "display_name": "Jane Smith, Esq.",
      "firm_name": "Smith Family Law PLLC"
    },
    "payment": {
      "amount_cents": 5232,
      "template_price_cents": 4900,
      "platform_fee_cents": 100,
      "stripe_fee_cents": 232,
      "currency": "usd",
      "payment_intent_id": "pi_1234",
      "status": "succeeded",
      "paid_at": "2026-03-20T10:00:00.000Z"
    },
    "interview": {
      "id": "int_xyz789",
      "status": "in_progress",
      "current_phase": "phase_003",
      "phases_completed": 2,
      "phases_total": 6,
      "started_at": "2026-03-20T10:05:00.000Z",
      "last_activity_at": "2026-03-20T11:00:00.000Z"
    },
    "documents_generated": [],
    "purchased_at": "2026-03-20T10:00:00.000Z"
  },
  "timestamp": "2026-03-26T12:00:00.000Z"
}
```

---

### 13.4 POST /api/client/interviews

Start an interview for a purchased template.

**Auth**: Client
**Rate limit**: `standardLimiter`

**Request body**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `purchase_id` | string | yes | Purchase to start interview for |
| `jurisdiction` | string | no | Override jurisdiction (must be in template's list) |

**Success response** (201):

```json
{
  "success": true,
  "data": {
    "id": "int_xyz789",
    "purchase_id": "pur_abc123",
    "template_id": "tpl_abc123",
    "status": "in_progress",
    "current_phase": "phase_001",
    "phase_name": "Petitioner Info",
    "welcome_message": "Hello! I will help you fill out your Texas divorce petition. Let's start with your information.",
    "phases": [
      { "id": "phase_001", "name": "Petitioner Info", "status": "active" },
      { "id": "phase_002", "name": "Respondent Info", "status": "pending" },
      { "id": "phase_003", "name": "Marriage Details", "status": "pending" }
    ]
  },
  "timestamp": "2026-03-26T12:00:00.000Z"
}
```

**Error responses**:

| Status | errorType | Cause |
|--------|-----------|-------|
| 400 | `validation_error` | Invalid purchase ID |
| 400 | `interview_completed` | Interview already completed for this purchase |
| 404 | `not_found_error` | Purchase not found |
| 403 | `authorization_error` | Purchase belongs to another user |

**Business logic**:
- One interview per purchase. If an interview already exists and is `in_progress`, return it.
- If an interview exists and is `completed`, return 400 `interview_completed`.
- The interview uses the `DynamicOrchestrator` which reads its phases/prompts from the JSONB configuration of the marketplace template.

---

### 13.5 GET /api/client/interviews

List the client's active and completed interviews.

**Auth**: Client
**Rate limit**: `standardLimiter`

**Query parameters**:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | 1 | Page |
| `limit` | integer | 20 | Per page |
| `status` | string | null | `in_progress`, `completed`, `abandoned` |

**Success response** (200):

```json
{
  "success": true,
  "data": [
    {
      "id": "int_xyz789",
      "template_title": "Texas No-Fault Divorce Petition",
      "matter_type": "divorce",
      "status": "in_progress",
      "current_phase": "phase_003",
      "progress_percent": 33,
      "started_at": "2026-03-20T10:05:00.000Z",
      "last_activity_at": "2026-03-20T11:00:00.000Z"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 2, "totalPages": 1, "hasNext": false, "hasPrev": false },
  "timestamp": "2026-03-26T12:00:00.000Z"
}
```

---

### 13.6 GET /api/client/interviews/:id

Get interview state with full phase progress and collected data.

**Auth**: Client
**Rate limit**: `standardLimiter`

**Success response** (200):

```json
{
  "success": true,
  "data": {
    "id": "int_xyz789",
    "template_id": "tpl_abc123",
    "template_title": "Texas No-Fault Divorce Petition",
    "status": "in_progress",
    "current_phase": "phase_003",
    "phases": [
      {
        "id": "phase_001",
        "name": "Petitioner Info",
        "status": "completed",
        "completed_at": "2026-03-20T10:15:00.000Z"
      },
      {
        "id": "phase_002",
        "name": "Respondent Info",
        "status": "completed",
        "completed_at": "2026-03-20T10:25:00.000Z"
      },
      {
        "id": "phase_003",
        "name": "Marriage Details",
        "status": "active",
        "started_at": "2026-03-20T10:25:00.000Z"
      }
    ],
    "collected_data": {
      "petitioner_name": "John Doe",
      "petitioner_dob": "1985-06-15",
      "respondent_name": "Jane Doe"
    },
    "conversation_history": [
      { "role": "assistant", "content": "What is your full legal name?" },
      { "role": "user", "content": "John Doe" }
    ],
    "started_at": "2026-03-20T10:05:00.000Z",
    "last_activity_at": "2026-03-20T11:00:00.000Z"
  },
  "timestamp": "2026-03-26T12:00:00.000Z"
}
```

---

### 13.7 PUT /api/client/interviews/:id

Update interview progress (save partial data, change phase).

**Auth**: Client
**Rate limit**: `standardLimiter`

**Request body**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `collected_data` | object | no | Partial data update (merged with existing) |
| `current_phase` | string | no | Move to a different phase |

**Success response** (200): Updated interview object.

---

### 13.8 POST /api/client/interviews/:id/chat

Send a message in the interview. This is the primary interaction endpoint, equivalent to the existing `POST /api/chat` but scoped to a marketplace interview.

**Auth**: Client
**Rate limit**: `interviewChatLimiter` (60/15min)

**Request body**:

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| `message` | string | yes | 1-25000 chars, sanitized | User's message |

**Success response** (200):

```json
{
  "success": true,
  "data": {
    "response": "Thank you, John. Now, what is your date of birth?",
    "extracted_data": {
      "petitioner_name": "John Doe"
    },
    "current_phase": "phase_001",
    "phase_progress": {
      "completed_fields": ["petitioner_name"],
      "remaining_fields": ["petitioner_dob", "petitioner_address"],
      "percent": 33
    },
    "phase_complete": false,
    "interview_complete": false
  },
  "timestamp": "2026-03-26T12:00:00.000Z"
}
```

**Business logic**:
- Message + conversation history + template's AI prompt are sent to the LLM.
- Extracted facts are validated against the template's field definitions.
- When all `completion_criteria` for a phase are met, `phase_complete: true` and the response includes the next phase's welcome message.
- When all phases are complete, `interview_complete: true`.
- Conversation history is truncated to last 20 messages / 6000 tokens (same as existing `POST /api/chat`).

**Error responses**:

| Status | errorType | Cause |
|--------|-----------|-------|
| 400 | `interview_completed` | Interview already finished |
| 404 | `not_found_error` | Interview not found |
| 503 | `external_service_error` | LLM service unavailable |

---

### 13.9 POST /api/client/interviews/:id/generate

Generate the final document(s) from a completed interview.

**Auth**: Client
**Rate limit**: `pdfLimiter` (10/hour)

**Request body**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `document_types` | string[] | no | Specific document types to generate (default: all) |

**Success response** (201):

```json
{
  "success": true,
  "data": {
    "documents": [
      {
        "id": "doc_abc123",
        "title": "Original Petition for Divorce - Doe v. Doe",
        "document_type": "divorce_petition",
        "status": "generated",
        "preview_url": "/api/client/interviews/int_xyz789/preview?doc=doc_abc123"
      },
      {
        "id": "doc_def456",
        "title": "Final Decree of Divorce - Doe v. Doe",
        "document_type": "divorce_decree",
        "status": "generated",
        "preview_url": "/api/client/interviews/int_xyz789/preview?doc=doc_def456"
      }
    ],
    "interview_id": "int_xyz789"
  },
  "timestamp": "2026-03-26T12:00:00.000Z"
}
```

**Error responses**:

| Status | errorType | Cause |
|--------|-----------|-------|
| 400 | `interview_not_started` | Interview has no data yet |
| 400 | `validation_error` | Interview is not yet complete (missing required fields) |

**Business logic**:
- Uses the `DynamicTemplate` renderer which reads layout instructions from the marketplace template's JSONB config.
- Generated documents are saved to the `documents` table and associated with the user and the interview.
- If the template has custom branding (logo, colors), they are applied to the PDF.

---

### 13.10 GET /api/client/interviews/:id/preview

Preview a generated document as HTML.

**Auth**: Client
**Rate limit**: `standardLimiter`

**Query parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `doc` | string | yes | Document ID |

**Success response** (200): HTML content type with rendered document preview.

---

### 13.11 GET /api/client/interviews/:id/pdf

Download a generated document as PDF.

**Auth**: Client
**Rate limit**: `pdfLimiter`

**Query parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `doc` | string | yes | Document ID |

**Success response** (200): `application/pdf` content type with PDF binary.

**Error responses**:

| Status | errorType | Cause |
|--------|-----------|-------|
| 404 | `not_found_error` | Document not found or not generated yet |

---

## 14. Reviews and Ratings

Route file: `routes/reviews.js`
Mounted at: `/api/marketplace/templates/:templateId/reviews`

---

### 14.1 POST /api/marketplace/templates/:id/reviews

Submit a review. Requires authentication and a completed purchase.

**Auth**: Client
**Rate limit**: `reviewLimiter` (5/hour)

**Request body**:

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| `rating` | integer | yes | 1-5 | Star rating |
| `title` | string | no | 3-200 chars | Review title |
| `body` | string | no | 10-5000 chars | Review text |

**Success response** (201):

```json
{
  "success": true,
  "data": {
    "id": "rev_abc123",
    "template_id": "tpl_abc123",
    "rating": 5,
    "title": "Exactly what I needed",
    "body": "The interview process was smooth...",
    "verified_purchase": true,
    "created_at": "2026-03-26T12:00:00.000Z"
  },
  "timestamp": "2026-03-26T12:00:00.000Z"
}
```

**Error responses**:

| Status | errorType | Cause |
|--------|-----------|-------|
| 403 | `review_not_purchaser` | User has not purchased this template |
| 409 | `review_already_submitted` | User already reviewed this template |

**Business logic**:
- Only users who completed payment for this template can review.
- One review per user per template.
- Reviews are immediately visible (no moderation queue). Flagging system handles abuse.
- The template's `avg_rating` and `review_count` are updated asynchronously.

---

### 14.2 GET /api/marketplace/templates/:id/reviews

List reviews for a template. Public.

**Auth**: Public (`optionalAuth`)
**Rate limit**: `marketplaceBrowseLimiter`

**Query parameters**:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `cursor` | string | null | Pagination cursor |
| `limit` | integer | 20 | Per page (1-100) |
| `sort` | string | `newest` | `newest`, `oldest`, `highest`, `lowest`, `most_helpful` |
| `rating` | integer | null | Filter by star rating (1-5) |

**Success response** (200):

```json
{
  "success": true,
  "data": {
    "summary": {
      "avg_rating": 4.7,
      "total_reviews": 142,
      "distribution": {
        "5": 98,
        "4": 28,
        "3": 10,
        "2": 4,
        "1": 2
      }
    },
    "reviews": [
      {
        "id": "rev_abc123",
        "rating": 5,
        "title": "Exactly what I needed",
        "body": "The interview process was smooth...",
        "reviewer": {
          "display_name": "J. Doe",
          "verified_purchase": true
        },
        "helpful_count": 12,
        "created_at": "2026-03-25T14:00:00.000Z"
      }
    ]
  },
  "pagination": { "cursor": "...", "hasMore": true, "total": 142 },
  "timestamp": "2026-03-26T12:00:00.000Z"
}
```

---

### 14.3 PUT /api/marketplace/templates/:id/reviews/:rid

Update own review.

**Auth**: Client
**Rate limit**: `reviewLimiter`

**Request body**: Same as POST (all optional for partial update).

**Error responses**:

| Status | errorType | Cause |
|--------|-----------|-------|
| 403 | `authorization_error` | Review belongs to another user |
| 404 | `not_found_error` | Review not found |

---

### 14.4 DELETE /api/marketplace/templates/:id/reviews/:rid

Delete own review.

**Auth**: Client
**Rate limit**: `reviewLimiter`

**Success response** (200):

```json
{
  "success": true,
  "data": { "deleted": true, "review_id": "rev_abc123" },
  "timestamp": "2026-03-26T12:00:00.000Z"
}
```

---

## 15. Affiliate System

Route file: `routes/affiliates.js`
Mounted at: `/api/affiliates`

---

### 15.1 POST /api/affiliates/register

Register as an affiliate. Any authenticated user can register.

**Auth**: Any authenticated
**Rate limit**: `strictLimiter`

**Request body**:

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| `payout_method` | string | yes | `stripe`, `paypal` | Payout method preference |
| `payout_email` | string | conditional | Valid email (required if `paypal`) | PayPal email for payouts |
| `website_url` | string | no | Valid URL | Affiliate's website |
| `channel` | string | no | `website`, `social`, `blog`, `other` | Primary referral channel |

**Success response** (201):

```json
{
  "success": true,
  "data": {
    "affiliate_id": "aff_abc123",
    "status": "active",
    "default_referral_code": "REF-ABC123",
    "dashboard_url": "/affiliates/dashboard",
    "commission_rate_cents": 25
  },
  "timestamp": "2026-03-26T12:00:00.000Z"
}
```

**Error responses**:

| Status | errorType | Cause |
|--------|-----------|-------|
| 409 | `affiliate_already_registered` | User is already registered as affiliate |

**Business logic**:
- Default commission: $0.25 flat per conversion (platform-funded from the $1 fee).
- Referral code is auto-generated as `REF-{6_ALPHANUMERIC}`.

---

### 15.2 GET /api/affiliates/profile

Get affiliate profile and settings.

**Auth**: Any authenticated (must be registered affiliate)
**Rate limit**: `affiliateLimiter`

**Success response** (200):

```json
{
  "success": true,
  "data": {
    "affiliate_id": "aff_abc123",
    "status": "active",
    "default_referral_code": "REF-ABC123",
    "payout_method": "stripe",
    "commission_rate_cents": 25,
    "total_referrals": 89,
    "total_earnings_cents": 2225,
    "pending_payout_cents": 475,
    "lifetime_paid_cents": 1750,
    "created_at": "2026-02-01T10:00:00.000Z"
  },
  "timestamp": "2026-03-26T12:00:00.000Z"
}
```

---

### 15.3 PUT /api/affiliates/profile

Update affiliate settings.

**Auth**: Any authenticated (registered affiliate)
**Rate limit**: `affiliateLimiter`

**Request body**:

| Field | Type | Description |
|-------|------|-------------|
| `payout_method` | string | `stripe` or `paypal` |
| `payout_email` | string | PayPal email |
| `website_url` | string | Website URL |
| `channel` | string | Primary channel |

---

### 15.4 GET /api/affiliates/links

List the affiliate's referral links.

**Auth**: Registered affiliate
**Rate limit**: `affiliateLimiter`

**Success response** (200):

```json
{
  "success": true,
  "data": [
    {
      "id": "link_001",
      "code": "REF-ABC123",
      "url": "https://make.discover.legal/?ref=REF-ABC123",
      "template_id": null,
      "label": "General referral",
      "clicks": 342,
      "conversions": 89,
      "conversion_rate": 0.26,
      "earnings_cents": 2225,
      "created_at": "2026-02-01T10:00:00.000Z"
    },
    {
      "id": "link_002",
      "code": "REF-ABC123-TX-DIV",
      "url": "https://make.discover.legal/marketplace/templates/tpl_abc123?ref=REF-ABC123-TX-DIV",
      "template_id": "tpl_abc123",
      "label": "Texas Divorce link",
      "clicks": 56,
      "conversions": 12,
      "conversion_rate": 0.21,
      "earnings_cents": 300,
      "created_at": "2026-03-01T10:00:00.000Z"
    }
  ],
  "timestamp": "2026-03-26T12:00:00.000Z"
}
```

---

### 15.5 POST /api/affiliates/links

Generate a new referral link.

**Auth**: Registered affiliate
**Rate limit**: `affiliateLimiter`

**Request body**:

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| `template_id` | string | no | Valid template ID | Deep-link to specific template |
| `label` | string | no | max 100 chars | Human-readable label |

**Success response** (201):

```json
{
  "success": true,
  "data": {
    "id": "link_003",
    "code": "REF-ABC123-NEW",
    "url": "https://make.discover.legal/?ref=REF-ABC123-NEW",
    "label": "Blog post link"
  },
  "timestamp": "2026-03-26T12:00:00.000Z"
}
```

---

### 15.6 GET /api/affiliates/stats

Referral statistics with time series.

**Auth**: Registered affiliate
**Rate limit**: `affiliateLimiter`

**Query parameters**:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `period` | string | `monthly` | `daily`, `weekly`, `monthly` |
| `from` | string | 90 days ago | ISO date |
| `to` | string | today | ISO date |

**Success response** (200):

```json
{
  "success": true,
  "data": {
    "summary": {
      "total_clicks": 398,
      "total_conversions": 101,
      "conversion_rate": 0.254,
      "total_earnings_cents": 2525
    },
    "series": [
      { "date": "2026-03", "clicks": 120, "conversions": 34, "earnings_cents": 850 }
    ],
    "top_templates": [
      { "template_id": "tpl_abc123", "title": "Texas No-Fault Divorce", "conversions": 45, "earnings_cents": 1125 }
    ]
  },
  "timestamp": "2026-03-26T12:00:00.000Z"
}
```

---

### 15.7 GET /api/affiliates/payouts

Affiliate payout history.

**Auth**: Registered affiliate
**Rate limit**: `affiliateLimiter`

**Query parameters**: `page`, `limit` (offset pagination).

**Success response** (200):

```json
{
  "success": true,
  "data": [
    {
      "id": "apay_001",
      "amount_cents": 1750,
      "method": "stripe",
      "status": "paid",
      "paid_at": "2026-03-15T10:00:00.000Z"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 3, "totalPages": 1, "hasNext": false, "hasPrev": false },
  "timestamp": "2026-03-26T12:00:00.000Z"
}
```

---

### 15.8 POST /api/affiliates/payouts/request

Request an affiliate payout.

**Auth**: Registered affiliate
**Rate limit**: `paymentLimiter` (5/hour)

**Request body**:

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| `amount_cents` | integer | no | Min 500, max pending balance | Amount (default: full pending balance) |

**Success response** (200):

```json
{
  "success": true,
  "data": {
    "payout_id": "apay_002",
    "amount_cents": 475,
    "method": "stripe",
    "status": "processing",
    "estimated_arrival": "2026-03-29"
  },
  "timestamp": "2026-03-26T12:00:00.000Z"
}
```

**Error responses**:

| Status | errorType | Cause |
|--------|-----------|-------|
| 400 | `payout_insufficient_balance` | Pending balance below minimum or requested amount |

---

### 15.9 GET /api/affiliates/leaderboard

Public affiliate leaderboard (anonymized by default).

**Auth**: Public (`optionalAuth`)
**Rate limit**: `marketplaceBrowseLimiter`

**Query parameters**:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `period` | string | `month` | `week`, `month`, `all_time` |
| `limit` | integer | 25 | Max entries (1-100) |

**Success response** (200):

```json
{
  "success": true,
  "data": {
    "leaderboard": [
      {
        "rank": 1,
        "display_name": "A**** S****",
        "conversions": 156,
        "is_self": false
      }
    ],
    "my_rank": 12,
    "period": "month"
  },
  "timestamp": "2026-03-26T12:00:00.000Z"
}
```

---

## 16. Clio Integration

Route file: `routes/clioIntegration.js`
Mounted at: `/api/integrations/clio`

All endpoints require `auth0Middleware` + `requireRole('lawyer')`. Clio integration requires the $5/mo subscription tier.

---

### 16.1 POST /api/integrations/clio/connect

Start Clio OAuth2 authorization code flow.

**Auth**: Lawyer
**Rate limit**: `clioLimiter`

**Request body**: None.

**Success response** (200):

```json
{
  "success": true,
  "data": {
    "authorization_url": "https://app.clio.com/oauth/authorize?client_id=...&redirect_uri=...&response_type=code&state=...",
    "state": "csrf_token_abc123"
  },
  "timestamp": "2026-03-26T12:00:00.000Z"
}
```

**Error responses**:

| Status | errorType | Cause |
|--------|-----------|-------|
| 403 | `subscription_required` | Requires $5/mo Clio tier |

**Business logic**:
- `state` parameter contains a CSRF token stored in the lawyer's session.
- `redirect_uri` is `https://make.discover.legal/api/integrations/clio/callback`.

---

### 16.2 GET /api/integrations/clio/callback

OAuth2 callback. Exchanges authorization code for access/refresh tokens.

**Auth**: Lawyer (via state parameter verification)
**Rate limit**: `clioLimiter`

**Query parameters**: `code`, `state` (set by Clio).

**Success response**: 302 redirect to `/lawyer/settings/integrations?clio=connected`.

**Error response**: 302 redirect to `/lawyer/settings/integrations?clio=error&reason=...`.

**Business logic**:
- Verifies `state` matches CSRF token.
- Exchanges `code` for tokens via Clio's token endpoint.
- Stores encrypted `access_token` and `refresh_token` in the database.
- Sets `clio_connected = true` on the lawyer profile.

---

### 16.3 DELETE /api/integrations/clio/disconnect

Revoke Clio connection and delete stored tokens.

**Auth**: Lawyer
**Rate limit**: `clioLimiter`

**Success response** (200):

```json
{
  "success": true,
  "data": { "disconnected": true },
  "message": "Clio integration disconnected. Tokens revoked.",
  "timestamp": "2026-03-26T12:00:00.000Z"
}
```

---

### 16.4 GET /api/integrations/clio/status

Check Clio connection status and token health.

**Auth**: Lawyer
**Rate limit**: `clioLimiter`

**Success response** (200):

```json
{
  "success": true,
  "data": {
    "connected": true,
    "token_valid": true,
    "last_synced_at": "2026-03-25T10:00:00.000Z",
    "clio_user": {
      "name": "Jane Smith",
      "email": "jane@smithlaw.com"
    }
  },
  "timestamp": "2026-03-26T12:00:00.000Z"
}
```

---

### 16.5 GET /api/integrations/clio/contacts

List contacts from the lawyer's Clio account.

**Auth**: Lawyer
**Rate limit**: `clioLimiter`

**Query parameters**:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `q` | string | null | Search by name |
| `page` | integer | 1 | Page |
| `limit` | integer | 20 | Per page |

**Success response** (200):

```json
{
  "success": true,
  "data": [
    {
      "clio_id": 12345,
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "555-0100",
      "type": "Person"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 45, "totalPages": 3, "hasNext": true, "hasPrev": false },
  "timestamp": "2026-03-26T12:00:00.000Z"
}
```

**Error responses**:

| Status | errorType | Cause |
|--------|-----------|-------|
| 400 | `clio_not_connected` | Clio not connected |
| 401 | `clio_token_expired` | Token expired, need to reconnect |

---

### 16.6 GET /api/integrations/clio/matters

List matters from Clio.

**Auth**: Lawyer
**Rate limit**: `clioLimiter`

**Query parameters**: Same as contacts.

**Success response** (200):

```json
{
  "success": true,
  "data": [
    {
      "clio_id": 67890,
      "display_number": "2026-001",
      "description": "Doe v. Doe - Divorce",
      "status": "Open",
      "client": { "clio_id": 12345, "name": "John Doe" },
      "practice_area": "Family Law"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 12, "totalPages": 1, "hasNext": false, "hasPrev": false },
  "timestamp": "2026-03-26T12:00:00.000Z"
}
```

---

### 16.7 POST /api/integrations/clio/import

Import a Clio contact or matter's data to pre-fill an interview.

**Auth**: Lawyer
**Rate limit**: `clioLimiter`

**Request body**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | yes | `contact` or `matter` |
| `clio_id` | integer | yes | Clio resource ID |
| `interview_id` | string | no | Interview to pre-fill (if already started) |

**Success response** (200):

```json
{
  "success": true,
  "data": {
    "imported_fields": {
      "petitioner_name": "John Doe",
      "petitioner_email": "john@example.com",
      "petitioner_phone": "555-0100"
    },
    "field_count": 3
  },
  "timestamp": "2026-03-26T12:00:00.000Z"
}
```

---

### 16.8 POST /api/integrations/clio/export/:docId

Export a generated document to a Clio matter.

**Auth**: Lawyer
**Rate limit**: `clioLimiter`

**Path parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `docId` | string | Document ID to export |

**Request body**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `clio_matter_id` | integer | yes | Target Clio matter |
| `format` | string | no | `pdf` (default) or `docx` |

**Success response** (200):

```json
{
  "success": true,
  "data": {
    "clio_document_id": 99999,
    "clio_matter_id": 67890,
    "filename": "Original_Petition_for_Divorce_Doe.pdf",
    "format": "pdf"
  },
  "message": "Document exported to Clio matter.",
  "timestamp": "2026-03-26T12:00:00.000Z"
}
```

---

## 17. Gamification and Engagement

Route file: `routes/gamification.js`
Mounted at: `/api/gamification`

---

### 17.1 GET /api/gamification/achievements

List all available achievements.

**Auth**: Any authenticated
**Rate limit**: `standardLimiter`

**Success response** (200):

```json
{
  "success": true,
  "data": [
    {
      "id": "ach_first_sale",
      "name": "First Sale",
      "description": "Make your first template sale",
      "icon": "trophy",
      "category": "revenue",
      "role": "lawyer",
      "target": 1
    },
    {
      "id": "ach_first_doc",
      "name": "First Document",
      "description": "Generate your first legal document",
      "icon": "file-text",
      "category": "usage",
      "role": "client",
      "target": 1
    }
  ],
  "timestamp": "2026-03-26T12:00:00.000Z"
}
```

---

### 17.2 GET /api/gamification/achievements/mine

Current user's achievement progress.

**Auth**: Any authenticated
**Rate limit**: `standardLimiter`

**Success response** (200):

```json
{
  "success": true,
  "data": {
    "earned": [
      {
        "id": "ach_first_doc",
        "name": "First Document",
        "earned_at": "2026-03-01T10:00:00.000Z"
      }
    ],
    "in_progress": [
      {
        "id": "ach_10_docs",
        "name": "Power User",
        "progress": 0.3,
        "current": 3,
        "target": 10
      }
    ],
    "total_earned": 2,
    "total_available": 15
  },
  "timestamp": "2026-03-26T12:00:00.000Z"
}
```

---

### 17.3 GET /api/gamification/leaderboard

Global leaderboard.

**Auth**: Any authenticated
**Rate limit**: `standardLimiter`

**Query parameters**:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `type` | string | `overall` | `overall`, `lawyers`, `clients` |
| `period` | string | `month` | `week`, `month`, `all_time` |
| `limit` | integer | 25 | Max entries (1-100) |

**Success response** (200):

```json
{
  "success": true,
  "data": {
    "leaderboard": [
      {
        "rank": 1,
        "display_name": "Jane S.",
        "score": 1250,
        "achievements_earned": 15,
        "is_self": false
      }
    ],
    "my_rank": 47,
    "my_score": 320,
    "type": "overall",
    "period": "month"
  },
  "timestamp": "2026-03-26T12:00:00.000Z"
}
```

---

### 17.4 GET /api/gamification/leaderboard/:jurisdiction

Jurisdiction-specific leaderboard. Same structure as global.

**Auth**: Any authenticated
**Rate limit**: `standardLimiter`

---

### 17.5 GET /api/gamification/leaderboard/matters/:matterType

Matter-type-specific leaderboard. Same structure as global.

**Auth**: Any authenticated
**Rate limit**: `standardLimiter`

---

### 17.6 GET /api/gamification/streaks

User's streak data (consecutive days of activity).

**Auth**: Any authenticated
**Rate limit**: `standardLimiter`

**Success response** (200):

```json
{
  "success": true,
  "data": {
    "current_streak": 7,
    "longest_streak": 14,
    "last_activity_date": "2026-03-26",
    "streak_milestones": [
      { "days": 7, "name": "Week Warrior", "earned": true },
      { "days": 30, "name": "Monthly Master", "earned": false }
    ]
  },
  "timestamp": "2026-03-26T12:00:00.000Z"
}
```

---

## 18. Admin and Moderation

Route file: `routes/admin.js`
Mounted at: `/api/admin`

All endpoints require `auth0Middleware` + `requireRole('admin')`.

---

### 18.1 GET /api/admin/templates/review

Templates pending moderation review.

**Auth**: Admin
**Rate limit**: `adminLimiter`

**Query parameters**:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | 1 | Page |
| `limit` | integer | 20 | Per page |
| `sort` | string | `oldest_first` | `oldest_first`, `newest_first` |

**Success response** (200):

```json
{
  "success": true,
  "data": [
    {
      "id": "tpl_abc123",
      "title": "Texas No-Fault Divorce Petition",
      "lawyer": {
        "id": "law_xyz789",
        "display_name": "Jane Smith, Esq.",
        "bar_verified": true
      },
      "matter_type": "divorce",
      "jurisdictions": ["TX"],
      "submitted_at": "2026-03-25T10:00:00.000Z",
      "review_priority": "normal"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 5, "totalPages": 1, "hasNext": false, "hasPrev": false },
  "timestamp": "2026-03-26T12:00:00.000Z"
}
```

---

### 18.2 PUT /api/admin/templates/:id/approve

Approve a template for publication.

**Auth**: Admin
**Rate limit**: `adminLimiter`

**Request body**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `notes` | string | no | Internal reviewer notes (max 2000 chars) |

**Success response** (200):

```json
{
  "success": true,
  "data": {
    "id": "tpl_abc123",
    "status": "published",
    "approved_by": "admin_user_42",
    "approved_at": "2026-03-26T12:00:00.000Z"
  },
  "timestamp": "2026-03-26T12:00:00.000Z"
}
```

---

### 18.3 PUT /api/admin/templates/:id/reject

Reject a template with a reason.

**Auth**: Admin
**Rate limit**: `adminLimiter`

**Request body**:

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| `reason` | string | yes | 10-2000 chars | Reason for rejection (shown to lawyer) |
| `notes` | string | no | max 2000 chars | Internal notes |

**Success response** (200):

```json
{
  "success": true,
  "data": {
    "id": "tpl_abc123",
    "status": "rejected",
    "rejection_reason": "Template references outdated statute...",
    "rejected_by": "admin_user_42",
    "rejected_at": "2026-03-26T12:00:00.000Z"
  },
  "timestamp": "2026-03-26T12:00:00.000Z"
}
```

---

### 18.4 PUT /api/admin/templates/:id/suspend

Suspend a published template (removes from marketplace, existing purchases still work).

**Auth**: Admin
**Rate limit**: `adminLimiter`

**Request body**:

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| `reason` | string | yes | 10-2000 chars | Reason for suspension |
| `notify_lawyer` | boolean | no | default `true` | Send notification to lawyer |

**Success response** (200):

```json
{
  "success": true,
  "data": {
    "id": "tpl_abc123",
    "status": "suspended",
    "suspension_reason": "Legal accuracy concerns...",
    "suspended_by": "admin_user_42",
    "suspended_at": "2026-03-26T12:00:00.000Z"
  },
  "timestamp": "2026-03-26T12:00:00.000Z"
}
```

---

### 18.5 GET /api/admin/flags

Flagged content (templates, reviews).

**Auth**: Admin
**Rate limit**: `adminLimiter`

**Query parameters**:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | 1 | Page |
| `limit` | integer | 20 | Per page |
| `status` | string | `open` | `open`, `resolved`, `dismissed` |
| `type` | string | null | `template`, `review` |

**Success response** (200):

```json
{
  "success": true,
  "data": [
    {
      "id": "flag_001",
      "type": "review",
      "target_id": "rev_abc123",
      "reason": "spam",
      "description": "This review appears to be fake",
      "reported_by": "user_42",
      "status": "open",
      "created_at": "2026-03-25T14:00:00.000Z"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 3, "totalPages": 1, "hasNext": false, "hasPrev": false },
  "timestamp": "2026-03-26T12:00:00.000Z"
}
```

---

### 18.6 PUT /api/admin/flags/:id

Resolve a flag.

**Auth**: Admin
**Rate limit**: `adminLimiter`

**Request body**:

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| `resolution` | string | yes | `upheld`, `dismissed` | Resolution decision |
| `action_taken` | string | no | max 500 chars | Description of action taken |
| `remove_content` | boolean | no | default `false` | Remove the flagged content |

**Success response** (200):

```json
{
  "success": true,
  "data": {
    "id": "flag_001",
    "status": "resolved",
    "resolution": "upheld",
    "action_taken": "Review removed for violating community guidelines",
    "resolved_by": "admin_user_42",
    "resolved_at": "2026-03-26T12:00:00.000Z"
  },
  "timestamp": "2026-03-26T12:00:00.000Z"
}
```

---

### 18.7 GET /api/admin/lawyers

List all registered lawyers with status.

**Auth**: Admin
**Rate limit**: `adminLimiter`

**Query parameters**:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | 1 | Page |
| `limit` | integer | 20 | Per page |
| `status` | string | null | `active`, `pending_verification`, `suspended` |
| `q` | string | null | Search by name, firm, bar number |

**Success response** (200):

```json
{
  "success": true,
  "data": [
    {
      "id": "law_xyz789",
      "user_id": 42,
      "display_name": "Jane Smith, Esq.",
      "firm_name": "Smith Family Law PLLC",
      "bar_state": "TX",
      "bar_number": "12345678",
      "bar_verified": true,
      "status": "active",
      "template_count": 5,
      "total_revenue_cents": 1234500,
      "stripe_connected": true,
      "subscription_tier": "tier_branding",
      "created_at": "2026-01-15T10:00:00.000Z"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 45, "totalPages": 3, "hasNext": true, "hasPrev": false },
  "timestamp": "2026-03-26T12:00:00.000Z"
}
```

---

### 18.8 PUT /api/admin/lawyers/:id

Update lawyer status (approve verification, suspend, etc.).

**Auth**: Admin
**Rate limit**: `adminLimiter`

**Request body**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `bar_verified` | boolean | no | Approve or reject bar verification |
| `status` | string | no | `active`, `suspended` |
| `suspension_reason` | string | conditional | Required if `status = 'suspended'` |
| `notes` | string | no | Internal admin notes |

**Success response** (200): Updated lawyer object.

---

### 18.9 GET /api/admin/analytics

Platform-wide analytics dashboard.

**Auth**: Admin
**Rate limit**: `adminLimiter`

**Query parameters**:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `period` | string | `monthly` | `daily`, `weekly`, `monthly` |
| `from` | string | 90 days ago | ISO date |
| `to` | string | today | ISO date |

**Success response** (200):

```json
{
  "success": true,
  "data": {
    "users": {
      "total": 12500,
      "clients": 12000,
      "lawyers": 450,
      "admins": 5,
      "new_this_period": 890
    },
    "templates": {
      "total": 1200,
      "published": 890,
      "pending_review": 15,
      "suspended": 3
    },
    "transactions": {
      "total_purchases": 45000,
      "total_revenue_cents": 22500000,
      "platform_fees_cents": 4500000,
      "this_period_purchases": 3400,
      "this_period_revenue_cents": 1700000
    },
    "interviews": {
      "started": 42000,
      "completed": 38000,
      "completion_rate": 0.905,
      "avg_duration_minutes": 23
    },
    "series": [
      { "date": "2026-03", "purchases": 3400, "revenue_cents": 1700000, "new_users": 890 }
    ]
  },
  "timestamp": "2026-03-26T12:00:00.000Z"
}
```

---

### 18.10 GET /api/admin/revenue

Revenue dashboard with breakdown by source.

**Auth**: Admin
**Rate limit**: `adminLimiter`

**Query parameters**: Same as analytics.

**Success response** (200):

```json
{
  "success": true,
  "data": {
    "total_gmv_cents": 22500000,
    "platform_revenue": {
      "document_fees_cents": 4500000,
      "subscription_revenue_cents": 225000,
      "total_cents": 4725000
    },
    "lawyer_payouts_cents": 17775000,
    "affiliate_payouts_cents": 112500,
    "stripe_fees_cents": 387500,
    "by_matter_type": [
      { "code": "divorce", "revenue_cents": 13500000, "count": 2700 }
    ],
    "by_jurisdiction": [
      { "code": "TX", "revenue_cents": 4500000, "count": 900 }
    ],
    "series": [
      { "date": "2026-03", "gmv_cents": 1700000, "platform_cents": 357000 }
    ]
  },
  "timestamp": "2026-03-26T12:00:00.000Z"
}
```

---

## 19. Webhook Endpoints

Route file: `routes/webhooks.js`
Mounted at: `/api/webhooks`

All webhook endpoints verify signatures and do not require JWT auth. They use raw body parsing for signature verification.

---

### 19.1 POST /api/webhooks/stripe-connect

Handle Stripe Connect events for lawyer payouts and account status.

**Auth**: Stripe signature verification (`stripe-signature` header)
**Rate limit**: `webhookLimiter`

**Handled event types**:
- `account.updated` -- Lawyer Stripe Connect account status change
- `transfer.created` -- Transfer to lawyer completed
- `transfer.failed` -- Transfer to lawyer failed
- `payout.paid` -- Payout to lawyer's bank completed
- `payout.failed` -- Payout to lawyer's bank failed

**Business logic**:
- Raw body verification using `STRIPE_CONNECT_WEBHOOK_SECRET`.
- Idempotency via `processed_webhooks` table (same pattern as existing Stripe webhook).
- Account status changes update `lawyer_profiles.stripe_status`.

**Success response** (200): `{ received: true }`

---

### 19.2 POST /api/webhooks/stripe-billing

Handle Stripe Billing events for lawyer subscriptions.

**Auth**: Stripe signature verification
**Rate limit**: `webhookLimiter`

**Handled event types**:
- `customer.subscription.created` -- New subscription
- `customer.subscription.updated` -- Tier change, renewal
- `customer.subscription.deleted` -- Cancellation
- `invoice.paid` -- Subscription payment succeeded
- `invoice.payment_failed` -- Subscription payment failed

**Business logic**:
- Raw body verification using `STRIPE_BILLING_WEBHOOK_SECRET`.
- Subscription status changes update `lawyer_subscriptions` table.
- On payment failure, features are not immediately revoked; a grace period of 3 days applies.

**Success response** (200): `{ received: true }`

---

### 19.3 POST /api/webhooks/clio

Handle Clio webhook events.

**Auth**: Clio webhook signature verification
**Rate limit**: `webhookLimiter`

**Handled event types**:
- `matter.updated` -- Matter status change in Clio
- `contact.updated` -- Contact data change in Clio

**Business logic**:
- Signature verification using HMAC-SHA256 with `CLIO_WEBHOOK_SECRET`.
- Updates are best-effort; they refresh cached Clio data but do not trigger user-visible actions.

**Success response** (200): `{ received: true }`

---

## 20. Webhook Payload Schemas

### Stripe Connect: account.updated

```json
{
  "id": "evt_1234",
  "type": "account.updated",
  "data": {
    "object": {
      "id": "acct_1234",
      "charges_enabled": true,
      "payouts_enabled": true,
      "details_submitted": true,
      "requirements": {
        "currently_due": [],
        "past_due": []
      }
    }
  }
}
```

### Stripe Billing: customer.subscription.updated

```json
{
  "id": "evt_5678",
  "type": "customer.subscription.updated",
  "data": {
    "object": {
      "id": "sub_1234",
      "customer": "cus_5678",
      "status": "active",
      "items": {
        "data": [
          {
            "price": {
              "id": "price_tier_branding",
              "unit_amount": 300,
              "recurring": { "interval": "month" }
            }
          }
        ]
      },
      "current_period_start": 1711468800,
      "current_period_end": 1714060800,
      "cancel_at_period_end": false
    }
  }
}
```

### Stripe Connect: PaymentIntent for marketplace purchase

The marketplace uses Stripe Connect destination charges. The PaymentIntent is created on the platform account with `transfer_data`:

```json
{
  "amount": 5232,
  "currency": "usd",
  "application_fee_amount": 100,
  "transfer_data": {
    "destination": "acct_1234"
  },
  "metadata": {
    "purchase_id": "pur_abc123",
    "template_id": "tpl_abc123",
    "buyer_user_id": "42",
    "lawyer_id": "law_xyz789",
    "affiliate_code": "REF-ABC123"
  }
}
```

### Clio: matter.updated

```json
{
  "type": "matter.updated",
  "data": {
    "id": 67890,
    "display_number": "2026-001",
    "status": "Closed",
    "updated_at": "2026-03-26T12:00:00.000Z"
  },
  "timestamp": "2026-03-26T12:00:00.000Z"
}
```

---

## 21. OpenAPI Considerations

### Specification format

The API specification will be maintained as an OpenAPI 3.1 YAML file at `/docs/api/openapi.yaml`. This is generated from the route definitions and JSDoc comments using `swagger-jsdoc`.

### Key decisions

1. **Security schemes**: `bearerAuth` (JWT) for authenticated endpoints. `webhookSignature` (API key in header) for webhook endpoints.
2. **Tags**: One tag per route file (`marketplace`, `lawyer-templates`, `lawyer-builder`, `lawyer-profile`, `lawyer-payouts`, `lawyer-subscriptions`, `client`, `reviews`, `affiliates`, `clio`, `gamification`, `admin`, `webhooks`).
3. **Component reuse**: Shared schemas for `Template`, `TemplateSummary`, `LawyerProfile`, `Purchase`, `Interview`, `Review`, `Pagination`, `CursorPagination`, `Error`.
4. **Server URLs**: `https://make.discover.legal/api/v1` (production), `http://localhost:3001/api/v1` (development).
5. **Discriminator**: The `Error` schema uses `errorType` as a discriminator for specific error shapes.
6. **Examples**: Every endpoint includes at least one `example` in the spec.

### Documentation hosting

The generated spec is served at `GET /api/docs` using `swagger-ui-express` in development only. In production, API documentation is published to a static site.

### SDK generation

The OpenAPI spec enables automatic SDK generation for:
- TypeScript (frontend API client)
- Potential future: mobile SDKs, partner integrations

---

## Appendix: Route File Summary

| File | Mount point | Endpoints |
|------|-------------|-----------|
| `routes/marketplace.js` | `/api/marketplace` | 10 |
| `routes/lawyerTemplates.js` | `/api/lawyer/templates` | 12 |
| `routes/lawyerTemplateBuilder.js` | `/api/lawyer/templates/:id` | 8 |
| `routes/lawyerProfile.js` | `/api/lawyer` | 8 |
| `routes/lawyerPayouts.js` | `/api/lawyer/payouts` | 7 |
| `routes/lawyerSubscriptions.js` | `/api/lawyer/subscriptions` | 5 |
| `routes/clientMarketplace.js` | `/api/client` | 11 |
| `routes/reviews.js` | `/api/marketplace/templates/:id/reviews` | 4 |
| `routes/affiliates.js` | `/api/affiliates` | 9 |
| `routes/clioIntegration.js` | `/api/integrations/clio` | 8 |
| `routes/gamification.js` | `/api/gamification` | 6 |
| `routes/admin.js` | `/api/admin` | 10 |
| `routes/webhooks.js` | `/api/webhooks` | 3 |
| **Total** | | **101** |

## Appendix: Database Table Dependencies

New tables required (designed in the technical architecture document):

| Table | Used by | Key columns |
|-------|---------|-------------|
| `marketplace_templates` | Templates, builder, marketplace | `id`, `lawyer_user_id`, `status`, `config (JSONB)`, `price_cents` |
| `template_versions` | Versioning | `template_id`, `version`, `config_snapshot (JSONB)` |
| `template_phases` | Builder | `template_id`, `order`, `config (JSONB)` |
| `template_questions` | Builder | `phase_id`, `order`, `config (JSONB)` |
| `lawyer_profiles` | Profile, dashboard | `user_id`, `bar_state`, `bar_verified`, `stripe_account_id` |
| `lawyer_subscriptions` | Subscriptions | `lawyer_id`, `tier_id`, `stripe_subscription_id`, `status` |
| `purchases` | Client purchases | `user_id`, `template_id`, `payment_intent_id`, `status` |
| `interviews` | Client interviews | `purchase_id`, `template_id`, `status`, `data (JSONB)` |
| `reviews` | Reviews | `user_id`, `template_id`, `rating`, `title`, `body` |
| `affiliates` | Affiliate system | `user_id`, `referral_code`, `commission_rate_cents` |
| `affiliate_links` | Affiliate links | `affiliate_id`, `code`, `template_id` |
| `affiliate_referrals` | Referral tracking | `affiliate_id`, `purchase_id`, `amount_cents` |
| `affiliate_payouts` | Affiliate payout history | `affiliate_id`, `amount_cents`, `status`, `stripe_transfer_id` |
| `clio_connections` | Clio integration | `lawyer_id`, `access_token_enc`, `refresh_token_enc` |
| `achievements` | Gamification | `id`, `name`, `target` |
| `user_achievements` | Gamification | `user_id`, `achievement_id`, `earned_at` |
| `content_flags` | Moderation | `type`, `target_id`, `reason`, `status` |
| `template_analytics` | Analytics | `template_id`, `event_type`, `count`, `date` |
| `bar_verifications` | Lawyer verification | `lawyer_id`, `bar_state`, `bar_number`, `status` |

All new tables include `created_at`, `updated_at` timestamps and RLS policies scoped by `user_id` or `lawyer_user_id` where applicable. Admin-only tables (`content_flags`, `template_analytics`) use the `is_admin` RLS bypass.
