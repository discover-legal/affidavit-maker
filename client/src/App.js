// client/src/App.js - Updated with all requested fixes
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Auth0Provider, useAuth0 } from '@auth0/auth0-react';
import { 
  MessageCircle, FileText, Users, Download, Plus, Edit3, 
  Trash2, Calendar, ChevronRight, Menu, X, Settings, 
  LogOut, Home, GripVertical, RotateCcw, Save, CheckCircle,
  AlertTriangle, Loader, Eye, CreditCard, Star, Trophy,
  HelpCircle, Mail, User, Building, Gavel
} from 'lucide-react';
import ErrorBoundary from './components/ErrorBoundary';
import ChatInterface from './components/ChatInterface';
import DocumentPreview from './components/DocumentPreview';
import ValidationSidebar from './components/ValidationSidebar';

// Auth0 Configuration
const AUTH0_DOMAIN = process.env.REACT_APP_AUTH0_DOMAIN;
const AUTH0_CLIENT_ID = process.env.REACT_APP_AUTH0_CLIENT_ID;
const AUTH0_AUDIENCE = process.env.REACT_APP_AUTH0_AUDIENCE;

// API Configuration
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

// Resizer component for the split panel
const Resizer = ({ onResize, isResizing, setIsResizing }) => {
  const [startX, setStartX] = useState(0);
  const [startWidth, setStartWidth] = useState(0);

  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    setIsResizing(true);
    setStartX(e.clientX);
    setStartWidth(42); // Starting width percentage
  }, [setIsResizing]);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizing) return;
      
      const deltaX = e.clientX - startX;
      const containerWidth = window.innerWidth;
      const deltaPercent = (deltaX / containerWidth) * 100;
      const newWidth = Math.max(25, Math.min(65, startWidth + deltaPercent));
      
      onResize(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, startX, startWidth, onResize]);

  return (
    <div
      className={`group w-2 bg-gray-200 hover:bg-blue-200 cursor-col-resize transition-colors ${
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
  
  // Document state - ALWAYS START FRESH when clicking "Get Started"
  const [affidavitData, setAffidavitData] = useState(() => {
    if (existingDocument) {
      return {
        ...existingDocument.content,
        documentId: existingDocument.id
      };
    }
    // Always start fresh for new documents
    return {
      state: '',
      affiantName: '',
      caseNumber: '',
      caseType: '',
      county: '',
      documentType: 'general',
      facts: [],
      documentId: null
    };
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
  const [saveStatus, setSaveStatus] = useState('idle'); // idle, saving, saved, error
  
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
  }, [isLoading, isAuthenticated, loginWithRedirect]);

  // Handle responsive layout
  useEffect(() => {
    const handleResize = () => {
      setIsSmallScreen(window.innerWidth < 1280);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Session management - only for existing documents or resume
  useEffect(() => {
    let mounted = true;

    const loadSession = async () => {
      if (!isAuthenticated || existingDocument) {
        setSessionLoading(false);
        return;
      }

      try {
        const tabId = getTabId();
        const sessionKey = getSessionKey(tabId);
        const savedSession = localStorage.getItem(sessionKey);

        if (savedSession && mounted) {
          const sessionData = JSON.parse(savedSession);
          if (sessionData.timestamp && Date.now() - sessionData.timestamp < 24 * 60 * 60 * 1000) {
            setSavedSessionData(sessionData);
            setShowResumeModal(true);
          } else {
            localStorage.removeItem(sessionKey);
          }
        }
      } catch (error) {
        console.error('Error loading session:', error);
      } finally {
        if (mounted) {
          setSessionLoading(false);
        }
      }
    };

    loadSession();
    return () => { mounted = false; };
  }, [isAuthenticated, existingDocument]);

  // Auto-save functionality with improved status
  const saveSession = useCallback(async (data = affidavitData, force = false) => {
    if (!isAuthenticated || existingDocument) return;

    const hasContent = data.affiantName || data.state || (data.facts && data.facts.length > 0);
    if (!hasContent && !force) return;

    try {
      setSaveStatus('saving');
      const tabId = getTabId();
      const sessionKey = getSessionKey(tabId);
      
      const sessionData = {
        affidavitData: data,
        timestamp: Date.now(),
        lastSaved: new Date().toISOString()
      };

      localStorage.setItem(sessionKey, JSON.stringify(sessionData));
      
      if (setSessionSaved) {
        setSessionSaved(true);
      }
      
      setSaveStatus('saved');
      
      // Reset to idle after showing saved status
      setTimeout(() => setSaveStatus('idle'), 2000);
      
    } catch (error) {
      console.error('Error saving session:', error);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  }, [affidavitData, isAuthenticated, existingDocument, setSessionSaved]);

  // Expose save function through ref
  useEffect(() => {
    if (saveSessionRef) {
      saveSessionRef.current = saveSession;
    }
  }, [saveSession, saveSessionRef]);

  // Auto-save on data changes
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      saveSession();
    }, 3000);

    return () => clearTimeout(timeoutId);
  }, [affidavitData, saveSession]);

  // County validation with state-specific logic
  const validateCounty = useCallback(async (county, state) => {
    if (!county || !state) {
      setCountyValidation(null);
      return;
    }

    // Only validate for states that require counties
    const statesRequiringCounty = ['TX', 'UT', 'Texas', 'Utah'];
    if (!statesRequiringCounty.includes(state)) {
      setCountyValidation(null);
      return;
    }

    try {
      const token = await getAccessTokenSilently();
      const response = await fetch(`${API_BASE_URL}/api/validate-county`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ county, state })
      });

      if (response.ok) {
        const result = await response.json();
        setCountyValidation(result);
      } else {
        console.error('County validation failed:', response.statusText);
        setCountyValidation(null);
      }
    } catch (error) {
      console.error('County validation error:', error);
      setCountyValidation(null);
    }
  }, [getAccessTokenSilently]);

  // Trigger county validation when county or state changes
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      validateCounty(affidavitData.county, affidavitData.state);
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [affidavitData.county, affidavitData.state, validateCounty]);

  // Generate preview with debouncing
  const generatePreview = useCallback(async (data = affidavitData) => {
    if (previewRequestRef.current) {
      previewRequestRef.current.abort();
    }

    if (!data.affiantName && !data.state && (!data.facts || data.facts.length === 0)) {
      setPreview(null);
      return;
    }

    const controller = new AbortController();
    previewRequestRef.current = controller;

    try {
      setIsPreviewLoading(true);
      
      const response = await fetch(`${API_BASE_URL}/api/preview`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(isAuthenticated ? { 'Authorization': `Bearer ${await getAccessTokenSilently()}` } : {})
        },
        body: JSON.stringify({ affidavitData: data }),
        signal: controller.signal
      });

      if (response.ok) {
        const result = await response.json();
        if (!controller.signal.aborted) {
          setPreview(result.preview);
        }
      } else {
        console.error('Preview generation failed:', response.statusText);
        if (!controller.signal.aborted) {
          setPreview(null);
        }
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Preview generation error:', error);
        setPreview(null);
      }
    } finally {
      if (!controller.signal.aborted) {
        setIsPreviewLoading(false);
      }
    }
  }, [affidavitData, isAuthenticated, getAccessTokenSilently]);

  // Debounced preview generation
  useEffect(() => {
    if (previewTimeoutRef.current) {
      clearTimeout(previewTimeoutRef.current);
    }

    previewTimeoutRef.current = setTimeout(() => {
      generatePreview();
    }, 1000);

    return () => {
      if (previewTimeoutRef.current) {
        clearTimeout(previewTimeoutRef.current);
      }
    };
  }, [generatePreview]);

  // Handle data updates from chat
  const handleDataUpdate = useCallback((updates) => {
    setAffidavitData(prevData => {
      const newData = { ...prevData, ...updates };
      
      // Auto-save when document becomes complete
      const isComplete = newData.affiantName && newData.state && newData.facts && newData.facts.length > 0;
      if (isComplete && !documentComplete) {
        setDocumentComplete(true);
      }
      
      return newData;
    });
  }, [documentComplete]);

  // Resume session handler
  const handleResumeSession = () => {
    if (savedSessionData) {
      setAffidavitData(savedSessionData.affidavitData);
      setShowResumeModal(false);
      setSavedSessionData(null);
    }
  };

  // Start fresh handler
  const handleStartFresh = () => {
    try {
      const tabId = getTabId();
      const sessionKey = getSessionKey(tabId);
      localStorage.removeItem(sessionKey);
    } catch (error) {
      console.error('Error clearing session:', error);
    }
    
    setShowResumeModal(false);
    setSavedSessionData(null);
    // Data is already fresh from initial state
  };

  // Payment handler with updated pricing
  const handlePayment = async () => {
    try {
      const token = await getAccessTokenSilently();
      const response = await fetch(`${API_BASE_URL}/api/payment/create-intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          documentType: 'single_affidavit',
          documentId: affidavitData.documentId || 'new'
        })
      });

      if (response.ok) {
        const result = await response.json();
        // Handle payment with Stripe - implementation depends on your payment component
        setShowPayment(true);
      } else {
        console.error('Payment creation failed:', response.statusText);
      }
    } catch (error) {
      console.error('Payment error:', error);
    }
  };

  // Loading states
  if (isLoading || sessionLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Loading Discover.Legal...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Gavel className="h-16 w-16 mx-auto mb-4 text-blue-600" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Discover.Legal</h1>
          <p className="text-gray-600 mb-4">Professional Affidavit Creation</p>
          <Loader className="h-6 w-6 animate-spin mx-auto text-blue-600" />
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      {/* Resume Session Modal */}
      {showResumeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4">Resume Previous Session?</h3>
            <p className="text-gray-600 mb-6">
              We found a saved session from {new Date(savedSessionData?.timestamp).toLocaleDateString()}. 
              Would you like to continue where you left off?
            </p>
            <div className="flex space-x-3">
              <button
                onClick={handleResumeSession}
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
              >
                Resume
              </button>
              <button
                onClick={handleStartFresh}
                className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400"
              >
                Start Fresh
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header with save status */}
      <div className="bg-white border-b px-4 py-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={onBack}
              className="text-gray-600 hover:text-gray-900 flex items-center space-x-1"
            >
              <Home className="h-5 w-5" />
              <span>Dashboard</span>
            </button>
            <div className="text-gray-300">|</div>
            <h1 className="text-lg font-semibold text-gray-900">
              {existingDocument ? `Edit: ${existingDocument.title}` : 'New Affidavit'}
            </h1>
          </div>
          
          <div className="flex items-center space-x-4">
            {/* Save Status Indicator */}
            <div className="flex items-center space-x-2 text-sm">
              {saveStatus === 'saving' && (
                <>
                  <Loader className="h-4 w-4 animate-spin text-blue-600" />
                  <span className="text-gray-600">Saving...</span>
                </>
              )}
              {saveStatus === 'saved' && (
                <>
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-green-600">Saved</span>
                </>
              )}
              {saveStatus === 'error' && (
                <>
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  <span className="text-red-600">Save failed</span>
                </>
              )}
            </div>

            {/* Mobile panel switcher */}
            {isSmallScreen && (
              <div className="flex bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setActivePanel('chat')}
                  className={`px-3 py-1 rounded text-sm ${
                    activePanel === 'chat' ? 'bg-white shadow-sm' : 'text-gray-600'
                  }`}
                >
                  Chat
                </button>
                <button
                  onClick={() => setActivePanel('preview')}
                  className={`px-3 py-1 rounded text-sm ${
                    activePanel === 'preview' ? 'bg-white shadow-sm' : 'text-gray-600'
                  }`}
                >
                  Preview
                </button>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex items-center space-x-2">
              {documentComplete && (
                <button
                  onClick={handlePayment}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center space-x-1"
                >
                  <CreditCard className="h-4 w-4" />
                  <span>Complete - $39.99</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area - Fixed height calculation */}
      <div 
        ref={containerRef}
        className="flex-1 flex overflow-hidden"
        style={{ height: 'calc(100vh - 73px)' }} // Fixed header height
      >
        {isSmallScreen ? (
          // Mobile layout
          <div className="w-full">
            {activePanel === 'chat' && (
              <div className="h-full flex">
                <div className="flex-1">
                  <ChatInterface
                    affidavitData={affidavitData}
                    onDataUpdate={handleDataUpdate}
                    isComplete={documentComplete}
                    onComplete={() => setDocumentComplete(true)}
                  />
                </div>
                <ValidationSidebar
                  validation={validation}
                  countyValidation={countyValidation}
                  affidavitData={affidavitData}
                />
              </div>
            )}
            {activePanel === 'preview' && (
              <DocumentPreview
                affidavitData={affidavitData}
                preview={preview}
                isLoading={isPreviewLoading}
              />
            )}
          </div>
        ) : (
          // Desktop layout with resizable panels
          <>
            {/* Chat Panel */}
            <div 
              className="bg-white border-r flex flex-col"
              style={{ width: `${chatWidth}%` }}
            >
              <div className="flex-1 flex">
                <div className="flex-1">
                  <ChatInterface
                    affidavitData={affidavitData}
                    onDataUpdate={handleDataUpdate}
                    isComplete={documentComplete}
                    onComplete={() => setDocumentComplete(true)}
                  />
                </div>
                <ValidationSidebar
                  validation={validation}
                  countyValidation={countyValidation}
                  affidavitData={affidavitData}
                />
              </div>
            </div>

            {/* Resizer */}
            <Resizer
              onResize={setChatWidth}
              isResizing={isResizing}
              setIsResizing={setIsResizing}
            />

            {/* Preview Panel */}
            <div 
              className="bg-gray-50 flex flex-col"
              style={{ width: `${100 - chatWidth}%` }}
            >
              <DocumentPreview
                affidavitData={affidavitData}
                preview={preview}
                isLoading={isPreviewLoading}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// Dashboard component with brand updates
const Dashboard = ({ onCreateNew, onOpenDocument }) => {
  const { getAccessTokenSilently, logout, user } = useAuth0();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    try {
      setLoading(true);
      const token = await getAccessTokenSilently();
      const response = await fetch(`${API_BASE_URL}/api/documents`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const result = await response.json();
        setDocuments(result.documents || []);
      } else {
        setError('Failed to load documents');
      }
    } catch (err) {
      setError('Failed to load documents');
      console.error('Load documents error:', err);
    } finally {
      setLoading(false);
    }
  };

  const deleteDocument = async (documentId) => {
    if (!window.confirm('Are you sure you want to delete this document?')) {
      return;
    }

    try {
      const token = await getAccessTokenSilently();
      const response = await fetch(`${API_BASE_URL}/api/documents/${documentId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        setDocuments(prev => prev.filter(doc => doc.id !== documentId));
      } else {
        console.error('Delete failed:', response.statusText);
      }
    } catch (error) {
      console.error('Delete error:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Loading your documents...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-3">
              <Gavel className="h-8 w-8 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Discover.Legal</h1>
                <p className="text-sm text-gray-600">Professional Affidavit Creation</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-600">
                Welcome, {user?.name || user?.email}
              </div>
              <button
                onClick={() => logout({ returnTo: window.location.origin })}
                className="flex items-center space-x-1 text-gray-600 hover:text-gray-900"
              >
                <LogOut className="h-4 w-4" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Get Started Section */}
        <div className="mb-8">
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold mb-2">Create New Affidavit</h2>
                <p className="text-blue-100 mb-4">
                  Generate professional affidavits for Texas, Utah, and Arizona. $39.99 per document.
                </p>
                <button
                  onClick={onCreateNew}
                  className="bg-white text-blue-600 px-6 py-2 rounded-lg hover:bg-gray-50 flex items-center space-x-2 font-medium"
                >
                  <Plus className="h-5 w-5" />
                  <span>Get Started</span>
                </button>
              </div>
              <div className="hidden md:block">
                <FileText className="h-24 w-24 text-blue-300" />
              </div>
            </div>
          </div>
        </div>

        {/* Documents List */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Your Documents</h3>
            <div className="text-sm text-gray-600">
              {documents.length} document{documents.length !== 1 ? 's' : ''}
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                <span className="text-red-800">{error}</span>
              </div>
            </div>
          )}

          {documents.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No documents yet</h3>
              <p className="text-gray-600 mb-6">
                Create your first affidavit to get started with Discover.Legal
              </p>
              <button
                onClick={onCreateNew}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 flex items-center space-x-2 mx-auto"
              >
                <Plus className="h-5 w-5" />
                <span>Create First Affidavit</span>
              </button>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {documents.map((doc) => (
                <div key={doc.id} className="bg-white rounded-lg border p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center space-x-2">
                      <FileText className="h-5 w-5 text-blue-600" />
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        doc.status === 'completed' ? 'bg-green-100 text-green-800' :
                        doc.status === 'paid' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {doc.status === 'paid' ? 'Ready to Download' : 
                         doc.status === 'completed' ? 'Completed' : 'Draft'}
                      </span>
                    </div>
                    <button
                      onClick={() => deleteDocument(doc.id)}
                      className="text-gray-400 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  
                  <h4 className="font-medium text-gray-900 mb-2 truncate">
                    {doc.title || `${doc.content?.state || 'Unknown'} Affidavit`}
                  </h4>
                  
                  <div className="text-sm text-gray-600 space-y-1 mb-4">
                    <div className="flex items-center space-x-1">
                      <User className="h-3 w-3" />
                      <span>{doc.content?.affiantName || 'No name set'}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Calendar className="h-3 w-3" />
                      <span>{new Date(doc.updated_at).toLocaleDateString()}</span>
                    </div>
                    {doc.content?.state && (
                      <div className="flex items-center space-x-1">
                        <Building className="h-3 w-3" />
                        <span>{doc.content.state}</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex space-x-2">
                    <button
                      onClick={() => onOpenDocument(doc)}
                      className="flex-1 bg-blue-50 text-blue-600 px-3 py-2 rounded text-sm hover:bg-blue-100 flex items-center justify-center space-x-1"
                    >
                      <Edit3 className="h-4 w-4" />
                      <span>Edit</span>
                    </button>
                    {doc.status === 'paid' && (
                      <button
                        onClick={() => window.open(`${API_BASE_URL}/api/download/${doc.id}`, '_blank')}
                        className="flex-1 bg-green-50 text-green-600 px-3 py-2 rounded text-sm hover:bg-green-100 flex items-center justify-center space-x-1"
                      >
                        <Download className="h-4 w-4" />
                        <span>Download</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-16 pt-8 border-t border-gray-200">
          <div className="text-center text-sm text-gray-600">
            <div className="flex items-center justify-center space-x-4 mb-4">
              <a href="https://discover.legal" className="hover:text-blue-600">Visit Discover.Legal</a>
              <span>•</span>
              <a href="mailto:support@discover.legal" className="hover:text-blue-600 flex items-center space-x-1">
                <Mail className="h-4 w-4" />
                <span>Support</span>
              </a>
              <span>•</span>
              <a href="#" className="hover:text-blue-600 flex items-center space-x-1">
                <HelpCircle className="h-4 w-4" />
                <span>Help</span>
              </a>
            </div>
            <p>© 2025 Discover.Legal. Professional legal document creation.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

// Main App component
const App = () => {
  const [currentView, setCurrentView] = useState('dashboard');
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [sessionSaved, setSessionSaved] = useState(false);
  const saveSessionRef = useRef();

  // Handle creating new document - always start fresh
  const handleCreateNew = () => {
    setSelectedDocument(null); // Ensure we start fresh
    setCurrentView('editor');
  };

  // Handle opening existing document
  const handleOpenDocument = (document) => {
    setSelectedDocument(document);
    setCurrentView('editor');
  };

  // Handle returning to dashboard
  const handleBackToDashboard = () => {
    // Save current session before going back
    if (saveSessionRef.current && currentView === 'editor' && !selectedDocument) {
      saveSessionRef.current(undefined, true);
    }
    
    setCurrentView('dashboard');
    setSelectedDocument(null);
    setSessionSaved(false);
  };

  // Render current view
  const renderCurrentView = () => {
    switch (currentView) {
      case 'editor':
        return (
          <DocumentEditor
            existingDocument={selectedDocument}
            onBack={handleBackToDashboard}
            setSessionSaved={setSessionSaved}
            saveSessionRef={saveSessionRef}
          />
        );
      case 'dashboard':
      default:
        return (
          <Dashboard
            onCreateNew={handleCreateNew}
            onOpenDocument={handleOpenDocument}
          />
        );
    }
  };

  return (
    <ErrorBoundary>
      <Auth0Provider
        domain={AUTH0_DOMAIN}
        clientId={AUTH0_CLIENT_ID}
        authorizationParams={{
          redirect_uri: window.location.origin,
          audience: AUTH0_AUDIENCE,
        }}
      >
        <div className="App">
          {renderCurrentView()}
        </div>
      </Auth0Provider>
    </ErrorBoundary>
  );
};

export default App;
                