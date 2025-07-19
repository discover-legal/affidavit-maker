// client/src/App.js - Complete drop-in file with fixed home buttons and saving
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Auth0Provider, useAuth0 } from '@auth0/auth0-react';
import { 
  MessageCircle, FileText, Users, Download, Plus, Edit3, 
  Trash2, Calendar, ChevronRight, Menu, X, Settings, 
  LogOut, Home, GripVertical, RotateCcw, Save, CheckCircle,
  AlertTriangle, Loader, Eye, CreditCard, Star, Trophy,
  HelpCircle, Mail, User, Building, Gavel, Scale, PlusCircle,
  Clock, Check, ExternalLink, Zap, Shield, ZoomIn, ZoomOut,
  Loader2, Edit
} from 'lucide-react';

// Auth0 Configuration
const AUTH0_DOMAIN = process.env.REACT_APP_AUTH0_DOMAIN;
const AUTH0_CLIENT_ID = process.env.REACT_APP_AUTH0_CLIENT_ID;
const AUTH0_AUDIENCE = process.env.REACT_APP_AUTH0_AUDIENCE;

// API Configuration
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

// Error Boundary Component
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error boundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-red-600 mb-4">Something went wrong</h1>
            <button 
              onClick={() => window.location.reload()} 
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// Header Component with Fixed Home Button
const Header = ({ currentView, onBackToDashboard, onSave, sessionSaved, isSaving }) => {
  const { isAuthenticated, user, logout, loginWithRedirect, isLoading } = useAuth0();

  const handleHomeClick = () => {
    // Always go to dashboard when home is clicked, regardless of current view
    if (onBackToDashboard) {
      onBackToDashboard();
    }
  };

  const handleLogin = () => {
    loginWithRedirect({
      appState: { returnTo: window.location.pathname }
    });
  };

  const handleLogout = () => {
    logout({ 
      logoutParams: { returnTo: window.location.origin }
    });
  };

  return (
    <header className="bg-white shadow-sm border-b sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo and Title - Always clickable home button */}
          <button
            onClick={handleHomeClick}
            className="flex items-center space-x-3 hover:opacity-80 transition-opacity"
          >
            <Scale className="h-8 w-8 text-blue-600" />
            <div className="text-left">
              <h1 className="text-xl font-bold text-gray-900">Affidavit Maker</h1>
              <p className="text-xs text-gray-500 hidden sm:block">AI-Powered Legal Documents</p>
            </div>
          </button>

          {/* Right side actions */}
          <div className="flex items-center space-x-4">
            {/* Save button (only on editor view) */}
            {currentView === 'editor' && isAuthenticated && (
              <button
                onClick={onSave}
                disabled={sessionSaved || isSaving}
                className="flex items-center px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 w-28 justify-center transition-colors"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    Saving...
                  </>
                ) : sessionSaved ? (
                  <>
                    <CheckCircle className="h-4 w-4 mr-1 text-green-600" />
                    Saved
                  </>
                ) : (
                  'Save Progress'
                )}
              </button>
            )}

            {/* Navigation for authenticated users */}
            {isAuthenticated && currentView !== 'dashboard' && (
              <button
                onClick={onBackToDashboard}
                className="flex items-center px-3 py-2 text-sm text-gray-700 hover:text-blue-600 transition-colors"
              >
                <Home className="h-4 w-4 mr-1" />
                Dashboard
              </button>
            )}

            {/* Authentication section */}
            {isLoading ? (
              <div className="flex items-center space-x-2">
                <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
              </div>
            ) : isAuthenticated ? (
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <User className="h-5 w-5 text-gray-400" />
                  <span className="text-sm font-medium text-gray-700 hidden sm:block">
                    {user?.name || user?.email}
                  </span>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex items-center px-3 py-2 text-sm text-gray-700 hover:text-red-600 transition-colors"
                >
                  <LogOut className="h-4 w-4 mr-1" />
                  <span className="hidden sm:block">Logout</span>
                </button>
              </div>
            ) : (
              <button
                onClick={handleLogin}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

// Dashboard Component with Fixed Document Actions
const Dashboard = ({ onCreateNew, onOpenDocument }) => {
  const { getAccessTokenSilently, logout, user, isLoading: authLoading } = useAuth0();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [renamingDocId, setRenamingDocId] = useState(null);
  const [newName, setNewName] = useState('');
  const [isSubmittingRename, setIsSubmittingRename] = useState(false);

  useEffect(() => {
    if (!authLoading) {
      loadDocuments();
    }
  }, [authLoading]);

  const loadDocuments = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const token = await getAccessTokenSilently({
        audience: AUTH0_AUDIENCE,
        scope: 'openid profile email'
      });

      const response = await fetch(`${API_BASE_URL}/api/documents`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const result = await response.json();
        setDocuments(result.documents || []);
      } else {
        throw new Error('Failed to load documents');
      }
    } catch (error) {
      console.error('Error loading documents:', error);
      setError('Failed to load your documents. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (documentId) => {
    if (!window.confirm('Are you sure you want to delete this document?')) {
      return;
    }

    try {
      const token = await getAccessTokenSilently({
        audience: AUTH0_AUDIENCE,
        scope: 'openid profile email'
      });

      const response = await fetch(`${API_BASE_URL}/api/documents/${documentId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        setDocuments(documents.filter(doc => doc.id !== documentId));
      } else {
        throw new Error('Failed to delete document');
      }
    } catch (error) {
      console.error('Error deleting document:', error);
      alert('Failed to delete document. Please try again.');
    }
  };

  const startRename = (doc) => {
    setRenamingDocId(doc.id);
    setNewName(doc.affiantName || '');
  };

  const cancelRename = () => {
    setRenamingDocId(null);
    setNewName('');
    setIsSubmittingRename(false);
  };

  const submitRename = async (documentId) => {
    if (!newName.trim()) {
      cancelRename();
      return;
    }

    setIsSubmittingRename(true);

    try {
      const token = await getAccessTokenSilently({
        audience: AUTH0_AUDIENCE,
        scope: 'openid profile email'
      });

      const response = await fetch(`${API_BASE_URL}/api/documents/${documentId}/rename`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ newName: newName.trim() })
      });

      if (response.ok) {
        // Update local state
        setDocuments(documents.map(doc => 
          doc.id === documentId 
            ? { ...doc, affiantName: newName.trim() }
            : doc
        ));
        cancelRename();
      } else {
        throw new Error('Failed to rename document');
      }
    } catch (error) {
      console.error('Error renaming document:', error);
      alert('Failed to rename document. Please try again.');
    } finally {
      setIsSubmittingRename(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (currentView === 'landing') {
    return <LandingPage onGetStarted={() => setCurrentView('dashboard')} />;
  }

  if (currentView === 'dashboard') {
    return (
      <div>
        <Header currentView="dashboard" onBackToDashboard={handleBackToDashboard} />
        <Dashboard 
          onCreateNew={handleCreateNew}
          onOpenDocument={handleOpenDocument}
        />
      </div>
    );
  }

  if (currentView === 'editor') {
    return (
      <DocumentEditor 
        existingDocument={selectedDocument}
        onBack={handleBackToDashboard}
      />
    );
  }

  return null;
};

// Main App with Auth0 Provider
const App = () => {
  return (
    <ErrorBoundary>
      <Auth0Provider
        domain={AUTH0_DOMAIN}
        clientId={AUTH0_CLIENT_ID}
        authorizationParams={{
          redirect_uri: window.location.origin,
          audience: AUTH0_AUDIENCE,
          scope: 'openid profile email'
        }}
        cacheLocation="localstorage"
        useRefreshTokens={true}
      >
        <AppContent />
      </Auth0Provider>
    </ErrorBoundary>
  );
};

export default App;-600" />
          <p className="text-gray-600">Loading your documents...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 mb-4">
            <AlertTriangle className="h-12 w-12 mx-auto mb-2" />
            <p className="text-lg font-semibold">Error</p>
          </div>
          <p className="text-gray-600 mb-4">{error}</p>
          <button 
            onClick={loadDocuments}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Welcome back, {user?.name?.split(' ')[0] || 'User'}!
          </h1>
          <p className="text-gray-600">
            Create professional affidavits with AI assistance
          </p>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <button
            onClick={onCreateNew}
            className="bg-white rounded-lg shadow-sm border border-dashed border-gray-300 p-6 hover:border-blue-300 hover:shadow-md transition-all group"
          >
            <div className="flex items-center justify-center mb-4">
              <PlusCircle className="h-12 w-12 text-blue-600 group-hover:scale-110 transition-transform" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">Create New Affidavit</h3>
            <p className="text-sm text-gray-600">
              Start fresh with our AI-powered document builder
            </p>
          </button>
          
          <div className="bg-white rounded-lg shadow-sm border border-dashed p-6 opacity-70">
            <div className="flex items-center justify-between mb-4">
              <Zap className="h-8 w-8 text-gray-400" />
              <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-600">Coming Soon</span>
            </div>
            <h3 className="font-semibold text-gray-600 mb-2">Quick Templates</h3>
            <p className="text-sm text-gray-500">
              Pre-built templates for common affidavit matters to save even more time.
            </p>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm border border-dashed p-6 opacity-70">
            <div className="flex items-center justify-between mb-4">
              <FileText className="h-8 w-8 text-gray-400" />
              <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-600">Coming Soon</span>
            </div>
            <h3 className="font-semibold text-gray-600 mb-2">Smart Forms</h3>
            <p className="text-sm text-gray-500">
              Automatically fill information from previous documents and track cases.
            </p>
          </div>
        </div>

        {/* Document List */}
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Your Documents</h2>
        <div className="bg-white shadow-sm border rounded-lg">
          {documents.length === 0 ? (
            <div className="p-8 text-center">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No documents yet</h3>
              <p className="text-gray-600 mb-4">Get started by creating your first affidavit</p>
              <button
                onClick={onCreateNew}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Create Your First Affidavit
              </button>
            </div>
          ) : (
            <ul className="divide-y divide-gray-200">
              {documents.map((doc) => (
                <li key={doc.id} className="p-4 sm:p-6">
                  <div className="flex items-center justify-between space-x-4">
                    <div className="flex-grow min-w-0">
                      {renamingDocId === doc.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && submitRename(doc.id)}
                            className="block w-full max-w-xs px-3 py-1.5 text-base font-semibold text-gray-900 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                            autoFocus
                            disabled={isSubmittingRename}
                          />
                          <button 
                            onClick={() => submitRename(doc.id)} 
                            className="p-2 text-green-600 hover:bg-green-100 rounded-full disabled:opacity-50" 
                            disabled={isSubmittingRename}
                          >
                            {isSubmittingRename ? <Loader2 className="h-5 w-5 animate-spin"/> : <Check className="h-5 w-5"/>}
                          </button>
                          <button 
                            onClick={cancelRename} 
                            className="p-2 text-red-600 hover:bg-red-100 rounded-full" 
                            disabled={isSubmittingRename}
                          >
                            <X className="h-5 w-5"/>
                          </button>
                        </div>
                      ) : (
                        <h4 
                          className="text-lg font-semibold text-blue-700 truncate cursor-pointer hover:underline" 
                          title="Click to edit" 
                          onClick={() => startRename(doc)}
                        >
                          {doc.affiantName ? `${doc.affiantName}'s Affidavit` : `Affidavit #${doc.id}`}
                        </h4>
                      )}
                      <div className="flex items-center space-x-4 text-sm text-gray-500 mt-1">
                        <span>State: <span className='font-medium'>{doc.state || 'N/A'}</span></span>
                        <span>Status: <span className='font-medium'>{doc.status || 'Draft'}</span></span>
                        <span>Updated: {new Date(doc.updated_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 md:space-x-4 flex-shrink-0">
                      <button 
                        onClick={() => startRename(doc)} 
                        className="p-2 text-gray-500 hover:text-blue-600" 
                        title="Rename"
                      >
                        <Edit className="h-5 w-5" />
                      </button>
                      <button 
                        onClick={() => handleDelete(doc.id)} 
                        className="p-2 text-gray-500 hover:text-red-600" 
                        title="Delete"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => onOpenDocument(doc)}
                        className="px-4 py-2 text-sm bg-gray-100 text-gray-800 rounded-lg hover:bg-gray-200 font-semibold"
                      >
                        {doc.status === 'completed' ? 'View' : 'Continue'}
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

// Chat Interface Component
const ChatInterface = ({ affidavitData, onDataUpdate }) => {
  const { getAccessTokenSilently } = useAuth0();
  const [messages, setMessages] = useState([
    {
      type: 'bot',
      content: "Hello! I'm here to help you create your affidavit. To get started, could you please tell me your full name and which state this affidavit is for?",
      timestamp: new Date()
    }
  ]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState('');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingMessage]);

  const handleSendMessage = async () => {
    if (!currentMessage.trim() || isLoading) return;

    const userMessage = {
      type: 'user',
      content: currentMessage.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setCurrentMessage('');
    setIsLoading(true);
    setStreamingMessage('');

    try {
      const token = await getAccessTokenSilently({
        audience: AUTH0_AUDIENCE,
        scope: 'openid profile email'
      });

      const response = await fetch(`${API_BASE_URL}/api/chat`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: userMessage.content,
          conversationHistory: messages.slice(-10), // Last 10 messages for context
          affidavitData: affidavitData
        })
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let botResponse = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.type === 'token') {
                botResponse += data.content;
                setStreamingMessage(botResponse);
              } else if (data.type === 'data' && data.affidavitData) {
                onDataUpdate(data.affidavitData);
              } else if (data.type === 'done') {
                setMessages(prev => [...prev, {
                  type: 'bot',
                  content: botResponse,
                  timestamp: new Date()
                }]);
                setStreamingMessage('');
              } else if (data.type === 'error') {
                throw new Error(data.error);
              }
            } catch (e) {
              console.error('Error parsing streaming data:', e);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => [...prev, {
        type: 'bot',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date()
      }]);
      setStreamingMessage('');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] p-3 rounded-lg ${
                message.type === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-900'
              }`}
            >
              <p className="text-sm whitespace-pre-wrap">{message.content}</p>
              <p className="text-xs opacity-70 mt-1">
                {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}
        
        {/* Streaming message */}
        {streamingMessage && (
          <div className="flex justify-start">
            <div className="max-w-[80%] p-3 rounded-lg bg-gray-100 text-gray-900">
              <p className="text-sm whitespace-pre-wrap">{streamingMessage}</p>
              <div className="flex items-center mt-1">
                <Loader2 className="h-3 w-3 animate-spin text-gray-500" />
                <span className="text-xs text-gray-500 ml-1">AI is typing...</span>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t p-4">
        <div className="flex space-x-2">
          <textarea
            value={currentMessage}
            onChange={(e) => setCurrentMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your message here..."
            className="flex-1 p-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            rows="2"
            disabled={isLoading}
          />
          <button
            onClick={handleSendMessage}
            disabled={!currentMessage.trim() || isLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <MessageCircle className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// Document Preview Component
const DocumentPreview = ({ affidavitData, preview, isLoading }) => {
  const [zoom, setZoom] = useState(85);
  const [containerHeight, setContainerHeight] = useState(0);
  const containerRef = useRef(null);

  useEffect(() => {
    const updateHeight = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const availableHeight = window.innerHeight - rect.top;
        setContainerHeight(Math.max(400, availableHeight - 20));
      }
    };

    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, []);

  const handleZoomIn = () => setZoom(prev => Math.min(150, prev + 10));
  const handleZoomOut = () => setZoom(prev => Math.max(50, prev - 10));
  const handleResetZoom = () => setZoom(85);

  if (isLoading) {
    return (
      <div 
        className="bg-white flex flex-col"
        style={{ height: containerHeight || '100vh' }}
      >
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Loader className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
            <p className="text-gray-600">Generating preview...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!preview) {
    return (
      <div 
        className="bg-white flex flex-col"
        style={{ height: containerHeight || '100vh' }}
      >
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">Start chatting to see your document preview</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="bg-white flex flex-col" style={{ height: containerHeight || '100vh' }}>
      {/* Header with zoom controls */}
      <div className="px-4 py-3 border-b bg-gray-50 flex justify-between items-center flex-shrink-0">
        <div className="flex items-center space-x-2">
          <FileText className="h-5 w-5 text-gray-600" />
          <span className="font-medium">Document Preview</span>
        </div>
        <div className="flex items-center space-x-2">
          <button onClick={handleZoomOut} className="p-1 hover:bg-gray-200 rounded">
            <ZoomOut className="h-4 w-4" />
          </button>
          <span className="text-sm font-medium min-w-[3rem] text-center">{zoom}%</span>
          <button onClick={handleZoomIn} className="p-1 hover:bg-gray-200 rounded">
            <ZoomIn className="h-4 w-4" />
          </button>
          <button onClick={handleResetZoom} className="p-1 hover:bg-gray-200 rounded">
            <RotateCcw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Document content */}
      <div className="flex-1 overflow-auto bg-gray-100 p-4">
        <div 
          className="mx-auto bg-white shadow-lg"
          style={{
            width: `${zoom * 8.5}px`,
            minHeight: `${zoom * 11}px`,
            padding: `${zoom * 0.6}px`,
            fontFamily: 'Times, serif',
            fontSize: `${zoom * 0.12}px`,
            lineHeight: 1.5
          }}
        >
          {/* Header */}
          {preview.sections?.header && (
            <div style={{ 
              textAlign: 'center', 
              marginBottom: `${zoom * 0.3}px`,
              fontWeight: 'bold',
              fontSize: `${zoom * 0.16}px`
            }}>
              {preview.sections.header.title}
              <br />
              <span style={{ fontSize: `${zoom * 0.12}px`, fontWeight: 'normal' }}>
                {preview.sections.header.content}
              </span>
            </div>
          )}

          {/* Title */}
          {preview.sections?.title && (
            <div style={{ 
              textAlign: 'center', 
              fontWeight: 'bold',
              fontSize: `${zoom * 0.14}px`,
              marginBottom: `${zoom * 0.3}px`
            }}>
              {preview.sections.title}
            </div>
          )}

          {/* Introduction */}
          {preview.sections?.introduction && (
            <div style={{ 
              textAlign: 'justify', 
              textIndent: `${zoom * 0.4}px`,
              marginBottom: `${zoom * 0.2}px`
            }}>
              {preview.sections.introduction}
            </div>
          )}

          {/* Facts */}
          {preview.sections?.facts && preview.sections.facts.length > 0 && (
            <div style={{ marginBottom: `${zoom * 0.2}px` }}>
              {preview.sections.facts.map((fact, index) => (
                <div key={index} style={{ 
                  marginBottom: `${zoom * 0.1}px`,
                  display: 'flex',
                  textAlign: 'justify'
                }}>
                  <span style={{ 
                    minWidth: `${zoom * 0.25}px`,
                    fontWeight: 'normal'
                  }}>
                    {fact.number}.
                  </span>
                  <span style={{ flex: 1 }}>{fact.content}</span>
                </div>
              ))}
            </div>
          )}
          
          {/* Conclusion */}
          {preview.sections?.conclusion && (
            <div style={{ 
              textAlign: 'justify', 
              textIndent: `${zoom * 0.4}px`, 
              marginBottom: `${zoom * 0.2}px`
            }}>
              {preview.sections.conclusion}
            </div>
          )}
          
          {/* Perjury Statement */}
          {preview.sections?.perjuryStatement && (
            <div style={{ 
              textAlign: 'justify', 
              textIndent: `${zoom * 0.4}px`, 
              marginBottom: `${zoom * 0.3}px`,
              fontWeight: 'bold'
            }}>
              {preview.sections.perjuryStatement}
            </div>
          )}
          
          {/* Signature Block */}
          {preview.sections?.signature && (
            <div style={{ 
              marginTop: `${zoom * 0.4}px`,
              marginBottom: `${zoom * 0.3}px`
            }}>
              <div style={{ marginBottom: `${zoom * 0.2}px` }}>
                _____________________________
              </div>
              <div style={{ fontSize: `${zoom * 0.1}px` }}>
                {preview.sections.signature.affiantName}
              </div>
              <div style={{ fontSize: `${zoom * 0.1}px` }}>
                Date: {preview.sections.signature.date}
              </div>
            </div>
          )}

          {/* Notary */}
          {preview.sections?.notary && (
            <div style={{ 
              marginTop: `${zoom * 0.4}px`,
              fontSize: `${zoom * 0.1}px`,
              fontStyle: 'italic'
            }}>
              {preview.sections.notary.content}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Sidebar Component
const DocumentSidebar = ({ affidavitData, onDataUpdate }) => {
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [editingFactId, setEditingFactId] = useState(null);
  const [editedFactContent, setEditedFactContent] = useState('');

  const getCompletionPercentage = () => {
    const requiredFields = ['affiantName', 'state', 'facts'];
    const completedFields = requiredFields.filter(field => {
      const value = affidavitData[field];
      return value && (Array.isArray(value) ? value.length > 0 : true);
    });
    return Math.round((completedFields.length / requiredFields.length) * 100);
  };

  const completionPercentage = getCompletionPercentage();

  // Name editing functions
  const handleEditName = () => {
    setEditedName(affidavitData.affiantName || '');
    setIsEditingName(true);
  };

  const handleSaveName = () => {
    if (editedName.trim()) {
      onDataUpdate({ affiantName: editedName.trim() });
    }
    setIsEditingName(false);
  };

  const handleCancelEdit = () => {
    setIsEditingName(false);
    setEditedName('');
  };

  // Fact editing functions
  const handleEditFact = (index, content) => {
    setEditingFactId(index);
    setEditedFactContent(content);
  };

  const handleSaveFact = (index) => {
    const updatedFacts = [...(affidavitData.facts || [])];
    updatedFacts[index] = {
      ...updatedFacts[index],
      content: editedFactContent.trim()
    };
    onDataUpdate({ facts: updatedFacts });
    setEditingFactId(null);
    setEditedFactContent('');
  };

  const handleDeleteFact = (index) => {
    if (window.confirm('Are you sure you want to delete this fact?')) {
      const updatedFacts = [...(affidavitData.facts || [])];
      updatedFacts.splice(index, 1);
      onDataUpdate({ facts: updatedFacts });
    }
  };

  const handleCancelFactEdit = () => {
    setEditingFactId(null);
    setEditedFactContent('');
  };

  return (
    <div className="w-80 bg-gray-50 border-l p-6 overflow-y-auto">
      <h3 className="text-lg font-semibold mb-4">Document Status</h3>
      
      {/* Completion Progress */}
      <div className="mb-6">
        <div className="flex justify-between text-sm mb-2">
          <span>Completion</span>
          <span>{completionPercentage}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${completionPercentage}%` }}
          />
        </div>
      </div>
      
      {/* Editable Fields */}
      <div className="mb-6">
        <h4 className="font-medium mb-3">Document Information</h4>
        
        {/* Editable Name */}
        <div className="mb-4 p-3 bg-white rounded-lg border">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-700">Affiant Name</label>
            {!isEditingName && (
              <button
                onClick={handleEditName}
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                Edit
              </button>
            )}
          </div>
          
          {isEditingName ? (
            <div className="space-y-2">
              <input
                type="text"
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                className="w-full px-3 py-1 text-sm border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter full name"
                autoFocus
              />
              <div className="flex space-x-2">
                <button
                  onClick={handleSaveName}
                  className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Save
                </button>
                <button
                  onClick={handleCancelEdit}
                  className="px-2 py-1 text-xs bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-900">
              {affidavitData.affiantName || 'Not provided'}
            </p>
          )}
        </div>

        {/* State */}
        <div className="mb-4 p-3 bg-white rounded-lg border">
          <label className="text-sm font-medium text-gray-700 block mb-1">State</label>
          <p className="text-sm text-gray-900">
            {affidavitData.state || 'Not selected'}
          </p>
        </div>
      </div>

      {/* Facts Section */}
      <div className="mb-6">
        <h4 className="font-medium mb-3">Facts & Statements</h4>
        {affidavitData.facts && affidavitData.facts.length > 0 ? (
          <div className="space-y-3">
            {affidavitData.facts.map((fact, index) => (
              <div key={index} className="p-3 bg-white rounded-lg border">
                <div className="flex items-start justify-between mb-2">
                  <span className="text-xs font-medium text-gray-500">Fact {index + 1}</span>
                  <div className="flex space-x-1">
                    {editingFactId !== index && (
                      <>
                        <button
                          onClick={() => handleEditFact(index, fact.content || fact)}
                          className="text-xs text-blue-600 hover:text-blue-800"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteFact(index)}
                          className="text-xs text-red-600 hover:text-red-800"
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </div>
                
                {editingFactId === index ? (
                  <div className="space-y-2">
                    <textarea
                      value={editedFactContent}
                      onChange={(e) => setEditedFactContent(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                      rows="3"
                      autoFocus
                    />
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleSaveFact(index)}
                        className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                      >
                        Save
                      </button>
                      <button
                        onClick={handleCancelFactEdit}
                        className="px-2 py-1 text-xs bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-900">
                    {fact.content || fact}
                  </p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500 italic">
            No facts added yet. Start chatting to add facts to your affidavit.
          </p>
        )}
      </div>

      {/* Quick Status */}
      <div className="mb-6">
        <h4 className="font-medium mb-3">Quick Status</h4>
        <div className="space-y-2">
          <div className="flex items-center">
            {affidavitData.affiantName ? 
              <CheckCircle className="h-4 w-4 text-green-600 mr-2" /> : 
              <AlertTriangle className="h-4 w-4 text-yellow-600 mr-2" />
            }
            <span className={affidavitData.affiantName ? 'text-green-700' : 'text-gray-600'}>
              Name
            </span>
          </div>
          <div className="flex items-center">
            {affidavitData.state ? 
              <CheckCircle className="h-4 w-4 text-green-600 mr-2" /> : 
              <AlertTriangle className="h-4 w-4 text-yellow-600 mr-2" />
            }
            <span className={affidavitData.state ? 'text-green-700' : 'text-gray-600'}>
              State
            </span>
          </div>
          <div className="flex items-center">
            {affidavitData.facts && affidavitData.facts.length > 0 ? 
              <CheckCircle className="h-4 w-4 text-green-600 mr-2" /> : 
              <AlertTriangle className="h-4 w-4 text-yellow-600 mr-2" />
            }
            <span className={affidavitData.facts && affidavitData.facts.length > 0 ? 'text-green-700' : 'text-gray-600'}>
              Facts/Statements
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

// Resize Handle Component
const ResizeHandle = ({ onResize, isResizing }) => {
  const handleMouseDown = (e) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = parseInt(document.defaultView.getComputedStyle(e.target.parentElement.previousElementSibling).width, 10);

    const handleMouseMove = (e) => {
      const newWidth = ((startX - e.clientX + startWidth) / window.innerWidth) * 100;
      const clampedWidth = Math.max(25, Math.min(75, newWidth));
      onResize(clampedWidth);
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      onResize(null); // Signal resize end
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    onResize(true); // Signal resize start
  };

  return (
    <div
      className={`w-2 bg-gray-200 hover:bg-blue-300 cursor-col-resize flex items-center justify-center group ${
        isResizing ? 'bg-blue-200' : ''
      }`}
      onMouseDown={handleMouseDown}
      style={{ minWidth: '8px' }}
    >
      <div className={`flex flex-col space-y-1 opacity-0 group-hover:opacity-100 transition-opacity ${
        isResizing ? 'opacity-100' : ''
      }`}>
        <GripVertical className="h-4 w-4 text-gray-400" />
      </div>
    </div>
  );
};

// Main Document Editor
const DocumentEditor = ({ existingDocument = null, onBack }) => {
  const { getAccessTokenSilently } = useAuth0();
  const [chatWidth, setChatWidth] = useState(42);
  const [isResizing, setIsResizing] = useState(false);
  const [sessionSaved, setSessionSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Document state that updates in real-time
  const [affidavitData, setAffidavitData] = useState(() => {
    if (existingDocument) {
      return {
        ...existingDocument.content,
        documentId: existingDocument.id
      };
    }
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

  const [preview, setPreview] = useState(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  // Update preview when affidavit data changes
  useEffect(() => {
    const hasBasicData = affidavitData.state || affidavitData.affiantName;
    const hasFacts = affidavitData.facts && affidavitData.facts.length > 0;
    
    if (hasBasicData || hasFacts) {
      console.log('Triggering preview generation due to data change:', {
        state: affidavitData.state,
        name: affidavitData.affiantName,
        factsCount: affidavitData.facts?.length || 0
      });
      generatePreview();
    }
  }, [affidavitData]);

  const generatePreview = async () => {
    setIsPreviewLoading(true);
    try {
      console.log('Generating preview with data:', affidavitData);
      
      const response = await fetch(`${API_BASE_URL}/api/preview`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ affidavitData })
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Preview result:', result);
        
        if (result.success && result.preview) {
          setPreview(result.preview);
          console.log('Preview updated successfully');
        } else {
          console.error('Preview generation failed:', result.error);
          setPreview(null);
        }
      } else {
        console.error('Preview request failed:', response.status, response.statusText);
        setPreview(null);
      }
    } catch (error) {
      console.error('Preview error:', error);
      setPreview(null);
    } finally {
      setIsPreviewLoading(false);
    }
  };

  // Handle real-time data updates from chat
  const handleDataUpdate = (newData) => {
    setAffidavitData(prev => ({ ...prev, ...newData }));
    setSessionSaved(false); // Mark as unsaved when data changes
  };

  // Save function
  const handleSave = async () => {
    if (isSaving) return;
    
    setIsSaving(true);
    try {
      const token = await getAccessTokenSilently({
        audience: AUTH0_AUDIENCE,
        scope: 'openid profile email'
      });

      const response = await fetch(`${API_BASE_URL}/api/save-draft`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          affidavitData: affidavitData,
          documentId: affidavitData.documentId
        })
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setSessionSaved(true);
          // Update document ID if it's a new document
          if (!affidavitData.documentId && result.documentId) {
            setAffidavitData(prev => ({ ...prev, documentId: result.documentId }));
          }
          console.log('Document saved successfully');
        }
      } else {
        throw new Error('Failed to save document');
      }
    } catch (error) {
      console.error('Error saving document:', error);
      alert('Failed to save document. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle resize
  const handleResize = (value) => {
    if (value === true) {
      setIsResizing(true);
    } else if (value === null) {
      setIsResizing(false);
    } else {
      setChatWidth(value);
    }
  };

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <Header 
        currentView="editor"
        onBackToDashboard={onBack}
        onSave={handleSave}
        sessionSaved={sessionSaved}
        isSaving={isSaving}
      />

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Chat Interface */}
        <div style={{ width: `${chatWidth}%` }}>
          <ChatInterface 
            affidavitData={affidavitData}
            onDataUpdate={handleDataUpdate}
          />
        </div>

        {/* Resize Handle */}
        <ResizeHandle onResize={handleResize} isResizing={isResizing} />

        {/* Preview */}
        <div style={{ width: `${100 - chatWidth - 20}%` }}>
          <DocumentPreview 
            affidavitData={affidavitData}
            preview={preview}
            isLoading={isPreviewLoading}
          />
        </div>

        {/* Sidebar */}
        <DocumentSidebar 
          affidavitData={affidavitData}
          onDataUpdate={handleDataUpdate}
        />
      </div>
    </div>
  );
};

// Landing Page Component (Import your existing one)
const LandingPage = ({ onGetStarted }) => {
  const { loginWithRedirect, isAuthenticated } = useAuth0();

  const handleGetStarted = () => {
    if (isAuthenticated) {
      onGetStarted();
    } else {
      loginWithRedirect({
        appState: { returnTo: '/dashboard' }
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <Header currentView="landing" />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-6">
            Create Professional Affidavits with AI
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            Generate legally compliant affidavits for Texas, Utah, and Arizona using our AI-powered platform. 
            Simply chat with our assistant to build your document.
          </p>
          
          <button
            onClick={handleGetStarted}
            className="px-8 py-4 bg-blue-600 text-white text-lg font-semibold rounded-lg hover:bg-blue-700 transition-colors"
          >
            Get Started
          </button>
        </div>

        {/* Feature Section */}
        <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="text-center">
            <MessageCircle className="h-12 w-12 text-blue-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">AI-Powered Chat</h3>
            <p className="text-gray-600">Simply describe your situation and our AI will guide you through creating your affidavit</p>
          </div>
          
          <div className="text-center">
            <Shield className="h-12 w-12 text-blue-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">Legally Compliant</h3>
            <p className="text-gray-600">Generated documents meet state-specific legal requirements for Texas, Utah, and Arizona</p>
          </div>
          
          <div className="text-center">
            <Zap className="h-12 w-12 text-blue-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">Fast & Easy</h3>
            <p className="text-gray-600">Create professional affidavits in minutes, not hours</p>
          </div>
        </div>
      </div>
    </div>
  );
};

// Main App Component
const AppContent = () => {
  const { isLoading, isAuthenticated } = useAuth0();
  const [currentView, setCurrentView] = useState('landing');
  const [selectedDocument, setSelectedDocument] = useState(null);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      setCurrentView('dashboard');
    }
  }, [isLoading, isAuthenticated]);

  const handleCreateNew = () => {
    setSelectedDocument(null);
    setCurrentView('editor');
  };

  const handleOpenDocument = (document) => {
    setSelectedDocument(document);
    setCurrentView('editor');
  };

  const handleBackToDashboard = () => {
    setSelectedDocument(null);
    setCurrentView('dashboard');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue