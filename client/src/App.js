// client/src/App.js - Balanced 3-column layout with fixed heights
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Auth0Provider, useAuth0 } from '@auth0/auth0-react';
import { FileText, Loader2, BarChart3 } from 'lucide-react';

// Import components
import Header from './components/Header';
import ChatInterface from './components/ChatInterface';
import DocumentPreview from './components/DocumentPreview';
import ValidationSidebar from './components/ValidationSidebar';
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

// DocumentEditor component for App.js
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
  const [countyValidation, setCountyValidation] = useState(null);
  const [preview, setPreview] = useState(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  
  // Layout state for responsive design
  const [isSmallScreen, setIsSmallScreen] = useState(window.innerWidth < 1280);
  const [activePanel, setActivePanel] = useState('chat'); // chat, preview, validation

  // Add refs to track current requests and prevent race conditions
  const previewRequestRef = useRef(null);
  const validationRequestRef = useRef(null);
  const previewTimeoutRef = useRef(null);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      loginWithRedirect({ appState: { returnTo: window.location.pathname } });
      return;
    }
  }, [isAuthenticated, isLoading, loginWithRedirect]);

  // Responsive design detection
  useEffect(() => {
    const checkScreenSize = () => {
      const isSmall = window.innerWidth < 1280;
      setIsSmallScreen(isSmall);
      if (!isSmall) {
        setActivePanel('chat'); // Reset to chat on larger screens
      }
    };
    
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  // Cleanup function
  useEffect(() => {
    return () => {
      if (previewRequestRef.current) {
        previewRequestRef.current.abort();
      }
      if (validationRequestRef.current) {
        validationRequestRef.current.abort();
      }
      if (previewTimeoutRef.current) {
        clearTimeout(previewTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!existingDocument && isAuthenticated) {
      const savedSession = localStorage.getItem(getSessionKey(getTabId()));
      if (savedSession) {
        const sessionData = JSON.parse(savedSession);
        if (Date.now() - new Date(sessionData.timestamp) < 24 * 60 * 60 * 1000) {
          setSavedSessionData(sessionData);
          setShowResumeModal(true);
        } else {
          localStorage.removeItem(getSessionKey(getTabId()));
        }
      }
    }
    setSessionLoading(false);
  }, [existingDocument, isAuthenticated]);

  // SINGLE generatePreview function with race condition protection
  const generatePreview = useCallback(async (currentAffidavitData) => {
    if (previewRequestRef.current) {
      previewRequestRef.current.abort();
    }
    
    if (!currentAffidavitData.state) {
      setPreview(null);
      setIsPreviewLoading(false);
      return;
    }

    setIsPreviewLoading(true);
    
    const abortController = new AbortController();
    previewRequestRef.current = abortController;

    try {
      let headers = { 'Content-Type': 'application/json' };
      if (isAuthenticated) {
        const token = await getAccessTokenSilently({
          authorizationParams: { audience: process.env.REACT_APP_AUTH0_AUDIENCE }
        });
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch(`${API_BASE}/api/preview`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ affidavitData: currentAffidavitData }),
        signal: abortController.signal
      });

      if (abortController.signal.aborted) {
        return;
      }

      const data = await response.json();
      
      if (previewRequestRef.current === abortController) {
        if (data.success) {
          setPreview(data.preview);
          if (data.countyValidation) {
            setCountyValidation(data.countyValidation);
          }
        } else if (data.fallback) {
          setPreview(data.fallback);
        } else {
          setPreview(null);
        }
        setIsPreviewLoading(false);
        previewRequestRef.current = null;
      }
    } catch (error) {
      if (!abortController.signal.aborted) {
        console.error('Preview generation error:', error);
        if (previewRequestRef.current === abortController) {
          setPreview(null);
          setIsPreviewLoading(false);
          previewRequestRef.current = null;
        }
      }
    }
  }, [isAuthenticated, getAccessTokenSilently]);

  const validateData = useCallback(async (currentAffidavitData) => {
    if (validationRequestRef.current) {
      validationRequestRef.current.abort();
    }
    
    if (!currentAffidavitData.state) {
      setValidation(null);
      return;
    }

    const abortController = new AbortController();
    validationRequestRef.current = abortController;

    try {
      const response = await fetch(`${API_BASE}/api/templates/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          affidavitData: currentAffidavitData, 
          state: currentAffidavitData.state 
        }),
        signal: abortController.signal
      });

      if (abortController.signal.aborted) {
        return;
      }

      if (response.ok) {
        const data = await response.json();
        
        if (validationRequestRef.current === abortController) {
          if (data.success) {
            setValidation(data.validation);
          }
          validationRequestRef.current = null;
        }
      }
    } catch (error) {
      if (!abortController.signal.aborted) {
        console.error('Validation error:', error);
        if (validationRequestRef.current === abortController) {
          validationRequestRef.current = null;
        }
      }
    }
  }, []);

  // Debounced effect that prevents rapid-fire requests
  useEffect(() => {
    if (previewTimeoutRef.current) {
      clearTimeout(previewTimeoutRef.current);
    }

    previewTimeoutRef.current = setTimeout(() => {
      const currentData = affidavitData;
      
      Promise.all([
        validateData(currentData),
        generatePreview(currentData)
      ]).catch(error => {
        console.error('Error in validation/preview generation:', error);
      });
    }, 500);

    return () => {
      if (previewTimeoutRef.current) {
        clearTimeout(previewTimeoutRef.current);
      }
    };
  }, [affidavitData, validateData, generatePreview]);

  const handleResumeDecision = (resume) => {
    if (resume && savedSessionData) {
      setAffidavitData(savedSessionData.affidavitData);
      setDocumentComplete(savedSessionData.documentComplete);
    } else {
      localStorage.removeItem(getSessionKey(getTabId()));
    }
    setShowResumeModal(false);
    setSavedSessionData(null);
  };

  const saveSession = useCallback(async () => {
    localStorage.setItem(getSessionKey(getTabId()), JSON.stringify({
      affidavitData, documentComplete, timestamp: new Date().toISOString()
    }));

    if (isAuthenticated) {
      try {
        const token = await getAccessTokenSilently({
          authorizationParams: { audience: process.env.REACT_APP_AUTH0_AUDIENCE }
        });
        const response = await fetch(`${API_BASE}/api/documents/save-draft`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ documentId: affidavitData.documentId, affidavitData })
        });
        const data = await response.json();
        if (data.success) {
          if(data.documentId) setAffidavitData(prev => ({ ...prev, documentId: data.documentId }));
          if(data.validation) setValidation(data.validation);
          setSessionSaved(true);
          setTimeout(() => setSessionSaved(false), 3000);
        }
      } catch (error) {
        console.error('Failed to save to backend:', error);
      }
    }
  }, [affidavitData, documentComplete, isAuthenticated, getAccessTokenSilently, setSessionSaved]);

  useEffect(() => {
    if (saveSessionRef) saveSessionRef.current = saveSession;
  }, [saveSession, saveSessionRef]);

  const handleDataUpdate = (newData) => {
    setAffidavitData(prev => ({ ...prev, ...newData }));
  };

  const handleDocumentComplete = (complete) => {
    setDocumentComplete(complete);
    if (complete && validation?.isValid) {
      setShowPayment(true);
    }
  };

  const handlePaymentSuccess = async () => {
    setShowPayment(false);
    try {
      const token = await getAccessTokenSilently({
        authorizationParams: { audience: process.env.REACT_APP_AUTH0_AUDIENCE }
      });
      const response = await fetch(`${API_BASE}/api/documents/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ affidavitData, strategy: 'detailed', format: 'pdf' })
      });
      const data = await response.json();
      if (data.success && data.downloadUrl) {
        localStorage.removeItem(getSessionKey(getTabId()));
        window.open(`${API_BASE}${data.downloadUrl}`, '_blank');
        onBack();
      } else {
        alert(`Generation failed: ${data.error}`);
      }
    } catch (error) {
      alert(`Generation failed: ${error.message}`);
    }
  };

  if (isLoading || sessionLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
      </div>
    );
  }

  // Mobile panel navigation
  const PanelToggle = () => (
    <div className="mb-4 flex bg-white rounded-lg shadow-sm border p-1">
      <button
        onClick={() => setActivePanel('chat')}
        className={`flex-1 flex items-center justify-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
          activePanel === 'chat' 
            ? 'bg-blue-600 text-white' 
            : 'text-gray-600 hover:text-gray-900'
        }`}
      >
        💬 Chat
      </button>
      <button
        onClick={() => setActivePanel('preview')}
        className={`flex-1 flex items-center justify-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
          activePanel === 'preview' 
            ? 'bg-blue-600 text-white' 
            : 'text-gray-600 hover:text-gray-900'
        }`}
      >
        <FileText className="h-4 w-4 mr-1" />
        Preview
      </button>
      <button
        onClick={() => setActivePanel('validation')}
        className={`flex-1 flex items-center justify-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
          activePanel === 'validation' 
            ? 'bg-blue-600 text-white' 
            : 'text-gray-600 hover:text-gray-900'
        }`}
      >
        <BarChart3 className="h-4 w-4 mr-1" />
        Status
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Container with max height and use more screen space */}
      <div className="max-w-[1600px] mx-auto px-3 sm:px-4 lg:px-6 py-4">
        {/* Mobile panel toggle */}
        {isSmallScreen && <PanelToggle />}
        
        {/* Fixed Height Layout Grid - Use more vertical space */}
        <div 
          className={`grid gap-4 ${
            isSmallScreen 
              ? 'grid-cols-1' 
              : 'grid-cols-12'
          }`}
          style={{ 
            height: isSmallScreen 
              ? 'calc(100vh - 140px)' 
              : 'calc(100vh - 120px)' 
          }}
        >
          
          {/* Chat Interface - 45% width */}
          {(!isSmallScreen || activePanel === 'chat') && (
            <div className={isSmallScreen ? 'h-full' : 'col-span-5 h-full'}>
              <ChatInterface
                affidavitData={affidavitData}
                onDataUpdate={handleDataUpdate}
                onSaveSession={saveSession}
                documentComplete={documentComplete}
                onDocumentComplete={handleDocumentComplete}
                validation={validation}
                onValidationUpdate={setValidation}
              />
            </div>
          )}
          
          {/* Document Preview - 40% width */}
          {(!isSmallScreen || activePanel === 'preview') && (
            <div className={isSmallScreen ? 'h-full' : 'col-span-4 h-full'}>
              <DocumentPreview
                preview={preview}
                affidavitData={affidavitData}
                documentComplete={documentComplete}
                validation={validation}
                onDownload={() => setShowPayment(true)}
                isPreviewLoading={isPreviewLoading}
              />
            </div>
          )}
          
          {/* Validation Sidebar - 15% width (compact) */}
          {(!isSmallScreen || activePanel === 'validation') && (
            <div className={isSmallScreen ? 'h-full' : 'col-span-3 h-full'}>
              <ValidationSidebar
                validation={validation}
                countyValidation={countyValidation}
                affidavitData={affidavitData}
              />
            </div>
          )}
        </div>
      </div>
      
      <ResumeModal
        isOpen={showResumeModal}
        onClose={() => setShowResumeModal(false)}
        onResume={() => handleResumeDecision(true)}
        onStartFresh={() => handleResumeDecision(false)}
      />
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

// Main App Wrapper
function App() {
  const [currentView, setCurrentView] = useState('landing');
  const [currentDocument, setCurrentDocument] = useState(null);
  const [sessionSaved, setSessionSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const saveSessionRef = useRef(null);

  const handleSave = useCallback(async () => {
    if (saveSessionRef.current) {
      setIsSaving(true);
      await saveSessionRef.current();
      setIsSaving(false);
    }
  }, []);

  const viewSwitch = (view, doc = null) => {
    setCurrentView(view);
    setCurrentDocument(doc);
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
            onBackToDashboard={() => viewSwitch('dashboard')}
            onSave={handleSave}
            sessionSaved={sessionSaved}
            isSaving={isSaving}
          />
          <main>
            {currentView === 'landing' && <LandingPage onGetStarted={() => viewSwitch('dashboard')} />}
            {currentView === 'dashboard' && (
              <UserDashboard
                onNewDocument={() => viewSwitch('editor')}
                onContinueDocument={(doc) => viewSwitch('editor', doc)}
              />
            )}
            {currentView === 'editor' && (
              <DocumentEditor
                existingDocument={currentDocument}
                onBack={() => viewSwitch('dashboard')}
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