// client/src/App.js - COMPLETE INTEGRATION
import React from 'react';
import { Auth0Provider } from '@auth0/auth0-react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { DocumentProvider } from './contexts/DocumentContext';
import LandingPage from './components/LandingPage';
import UserDashboard from './components/UserDashboard';
import EditorView from './views/EditorView';
import ErrorBoundary from './components/ErrorBoundary';
import TOSGuard from './components/TOSGuard';

// Environment configuration
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
  onRedirectCallback: (appState) => {
    // After Auth0 redirects back, navigate to the page the user was on
    // or default to the dashboard
    window.history.replaceState(
      {},
      document.title,
      appState?.returnTo || '/dashboard'
    );
  }
};

// Main routing component
const AppRoutes = () => {
  const navigate = useNavigate();

  // Navigate to dashboard
  const handleGetStarted = () => {
    navigate('/dashboard');
  };

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
    <Routes>
      {/* Landing Page */}
      <Route 
        path="/" 
        element={<LandingPage onGetStarted={handleGetStarted} />} 
      />

      {/* Dashboard */}
      <Route 
        path="/dashboard" 
        element={
          <UserDashboard 
            onNewDocument={handleNewDocument}
            onContinueDocument={handleContinueDocument}
          />
        } 
      />

      {/* Editor - New Document */}
      <Route 
        path="/editor/new" 
        element={
          <EditorView 
            isNew={true}
            onBack={handleBackToDashboard} 
          />
        } 
      />

      {/* Editor - Existing Document */}
      <Route 
        path="/editor/:documentId" 
        element={
          <EditorView 
            onBack={handleBackToDashboard} 
          />
        } 
      />

      {/* Catch-all redirect */}
      <Route 
        path="*" 
        element={<Navigate to="/" replace />} 
      />
    </Routes>
  );
};

/**
 * Main Application Component
 */
const App = () => {
  return (
    <ErrorBoundary>
      <Auth0Provider {...AUTH0_CONFIG}>
        <DocumentProvider>
          <Router>
            <TOSGuard>
              <AppRoutes />
            </TOSGuard>
          </Router>
        </DocumentProvider>
      </Auth0Provider>
    </ErrorBoundary>
  );
};

export default App;
