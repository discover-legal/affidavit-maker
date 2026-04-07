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

/**
 * Auth0Provider wrapper that lives inside Router so it can use useNavigate
 * for proper redirect callback handling (prevents login loop).
 */
const Auth0ProviderWithNavigate = ({ children }) => {
  const navigate = useNavigate();

  const onRedirectCallback = (appState) => {
    // Use React Router navigate instead of window.history.replaceState
    // so the router is aware of the URL change after Auth0 callback
    navigate(appState?.returnTo || '/dashboard', { replace: true });
  };

  return (
    <Auth0Provider
      domain={process.env.REACT_APP_AUTH0_DOMAIN}
      clientId={process.env.REACT_APP_AUTH0_CLIENT_ID}
      authorizationParams={{
        redirect_uri: window.location.origin,
        audience: process.env.REACT_APP_AUTH0_AUDIENCE,
        scope: "openid profile email"
      }}
      cacheLocation="localstorage"
      useRefreshTokens={true}
      useRefreshTokensFallback={true}
      useCookiesForTransactions={true}
      authorizeTimeoutInSeconds={10}
      onRedirectCallback={onRedirectCallback}
    >
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

/**
 * Root route handler — if Auth0 callback params (code/state) are in the URL,
 * show a loading spinner and let Auth0Provider process them.
 * Otherwise redirect straight to /dashboard.
 */
const RootRoute = () => {
  const { isLoading, isAuthenticated, error } = useAuth0();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const hasAuthCallback = params.has('code') && params.has('state');

  // Auth0 callback in progress — wait for it to finish
  if (hasAuthCallback || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-700 font-medium">Completing login...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50">
        <div className="text-center max-w-md">
          <p className="text-red-600 font-medium mb-2">Login failed</p>
          <p className="text-gray-600 text-sm mb-4">{error.message}</p>
          <a href="/dashboard" className="text-blue-600 underline">Try again</a>
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
        {/* Root handles Auth0 callback, then redirects to dashboard */}
        <Route
          path="/"
          element={<RootRoute />}
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

      {/* Catch-all redirect */}
      <Route
        path="*"
        element={<Navigate to="/dashboard" replace />}
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
