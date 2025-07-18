// client/src/App.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Auth0Provider, useAuth0 } from '@auth0/auth0-react';
import { FileText, Loader2 } from 'lucide-react';

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

// Document Editor Component
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
  const [isPreviewLoading, setIsPreviewLoading] = useState(false); // New state for preview loading
  const [isSmallScreen, setIsSmallScreen] = useState(window.innerWidth < 1024);
  const [showPreview, setShowPreview] = useState(!isSmallScreen);
  const [userToggledPreview, setUserToggledPreview] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      loginWithRedirect({ appState: { returnTo: window.location.pathname } });
      return;
    }
  }, [isAuthenticated, isLoading, loginWithRedirect]);

  useEffect(() => {
    const checkScreenSize = () => {
      const isSmall = window.innerWidth < 1024;
      setIsSmallScreen(isSmall);
      if (isSmall && showPreview && !userToggledPreview) setShowPreview(false);
      else if (!isSmall && !userToggledPreview) setShowPreview(true);
    };
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, [showPreview, userToggledPreview]);

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

  const generatePreview = useCallback(async () => {
    if (!affidavitData.state) {
      setPreview(null);
      return;
    }
    setIsPreviewLoading(true);
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
        body: JSON.stringify({ affidavitData })
      });
      const data = await response.json();
      if (data.success) setPreview(data.preview);
      else if (data.fallback) setPreview(data.fallback);
    } catch (error) {
      console.error('Preview generation error:', error);
      setPreview(null);
    } finally {
      setIsPreviewLoading(false);
    }
  }, [affidavitData, isAuthenticated, getAccessTokenSilently]);

  const validateData = useCallback(async () => {
    if (!affidavitData.state) return;
    try {
      const response = await fetch(`${API_BASE}/api/templates/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ affidavitData, state: affidavitData.state })
      });
      if (response.ok) {
        const data = await response.json();
        if (data.success) setValidation(data.validation);
      }
    } catch (error) {
      console.error('Validation error:', error);
    }
  }, [affidavitData]);
  
  useEffect(() => {
    const handler = setTimeout(() => {
      validateData();
      generatePreview();
    }, 500);
    return () => clearTimeout(handler);
  }, [affidavitData, generatePreview, validateData]);


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

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {isSmallScreen && (
          <div className="mb-4 flex justify-end">
            <button
              onClick={() => { setShowPreview(!showPreview); setUserToggledPreview(true); }}
              className="flex items-center px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <FileText className="h-4 w-4 mr-2" />
              {showPreview ? 'Hide Preview' : 'Show Preview'}
            </button>
          </div>
        )}
        <div className={`grid gap-8 ${showPreview ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
          <ChatInterface
            affidavitData={affidavitData}
            onDataUpdate={handleDataUpdate}
            onSaveSession={saveSession}
            documentComplete={documentComplete}
            onDocumentComplete={handleDocumentComplete}
            validation={validation}
            onValidationUpdate={setValidation}
          />
          {showPreview && (
            <DocumentPreview
              preview={preview}
              affidavitData={affidavitData}
              documentComplete={documentComplete}
              validation={validation}
              onDownload={() => setShowPayment(true)}
              isPreviewLoading={isPreviewLoading}
            />
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