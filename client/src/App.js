// App.js - Refactored Application Architecture
import React, { useState, useMemo } from 'react';
import { Auth0Provider } from '@auth0/auth0-react';
import { DocumentProvider } from './contexts/DocumentContext';
import LandingPage from './components/LandingPage';
import UserDashboard from './components/UserDashboard';  
import EditorView from './views/EditorView'; 
import ErrorBoundary from './components/ErrorBoundary';
import AffidavitForm from '/components/AffidavitForm'

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

// Application views/routes
const APP_VIEWS = {
  LANDING: 'landing',
  DASHBOARD: 'dashboard', 
  EDITOR: 'editor'
};

/**
 * Main Application Component
 * 
 * Provides a clean, elegant architecture with:
 * - Centralized state management via contexts
 * - Clear separation of concerns
 * - Proper error boundaries
 * - Authentication integration
 * - Responsive routing system
 * 
 * @returns {JSX.Element} Main application
 */
const App = () => {
  // Application state
  const [currentView, setCurrentView] = useState(APP_VIEWS.LANDING);
  const [selectedDocument, setSelectedDocument] = useState(null);

  /**
   * Navigation handlers
   * Provides clean, predictable navigation between views
   */
  const navigationHandlers = useMemo(() => ({
    /**
     * Navigate to landing page
     */
    goToLanding: () => {
      setCurrentView(APP_VIEWS.LANDING);
      setSelectedDocument(null);
    },

    /**
     * Navigate to dashboard
     */
    goToDashboard: () => {
      setCurrentView(APP_VIEWS.DASHBOARD);
      setSelectedDocument(null);
    },

    /**
     * Navigate to document editor
     * 
     * @param {Object|null} document - Document to edit (null for new document)
     */
    goToEditor: (document = null) => {
      setSelectedDocument(document);
      setCurrentView(APP_VIEWS.EDITOR);
    },

    /**
     * Navigate back from current view
     */
    goBack: () => {
      switch (currentView) {
        case APP_VIEWS.EDITOR:
          setCurrentView(APP_VIEWS.DASHBOARD);
          setSelectedDocument(null);
          break;
        case APP_VIEWS.DASHBOARD:
          setCurrentView(APP_VIEWS.LANDING);
          break;
        default:
          // Already at landing, no action needed
          break;
      }
    }
  }), [currentView]);

  /**
   * Enhanced OpenAI client configuration
   * In production, you would initialize your actual OpenAI client here
   */
  const openaiClient = useMemo(() => {
    // For development/testing, we'll use a mock client
    // In production, replace this with your actual OpenAI client initialization
    if (process.env.NODE_ENV === 'development') {
      return {
        chat: {
          completions: {
            create: async ({ messages }) => {
              // Mock implementation for development
              console.log('Mock OpenAI call:', messages);
              
              // Simulate API delay
              await new Promise(resolve => setTimeout(resolve, 1500));
              
              // Return mock response based on the enhanced validation logic
              return {
                choices: [{
                  message: {
                    content: JSON.stringify({
                      isValid: true,
                      category: 'general',
                      subcategory: 'other',
                      professionalVersion: 'Mock professional version of the fact',
                      languageIssues: [],
                      legalIssues: [],
                      improvements: ['Mock improvement suggestion'],
                      confidence: 0.85,
                      legalStandardScore: 75,
                      duplicateIndex: null
                    })
                  }
                }]
              };
            }
          }
        }
      };
    }

    // Production OpenAI client initialization
    // Uncomment and configure for production use:
    /*
    return new OpenAI({
      apiKey: process.env.REACT_APP_OPENAI_API_KEY,
      dangerouslyAllowBrowser: true // Only for client-side usage
    });
    */
    
    return null; // No client in production until properly configured
  }, []);

  /**
   * Document validation options
   */
  const validationOptions = useMemo(() => ({
    openaiClient,
    language: 'en', // Could be dynamic based on user preference
    enableProfessionalValidation: true,
    enableInappropriateContentDetection: true
  }), [openaiClient]);

  /**
   * Document save options
   */
  const saveOptions = useMemo(() => ({
    autoSaveDelay: 2000, // 2 seconds
    enableAutoSave: true,
    maxRetries: 3,
    retryDelay: 1000
  }), []);

  /**
   * Render the appropriate view based on current application state
   * 
   * @returns {JSX.Element} Current view component
   */
  const renderCurrentView = () => {
    switch (currentView) {
      case APP_VIEWS.LANDING:
        return (
          <LandingPage 
            onGetStarted={navigationHandlers.goToDashboard}
          />
        );

      case APP_VIEWS.DASHBOARD:
        return (
          <UserDashboard
            onNewDocument={navigationHandlers.goToEditor}
            onContinueDocument={navigationHandlers.goToEditor}
          />
        );

      case APP_VIEWS.EDITOR:
        return (
          <DocumentProvider
            initialDocument={selectedDocument}
            validationOptions={validationOptions}
            saveOptions={saveOptions}
          >
            <EditorView  // Using the refactored version
              existingDocument={selectedDocument}
              onNavigate={navigationHandlers}
            />
          </DocumentProvider>
        );
    }
  };
      
  return (
    <ErrorBoundary>
      <Auth0Provider {...AUTH0_CONFIG}>
        <div className="App min-h-screen bg-gray-50">
          {renderCurrentView()}
        </div>
      </Auth0Provider>
    </ErrorBoundary>
  );
};
export default App;