// client/src/components/ChatInterface.js - FIXED VERSION
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Send,
  Bot,
  User,
  ArrowDown,
  Check,
  AlertCircle,
  Loader,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { useAuth0 } from '@auth0/auth0-react';
import { useDocumentState, useDocumentActions } from '../contexts/DocumentContext';
import DocumentMetadata from './DocumentMetadata';
import EvidenceUploadModal from './EvidenceUploadModal';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

const ChatInterface = () => {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [showMetadata, setShowMetadata] = useState(false);
  const [showEvidenceUpload, setShowEvidenceUpload] = useState(false);
  const [currentEvidence, setCurrentEvidence] = useState(null);

  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);
  const currentDocumentIdRef = useRef(null);
  const welcomeMessageShownRef = useRef(false);

  // Use DocumentContext
  const { currentDocument } = useDocumentState();
  const { updateDocumentData } = useDocumentActions();
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();

  // Helper function to generate a signature for facts (used for caching)
  const generateFactSignature = (facts) => {
    if (!facts || facts.length === 0) return '';

    // Create a simple signature by stringifying fact contents
    const factContents = facts.map(fact =>
      typeof fact === 'string' ? fact : fact.content
    );
    return JSON.stringify(factContents);
  };

  // Helper function to generate AI narrative summary of facts with caching
  const generateFactSummary = useCallback(async (facts, affiantName) => {
    if (!facts || facts.length === 0) return '';

    // Generate signature for current facts
    const currentSignature = generateFactSignature(facts);

    // Check if we have a cached summary for these facts
    if (currentDocument.factSummary && currentDocument.factSignature === currentSignature) {
      console.log('✅ Using cached fact summary');
      return currentDocument.factSummary;
    }

    console.log('🔄 Generating new fact summary');

    try {
      const headers = { 'Content-Type': 'application/json' };

      if (isAuthenticated) {
        const token = await getAccessTokenSilently();
        headers.Authorization = `Bearer ${token}`;
      }

      const factList = facts.map(fact =>
        typeof fact === 'string' ? fact : fact.content
      ).join('\n- ');

      const nameInstruction = affiantName
        ? ` IMPORTANT: Address the person directly using "you" and "your" instead of using the name "${affiantName}". For example, say "you went to the store" instead of "${affiantName} went to the store".`
        : '';

      const response = await fetch(`${API_BASE_URL}/api/chat`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          message: `Please provide a brief 1-paragraph narrative summary (2-3 sentences) that brings together these facts, starting with "So far, you've shared that...": ${factList}${nameInstruction}`,
          conversationHistory: [],
          affidavitData: currentDocument,
          skipExtraction: true // Don't extract new facts from this
        })
      });

      if (!response.ok) {
        throw new Error('Failed to generate summary');
      }

      const data = await response.json();
      const summary = data.success ? data.response : `You've added ${facts.length} fact${facts.length !== 1 ? 's' : ''} to your affidavit.`;

      // Cache the summary in document state
      updateDocumentData({
        factSummary: summary,
        factSignature: currentSignature
      });

      return summary;
    } catch (err) {
      console.error('Error generating fact summary:', err);
      // Fallback to simple list
      return `You've added ${facts.length} fact${facts.length !== 1 ? 's' : ''} to your affidavit.`;
    }
  }, [currentDocument, updateDocumentData, isAuthenticated, getAccessTokenSilently]);

  // Reset messages when document changes and show welcome message
  useEffect(() => {
    const newDocId = currentDocument.documentId;
    const prevDocId = currentDocumentIdRef.current;

    // If documentId changed (including null -> value, value -> null, or value -> different value)
    if (newDocId !== prevDocId) {
      console.log('📄 Document ID changed, clearing messages', {
        from: prevDocId,
        to: newDocId
      });

      // Clear messages and reset welcome flag
      setMessages([]);
      welcomeMessageShownRef.current = false;

      // Update the ref to track the new documentId
      currentDocumentIdRef.current = newDocId;

      // If we have a new documentId (not null), show welcome message immediately
      if (newDocId) {
        welcomeMessageShownRef.current = true;

        const isReturningUser = currentDocument.facts?.length > 0 || currentDocument.affiantName;

        if (isReturningUser) {
          // Returning user - show welcome back message
          const hasFacts = currentDocument.facts?.length > 0;

          if (hasFacts) {
            // Show welcome with fact count, then generate summary asynchronously
            const greeting = currentDocument.affiantName
              ? `Hi ${currentDocument.affiantName}, welcome back! I see you have ${currentDocument.facts.length} fact${currentDocument.facts.length !== 1 ? 's' : ''}. Give me a second to summarize them...`
              : `Hi, welcome back! I see you have ${currentDocument.facts.length} fact${currentDocument.facts.length !== 1 ? 's' : ''}. Give me a second to summarize them...`;

            setMessages([{
              type: 'bot',
              content: greeting
            }]);

            // Generate summary asynchronously
            generateFactSummary(currentDocument.facts, currentDocument.affiantName).then(factSummary => {
              if (factSummary) {
                setMessages(prev => [...prev, {
                  type: 'bot',
                  content: factSummary + '\n\nWhat would you like to add or update today?'
                }]);
              }
            });
          } else {
            // Has name but no facts
            const greeting = currentDocument.affiantName
              ? `Hi ${currentDocument.affiantName}, welcome back!`
              : 'Hi, welcome back!';
            setMessages([{
              type: 'bot',
              content: greeting
            }]);
          }
        } else {
          // New user - show welcome message
          console.log('👋 Showing welcome message for new affidavit');
          setMessages([{
            type: 'bot',
            content: `Hi! I'm here to help you create your affidavit. I'll ask you questions to gather the facts and build your document.

Let's start with your name and which state you're in.`
          }]);
        }
      }
    }
  }, [currentDocument.documentId, currentDocument.facts, currentDocument.affiantName, generateFactSummary]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (isAtBottom) {
      scrollToBottom();
    }
  }, [messages, isAtBottom]);

  // Check scroll position
  const handleScroll = () => {
    if (chatContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
      const isBottom = scrollHeight - scrollTop - clientHeight < 10;
      setIsAtBottom(isBottom);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Send message to API
  const sendMessage = async (e) => {
    e.preventDefault();
    
    if (!message.trim() || isLoading) return;

    const userMessage = message.trim();
    setMessage('');

    // Add user message to chat
    setMessages(prev => [...prev, { type: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const headers = { 'Content-Type': 'application/json' };
      
      if (isAuthenticated) {
        const token = await getAccessTokenSilently();
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await fetch(`${API_BASE_URL}/api/chat`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          message: userMessage,
          conversationHistory: messages.slice(-10), // Last 10 messages for context
          affidavitData: currentDocument
        })
      });

      if (!response.ok) {
        throw new Error(`Chat API error: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success) {
        // Add bot response
        setMessages(prev => [...prev, {
          type: 'bot',
          content: data.response
        }]);

        // Update document if data changed
        if (data.affidavitData) {
          console.log('📝 Chat updated document:', {
            hasName: !!data.affidavitData.affiantName,
            hasState: !!data.affidavitData.state,
            factCount: data.affidavitData.facts?.length || 0
          });

          updateDocumentData(data.affidavitData);
        }

        // Check for evidence items that need upload
        if (data.newFacts && data.newFacts.length > 0) {
          const evidenceItems = data.newFacts.filter(fact => fact.type === 'evidence');

          if (evidenceItems.length > 0) {
            // Show upload modal for first evidence item
            const firstEvidence = evidenceItems[0];
            console.log('🔍 Evidence detected in chat:', firstEvidence.evidenceData?.description);

            setCurrentEvidence(firstEvidence);
            setShowEvidenceUpload(true);
          }
        }

        // Handle any additional actions
        if (data.action === 'validate') {
          // Validation will be triggered by ValidationSidebar
        }
      } else {
        throw new Error(data.error || 'Chat processing failed');
      }
    } catch (err) {
      console.error('Chat error:', err);

      setMessages(prev => [...prev, {
        type: 'bot',
        content: `I'm sorry, I encountered an error: ${err.message}. Please try again.`,
        isError: true
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Document Metadata Button - Only visible on tablet+ screens */}
      <div className="hidden md:block border-b bg-white">
        <button
          onClick={() => setShowMetadata(!showMetadata)}
          className={`w-full px-4 py-3 flex items-center justify-between transition-colors ${
            showMetadata
              ? 'bg-gray-200 hover:bg-gray-300'
              : 'hover:bg-gray-50'
          }`}
        >
          <span className="font-medium">Document Details</span>
          {showMetadata ? (
            <ChevronUp className="h-5 w-5 text-black" />
          ) : (
            <ChevronDown className="h-5 w-5 text-blue-600" />
          )}
        </button>
      </div>

      {/* Chat Messages */}
      <div
        ref={chatContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 space-y-4 relative"
      >
        {/* Document Metadata Overlay - Takes full chat area when open */}
        {showMetadata && (
          <div className="absolute inset-0 bg-white z-10 overflow-y-auto p-3 shadow-lg">
            <DocumentMetadata />
          </div>
        )}
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`max-w-[80%] p-3 rounded-lg ${
              msg.type === 'user' 
                ? 'bg-blue-600 text-white' 
                : msg.isError 
                ? 'bg-red-50 text-red-900 border border-red-200' 
                : 'bg-white text-gray-800 shadow-sm'
            }`}>
              <div className="flex items-start">
                {msg.type === 'bot' && (
                  <div className="mr-2 mt-0.5">
                    {msg.isError ? (
                      <AlertCircle className="h-4 w-4 text-red-600" />
                    ) : (
                      <Bot className="h-4 w-4 text-gray-600" />
                    )}
                  </div>
                )}
                <div className="whitespace-pre-wrap flex-1">{msg.content}</div>
                {msg.type === 'user' && (
                  <User className="h-4 w-4 ml-2 mt-0.5" />
                )}
              </div>
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white p-3 rounded-lg shadow-sm flex items-center">
              <Loader className="h-4 w-4 mr-2 animate-spin text-blue-600" />
              <span className="text-gray-600">Thinking...</span>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>
      
      {/* Scroll to bottom button */}
      {!isAtBottom && (
        <button 
          onClick={scrollToBottom}
          className="absolute bottom-20 right-4 bg-white shadow-lg rounded-full p-2 hover:bg-gray-50 transition-colors"
        >
          <ArrowDown className="h-5 w-5 text-gray-600" />
        </button>
      )}
      
      {/* Input Area */}
      <div className="border-t bg-white p-4">
        {/* Document Status */}
        {(currentDocument.affiantName || currentDocument.state) && (
          <div className="mb-3 flex items-center gap-4 text-sm">
            {currentDocument.affiantName && (
              <div className="flex items-center text-green-600">
                <Check className="h-3 w-3 mr-1" />
                <span>Name: {currentDocument.affiantName}</span>
              </div>
            )}
            {currentDocument.state && (
              <div className="flex items-center text-green-600">
                <Check className="h-3 w-3 mr-1" />
                <span>State: {currentDocument.state}</span>
              </div>
            )}
            {currentDocument.facts?.length > 0 && (
              <div className="flex items-center text-blue-600">
                <Check className="h-3 w-3 mr-1" />
                <span>{currentDocument.facts.length} fact{currentDocument.facts.length !== 1 ? 's' : ''}</span>
              </div>
            )}
          </div>
        )}
        
        {/* Message Input */}
        <form onSubmit={sendMessage} className="flex gap-2">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type your message..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !message.trim()}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              isLoading || !message.trim()
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            <Send className="h-5 w-5" />
          </button>
        </form>
      </div>

      {/* Evidence Upload Modal */}
      <EvidenceUploadModal
        isOpen={showEvidenceUpload}
        onClose={() => setShowEvidenceUpload(false)}
        onUploadSuccess={(updatedEvidence) => {
          console.log('✅ Evidence uploaded:', updatedEvidence);
          // Update the fact in the document
          const updatedFacts = (currentDocument.facts || []).map(fact =>
            fact === currentEvidence ? updatedEvidence : fact
          );
          updateDocumentData({
            ...currentDocument,
            facts: updatedFacts
          });
          setShowEvidenceUpload(false);
        }}
        evidence={currentEvidence}
        documentId={currentDocument?.id}
      />
    </div>
  );
};

export default ChatInterface;