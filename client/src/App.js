import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Auth0Provider, useAuth0 } from '@auth0/auth0-react';
import { 
  Send, FileText, Download, Loader2, CreditCard, X, Scale, Clock,
  AlertTriangle, Shield, Zap, ChevronRight, Menu
} from 'lucide-react';

// Import components
import ValidationDisplay from './components/ValidationDisplay';
import Header from './components/Header';
import ChatInterface from './components/ChatInterface';
import DocumentPreview from './components/DocumentPreview';
import UserDashboard from './components/UserDashboard';
import LandingPage from './components/LandingPage';
import ErrorBoundary from './components/ErrorBoundary';
import ResumeModal from './components/ResumeModal';
import PaymentModal from './components/PaymentModal';

// API Base URL
const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3001';

// Generate unique tab identifier for session management
const getTabId = () => {
  let tabId = sessionStorage.getItem('tabId');
  if (!tabId) {
    tabId = Date.now().toString();
    sessionStorage.setItem('tabId', tabId);
  }
  return tabId;
};

// Session storage keys
const getSessionKey = (tabId) => `affidavit-session-${tabId}`;

// Fixed Document Editor with proper session management
const DocumentEditor = ({ existingDocument = null, onBack, setSessionSaved, saveSessionRef }) => {
  const { getAccessTokenSilently, loginWithRedirect, isAuthenticated, isLoading } = useAuth0();
  const [affidavitData, setAffidavitData] = useState(existingDocument?.content || {
    state: '',
    affiantName: '',
    caseNumber: '',
    caseType: '',
    county: '',
    documentType: 'general',
    facts: [],
    documentId: existingDocument?.id || null
  });
  const [documentComplete, setDocumentComplete] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [showResumeModal, setShowResumeModal] = useState(false);
  const [savedSessionData, setSavedSessionData] = useState(null);
  const [validation, setValidation] = useState(null);
  const [preview, setPreview] = useState(null);
  const [isSmallScreen, setIsSmallScreen] = useState(window.innerWidth < 1024);
  const [showPreview, setShowPreview] = useState(!isSmallScreen);
  const [userToggledPreview, setUserToggledPreview] = useState(false);

  // Only require auth when accessing DocumentEditor
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      console.log('DocumentEditor: Not authenticated, redirecting to login...');
      loginWithRedirect({
        appState: { returnTo: window.location.pathname }
      });
      return;
    }
  }, [isAuthenticated, isLoading, loginWithRedirect]);

  // Check screen size
  useEffect(() => {
    const checkScreenSize = () => {
      const isSmall = window.innerWidth < 1024;
      setIsSmallScreen(isSmall);
      
      if (isSmall && showPreview && !userToggledPreview) {
        setShowPreview(false);
      } else if (!isSmall && !userToggledPreview) {
        setShowPreview(true);
      }
    };

    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, [showPreview, userToggledPreview]);

  // Load saved session
  useEffect(() => {
    if (!existingDocument && isAuthenticated) {
      const tabId = getTabId();
      const sessionKey = getSessionKey(tabId);
      const savedSession = localStorage.getItem(sessionKey);
      
      if (savedSession) {
        try {
          const sessionData = JSON.parse(savedSession);
          const sessionAge = Date.now() - new Date(sessionData.timestamp);
          if (sessionAge < 24 * 60 * 60 * 1000) { // 24 hours
            setSavedSessionData(sessionData);
            setShowResumeModal(true);
          } else {
            localStorage.removeItem(sessionKey);
          }
        } catch (e) {
          console.error('Failed to load session:', e);
          localStorage.removeItem(sessionKey);
        }
      }
    }
    setSessionLoading(false);
  }, [existingDocument, isAuthenticated]);

  // Generate preview when data changes
  useEffect(() => {
    if (affidavitData.state) {
      generatePreview();
    }
  }, [affidavitData]);

  // Validate data when it changes
  useEffect(() => {
    if (affidavitData.state) {
      validateData();
    }
  }, [affidavitData]);

  const generatePreview = useCallback(async () => {
    try {
      let headers = { 'Content-Type': 'application/json' };
      
      if (isAuthenticated) {
        try {
          const token = await getAccessTokenSilently({ 
            authorizationParams: {
              audience: process.env.REACT_APP_AUTH0_AUDIENCE
            }
          });
          headers['Authorization'] = `Bearer ${token}`;
        } catch (authError) {
          console.warn('Could not get auth token for preview');
        }
      }
      
      const response = await fetch(`${API_BASE}/api/preview`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ affidavitData })
      });
      
      const data = await response.json();
      if (data.success) {
        setPreview(data.preview);
      } else if (data.fallback) {
        setPreview(data.fallback);
      }
    } catch (error) {
      console.error('Preview generation error:', error);
    }
  }, [affidavitData, isAuthenticated, getAccessTokenSilently]);

  const validateData = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/templates/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          affidavitData,
          state: affidavitData.state
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setValidation(data.validation);
        }
      }
    } catch (error) {
      console.error('Validation error:', error);
    }
  }, [affidavitData]);

  const handleResumeDecision = (resume) => {
    if (resume && savedSessionData) {
      setAffidavitData(savedSessionData.affidavitData);
      setDocumentComplete(savedSessionData.documentComplete);
    }
    setShowResumeModal(false);
    setSavedSessionData(null);
    
    if (!resume) {
      const tabId = getTabId();
      const sessionKey = getSessionKey(tabId);
      localStorage.removeItem(sessionKey);
    }
  };

  const saveSession = useCallback(async () => {
    // Save to localStorage
    const sessionData = {
      affidavitData,
      documentComplete,
      timestamp: new Date().toISOString()
    };
    
    const tabId = getTabId();
    const sessionKey = getSessionKey(tabId);
    localStorage.setItem(sessionKey, JSON.stringify(sessionData));
    
    // Save to backend
    if (isAuthenticated) {
      try {
        const token = await getAccessTokenSilently({
          authorizationParams: {
            audience: process.env.REACT_APP_AUTH0_AUDIENCE
          }
        });
        
        const response = await fetch(`${API_BASE}/api/documents/save-draft`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            documentId: affidavitData.documentId,
            affidavitData
          })
        });
        
        const data = await response.json();
        if (data.success && data.documentId) {
          setAffidavitData(prev => ({ ...prev, documentId: data.documentId }));
          if (data.validation) {
            setValidation(data.validation);
          }
          
          setSessionSaved(true);
          setTimeout(() => setSessionSaved(false), 3000);
        }
      } catch (error) {
        console.error('Failed to save to backend:', error);
      }
    }
  }, [affidavitData, documentComplete, isAuthenticated, getAccessTokenSilently, setSessionSaved]);

  // Expose the saveSession function to the parent component
  useEffect(() => {
    if (saveSessionRef) {
      saveSessionRef.current = saveSession;
    }
  }, [saveSession, saveSessionRef]);

  const handleDataUpdate = (newData) => {
    setAffidavitData(prev => ({ ...prev, ...newData }));
  };

  const handleValidationUpdate = (newValidation) => {
    setValidation(newValidation);
  };

  const handleDocumentComplete = (complete) => {
    setDocumentComplete(complete);
  };

  const handleDownload = () => {
    setShowPayment(true);
  };

  const handlePaymentSuccess = async () => {
    setShowPayment(false);
    
    try {
      const token = await getAccessTokenSilently({
        authorizationParams: {
          audience: process.env.REACT_APP_AUTH0_AUDIENCE
        }
      });
      
      const response = await fetch(`${API_BASE}/api/documents/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          affidavitData,
          strategy: 'detailed',
          format: 'pdf'
        })
      });

      const data = await response.json();
      if (data.success) {
        // Clear session
        const tabId = getTabId();
        const sessionKey = getSessionKey(tabId);
        localStorage.removeItem(sessionKey);
        
        if (data.downloadUrl) {
          window.open(`${API_BASE}${data.downloadUrl}`, '_blank');
        }
      } else {
        alert(`Generation failed: ${data.error}`);
      }
    } catch (error) {
      console.error('Document generation error:', error);
      alert(`Generation failed: ${error.message}`);
    }
  };

  const handlePreviewToggle = () => {
    setShowPreview(!showPreview);
    setUserToggledPreview(true);
  };

  // Show loading while auth is being checked
  if (isLoading || sessionLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Mobile preview toggle */}
        {isSmallScreen && (
          <div className="mb-4 flex justify-end">
            <button
              onClick={handlePreviewToggle}
              className="flex items-center px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <FileText className="h-4 w-4 mr-2" />
              {showPreview ? 'Hide Preview' : 'Show Preview'}
            </button>
          </div>
        )}

        <div className={`grid gap-8 ${showPreview && !isSmallScreen ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
          {/* Chat Interface */}
          <ChatInterface
            affidavitData={affidavitData}
            onDataUpdate={handleDataUpdate}
            onSaveSession={saveSession}
            documentComplete={documentComplete}
            onDocumentComplete={handleDocumentComplete}
            validation={validation}
            onValidationUpdate={handleValidationUpdate}
          />

          {/* Document Preview */}
          {showPreview && (
            <DocumentPreview
              preview={preview}
              affidavitData={affidavitData}
              documentComplete={documentComplete}
              validation={validation}
              onDownload={handleDownload}
              onClose={isSmallScreen ? handlePreviewToggle : undefined}
            />
          )}
        </div>
      </div>

      {/* Resume Modal */}
      <ResumeModal
        isOpen={showResumeModal}
        onClose={() => setShowResumeModal(false)}
        onResume={() => handleResumeDecision(true)}
        onStartFresh={() => handleResumeDecision(false)}
      />

      {/* Payment Modal */}
      {showPayment && (
        <PaymentModal
          isOpen={showPayment}
          onClose={() => setShowPayment(false)}
          affidavitData={affidavitData}
          onPaymentSuccess={handlePaymentSuccess}
        />
      )}
    </div>
  );
};

// Main App Component
function App() {
  const [currentView, setCurrentView] = useState('landing');
  const [currentDocument, setCurrentDocument] = useState(null);
  const [sessionSaved, setSessionSaved] = useState(false);
  const saveSessionRef = useRef(null);

  const handleGetStarted = () => {
    setCurrentView('dashboard');
  };

  const handleNewDocument = () => {
    setCurrentDocument(null);
    setCurrentView('editor');
  };

  const handleContinueDocument = (doc) => {
    setCurrentDocument(doc);
    setCurrentView('editor');
  };

  const handleBackToDashboard = () => {
    setCurrentView('dashboard');
    setCurrentDocument(null);
  };

  return (
    <ErrorBoundary>
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
      >
        <div className="App">
          <Header
            currentView={currentView}
            onBackToDashboard={handleBackToDashboard}
            onSave={() => saveSessionRef.current && saveSessionRef.current()}
            sessionSaved={sessionSaved}
          />
          <main>
            {currentView === 'landing' && (
              <LandingPage onGetStarted={handleGetStarted} />
            )}

            {currentView === 'dashboard' && (
              <UserDashboard
                onNewDocument={handleNewDocument}
                onContinueDocument={handleContinueDocument}
              />
            )}
            
            {currentView === 'editor' && (
              <DocumentEditor
                existingDocument={currentDocument}
                onBack={handleBackToDashboard}
                setSessionSaved={setSessionSaved}
                saveSessionRef={saveSessionRef}
              />
            )}
          </main>
        </div>
      </Auth0Provider>
    </ErrorBoundary>
  );
}

export default App;