import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, FileText, Download, AlertCircle, Loader2, CreditCard, 
  Lock, CheckCircle, Menu, X, Home, FileBox, Settings, LogOut,
  Star, Users, Shield, Zap, ChevronRight, Eye, EyeOff, Scale, Clock, ArrowLeft
} from 'lucide-react';
import { Auth0Provider, useAuth0 } from '@auth0/auth0-react';

// Enhanced Landing Page with Marketing Focus
const LandingPage = ({ onGetStarted }) => {
  const { loginWithRedirect, isAuthenticated, user } = useAuth0();

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Navigation */}
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

      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
        <div className="text-center">
          <h1 className="text-5xl font-bold text-gray-900 mb-6">
            Create Legal Affidavits in Minutes
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            AI-powered document preparation for self-represented litigants. 
            Professional affidavits without the law firm prices.
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

      {/* Features Section */}
      <div className="bg-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="flex justify-center mb-4">
                <Zap className="h-12 w-12 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Fast & Easy</h3>
              <p className="text-gray-600">
                Conversational AI guides you through every step. 
                Complete your affidavit in under 10 minutes.
              </p>
            </div>
            <div className="text-center">
              <div className="flex justify-center mb-4">
                <Shield className="h-12 w-12 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold mb-2">State-Specific Formats</h3>
              <p className="text-gray-600">
                Properly formatted for Texas, Utah, and Arizona courts. 
                Each state's unique requirements built-in.
              </p>
            </div>
            <div className="text-center">
              <div className="flex justify-center mb-4">
                <Scale className="h-12 w-12 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Document Preparation Only</h3>
              <p className="text-gray-600">
                We provide document preparation services. 
                For legal advice, consult an attorney.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Pricing Preview */}
      <div className="bg-gray-50 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-8">Simple, Transparent Pricing</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-xl font-semibold mb-2">Single Affidavit</h3>
              <p className="text-3xl font-bold text-blue-600">$49</p>
              <p className="text-gray-600 mt-2">Per document</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow border-2 border-blue-500">
              <h3 className="text-xl font-semibold mb-2">Pro Monthly</h3>
              <p className="text-3xl font-bold text-blue-600">$29.99</p>
              <p className="text-gray-600 mt-2">10 documents/month</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-xl font-semibold mb-2">Unlimited</h3>
              <p className="text-3xl font-bold text-blue-600">$99.99</p>
              <p className="text-gray-600 mt-2">Unlimited documents</p>
            </div>
          </div>
        </div>
      </div>

      {/* Testimonials */}
      <div className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
            Trusted by Self-Represented Litigants
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                text: "Saved me hundreds of dollars. The AI walked me through everything perfectly.",
                author: "Sarah M., Texas"
              },
              {
                text: "I was nervous about court documents, but this made it so simple and professional.",
                author: "Michael R., Utah"
              },
              {
                text: "The state-specific formatting was exactly what the court required. Highly recommend!",
                author: "Jessica L., Arizona"
              }
            ].map((testimonial, i) => (
              <div key={i} className="bg-gray-50 p-6 rounded-lg">
                <div className="flex mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-5 w-5 text-yellow-400 fill-current" />
                  ))}
                </div>
                <p className="text-gray-700 mb-4">"{testimonial.text}"</p>
                <p className="text-sm text-gray-600 font-semibold">{testimonial.author}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// User Dashboard Component
const UserDashboard = ({ onNewDocument, onContinueDocument }) => {
  const { user, logout, getAccessTokenSilently } = useAuth0();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalDocuments: 0,
    completedDocuments: 0,
    draftDocuments: 0
  });

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      const token = await getAccessTokenSilently();
      const response = await fetch('http://localhost:3001/api/user/documents', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      
      if (data.success) {
        setDocuments(data.documents);
        // Calculate stats
        const completed = data.documents.filter(d => d.status === 'completed').length;
        const drafts = data.documents.filter(d => d.status === 'draft').length;
        setStats({
          totalDocuments: data.documents.length,
          completedDocuments: completed,
          draftDocuments: drafts
        });
      }
    } catch (error) {
      console.error('Failed to fetch documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (documentId) => {
    try {
      const token = await getAccessTokenSilently();
      window.open(`http://localhost:3001/api/download/${documentId}?token=${token}`, '_blank');
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <Home className="h-8 w-8 text-blue-600 mr-3" />
              <h1 className="text-2xl font-bold text-gray-900">Your Dashboard</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-gray-700">{user?.email}</span>
              <button
                onClick={() => logout({ 
                  logoutParams: {
                    returnTo: window.location.origin
                  }
                })}
                className="flex items-center space-x-2 text-gray-600 hover:text-gray-900"
              >
                <LogOut className="h-5 w-5" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center justify-between mb-4">
              <FileText className="h-8 w-8 text-gray-400" />
              <span className="text-2xl font-bold text-gray-900">{stats.totalDocuments}</span>
            </div>
            <p className="text-sm text-gray-600">Total Documents</p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center justify-between mb-4">
              <CheckCircle className="h-8 w-8 text-green-500" />
              <span className="text-2xl font-bold text-green-600">{stats.completedDocuments}</span>
            </div>
            <p className="text-sm text-gray-600">Completed</p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center justify-between mb-4">
              <Clock className="h-8 w-8 text-yellow-500" />
              <span className="text-2xl font-bold text-yellow-600">{stats.draftDocuments}</span>
            </div>
            <p className="text-sm text-gray-600">Drafts</p>
          </div>

          <button
            onClick={onNewDocument}
            className="bg-blue-600 p-6 rounded-lg shadow hover:bg-blue-700 text-white transition-colors"
          >
            <div className="text-center">
              <FileText className="h-12 w-12 mx-auto mb-3" />
              <h3 className="font-semibold">Create New Affidavit</h3>
            </div>
          </button>
        </div>

        {/* Documents List */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b">
            <h2 className="text-xl font-semibold text-gray-900">Your Documents</h2>
          </div>
          <div className="p-6">
            {loading ? (
              <div className="text-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400 mx-auto" />
              </div>
            ) : documents.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No documents yet</p>
                <button onClick={onNewDocument} className="mt-4 text-blue-600 hover:text-blue-700 font-medium">
                  Create your first affidavit →
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {documents.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                    <div className="flex items-center space-x-4">
                      <FileText className="h-10 w-10 text-gray-400" />
                      <div>
                        <h4 className="font-medium text-gray-900">
                          {doc.affiant_name || 'Untitled'} - {doc.state || 'Draft'}
                        </h4>
                        <p className="text-sm text-gray-500">
                          Case #{doc.case_number || 'N/A'} • {new Date(doc.created_at).toLocaleDateString()}
                        </p>
                        <p className="text-xs text-gray-400">
                          Status: <span className={`font-medium ${doc.status === 'completed' ? 'text-green-600' : 'text-yellow-600'}`}>
                            {doc.status}
                          </span>
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {doc.status === 'completed' ? (
                        <button
                          onClick={() => handleDownload(doc.id)}
                          className="flex items-center space-x-2 text-blue-600 hover:text-blue-700"
                        >
                          <Download className="h-5 w-5" />
                          <span>Download</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => onContinueDocument(doc)}
                          className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                        >
                          Continue →
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Payment Modal Component
const PaymentModal = ({ isOpen, onClose, affidavitData, onPaymentSuccess }) => {
  const { getAccessTokenSilently } = useAuth0();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [pricing, setPricing] = useState(null);
  const [cardData, setCardData] = useState({
    number: '',
    expiry: '',
    cvc: '',
    name: affidavitData?.affiantName || '',
    email: ''
  });

  useEffect(() => {
    if (isOpen) {
      fetchPricing();
    }
  }, [isOpen]);

  const fetchPricing = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/payment/pricing');
      const data = await response.json();
      if (data.success) {
        setPricing(data.pricing);
      }
    } catch (err) {
      console.error('Failed to fetch pricing:', err);
    }
  };

  const handlePayment = async () => {
    if (!cardData.email || !cardData.number || !cardData.expiry || !cardData.cvc || !cardData.name) {
      setError('Please fill in all fields');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const token = await getAccessTokenSilently();
      const response = await fetch('http://localhost:3001/api/payment/create-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          documentType: 'single_affidavit',
          documentId: affidavitData.documentId
        })
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Payment failed');
      }

      // Simulate payment processing (in production, use Stripe Elements)
      setTimeout(() => {
        setSuccess(true);
        setLoading(false);
        
        setTimeout(() => {
          onPaymentSuccess({
            paymentId: data.clientSecret,
            amount: data.amount
          });
          onClose();
        }, 2000);
      }, 2000);

    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const formatCardNumber = (value) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    const matches = v.match(/\d{4,16}/g);
    const match = (matches && matches[0]) || '';
    const parts = [];

    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }

    return parts.length ? parts.join(' ') : value;
  };

  const formatExpiry = (value) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    if (v.length >= 2) {
      return v.slice(0, 2) + '/' + v.slice(2, 4);
    }
    return v;
  };

  const handleInputChange = (field, value) => {
    if (field === 'number') {
      value = formatCardNumber(value);
    } else if (field === 'expiry') {
      value = formatExpiry(value);
    }
    
    setCardData(prev => ({ ...prev, [field]: value }));
  };

  if (!isOpen) return null;

  if (success) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full m-4 p-8 text-center">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Payment Successful!</h2>
          <p className="text-gray-600">Your affidavit is being prepared for download.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full m-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-800">Complete Payment</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-3xl"
              disabled={loading}
            >
              ×
            </button>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <div className="flex justify-between items-center mb-2">
              <span className="text-gray-600">Affidavit Document</span>
              <span className="font-semibold">${pricing?.single_affidavit || '49.00'}</span>
            </div>
            <div className="flex justify-between items-center text-sm text-gray-500">
              <span>State: {affidavitData?.state}</span>
              <span>Case: {affidavitData?.caseNumber}</span>
            </div>
            <div className="border-t mt-3 pt-3 flex justify-between items-center">
              <span className="font-semibold text-gray-800">Total</span>
              <span className="font-bold text-xl text-blue-600">
                ${pricing?.single_affidavit || '49.00'}
              </span>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email Address
              </label>
              <input
                type="email"
                value={cardData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="john@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Card Number
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={cardData.number}
                  onChange={(e) => handleInputChange('number', e.target.value)}
                  className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="1234 5678 9012 3456"
                  maxLength="19"
                />
                <CreditCard className="absolute right-3 top-2.5 h-5 w-5 text-gray-400" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Expiry Date
                </label>
                <input
                  type="text"
                  value={cardData.expiry}
                  onChange={(e) => handleInputChange('expiry', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="MM/YY"
                  maxLength="5"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  CVC
                </label>
                <input
                  type="text"
                  value={cardData.cvc}
                  onChange={(e) => handleInputChange('cvc', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="123"
                  maxLength="4"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cardholder Name
              </label>
              <input
                type="text"
                value={cardData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="John Doe"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-md text-red-700">
                <AlertCircle className="h-5 w-5 flex-shrink-0" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Lock className="h-4 w-4" />
              <span>Your payment information is secure and encrypted</span>
            </div>

            <button
              onClick={handlePayment}
              disabled={loading}
              className="w-full py-3 px-4 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  Pay ${pricing?.single_affidavit || '49.00'}
                </>
              )}
            </button>
          </div>

          <p className="text-xs text-gray-500 mt-4 text-center">
            By completing this payment, you agree to our terms of service and acknowledge
            that this is for document preparation services only, not legal advice.
          </p>
        </div>
      </div>
    </div>
  );
};

// Document Editor with Preview
const DocumentEditor = ({ existingDocument = null, onBack }) => {
  const { getAccessTokenSilently } = useAuth0();
  const [messages, setMessages] = useState([{
    id: 1,
    type: 'bot',
    content: existingDocument 
      ? "Welcome back! I see you were working on an affidavit. Let's continue where you left off."
      : "Hi! I'll help you create a professional affidavit. Which state is your case in? (Texas, Utah, or Arizona)"
  }]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState('');
  const [showPreview, setShowPreview] = useState(true);
  const [documentComplete, setDocumentComplete] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [sessionSaved, setSessionSaved] = useState(false);
  const [affidavitData, setAffidavitData] = useState(existingDocument?.content || {
    state: '',
    affiantName: '',
    caseNumber: '',
    caseType: '',
    county: '',
    facts: [],
    documentId: existingDocument?.id || null
  });
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
    }
  }, [input]);

  // Save session to localStorage and backend
  const saveSession = async () => {
    // Save to localStorage for quick recovery
    const sessionData = {
      messages,
      affidavitData,
      documentComplete,
      timestamp: new Date().toISOString()
    };
    localStorage.setItem('affidavit-session', JSON.stringify(sessionData));
    
    // Save to backend if user is authenticated
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
      }
    } catch (error) {
      console.error('Failed to save to backend:', error);
    }
    
    setSessionSaved(true);
    setTimeout(() => setSessionSaved(false), 3000);
  };

  const [showResumeModal, setShowResumeModal] = useState(false);
  const [savedSessionData, setSavedSessionData] = useState(null);

  // Load session from localStorage
  useEffect(() => {
    // Only check localStorage if this is a NEW document (not continuing an existing one)
    if (!existingDocument) {
      const savedSession = localStorage.getItem('affidavit-session');
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
          localStorage.removeItem('affidavit-session');
        }
      }
    }
  }, []); // Empty dependency array - only run once on mount

  const handleResumeDecision = (resume) => {
    if (resume && savedSessionData) {
      setMessages(savedSessionData.messages);
      setAffidavitData(savedSessionData.affidavitData);
      setDocumentComplete(savedSessionData.documentComplete);
      // Keep the session for future saves
    } else {
      // User wants to start fresh - clear the saved session
      localStorage.removeItem('affidavit-session');
    }
    setShowResumeModal(false);
    setSavedSessionData(null);
  };

  const streamResponse = async (response) => {
    const words = response.split(' ');
    let currentText = '';
    
    for (let i = 0; i < words.length; i++) {
      currentText += (i > 0 ? ' ' : '') + words[i];
      setStreamingMessage(currentText);
      await new Promise(resolve => setTimeout(resolve, 30));
    }
    
    const botMessage = {
      id: messages.length + 2,
      type: 'bot',
      content: response
    };
    
    setMessages(prev => [...prev, botMessage]);
    setStreamingMessage('');
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = { id: messages.length + 1, type: 'user', content: input };
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
          message: input,
          conversationHistory: messages,
          currentData: affidavitData,
          documentId: affidavitData.documentId
        })
      });

      const data = await response.json();

      if (data.success) {
        // Stream the response
        await streamResponse(data.response);

        // Update affidavit data
        if (data.extractedData) {
          setAffidavitData(prev => ({
            ...prev,
            ...data.extractedData,
            documentId: data.documentId || prev.documentId
          }));

          // Check if data is complete
          if (data.extractedData.dataComplete) {
            setDocumentComplete(true);
          }
        }
        
        // Auto-save after each interaction
        saveSession();
      }
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage = {
        id: messages.length + 2,
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
          sessionId: affidavitData.documentId
        })
      });

      const data = await response.json();
      if (data.success) {
        // Clear saved session after successful download
        localStorage.removeItem('affidavit-session');
        // Download the file
        window.open(data.downloadUrl, '_blank');
      }
    } catch (error) {
      console.error('Document generation error:', error);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingMessage]);

  // State-specific document formats
  const getStateSpecificFormat = (state) => {
    const formats = {
      'TX': {
        header: 'THE STATE OF TEXAS',
        countyFormat: 'COUNTY OF',
        notaryBlock: 'SWORN TO AND SUBSCRIBED before me, the undersigned authority',
        venue: true
      },
      'UT': {
        header: 'STATE OF UTAH',
        countyFormat: 'County of',
        notaryBlock: 'SUBSCRIBED AND SWORN to before me',
        venue: true
      },
      'AZ': {
        header: 'STATE OF ARIZONA',
        countyFormat: 'County of',
        notaryBlock: 'SUBSCRIBED AND SWORN TO before me',
        venue: false
      }
    };
    return formats[state] || formats['TX'];
  };

  // Generate preview content based on current data
  const generatePreviewContent = () => {
    const today = new Date().toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    
    const stateFormat = getStateSpecificFormat(affidavitData.state);

    return (
      <div className="bg-white shadow-lg mx-auto" style={{ 
        width: '8.5in', 
        minHeight: '11in',
        padding: '1in',
        fontFamily: 'Times New Roman, serif',
        fontSize: '12pt',
        lineHeight: '2',
        color: '#000',
        position: 'relative',
        userSelect: 'none'
      }}>
        {/* Watermark */}
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
          DRAFT PREVIEW
        </div>

        {/* Document Content */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          {/* Header */}
          {stateFormat.venue && (
            <div style={{ textAlign: 'left', marginBottom: '24px' }}>
              <div>{stateFormat.header || '[STATE]'}</div>
              <div>{stateFormat.countyFormat} {affidavitData.county || '[COUNTY]'}</div>
            </div>
          )}

          {/* Case Caption */}
          {affidavitData.caseNumber && (
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <div>CAUSE NO. {affidavitData.caseNumber}</div>
            </div>
          )}

          {/* Title */}
          <div style={{ textAlign: 'center', marginBottom: '36px' }}>
            <h2 style={{ fontSize: '14pt', fontWeight: 'bold' }}>
              AFFIDAVIT OF {affidavitData.affiantName ? affidavitData.affiantName.toUpperCase() : '[YOUR NAME]'}
            </h2>
          </div>

          {/* Body */}
          <div style={{ textAlign: 'justify' }}>
            <p style={{ textIndent: '0.5in', marginBottom: '12px' }}>
              BEFORE ME, the undersigned Notary Public, on this day personally appeared{' '}
              <span style={{ fontWeight: 'bold' }}>{affidavitData.affiantName || '[Your Name]'}</span>,
              who being by me duly sworn, deposed as follows:
            </p>

            <ol style={{ paddingLeft: '0.5in', marginBottom: '24px' }}>
              <li style={{ marginBottom: '12px' }}>
                My name is <span style={{ fontWeight: 'bold' }}>{affidavitData.affiantName || '[Your Name]'}</span>.
                I am over the age of eighteen (18) years, and I am fully competent to make this affidavit.
                The facts stated in this affidavit are within my personal knowledge and are true and correct.
              </li>

              {affidavitData.facts && affidavitData.facts.length > 0 ? (
                affidavitData.facts.map((fact, index) => (
                  <li key={index} style={{ marginBottom: '12px' }}>{fact}</li>
                ))
              ) : (
                <>
                  <li style={{ marginBottom: '12px', color: '#888' }}>[Your statement of facts will appear here]</li>
                  <li style={{ marginBottom: '12px', color: '#888' }}>[Each fact will be numbered and clearly stated]</li>
                </>
              )}

              <li style={{ marginBottom: '12px' }}>
                Further affiant sayeth not.
              </li>
            </ol>

            {/* Signature Block */}
            <div style={{ marginTop: '48px', marginBottom: '48px' }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ marginBottom: '4px' }}>_________________________________</div>
                <div>{affidavitData.affiantName || '[Your Name]'}, Affiant</div>
              </div>
            </div>

            {/* Notary Block */}
            <div style={{ 
              border: '2px solid black', 
              padding: '16px',
              marginTop: '36px',
              fontSize: '10pt'
            }}>
              <div style={{ fontWeight: 'bold', marginBottom: '12px' }}>
                {stateFormat.notaryBlock}
              </div>
              <p style={{ marginBottom: '24px' }}>
                on this _____ day of ____________, 20___, by {affidavitData.affiantName || '[Your Name]'}.
              </p>
              <div style={{ marginTop: '36px' }}>
                <div style={{ marginBottom: '4px' }}>_________________________________</div>
                <div>Notary Public</div>
                <div>My Commission Expires: ___________</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Resume Session Modal */}
      {showResumeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full m-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Resume Previous Affidavit?
            </h3>
            <p className="text-gray-600 mb-6">
              You have an unsaved affidavit from your last session. Would you like to continue working on it?
            </p>
            {savedSessionData && (
              <div className="bg-gray-50 rounded p-3 mb-6 text-sm text-gray-600">
                <p><strong>State:</strong> {savedSessionData.affidavitData?.state || 'Not specified'}</p>
                <p><strong>Name:</strong> {savedSessionData.affidavitData?.affiantName || 'Not specified'}</p>
                <p><strong>Last saved:</strong> {new Date(savedSessionData.timestamp).toLocaleString()}</p>
              </div>
            )}
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => handleResumeDecision(false)}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300"
              >
                Start New
              </button>
              <button
                onClick={() => handleResumeDecision(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Continue Previous
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-white shadow-sm px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button 
              onClick={onBack} 
              className="flex items-center space-x-2 text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="h-5 w-5" />
              <span>Back to Dashboard</span>
            </button>
            <div className="border-l pl-4">
              <h1 className="text-xl font-semibold">
                {existingDocument ? 'Continue Affidavit' : 'New Affidavit'}
              </h1>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={saveSession}
              className="text-gray-600 hover:text-gray-900 flex items-center space-x-2"
            >
              {sessionSaved ? (
                <>
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="text-green-600">Saved!</span>
                </>
              ) : (
                <>
                  <FileBox className="h-5 w-5" />
                  <span>Save Progress</span>
                </>
              )}
            </button>
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="flex items-center space-x-2 text-gray-600 hover:text-gray-900"
            >
              {showPreview ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              <span>{showPreview ? 'Hide' : 'Show'} Preview</span>
            </button>
            {documentComplete && (
              <button
                onClick={handleDownload}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center space-x-2"
              >
                <Download className="h-5 w-5" />
                <span>Download PDF ($49)</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Chat Section */}
        <div className={`flex-1 flex flex-col ${showPreview ? 'w-1/2' : 'w-full'}`}>
          <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`mb-4 flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-2xl px-4 py-3 rounded-lg ${
                    message.type === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-800 shadow'
                  }`}
                >
                  <p className="whitespace-pre-line">{message.content}</p>
                </div>
              </div>
            ))}
            
            {/* Streaming message */}
            {streamingMessage && (
              <div className="mb-4 flex justify-start">
                <div className="max-w-2xl px-4 py-3 rounded-lg bg-white text-gray-800 shadow">
                  <p className="whitespace-pre-line">{streamingMessage}</p>
                </div>
              </div>
            )}
            
            {isLoading && !streamingMessage && (
              <div className="flex justify-start mb-4">
                <div className="bg-white text-gray-800 shadow px-4 py-3 rounded-lg">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="border-t bg-white p-4">
            <div className="flex gap-3 items-end">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Type your response... (Shift+Enter for new line)"
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none overflow-y-auto"
                disabled={isLoading || documentComplete}
                style={{ minHeight: '44px', maxHeight: '120px' }}
                rows={1}
              />
              <button
                onClick={handleSend}
                disabled={isLoading || !input.trim() || documentComplete}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 mb-1"
              >
                <Send className="h-5 w-5" />
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">Your progress is automatically saved</p>
          </div>
        </div>

        {/* Preview Section */}
        {showPreview && (
          <div className="w-1/2 bg-gray-100 border-l flex flex-col">
            <div className="flex-1 overflow-y-auto p-8">
              {generatePreviewContent()}
            </div>
            {documentComplete && (
              <div className="p-4 bg-white border-t">
                <button
                  onClick={handleDownload}
                  className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 flex items-center justify-center space-x-2 font-semibold"
                >
                  <Download className="h-5 w-5" />
                  <span>Download Final PDF - $49</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

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
        audience: process.env.REACT_APP_AUTH0_AUDIENCE
      }}
    >
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
    </Auth0Provider>
  );
}

export default App;