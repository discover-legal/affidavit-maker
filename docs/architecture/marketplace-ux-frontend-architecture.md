# Marketplace UX and Frontend Architecture

**Author**: System Architecture Designer
**Date**: 2026-03-26
**Status**: Proposal
**Branch**: doc-marketplace

---

## Table of Contents

1. [Existing Codebase Inventory](#1-existing-codebase-inventory)
2. [Role-Based Portal Architecture](#2-role-based-portal-architecture)
3. [Route Map](#3-route-map)
4. [Component Hierarchy](#4-component-hierarchy)
5. [Context and State Architecture](#5-context-and-state-architecture)
6. [Lawyer Portal (Creator/Seller Side)](#6-lawyer-portal)
7. [Client Portal (Buyer Side)](#7-client-portal)
8. [Shared Components](#8-shared-components)
9. [Data Flow Diagrams](#9-data-flow-diagrams)
10. [Key Screens](#10-key-screens)
11. [Interview Engine Transformation](#11-interview-engine-transformation)
12. [Payment Architecture (Stripe Connect)](#12-payment-architecture)
13. [Navigation Architecture](#13-navigation-architecture)
14. [New Dependencies](#14-new-dependencies)
15. [Migration Strategy](#15-migration-strategy)
16. [Architecture Decision Records](#16-architecture-decision-records)

---

## 1. Existing Codebase Inventory

### Current Component Map (28 files)

| Component | Path | Reuse Plan |
|-----------|------|------------|
| `App.js` | `client/src/App.js` | **MODIFY** -- add role-based routing, marketplace routes |
| `EditorView.js` | `client/src/views/EditorView.js` | **MODIFY** -- abstract into reusable InterviewShell |
| `ChatInterface.js` | `components/ChatInterface.js` | **MODIFY** -- accept templateConfig prop instead of hardcoded phases |
| `DocumentPreview.js` | `components/DocumentPreview.js` | **REUSE** -- works as-is for buyer document preview |
| `ValidationSidebar.js` | `components/ValidationSidebar.js` | **REUSE** -- fact editing/reordering stays the same |
| `UserDashboard.js` | `components/UserDashboard.js` | **MODIFY** -- becomes ClientDashboard, add marketplace entry points |
| `Header.js` | `components/Header.js` | **MODIFY** -- role-aware navigation (lawyer vs client) |
| `PaymentModal.js` | `components/PaymentModal.js` | **MODIFY** -- support Stripe Connect destination charges |
| `DocumentIngestion.js` | `components/DocumentIngestion.js` | **REUSE** -- becomes core of lawyer template builder |
| `QuickExit.js` | `components/QuickExit.js` | **REUSE** -- safety feature, keep everywhere |
| `DVSafetyBanner.js` | `components/DVSafetyBanner.js` | **REUSE** -- show in buyer interview for DV matters |
| `TOSGuard.js` | `components/TOSGuard.js` | **REUSE** -- applies to both portals |
| `ErrorBoundary.js` | `components/ErrorBoundary.js` | **REUSE** -- wrap both portals |
| `EvidenceUploadModal.js` | `components/EvidenceUploadModal.js` | **REUSE** -- buyer interview uses this |
| `DocumentMetadata.js` | `components/DocumentMetadata.js` | **REUSE** -- buyer interview uses this |
| `AffidavitForm.js` | `components/AffidavitForm.js` | **REUSE** -- manual entry fallback |
| `CountyValidationInput.js` | `components/CountyValidationInput.js` | **REUSE** -- jurisdiction selection |
| `GenerateButton.js` | `components/GenerateButton.js` | **REUSE** -- PDF generation trigger |
| `SaveProgressButton.js` | `components/SaveProgressButton.js` | **REUSE** -- both portals |
| `ResumeModal.js` | `components/ResumeModal.js` | **REUSE** -- buyer returning to interview |
| `TermsOfServiceModal.js` | `components/TermsOfServiceModal.js` | **REUSE** |
| `Tooltip.js` | `components/Tooltip.js` | **REUSE** |
| `LandingPage.js` | `components/LandingPage.js` | **DEPRECATE** -- landing is on Webflow |
| Policy/Resource pages | `PrivacyPolicyPage`, `TermsOfServicePage`, `ResourcesPage`, `ArticlePage`, `BrandAssetsPage` | **REUSE** -- public routes unchanged |

### Current Contexts (2 files)

| Context | Reuse Plan |
|---------|------------|
| `DocumentContext.js` | **MODIFY** -- split into buyer-facing DocumentContext and lawyer-facing TemplateContext |
| `TOSContext.js` | **REUSE** -- applies to all authenticated users |

### Current Hooks (3 files)

| Hook | Reuse Plan |
|------|------------|
| `useAffidavitData.js` | **REUSE** -- buyer interview data |
| `useCountyValidation.js` | **REUSE** -- jurisdiction validation |
| `useSaveDocument.js` | **REUSE** -- document persistence |

### Current Services (1 file)

| Service | Reuse Plan |
|---------|------------|
| `authService.js` | **MODIFY** -- add role claim extraction from Auth0 JWT |

### Current Dependencies Relevant to Marketplace

- `@auth0/auth0-react` -- roles/permissions via Auth0 RBAC
- `@stripe/react-stripe-js` + `@stripe/stripe-js` -- extend with Connect
- `@dnd-kit/core` + `@dnd-kit/sortable` -- already present, reuse for interview flow builder
- `react-router-dom` v7 -- nested routes, layout routes
- `lucide-react` -- icon library
- `react-markdown` -- chat message rendering
- `react-helmet-async` -- per-page SEO meta

---

## 2. Role-Based Portal Architecture

### User Roles (Auth0 RBAC)

```
roles:
  client          -- default role on signup; can browse, purchase, complete interviews
  lawyer          -- applied after bar verification; can create templates, set pricing
  admin           -- internal; can moderate listings, manage payouts
```

Auth0 custom claims on the JWT:

```json
{
  "https://discover.legal/roles": ["lawyer"],
  "https://discover.legal/lawyer_id": "law_abc123",
  "https://discover.legal/stripe_account_id": "acct_1234"
}
```

### Portal Detection Logic

The application does NOT use subdomains to separate portals. Instead, the portal
is determined by the route prefix:

- `/lawyer/*` -- lawyer portal (requires `lawyer` role)
- `/marketplace/*` -- public browse, no auth required
- `/my/*` -- authenticated client portal
- `/editor/*` -- interview (shared, but scoped to purchased template)
- `/*` -- existing public pages (privacy, tos, resources)

A `RoleGuard` component wraps lawyer routes and checks the JWT role claim.
Clients who attempt to access `/lawyer/*` see a "Become a Provider" CTA.

### Provider Hierarchy (React tree)

```
ErrorBoundary
  HelmetProvider
    Auth0Provider
      TOSProvider
        RoleProvider              <-- NEW: extracts roles from Auth0 token
          MarketplaceProvider     <-- NEW: shared marketplace state (cart, search)
            DocumentProvider      <-- EXISTING: scoped to buyer interviews
              TemplateProvider    <-- NEW: scoped to lawyer template building
                Router
                  AppRoutes
                  QuickExit
```

---

## 3. Route Map

### Public Routes (no auth)

```
/                                   Redirect to /marketplace
/marketplace                        MarketplaceBrowse (search, filter, browse)
/marketplace/search                 MarketplaceSearch (full search UI)
/marketplace/t/:slug                TemplateDetail (preview, pricing, reviews; slug is URL-friendly title)
/marketplace/lawyer/:lawyerId       LawyerProfile (bio, credentials, listings)
/privacy                            PrivacyPolicyPage (existing)
/tos                                TermsOfServicePage (existing)
/resources                          ResourcesPage (existing)
/resources/:slug                    ArticlePage (existing)
/brand                              BrandAssetsPage (existing)
```

### Client Routes (requires auth, client or lawyer role)

```
/my/dashboard                       ClientDashboard (purchased docs, in-progress)
/my/documents                       ClientDocumentList (all purchased documents)
/my/documents/:documentId           ClientDocumentDetail (view, download, review)
/my/purchases                       PurchaseHistory (receipts, invoices)
/editor/new?templateId=X            InterviewShell (begins interview for template X)
/editor/:documentId                 InterviewShell (continues existing interview)
/ingest                             DocumentIngestion (existing, upload own doc)
/payment-success                    Redirect to /my/dashboard (existing)
```

### Lawyer Routes (requires auth + lawyer role)

```
/lawyer/dashboard                   LawyerDashboard (earnings, analytics, activity)
/lawyer/templates                   TemplateList (all lawyer's templates)
/lawyer/templates/new               TemplateBuilder (create from scratch or upload)
/lawyer/templates/:templateId       TemplateEditor (edit existing template)
/lawyer/templates/:templateId/preview   TemplatePreview (preview client experience)
/lawyer/templates/:templateId/analytics TemplateAnalytics (sales, completion rates)
/lawyer/clients                     ClientManagement (purchasers, completion status)
/lawyer/clients/:clientDocId        ClientDocumentView (read-only view of client doc)
/lawyer/earnings                    EarningsDetail (payouts, Stripe dashboard link)
/lawyer/settings                    LawyerSettings (brand, profile, payout config)
/lawyer/onboarding                  LawyerOnboarding (Stripe Connect setup, bar verify)
```

### Admin Routes (requires auth + admin role) -- future

```
/admin/moderation                   ListingModeration
/admin/payouts                      PayoutManagement
/admin/users                        UserManagement
```

---

## 4. Component Hierarchy

### New Components (organized by directory)

```
client/src/
  components/
    shared/                             Shared UI primitives
      RoleGuard.js                      NEW: checks role claim, redirects/shows CTA
      RoleProvider.js                   NEW: context extracting roles from Auth0 token
      MarketplaceProvider.js            NEW: search state, cart, filters
      PortalHeader.js                   NEW: replaces Header.js with role-aware nav
      StarRating.js                     NEW: 1-5 star display and input
      PriceTag.js                       NEW: formatted price with currency
      JurisdictionBadge.js              NEW: colored badge for state/country
      MatterTypeBadge.js                NEW: badge for practice area
      EmptyState.js                     NEW: reusable empty state illustration
      Pagination.js                     NEW: page navigation for lists
      SearchBar.js                      NEW: debounced search input
      FilterPanel.js                    NEW: collapsible filter sidebar

    marketplace/                        Public marketplace components
      MarketplaceBrowse.js              NEW: homepage grid of featured templates
      MarketplaceSearch.js              NEW: full search with faceted filters
      TemplateCard.js                   NEW: card for template in grid/list
      TemplateDetail.js                 NEW: full template detail page
      LawyerProfile.js                  NEW: lawyer's public profile page
      LawyerCard.js                     NEW: lawyer summary card
      ReviewList.js                     NEW: paginated review list
      ReviewForm.js                     NEW: write a review (star + text)
      CategoryNav.js                    NEW: matter type category navigation
      FeaturedSection.js                NEW: curated/promoted template section

    lawyer/                             Lawyer portal components
      LawyerDashboard.js                NEW: earnings chart, active listings, activity
      LawyerOnboarding.js               NEW: Stripe Connect + bar verification flow
      LawyerSettings.js                 NEW: profile, brand colors, logo upload
      EarningsPanel.js                  NEW: revenue chart, payout history
      ClientManagement.js               NEW: list of clients who purchased
      ClientDocumentView.js             NEW: read-only view of client's completed doc

      templateBuilder/                  Template creation subsystem
        TemplateBuilder.js              NEW: orchestrates the build flow
        TemplateUpload.js               NEW: upload precedent PDF/DOCX for extraction
        TemplateNLBuilder.js            NEW: natural language template description
        InterviewFlowBuilder.js         NEW: visual drag-drop phase/question editor
        PhaseEditor.js                  NEW: edit a single interview phase
        QuestionEditor.js               NEW: edit a single question with conditions
        ConditionalLogicEditor.js       NEW: if/then rules for conditional sections
        FactFieldEditor.js              NEW: define required/optional fact fields
        TemplatePreview.js              NEW: simulate client interview experience
        TemplatePublishPanel.js         NEW: pricing, categories, publish toggle
        TemplateVersionHistory.js       NEW: version list with diff view
        TemplateList.js                 NEW: lawyer's template management list
        TemplateAnalytics.js            NEW: per-template sales and completion data

    client/                             Client portal components
      ClientDashboard.js                NEW: replaces UserDashboard with marketplace CTAs
      ClientDocumentList.js             NEW: all purchased documents with filters
      ClientDocumentDetail.js           NEW: single document view + download + review
      PurchaseHistory.js                NEW: all transactions, receipts
      PurchaseFlow.js                   NEW: template select -> pay -> start interview

  contexts/
    RoleContext.js                       NEW: user role state
    MarketplaceContext.js                NEW: search, filters, cart state
    TemplateContext.js                   NEW: lawyer template building state

  hooks/
    useRole.js                          NEW: access current user role
    useMarketplaceSearch.js             NEW: search with debounce, pagination
    useTemplateBuilder.js               NEW: template CRUD operations
    useLawyerAnalytics.js               NEW: earnings and analytics data
    useReviews.js                       NEW: review CRUD
    useStripeConnect.js                 NEW: Stripe Connect account management

  views/
    EditorView.js                       MODIFY: accept templateConfig prop
    MarketplaceView.js                  NEW: layout wrapper for marketplace pages
    LawyerPortalView.js                 NEW: layout wrapper for lawyer pages
    ClientPortalView.js                 NEW: layout wrapper for client pages
```

### Components Reuse Matrix

```
                          Marketplace  Client Portal  Lawyer Portal  Interview
                          (public)     (buyer)        (seller)       (shared)
Header (PortalHeader)        X              X              X             X
QuickExit                    X              X              X             X
TOSGuard                                    X              X             X
DVSafetyBanner                                                          X
ChatInterface                                                           X (modified)
DocumentPreview                                            X (preview)  X
ValidationSidebar                                                       X
PaymentModal                                X                           X
DocumentIngestion                                          X (upload)
EvidenceUploadModal                                                     X
DocumentMetadata                                                        X
StarRating                   X              X
PriceTag                     X              X              X
JurisdictionBadge            X              X              X
```

---

## 5. Context and State Architecture

### RoleContext (NEW)

```
State:
  role: 'client' | 'lawyer' | 'admin' | null
  lawyerId: string | null
  stripeAccountId: string | null
  isLawyer: boolean
  isAdmin: boolean
  permissions: string[]

Source: Auth0 JWT custom claims (namespace: https://discover.legal/)
```

### MarketplaceContext (NEW)

```
State:
  searchQuery: string
  filters: {
    jurisdiction: string | null
    matterType: string | null
    priceRange: [min, max] | null
    rating: number | null
    lawyerId: string | null
    sortBy: 'relevance' | 'price_asc' | 'price_desc' | 'rating' | 'newest'
  }
  results: TemplateListItem[]
  pagination: { page, pageSize, totalCount, totalPages }
  isSearching: boolean
  featuredTemplates: TemplateListItem[]
  categories: CategoryItem[]

Actions:
  search(query, filters, page)
  loadFeatured()
  loadCategories()
  clearFilters()
  setFilter(key, value)
```

### TemplateContext (NEW -- lawyer portal only)

```
State:
  currentTemplate: {
    id: string | null
    title: string
    description: string
    jurisdiction: string
    matterType: string
    pricing: { amount: number, currency: string }
    status: 'draft' | 'pending_review' | 'published' | 'suspended' | 'archived' | 'deleted'
    version: number
    interviewConfig: {
      phases: Phase[]
      requiredFacts: FactField[]
      optionalFacts: FactField[]
      conditionalSections: ConditionalRule[]
    }
    branding: { firmName, logoUrl, primaryColor, accentColor }
    analytics: { purchases, completionRate, avgRating }
  }
  templates: TemplateListItem[]
  isLoading: boolean
  isDirty: boolean

Actions:
  createTemplate(data)
  loadTemplate(id)
  saveTemplate()
  publishTemplate(id)
  archiveTemplate(id)
  updateInterviewConfig(config)
  uploadPrecedent(file)           -- calls AI extraction endpoint
  generateFromNL(description)    -- calls AI template generation endpoint
  loadTemplates()
  duplicateTemplate(id)
  deleteVersion(id, version)
```

### DocumentContext (EXISTING -- modified)

The existing DocumentContext gains one new field on `currentDocument`:

```
currentDocument: {
  ...existing fields...,
  templateId: string | null,         // NEW: which marketplace template this uses
  templateVersion: number | null,    // NEW: pinned version at time of purchase
  lawyerId: string | null,           // NEW: selling lawyer
  purchaseId: string | null          // NEW: links to payment record
}
```

All existing actions remain unchanged. The `initializeNewDocument` action
now accepts an optional `templateId` parameter that seeds the document with
the template's interview config.

### InterviewContext (NEW -- marketplace interviews)

A new `InterviewContext` manages state for dynamic marketplace interviews
(separate from the existing `DocumentContext` which continues to serve
first-party template interviews). This context holds the template-driven
phase progression, conditional logic evaluation, and real-time interview
state for marketplace-purchased templates.

---

## 6. Lawyer Portal

### 6.1 Lawyer Dashboard

**Route**: `/lawyer/dashboard`

**Layout**: `PortalHeader` + sidebar nav + main content area

**Sections**:

1. **Stats Row** -- total earnings (30d), active listings, total purchases, avg rating
2. **Earnings Chart** -- line chart of daily revenue (last 30/90/365 days toggle)
3. **Recent Activity Feed** -- purchases, reviews, new interviews started
4. **Active Listings Quick View** -- top 5 templates by revenue, click to manage
5. **Action Bar** -- "Create New Template" CTA, "View All Templates" link

**Data sources**: `/api/lawyer/dashboard` (new API endpoint)

### 6.2 Template Builder

**Route**: `/lawyer/templates/new` and `/lawyer/templates/:templateId`

The template builder is a multi-step flow. Lawyers can enter from three paths:

**Path A -- Upload Precedent**: Lawyer uploads a PDF or DOCX. The backend AI
extracts the document structure (sections, fields, conditional paragraphs) and
generates a draft interview config. Lawyer reviews and refines.

**Path B -- Natural Language**: Lawyer types "Create a custody agreement template
for Texas that asks about the children's ages, current custody arrangement, and
proposed schedule." The backend AI generates a template config.

**Path C -- Visual Builder (from scratch)**: Lawyer uses the drag-and-drop
interview flow builder directly.

All three paths converge into the same InterviewFlowBuilder for refinement.

**Subsections**:

1. **Template Metadata** -- title, description, jurisdiction, matter type, tags
2. **Interview Flow Builder** (visual)
   - Phases shown as vertical cards, drag to reorder
   - Each phase expands to show questions
   - Questions have: prompt text, expected data type, required/optional toggle
   - Conditional logic: "If answer to Q3 includes children, add Children phase"
   - Uses existing `@dnd-kit/core` and `@dnd-kit/sortable` (already a dependency)
3. **Fact Field Configuration** -- define required and optional data fields
4. **Document Template** -- the actual legal document template with merge fields
5. **Preview** -- simulates client interview (renders ChatInterface with template config)
6. **Publish Panel** -- set price, choose categories, publish/unpublish toggle
7. **Version History** -- list of saved versions, ability to revert

**Reuse**: The `DocumentIngestion.js` component (currently at `/ingest`) already
handles file upload, AI extraction, and structured review. It becomes the
foundation for Path A.

### 6.3 Template Management

**Route**: `/lawyer/templates`

**Table columns**: Title, Jurisdiction, Matter Type, Status (draft/pending_review/published/suspended/archived/deleted),
Price, Purchases (count), Avg Rating, Last Updated, Actions (edit/duplicate/archive).

**Filters**: status, jurisdiction, matter type.

### 6.4 Client Management

**Route**: `/lawyer/clients`

**Table columns**: Client name (anonymized unless client opts in), Template
purchased, Purchase date, Interview status (not started / in progress / complete),
Document completion %, Last activity.

Lawyers see aggregate data. They do NOT see the client's personal document
content unless the client explicitly shares it (future feature: client can
"share with attorney" to enable read-only access).

### 6.5 Lawyer Settings

**Route**: `/lawyer/settings`

**Sections**:
1. **Profile** -- display name, bio, headshot, bar number, jurisdictions practiced
2. **Branding** -- firm name, logo upload, primary and accent colors
3. **Payout** -- linked Stripe Connect account, payout schedule, bank details (Stripe-hosted)
4. **Notifications** -- email preferences for purchases, reviews, payouts

### 6.6 Lead Magnet (Claim and Customize)

The platform offers pre-built "starter templates" (e.g., the existing divorce
package, custody template). A lawyer can "claim" a starter template, which:

1. Duplicates the platform template into the lawyer's account
2. Applies the lawyer's branding (firm name, logo, colors)
3. Publishes under the lawyer's profile

This uses the existing template system (110 jurisdiction templates) as seed data.
The lawyer gets a pre-built, legally accurate template without building from
scratch. They can then customize the interview flow, pricing, and document text.

---

## 7. Client Portal

### 7.1 Marketplace Browse

**Route**: `/marketplace`

**Layout**: `PortalHeader` + full-width content

**Sections**:
1. **Hero/Search** -- prominent search bar with jurisdiction and matter type filters
2. **Category Cards** -- Family Law, Civil Litigation, Real Estate, etc.
3. **Featured Templates** -- curated/promoted templates in a carousel
4. **Recently Added** -- newest templates grid
5. **Top Lawyers** -- lawyer cards with rating, number of templates, specializations

**No auth required** for browsing. Auth required at purchase.

### 7.2 Template Detail Page

**Route**: `/marketplace/t/:slug` (slug is the URL-friendly version of the template title)

**Sections**:
1. **Template Header** -- title, jurisdiction badge, matter type badge, price
2. **Lawyer Info** -- name, headshot, credentials, link to full profile
3. **Description** -- what the template covers, what documents are generated
4. **Interview Preview** -- "This template will ask you about:" + phase/question outline
5. **Requirements** -- "You will need: marriage certificate, financial disclosure, etc."
6. **Reviews** -- star rating + text reviews from past purchasers
7. **Purchase CTA** -- "Get Started - $X" button (triggers auth if not logged in)
8. **Similar Templates** -- recommendations

### 7.3 Purchase Flow

```
[Template Detail] --click "Get Started"-->
  [Auth check] --not logged in--> [Auth0 login] --redirect back-->
  [PaymentModal] --Stripe Connect destination charge-->
  [Payment Success] --redirect-->
  [/editor/new?templateId=X] --interview begins-->
```

The PaymentModal is modified to support Stripe Connect destination charges
(platform takes a flat $1.00 application fee via Stripe Connect destination
charges (`application_fee_amount: 100`). The lawyer receives their full
template price).

### 7.4 Client Dashboard

**Route**: `/my/dashboard`

Replaces the existing `UserDashboard.js` with marketplace-aware layout.

**Sections**:
1. **In Progress** -- documents where interview is not complete (continue button)
2. **Completed** -- documents ready for download (download PDF button)
3. **Browse More** -- CTA to marketplace
4. **Recent Purchases** -- last 5 transactions

The existing document list, case grouping, rename, and delete functionality
is preserved and wrapped in the new layout.

### 7.5 Review System

After downloading a completed document, the client receives an in-app prompt
to leave a review. The review form appears as a modal:

1. Star rating (1-5)
2. Text review (optional, 500 char max)
3. "Was this document complete and accurate?" (yes/no)

Reviews are public on the template detail page. Lawyers can respond
to reviews (text only, no rating change).

---

## 8. Shared Components

### 8.1 Interview Engine (ChatInterface Transformation)

The existing `ChatInterface.js` is tightly coupled to the hardcoded TX divorce
phase configuration and the `SUPPORTED_STATES` import. For the marketplace,
it must become template-driven.

**Current state** (simplified):
```
ChatInterface
  - Hardcoded TX_DIVORCE_PHASE_ORDER
  - Hardcoded TX_DIVORCE_PHASE_NAMES
  - Imports SUPPORTED_STATES for state selector
  - Uses currentDocument from DocumentContext
  - Sends messages to /api/chat with affidavitData
```

**Target state**:
```
ChatInterface
  - Receives interviewConfig prop (phases, questions, conditionalLogic)
  - Phase progress bar reads from interviewConfig.phases
  - State selector shows only jurisdictions relevant to template
  - Uses currentDocument from DocumentContext (unchanged)
  - Sends messages to /api/chat with affidavitData + templateId
  - templateId tells the backend which orchestrator/prompts to use
```

**Changes to ChatInterface.js**:

1. Replace `TX_DIVORCE_PHASE_ORDER` / `TX_DIVORCE_PHASE_NAMES` constants with
   `interviewConfig.phases` from props or from `currentDocument.interviewConfig`.
2. Replace `SUPPORTED_STATES` import with
   `interviewConfig.supportedJurisdictions` (single jurisdiction for marketplace
   templates, or all for platform templates).
3. The welcome message becomes configurable: `interviewConfig.welcomeMessage` or
   a sensible default.
4. Phase progress strip generalizes to any `phases` array.
5. The `/api/chat` payload gains `templateId` and `templateVersion` fields so the
   backend routes to the correct orchestrator.

The existing behavior (TX divorce phases, supported states, etc.) becomes the
"platform default" interview config when no marketplace template is specified.

### 8.2 Document Preview

`DocumentPreview.js` requires no structural changes. It reads from
`currentDocument` via `useDocumentData()`. Marketplace templates generate
the same document structure, so preview rendering is unchanged.

One addition: when the document uses a lawyer's branded template, the preview
should apply the lawyer's branding (firm name in header, logo, colors). This
is handled by including `branding` in the document data, and the backend
preview renderer applies it.

### 8.3 Payment Flow (Stripe Connect)

See section 12 for full details. The key change is that `PaymentModal.js`
must support destination charges where the platform takes a flat $1.00
application fee and the lawyer receives their full template price to their
Stripe connected account.

---

## 9. Data Flow Diagrams

### 9.1 Template Creation (Lawyer)

```
Lawyer                 Frontend                    Backend                   DB
  |                       |                          |                        |
  |--upload PDF---------->|                          |                        |
  |                       |--POST /api/lawyer/       |                        |
  |                       |  templates/extract       |                        |
  |                       |                          |--AI extraction-------->|
  |                       |                          |<--structured config----|
  |                       |<--interviewConfig--------|                        |
  |                       |                          |                        |
  |--edit phases--------->|                          |                        |
  |--set pricing--------->|                          |                        |
  |--click Publish------->|                          |                        |
  |                       |--POST /api/lawyer/       |                        |
  |                       |  templates               |                        |
  |                       |                          |--INSERT template------>|
  |                       |                          |--INSERT version------->|
  |                       |<--template created--------|                       |
  |<--redirect to list----|                          |                        |
```

### 9.2 Template Purchase and Interview (Client)

```
Client                 Frontend                    Backend                   Stripe
  |                       |                          |                        |
  |--browse marketplace-->|                          |                        |
  |                       |--GET /api/marketplace/   |                        |
  |                       |  templates?q=...         |                        |
  |                       |<--template list-----------|                       |
  |--click template------>|                          |                        |
  |                       |--GET /api/marketplace/   |                        |
  |                       |  templates/:id           |                        |
  |                       |<--template detail---------|                       |
  |--click "Get Started"->|                          |                        |
  |                       |--POST /api/payment/      |                        |
  |                       |  create-connect-intent   |                        |
  |                       |                          |--create PaymentIntent->|
  |                       |                          |  (destination charge)  |
  |                       |                          |<--clientSecret---------|
  |                       |<--clientSecret-----------|                        |
  |--enter card---------->|                          |                        |
  |                       |--confirmPayment--------->|                        |
  |                       |                          |                        |
  |                       |<--payment success---------|                       |
  |                       |                          |                        |
  |                       |--POST /api/documents/    |                        |
  |                       |  save (new, templateId)  |                        |
  |                       |                          |--INSERT document------>|
  |                       |<--documentId-------------|                        |
  |                       |                          |                        |
  |--redirect /editor/new?templateId=X               |                        |
  |                       |                          |                        |
  |--chat messages------->|                          |                        |
  |                       |--POST /api/chat          |                        |
  |                       |  (affidavitData +        |                        |
  |                       |   templateId)            |                        |
  |                       |                          |--load template config->|
  |                       |                          |--run orchestrator----->|
  |                       |<--AI response------------|                        |
  |<--interview continues-|                          |                        |
```

### 9.3 Payout Flow

```
Stripe                  Backend                    Lawyer
  |                        |                          |
  |--webhook: payment----->|                          |
  |  intent.succeeded      |                          |
  |                        |--record purchase-------->|
  |                        |--deduct $1.00 fee------->|
  |                        |                          |
  |--automatic payout----->|                          |
  |  (to connected acct)   |                          |
  |                        |                          |<--funds arrive
```

---

## 10. Key Screens

### 10.1 Marketplace Browse (`/marketplace`)

```
+------------------------------------------------------------------+
| [discover.legal]              [Search...]     [Sign In] [For Law] |
+------------------------------------------------------------------+
|                                                                    |
|  What legal document do you need?                                  |
|  +-----------------------------+  +--------+  +--------+           |
|  | [Search by keyword...]      |  | State  |  | Type   |          |
|  +-----------------------------+  +--------+  +--------+           |
|                                                                    |
|  CATEGORIES                                                        |
|  +----------+ +----------+ +----------+ +----------+ +----------+  |
|  | Family   | | Divorce  | | Custody  | | Civil    | | Property | |
|  | Law      | |          | |          | |          | |          |  |
|  +----------+ +----------+ +----------+ +----------+ +----------+  |
|                                                                    |
|  FEATURED TEMPLATES                                                |
|  +------------------+ +------------------+ +------------------+    |
|  | TX Divorce Pkg   | | CA Custody Agmt  | | NY Small Claims  |   |
|  | by: Smith Law    | | by: Jones Legal  | | by: Lee & Assoc  |   |
|  | **** (4.8)       | | **** (4.6)       | | **** (4.9)       |   |
|  | $249             | | $149             | | $79              |   |
|  | [View Details]   | | [View Details]   | | [View Details]   |   |
|  +------------------+ +------------------+ +------------------+    |
|                                                                    |
+------------------------------------------------------------------+
```

### 10.2 Template Detail (`/marketplace/t/:slug`)

```
+------------------------------------------------------------------+
| [discover.legal]              [Search...]     [Sign In]           |
+------------------------------------------------------------------+
|                                                                    |
|  Texas Uncontested Divorce Package                                 |
|  [Family Law]  [TX]  **** (4.8) 127 reviews                       |
|                                                                    |
|  +-------------------+  +------------------------------------+     |
|  | [Lawyer Photo]    |  | This package includes:             |     |
|  | Sarah Smith, Esq. |  |   - Original Petition for Divorce  |     |
|  | Smith Family Law  |  |   - Final Decree of Divorce        |     |
|  | TX Bar #12345     |  |   - Waiver of Service              |     |
|  | [View Profile]    |  |   - Military Status Affidavit      |     |
|  +-------------------+  |   - Prove-Up Affidavit             |     |
|                          +------------------------------------+     |
|                                                                    |
|  The AI interview will guide you through:                          |
|  1. Personal information and residency                             |
|  2. Marriage details and grounds                                   |
|  3. Children (if applicable)                                       |
|  4. Property and debt division                                     |
|  5. Support arrangements                                           |
|  6. Review and finalization                                        |
|                                                                    |
|  +--------------------------------------------+                    |
|  |         Get Started -- $249                 |                    |
|  +--------------------------------------------+                    |
|                                                                    |
|  REVIEWS                                                           |
|  **** John D. -- "Very thorough, covered everything..."            |
|  *** Mary K. -- "Good template, took about 45 minutes..."          |
|                                                                    |
+------------------------------------------------------------------+
```

### 10.3 Lawyer Dashboard (`/lawyer/dashboard`)

```
+------------------------------------------------------------------+
| [discover.legal]  [Dashboard] [Templates] [Clients] [Settings]    |
+------------------------------------------------------------------+
|                                                                    |
|  Welcome back, Sarah                                               |
|                                                                    |
|  +----------+ +----------+ +----------+ +----------+               |
|  | $4,250   | | 12       | | 47       | | 4.8      |              |
|  | This Mo. | | Active   | | Total    | | Avg      |              |
|  | Earnings | | Listings | | Sales    | | Rating   |              |
|  +----------+ +----------+ +----------+ +----------+               |
|                                                                    |
|  EARNINGS (Last 30 Days)                                           |
|  [========== line chart ===========]                               |
|                                                                    |
|  RECENT ACTIVITY                                                   |
|  - New purchase: TX Divorce Package (2 min ago)                    |
|  - Review received: **** on CA Custody Agreement (1 hr ago)        |
|  - Interview completed: TX Divorce Package (3 hrs ago)             |
|                                                                    |
|  TOP TEMPLATES                                                     |
|  1. TX Divorce Package      $249  x 23 sales  **** (4.8)          |
|  2. TX Custody Agreement    $149  x 15 sales  **** (4.7)          |
|  3. TX Child Support Mod    $ 99  x  9 sales  **** (4.5)          |
|                                                                    |
|  [+ Create New Template]                                           |
|                                                                    |
+------------------------------------------------------------------+
```

### 10.4 Interview Flow Builder (`/lawyer/templates/new` or `/:id`)

```
+------------------------------------------------------------------+
| [discover.legal]  Template Builder                   [Save Draft] |
+------------------------------------------------------------------+
| Template: TX Uncontested Divorce                                   |
| Jurisdiction: TX  |  Matter: divorce  |  Price: $249               |
+------------------------------------------------------------------+
|                                                                    |
|  INTERVIEW PHASES (drag to reorder)                                |
|                                                                    |
|  [=] Phase 1: Getting Started                          [Edit] [X]  |
|  |   Q1: What is your full legal name? (required, text)            |
|  |   Q2: What is your spouse's full legal name? (required, text)   |
|  |   Q3: Date of marriage? (required, date)                        |
|  |   [+ Add Question]                                              |
|  |                                                                 |
|  [=] Phase 2: Residency                               [Edit] [X]  |
|  |   Q1: How long have you lived in Texas? (required, duration)    |
|  |   Q2: What county do you live in? (required, county-select)     |
|  |   [+ Add Question]                                              |
|  |                                                                 |
|  [=] Phase 3: Children                                 [Edit] [X]  |
|  |   CONDITION: Only show if Phase 1 Q-children = yes              |
|  |   Q1: How many children under 18? (required, number)            |
|  |   Q2: Current custody arrangement? (required, select)           |
|  |   [+ Add Question]                                              |
|  |                                                                 |
|  [+ Add Phase]                                                     |
|                                                                    |
|  +----------------------------+                                    |
|  | [Preview Client Experience]|                                    |
|  +----------------------------+                                    |
|                                                                    |
+------------------------------------------------------------------+
```

### 10.5 Client Dashboard (`/my/dashboard`)

```
+------------------------------------------------------------------+
| [discover.legal]      [Dashboard] [Documents] [Browse]  [User]   |
+------------------------------------------------------------------+
|                                                                    |
|  IN PROGRESS                                                       |
|  +------------------------------------------------------------+   |
|  | TX Divorce Package                    45% complete          |   |
|  | by Sarah Smith, Esq.       Last edited: 2 hours ago        |   |
|  |                                               [Continue]    |   |
|  +------------------------------------------------------------+   |
|  | CA Custody Agreement                  10% complete          |   |
|  | by Jones Legal Group       Last edited: 3 days ago         |   |
|  |                                               [Continue]    |   |
|  +------------------------------------------------------------+   |
|                                                                    |
|  COMPLETED                                                         |
|  +------------------------------------------------------------+   |
|  | TX Affidavit of Facts                 Completed Mar 20      |   |
|  | by platform (standard)                                      |   |
|  |                         [Download PDF] [Leave Review]       |   |
|  +------------------------------------------------------------+   |
|                                                                    |
|  [Browse More Templates]                                           |
|                                                                    |
+------------------------------------------------------------------+
```

---

## 11. Interview Engine Transformation

The existing interview engine (ChatInterface + DocumentPreview + ValidationSidebar
in a three-pane layout) is the core product. For the marketplace, it transforms
from a hardcoded single-product experience into a template-driven engine.

### Current Architecture

```
EditorView (hard-wired layout: 30/40/30)
  +-- ChatInterface (hardcoded TX phases, SUPPORTED_STATES)
  +-- DocumentPreview (reads from DocumentContext)
  +-- ValidationSidebar (fact editing, dnd-kit reorder)
```

### Target Architecture

```
InterviewShell (layout: configurable proportions)
  +-- ChatInterface (receives interviewConfig from template or defaults)
  |     interviewConfig: {
  |       phases: [{ id, name, order, questions: [...] }],
  |       welcomeMessage: string,
  |       supportedJurisdictions: string[],
  |       conditionalSections: [...],
  |       branding: { firmName, logoUrl, primaryColor }
  |     }
  +-- DocumentPreview (reads from DocumentContext -- no change)
  +-- ValidationSidebar (no change)
```

### Migration Path (Non-Breaking)

1. `EditorView.js` extracts a default `interviewConfig` from the existing
   hardcoded constants (TX_DIVORCE_PHASE_ORDER, etc.) and passes it to
   ChatInterface.
2. `ChatInterface.js` receives `interviewConfig` as an optional prop. If not
   provided, it falls back to the existing hardcoded behavior. This allows
   the existing product to keep working unchanged.
3. When a marketplace template is loaded (via `templateId` in the URL), the
   `EditorView` fetches the template's `interviewConfig` from the API and
   passes it to ChatInterface.
4. The backend `/api/chat` endpoint uses the `templateId` to load the correct
   orchestrator and prompts, instead of relying solely on the jurisdiction.

This is a backward-compatible change. Existing documents with no `templateId`
continue to use the platform's built-in orchestrators.

---

## 12. Payment Architecture (Stripe Connect)

### Current State

- Direct charges: platform is the merchant of record
- PaymentModal creates a PaymentIntent via `/api/payment/create-intent`
- Stripe webhook marks document as paid

### Target State

- Destination charges via Stripe Connect
- Platform takes a flat $1.00 application fee (`application_fee_amount: 100`)
- Lawyer receives their full template price to their connected account
- Lawyer onboarding creates a Stripe Connect Express account

### New Endpoints

```
POST /api/lawyer/onboarding/stripe     -- create Connect account, return onboarding URL
GET  /api/lawyer/onboarding/status     -- check Connect account status
POST /api/payment/create-connect-intent -- create PaymentIntent with transfer_data
GET  /api/lawyer/earnings               -- earnings summary + payout history
```

### PaymentModal Changes

The existing `PaymentModal.js` is modified to accept an optional
`connectAccountId` prop. If present, the backend creates a destination charge:

```javascript
// Backend: create-connect-intent
const paymentIntent = await stripe.paymentIntents.create({
  amount: templatePrice,
  currency: 'usd',
  application_fee_amount: 100, // flat $1.00 platform fee
  transfer_data: {
    destination: lawyerStripeAccountId,
  },
  metadata: {
    documentId,
    templateId,
    lawyerId,
    clientUserId
  }
});
```

For platform-owned templates (existing products without a lawyer), the current
direct charge flow continues unchanged.

### Pricing Rules

- Lawyer sets their own price per template (minimum $29, maximum $999)
- Platform fee: flat $1.00 per transaction (lawyers keep their full template price)
- Platform-owned templates: 100% to platform (existing behavior)
- Stripe processing fees: absorbed by the charge (passed through)

---

## 13. Navigation Architecture

### PortalHeader (replaces Header.js)

The current `Header.js` shows: logo, dashboard link, user info, sign in/out.

The new `PortalHeader.js` is context-aware:

**Unauthenticated**:
```
[discover.legal]  [Browse Templates]  [For Lawyers]  [Sign In]
```

**Authenticated as Client**:
```
[discover.legal]  [Dashboard]  [Documents]  [Browse]  [User Menu v]
                                                       - My Account
                                                       - Purchase History
                                                       - Become a Provider
                                                       - Sign Out
```

**Authenticated as Lawyer**:
```
[discover.legal]  [Dashboard]  [Templates]  [Clients]  [Earnings]  [User Menu v]
                                                                     - My Account
                                                                     - Settings
                                                                     - View as Client
                                                                     - Sign Out
```

**In Interview (both roles)**:
```
[Back to Dashboard]  [Template: TX Divorce Pkg by Smith Law]  [Save]  [Download]
```

### Route Guards

```jsx
// New RoleGuard component
const RoleGuard = ({ requiredRole, children, fallback }) => {
  const { role } = useRole();

  if (role === requiredRole || role === 'admin') {
    return children;
  }

  return fallback || <Navigate to="/marketplace" replace />;
};

// Usage in App.js
<Route path="/lawyer/*" element={
  <RoleGuard requiredRole="lawyer" fallback={<LawyerOnboarding />}>
    <LawyerPortalView />
  </RoleGuard>
}>
  <Route index element={<Navigate to="dashboard" replace />} />
  <Route path="dashboard" element={<LawyerDashboard />} />
  <Route path="templates" element={<TemplateList />} />
  <Route path="templates/new" element={<TemplateBuilder />} />
  <Route path="templates/:templateId" element={<TemplateEditor />} />
  ...
</Route>
```

---

## 14. New Dependencies

| Package | Purpose | Justification |
|---------|---------|---------------|
| `recharts` or `@nivo/line` | Earnings charts in lawyer dashboard | Lightweight charting for revenue graphs |
| `react-dropzone` | File upload in template builder | Better UX for drag-and-drop file upload than raw input |
| `date-fns` | Date formatting in activity feeds | Lighter than moment.js, tree-shakeable |

All other needs are covered by existing dependencies:
- `@dnd-kit/*` for drag-and-drop in interview flow builder
- `@stripe/*` for payments (Connect is same SDK)
- `lucide-react` for icons
- `react-router-dom` for routing
- `react-helmet-async` for SEO meta
- `react-markdown` for rich text rendering

---

## 15. Migration Strategy

### Phase 1: Foundation (Non-Breaking)

1. Add `RoleContext`, `RoleGuard`, `PortalHeader` components
2. Add Auth0 custom claims for roles
3. Refactor `App.js` to use nested route layout with existing routes preserved
4. ChatInterface accepts optional `interviewConfig` prop (backward compatible)
5. Existing users see zero changes -- all current routes keep working

### Phase 2: Marketplace (Public)

1. Build `MarketplaceContext`, browse, search, template detail pages
2. Create marketplace API endpoints (read-only, no auth required)
3. Seed marketplace with platform-owned templates (existing 110 jurisdictions)
4. Replace `/` redirect from `/dashboard` to `/marketplace`

### Phase 3: Lawyer Portal

1. Build lawyer onboarding (Stripe Connect, bar verification)
2. Build template builder (upload, NL, visual editor)
3. Build lawyer dashboard, analytics, client management
4. Create lawyer API endpoints (CRUD for templates, analytics)

### Phase 4: Client Portal

1. Build client dashboard, document list, purchase history
2. Implement Stripe Connect destination charges
3. Build review system
4. Implement template-driven interview flow (ChatInterface reads templateId)

### Phase 5: Polish

1. Lead magnet "claim and customize" flow for lawyers
2. Template version management
3. Advanced analytics
4. Admin moderation tools

---

## 16. Architecture Decision Records

### ADR-MP-001: Route-Based Portal Separation (Not Subdomains)

**Context**: We need to separate lawyer and client experiences.

**Decision**: Use route prefixes (`/lawyer/*`, `/my/*`, `/marketplace/*`) instead of
subdomains (`lawyer.discover.legal`).

**Rationale**:
- Single deployment on Render.com (no additional DNS/routing complexity)
- Shared Auth0 configuration (same domain, same cookies)
- CORS/CSP configuration stays simple (no new origins to add)
- Lawyers can also be clients -- single login, switch views
- SEO for marketplace is handled by the route structure

**Trade-offs**: Cannot independently deploy or scale portals. Acceptable at
current scale.

### ADR-MP-002: Template-Driven Interview Engine

**Context**: The current interview engine has hardcoded phase configurations.
Marketplace templates need custom interview flows.

**Decision**: Make ChatInterface accept an `interviewConfig` prop that defines
phases, questions, conditional logic, and branding. The existing hardcoded
config becomes the default when no template is specified.

**Rationale**:
- Backward compatible -- no changes needed for existing users
- Single interview engine, not separate codepaths for marketplace vs platform
- Lawyers define the interview structure; the AI executes it
- Backend orchestrators already support per-jurisdiction configs

**Trade-offs**: More complex ChatInterface component. Mitigated by clear prop
interface and sensible defaults.

### ADR-MP-003: Stripe Connect Destination Charges

**Context**: Lawyers need to receive payment for their templates.

**Decision**: Use Stripe Connect with destination charges (platform is merchant
of record, automatic transfers to connected accounts).

**Rationale**:
- Platform controls the payment experience (consistency)
- Platform handles refunds and disputes
- Simple flat-fee model ($1.00 per transaction via application_fee_amount)
- Lawyers onboard via Express accounts (low friction)
- Existing PaymentModal requires minimal changes

**Trade-offs**: Platform assumes liability as merchant of record. Platform must
handle support. Standard for marketplace SaaS.

### ADR-MP-004: Existing DocumentContext for Buyer State

**Context**: Should marketplace documents use the existing DocumentContext or a
new context?

**Decision**: Extend the existing DocumentContext with `templateId`,
`templateVersion`, `lawyerId`, and `purchaseId` fields.

**Rationale**:
- The document lifecycle is the same: create, interview, save, generate PDF
- All existing document operations (save, preview, validate, download) work
- No duplication of complex state management logic
- Split context architecture (5 sub-contexts) already prevents render cascades

**Trade-offs**: DocumentContext becomes slightly larger. New fields are nullable,
no impact on existing code paths.

### ADR-MP-005: Lawyer Template Context Separate from Document Context

**Context**: Should lawyer template building share DocumentContext?

**Decision**: Create a separate `TemplateContext` for the lawyer template builder.

**Rationale**:
- Templates are not documents -- different lifecycle (draft/publish/archive vs create/save/download)
- Template state includes interview config, pricing, versions -- none of which exist on documents
- Prevents accidental state collision between building a template and filling one out
- A lawyer can be simultaneously building a template and testing it (as a client)

**Trade-offs**: More context providers. Acceptable complexity for clean separation.

---

## Appendix: File Listing Summary

### Files to Modify (8)

| File | Change Summary |
|------|----------------|
| `client/src/App.js` | Add nested routes, RoleGuard, new portals |
| `client/src/components/Header.js` | Replace with PortalHeader or adapt |
| `client/src/components/ChatInterface.js` | Accept interviewConfig prop |
| `client/src/views/EditorView.js` | Accept templateId, load template config |
| `client/src/components/UserDashboard.js` | Wrap in ClientDashboard or redirect |
| `client/src/components/PaymentModal.js` | Support destination charges |
| `client/src/contexts/DocumentContext.js` | Add templateId, lawyerId, purchaseId fields |
| `client/src/services/authService.js` | Add role extraction from JWT |

### New Files (~45)

| Directory | Count | Files |
|-----------|-------|-------|
| `components/shared/` | 12 | RoleGuard, RoleProvider, MarketplaceProvider, PortalHeader, StarRating, PriceTag, JurisdictionBadge, MatterTypeBadge, EmptyState, Pagination, SearchBar, FilterPanel |
| `components/marketplace/` | 10 | MarketplaceBrowse, MarketplaceSearch, TemplateCard, TemplateDetail, LawyerProfile, LawyerCard, ReviewList, ReviewForm, CategoryNav, FeaturedSection |
| `components/lawyer/` | 6 | LawyerDashboard, LawyerOnboarding, LawyerSettings, EarningsPanel, ClientManagement, ClientDocumentView |
| `components/lawyer/templateBuilder/` | 13 | TemplateBuilder, TemplateUpload, TemplateNLBuilder, InterviewFlowBuilder, PhaseEditor, QuestionEditor, ConditionalLogicEditor, FactFieldEditor, TemplatePreview, TemplatePublishPanel, TemplateVersionHistory, TemplateList, TemplateAnalytics |
| `components/client/` | 5 | ClientDashboard, ClientDocumentList, ClientDocumentDetail, PurchaseHistory, PurchaseFlow |
| `contexts/` | 3 | RoleContext, MarketplaceContext, TemplateContext |
| `hooks/` | 6 | useRole, useMarketplaceSearch, useTemplateBuilder, useLawyerAnalytics, useReviews, useStripeConnect |
| `views/` | 3 | MarketplaceView, LawyerPortalView, ClientPortalView |

### No Changes Required (17)

All policy/resource pages, QuickExit, TOSGuard, TOSContext, ErrorBoundary,
DVSafetyBanner, ValidationSidebar, DocumentPreview, EvidenceUploadModal,
DocumentMetadata, AffidavitForm, CountyValidationInput, GenerateButton,
SaveProgressButton, ResumeModal, Tooltip, analytics utils.
