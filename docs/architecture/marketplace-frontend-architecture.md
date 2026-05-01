# Marketplace Frontend Technical Architecture

**Author**: Engineering Architecture
**Date**: 2026-03-26
**Status**: Proposal
**Branch**: doc-marketplace
**Companion Doc**: `marketplace-ux-frontend-architecture.md` (component hierarchy, route maps, screen designs, data flows)

---

## Table of Contents

1. [Build System and Project Structure](#1-build-system-and-project-structure)
2. [Role-Based Routing Architecture](#2-role-based-routing-architecture)
3. [State Management Patterns](#3-state-management-patterns)
4. [API Client Layer](#4-api-client-layer)
5. [Template Builder Technical Design](#5-template-builder-technical-design)
6. [Dynamic Interview Engine](#6-dynamic-interview-engine)
7. [Payment Integration Expansion](#7-payment-integration-expansion)
8. [Real-Time Features](#8-real-time-features)
9. [Testing Strategy](#9-testing-strategy)
10. [Performance Optimization](#10-performance-optimization)
11. [Accessibility](#11-accessibility)
12. [Error Handling Patterns](#12-error-handling-patterns)
13. [Analytics and Tracking](#13-analytics-and-tracking)
14. [Migration Strategy](#14-migration-strategy)

---

## 1. Build System and Project Structure

### 1.1 Current Build Chain

The frontend uses Create React App with CRACO override. The build pipeline is:

```
craco build
  -> Webpack 5 (via react-scripts 5.0.1)
  -> Babel transpilation
  -> Tailwind CSS PostCSS
  -> Static output to client/build/
  -> Express serves client/build/ in production
```

The existing `craco.config.js` handles two concerns: ESM package resolution (`fullySpecified: false`) and the dev server `setupMiddlewares` migration. The marketplace expansion requires additional configuration.

### 1.2 CRACO Configuration Changes

```javascript
// client/craco.config.js -- marketplace additions
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');

module.exports = {
  webpack: {
    configure: (webpackConfig, { env }) => {
      // Existing: Allow ESM-only packages
      webpackConfig.module.rules.push({
        test: /\.m?js/,
        resolve: { fullySpecified: false }
      });

      // NEW: Enable code splitting for portal-level lazy loading.
      // CRA already has splitChunks enabled, but we tighten the
      // chunk size to ensure lawyer portal does not load in client bundle.
      if (env === 'production') {
        webpackConfig.optimization.splitChunks = {
          ...webpackConfig.optimization.splitChunks,
          cacheGroups: {
            ...webpackConfig.optimization.splitChunks?.cacheGroups,
            // Isolate Stripe Connect SDK (only needed in lawyer portal + payment)
            stripeConnect: {
              test: /[\\/]node_modules[\\/]@stripe[\\/]/,
              name: 'stripe',
              chunks: 'all',
              priority: 20
            },
            // Isolate dnd-kit (only needed in template builder + fact reordering)
            dndKit: {
              test: /[\\/]node_modules[\\/]@dnd-kit[\\/]/,
              name: 'dndkit',
              chunks: 'all',
              priority: 20
            },
            // Isolate chart library (only needed in lawyer dashboard)
            charts: {
              test: /[\\/]node_modules[\\/](recharts|d3-.*|victory)/,
              name: 'charts',
              chunks: 'all',
              priority: 20
            }
          }
        };
      }

      // NEW: Bundle analysis (run with ANALYZE=true npm run build)
      if (process.env.ANALYZE === 'true') {
        webpackConfig.plugins.push(
          new BundleAnalyzerPlugin({
            analyzerMode: 'static',
            reportFilename: '../bundle-report.html',
            openAnalyzer: false
          })
        );
      }

      return webpackConfig;
    }
  },
  devServer: (devServerConfig) => {
    delete devServerConfig.onBeforeSetupMiddleware;
    delete devServerConfig.onAfterSetupMiddleware;

    devServerConfig.setupMiddlewares = (middlewares) => {
      return middlewares;
    };

    if (Array.isArray(devServerConfig.allowedHosts)) {
      devServerConfig.allowedHosts = devServerConfig.allowedHosts.filter(
        host => host && host.length > 0
      );
      if (devServerConfig.allowedHosts.length === 0) {
        devServerConfig.allowedHosts = 'all';
      }
    }

    return devServerConfig;
  },
};
```

### 1.3 New Directory Structure

```
client/src/
  components/
    shared/                    # Cross-portal UI primitives
      RoleGuard.js             # Route guard checking Auth0 role claims
      RoleProvider.js          # Context: extracts roles from Auth0 JWT
      PortalHeader.js          # Role-aware header/nav
      StarRating.js            # 1-5 star display + input
      PriceTag.js              # Formatted currency display
      JurisdictionBadge.js     # State/country badge
      MatterTypeBadge.js       # Practice area badge
      EmptyState.js            # Reusable empty state
      Pagination.js            # Cursor-based page nav
      SearchBar.js             # Debounced search input
      FilterPanel.js           # Collapsible filter sidebar
      Toast.js                 # Transient notification
      ToastProvider.js         # Toast notification context + container
      ConfirmDialog.js         # Confirmation modal
      LoadingOverlay.js        # Portal-level loading state

    marketplace/               # Public marketplace components
      MarketplaceBrowse.js
      MarketplaceSearch.js
      TemplateCard.js
      TemplateDetail.js
      LawyerProfile.js
      LawyerCard.js
      ReviewList.js
      ReviewForm.js
      CategoryNav.js
      FeaturedSection.js

    lawyer/                    # Lawyer portal components
      LawyerDashboard.js
      LawyerOnboarding.js
      LawyerSettings.js
      EarningsPanel.js
      ClientManagement.js
      ClientDocumentView.js
      templateBuilder/         # Template creation subsystem
        TemplateBuilder.js
        TemplateUpload.js
        TemplateNLBuilder.js
        InterviewFlowBuilder.js
        PhaseEditor.js
        QuestionEditor.js
        ConditionalLogicEditor.js
        FactFieldEditor.js
        TemplatePreview.js
        TemplatePublishPanel.js
        TemplateVersionHistory.js
        TemplateList.js
        TemplateAnalytics.js

    client/                    # Client portal components
      ClientDashboard.js
      ClientDocumentList.js
      ClientDocumentDetail.js
      PurchaseHistory.js
      PurchaseFlow.js

    admin/                     # Admin/moderation components (Phase 4+)
      AdminDashboard.js
      ListingModeration.js
      PayoutManagement.js
      UserManagement.js

    gamification/              # Achievements, leaderboards (Phase 4)
      AchievementBadge.js
      Leaderboard.js
      ProgressBar.js
      StreakIndicator.js

  contexts/
    DocumentContext.js          # EXISTING: extended with templateId, purchaseId
    TOSContext.js               # EXISTING: unchanged
    RoleContext.js              # NEW: role extraction from Auth0 JWT
    MarketplaceContext.js       # NEW: search, filters, results
    TemplateContext.js          # NEW: lawyer template building state
    InterviewContext.js         # NEW: dynamic interview state machine
    ToastContext.js             # NEW: notification queue
    GamificationContext.js     # NEW: achievements, streaks (Phase 4)

  hooks/
    useAffidavitData.js        # EXISTING: unchanged
    useCountyValidation.js     # EXISTING: unchanged
    useSaveDocument.js         # EXISTING: unchanged
    useRole.js                 # NEW: shorthand for RoleContext
    useMarketplace.js          # NEW: marketplace search + browse
    useTemplateBuilder.js      # NEW: template CRUD, autosave, versioning
    useLawyerDashboard.js      # NEW: earnings, analytics, activity
    useDynamicInterview.js     # NEW: phase progression, conditional nav
    useReviews.js              # NEW: review CRUD
    useStripeConnect.js        # NEW: Stripe Connect account mgmt
    usePayouts.js              # NEW: payout history, balance
    useAffiliates.js           # NEW: affiliate link management (Phase 4)
    useClio.js                 # NEW: Clio integration status (Phase 4)
    useGamification.js         # NEW: achievements, leaderboards (Phase 4)
    useToast.js                # NEW: toast notification dispatch
    useDebounce.js             # NEW: generic debounce utility hook
    useInfiniteScroll.js       # NEW: intersection observer pagination
    usePersistentState.js      # NEW: sessionStorage-backed state

  services/
    authService.js             # EXISTING: extended with role claim extraction
    apiClient.js               # NEW: centralized fetch with interceptors
    marketplaceApi.js          # NEW: marketplace endpoints
    lawyerApi.js               # NEW: lawyer portal endpoints
    templateApi.js             # NEW: template CRUD endpoints
    payoutApi.js               # NEW: payout/earnings endpoints
    reviewApi.js               # NEW: review endpoints
    affiliateApi.js            # NEW: affiliate endpoints (Phase 4)
    clioApi.js                 # NEW: Clio integration endpoints (Phase 4)
    realtimeService.js         # NEW: SSE connection management

  utils/
    analytics.js               # EXISTING: extended with marketplace events
    factNormalizer.js           # EXISTING: unchanged
    roleUtils.js               # NEW: role permission helpers
    currencyFormat.js           # NEW: price formatting ($1.00, $249.00)
    interviewEngine.js          # NEW: JSONB interview config interpreter
    conditionEvaluator.js       # NEW: conditional logic evaluation
    templateValidator.js        # NEW: client-side template config validation
    searchParams.js             # NEW: URL search param serialization
    retryUtils.js               # NEW: exponential backoff helpers

  views/
    EditorView.js              # EXISTING: modified to accept templateConfig
    MarketplaceView.js         # NEW: layout wrapper for marketplace pages
    LawyerPortalView.js        # NEW: layout wrapper for lawyer pages
    ClientPortalView.js        # NEW: layout wrapper for client pages
```

### 1.4 Code Splitting Strategy

Portal-level code splitting prevents the lawyer portal (template builder, analytics charts, Stripe Connect dashboard) from loading when a client visits the marketplace. Each portal is a lazy-loaded route boundary.

```javascript
// client/src/App.js -- lazy portal loading
import React, { lazy, Suspense } from 'react';

// Eager imports: shared components used everywhere
import ErrorBoundary from './components/ErrorBoundary';
import LoadingOverlay from './components/shared/LoadingOverlay';

// Lazy imports: portal-level splitting
const MarketplaceView = lazy(() =>
  import(/* webpackChunkName: "marketplace" */ './views/MarketplaceView')
);
const ClientPortalView = lazy(() =>
  import(/* webpackChunkName: "client-portal" */ './views/ClientPortalView')
);
const LawyerPortalView = lazy(() =>
  import(/* webpackChunkName: "lawyer-portal" */ './views/LawyerPortalView')
);
const AdminPortalView = lazy(() =>
  import(/* webpackChunkName: "admin-portal" */ './views/AdminPortalView')
);

// Within LawyerPortalView, the template builder is further split:
// const TemplateBuilder = lazy(() =>
//   import(/* webpackChunkName: "template-builder" */ '../components/lawyer/templateBuilder/TemplateBuilder')
// );
```

The `Suspense` boundary at each portal provides a loading skeleton:

```javascript
<Suspense fallback={<LoadingOverlay label="Loading..." />}>
  <LawyerPortalView />
</Suspense>
```

### 1.5 Bundle Size Budget

| Chunk | Budget | Contents |
|-------|--------|----------|
| `main` | < 120 KB gzip | React, Router, Auth0, shared components |
| `marketplace` | < 80 KB gzip | Browse, search, template detail |
| `client-portal` | < 60 KB gzip | Dashboard, document list, purchase history |
| `lawyer-portal` | < 100 KB gzip | Dashboard, settings, client management |
| `template-builder` | < 90 KB gzip | DnD-kit, phase/question editors, preview |
| `charts` | < 50 KB gzip | Recharts (lawyer analytics only) |
| `stripe` | < 40 KB gzip | Stripe Elements + Connect |

Monitoring: Add `ANALYZE=true` to the build command to generate a bundle report. The CI pipeline should fail if any chunk exceeds its budget by more than 20%.

### 1.6 New Dependencies

```json
{
  "dependencies": {
    "recharts": "^2.12.0",
    "zod": "^3.22.0",
    "zustand": "^4.5.0",
    "msw": "^2.0.0"
  },
  "devDependencies": {
    "webpack-bundle-analyzer": "^4.10.0",
    "@testing-library/react": "^14.0.0",
    "@testing-library/user-event": "^14.0.0",
    "@playwright/test": "^1.40.0"
  }
}
```

Notes:
- `recharts`: Lightweight charting for lawyer analytics (treeshakeable, ~35 KB gzip for line+bar charts).
- `zod`: Schema validation matching backend patterns. Lighter than Yup, better TypeScript inference for future migration.
- `zustand`: Used only for the template builder's complex nested state (not a replacement for React Context elsewhere). Justification in section 5.
- `msw`: Mock Service Worker for test API mocking. Dev dependency only.
- Existing `@dnd-kit/core` and `@dnd-kit/sortable` are reused for the template builder (already in `package.json`).

---

## 2. Role-Based Routing Architecture

### 2.1 Auth0 Role Claims

Auth0 RBAC attaches custom claims to the ID token and access token:

```json
{
  "https://discover.legal/roles": ["client"],
  "https://discover.legal/lawyer_id": null,
  "https://discover.legal/stripe_account_id": null
}
```

For a verified lawyer:

```json
{
  "https://discover.legal/roles": ["lawyer", "client"],
  "https://discover.legal/lawyer_id": "law_abc123",
  "https://discover.legal/stripe_account_id": "acct_1Nv0..."
}
```

A lawyer always also has the `client` role (they can purchase other lawyers' templates). An admin has all three roles.

### 2.2 RoleProvider Implementation

```javascript
// client/src/contexts/RoleContext.js
import React, { createContext, useContext, useMemo } from 'react';
import { useAuth0 } from '@auth0/auth0-react';

const CLAIMS_NAMESPACE = 'https://discover.legal';

const RoleContext = createContext({
  roles: [],
  isClient: false,
  isLawyer: false,
  isAdmin: false,
  lawyerId: null,
  stripeAccountId: null,
  primaryRole: null,
  isLoading: true
});

export const RoleProvider = ({ children }) => {
  const { user, isAuthenticated, isLoading } = useAuth0();

  const value = useMemo(() => {
    if (isLoading || !isAuthenticated || !user) {
      return {
        roles: [],
        isClient: false,
        isLawyer: false,
        isAdmin: false,
        lawyerId: null,
        stripeAccountId: null,
        primaryRole: null,
        isLoading
      };
    }

    const roles = user[`${CLAIMS_NAMESPACE}/roles`] || ['client'];
    const lawyerId = user[`${CLAIMS_NAMESPACE}/lawyer_id`] || null;
    const stripeAccountId = user[`${CLAIMS_NAMESPACE}/stripe_account_id`] || null;

    const isAdmin = roles.includes('admin');
    const isLawyer = roles.includes('lawyer');
    const isClient = roles.includes('client');

    // Primary role determines default portal redirect.
    // Priority: admin > lawyer > client
    let primaryRole = 'client';
    if (isAdmin) primaryRole = 'admin';
    else if (isLawyer) primaryRole = 'lawyer';

    return {
      roles,
      isClient,
      isLawyer,
      isAdmin,
      lawyerId,
      stripeAccountId,
      primaryRole,
      isLoading: false
    };
  }, [user, isAuthenticated, isLoading]);

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
};

export const useRole = () => useContext(RoleContext);
```

### 2.3 RoleGuard Component

```javascript
// client/src/components/shared/RoleGuard.js
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth0 } from '@auth0/auth0-react';
import { useRole } from '../../contexts/RoleContext';

/**
 * Protects routes by requiring authentication and specific roles.
 *
 * @param {Object} props
 * @param {'client'|'lawyer'|'admin'} props.requiredRole - Minimum role required
 * @param {React.ReactNode} props.children - Protected content
 * @param {React.ReactNode} [props.fallback] - Shown when role is missing (defaults to redirect)
 */
const RoleGuard = ({ requiredRole, children, fallback = null }) => {
  const { isAuthenticated, isLoading: authLoading, loginWithRedirect } = useAuth0();
  const { roles, isLoading: roleLoading } = useRole();
  const location = useLocation();

  // Still loading auth or role data
  if (authLoading || roleLoading) {
    return null; // Or a skeleton -- the parent Suspense handles the loading state
  }

  // Not authenticated: redirect to Auth0 login with return URL
  if (!isAuthenticated) {
    loginWithRedirect({
      appState: { returnTo: location.pathname + location.search }
    });
    return null;
  }

  // Authenticated but missing required role
  if (!roles.includes(requiredRole)) {
    if (fallback) return fallback;

    // Lawyer routes: show "Become a Provider" CTA
    if (requiredRole === 'lawyer') {
      return <Navigate to="/lawyer/onboarding" replace />;
    }

    // Admin routes: redirect to home
    if (requiredRole === 'admin') {
      return <Navigate to="/marketplace" replace />;
    }

    return <Navigate to="/marketplace" replace />;
  }

  return children;
};

export default RoleGuard;
```

### 2.4 Route Configuration

```javascript
// client/src/App.js -- route structure (abbreviated)
const AppRoutes = () => {
  const { isAuthenticated } = useAuth0();
  const { primaryRole } = useRole();

  return (
    <Routes>
      {/* Root redirect: authenticated users go to their portal */}
      <Route
        path="/"
        element={
          isAuthenticated
            ? <Navigate to={primaryRole === 'lawyer' ? '/lawyer/dashboard' : '/my/dashboard'} replace />
            : <Navigate to="/marketplace" replace />
        }
      />

      {/* PUBLIC: Marketplace (no auth required) */}
      <Route path="/marketplace" element={
        <Suspense fallback={<LoadingOverlay />}>
          <MarketplaceView />
        </Suspense>
      }>
        <Route index element={<MarketplaceBrowse />} />
        <Route path="search" element={<MarketplaceSearch />} />
        <Route path=":templateId" element={<TemplateDetail />} />
        <Route path="lawyer/:lawyerId" element={<LawyerProfile />} />
      </Route>

      {/* AUTHENTICATED: Client portal */}
      <Route path="/my" element={
        <TOSGuard>
          <RoleGuard requiredRole="client">
            <Suspense fallback={<LoadingOverlay />}>
              <ClientPortalView />
            </Suspense>
          </RoleGuard>
        </TOSGuard>
      }>
        <Route path="dashboard" element={<ClientDashboard />} />
        <Route path="documents" element={<ClientDocumentList />} />
        <Route path="documents/:documentId" element={<ClientDocumentDetail />} />
        <Route path="purchases" element={<PurchaseHistory />} />
      </Route>

      {/* AUTHENTICATED: Interview (shared between client and lawyer preview) */}
      <Route path="/editor/new" element={
        <TOSGuard>
          <RoleGuard requiredRole="client">
            <EditorView isNew={true} />
          </RoleGuard>
        </TOSGuard>
      } />
      <Route path="/editor/:documentId" element={
        <TOSGuard>
          <RoleGuard requiredRole="client">
            <EditorView />
          </RoleGuard>
        </TOSGuard>
      } />

      {/* AUTHENTICATED: Lawyer portal */}
      <Route path="/lawyer" element={
        <TOSGuard>
          <RoleGuard requiredRole="lawyer">
            <Suspense fallback={<LoadingOverlay />}>
              <LawyerPortalView />
            </Suspense>
          </RoleGuard>
        </TOSGuard>
      }>
        <Route path="dashboard" element={<LawyerDashboard />} />
        <Route path="templates" element={<TemplateList />} />
        <Route path="templates/new" element={<TemplateBuilder />} />
        <Route path="templates/:templateId" element={<TemplateBuilder />} />
        <Route path="templates/:templateId/preview" element={<TemplatePreview />} />
        <Route path="templates/:templateId/analytics" element={<TemplateAnalytics />} />
        <Route path="clients" element={<ClientManagement />} />
        <Route path="clients/:clientDocId" element={<ClientDocumentView />} />
        <Route path="earnings" element={<EarningsPanel />} />
        <Route path="settings" element={<LawyerSettings />} />
        <Route path="onboarding" element={<LawyerOnboarding />} />
      </Route>

      {/* AUTHENTICATED: Admin portal (Phase 4) */}
      <Route path="/admin" element={
        <TOSGuard>
          <RoleGuard requiredRole="admin">
            <Suspense fallback={<LoadingOverlay />}>
              <AdminPortalView />
            </Suspense>
          </RoleGuard>
        </TOSGuard>
      }>
        <Route path="moderation" element={<ListingModeration />} />
        <Route path="payouts" element={<PayoutManagement />} />
        <Route path="users" element={<UserManagement />} />
      </Route>

      {/* Existing public pages */}
      <Route path="/privacy" element={<PrivacyPolicyPage />} />
      <Route path="/tos" element={<TermsOfServicePage />} />
      <Route path="/resources" element={<ResourcesPage />} />
      <Route path="/resources/:slug" element={<ArticlePage />} />
      <Route path="/brand" element={<BrandAssetsPage />} />

      {/* Backward compat: old /dashboard -> /my/dashboard */}
      <Route path="/dashboard" element={<Navigate to="/my/dashboard" replace />} />

      {/* Payment return */}
      <Route path="/payment-success" element={
        <TOSGuard>
          <Navigate to="/my/dashboard" replace />
        </TOSGuard>
      } />

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/marketplace" replace />} />
    </Routes>
  );
};
```

### 2.5 Handling Dual-Role Users (Lawyer + Client)

A lawyer always also has the `client` role. The UI handles this by:

1. **Portal switcher in the header**: `PortalHeader` shows a dropdown ("Switch to Client View" / "Switch to Lawyer Portal") when the user has multiple roles.
2. **primaryRole determines default redirect**: From `/`, a lawyer goes to `/lawyer/dashboard`. They can navigate to `/my/dashboard` for their client view.
3. **Route guards are additive**: `/my/*` requires `client` role, which lawyers have. `/lawyer/*` requires `lawyer` role. No conflict.
4. **Context isolation**: The lawyer portal uses `TemplateContext`; the client portal uses `DocumentContext`. Switching portals does not cross-contaminate state.

### 2.6 Deep Linking: Marketplace to Purchase to Interview

```
/marketplace/:templateId          User views template detail page
  -> clicks "Get This Template"
  -> if not authenticated: Auth0 login with returnTo=/marketplace/:templateId?action=purchase
  -> if authenticated:
     -> PurchaseFlow component opens as modal overlay
     -> Stripe PaymentElement confirms payment
     -> on success: POST /api/purchases (creates document, links to template)
     -> redirect to /editor/:newDocumentId?templateId=:templateId
     -> EditorView loads interview config from template and starts interview
```

URL state (`?action=purchase`) preserves intent across the Auth0 redirect. The `onRedirectCallback` in Auth0Provider restores the user to the template detail page with the purchase modal auto-opened.

---

## 3. State Management Patterns

### 3.1 Decision Framework

| Scenario | Solution | Rationale |
|----------|----------|-----------|
| User role across all components | `RoleContext` | Rarely changes, needed everywhere |
| Marketplace search state | `MarketplaceContext` + URL params | URL is source of truth for shareable links |
| Template builder form state | Zustand store | Deep nested updates, undo/redo, performance |
| Interview progress | `InterviewContext` (useReducer) | State machine with well-defined transitions |
| Document data (existing) | `DocumentContext` (useReducer) | Already built, split into 5 sub-contexts |
| TOS acceptance | `TOSContext` (useState) | Simple boolean, already built |
| Toast notifications | `ToastContext` | Portal-level concern, queue-based |
| Server cache (listings, reviews) | Stale-while-revalidate in hooks | No global cache library; hooks manage their own fetch lifecycle |
| URL state (search query, filters) | `useSearchParams` from React Router | Shareable, bookmarkable, back-button friendly |
| Form inputs (simple) | Local `useState` | No reason to lift simple input state |

### 3.2 URL as State Source for Marketplace Search

Marketplace search state lives in the URL, not in context. This makes results linkable and back-button-friendly.

```javascript
// client/src/hooks/useMarketplace.js
import { useSearchParams } from 'react-router-dom';
import { useState, useEffect, useCallback, useRef } from 'react';
import { marketplaceApi } from '../services/marketplaceApi';

const DEFAULT_PAGE_SIZE = 20;

export const useMarketplace = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [results, setResults] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);

  // Read filters from URL
  const filters = {
    q: searchParams.get('q') || '',
    jurisdiction: searchParams.get('jurisdiction') || '',
    matterType: searchParams.get('matterType') || '',
    minPrice: searchParams.get('minPrice') || '',
    maxPrice: searchParams.get('maxPrice') || '',
    minRating: searchParams.get('minRating') || '',
    sortBy: searchParams.get('sortBy') || 'relevance',
    cursor: searchParams.get('cursor') || '',
    pageSize: parseInt(searchParams.get('pageSize'), 10) || DEFAULT_PAGE_SIZE
  };

  // Update a single filter (merges with existing params)
  const setFilter = useCallback((key, value) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (value) {
        next.set(key, value);
      } else {
        next.delete(key);
      }
      // Reset cursor when filters change
      if (key !== 'cursor') {
        next.delete('cursor');
      }
      return next;
    });
  }, [setSearchParams]);

  const clearFilters = useCallback(() => {
    setSearchParams({});
  }, [setSearchParams]);

  // Fetch results when URL params change
  useEffect(() => {
    // Cancel previous in-flight request
    if (abortRef.current) {
      abortRef.current.abort();
    }

    const controller = new AbortController();
    abortRef.current = controller;

    const fetchResults = async () => {
      setIsSearching(true);
      setError(null);

      try {
        const data = await marketplaceApi.search(filters, controller.signal);
        setResults(data.templates);
        setTotalCount(data.totalCount);
      } catch (err) {
        if (err.name !== 'AbortError') {
          setError(err.message);
        }
      } finally {
        setIsSearching(false);
      }
    };

    // Debounce: wait 300ms after URL change before fetching
    const timer = setTimeout(fetchResults, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    filters,
    results,
    totalCount,
    isSearching,
    error,
    setFilter,
    clearFilters,
    hasNextPage: results.length === filters.pageSize,
    loadNextPage: () => {
      if (results.length > 0) {
        setFilter('cursor', results[results.length - 1].id);
      }
    }
  };
};
```

### 3.3 Real-Time State: Revenue Notifications and View Counts

Real-time updates use Server-Sent Events (SSE) for the lawyer portal (see section 8). The state pattern:

```javascript
// In LawyerDashboard, subscribe to SSE for revenue events.
// Use a ref to hold the EventSource so it persists across renders.

const [recentPurchases, setRecentPurchases] = useState([]);

useEffect(() => {
  const eventSource = realtimeService.subscribe('lawyer-events');

  eventSource.addEventListener('purchase', (event) => {
    const purchase = JSON.parse(event.data);
    setRecentPurchases(prev => [purchase, ...prev].slice(0, 20));
  });

  eventSource.addEventListener('view-count', (event) => {
    const { templateId, views } = JSON.parse(event.data);
    // Update the specific template's view count in local state
    setTemplates(prev =>
      prev.map(t => t.id === templateId ? { ...t, viewCount: views } : t)
    );
  });

  return () => eventSource.close();
}, []);
```

### 3.4 Optimistic Updates for Template Builder

The template builder uses optimistic updates to feel instant. Changes are applied to local state immediately, then synced to the server. If the server rejects the change, local state rolls back.

```javascript
// Pattern: optimistic update with rollback
const updatePhase = async (phaseId, updates) => {
  // 1. Snapshot current state for rollback
  const previousPhases = [...templateStore.phases];

  // 2. Optimistically apply the update
  templateStore.updatePhase(phaseId, updates);

  try {
    // 3. Persist to server
    await templateApi.updatePhase(templateId, phaseId, updates);
  } catch (error) {
    // 4. Rollback on failure
    templateStore.setPhases(previousPhases);
    toast.error('Failed to save changes. Reverted.');
  }
};
```

### 3.5 Interview State Machine

The dynamic interview tracks the client's progress through JSONB-defined phases. This is a finite state machine managed by `useReducer`.

```javascript
// client/src/contexts/InterviewContext.js
import React, { createContext, useContext, useReducer, useMemo } from 'react';

const InterviewContext = createContext();

const interviewActions = {
  INIT: 'INIT',
  ADVANCE_PHASE: 'ADVANCE_PHASE',
  GO_BACK: 'GO_BACK',
  SKIP_PHASE: 'SKIP_PHASE',
  SET_ANSWER: 'SET_ANSWER',
  SET_PHASE_COMPLETE: 'SET_PHASE_COMPLETE',
  RESTORE_PROGRESS: 'RESTORE_PROGRESS',
  SET_ERROR: 'SET_ERROR'
};

const initialInterviewState = {
  templateConfig: null,        // JSONB interview config from template
  phases: [],                  // Ordered phase definitions
  currentPhaseIndex: 0,        // Index into phases array
  currentQuestionIndex: 0,     // Index into current phase's questions
  answers: {},                 // { [questionId]: value }
  completedPhases: new Set(),  // Phase IDs that are complete
  skippedPhases: new Set(),    // Phase IDs that were skipped (conditional)
  history: [],                 // Stack of visited phase indices (for back navigation)
  error: null
};

function interviewReducer(state, action) {
  switch (action.type) {
    case interviewActions.INIT: {
      const { templateConfig, savedProgress } = action.payload;
      const phases = templateConfig.phases || [];

      // If restoring saved progress, merge it in
      if (savedProgress) {
        return {
          ...initialInterviewState,
          templateConfig,
          phases,
          currentPhaseIndex: savedProgress.currentPhaseIndex || 0,
          currentQuestionIndex: savedProgress.currentQuestionIndex || 0,
          answers: savedProgress.answers || {},
          completedPhases: new Set(savedProgress.completedPhases || []),
          skippedPhases: new Set(savedProgress.skippedPhases || []),
          history: savedProgress.history || []
        };
      }

      return {
        ...initialInterviewState,
        templateConfig,
        phases
      };
    }

    case interviewActions.SET_ANSWER: {
      const { questionId, value } = action.payload;
      return {
        ...state,
        answers: { ...state.answers, [questionId]: value }
      };
    }

    case interviewActions.ADVANCE_PHASE: {
      const nextIndex = state.currentPhaseIndex + 1;

      // Check conditional logic: should the next phase be skipped?
      const nextPhase = state.phases[nextIndex];
      if (nextPhase && shouldSkipPhase(nextPhase, state.answers, state.templateConfig)) {
        // Recursively skip to the next non-skipped phase
        return interviewReducer(
          {
            ...state,
            currentPhaseIndex: nextIndex,
            currentQuestionIndex: 0,
            skippedPhases: new Set([...state.skippedPhases, nextPhase.id]),
            completedPhases: new Set([
              ...state.completedPhases,
              state.phases[state.currentPhaseIndex]?.id
            ]),
            history: [...state.history, state.currentPhaseIndex]
          },
          { type: interviewActions.ADVANCE_PHASE }
        );
      }

      return {
        ...state,
        currentPhaseIndex: nextIndex,
        currentQuestionIndex: 0,
        completedPhases: new Set([
          ...state.completedPhases,
          state.phases[state.currentPhaseIndex]?.id
        ]),
        history: [...state.history, state.currentPhaseIndex]
      };
    }

    case interviewActions.GO_BACK: {
      const prevIndex = state.history[state.history.length - 1];
      if (prevIndex === undefined) return state;

      return {
        ...state,
        currentPhaseIndex: prevIndex,
        currentQuestionIndex: 0,
        history: state.history.slice(0, -1)
      };
    }

    case interviewActions.SET_PHASE_COMPLETE: {
      return {
        ...state,
        completedPhases: new Set([...state.completedPhases, action.payload])
      };
    }

    case interviewActions.SET_ERROR: {
      return { ...state, error: action.payload };
    }

    default:
      return state;
  }
}

/**
 * Evaluates whether a phase should be skipped based on conditional rules.
 */
function shouldSkipPhase(phase, answers, config) {
  if (!phase.conditions || phase.conditions.length === 0) return false;

  return phase.conditions.some(condition => {
    const { questionId, operator, value } = condition;
    const answer = answers[questionId];

    switch (operator) {
      case 'equals': return answer === value;
      case 'not_equals': return answer !== value;
      case 'contains': return Array.isArray(answer) && answer.includes(value);
      case 'not_contains': return !Array.isArray(answer) || !answer.includes(value);
      case 'is_empty': return !answer || answer === '' || (Array.isArray(answer) && answer.length === 0);
      case 'is_not_empty': return answer && answer !== '' && (!Array.isArray(answer) || answer.length > 0);
      case 'greater_than': return Number(answer) > Number(value);
      case 'less_than': return Number(answer) < Number(value);
      default: return false;
    }
  });
}

export const InterviewProvider = ({ children }) => {
  const [state, dispatch] = useReducer(interviewReducer, initialInterviewState);

  const value = useMemo(() => ({
    ...state,
    currentPhase: state.phases[state.currentPhaseIndex] || null,
    isFirstPhase: state.currentPhaseIndex === 0,
    isLastPhase: state.currentPhaseIndex >= state.phases.length - 1,
    progressPercent: state.phases.length > 0
      ? Math.round((state.completedPhases.size / state.phases.length) * 100)
      : 0,
    dispatch
  }), [state]);

  return (
    <InterviewContext.Provider value={value}>
      {children}
    </InterviewContext.Provider>
  );
};

export const useInterview = () => useContext(InterviewContext);
export { interviewActions };
```

### 3.6 Cache Invalidation

Marketplace listings use a stale-while-revalidate pattern. The hook returns cached data immediately, then fetches fresh data in the background.

```javascript
// Pattern for stale-while-revalidate in a hook
const STALE_TIME = 60_000; // 1 minute

const useCachedQuery = (key, fetcher) => {
  const cacheRef = useRef({});
  const [data, setData] = useState(cacheRef.current[key]?.data || null);
  const [isLoading, setIsLoading] = useState(!cacheRef.current[key]);

  useEffect(() => {
    const cached = cacheRef.current[key];
    const isStale = !cached || (Date.now() - cached.timestamp > STALE_TIME);

    if (cached) {
      setData(cached.data); // Show stale data immediately
    }

    if (isStale) {
      setIsLoading(!cached); // Only show loading if no cache at all
      fetcher().then(freshData => {
        cacheRef.current[key] = { data: freshData, timestamp: Date.now() };
        setData(freshData);
        setIsLoading(false);
      }).catch(() => {
        setIsLoading(false);
      });
    }
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  return { data, isLoading };
};
```

### 3.7 Shopping Cart / Purchase Flow State

The marketplace uses a single-item purchase model (no cart). Purchase state is ephemeral and local to the `PurchaseFlow` component:

```javascript
// PurchaseFlow manages its own state; no global cart context needed
const [purchaseState, setPurchaseState] = useState({
  step: 'confirm',  // 'confirm' | 'payment' | 'processing' | 'complete' | 'error'
  templateId: null,
  price: null,
  clientSecret: null,  // Stripe PaymentIntent client secret
  purchaseId: null,     // Set after successful purchase
  error: null
});
```

If multi-item carts are added in the future, this would move to a `CartContext`. For now, the single-item flow keeps complexity minimal.

---

## 4. API Client Layer

### 4.1 Centralized API Client

The existing codebase has `API_BASE_URL` declared in 4 separate files (`DocumentContext.js`, `ChatInterface.js`, `PaymentModal.js`, `authService.js`). The marketplace consolidates this into a single API client with interceptors.

```javascript
// client/src/services/apiClient.js
let _getToken = null;
let _onAuthError = null;

/**
 * Initialize the API client with Auth0 token retrieval.
 * Called once in App.js after Auth0Provider mounts.
 */
export const initApiClient = (getAccessTokenSilently, loginWithRedirect) => {
  _getToken = getAccessTokenSilently;
  _onAuthError = loginWithRedirect;
};

const API_BASE = process.env.REACT_APP_API_URL !== undefined
  ? process.env.REACT_APP_API_URL
  : 'http://localhost:3001';

/**
 * Makes an authenticated API request with interceptors.
 *
 * @param {string} path - API path (e.g., '/api/marketplace/search')
 * @param {Object} [options] - Fetch options
 * @param {Object} [options.params] - URL query parameters
 * @param {boolean} [options.authenticated=true] - Whether to attach Bearer token
 * @param {AbortSignal} [options.signal] - AbortController signal
 * @param {number} [options.retries=1] - Number of retries on 5xx or network errors
 * @returns {Promise<Object>} Parsed JSON response
 */
export const apiClient = async (path, options = {}) => {
  const {
    params,
    authenticated = true,
    signal,
    retries = 1,
    ...fetchOptions
  } = options;

  // Build URL with query params
  let url = `${API_BASE}${path}`;
  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== null && v !== undefined && v !== '') {
        searchParams.set(k, v);
      }
    });
    const qs = searchParams.toString();
    if (qs) url += `?${qs}`;
  }

  // Build headers
  const headers = {
    'Content-Type': 'application/json',
    ...fetchOptions.headers
  };

  // Attach auth token if requested and available
  if (authenticated && _getToken) {
    try {
      const token = await _getToken({
        audience: process.env.REACT_APP_AUTH0_AUDIENCE,
        timeoutInSeconds: 10
      });
      headers.Authorization = `Bearer ${token}`;
    } catch (err) {
      // Token retrieval failed: redirect to login
      if (err.error === 'login_required' && _onAuthError) {
        _onAuthError();
      }
      throw err;
    }
  }

  // Execute with retry logic
  let lastError = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {
        ...fetchOptions,
        headers,
        signal
      });

      // Handle specific status codes
      if (response.status === 401) {
        if (_onAuthError) _onAuthError();
        throw new ApiError('Authentication required', 401);
      }

      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        throw new RateLimitError(
          'Too many requests. Please wait.',
          429,
          retryAfter ? parseInt(retryAfter, 10) : 60
        );
      }

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new ApiError(
          errorBody.error || `HTTP ${response.status}`,
          response.status,
          errorBody
        );
      }

      return await response.json();
    } catch (err) {
      lastError = err;

      // Do not retry on client errors (4xx), abort, or rate limits
      if (
        err.name === 'AbortError' ||
        err instanceof RateLimitError ||
        (err instanceof ApiError && err.status >= 400 && err.status < 500)
      ) {
        throw err;
      }

      // Retry on network errors or 5xx
      if (attempt < retries) {
        await new Promise(resolve =>
          setTimeout(resolve, Math.pow(2, attempt) * 1000)
        );
        continue;
      }
    }
  }

  throw lastError;
};

export class ApiError extends Error {
  constructor(message, status, body = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

export class RateLimitError extends ApiError {
  constructor(message, status, retryAfterSeconds) {
    super(message, status);
    this.name = 'RateLimitError';
    this.retryAfterSeconds = retryAfterSeconds;
  }
}
```

### 4.2 Service Module Pattern

Each API domain gets its own module that uses `apiClient`:

```javascript
// client/src/services/marketplaceApi.js
import { apiClient } from './apiClient';

export const marketplaceApi = {
  /**
   * Search marketplace templates with filters.
   * @param {Object} filters - Search filters (q, jurisdiction, matterType, etc.)
   * @param {AbortSignal} [signal] - Abort signal for request cancellation
   * @returns {Promise<{ templates: Object[], totalCount: number }>}
   */
  search: (filters, signal) =>
    apiClient('/api/marketplace/templates', {
      authenticated: false, // Public endpoint
      params: filters,
      signal
    }),

  getTemplate: (templateId) =>
    apiClient(`/api/marketplace/templates/${templateId}`, {
      authenticated: false
    }),

  getFeatured: () =>
    apiClient('/api/marketplace/featured', {
      authenticated: false,
      retries: 2 // Featured section is high-visibility
    }),

  getCategories: () =>
    apiClient('/api/marketplace/categories', {
      authenticated: false
    }),

  getLawyerProfile: (lawyerId) =>
    apiClient(`/api/marketplace/lawyers/${lawyerId}`, {
      authenticated: false
    })
};
```

```javascript
// client/src/services/lawyerApi.js
import { apiClient } from './apiClient';

export const lawyerApi = {
  getDashboard: () =>
    apiClient('/api/lawyer/dashboard'),

  getTemplates: (params) =>
    apiClient('/api/lawyer/templates', { params }),

  createTemplate: (data) =>
    apiClient('/api/lawyer/templates', {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  updateTemplate: (templateId, data) =>
    apiClient(`/api/lawyer/templates/${templateId}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),

  publishTemplate: (templateId) =>
    apiClient(`/api/lawyer/templates/${templateId}/publish`, {
      method: 'POST'
    }),

  getEarnings: (params) =>
    apiClient('/api/lawyer/earnings', { params }),

  getClients: (params) =>
    apiClient('/api/lawyer/clients', { params }),

  getAnalytics: (templateId, params) =>
    apiClient(`/api/lawyer/templates/${templateId}/analytics`, { params })
};
```

### 4.3 Pagination Helpers (Cursor-Based)

The marketplace API uses cursor-based pagination for stable results during browsing:

```javascript
// client/src/hooks/useInfiniteScroll.js
import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Hook for infinite scrolling with cursor-based pagination.
 * Attaches an IntersectionObserver to a sentinel element.
 */
export const useInfiniteScroll = (fetchPage, { pageSize = 20 } = {}) => {
  const [items, setItems] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const sentinelRef = useRef(null);

  const loadMore = useCallback(async () => {
    if (isLoading || !hasMore) return;
    setIsLoading(true);

    try {
      const data = await fetchPage({ cursor, pageSize });
      setItems(prev => [...prev, ...data.items]);
      setCursor(data.nextCursor);
      setHasMore(data.items.length === pageSize && !!data.nextCursor);
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Failed to load page:', err);
      }
    } finally {
      setIsLoading(false);
    }
  }, [cursor, hasMore, isLoading, fetchPage, pageSize]);

  // Reset when fetchPage function identity changes (new search)
  const reset = useCallback(() => {
    setItems([]);
    setCursor(null);
    setHasMore(true);
  }, []);

  // IntersectionObserver for auto-loading
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasMore && !isLoading) {
          loadMore();
        }
      },
      { rootMargin: '200px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, isLoading, loadMore]);

  return { items, isLoading, hasMore, sentinelRef, reset, loadMore };
};
```

### 4.4 Rate Limit Handling

When the API returns 429, the UI shows a non-blocking toast and automatically retries after the `Retry-After` period:

```javascript
// In a component or hook that catches RateLimitError
try {
  const data = await marketplaceApi.search(filters);
  // ...
} catch (err) {
  if (err instanceof RateLimitError) {
    toast.warning(`Please wait ${err.retryAfterSeconds}s before searching again.`);
    // Optionally auto-retry after the wait period
    setTimeout(() => {
      retrySearch();
    }, err.retryAfterSeconds * 1000);
  } else {
    toast.error(err.message);
  }
}
```

---

## 5. Template Builder Technical Design

### 5.1 Why Zustand for Template Builder State

The template builder has deep nested state (phases > questions > conditions > options) that changes frequently during editing. React Context with `useReducer` would cause excessive re-renders across the entire builder because any change to the config re-renders every phase and question editor. Zustand's selector-based subscriptions solve this: each `QuestionEditor` subscribes only to its own question's data.

Zustand is used only for the template builder. All other state management continues to use React Context and `useReducer` to maintain consistency with the existing codebase.

```javascript
// client/src/components/lawyer/templateBuilder/templateBuilderStore.js
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

/**
 * Template builder state store.
 * Uses immer middleware for immutable updates with mutable syntax.
 *
 * The store shape mirrors the template_config JSONB column:
 * {
 *   phases: [
 *     {
 *       id: string,
 *       title: string,
 *       description: string,
 *       order: number,
 *       questions: [
 *         {
 *           id: string,
 *           prompt: string,
 *           helpText: string,
 *           inputType: 'text' | 'textarea' | 'select' | 'multi_select'
 *                     | 'date' | 'number' | 'boolean' | 'file_upload'
 *                     | 'jurisdiction' | 'county',
 *           options: string[] | null,
 *           required: boolean,
 *           factFieldKey: string,
 *           order: number,
 *           conditions: [
 *             {
 *               questionId: string,
 *               operator: 'equals' | 'not_equals' | 'contains'
 *                        | 'is_empty' | 'greater_than' | 'less_than',
 *               value: any
 *             }
 *           ]
 *         }
 *       ],
 *       conditions: [...]  // Phase-level skip conditions
 *     }
 *   ],
 *   requiredFacts: string[],
 *   optionalFacts: string[],
 *   aiPromptOverrides: { [phaseId]: string }
 * }
 */
const useTemplateBuilderStore = create(
  immer((set, get) => ({
    // Template metadata
    templateId: null,
    title: '',
    description: '',
    jurisdiction: '',
    matterType: '',
    pricing: { amount: 100, currency: 'usd' },
    status: 'draft',
    version: 1,

    // Interview config (the complex part)
    phases: [],
    requiredFacts: [],
    optionalFacts: [],
    aiPromptOverrides: {},

    // UI state
    isDirty: false,
    isSaving: false,
    lastSaved: null,
    selectedPhaseId: null,
    selectedQuestionId: null,
    undoStack: [],
    redoStack: [],

    // --- Metadata actions ---
    setMetadata: (fields) =>
      set(state => {
        Object.assign(state, fields);
        state.isDirty = true;
      }),

    // --- Phase actions ---
    addPhase: (phase) =>
      set(state => {
        state.undoStack.push(JSON.parse(JSON.stringify(state.phases)));
        state.redoStack = [];
        state.phases.push({
          id: `phase_${Date.now()}`,
          title: phase.title || 'New Phase',
          description: phase.description || '',
          order: state.phases.length,
          questions: [],
          conditions: [],
          ...phase
        });
        state.isDirty = true;
      }),

    updatePhase: (phaseId, updates) =>
      set(state => {
        const phase = state.phases.find(p => p.id === phaseId);
        if (phase) {
          state.undoStack.push(JSON.parse(JSON.stringify(state.phases)));
          state.redoStack = [];
          Object.assign(phase, updates);
          state.isDirty = true;
        }
      }),

    removePhase: (phaseId) =>
      set(state => {
        state.undoStack.push(JSON.parse(JSON.stringify(state.phases)));
        state.redoStack = [];
        state.phases = state.phases.filter(p => p.id !== phaseId);
        state.isDirty = true;
      }),

    reorderPhases: (fromIndex, toIndex) =>
      set(state => {
        state.undoStack.push(JSON.parse(JSON.stringify(state.phases)));
        state.redoStack = [];
        const [moved] = state.phases.splice(fromIndex, 1);
        state.phases.splice(toIndex, 0, moved);
        state.phases.forEach((p, i) => { p.order = i; });
        state.isDirty = true;
      }),

    // --- Question actions ---
    addQuestion: (phaseId, question) =>
      set(state => {
        const phase = state.phases.find(p => p.id === phaseId);
        if (phase) {
          state.undoStack.push(JSON.parse(JSON.stringify(state.phases)));
          state.redoStack = [];
          phase.questions.push({
            id: `q_${Date.now()}`,
            prompt: question.prompt || 'New Question',
            helpText: '',
            inputType: 'text',
            options: null,
            required: true,
            factFieldKey: '',
            order: phase.questions.length,
            conditions: [],
            ...question
          });
          state.isDirty = true;
        }
      }),

    updateQuestion: (phaseId, questionId, updates) =>
      set(state => {
        const phase = state.phases.find(p => p.id === phaseId);
        if (phase) {
          const question = phase.questions.find(q => q.id === questionId);
          if (question) {
            state.undoStack.push(JSON.parse(JSON.stringify(state.phases)));
            state.redoStack = [];
            Object.assign(question, updates);
            state.isDirty = true;
          }
        }
      }),

    removeQuestion: (phaseId, questionId) =>
      set(state => {
        const phase = state.phases.find(p => p.id === phaseId);
        if (phase) {
          state.undoStack.push(JSON.parse(JSON.stringify(state.phases)));
          state.redoStack = [];
          phase.questions = phase.questions.filter(q => q.id !== questionId);
          state.isDirty = true;
        }
      }),

    reorderQuestions: (phaseId, fromIndex, toIndex) =>
      set(state => {
        const phase = state.phases.find(p => p.id === phaseId);
        if (phase) {
          state.undoStack.push(JSON.parse(JSON.stringify(state.phases)));
          state.redoStack = [];
          const [moved] = phase.questions.splice(fromIndex, 1);
          phase.questions.splice(toIndex, 0, moved);
          phase.questions.forEach((q, i) => { q.order = i; });
          state.isDirty = true;
        }
      }),

    // --- Undo / Redo ---
    undo: () =>
      set(state => {
        if (state.undoStack.length === 0) return;
        state.redoStack.push(JSON.parse(JSON.stringify(state.phases)));
        state.phases = state.undoStack.pop();
        state.isDirty = true;
      }),

    redo: () =>
      set(state => {
        if (state.redoStack.length === 0) return;
        state.undoStack.push(JSON.parse(JSON.stringify(state.phases)));
        state.phases = state.redoStack.pop();
        state.isDirty = true;
      }),

    // --- Persistence ---
    markSaved: () =>
      set(state => {
        state.isDirty = false;
        state.isSaving = false;
        state.lastSaved = new Date().toISOString();
      }),

    markSaving: () =>
      set(state => {
        state.isSaving = true;
      }),

    // --- Load from API ---
    loadTemplate: (templateData) =>
      set(state => {
        state.templateId = templateData.id;
        state.title = templateData.title;
        state.description = templateData.description;
        state.jurisdiction = templateData.jurisdiction;
        state.matterType = templateData.matter_type;
        state.pricing = templateData.pricing;
        state.status = templateData.status;
        state.version = templateData.version;
        state.phases = templateData.template_config?.phases || [];
        state.requiredFacts = templateData.template_config?.requiredFacts || [];
        state.optionalFacts = templateData.template_config?.optionalFacts || [];
        state.aiPromptOverrides = templateData.template_config?.aiPromptOverrides || {};
        state.isDirty = false;
        state.undoStack = [];
        state.redoStack = [];
      }),

    // Export the full template_config JSONB for API persistence
    getTemplateConfig: () => {
      const s = get();
      return {
        phases: s.phases,
        requiredFacts: s.requiredFacts,
        optionalFacts: s.optionalFacts,
        aiPromptOverrides: s.aiPromptOverrides
      };
    }
  }))
);

export default useTemplateBuilderStore;
```

### 5.2 Drag-and-Drop Implementation

The existing `@dnd-kit/core` and `@dnd-kit/sortable` packages (already in `client/package.json`) are used for both phase reordering and question reordering within a phase.

```javascript
// client/src/components/lawyer/templateBuilder/InterviewFlowBuilder.js
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import useTemplateBuilderStore from './templateBuilderStore';
import PhaseEditor from './PhaseEditor';

const InterviewFlowBuilder = () => {
  const phases = useTemplateBuilderStore(s => s.phases);
  const reorderPhases = useTemplateBuilderStore(s => s.reorderPhases);
  const addPhase = useTemplateBuilderStore(s => s.addPhase);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 }
    })
  );

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (active.id !== over?.id) {
      const oldIndex = phases.findIndex(p => p.id === active.id);
      const newIndex = phases.findIndex(p => p.id === over.id);
      reorderPhases(oldIndex, newIndex);
    }
  };

  return (
    <div className="space-y-4">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis]}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={phases.map(p => p.id)}
          strategy={verticalListSortingStrategy}
        >
          {phases.map(phase => (
            <PhaseEditor key={phase.id} phaseId={phase.id} />
          ))}
        </SortableContext>
      </DndContext>

      <button
        onClick={() => addPhase({ title: 'New Phase' })}
        className="w-full py-3 border-2 border-dashed border-gray-300
                   rounded-lg text-gray-500 hover:border-blue-400
                   hover:text-blue-500 transition-colors"
      >
        + Add Phase
      </button>
    </div>
  );
};
```

### 5.3 Conditional Logic Builder UI

The `ConditionalLogicEditor` allows lawyers to define skip/show rules. Each rule references a question by ID and evaluates the client's answer.

```javascript
// client/src/components/lawyer/templateBuilder/ConditionalLogicEditor.js
import React from 'react';
import useTemplateBuilderStore from './templateBuilderStore';

const OPERATORS = [
  { value: 'equals', label: 'equals' },
  { value: 'not_equals', label: 'does not equal' },
  { value: 'contains', label: 'contains' },
  { value: 'not_contains', label: 'does not contain' },
  { value: 'is_empty', label: 'is empty' },
  { value: 'is_not_empty', label: 'is not empty' },
  { value: 'greater_than', label: 'is greater than' },
  { value: 'less_than', label: 'is less than' }
];

const ConditionalLogicEditor = ({ targetType, targetId, phaseId }) => {
  const phases = useTemplateBuilderStore(s => s.phases);
  const updatePhase = useTemplateBuilderStore(s => s.updatePhase);
  const updateQuestion = useTemplateBuilderStore(s => s.updateQuestion);

  // Gather all questions across all phases (for the "when" dropdown)
  const allQuestions = phases.flatMap(phase =>
    phase.questions.map(q => ({
      ...q,
      phaseTitle: phase.title,
      phaseId: phase.id
    }))
  );

  // Get the current conditions for this target
  const target = targetType === 'phase'
    ? phases.find(p => p.id === targetId)
    : phases.find(p => p.id === phaseId)?.questions.find(q => q.id === targetId);

  const conditions = target?.conditions || [];

  const updateConditions = (newConditions) => {
    if (targetType === 'phase') {
      updatePhase(targetId, { conditions: newConditions });
    } else {
      updateQuestion(phaseId, targetId, { conditions: newConditions });
    }
  };

  const addCondition = () => {
    updateConditions([
      ...conditions,
      { questionId: '', operator: 'equals', value: '' }
    ]);
  };

  const updateCondition = (index, field, value) => {
    const updated = [...conditions];
    updated[index] = { ...updated[index], [field]: value };
    updateConditions(updated);
  };

  const removeCondition = (index) => {
    updateConditions(conditions.filter((_, i) => i !== index));
  };

  if (conditions.length === 0) {
    return (
      <button
        onClick={addCondition}
        className="text-sm text-blue-500 hover:text-blue-700"
      >
        + Add condition (skip this {targetType} when...)
      </button>
    );
  }

  return (
    <div className="space-y-2 pl-4 border-l-2 border-yellow-300 bg-yellow-50 p-3 rounded">
      <p className="text-sm font-medium text-yellow-800">
        Skip this {targetType} when:
      </p>
      {conditions.map((condition, idx) => (
        <div key={idx} className="flex items-center gap-2 text-sm">
          <select
            value={condition.questionId}
            onChange={(e) => updateCondition(idx, 'questionId', e.target.value)}
            className="border rounded px-2 py-1"
          >
            <option value="">Select question...</option>
            {allQuestions.map(q => (
              <option key={q.id} value={q.id}>
                {q.phaseTitle} &gt; {q.prompt.slice(0, 40)}
              </option>
            ))}
          </select>

          <select
            value={condition.operator}
            onChange={(e) => updateCondition(idx, 'operator', e.target.value)}
            className="border rounded px-2 py-1"
          >
            {OPERATORS.map(op => (
              <option key={op.value} value={op.value}>{op.label}</option>
            ))}
          </select>

          {!['is_empty', 'is_not_empty'].includes(condition.operator) && (
            <input
              type="text"
              value={condition.value}
              onChange={(e) => updateCondition(idx, 'value', e.target.value)}
              placeholder="value"
              className="border rounded px-2 py-1 w-32"
            />
          )}

          <button
            onClick={() => removeCondition(idx)}
            className="text-red-400 hover:text-red-600"
            aria-label="Remove condition"
          >
            x
          </button>
        </div>
      ))}
      <button onClick={addCondition} className="text-sm text-blue-500">
        + Add another condition
      </button>
    </div>
  );
};

export default ConditionalLogicEditor;
```

### 5.4 Autosave Strategy

The template builder autosaves every 5 seconds when changes are pending. Saves are debounced and deduplicated.

```javascript
// client/src/hooks/useTemplateBuilder.js (autosave logic)
import { useEffect, useRef, useCallback } from 'react';
import useTemplateBuilderStore from '../components/lawyer/templateBuilder/templateBuilderStore';
import { lawyerApi } from '../services/lawyerApi';
import { useToast } from './useToast';

const AUTOSAVE_INTERVAL = 5000; // 5 seconds

export const useTemplateAutosave = () => {
  const isDirty = useTemplateBuilderStore(s => s.isDirty);
  const isSaving = useTemplateBuilderStore(s => s.isSaving);
  const templateId = useTemplateBuilderStore(s => s.templateId);
  const markSaving = useTemplateBuilderStore(s => s.markSaving);
  const markSaved = useTemplateBuilderStore(s => s.markSaved);
  const getTemplateConfig = useTemplateBuilderStore(s => s.getTemplateConfig);
  const toast = useToast();
  const timerRef = useRef(null);

  const save = useCallback(async () => {
    if (!templateId || isSaving) return;

    markSaving();
    try {
      const config = getTemplateConfig();
      const store = useTemplateBuilderStore.getState();
      await lawyerApi.updateTemplate(templateId, {
        title: store.title,
        description: store.description,
        jurisdiction: store.jurisdiction,
        matter_type: store.matterType,
        pricing: store.pricing,
        template_config: config
      });
      markSaved();
    } catch (err) {
      markSaved(); // Clear saving state even on failure
      toast.error('Failed to autosave template');
    }
  }, [templateId, isSaving, markSaving, markSaved, getTemplateConfig, toast]);

  // Autosave timer
  useEffect(() => {
    if (isDirty && templateId) {
      timerRef.current = setTimeout(save, AUTOSAVE_INTERVAL);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isDirty, templateId, save]);

  // Save on unmount if dirty
  useEffect(() => {
    return () => {
      if (useTemplateBuilderStore.getState().isDirty) {
        save();
      }
    };
  }, [save]);

  return { save, isSaving };
};
```

### 5.5 Real-Time Preview

As the lawyer builds the template, a side panel shows a live preview of how the client interview will look. This renders the same `ChatInterface` component (or a simplified version) in read-only mode with mock data.

```javascript
// client/src/components/lawyer/templateBuilder/TemplatePreview.js
import React, { useMemo } from 'react';
import useTemplateBuilderStore from './templateBuilderStore';
import { InterviewProvider, useInterview } from '../../../contexts/InterviewContext';

const TemplatePreview = () => {
  const phases = useTemplateBuilderStore(s => s.phases);
  const title = useTemplateBuilderStore(s => s.title);

  // Build a mock templateConfig from the current builder state
  const mockConfig = useMemo(() => ({
    phases,
    requiredFacts: [],
    optionalFacts: []
  }), [phases]);

  return (
    <div className="border rounded-lg bg-gray-50 p-4 overflow-y-auto max-h-[600px]">
      <div className="text-sm font-medium text-gray-500 mb-2">Client Preview</div>
      <h3 className="font-semibold mb-4">{title || 'Untitled Template'}</h3>

      <InterviewProvider>
        <PreviewRenderer config={mockConfig} />
      </InterviewProvider>
    </div>
  );
};

const PreviewRenderer = ({ config }) => {
  // The preview renders each phase's questions in sequence,
  // showing the input types and conditional indicators.
  // This is a static preview, not an interactive interview.
  return (
    <div className="space-y-6">
      {config.phases.map((phase, idx) => (
        <div key={phase.id} className="border-l-2 border-blue-300 pl-3">
          <div className="text-sm font-medium text-blue-700">
            Phase {idx + 1}: {phase.title}
          </div>
          {phase.description && (
            <p className="text-xs text-gray-500 mt-1">{phase.description}</p>
          )}
          {phase.conditions?.length > 0 && (
            <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">
              Conditional
            </span>
          )}
          <div className="mt-2 space-y-2">
            {phase.questions.map(q => (
              <div key={q.id} className="text-sm bg-white p-2 rounded border">
                <span className="font-medium">{q.prompt}</span>
                <span className="ml-2 text-xs text-gray-400">
                  [{q.inputType}]{q.required ? ' *' : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default TemplatePreview;
```

---

## 6. Dynamic Interview Engine (Client-Side)

### 6.1 Transformation of ChatInterface

The existing `ChatInterface` component currently hardcodes phase definitions (e.g., `TX_DIVORCE_PHASE_ORDER`). The marketplace version accepts a `templateConfig` prop that provides the phase definitions, question prompts, and conditional logic.

The transformation is backward-compatible: if no `templateConfig` is provided, the component falls back to the existing hardcoded behavior. This allows the marketplace interview and the existing free interview to coexist.

```javascript
// client/src/components/ChatInterface.js -- modified signature
const ChatInterface = ({ templateConfig = null }) => {
  // If templateConfig is provided, use dynamic interview engine.
  // If null, fall back to existing hardcoded phase behavior.
  const isDynamic = templateConfig !== null;

  // Dynamic interview state (from InterviewContext)
  const interview = isDynamic ? useInterview() : null;

  // Existing state (for legacy flow)
  const [currentPhase, setCurrentPhase] = useState(
    isDynamic ? null : 'INTAKE'
  );

  // Phase progression: dynamic vs legacy
  const advancePhase = () => {
    if (isDynamic) {
      interview.dispatch({ type: 'ADVANCE_PHASE' });
    } else {
      // Existing logic using TX_DIVORCE_PHASE_ORDER
      const idx = TX_DIVORCE_PHASE_ORDER.indexOf(currentPhase);
      if (idx < TX_DIVORCE_PHASE_ORDER.length - 1) {
        setCurrentPhase(TX_DIVORCE_PHASE_ORDER[idx + 1]);
      }
    }
  };

  // ... rest of component
};
```

### 6.2 Question Rendering by Input Type

Dynamic interviews render different input components based on the question's `inputType` field:

```javascript
// client/src/utils/interviewEngine.js
import React from 'react';

/**
 * Renders the appropriate input component for a question type.
 */
export const renderQuestionInput = (question, value, onChange) => {
  const { inputType, options, prompt, helpText, required } = question;

  const commonProps = {
    id: question.id,
    'aria-label': prompt,
    'aria-required': required,
    className: 'w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500'
  };

  switch (inputType) {
    case 'text':
      return (
        <input
          {...commonProps}
          type="text"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={helpText}
        />
      );

    case 'textarea':
      return (
        <textarea
          {...commonProps}
          rows={4}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={helpText}
        />
      );

    case 'select':
      return (
        <select
          {...commonProps}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">Select...</option>
          {(options || []).map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      );

    case 'multi_select':
      return (
        <div className="space-y-1">
          {(options || []).map(opt => (
            <label key={opt} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={(value || []).includes(opt)}
                onChange={(e) => {
                  const current = value || [];
                  if (e.target.checked) {
                    onChange([...current, opt]);
                  } else {
                    onChange(current.filter(v => v !== opt));
                  }
                }}
              />
              {opt}
            </label>
          ))}
        </div>
      );

    case 'date':
      return (
        <input
          {...commonProps}
          type="date"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case 'number':
      return (
        <input
          {...commonProps}
          type="number"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={helpText}
        />
      );

    case 'boolean':
      return (
        <div className="flex gap-4">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name={question.id}
              value="yes"
              checked={value === true || value === 'yes'}
              onChange={() => onChange(true)}
            />
            Yes
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name={question.id}
              value="no"
              checked={value === false || value === 'no'}
              onChange={() => onChange(false)}
            />
            No
          </label>
        </div>
      );

    case 'file_upload':
      return (
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
          <input
            type="file"
            id={question.id}
            className="hidden"
            onChange={(e) => onChange(e.target.files[0])}
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
          />
          <label
            htmlFor={question.id}
            className="cursor-pointer text-blue-500 hover:text-blue-700"
          >
            {value ? value.name : 'Click to upload a file'}
          </label>
        </div>
      );

    case 'jurisdiction':
      // Reuse existing CountyValidationInput pattern
      return (
        <input
          {...commonProps}
          type="text"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder="e.g., TX, CA, ON"
        />
      );

    default:
      return (
        <input
          {...commonProps}
          type="text"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
        />
      );
  }
};
```

### 6.3 AI Chat Integration for Dynamic Interviews

Each interview phase can optionally have an AI chat component. The lawyer defines custom prompts per phase in `aiPromptOverrides`. When the client enters a phase, the AI chat sends the phase context and the lawyer's custom prompt to the LLM.

```javascript
// In the chat message sent to /api/chat:
const chatPayload = {
  message: userMessage,
  conversationHistory: messages,
  affidavitData: currentDocument,
  // NEW: dynamic interview context
  interviewContext: templateConfig ? {
    templateId: currentDocument.templateId,
    currentPhase: interview.currentPhase,
    phasePrompt: templateConfig.aiPromptOverrides?.[interview.currentPhase?.id] || null,
    collectedAnswers: interview.answers,
    phaseQuestions: interview.currentPhase?.questions || []
  } : null
};
```

The backend uses `interviewContext.phasePrompt` (the lawyer's custom prompt for this phase) as additional system instructions when generating the AI response.

### 6.4 Progress Persistence and Resume

Interview progress is saved to the document's JSONB content on the server. The `interviewProgress` field tracks:

```javascript
// Saved to documents.content JSONB:
{
  ...existingDocumentFields,
  interviewProgress: {
    currentPhaseIndex: 3,
    currentQuestionIndex: 0,
    answers: { q_123: 'John', q_124: '2020-01-15', ... },
    completedPhases: ['phase_1', 'phase_2', 'phase_3'],
    skippedPhases: ['phase_2b'],
    history: [0, 1, 2],
    lastUpdated: '2026-03-26T10:30:00Z'
  }
}
```

On page load, `EditorView` checks for `interviewProgress` in the loaded document and passes it to the `InterviewContext` initializer:

```javascript
// In EditorView, after loading a document with a template:
useEffect(() => {
  if (currentDocument.templateId && currentDocument.interviewProgress) {
    interview.dispatch({
      type: 'INIT',
      payload: {
        templateConfig: loadedTemplateConfig,
        savedProgress: currentDocument.interviewProgress
      }
    });
  }
}, [currentDocument.templateId]);
```

---

## 7. Payment Integration Expansion

### 7.1 Current Payment Architecture

The existing `PaymentModal.js` uses Stripe Elements with a single `PaymentIntent` created by the server. The server controls pricing via `PRICING_CONFIG`. The client never sends an amount.

### 7.2 Marketplace Payment Flow (Stripe Connect Destination Charges)

For marketplace purchases, the payment goes to the platform and Stripe automatically splits the funds:

```
Client pays $1.00 (flat fee per document)
  -> Platform receives $1.00
  -> Platform pays out to lawyer: $0.70 (70% revenue share)
  -> Platform keeps: $0.30 (30% platform fee)
  -> Stripe processing fee: deducted from platform's share
```

The API endpoint changes from the current `/api/payment/create-intent` to a new `/api/marketplace/purchase`:

```javascript
// New purchase flow (client-side)
const initiatePurchase = async (templateId) => {
  // 1. Server creates PaymentIntent with destination charge
  const { clientSecret, purchaseId } = await apiClient('/api/marketplace/purchase', {
    method: 'POST',
    body: JSON.stringify({ templateId })
    // Server looks up template price, lawyer's stripe_account_id,
    // and creates: Stripe.paymentIntents.create({
    //   amount: templatePrice,
    //   currency: 'usd',
    //   transfer_data: { destination: lawyerStripeAccountId },
    //   application_fee_amount: platformFee,
    //   metadata: { templateId, purchaseId, buyerUserId }
    // })
  });

  // 2. Client confirms payment with Stripe Elements (same as existing)
  setPurchaseState({
    step: 'payment',
    clientSecret,
    purchaseId,
    templateId
  });
};
```

### 7.3 PaymentModal Modifications

The existing `PaymentModal` is modified to accept either the legacy pricing mode or marketplace mode:

```javascript
// PaymentModal.js -- new props for marketplace mode
const PaymentModal = ({
  isOpen,
  onClose,
  onSuccess,
  documentId,
  documentType,
  // NEW: marketplace purchase props
  mode = 'legacy',           // 'legacy' | 'marketplace'
  templateTitle = null,      // Template name for marketplace display
  templatePrice = null,      // Price in cents (server-authoritative, display only)
  lawyerName = null,         // Selling lawyer name
  clientSecret = null        // Pre-created PaymentIntent secret (marketplace mode)
}) => {
  // In marketplace mode, the PaymentIntent is already created by the purchase
  // endpoint. We skip the creation step and go straight to Stripe Elements.
  // In legacy mode, the existing flow creates the PaymentIntent on mount.
  // ...
};
```

### 7.4 Lawyer Subscription Management

Lawyer tier subscriptions (Free, Professional, Premium) use Stripe Billing:

```javascript
// client/src/hooks/useStripeConnect.js
import { useCallback, useState } from 'react';
import { apiClient } from '../services/apiClient';

export const useStripeConnect = () => {
  const [isLoading, setIsLoading] = useState(false);

  // Stripe Connect onboarding: redirect to Stripe-hosted onboarding
  const startOnboarding = useCallback(async () => {
    setIsLoading(true);
    try {
      const { url } = await apiClient('/api/lawyer/stripe/onboarding', {
        method: 'POST'
      });
      // Redirect to Stripe-hosted onboarding page
      window.location.href = url;
    } catch (err) {
      setIsLoading(false);
      throw err;
    }
  }, []);

  // Check Stripe Connect account status
  const getAccountStatus = useCallback(async () => {
    return apiClient('/api/lawyer/stripe/status');
  }, []);

  // Open Stripe Express dashboard for payout management
  const openDashboard = useCallback(async () => {
    const { url } = await apiClient('/api/lawyer/stripe/dashboard-link', {
      method: 'POST'
    });
    window.open(url, '_blank');
  }, []);

  // Manage subscription tier
  const manageSubscription = useCallback(async () => {
    const { url } = await apiClient('/api/lawyer/stripe/billing-portal', {
      method: 'POST'
    });
    window.location.href = url;
  }, []);

  return {
    isLoading,
    startOnboarding,
    getAccountStatus,
    openDashboard,
    manageSubscription
  };
};
```

---

## 8. Real-Time Features

### 8.1 Technology Choice: Server-Sent Events (SSE)

SSE is chosen over WebSocket and polling for these reasons:

| Approach | Pros | Cons |
|----------|------|------|
| **SSE (chosen)** | Built-in browser API, auto-reconnect, works through HTTP/2 proxies, one-way (server to client) which is all we need | One-directional only; IE11 unsupported (acceptable) |
| WebSocket | Bidirectional | Overkill (we only need server-to-client push), requires sticky sessions on Render, more complex server infrastructure |
| Polling | Simplest | Wastes bandwidth, 15-60s latency, hammers the server |

Real-time features are one-way (server pushes to client): revenue notifications, view count updates, achievement unlocks, template status changes. The client never needs to push real-time data to the server (API calls handle that).

### 8.2 SSE Client Implementation

```javascript
// client/src/services/realtimeService.js

const API_BASE = process.env.REACT_APP_API_URL !== undefined
  ? process.env.REACT_APP_API_URL
  : 'http://localhost:3001';

let eventSource = null;
let reconnectTimer = null;
const MAX_RECONNECT_DELAY = 30000; // 30 seconds
let reconnectDelay = 1000;

/**
 * Subscribe to server-sent events for the authenticated user.
 * Returns the EventSource instance for adding event listeners.
 */
export const realtimeService = {
  subscribe: (channel, getToken) => {
    if (eventSource) {
      eventSource.close();
    }

    // SSE does not support custom headers, so we pass the token as a query param.
    // The server validates this token the same way it validates Bearer tokens.
    // The token is short-lived and transmitted over HTTPS.
    const connect = async () => {
      try {
        const token = await getToken();
        const url = `${API_BASE}/api/events/${channel}?token=${encodeURIComponent(token)}`;

        eventSource = new EventSource(url);

        eventSource.onopen = () => {
          reconnectDelay = 1000; // Reset backoff on successful connect
        };

        eventSource.onerror = () => {
          eventSource.close();
          // Exponential backoff reconnect
          reconnectTimer = setTimeout(() => {
            reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY);
            connect();
          }, reconnectDelay);
        };

        return eventSource;
      } catch (err) {
        console.error('SSE connection failed:', err);
        return null;
      }
    };

    return connect();
  },

  disconnect: () => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
  }
};
```

### 8.3 SSE Event Types

| Event Name | Payload | Where Used |
|------------|---------|------------|
| `purchase` | `{ templateId, templateTitle, amount, buyerAnonymized }` | Lawyer dashboard activity feed |
| `view-count` | `{ templateId, views }` | Lawyer template list, analytics |
| `review` | `{ templateId, rating, excerpt }` | Lawyer dashboard activity feed |
| `template-status` | `{ templateId, status, reason }` | Lawyer template list (review -> approved) |
| `achievement` | `{ id, title, description, points }` | Gamification toast (Phase 4) |
| `leaderboard-update` | `{ position, previousPosition }` | Gamification panel (Phase 4) |
| `payout` | `{ amount, status, estimatedArrival }` | Lawyer earnings panel |

### 8.4 Fallback Strategy

If SSE is not available (corporate proxy blocks, old browser), the lawyer dashboard falls back to polling every 60 seconds. The hook detects SSE failure:

```javascript
// In useLawyerDashboard.js
const [usePolling, setUsePolling] = useState(false);

useEffect(() => {
  const es = realtimeService.subscribe('lawyer-events', getAccessTokenSilently);

  if (!es) {
    setUsePolling(true);
    return;
  }

  // If SSE fails to connect within 10 seconds, fall back to polling
  const timeout = setTimeout(() => {
    if (es.readyState !== EventSource.OPEN) {
      es.close();
      setUsePolling(true);
    }
  }, 10000);

  return () => {
    clearTimeout(timeout);
    realtimeService.disconnect();
  };
}, []);

// Polling fallback
useEffect(() => {
  if (!usePolling) return;

  const interval = setInterval(async () => {
    try {
      const data = await lawyerApi.getDashboard();
      setDashboardData(data);
    } catch (_) { /* silent */ }
  }, 60000);

  return () => clearInterval(interval);
}, [usePolling]);
```

---

## 9. Testing Strategy

### 9.1 Test Pyramid

```
        /--------\
       / E2E (5%) \         Playwright: critical user journeys
      /-----------\
     / Integration \         React Testing Library: multi-component flows
    / (25%)         \
   /-----------------\
  / Unit (70%)        \      Jest + RTL: individual components, hooks, utils
 /---------------------\
```

### 9.2 Unit Tests (React Testing Library)

Every new component and hook gets a unit test file in a `__tests__` directory colocated with the source.

```
components/
  shared/
    RoleGuard.js
    __tests__/
      RoleGuard.test.js
  marketplace/
    TemplateCard.js
    __tests__/
      TemplateCard.test.js
```

Example: testing `RoleGuard`:

```javascript
// components/shared/__tests__/RoleGuard.test.js
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import RoleGuard from '../RoleGuard';

// Mock the contexts
jest.mock('@auth0/auth0-react', () => ({
  useAuth0: () => ({
    isAuthenticated: true,
    isLoading: false,
    loginWithRedirect: jest.fn()
  })
}));

const mockRoleContext = { roles: ['client'], isLoading: false };
jest.mock('../../../contexts/RoleContext', () => ({
  useRole: () => mockRoleContext
}));

describe('RoleGuard', () => {
  it('renders children when user has required role', () => {
    render(
      <MemoryRouter>
        <RoleGuard requiredRole="client">
          <div>Protected Content</div>
        </RoleGuard>
      </MemoryRouter>
    );
    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('redirects when user lacks required role', () => {
    render(
      <MemoryRouter initialEntries={['/lawyer/dashboard']}>
        <RoleGuard requiredRole="lawyer">
          <div>Lawyer Content</div>
        </RoleGuard>
      </MemoryRouter>
    );
    expect(screen.queryByText('Lawyer Content')).not.toBeInTheDocument();
  });
});
```

### 9.3 Integration Tests

Integration tests verify multi-component flows:

```javascript
// __tests__/integration/purchaseFlow.test.js
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { setupServer } from 'msw/node';
import { rest } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import TemplateDetail from '../../components/marketplace/TemplateDetail';
import PurchaseFlow from '../../components/client/PurchaseFlow';

const server = setupServer(
  rest.get('/api/marketplace/templates/:id', (req, res, ctx) =>
    res(ctx.json({
      success: true,
      template: {
        id: 'tmpl_1',
        title: 'Texas Divorce Template',
        price: 100,
        lawyer: { displayName: 'Jane Smith, Esq.' },
        jurisdiction: 'TX',
        matterType: 'divorce',
        rating: 4.5,
        purchaseCount: 42
      }
    }))
  ),
  rest.post('/api/marketplace/purchase', (req, res, ctx) =>
    res(ctx.json({
      success: true,
      clientSecret: 'pi_test_secret',
      purchaseId: 'pur_1'
    }))
  )
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('Purchase Flow Integration', () => {
  it('loads template detail and initiates purchase', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/marketplace/tmpl_1']}>
        <Routes>
          <Route path="/marketplace/:templateId" element={<TemplateDetail />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Texas Divorce Template')).toBeInTheDocument();
    });

    expect(screen.getByText('Jane Smith, Esq.')).toBeInTheDocument();
    expect(screen.getByText('$1.00')).toBeInTheDocument();

    const purchaseButton = screen.getByRole('button', { name: /get this template/i });
    await user.click(purchaseButton);

    await waitFor(() => {
      expect(screen.getByText(/confirm purchase/i)).toBeInTheDocument();
    });
  });
});
```

### 9.4 End-to-End Tests (Playwright)

Critical user journeys tested end-to-end:

```javascript
// e2e/lawyer-template-lifecycle.spec.js
import { test, expect } from '@playwright/test';

test.describe('Lawyer Template Lifecycle', () => {
  test.beforeEach(async ({ page }) => {
    // Login as lawyer (uses Auth0 test credentials)
    await page.goto('/');
    // Auth0 login flow...
  });

  test('create template, publish, verify on marketplace', async ({ page }) => {
    // Navigate to template builder
    await page.goto('/lawyer/templates/new');
    await expect(page.getByText('Create New Template')).toBeVisible();

    // Fill metadata
    await page.fill('[data-testid="template-title"]', 'E2E Test Divorce Template');
    await page.selectOption('[data-testid="jurisdiction-select"]', 'TX');
    await page.selectOption('[data-testid="matter-type-select"]', 'divorce');

    // Add a phase
    await page.click('text=+ Add Phase');
    await page.fill('[data-testid="phase-title-0"]', 'Personal Information');

    // Add a question
    await page.click('text=+ Add Question');
    await page.fill('[data-testid="question-prompt-0-0"]', 'What is your full legal name?');

    // Wait for autosave
    await expect(page.getByText('Saved')).toBeVisible({ timeout: 10000 });

    // Publish
    await page.click('[data-testid="publish-button"]');
    await page.fill('[data-testid="price-input"]', '1.00');
    await page.click('text=Publish Template');
    await expect(page.getByText('Published')).toBeVisible();

    // Verify on marketplace
    await page.goto('/marketplace/search?q=E2E+Test+Divorce');
    await expect(page.getByText('E2E Test Divorce Template')).toBeVisible();
  });
});
```

### 9.5 Mock Strategy (MSW)

Mock Service Worker intercepts API calls at the network level, allowing tests to run without a backend:

```javascript
// client/src/mocks/handlers.js
import { rest } from 'msw';

export const handlers = [
  // Marketplace
  rest.get('/api/marketplace/templates', (req, res, ctx) => {
    const q = req.url.searchParams.get('q');
    return res(ctx.json({
      success: true,
      templates: mockTemplates.filter(t =>
        !q || t.title.toLowerCase().includes(q.toLowerCase())
      ),
      totalCount: mockTemplates.length
    }));
  }),

  // Lawyer API
  rest.get('/api/lawyer/dashboard', (req, res, ctx) =>
    res(ctx.json({ success: true, ...mockDashboardData }))
  ),

  // Template CRUD
  rest.post('/api/lawyer/templates', async (req, res, ctx) => {
    const body = await req.json();
    return res(ctx.json({
      success: true,
      template: { id: 'tmpl_new', ...body, status: 'draft' }
    }));
  })
];
```

### 9.6 Coverage Targets

| Area | Target | Enforcement |
|------|--------|-------------|
| New shared components | 90% line coverage | CI gate |
| New hooks | 85% line coverage | CI gate |
| New services (API clients) | 80% line coverage | CI gate |
| Template builder store | 90% branch coverage | CI gate |
| Interview state machine | 95% branch coverage | CI gate (critical logic) |
| Existing components (modified) | No regression | CI gate |
| E2E critical paths | 100% of defined paths pass | CI gate |

---

## 10. Performance Optimization

### 10.1 Code Splitting Boundaries

| Split Point | Trigger | Estimated Savings |
|-------------|---------|-------------------|
| `/marketplace` route | Route navigation | ~80 KB not loaded on `/lawyer/*` |
| `/lawyer` route | Route navigation | ~100 KB not loaded on `/marketplace` |
| Template builder within `/lawyer` | Nested lazy | ~90 KB not loaded on dashboard |
| Admin portal | Route navigation | ~40 KB not loaded for non-admins |
| Recharts | Import in lawyer analytics | ~50 KB not loaded outside analytics |

### 10.2 Image Optimization

Lawyer logos and template thumbnails use responsive images:

```javascript
// Pattern for lawyer logo display
const LawyerLogo = ({ logoUrl, firmName, size = 'md' }) => {
  const sizes = { sm: 32, md: 48, lg: 80 };
  const px = sizes[size];

  if (!logoUrl) {
    // Fallback: initials avatar (no network request)
    const initials = firmName?.split(' ').map(w => w[0]).join('').slice(0, 2) || '?';
    return (
      <div
        className="rounded-full bg-blue-100 text-blue-700 flex items-center
                   justify-center font-semibold"
        style={{ width: px, height: px, fontSize: px * 0.4 }}
      >
        {initials}
      </div>
    );
  }

  return (
    <img
      src={`${logoUrl}?w=${px * 2}&h=${px * 2}&fit=crop&auto=format`}
      alt={`${firmName} logo`}
      width={px}
      height={px}
      loading="lazy"
      decoding="async"
      className="rounded-full object-cover"
    />
  );
};
```

### 10.3 Virtual Scrolling

Long template lists in the marketplace use the IntersectionObserver-based infinite scroll (section 4.3) rather than rendering all items at once. For the lawyer's template management list (typically < 100 items), standard rendering is sufficient.

If the marketplace grows beyond 10,000 visible items in a single page (unlikely with pagination), consider adding `react-window` for windowed rendering.

### 10.4 Debounced Search with Request Cancellation

The `useMarketplace` hook (section 3.2) already implements this. Key details:

1. Search input is debounced 300ms (URL update is immediate, fetch is debounced).
2. Each fetch creates a new `AbortController`.
3. Previous in-flight request is aborted before starting a new one.
4. AbortError is silently caught (not shown to user).

### 10.5 Memoization Patterns

```javascript
// Expensive computation: filter and sort templates
const sortedTemplates = useMemo(() => {
  return templates
    .filter(t => t.status === 'published')
    .sort((a, b) => {
      switch (sortBy) {
        case 'price_asc': return a.price - b.price;
        case 'price_desc': return b.price - a.price;
        case 'rating': return b.avgRating - a.avgRating;
        case 'newest': return new Date(b.createdAt) - new Date(a.createdAt);
        default: return 0; // relevance (server-sorted)
      }
    });
}, [templates, sortBy]);

// Callback memoization for child components
const handlePhaseUpdate = useCallback((phaseId, updates) => {
  templateStore.updatePhase(phaseId, updates);
}, []);
```

### 10.6 Bundle Analysis

The CRACO config supports `ANALYZE=true` to generate a webpack bundle report. Run it as part of the CI pipeline on PRs that add new dependencies:

```bash
ANALYZE=true npm run build --prefix client
# Outputs client/bundle-report.html
```

---

## 11. Accessibility

### 11.1 WCAG 2.1 AA Compliance Plan

All new marketplace components must meet WCAG 2.1 AA. Key requirements:

| Criterion | Implementation |
|-----------|---------------|
| 1.1.1 Non-text content | Alt text on all images (lawyer logos, template thumbnails) |
| 1.3.1 Info and relationships | Semantic HTML (headings, lists, landmarks) |
| 1.4.3 Contrast minimum | 4.5:1 for text, 3:1 for large text. Verified with Tailwind's built-in accessible colors |
| 2.1.1 Keyboard accessible | All interactive elements reachable via Tab, activated via Enter/Space |
| 2.4.3 Focus order | Logical tab order matches visual order |
| 2.4.7 Focus visible | Focus rings on all interactive elements (Tailwind `focus:ring-2`) |
| 4.1.2 Name, Role, Value | ARIA labels on all custom widgets |

### 11.2 Keyboard Navigation for Template Builder

The drag-and-drop phase/question editor must be keyboard-accessible:

```javascript
// @dnd-kit already supports keyboard interaction via KeyboardSensor
import { KeyboardSensor, useSensor, useSensors } from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';

const sensors = useSensors(
  useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  useSensor(KeyboardSensor, {
    coordinateGetter: sortableKeyboardCoordinates
  })
);

// Each sortable item needs an aria-label:
// "Phase 3: Children. Press Space to pick up, arrow keys to move, Space to drop."
```

Additionally, every phase and question has keyboard-accessible move-up/move-down buttons as a non-drag alternative.

### 11.3 Screen Reader Support for Interview Flow

The dynamic interview announces phase transitions and question prompts to screen readers:

```javascript
// Announce phase change to screen readers
const PhaseAnnouncer = ({ currentPhase, progressPercent }) => (
  <div aria-live="polite" aria-atomic="true" className="sr-only">
    {currentPhase
      ? `Now on phase: ${currentPhase.title}. ${progressPercent}% complete.`
      : 'Interview complete.'
    }
  </div>
);
```

### 11.4 Focus Management in Multi-Step Flows

When advancing between interview phases, focus moves to the first interactive element of the new phase:

```javascript
const phaseRef = useRef(null);

useEffect(() => {
  if (phaseRef.current) {
    // Focus the first input in the new phase
    const firstInput = phaseRef.current.querySelector(
      'input, select, textarea, button'
    );
    if (firstInput) {
      firstInput.focus();
    }
  }
}, [currentPhaseIndex]);
```

---

## 12. Error Handling Patterns

### 12.1 Error Boundary Hierarchy

```
ErrorBoundary (App-level -- existing, catches catastrophic failures)
  LawyerPortalView
    ErrorBoundary (Portal-level -- catches errors within lawyer portal)
      TemplateBuilder
        ErrorBoundary (Feature-level -- catches template builder errors)
          PhaseEditor (component -- uses try/catch in event handlers)
```

Each level provides progressively more specific recovery options:

- **App-level**: "Something went wrong. Refresh the page." (existing behavior)
- **Portal-level**: "Error in lawyer portal. Return to dashboard." (preserves other portal state)
- **Feature-level**: "Error in template builder. Your changes were autosaved. Reload builder." (preserves dashboard state)

### 12.2 Toast Notification System

```javascript
// client/src/contexts/ToastContext.js
import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

const ToastContext = createContext();

let toastId = 0;

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef({});

  const addToast = useCallback((message, type = 'info', duration = 5000) => {
    const id = ++toastId;
    setToasts(prev => [...prev, { id, message, type }]);

    if (duration > 0) {
      timersRef.current[id] = setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
        delete timersRef.current[id];
      }, duration);
    }

    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
    if (timersRef.current[id]) {
      clearTimeout(timersRef.current[id]);
      delete timersRef.current[id];
    }
  }, []);

  const toast = {
    info: (msg, dur) => addToast(msg, 'info', dur),
    success: (msg, dur) => addToast(msg, 'success', dur),
    warning: (msg, dur) => addToast(msg, 'warning', dur),
    error: (msg, dur) => addToast(msg, 'error', dur ?? 8000)
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {/* Toast container rendered at the bottom-right */}
      <div
        className="fixed bottom-4 right-4 z-50 space-y-2"
        aria-live="polite"
      >
        {toasts.map(t => (
          <div
            key={t.id}
            role="alert"
            className={`px-4 py-3 rounded-lg shadow-lg text-sm font-medium
              ${t.type === 'error' ? 'bg-red-600 text-white' : ''}
              ${t.type === 'warning' ? 'bg-yellow-500 text-white' : ''}
              ${t.type === 'success' ? 'bg-green-600 text-white' : ''}
              ${t.type === 'info' ? 'bg-blue-600 text-white' : ''}
            `}
          >
            <div className="flex items-center justify-between gap-3">
              <span>{t.message}</span>
              <button
                onClick={() => removeToast(t.id)}
                className="text-white/80 hover:text-white"
                aria-label="Dismiss"
              >
                x
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => useContext(ToastContext);
```

### 12.3 Form Validation with Zod

Client-side validation schemas mirror the backend validation:

```javascript
// client/src/utils/templateValidator.js
import { z } from 'zod';

export const questionSchema = z.object({
  id: z.string(),
  prompt: z.string().min(5, 'Question prompt must be at least 5 characters'),
  inputType: z.enum([
    'text', 'textarea', 'select', 'multi_select',
    'date', 'number', 'boolean', 'file_upload',
    'jurisdiction', 'county'
  ]),
  options: z.array(z.string()).nullable().refine(
    (val, ctx) => {
      // Options required for select and multi_select
      if (['select', 'multi_select'].includes(ctx.parent?.inputType)) {
        return val && val.length >= 2;
      }
      return true;
    },
    { message: 'Select questions need at least 2 options' }
  ),
  required: z.boolean(),
  factFieldKey: z.string().min(1, 'Fact field key is required')
});

export const phaseSchema = z.object({
  id: z.string(),
  title: z.string().min(2, 'Phase title must be at least 2 characters'),
  questions: z.array(questionSchema).min(1, 'Each phase needs at least one question')
});

export const templateConfigSchema = z.object({
  phases: z.array(phaseSchema).min(1, 'Template needs at least one interview phase')
});

export const templateMetadataSchema = z.object({
  title: z.string().min(5).max(200),
  description: z.string().min(20).max(2000),
  jurisdiction: z.string().min(2),
  matterType: z.string().min(2),
  pricing: z.object({
    amount: z.number().min(0).max(100000),
    currency: z.enum(['usd', 'cad', 'gbp', 'aud', 'eur', 'nzd'])
  })
});

/**
 * Validate the full template before publishing.
 * Returns { success: true } or { success: false, errors: [...] }
 */
export const validateTemplateForPublish = (template) => {
  const metaResult = templateMetadataSchema.safeParse(template);
  const configResult = templateConfigSchema.safeParse(template.template_config);

  const errors = [];
  if (!metaResult.success) {
    errors.push(...metaResult.error.issues.map(i => i.message));
  }
  if (!configResult.success) {
    errors.push(...configResult.error.issues.map(i => i.message));
  }

  return errors.length === 0
    ? { success: true }
    : { success: false, errors };
};
```

### 12.4 Network Error Recovery

Components that display data from the server include a retry mechanism:

```javascript
// Pattern: error state with retry button
const TemplateList = () => {
  const { data, isLoading, error, refetch } = useLawyerTemplates();

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 mb-4">Failed to load templates: {error}</p>
        <button
          onClick={refetch}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Try Again
        </button>
      </div>
    );
  }

  // ... render templates
};
```

### 12.5 Graceful Degradation

When optional integrations are unavailable, the UI degrades gracefully:

```javascript
// Clio integration: show status indicator, not a blocker
const ClioStatus = () => {
  const { isConnected, error } = useClio();

  if (error) {
    return (
      <div className="text-sm text-yellow-600 bg-yellow-50 px-3 py-2 rounded">
        Clio integration unavailable. Documents will not sync automatically.
        <button onClick={reconnect} className="underline ml-1">Reconnect</button>
      </div>
    );
  }

  if (!isConnected) {
    return null; // Don't show anything if not configured
  }

  return (
    <div className="text-sm text-green-600 bg-green-50 px-3 py-2 rounded">
      Connected to Clio. Documents sync automatically.
    </div>
  );
};
```

---

## 13. Analytics and Tracking

### 13.1 Event Taxonomy

Marketplace events extend the existing `trackEvent` utility in `analytics.js`:

```javascript
// client/src/utils/analytics.js -- new marketplace events

// Marketplace browse
trackEvent('marketplace_view', { source: 'homepage' | 'search' | 'category' });
trackEvent('marketplace_search', { query, jurisdiction, matterType, resultCount });
trackEvent('template_view', { templateId, lawyerId, matterType, jurisdiction });
trackEvent('template_detail_view', { templateId, source: 'card' | 'search' | 'direct' });
trackEvent('lawyer_profile_view', { lawyerId, source });

// Purchase funnel
trackEvent('purchase_initiated', { templateId, price });
trackEvent('purchase_payment_started', { templateId, price });
trackEvent('purchase_completed', { templateId, price, documentId });
trackEvent('purchase_failed', { templateId, error });

// Interview
trackEvent('interview_started', { templateId, documentId });
trackEvent('interview_phase_completed', { templateId, documentId, phaseId, phaseName });
trackEvent('interview_completed', { templateId, documentId, durationMinutes });
trackEvent('interview_abandoned', { templateId, documentId, lastPhaseId });

// Lawyer portal
trackEvent('template_created', { templateId, matterType, jurisdiction, method: 'upload' | 'nl' | 'scratch' });
trackEvent('template_published', { templateId, price });
trackEvent('template_archived', { templateId });
trackEvent('lawyer_onboarding_started', {});
trackEvent('lawyer_onboarding_completed', { stripeConnected: true });

// Reviews
trackEvent('review_submitted', { templateId, rating });
```

### 13.2 Conversion Funnel Tracking

The purchase funnel tracks drop-off at each step:

```
marketplace_view -> template_detail_view -> purchase_initiated -> purchase_payment_started -> purchase_completed
```

Each event includes the `templateId` so funnels can be filtered by template, jurisdiction, or matter type in Google Analytics.

### 13.3 A/B Testing Framework

A lightweight feature flag system supports A/B testing:

```javascript
// client/src/utils/featureFlags.js

// Feature flags are loaded from the server at boot (or from environment variables).
// This is a thin wrapper, not a full Optimizely/LaunchDarkly integration.
const flags = {};

export const initFeatureFlags = async () => {
  try {
    const response = await fetch('/api/feature-flags');
    const data = await response.json();
    Object.assign(flags, data.flags || {});
  } catch (_) {
    // Fallback: all flags off
  }
};

/**
 * Check if a feature flag is enabled.
 * @param {string} flag - Flag name (e.g., 'marketplace_v2_search')
 * @param {boolean} [defaultValue=false]
 */
export const isEnabled = (flag, defaultValue = false) => {
  return flags[flag] ?? defaultValue;
};

/**
 * Get A/B test variant for the current user.
 * @param {string} experiment - Experiment name
 * @returns {'control' | 'variant_a' | 'variant_b'}
 */
export const getVariant = (experiment) => {
  return flags[`experiment_${experiment}`] || 'control';
};
```

### 13.4 Privacy Considerations

- All analytics are sent through Google Analytics (existing setup). No additional third-party trackers.
- The `trackEvent` utility checks `isDevelopment()` and suppresses events in dev mode (existing behavior).
- User IDs are not sent to GA. Events are anonymous.
- The existing cookie consent mechanism (via GA's consent mode) is used for marketplace events as well.
- GDPR: No PII in event payloads. Template IDs and document IDs are opaque UUIDs.
- CCPA: The existing privacy policy page covers analytics data collection.

---

## 14. Migration Strategy

### 14.1 Phase 1: Foundation (Weeks 1-3)

**Goal**: Role-based routing + marketplace browse (read-only). No purchasing, no lawyer portal.

**Changes**:
- Add `RoleContext`, `RoleProvider`, `RoleGuard` to the provider hierarchy.
- Modify `App.js` to add lazy-loaded route boundaries for `/marketplace`.
- Build `MarketplaceBrowse`, `MarketplaceSearch`, `TemplateDetail`, `TemplateCard` (read-only, backed by seed data from existing 110 jurisdiction templates).
- Build `PortalHeader` with role-aware navigation.
- Build `apiClient.js` centralized API client.
- Redirect `/` to `/marketplace` for unauthenticated users.
- Redirect `/dashboard` to `/my/dashboard` for authenticated users (backward compat).
- Deploy with the existing `/dashboard` still working for logged-in users.

**Feature flag**: `ENABLE_MARKETPLACE_BROWSE=true` (frontend env var). If false, `/marketplace` redirects to `/dashboard`.

**Risk mitigation**: Existing users continue to use `/dashboard` unchanged. The marketplace browse is additive.

### 14.2 Phase 2: Lawyer Portal + Template Builder (Weeks 4-8)

**Goal**: Lawyers can sign up, build templates, and publish listings.

**Changes**:
- Add `TemplateContext`, `useTemplateBuilder`, `useStripeConnect` hooks.
- Build template builder components (all files under `components/lawyer/templateBuilder/`).
- Build `LawyerDashboard`, `LawyerOnboarding`, `LawyerSettings`.
- Build `TemplateList`, `TemplateAnalytics`.
- Add Stripe Connect onboarding flow.
- Implement template autosave.
- Add `/lawyer/*` route group.

**Feature flag**: `ENABLE_LAWYER_PORTAL=true`. If false, `/lawyer/*` routes return 404.

**Incremental deploy**: Lawyer portal is entirely behind the `/lawyer/*` prefix. No impact on existing client experience.

### 14.3 Phase 3: Client Purchase Flow + Dynamic Interview (Weeks 9-14)

**Goal**: Clients can purchase templates and complete dynamic interviews.

**Changes**:
- Build `PurchaseFlow`, `ClientDashboard`, `ClientDocumentList`, `ClientDocumentDetail`, `PurchaseHistory`.
- Modify `PaymentModal` for marketplace mode (destination charges).
- Build `InterviewContext` and `useDynamicInterview`.
- Modify `ChatInterface` to accept `templateConfig` prop.
- Build question rendering engine (`interviewEngine.js`).
- Build review system (`ReviewList`, `ReviewForm`).
- Implement SSE for lawyer notifications.
- Add `/my/*` route group.

**Feature flag**: `ENABLE_MARKETPLACE_PURCHASES=true`. If false, template detail pages show "Coming Soon" instead of a purchase button.

**Backward compatibility**: Existing free interview flow (hardcoded phases) continues to work. The dynamic interview is only triggered when a `templateId` is present on the document.

### 14.4 Phase 4: Gamification, Affiliates, Clio (Weeks 15-20)

**Goal**: Engagement features and integrations.

**Changes**:
- Build gamification components (`AchievementBadge`, `Leaderboard`, `ProgressBar`).
- Build `GamificationContext`, `useGamification`.
- Build affiliate link management UI.
- Build Clio integration status UI.
- Build admin portal (moderation, payouts, user management).
- Add SSE events for achievements and leaderboard updates.

**Feature flags**: Individual flags for each feature (`ENABLE_GAMIFICATION`, `ENABLE_AFFILIATES`, `ENABLE_CLIO`).

### 14.5 Feature Flag Implementation

Feature flags are environment variables baked into the build (like existing `REACT_APP_*` vars):

```javascript
// client/src/utils/featureFlags.js (build-time flags)
export const FEATURES = {
  MARKETPLACE_BROWSE: process.env.REACT_APP_ENABLE_MARKETPLACE_BROWSE === 'true',
  LAWYER_PORTAL: process.env.REACT_APP_ENABLE_LAWYER_PORTAL === 'true',
  MARKETPLACE_PURCHASES: process.env.REACT_APP_ENABLE_MARKETPLACE_PURCHASES === 'true',
  GAMIFICATION: process.env.REACT_APP_ENABLE_GAMIFICATION === 'true',
  AFFILIATES: process.env.REACT_APP_ENABLE_AFFILIATES === 'true',
  CLIO: process.env.REACT_APP_ENABLE_CLIO === 'true'
};
```

Usage in routes:

```javascript
{FEATURES.LAWYER_PORTAL && (
  <Route path="/lawyer" element={...}>
    {/* lawyer routes */}
  </Route>
)}
```

This ensures unreleased features are completely tree-shaken from the production bundle when disabled.

### 14.6 Protecting Existing Users

Throughout all phases:

1. The existing `/dashboard` URL redirects to `/my/dashboard` (same component, new path).
2. The existing editor flow (`/editor/new`, `/editor/:id`) continues to work unchanged for non-marketplace documents.
3. The existing `DocumentContext` state shape gains new optional fields (`templateId`, `purchaseId`) but all existing fields remain unchanged.
4. The existing `authService.js` continues to work; `apiClient.js` is additive, not a replacement of the existing `authFetch` in `DocumentContext`.
5. No existing API endpoints are modified. Marketplace endpoints are all under new `/api/marketplace/*` and `/api/lawyer/*` prefixes.
