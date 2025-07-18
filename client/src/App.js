// client/src/App.js - Resizable layout with draggable divider
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Auth0Provider, useAuth0 } from '@auth0/auth0-react';
import { FileText, Loader2, BarChart3, GripVertical } from 'lucide-react';

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

// Draggable Resizer Component
const DraggableResizer = ({ onResize, isResizing, setIsResizing }) => {
  const resizerRef = useRef(null);

  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    setIsResizing(true);
    
    const startX = e.clientX;
    
    const handleMouseMove = (e) => {
      const deltaX = e.clientX - startX;
      onResize(deltaX);
    };
    
    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [onResize, setIsResizing]);

  return (
    <div
      ref={resizerRef}
      className={`relative flex items-center justify-center w-2 cursor-col-resize group hover:bg-blue-100 transition-colors ${
        isResizing ? 'bg-blue-200' : ''
      }`}
      onMouseDown={handleMouseDown}
      style={{ minWidth: '8px' }}
    >
      {/* Visual indicator */}
      <div className={`flex flex-col space-y-1 opacity-0 group-hover:opacity-100 transition-opacity ${
        isResizing ? 'opacity-100' : ''
      }`}>
        <GripVertical className="h-4 w-4 text-gray-400" />
      </div>
      
      {/* Invisible larger hit area */}
      <div className="absolute inset-y-0 -left-2 -right-2 cursor-col-resize" />
    </div>
  );
};

// Generate unique tab identifier for session management
const getTabId = () => {
  let tabId = sessionStorage.getItem('tabId');
  if (!tabId) {
    tabId = Date.now().toString();
    sessionStorage.setItem('tabId', tabId);
  }
  return tabId;
};

const getSessionKey = (tabId) => `affidavit-session-${tabId}`;

// DocumentEditor component with resizable layout
const DocumentEditor = ({ existingDocument = null, onBack, setSessionSaved, saveSessionRef }) => {
  const { getAccessTokenSilently, loginWithRedirect, isAuthenticated, isLoading } = useAuth0();
  
  // Layout state
  const [isSmallScreen, setIsSmallScreen] = useState(window.innerWidth < 1280);
  const [activePanel, setActivePanel] = useState('chat');
  const [chatWidth, setChatWidth] = useState(42); // Default 42% for chat
  const [isResizing, setIsResizing] = useState(false);
  
  // Document state
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
  
  // Refs for API calls
  const previewRequestRef = useRef(null);
  const validationRequestRef = useRef(null);
  const previewTimeoutRef = useRef(null);
  const containerRef = useRef(null);

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
        setActivePanel('chat');
      }
    };
    
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  // Handle resizer drag
  const handleResize = useCallback((deltaX) => {
    if (!containerRef.current) return;
    
    const containerWidth = containerRef.current.offsetWidth;
    const validationWidth = 25; // Fixed 25% for validation
    const availableWidth = 100 - validationWidth; // 75% available for chat + preview
    
    // Calculate new chat width as percentage
    const pixelChange = (deltaX / containerWidth) * 100;
    const newChatWidth = Math.max(20, Math.min(65, chatWidth + pixelChange));
    
    setChatWidth(newChatWidth);
  }, [chatWidth]);

  // Calculate preview width based on chat width
  const previewWidth = 75 - chatWidth; // Total available (75%) minus chat width

  // Cleanup function
  useEffect(() => {
    return () => {
      if (previewRequestRef.current) previewRequestRef.current.abort();
      if (validationRequestRef.current) validationRequestRef.current.abort();
      if (previewTimeoutRef.current) clearTimeout(previewTimeoutRef.current);
    };
  }, []);

  // Session management
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

  // Preview generation
  const generatePreview = useCallback(async (currentAffidavitData) => {
    if (previewRequestRef.current) previewRequestRef.current.abort();
    
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

      if (abortController.signal.aborted) return;

      const data = await response.json();
      
      if (previewRequestRef.current === abortController) {
        if (data.success) {
          setPreview(data.preview);
          if (data.countyValidation) setCountyValidation(data.countyValidation);
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

  // Validation
  const validateData = useCallback(async (currentAffidavitData) => {
    if (validationRequestRef.current) validationRequestRef.current.abort();
    
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

      if (abortController.signal.aborted) return;

      if (response.ok) {
        const data = await response.json();
        if (validationRequestRef.current === abortController) {
          if (data.success) setValidation(data.validation);
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

  // Debounced preview/validation
  useEffect(() => {
    if (previewTimeoutRef.current) clearTimeout(previewTimeoutRef.current);

    previewTimeoutRef.current = setTimeout(() => {
      Promise.all([
        validateData(affidavitData),
        generatePreview(affidavitData)
      ]).catch(error => {
        console.error('Error in validation/preview generation:', error);
      });
    }, 500);

    return () => {
      if (previewTimeoutRef.current) clearTimeout(previewTimeoutRef.current);
    };
  }, [affidavitData, validateData, generatePreview]);

  // Event handlers
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
      <div className="max-w-[1800px] mx-auto px-1 sm:px-2 py-2">
        {isSmallScreen && <PanelToggle />}
        
        {/* Resizable Layout */}
        <div 
          ref={containerRef}
          className={`flex h-full ${isSmallScreen ? 'hidden' : ''}`}
          style={{ 
            height: 'calc(100vh - 100px)',
            gap: '8px'
          }}
        >
          {/* Chat Interface - Resizable */}
          <div 
            className="h-full"
            style={{ width: `${chatWidth}%` }}
          >
            <ChatInterface
              affidavitData={affidavitData}
              onDataUpdate={handleDataUpdate}
              onSaveSession={saveSession}
              documentComplete={documentComplete}
              onDocumentComplete={handleDocumentComplete}
              validation={validation}
              onValidationUpdate={setValidation}
              onDownload={() => setShowPayment(true)}
            />
          </div>

          {/* Draggable Resizer */}
          <DraggableResizer 
            onResize={handleResize}
            isResizing={isResizing}
            setIsResizing={setIsResizing}
          />

          {/* Document Preview - Resizable */}
          <div 
            className="h-full"
            style={{ width: `${previewWidth}%` }}
          >
            <DocumentPreview
              preview={preview}
              affidavitData={affidavitData}
              documentComplete={documentComplete}
              validation={validation}
              onDownload={() => setShowPayment(true)}
              isPreviewLoading={isPreviewLoading}
            />
          </div>

          {/* Validation Sidebar - Fixed 25% */}
          <div className="h-full" style={{ width: '25%' }}>
            <ValidationSidebar
              validation={validation}
              countyValidation={countyValidation}
              affidavitData={affidavitData}
            />
          </div>
        </div>

        {/* Mobile Single Panel View */}
        {isSmallScreen && (
          <div style={{ height: 'calc(100vh - 120px)' }}>
            {activePanel === 'chat' && (
              <ChatInterface
                affidavitData={affidavitData}
                onDataUpdate={handleDataUpdate}
                onSaveSession={saveSession}
                documentComplete={documentComplete}
                onDocumentComplete={handleDocumentComplete}
                validation={validation}
                onValidationUpdate={setValidation}
                onDownload={() => setShowPayment(true)}
              />
            )}
            {activePanel === 'preview' && (
              <DocumentPreview
                preview={preview}
                affidavitData={affidavitData}
                documentComplete={documentComplete}
                validation={validation}
                onDownload={() => setShowPayment(true)}
                isPreviewLoading={isPreviewLoading}
              />
            )}
            {activePanel === 'validation' && (
              <ValidationSidebar
                validation={validation}
                countyValidation={countyValidation}
                affidavitData={affidavitData}
              />
            )}
          </div>
        )}
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