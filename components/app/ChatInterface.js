'use client';

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
  ChevronUp,
  Upload,
  MapPin
} from 'lucide-react';
import { useAuth0 } from '@/lib/auth0-client';
import { useDocumentData, useDocumentActions } from '@/contexts/DocumentContext';
import DocumentMetadata from './DocumentMetadata';
import EvidenceUploadModal from './EvidenceUploadModal';

// TX Divorce phase metadata (mirrors services/agents/prompts/txDivorce/index.js)
const TX_DIVORCE_PHASE_ORDER = [
  'INTAKE', 'RESIDENCY', 'GROUNDS', 'CHILDREN', 'PROPERTY',
  'SUPPORT', 'SERVICE', 'INDIGENCY', 'MILITARY', 'REVIEW'
];
const TX_DIVORCE_PHASE_NAMES = {
  INTAKE:    'Getting Started',
  RESIDENCY: 'Texas Residency',
  GROUNDS:   'Grounds & Marriage',
  CHILDREN:  'Children',
  PROPERTY:  'Property & Assets',
  SUPPORT:   'Support & Finances',
  SERVICE:   'Service of Process',
  INDIGENCY: 'Filing Fees',
  MILITARY:  'Military Status',
  REVIEW:    'Final Review'
};

// Supported states for document creation
const SUPPORTED_STATES = [
  { code: 'TX', name: 'Texas' },
  { code: 'UT', name: 'Utah' },
  { code: 'AZ', name: 'Arizona' },
  { code: 'CA', name: 'California' },
  { code: 'FL', name: 'Florida' },
  { code: 'IL', name: 'Illinois' },
  { code: 'NY', name: 'New York' }
];

// Use relative URLs in production (empty string), localhost in development
const API_BASE_URL = '';

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

  // Use split contexts to prevent unnecessary re-renders
  const { currentDocument } = useDocumentData();
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
            const greeting = currentDocument.firstName
              ? `Hi ${currentDocument.firstName}, welcome back!`
              : currentDocument.affiantName
              ? `Hi ${currentDocument.affiantName}, welcome back!`
              : 'Hi, welcome back!';
            setMessages([{
              type: 'bot',
              content: greeting
            }]);
          }
        } else {
          // New user - show welcome message based on document type
          console.log('👋 Showing welcome message for new document');
          const isDivorcePackage = currentDocument.documentType === 'divorce_package' || currentDocument.documentType === 'divorce_petition' || currentDocument.documentType === 'divorce_decree';

          if (isDivorcePackage) {
            setMessages([{
              type: 'bot',
              content: `Hi! I'm here to help you create your divorce package, which includes both your Divorce Petition and Divorce Decree.

First, please select your state above. Each state has different requirements for divorce documents, and I need to know your state to ensure your documents are legally compliant.`
            }]);
          } else {
            setMessages([{
              type: 'bot',
              content: `Hi! I'm here to help you create your affidavit. I'll ask you questions to gather the facts and build your document.

First, please select your state above. Each state has different legal requirements, and I need to know your state to ensure your affidavit is compliant.`
            }]);
          }
        }
      }
    }
  }, [currentDocument.documentId, currentDocument.facts, currentDocument.affiantName, currentDocument.documentType, currentDocument.firstName, generateFactSummary]);

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

      console.log('🔍 Chat API Response:', {
        success: data.success,
        hasNewFacts: !!data.newFacts,
        newFactsCount: data.newFacts?.length || 0,
        newFacts: data.newFacts
      });

      if (data.success) {
        // Check for evidence items that need upload
        let evidenceItems = [];
        if (data.newFacts && data.newFacts.length > 0) {
          console.log('🔍 Checking for evidence in newFacts:', data.newFacts);

          evidenceItems = data.newFacts.filter(fact => {
            console.log('Checking fact:', { type: fact.type, isEvidence: fact.type === 'evidence', fact });
            return fact.type === 'evidence';
          });

          console.log('🔍 Evidence items found:', evidenceItems.length, evidenceItems);
        }

        // Add bot response with evidence items attached
        setMessages(prev => [...prev, {
          type: 'bot',
          content: data.response,
          evidenceItems: evidenceItems.length > 0 ? evidenceItems : undefined
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

  // TX Divorce phase progress
  const isDivorceDoc = ['divorce_package', 'divorce_petition', 'divorce_decree'].includes(currentDocument.documentType);
  const isTXDivorce = isDivorceDoc && (!currentDocument.state || currentDocument.state === 'TX');
  const orchestratorPhase = currentDocument.orchestratorState?.currentPhase;
  const currentPhaseIndex = orchestratorPhase ? TX_DIVORCE_PHASE_ORDER.indexOf(orchestratorPhase) : -1;
  const phaseProgress = currentPhaseIndex >= 0
    ? Math.round(((currentPhaseIndex + 1) / TX_DIVORCE_PHASE_ORDER.length) * 100)
    : 0;

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* State Selector - Shows prominently when no state is selected */}
      {!currentDocument.state && (
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 border-b border-blue-100 p-4">
          <div className="flex items-center gap-2 mb-3">
            <MapPin className="h-5 w-5 text-blue-600" />
            <span className="font-semibold text-gray-800">Select Your State</span>
            <span className="text-xs text-red-500 font-medium">(Required)</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {SUPPORTED_STATES.map((state) => (
              <button
                key={state.code}
                onClick={() => {
                  updateDocumentData({ state: state.code });
                  // Add a message confirming state selection
                  const isDivorcePackage = currentDocument.documentType === 'divorce_package' || currentDocument.documentType === 'divorce_petition' || currentDocument.documentType === 'divorce_decree';
                  setMessages(prev => [...prev, {
                    type: 'bot',
                    content: `Great! You've selected ${state.name}. ${isDivorcePackage
                      ? `I'll make sure your divorce documents comply with ${state.name} requirements.`
                      : `I'll make sure your affidavit complies with ${state.name} requirements.`
                    }\n\nNow, let's start with your legal first and last name.`
                  }]);
                }}
                className="px-3 py-2 bg-white border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all text-sm font-medium text-gray-700 hover:text-blue-700"
              >
                {state.code} - {state.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* TX Divorce Phase Progress Strip */}
      {isTXDivorce && orchestratorPhase && (
        <div className="bg-indigo-50 border-b border-indigo-100 px-4 py-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-indigo-700">
              Step {currentPhaseIndex + 1} of {TX_DIVORCE_PHASE_ORDER.length}:{' '}
              {TX_DIVORCE_PHASE_NAMES[orchestratorPhase] || orchestratorPhase}
            </span>
            <span className="text-xs text-indigo-400">{phaseProgress}% complete</span>
          </div>
          <div className="h-1.5 bg-indigo-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-500 rounded-full transition-all duration-500"
              style={{ width: `${phaseProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Document details must remain reachable on phones as well as desktop. */}
      <div className="border-b bg-white">
        <button
          onClick={() => setShowMetadata(!showMetadata)}
          type="button"
          aria-expanded={showMetadata}
          aria-controls="document-metadata-panel"
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
          <div id="document-metadata-panel" className="absolute inset-0 bg-white z-10 overflow-y-auto p-3 shadow-lg">
            <DocumentMetadata />
          </div>
        )}
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`max-w-[80%] rounded-lg ${
              msg.type === 'user'
                ? 'bg-blue-600 text-white p-3'
                : msg.isError
                ? 'bg-red-50 text-red-900 border border-red-200 p-3'
                : 'bg-white text-gray-800 shadow-sm'
            }`}>
              <div className={msg.type === 'user' || msg.isError ? '' : 'p-3'}>
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

              {/* Evidence Upload Buttons */}
              {msg.type === 'bot' && msg.evidenceItems && msg.evidenceItems.length > 0 && (
                <div className="border-t border-gray-100 px-3 py-2 space-y-2">
                  {msg.evidenceItems.map((evidence, evidenceIndex) => (
                    <button
                      key={evidenceIndex}
                      onClick={() => {
                        setCurrentEvidence(evidence);
                        setShowEvidenceUpload(true);
                      }}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-md transition-colors text-sm font-medium"
                    >
                      <Upload className="h-4 w-4" />
                      Upload {evidence.evidenceData?.description || 'Evidence'}
                    </button>
                  ))}
                </div>
              )}
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
          <div className="mb-2 flex items-center justify-center gap-4 text-sm">
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

        {/* AI Disclaimer */}
        <div className="mb-2 text-xs text-gray-500 text-center">
          AI can make mistakes. Verify important information.
        </div>

        {/* Message Input */}
        <form onSubmit={sendMessage} className="flex gap-2">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={currentDocument.state ? "Type your message..." : "Please select your state above first..."}
            className={`flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
              !currentDocument.state ? 'border-orange-300 bg-orange-50' : 'border-gray-300'
            }`}
            disabled={isLoading || !currentDocument.state}
          />
          <button
            type="submit"
            disabled={isLoading || !message.trim() || !currentDocument.state}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              isLoading || !message.trim() || !currentDocument.state
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
          // Update the fact in the document by matching ID (not reference)
          const updatedFacts = (currentDocument.facts || []).map(fact =>
            fact.id === currentEvidence?.id ? updatedEvidence : fact
          );
          updateDocumentData({
            ...currentDocument,
            facts: updatedFacts
          });
          setShowEvidenceUpload(false);
        }}
        evidence={currentEvidence}
        documentId={currentDocument?.documentId}
      />
    </div>
  );
};

export default ChatInterface;
