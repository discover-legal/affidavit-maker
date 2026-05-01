// client/src/App.js - COMPLETE INTEGRATION
import React, { useEffect } from 'react';
import { Auth0Provider, useAuth0 } from '@auth0/auth0-react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { DocumentProvider } from './contexts/DocumentContext';
import { TOSProvider } from './contexts/TOSContext';
import UserDashboard from './components/UserDashboard';
import EditorView from './views/EditorView';
import ErrorBoundary from './components/ErrorBoundary';
import TOSGuard from './components/TOSGuard';
import LandingPage from './components/LandingPage';
import PrivacyPolicyPage from './components/PrivacyPolicyPage';
import TermsOfServicePage from './components/TermsOfServicePage';
import ResourcesPage from './components/ResourcesPage';
import ArticlePage from './components/ArticlePage';
import BrandAssetsPage from './components/BrandAssetsPage';
import { trackPageView } from './utils/analytics';

const AUTH0_CONFIG = {
  domain: process.env.REACT_APP_AUTH0_DOMAIN,
  clientId: process.env.REACT_APP_AUTH0_CLIENT_ID,
  authorizationParams: {
    redirect_uri: window.location.origin,
    audience: process.env.REACT_APP_AUTH0_AUDIENCE,
    scope: "openid profile email"
  },
  cacheLocation: 'localstorage',
  useRefreshTokens: true,
  useRefreshTokensFallback: true,
  useCookiesForTransactions: true,
  authorizeTimeoutInSeconds: 10,
};

// Lives inside Router so onRedirectCallback can use useNavigate — using
// window.history.replaceState here causes the router to miss the route change.
const Auth0ProviderWithNavigate = ({ children }) => {
  const navigate = useNavigate();

  const onRedirectCallback = (appState) => {
    navigate(appState?.returnTo || '/dashboard', { replace: true });
  };

  return (
    <Auth0Provider {...AUTH0_CONFIG} onRedirectCallback={onRedirectCallback}>
      {children}
    </Auth0Provider>
  );
};

// Google Analytics page tracking component
const AnalyticsTracker = () => {
  const location = useLocation();

  useEffect(() => {
    // Track page view whenever the route changes
    trackPageView(location.pathname + location.search);
  }, [location]);

  return null;
};

// Handles `/callback` — waits for Auth0 to finish processing the callback
// (code/state query params) before redirecting authenticated users on to
// /dashboard. Without this, <Navigate> fires before Auth0Provider reads
// the params, stripping them from the URL and causing an infinite login
// loop. Unauthenticated visitors fall through to the landing page.
const AuthCallbackHandler = () => {
  const { isLoading, isAuthenticated } = useAuth0();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-700 font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  return <Navigate to={isAuthenticated ? '/dashboard' : '/'} replace />;
};

// Root route. Public homepage for unauthenticated visitors; redirects
// signed-in users to their dashboard. Auth0 callbacks land at `/callback`,
// not here, so we don't need to delay rendering for query-param processing.
const HomeRoute = () => {
  const { isLoading, isAuthenticated } = useAuth0();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-700 font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  // The CTA inside LandingPage prompts login itself for unauthenticated users.
  // onGetStarted is only invoked once the user is signed in, where we route
  // them straight into a new document.
  return <LandingPage onGetStarted={() => navigate('/editor/new')} />;
};

// Main routing component
const AppRoutes = () => {
  const navigate = useNavigate();

  // ✅ Start new document - Navigate to /editor/new
  // documentType: 'affidavit' (default) or 'divorce_package'
  // caseType: 'family' (default) or 'civil'
  const handleNewDocument = (documentType = 'affidavit', caseType = 'family') => {
    console.log('🚀 Navigating to new document:', documentType, caseType);
    navigate(`/editor/new?type=${documentType}&caseType=${caseType}`);
  };

  // ✅ Open existing document
  const handleContinueDocument = (document) => {
    console.log('📂 Navigating to document:', document.id);
    navigate(`/editor/${document.id}`);
  };

  // Navigate back to dashboard
  const handleBackToDashboard = () => {
    navigate('/dashboard');
  };

  return (
    <>
      <AnalyticsTracker />
      <Routes>
        {/* Public homepage: marketing landing for guests, dashboard redirect
            for signed-in users. Auth0 callbacks land at /callback (configured
            in the Auth0 dashboard) so this route doesn't need to wait for
            redirect processing. */}
        <Route
          path="/"
          element={<HomeRoute />}
        />

        {/* Explicit Auth0 callback route — must wait for Auth0Provider to
            consume the ?code=&state= params before any further navigation. */}
        <Route
          path="/callback"
          element={<AuthCallbackHandler />}
        />

      {/* Public Policy Pages - No auth required */}
      <Route
        path="/privacy"
        element={<PrivacyPolicyPage />}
      />

      <Route
        path="/tos"
        element={<TermsOfServicePage />}
      />

      {/* Public Resources Pages - No auth required */}
      <Route
        path="/resources"
        element={<ResourcesPage />}
      />

      <Route
        path="/resources/:slug"
        element={<ArticlePage />}
      />

      {/* Brand Assets Page - No auth required */}
      <Route
        path="/brand"
        element={<BrandAssetsPage />}
      />

      {/* Protected Routes - Require auth and TOS acceptance */}
      <Route
        path="/dashboard"
        element={
          <TOSGuard>
            <UserDashboard
              onNewDocument={handleNewDocument}
              onContinueDocument={handleContinueDocument}
            />
          </TOSGuard>
        }
      />

      <Route
        path="/editor/new"
        element={
          <TOSGuard>
            <EditorView
              isNew={true}
              onBack={handleBackToDashboard}
            />
          </TOSGuard>
        }
      />

      <Route
        path="/editor/:documentId"
        element={
          <TOSGuard>
            <EditorView
              onBack={handleBackToDashboard}
            />
          </TOSGuard>
        }
      />

      {/* Payment success redirect (Stripe return_url for 3D Secure flows) */}
      <Route
        path="/payment-success"
        element={
          <TOSGuard>
            <Navigate to="/dashboard" replace />
          </TOSGuard>
        }
      />

      {/* Catch-all — also uses AuthCallbackHandler to be safe */}
      <Route
        path="*"
        element={<AuthCallbackHandler />}
      />
      </Routes>
    </>
  );
};

/**
 * Main Application Component
 */
const App = () => {
  return (
    <ErrorBoundary>
      <HelmetProvider>
        <Router>
          <Auth0ProviderWithNavigate>
            <TOSProvider>
              <DocumentProvider>
                <AppRoutes />
              </DocumentProvider>
            </TOSProvider>
          </Auth0ProviderWithNavigate>
        </Router>
      </HelmetProvider>
    </ErrorBoundary>
  );
};

export default App;
