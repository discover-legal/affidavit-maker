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
import PrivacyPolicyPage from './components/PrivacyPolicyPage';
import TermsOfServicePage from './components/TermsOfServicePage';
import ResourcesPage from './components/ResourcesPage';
import ArticlePage from './components/ArticlePage';
import BrandAssetsPage from './components/BrandAssetsPage';
import { trackPageView } from './utils/analytics';

// Environment configuration (onRedirectCallback is set inside Auth0ProviderWithNavigate)
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
  useRefreshTokensFallback: true, // Fallback to refresh tokens if silent auth fails
  useCookiesForTransactions: true, // Use cookies for faster cross-origin checks
  authorizeTimeoutInSeconds: 10, // Reduce timeout for iframe check (default is 60s)
};

// Wrapper that puts Auth0Provider inside Router so onRedirectCallback can use navigate
const Auth0ProviderWithNavigate = ({ children }) => {
  const navigate = useNavigate();

  const onRedirectCallback = (appState) => {
    // Use React Router navigate instead of window.history.replaceState
    // replaceState doesn't notify React Router of the URL change, which caused
    // TOSGuard to see stale route state and trigger loginWithRedirect again
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

// Handles root route and /callback — waits for Auth0 to finish processing
// the callback (code/state query params) before redirecting to /dashboard.
// Without this, <Navigate> fires before Auth0Provider reads the params,
// stripping them from the URL and causing an infinite login loop.
const AuthCallbackHandler = () => {
  const { isLoading } = useAuth0();

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

  return <Navigate to="/dashboard" replace />;
};

// Main routing component
const AppRoutes = () => {
  const navigate = useNavigate();

  // ✅ Start new document - Navigate to /editor/new
  const handleNewDocument = () => {
    console.log('🚀 Navigating to new document');
    navigate('/editor/new');
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
        {/* Root route: must wait for Auth0 callback processing before redirecting.
            Auth0 redirects back here with ?code=...&state=... query params.
            Immediately navigating away would strip those params before Auth0 reads them. */}
        <Route
          path="/"
          element={<AuthCallbackHandler />}
        />

        {/* Explicit callback route for Auth0 redirect (matches Auth0 dashboard config) */}
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

      {/* Catch-all redirect — also uses AuthCallbackHandler to be safe */}
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
