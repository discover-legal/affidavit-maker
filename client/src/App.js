import React from 'react';
import { Auth0Provider } from '@auth0/auth0-react';
import { DocumentProvider } from './contexts/DocumentContext';
import LandingPage from './components/LandingPage';
import UserDashboard from './components/UserDashboard';  
import EditorView from './views/EditorView'; 
import ErrorBoundary from './components/ErrorBoundary';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';

// Environment configuration
const AUTH0_CONFIG = {
  domain: process.env.REACT_APP_AUTH0_DOMAIN,
  clientId: process.env.REACT_APP_AUTH0_CLIENT_ID,
  authorizationParams: {
    redirect_uri: window.location.origin,
    audience: process.env.REACT_APP_AUTH0_AUDIENCE,
    scope: "openid profile email"
  },
  cacheLocation: 'memory',  
  useRefreshTokens: false 
};

// Wrapper component to handle navigation
const AppContent = () => {
  const navigate = useNavigate();

  // Navigation handlers
  const handleGetStarted = () => {
    navigate('/dashboard');
  };

  const handleNewDocument = () => {
    navigate('/create');
  };

  const handleContinueDocument = (document) => {
    navigate(`/editor/${document.id}`);
  };

  const handleBackToDashboard = () => {
    navigate('/dashboard');
  };

  return (
    <Routes>
      <Route 
        path="/" 
        element={<LandingPage onGetStarted={handleGetStarted} />} 
      />
      <Route 
        path="/dashboard" 
        element={
          <UserDashboard 
            onNewDocument={handleNewDocument}
            onContinueDocument={handleContinueDocument}
          />
        } 
      />
      <Route 
        path="/editor/:documentId?" 
        element={<EditorView onBack={handleBackToDashboard} />} 
      />
      <Route 
        path="/create" 
        element={<EditorView isNew={true} onBack={handleBackToDashboard} />} 
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

/**
 * Main Application Component
 * 
 * Provides a clean, elegant architecture with:
 * - Centralized state management via contexts
 * - Clear separation of concerns
 * - Proper error boundaries
 * - Authentication integration
 * - React Router for navigation
 * 
 * @returns {JSX.Element} Main application
 */
const App = () => {
  return (
    <Auth0Provider {...AUTH0_CONFIG}>
      <ErrorBoundary>
        <DocumentProvider>
          <Router>
            <AppContent />
          </Router>
        </DocumentProvider>
      </ErrorBoundary>
    </Auth0Provider>
  );
};

export default App;