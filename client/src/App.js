// client/src/App.js - Restored to original elegant design
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Auth0Provider, useAuth0 } from '@auth0/auth0-react';
import { 
  MessageCircle, FileText, Users, Download, Plus, Edit3, 
  Trash2, Calendar, ChevronRight, Menu, X, Settings, 
  LogOut, Home, GripVertical, RotateCcw, Save, CheckCircle,
  AlertTriangle, Loader, Eye, CreditCard, Star, Trophy,
  HelpCircle, Mail, User, Building, Gavel, Scale, PlusCircle,
  Clock, Check, ExternalLink, Zap, Shield, ZoomIn, ZoomOut
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

// Import your existing LandingPage component
import LandingPage from './components/LandingPage';

// Original Document Preview with 8.5x11 paper
const DocumentPreview = ({ affidavitData, preview, isLoading }) => {
  const [zoom, setZoom] = useState(85);
  const [containerHeight, setContainerHeight] = useState(0);
  const containerRef = useRef(null);
  const contentRef = useRef(null);

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
      <div className="bg-white flex flex-col" style={{ height: containerHeight || '100vh' }}>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Loader className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
            <p className="text-gray-600">Generating preview...</p>
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
          <span className="text-sm font-mono min-w-[3rem] text-center">{zoom}%</span>
          <button onClick={handleZoomIn} className="p-1 hover:bg-gray-200 rounded">
            <ZoomIn className="h-4 w-4" />
          </button>
          <button onClick={handleResetZoom} className="p-1 hover:bg-gray-200 rounded" title="Reset zoom">
            <RotateCcw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* 8.5x11 Document */}
      <div className="flex-1 overflow-auto bg-gray-100 p-2" style={{ minHeight: 0 }}>
        <div className="w-full flex justify-center">
          <div 
            ref={contentRef}
            className="bg-white shadow-lg"
            style={{
              width: `${zoom * 8.5}px`, // 8.5 inches
              minHeight: `${zoom * 11}px`, // 11 inches
              transform: `scale(${zoom / 100})`,
              transformOrigin: 'top center',
              marginBottom: '2rem'
            }}
          >
            <div style={{ 
              padding: `${zoom * 0.75}px`, // 0.75 inch margins
              fontFamily: 'Times New Roman, serif',
              fontSize: `${zoom * 0.12}px`, // 12pt
              lineHeight: 1.5,
              color: '#000'
            }}>
              
              {/* Header */}
              <div style={{ 
                textAlign: 'center', 
                fontWeight: 'bold', 
                fontSize: `${zoom * 0.16}px`,
                marginBottom: `${zoom * 0.2}px`
              }}>
                AFFIDAVIT
              </div>
              
              {/* Venue */}
              <div style={{ 
                textAlign: 'center', 
                fontWeight: 'bold',
                fontSize: `${zoom * 0.14}px`,
                marginBottom: `${zoom * 0.3}px`
              }}>
                {affidavitData.state ? `State of ${affidavitData.state === 'TX' ? 'Texas' : affidavitData.state === 'UT' ? 'Utah' : affidavitData.state === 'AZ' ? 'Arizona' : affidavitData.state}` : 'State of [STATE]'}
                <br />
                {affidavitData.county ? `County of ${affidavitData.county}` : 'County of [COUNTY]'}
              </div>
              
              {/* Introduction */}
              <div style={{ marginBottom: `${zoom * 0.3}px` }}>
                I, <strong>{affidavitData.affiantName || '[AFFIANT NAME]'}</strong>, being of legal age and competent to testify, do hereby swear and affirm under penalty of perjury that the following statements are true and correct to the best of my knowledge:
              </div>
              
              {/* Facts */}
              <div style={{ marginBottom: `${zoom * 0.3}px` }}>
                {affidavitData.facts && affidavitData.facts.length > 0 ? (
                  <ol style={{ paddingLeft: `${zoom * 0.3}px` }}>
                    {affidavitData.facts.map((fact, index) => (
                      <li key={index} style={{ marginBottom: `${zoom * 0.15}px` }}>
                        {typeof fact === 'object' ? fact.content : fact}
                      </li>
                    ))}
                  </ol>
                ) : (
                  <div style={{ fontStyle: 'italic', color: '#666' }}>
                    [Facts will be listed here as you provide them in the chat]
                  </div>
                )}
              </div>
              
              {/* Signature Block */}
              <div style={{ marginTop: `${zoom * 0.4}px` }}>
                <div>I declare under penalty of perjury that the foregoing is true and correct.</div>
                <div style={{ marginTop: `${zoom * 0.3}px` }}>
                  <div style={{ 
                    borderBottom: '1px solid #000', 
                    width: `${zoom * 3}px`, 
                    marginBottom: `${zoom * 0.1}px`
                  }}></div>
                  <div>{affidavitData.affiantName || '[AFFIANT NAME]'}</div>
                  <div style={{ marginTop: `${zoom * 0.2}px` }}>
                    Date: _______________
                  </div>
                </div>
              </div>
              
              {/* Notary Block */}
              <div style={{ 
                border: '1px solid #000', 
                padding: `${zoom * 0.2}px`, 
                marginTop: `${zoom * 0.4}px`,
                backgroundColor: '#f9f9f9',
                fontSize: '0.9em'
              }}>
                <div style={{ fontWeight: 'bold', marginBottom: `${zoom * 0.1}px` }}>
                  NOTARIZATION
                </div>
                <div>
                  Subscribed and sworn to before me this _____ day of _________, 20___.
                </div>
                <div style={{ marginTop: `${zoom * 0.2}px` }}>
                  <div style={{ 
                    borderBottom: '1px solid #000', 
                    width: `${zoom * 2.5}px`, 
                    marginBottom: `${zoom * 0.1}px`
                  }}></div>
                  <div>Notary Public</div>
                  <div>My commission expires: _______________</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Footer */}
      <div className="px-4 py-2 border-t bg-gray-50 text-xs text-gray-500 flex-shrink-0">
        <div className="flex justify-between items-center">
          <span>Discover.Legal • Professional Affidavit Creation</span>
          <span>{affidavitData.state || 'No state'} • {zoom}% • Page 1</span>
        </div>
      </div>
    </div>
  );
};

// Simple Chat Interface with Streaming
const ChatInterface = ({ affidavitData, onDataUpdate }) => {
  const { getAccessTokenSilently } = useAuth0();
  const [messages, setMessages] = useState([
    {
      id: 1,
      type: 'bot',
      content: "Hi! I'm here to help you create a professional affidavit. I can help with Texas, Utah, or Arizona. To get started, which state is your case in?"
    }
  ]);
  
  const [currentMessage, setCurrentMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState('');
  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingMessage]);

  const handleSendMessage = async () => {
    if (!currentMessage.trim() || isLoading) return;

    const userMessage = {
      id: messages.length + 1,
      type: 'user',
      content: currentMessage
    };

    setMessages(prev => [...prev, userMessage]);
    const messageToSend = currentMessage;
    setCurrentMessage('');
    setIsLoading(true);
    setStreamingMessage('');

    try {
      const token = await getAccessTokenSilently();
      const response = await fetch(`${API_BASE_URL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          message: messageToSend,
          conversationHistory: messages,
          currentData: affidavitData,
          documentId: affidavitData.documentId
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedResponse = '';
      let extractedData = null;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.type === 'token') {
                accumulatedResponse += data.content;
                setStreamingMessage(accumulatedResponse);
              } else if (data.type === 'data') {
                extractedData = data.affidavitData;
              } else if (data.type === 'done') {
                // Streaming complete
                const botMessage = {
                  id: messages.length + 2,
                  type: 'bot',
                  content: accumulatedResponse
                };
                
                setMessages(prev => [...prev, botMessage]);
                setStreamingMessage('');
                
                // Update affidavit data
                if (extractedData) {
                  onDataUpdate(extractedData);
                }
              }
            } catch (e) {
              console.error('Error parsing streaming data:', e);
            }
          }
        }
      }
    } catch (error) {
      console.error('Chat error:', error);
      setStreamingMessage('');
      const errorMessage = {
        id: messages.length + 2,
        type: 'bot',
        content: "I'm having trouble connecting right now. Please try again."
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div key={message.id} className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
              message.type === 'user'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-900'
            }`}>
              {message.content}
            </div>
          </div>
        ))}
        
        {/* Streaming message */}
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
            <div className="bg-gray-100 text-gray-900 px-4 py-2 rounded-lg">
              <Loader className="h-4 w-4 animate-spin" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      
      <div className="border-t p-4">
        <div className="flex space-x-2">
          <input
            type="text"
            value={currentMessage}
            onChange={(e) => setCurrentMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder="Type your message..."
            className="flex-1 border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isLoading}
          />
          <button
            onClick={handleSendMessage}
            disabled={isLoading || !currentMessage.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
};

// Enhanced Validation Sidebar with Fact Management
const ValidationSidebar = ({ affidavitData, onDataUpdate }) => {
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

  // Category colors for visual organization
  const getCategoryColor = (category) => {
    const colors = {
      financial: 'bg-green-100 text-green-800',
      behavioral: 'bg-blue-100 text-blue-800',
      temporal: 'bg-purple-100 text-purple-800',
      relational: 'bg-pink-100 text-pink-800',
      property: 'bg-yellow-100 text-yellow-800',
      communication: 'bg-indigo-100 text-indigo-800',
      witness: 'bg-red-100 text-red-800',
      general: 'bg-gray-100 text-gray-800'
    };
    return colors[category] || colors.general;
  };

  // Get fact categories summary
  const getFactsSummary = () => {
    if (!affidavitData.facts || affidavitData.facts.length === 0) return null;
    
    const categoryCounts = {};
    affidavitData.facts.forEach(fact => {
      const category = fact.category || 'general';
      categoryCounts[category] = (categoryCounts[category] || 0) + 1;
    });
    
    return categoryCounts;
  };

  const factsSummary = getFactsSummary();

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
            <div>
              <input
                type="text"
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                className="w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Enter full legal name"
                autoFocus
              />
              <div className="flex space-x-1 mt-2">
                <button
                  onClick={handleSaveName}
                  className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                >
                  Save
                </button>
                <button
                  onClick={handleCancelEdit}
                  className="px-2 py-1 text-xs bg-gray-400 text-white rounded hover:bg-gray-500"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="text-sm text-gray-900">
              {affidavitData.affiantName || (
                <span className="text-gray-400 italic">Click "Edit" to add name</span>
              )}
            </div>
          )}
        </div>

        {/* State (read-only for now) */}
        <div className="mb-4 p-3 bg-white rounded-lg border">
          <label className="text-sm font-medium text-gray-700 block mb-1">State</label>
          <div className="text-sm text-gray-900">
            {affidavitData.state ? (
              `${affidavitData.state} (${affidavitData.state === 'TX' ? 'Texas' : affidavitData.state === 'UT' ? 'Utah' : 'Arizona'})`
            ) : (
              <span className="text-gray-400 italic">Not specified</span>
            )}
          </div>
        </div>
      </div>

      {/* Facts Management */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-medium">Facts & Statements</h4>
          {factsSummary && (
            <span className="text-xs text-gray-500">
              {Object.values(factsSummary).reduce((a, b) => a + b, 0)} total
            </span>
          )}
        </div>

        {/* Facts Summary */}
        {factsSummary && (
          <div className="mb-3">
            <div className="flex flex-wrap gap-1">
              {Object.entries(factsSummary).map(([category, count]) => (
                <span
                  key={category}
                  className={`px-2 py-1 text-xs rounded-full ${getCategoryColor(category)}`}
                >
                  {category}: {count}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Facts List */}
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {affidavitData.facts && affidavitData.facts.length > 0 ? (
            affidavitData.facts.map((fact, index) => (
              <div key={index} className="p-2 bg-white rounded border text-xs">
                <div className="flex items-start justify-between mb-1">
                  <span className={`px-1.5 py-0.5 text-xs rounded ${getCategoryColor(fact.category || 'general')}`}>
                    {fact.category || 'general'}
                  </span>
                  <div className="flex space-x-1">
                    <button
                      onClick={() => handleEditFact(index, fact.content)}
                      className="text-blue-600 hover:text-blue-800"
                      title="Edit fact"
                    >
                      <Edit3 className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => handleDeleteFact(index)}
                      className="text-red-600 hover:text-red-800"
                      title="Delete fact"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                </div>
                
                {editingFactId === index ? (
                  <div>
                    <textarea
                      value={editedFactContent}
                      onChange={(e) => setEditedFactContent(e.target.value)}
                      className="w-full px-2 py-1 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                      rows="3"
                      autoFocus
                    />
                    <div className="flex space-x-1 mt-1">
                      <button
                        onClick={() => handleSaveFact(index)}
                        className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                      >
                        Save
                      </button>
                      <button
                        onClick={handleCancelFactEdit}
                        className="px-2 py-1 text-xs bg-gray-400 text-white rounded hover:bg-gray-500"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-gray-800 text-xs leading-tight">
                    {fact.content || fact}
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="text-center py-4 text-gray-400 italic text-xs">
              No facts added yet. Start chatting to add facts automatically.
            </div>
          )}
        </div>
      </div>
      
      {/* Required Fields Status */}
      <div className="mb-6">
        <h4 className="font-medium mb-3">Required Information</h4>
        <div className="space-y-2">
          <div className="flex items-center">
            {affidavitData.affiantName ? 
              <CheckCircle className="h-4 w-4 text-green-600 mr-2" /> : 
              <AlertTriangle className="h-4 w-4 text-yellow-600 mr-2" />
            }
            <span className={affidavitData.affiantName ? 'text-green-700' : 'text-gray-600'}>
              Affiant Name
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
      
      {/* Coming Soon Section */}
      <div className="mb-6 p-3 bg-blue-50 rounded-lg border border-blue-200">
        <h4 className="font-medium text-blue-800 mb-2 text-sm">Coming Soon</h4>
        <div className="text-xs text-blue-600 space-y-1">
          <div className="flex items-center">
            <Clock className="h-3 w-3 mr-1" />
            <span>Fact Validation</span>
          </div>
          <div className="text-blue-500">
            AI-powered relevance checking and legal adequacy validation
          </div>
        </div>
      </div>
      
      {/* Actions */}
      <div className="space-y-3">
        <button className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300">
          Save Draft
        </button>
        <button 
          className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          disabled={!affidavitData.affiantName || !affidavitData.state}
        >
          Generate PDF ($39.99)
        </button>
      </div>
    </div>
  );
};

// Dashboard Component
const Dashboard = ({ onCreateNew, onOpenDocument }) => {
  const { getAccessTokenSilently, logout, user, isLoading: authLoading } = useAuth0();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!authLoading) {
      loadDocuments();
    }
  }, [authLoading]);

  const loadDocuments = async () => {
    try {
      setLoading(true);
      setError(null);
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
        const errorData = await response.json();
        setError(errorData.error || 'Failed to load documents');
      }
    } catch (err) {
      setError('Failed to load documents');
      console.error('Load documents error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader className="h-8 w-8 animate-spin mx-auto text-blue-600 mb-4" />
          <p className="text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <Gavel className="h-8 w-8 text-blue-600 mr-3" />
              <h1 className="text-2xl font-bold text-gray-900">Discover.Legal</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-gray-600">Welcome, {user?.name}</span>
              <button
                onClick={() => logout({ returnTo: window.location.origin })}
                className="flex items-center text-gray-600 hover:text-gray-900"
              >
                <LogOut className="h-4 w-4 mr-1" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Dashboard</h2>
          <p className="text-gray-600">Create new affidavits or continue working on your drafts.</p>
        </div>

        {/* Create New Button */}
        <div className="mb-8">
          <button 
            onClick={onCreateNew}
            className="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
          >
            <PlusCircle className="h-5 w-5 mr-2" />
            Create New Affidavit
          </button>
        </div>

        {/* Documents List */}
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="px-6 py-4 border-b">
            <h3 className="text-lg font-semibold text-gray-900">Your Documents</h3>
          </div>
          
          {error && (
            <div className="px-6 py-4 bg-red-50 border-b">
              <p className="text-red-600">{error}</p>
              <button 
                onClick={loadDocuments}
                className="mt-2 text-red-600 hover:text-red-800 underline"
              >
                Try Again
              </button>
            </div>
          )}

          <div className="p-6">
            {documents.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 mb-4">No documents yet</p>
                <button 
                  onClick={onCreateNew}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Create Your First Affidavit
                </button>
              </div>
            ) : (
              <ul className="space-y-4">
                {documents.map((doc) => (
                  <li key={doc.id} className="border rounded-lg p-4 hover:bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h4 className="text-lg font-semibold text-blue-700">
                          {doc.content?.affiantName ? `${doc.content.affiantName}'s Affidavit` : `Affidavit #${doc.id}`}
                        </h4>
                        <div className="flex items-center space-x-4 text-sm text-gray-500 mt-1">
                          <span>State: <span className="font-medium">{doc.content?.state || 'N/A'}</span></span>
                          <span>Status: <span className="font-medium">{doc.status}</span></span>
                          <span>Updated: {new Date(doc.updated_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => onOpenDocument(doc)}
                          className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold"
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
      </main>
    </div>
  );
};

// Resizer Component
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
    if (affidavitData.state || affidavitData.affiantName || (affidavitData.facts && affidavitData.facts.length > 0)) {
      generatePreview();
    }
  }, [affidavitData]);

  const generatePreview = async () => {
    setIsPreviewLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/preview`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ affidavitData })
      });

      if (response.ok) {
        const result = await response.json();
        setPreview(result.preview);
      }
    } catch (error) {
      console.error('Preview error:', error);
    } finally {
      setIsPreviewLoading(false);
    }
  };

  // Handle real-time data updates from chat
  const handleDataUpdate = (newData) => {
    setAffidavitData(prev => ({ ...prev, ...newData }));
  };

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-sm border-b px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <button
              onClick={onBack}
              className="mr-4 p-2 text-gray-500 hover:text-gray-700"
            >
              ← Back
            </button>
            <div className="flex items-center">
              <Gavel className="h-6 w-6 text-blue-600 mr-2" />
              <h1 className="text-xl font-semibold">
                {existingDocument ? 'Edit Affidavit' : 'Create New Affidavit'}
              </h1>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content - Chat | Preview | Validation */}
      <div className="flex-1 flex min-h-0">
        {/* Chat Panel */}
        <div 
          className="bg-white border-r flex flex-col"
          style={{ width: `${chatWidth}%` }}
        >
          <ChatInterface
            affidavitData={affidavitData}
            onDataUpdate={handleDataUpdate}
          />
        </div>

        {/* Resizer */}
        <Resizer
          onResize={setChatWidth}
          isResizing={isResizing}
          setIsResizing={setIsResizing}
        />

        {/* Preview Panel */}
        <div 
          className="bg-gray-50 flex flex-col min-h-0"
          style={{ width: `${100 - chatWidth - 20}%` }} // Reserve space for validation
        >
          <DocumentPreview
            affidavitData={affidavitData}
            preview={preview}
            isLoading={isPreviewLoading}
          />
        </div>

        {/* Validation Sidebar - On the far right */}
        <div className="w-80 bg-gray-50 border-l">
          <ValidationSidebar 
            affidavitData={affidavitData} 
            onDataUpdate={handleDataUpdate}
          />
        </div>
      </div>
    </div>
  );
};

// Main App Component
const App = () => {
  const [currentView, setCurrentView] = useState('landing');
  const [selectedDocument, setSelectedDocument] = useState(null);

  const handleGetStarted = () => {
    setCurrentView('dashboard');
  };

  const handleCreateNew = () => {
    setSelectedDocument(null);
    setCurrentView('editor');
  };

  const handleOpenDocument = (document) => {
    setSelectedDocument(document);
    setCurrentView('editor');
  };

  const handleBackToDashboard = () => {
    setCurrentView('dashboard');
    setSelectedDocument(null);
  };

  const renderCurrentView = () => {
    switch (currentView) {
      case 'landing':
        return <LandingPage onGetStarted={handleGetStarted} />;
      case 'dashboard':
        return (
          <Dashboard
            onCreateNew={handleCreateNew}
            onOpenDocument={handleOpenDocument}
          />
        );
      case 'editor':
        return (
          <DocumentEditor
            existingDocument={selectedDocument}
            onBack={handleBackToDashboard}
          />
        );
      default:
        return <LandingPage onGetStarted={handleGetStarted} />;
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