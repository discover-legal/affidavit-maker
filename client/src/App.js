import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, FileText, Download, AlertCircle, Loader2, CreditCard, 
  Lock, CheckCircle, Menu, X, Home, FileBox, Settings, LogOut,
  Star, Users, Shield, Zap, ChevronRight, Eye, EyeOff, Scale, Clock, ArrowLeft,
  AlertTriangle, Info
} from 'lucide-react';
import { Auth0Provider, useAuth0 } from '@auth0/auth0-react';

// Generate unique tab identifier for session management
const getTabId = () => {
  let tabId = sessionStorage.getItem('tabId');
  if (!tabId) {
    tabId = Date.now().toString();
    sessionStorage.setItem('tabId', tabId);
  }
  return tabId;
};

// Enhanced Landing Page
const LandingPage = ({ onGetStarted }) => {
  const { loginWithRedirect, isAuthenticated, user } = useAuth0();

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <nav className="absolute top-0 right-0 p-6">
        {isAuthenticated ? (
          <button
            onClick={onGetStarted}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
          >
            Go to Dashboard
          </button>
        ) : (
          <button
            onClick={() => loginWithRedirect()}
            className="text-gray-700 hover:text-gray-900 font-medium"
          >
            Sign In
          </button>
        )}
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
        <div className="text-center">
          <h1 className="text-5xl font-bold text-gray-900 mb-6">
            Create Legal Affidavits in Minutes
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            AI-powered document preparation with state-specific templates. 
            Professional affidavits for Texas, Utah, and Arizona.
          </p>
          <button
            onClick={onGetStarted}
            className="inline-flex items-center px-8 py-4 bg-blue-600 text-white text-lg font-semibold rounded-lg hover:bg-blue-700 transition-colors"
          >
            Get Started Free
            <ChevronRight className="ml-2 h-5 w-5" />
          </button>
          <p className="mt-4 text-sm text-gray-500">
            No credit card required for your first document
          </p>
        </div>
      </div>

      <div className="bg-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="flex justify-center mb-4">
                <Zap className="h-12 w-12 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Fast & Easy</h3>
              <p className="text-gray-600">
                AI guides you through state-specific requirements. 
                Complete documents in under 10 minutes.
              </p>
            </div>
            <div className="text-center">
              <div className="flex justify-center mb-4">
                <Shield className="h-12 w-12 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold mb-2">State-Compliant Templates</h3>
              <p className="text-gray-600">
                Built-in templates ensure compliance with Texas, Utah, 
                and Arizona legal requirements.
              </p>
            </div>
            <div className="text-center">
              <div className="flex justify-center mb-4">
                <Scale className="h-12 w-12 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Professional Quality</h3>
              <p className="text-gray-600">
                Court-ready documents with proper formatting, 
                notary blocks, and legal language.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// State Selector Component
const StateSelector = ({ selectedState, onStateChange, states = [] }) => {
  return (
    <div className="mb-6">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Select Your State
      </label>
      <select
        value={selectedState}
        onChange={(e) => onStateChange(e.target.value)}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="">Choose a state...</option>
        {states.map(state => (
          <option key={state.code} value={state.code}>
            {state.name}
          </option>
        ))}
      </select>
      {selectedState && (
        <p className="mt-2 text-sm text-blue-600">
          Using {states.find(s => s.code === selectedState)?.name} legal requirements
        </p>
      )}
    </div>
  );
};

// Validation Display Component
const ValidationDisplay = ({ validation }) => {
  if (!validation) return null;

  return (
    <div className="mb-4">
      {validation.errors && validation.errors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-3">
          <div className="flex items-center mb-2">
            <AlertTriangle className="h-5 w-5 text-red-600 mr-2" />
            <h4 className="text-red-800 font-medium">Validation Errors</h4>
          </div>
          <ul className="text-red-700 text-sm">
            {validation.errors.map((error, index) => (
              <li key={index}>• {error}</li>
            ))}
          </ul>
        </div>
      )}
      
      {validation.warnings && validation.warnings.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-3">
          <div className="flex items-center mb-2">
            <AlertCircle className="h-5 w-5 text-yellow-600 mr-2" />
            <h4 className="text-yellow-800 font-medium">Warnings</h4>
          </div>
          <ul className="text-yellow-700 text-sm">
            {validation.warnings.map((warning, index) => (
              <li key={index}>• {warning}</li>
            ))}
          </ul>
        </div>
      )}
      
      {validation.isValid && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center">
            <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
            <span className="text-green-800 font-medium">All requirements met!</span>
          </div>
        </div>
      )}
    </div>
  );
};

// Enhanced User Dashboard
const UserDashboard = ({ onNewDocument, onContinueDocument }) => {
  const { user, logout, getAccessTokenSilently, loginWithRedirect } = useAuth0();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [supportedStates, setSupportedStates] = useState([]);

  useEffect(() => {
    fetchDocuments();
    fetchSupportedStates();
  }, []);

  const fetchDocuments = async () => {
    try {
      const token = await getAccessTokenSilently();
      const response = await fetch('http://localhost:3001/api/documents', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (data.success) {
        setDocuments(data.documents);
      }
    } catch (error) {
      if (error.error === 'login_required') {
        loginWithRedirect();
      }
      console.error('Failed to fetch documents:', error);
    }
    setLoading(false);
  };

  const fetchSupportedStates = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/templates/states');
      const data = await response.json();
      if (data.success) {
        setSupportedStates(data.states);
      }
    } catch (error) {
      console.error('Failed to fetch states:', error);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'draft':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Scale className="h-8 w-8 text-blue-600 mr-3" />
              <h1 className="text-xl font-semibold text-gray-900">Affidavit Pro</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-700">Welcome, {user?.name}</span>
              <button
                onClick={() => logout({ returnTo: window.location.origin })}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Your Documents</h2>
          <p className="text-gray-600">
            Create new affidavits or continue working on drafts. 
            Supported states: {supportedStates.map(s => s.name).join(', ')}
          </p>
        </div>

        <div className="mb-8">
          <button
            onClick={onNewDocument}
            className="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            <FileText className="h-5 w-5 mr-2" />
            Create New Affidavit
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        ) : (
          <>
            {/* Action Cards Grid - Always Visible */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-white rounded-lg shadow-sm border-2 border-dashed border-blue-200 p-6">
                <div className="flex items-start justify-between mb-4">
                  <FileText className="h-8 w-8 text-blue-600" />
                  <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                    start here
                  </span>
                </div>
                <h3 className="font-medium text-gray-900 mb-2">Create New Affidavit</h3>
                <div className="text-sm text-gray-600 mb-4 space-y-1">
                  <p>✓ State-compliant format</p>
                  <p>✓ AI-guided process</p>
                  <p>✓ Professional quality</p>
                </div>
                <button
                  onClick={onNewDocument}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Get Started
                </button>
              </div>

              <div className="bg-white rounded-lg shadow-sm border p-6 border-dashed border-gray-300 opacity-70">
                <div className="flex items-start justify-between mb-4">
                  <FileText className="h-8 w-8 text-gray-400" />
                  <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-600">
                    coming soon
                  </span>
                </div>
                <h3 className="font-medium text-gray-600 mb-2">Document Templates</h3>
                <div className="text-sm text-gray-500 mb-4 space-y-1">
                  <p>Pre-filled forms</p>
                  <p>Attorney-reviewed</p>
                  <p>Save time & effort</p>
                </div>
                <div className="w-full px-4 py-2 bg-gray-50 text-gray-500 rounded-lg text-center">
                  Future Update
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm border p-6 border-dashed border-gray-300 opacity-50">
                <div className="flex items-start justify-between mb-4">
                  <FileText className="h-8 w-8 text-gray-300" />
                  <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-50 text-gray-500">
                    roadmap
                  </span>
                </div>
                <h3 className="font-medium text-gray-500 mb-2">Smart Forms</h3>
                <div className="text-sm text-gray-400 mb-4 space-y-1">
                  <p>Auto-fill from previous</p>
                  <p>Family case tracking</p>
                  <p>Multi-document suites</p>
                </div>
                <div className="w-full px-4 py-2 bg-gray-50 text-gray-400 rounded-lg text-center">
                  In Development
                </div>
              </div>
            </div>

            {/* Documents Section */}
            <div className="bg-white rounded-lg shadow-sm border">
              <div className="px-6 py-4 border-b bg-gray-50 rounded-t-lg">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">Your Documents</h3>
                  {documents.length > 0 && (
                    <span className="text-sm text-gray-600">{documents.length} document{documents.length !== 1 ? 's' : ''}</span>
                  )}
                </div>
              </div>
              
              <div className="p-6">
                {documents.length > 0 ? (
                  <div className="space-y-3">
                    {documents.map(doc => (
                      <div key={doc.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                        <div className="flex items-center space-x-4 flex-1">
                          <FileText className="h-6 w-6 text-blue-600 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-gray-900 truncate">
                              {doc.affiantName ? `${doc.affiantName}'s Affidavit` : `Affidavit #${doc.id}`}
                            </h4>
                            <div className="flex items-center space-x-4 text-sm text-gray-600 mt-1">
                              {doc.state && (
                                <span>{supportedStates.find(s => s.code === doc.state)?.name || doc.state}</span>
                              )}
                              {doc.documentType && (
                                <span className="capitalize">{doc.documentType.replace('_', ' ')}</span>
                              )}
                              <span>{new Date(doc.created_at).toLocaleDateString()}</span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-3">
                          {doc.validation && !doc.validation.isValid && (
                            <div className="flex items-center text-red-600">
                              <AlertTriangle className="h-4 w-4 mr-1" />
                              <span className="text-xs">Needs attention</span>
                            </div>
                          )}
                          
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(doc.status)}`}>
                            {doc.status}
                          </span>
                          
                          <button
                            onClick={() => onContinueDocument(doc)}
                            className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                          >
                            {doc.status === 'completed' ? 'View' : 'Continue'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <h4 className="text-lg font-medium text-gray-900 mb-2">No documents yet</h4>
                    <p className="text-gray-600 mb-4">
                      Your completed affidavits will appear here. Each document is securely saved and can be downloaded anytime.
                    </p>
                    <p className="text-sm text-gray-500">
                      Click "Get Started" above to create your first family law affidavit.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Info/Stats Section */}
            {documents.length === 0 ? (
              <div className="mt-8 text-center">
                <div className="max-w-2xl mx-auto">
                  <h4 className="text-lg font-medium text-gray-900 mb-6">How It Works</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
                    <div className="flex flex-col items-center">
                      <div className="bg-blue-50 rounded-full w-12 h-12 flex items-center justify-center mb-3">
                        <span className="text-blue-600 font-semibold">1</span>
                      </div>
                      <h5 className="font-medium text-gray-900 mb-1">Choose Your State</h5>
                      <p className="text-gray-600 text-center">Tell us whether your case is in Texas, Utah, or Arizona</p>
                    </div>
                    <div className="flex flex-col items-center">
                      <div className="bg-blue-50 rounded-full w-12 h-12 flex items-center justify-center mb-3">
                        <span className="text-blue-600 font-semibold">2</span>
                      </div>
                      <h5 className="font-medium text-gray-900 mb-1">Chat with AI</h5>
                      <p className="text-gray-600 text-center">Our AI asks simple questions to gather the facts for your case</p>
                    </div>
                    <div className="flex flex-col items-center">
                      <div className="bg-blue-50 rounded-full w-12 h-12 flex items-center justify-center mb-3">
                        <span className="text-blue-600 font-semibold">3</span>
                      </div>
                      <h5 className="font-medium text-gray-900 mb-1">Download PDF</h5>
                      <p className="text-gray-600 text-center">Get a professional, court-ready affidavit formatted for your state</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-6 bg-gray-50 rounded-lg p-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-gray-900">{documents.length}</div>
                    <div className="text-sm text-gray-600">Total Documents</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-green-600">
                      {documents.filter(d => d.status === 'completed').length}
                    </div>
                    <div className="text-sm text-gray-600">Completed</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-yellow-600">
                      {documents.filter(d => d.status === 'draft').length}
                    </div>
                    <div className="text-sm text-gray-600">In Progress</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-blue-600">
                      {[...new Set(documents.map(d => d.template_state))].filter(Boolean).length}
                    </div>
                    <div className="text-sm text-gray-600">States Used</div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};

// Enhanced Resume Modal
const ResumeModal = ({ isOpen, onClose, onResume, onStartFresh }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md mx-4">
        <div className="flex items-center mb-4">
          <Clock className="h-6 w-6 text-blue-600 mr-2" />
          <h3 className="text-lg font-semibold">Resume Previous Session?</h3>
        </div>
        <p className="text-gray-600 mb-6">
          We found a previous session from this browser. Would you like to continue where you left off or start fresh?
        </p>
        <div className="flex space-x-3">
          <button
            onClick={onResume}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Resume Session
          </button>
          <button
            onClick={onStartFresh}
            className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
          >
            Start Fresh
          </button>
        </div>
      </div>
    </div>
  );
};

// Payment Modal Component
const PaymentModal = ({ isOpen, onClose, affidavitData, onPaymentSuccess }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Download Affidavit</h3>
          <button onClick={onClose}>
            <X className="h-6 w-6 text-gray-400" />
          </button>
        </div>
        <div className="mb-6">
          <div className="flex items-center justify-between py-2">
            <span>Professional Affidavit</span>
            <span className="font-semibold">$9.99</span>
          </div>
          <div className="border-t pt-2">
            <div className="flex items-center justify-between font-semibold">
              <span>Total</span>
              <span>$9.99</span>
            </div>
          </div>
        </div>
        <button
          onClick={onPaymentSuccess}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center"
        >
          <CreditCard className="h-4 w-4 mr-2" />
          Complete Payment
        </button>
      </div>
    </div>
  );
};

// Enhanced Document Editor with Template Integration
const DocumentEditor = ({ existingDocument = null, onBack }) => {
  const { getAccessTokenSilently, loginWithRedirect } = useAuth0();
  const [messages, setMessages] = useState([{
    id: 1,
    type: 'bot',
    content: existingDocument 
      ? "Welcome back! I see you were working on an affidavit. Let's continue where you left off."
      : "Hi! I'm here to help you create a professional family law affidavit. I can help with divorce, custody, child support, and other family law matters in Texas, Utah, or Arizona. To get started, which state is your case in?"
  }]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState('');
  const [showPreview, setShowPreview] = useState(true);
  const [documentComplete, setDocumentComplete] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [sessionSaved, setSessionSaved] = useState(false);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [showResumeModal, setShowResumeModal] = useState(false);
  const [savedSessionData, setSavedSessionData] = useState(null);
  const [supportedStates, setSupportedStates] = useState([]);
  const [documentTypes, setDocumentTypes] = useState([]);
  const [validation, setValidation] = useState(null);
  const [preview, setPreview] = useState(null);
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
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  // Fetch template data on mount
  useEffect(() => {
    fetchTemplateData();
  }, []);

  // Load session from localStorage with tab isolation
  useEffect(() => {
    if (!existingDocument) {
      const tabId = getTabId();
      const sessionKey = `affidavit-session-${tabId}`;
      const savedSession = localStorage.getItem(sessionKey);
      
      if (savedSession) {
        try {
          const sessionData = JSON.parse(savedSession);
          const sessionAge = new Date() - new Date(sessionData.timestamp);
          if (sessionAge < 24 * 60 * 60 * 1000) {
            setSavedSessionData(sessionData);
            setShowResumeModal(true);
          }
        } catch (e) {
          console.error('Failed to load session:', e);
          localStorage.removeItem(sessionKey);
        }
      }
    }
    setSessionLoading(false);
  }, [existingDocument]);

  // Generate preview when affidavit data changes
  useEffect(() => {
    if (affidavitData.state && affidavitData.affiantName) {
      generatePreview();
    }
  }, [affidavitData]);

  // Validate data when state or affiantName changes
  useEffect(() => {
    if (affidavitData.state) {
      validateData();
    }
  }, [affidavitData.state, affidavitData.affiantName, affidavitData.facts]);

  const fetchTemplateData = async () => {
    try {
      const [statesResponse, typesResponse] = await Promise.all([
        fetch('http://localhost:3001/api/templates/states'),
        fetch('http://localhost:3001/api/templates/document-types')
      ]);
      
      const statesData = await statesResponse.json();
      const typesData = await typesResponse.json();
      
      if (statesData.success) setSupportedStates(statesData.states);
      if (typesData.success) setDocumentTypes(typesData.documentTypes);
    } catch (error) {
      console.error('Failed to fetch template data:', error);
    }
  };

  const validateData = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/templates/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          affidavitData,
          state: affidavitData.state
        })
      });
      
      const data = await response.json();
      if (data.success) {
        setValidation(data.validation);
      }
    } catch (error) {
      console.error('Validation error:', error);
    }
  };

  const generatePreview = async () => {
    try {
      const token = await getAccessTokenSilently();
      const response = await fetch('http://localhost:3001/api/preview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ affidavitData })
      });
      
      const data = await response.json();
      if (data.success) {
        setPreview(data.preview);
      }
    } catch (error) {
      if (error.error === 'login_required') {
        loginWithRedirect();
      }
      console.error('Preview generation error:', error);
    }
  };

  const handleResumeDecision = (resume) => {
    if (resume && savedSessionData) {
      setMessages(savedSessionData.messages);
      setAffidavitData(savedSessionData.affidavitData);
      setDocumentComplete(savedSessionData.documentComplete);
    } else {
      const tabId = getTabId();
      const sessionKey = `affidavit-session-${tabId}`;
      localStorage.removeItem(sessionKey);
    }
    setShowResumeModal(false);
    setSavedSessionData(null);
  };

  const saveSession = async () => {
    const sessionData = {
      messages,
      affidavitData,
      documentComplete,
      timestamp: new Date().toISOString()
    };
    
    const tabId = getTabId();
    const sessionKey = `affidavit-session-${tabId}`;
    localStorage.setItem(sessionKey, JSON.stringify(sessionData));
    
    try {
      const token = await getAccessTokenSilently();
      const response = await fetch('http://localhost:3001/api/save-draft', {
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
      }
    } catch (error) {
      if (error.error === 'login_required') {
        loginWithRedirect();
      }
      console.error('Failed to save to backend:', error);
    }
    
    setSessionSaved(true);
    setTimeout(() => setSessionSaved(false), 3000);
  };

  const streamResponse = async (response) => {
    const words = response.split(' ');
    let currentText = '';
    
    for (let i = 0; i < words.length; i++) {
      currentText += (i > 0 ? ' ' : '') + words[i];
      setStreamingMessage(currentText);
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    setStreamingMessage('');
    return currentText;
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading || sessionLoading) return;

    const userMessage = {
      id: Date.now(),
      type: 'user',
      content: input.trim()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const token = await getAccessTokenSilently();
      const response = await fetch('http://localhost:3001/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          message: userMessage.content,
          conversationHistory: messages,
          currentData: affidavitData,
          documentId: affidavitData.documentId
        })
      });

      const data = await response.json();
      
      if (data.success) {
        const streamedResponse = await streamResponse(data.response);
        
        const botMessage = {
          id: Date.now() + 1,
          type: 'bot',
          content: streamedResponse
        };

        setMessages(prev => [...prev, botMessage]);

        // Update affidavit data if provided
        if (data.extractedData) {
          setAffidavitData(prev => ({ ...prev, ...data.extractedData }));
        }

        // Update validation if provided
        if (data.validation) {
          setValidation(data.validation);
        }

        // Check if conversation is complete
        if (data.conversationComplete) {
          setDocumentComplete(true);
        }

        // Auto-save session
        await saveSession();
      } else {
        const errorMessage = {
          id: Date.now() + 1,
          type: 'bot',
          content: data.error || 'Sorry, I encountered an error. Please try again.'
        };
        setMessages(prev => [...prev, errorMessage]);
      }
    } catch (error) {
      if (error.error === 'login_required') {
        loginWithRedirect();
      }
      console.error('Chat error:', error);
      const errorMessage = {
        id: Date.now() + 1,
        type: 'bot',
        content: 'Sorry, I encountered an error. Please try again.'
      };
      setMessages(prev => [...prev, errorMessage]);
    }

    setIsLoading(false);
  };

  const handleDownload = () => {
    setShowPayment(true);
  };

  const handlePaymentSuccess = async () => {
    setShowPayment(false);
    
    try {
      const token = await getAccessTokenSilently();
      const response = await fetch('http://localhost:3001/api/generate-affidavit', {
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
        const tabId = getTabId();
        const sessionKey = `affidavit-session-${tabId}`;
        localStorage.removeItem(sessionKey);
        window.open(data.downloadUrl, '_blank');
      }
    } catch (error) {
      if (error.error === 'login_required') {
        loginWithRedirect();
      }
      console.error('Document generation error:', error);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingMessage]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
    }
  }, [input]);

  const renderPreview = () => {
    if (!preview) {
      return (
        <div className="flex items-center justify-center h-64 text-gray-500">
          <div className="text-center">
            <FileText className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p>Preview will appear when you provide basic information</p>
          </div>
        </div>
      );
    }

    return (
      <div className="bg-white shadow-lg mx-auto" style={{ 
        width: '8.5in', 
        minHeight: '11in',
        padding: '1in',
        fontSize: '12pt',
        lineHeight: '1.5',
        fontFamily: 'Times New Roman, serif',
        position: 'relative'
      }}>
        {/* Watermark for preview */}
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%) rotate(-45deg)',
          fontSize: '72px',
          color: 'rgba(0,0,0,0.08)',
          fontWeight: 'bold',
          zIndex: 0,
          pointerEvents: 'none'
        }}>
          PREVIEW
        </div>

        {/* Document Content */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          {preview.sections.header && (
            <div style={{ textAlign: 'center', fontWeight: 'bold', marginBottom: '20px' }}>
              {preview.sections.header}
            </div>
          )}
          
          {preview.sections.venue && (
            <div style={{ textAlign: 'center', fontWeight: 'bold', marginBottom: '20px' }}>
              {preview.sections.venue}
            </div>
          )}
          
          {preview.sections.caseCaption && (
            <div style={{ textAlign: 'right', marginBottom: '20px' }}>
              {preview.sections.caseCaption.formatted}
            </div>
          )}
          
          {preview.sections.title && (
            <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '14pt', marginBottom: '30px' }}>
              {preview.sections.title}
            </div>
          )}
          
          {preview.sections.introduction && (
            <div style={{ textAlign: 'justify', marginBottom: '20px' }}>
              {preview.sections.introduction}
            </div>
          )}
          
          {preview.sections.facts && preview.sections.facts.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              {preview.sections.facts.map((fact, index) => (
                <div key={index} style={{ marginBottom: '15px', textAlign: 'justify' }}>
                  <strong>{fact.number}.</strong> {fact.content}
                </div>
              ))}
            </div>
          )}
          
          {preview.sections.conclusion && (
            <div style={{ textAlign: 'justify', marginBottom: '20px' }}>
              {preview.sections.conclusion}
            </div>
          )}
          
          {preview.sections.perjuryStatement && (
            <div style={{ textAlign: 'justify', marginBottom: '30px' }}>
              {preview.sections.perjuryStatement}
            </div>
          )}
          
          {preview.sections.signatureBlock && (
            <div style={{ marginBottom: '30px' }}>
              <div>{preview.sections.signatureBlock.line}</div>
              <div>{preview.sections.signatureBlock.name}</div>
              <div>{preview.sections.signatureBlock.title}</div>
              {preview.sections.signatureBlock.date && (
                <div style={{ marginTop: '10px' }}>{preview.sections.signatureBlock.date}</div>
              )}
            </div>
          )}
          
          {preview.sections.notaryBlock && (
            <div style={{ 
              border: '2px solid #000', 
              padding: '20px', 
              marginTop: '30px',
              backgroundColor: '#f9f9f9'
            }}>
              <pre style={{ fontFamily: 'Times New Roman, serif', fontSize: '12pt', margin: 0 }}>
                {preview.sections.notaryBlock}
              </pre>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <button
                onClick={onBack}
                className="mr-4 p-2 text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <Scale className="h-8 w-8 text-blue-600 mr-3" />
              <h1 className="text-xl font-semibold text-gray-900">Affidavit Editor</h1>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={saveSession}
                disabled={sessionSaved}
                className="flex items-center px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50"
              >
                {sessionSaved ? (
                  <>
                    <CheckCircle className="h-4 w-4 mr-1 text-green-600" />
                    Saved
                  </>
                ) : (
                  'Save Progress'
                )}
              </button>
              <button
                onClick={() => setShowPreview(!showPreview)}
                className="flex items-center px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                {showPreview ? <EyeOff className="h-4 w-4 mr-1" /> : <Eye className="h-4 w-4 mr-1" />}
                {showPreview ? 'Hide' : 'Show'} Preview
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className={`grid ${showPreview ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'} gap-8`}>
          {/* Chat Interface */}
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="p-6 border-b">
              <h2 className="text-lg font-semibold text-gray-900">AI Assistant</h2>
              <p className="text-sm text-gray-600">I'll guide you through creating your state-compliant affidavit.</p>
              
              {/* Validation Display */}
              <ValidationDisplay validation={validation} />
            </div>
            
            <div className="h-96 overflow-y-auto p-6 space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                      message.type === 'user'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-900'
                    }`}
                  >
                    {message.content}
                  </div>
                </div>
              ))}
              
              {streamingMessage && (
                <div className="flex justify-start">
                  <div className="max-w-xs lg:max-w-md px-4 py-2 rounded-lg bg-gray-100 text-gray-900">
                    {streamingMessage}
                    <span className="animate-pulse">|</span>
                  </div>
                </div>
              )}
              
              {isLoading && !streamingMessage && (
                <div className="flex justify-start">
                  <div className="max-w-xs lg:max-w-md px-4 py-2 rounded-lg bg-gray-100 text-gray-900 flex items-center">
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Thinking...
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>
            
            <div className="p-6 border-t">
              <div className="flex space-x-4">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  placeholder="Type your response..."
                  disabled={isLoading || sessionLoading}
                  className="flex-1 resize-none border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
                  rows="1"
                />
                <button
                  onClick={sendMessage}
                  disabled={!input.trim() || isLoading || sessionLoading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Document Preview */}
          {showPreview && (
            <div className="bg-white rounded-lg shadow-sm border">
              <div className="p-6 border-b flex justify-between items-center">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Document Preview</h2>
                  <p className="text-sm text-gray-600">Live preview using {affidavitData.state || 'state'} template</p>
                </div>
                {documentComplete && validation?.isValid && (
                  <button
                    onClick={handleDownload}
                    className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download PDF
                  </button>
                )}
              </div>
              
              <div className="p-6 overflow-y-auto" style={{ maxHeight: '600px' }}>
                {renderPreview()}
              </div>
            </div>
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
    <Auth0Provider
      domain={process.env.REACT_APP_AUTH0_DOMAIN}
      clientId={process.env.REACT_APP_AUTH0_CLIENT_ID}
      authorizationParams={{
        redirect_uri: window.location.origin,
        audience: process.env.REACT_APP_AUTH0_AUDIENCE,
        scope: "openid profile email"
      }}
      useRefreshTokens={true}
      cacheLocation="localstorage"
    >
      <div className="App">
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
          />
        )}
      </div>
    </Auth0Provider>
  );
}

export default App;