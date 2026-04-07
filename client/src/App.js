// client/src/App.js - COMPLETE INTEGRATION
import React, { useEffect } from 'react';
import { Auth0Provider } from '@auth0/auth0-react';
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

// Auth0 provider that lives inside Router so it can use useNavigate
const Auth0ProviderWithNavigate = ({ children }) => {
  const navigate = useNavigate();

  const onRedirectCallback = (appState) => {
    // Use React Router's navigate instead of window.history.replaceState
    // so the router actually processes the route change
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
        {/* Root redirects straight to dashboard (landing page lives on Webflow) */}
        <Route
          path="/"
          element={<Navigate to="/dashboard" replace />}
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
