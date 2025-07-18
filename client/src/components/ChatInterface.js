// client/src/components/ChatInterface.js - Exactly matched height
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { useAuth0 } from '@auth0/auth0-react';
import EnhancedValidationDisplay from './EnhancedValidationDisplay';
import { useCountyValidation } from '../hooks/useCountyValidation';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3001';

const ChatInterface = ({ 
  affidavitData, 
  onDataUpdate, 
  onSaveSession, 
  documentComplete,
  onDocumentComplete,
  validation,
  onValidationUpdate
}) => {
  const { getAccessTokenSilently, loginWithRedirect, isAuthenticated } = useAuth0();
  const { validateCounty } = useCountyValidation();
  
  const [messages, setMessages] = useState([{
    id: 1,
    type: 'bot',
    content: affidavitData.affiantName 
      ? "Welcome back! I see you were working on an affidavit. Let's continue where you left off."
      : "Hi! I'm here to help you create a professional family law affidavit. I can help with divorce, custody, child support, and other family law matters in Texas, Utah, or Arizona. To get started, which state is your case in?"
  }]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState('');
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const [countyValidation, setCountyValidation] = useState(null);
  
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const abortControllerRef = useRef(null);
  const streamingTimeoutsRef = useRef([]);
  const chatContainerRef = useRef(null);

  // Auto-scroll to bottom when messages change
  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ 
        behavior: "smooth",
        block: "end"
      });
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingMessage, scrollToBottom]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
    }
  }, [input]);

  // Validate county when county or state changes
  useEffect(() => {
    if (affidavitData.county && affidavitData.state) {
      const timeoutId = setTimeout(async () => {
        try {
          const result = await validateCounty(affidavitData.county, affidavitData.state);
          setCountyValidation(result);
        } catch (error) {
          console.error('County validation failed:', error);
          setCountyValidation({
            isValid: false,
            reasoning: 'County validation service unavailable',
            confidence: 0.5,
            source: 'error'
          });
        }
      }, 1000); // Debounce county validation

      return () => clearTimeout(timeoutId);
    } else {
      setCountyValidation(null);
    }
  }, [affidavitData.county, affidavitData.state, validateCounty]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      streamingTimeoutsRef.current.forEach(timeoutId => clearTimeout(timeoutId));
    };
  }, []);

  const clearStreamingTimeouts = useCallback(() => {
    streamingTimeoutsRef.current.forEach(timeoutId => clearTimeout(timeoutId));
    streamingTimeoutsRef.current = [];
  }, []);

  const streamResponse = useCallback(async (response) => {
    clearStreamingTimeouts();
    const words = response.split(' ');
    let currentText = '';
    
    return new Promise((resolve) => {
      let index = 0;
      
      const streamNextWord = () => {
        if (index >= words.length) {
          setStreamingMessage('');
          resolve(currentText);
          return;
        }
        
        currentText += (index > 0 ? ' ' : '') + words[index];
        setStreamingMessage(currentText);
        index++;
        
        const timeoutId = setTimeout(streamNextWord, 50);
        streamingTimeoutsRef.current.push(timeoutId);
      };
      
      streamNextWord();
    });
  }, [clearStreamingTimeouts]);

  const handleAuthRequired = useCallback(() => {
    const userMessage = { 
      id: Date.now(), 
      type: 'user', 
      content: input.trim() 
    };
    
    const authPrompt = {
      id: Date.now() + 1,
      type: 'bot',
      content: "I'd love to help you create your affidavit! To save your progress and generate the final document, please sign in. You can continue our conversation after signing in.",
      action: 'auth_required'
    };
    
    setMessages(prev => [...prev, userMessage, authPrompt]);
    setInput('');
    
    setTimeout(() => {
      loginWithRedirect({
        appState: { returnTo: window.location.pathname }
      });
    }, 2000);
  }, [input, loginWithRedirect]);

  const sendMessage = async (retryMessage = null) => {
    const messageToSend = retryMessage || input.trim();
    if (!messageToSend || isLoading) return;

    setError(null);
    
    if (!isAuthenticated) {
      handleAuthRequired();
      return;
    }

    const userMessage = { 
      id: Date.now(), 
      type: 'user', 
      content: messageToSend 
    };
    
    if (!retryMessage) {
      setMessages(prev => [...prev, userMessage]);
      setInput('');
    }
    
    setIsLoading(true);
    abortControllerRef.current = new AbortController();

    try {
      const token = await getAccessTokenSilently({
        authorizationParams: { audience: process.env.REACT_APP_AUTH0_AUDIENCE }
      });
      
      const response = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({
          message: messageToSend,
          conversationHistory: messages.slice(-10),
          currentData: {
            ...affidavitData,
            countyValidation // Include county validation in context
          },
          documentId: affidavitData.documentId
        }),
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        if (response.status === 429) {
          throw new Error('AI service is busy. Please wait a moment and try again.');
        } else if (response.status === 401) {
          throw new Error('Authentication expired. Please refresh the page.');
        } else if (response.status >= 500) {
          throw new Error('Server error. Please try again in a moment.');
        } else {
          throw new Error(errorData.error || `Error: ${response.status}`);
        }
      }

      const data = await response.json();
      await handleChatResponse(data);
      setRetryCount(0);

    } catch (error) {
      if (error.name === 'AbortError') return;
      
      console.error('Chat error:', error);
      setError(error.message);
      
      const errorBotMessage = {
        id: Date.now() + 1,
        type: 'bot',
        content: `I'm sorry, there was an error: ${error.message}`,
        error: true,
        retryMessage: messageToSend
      };
      setMessages(prev => [...prev, errorBotMessage]);
      
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleChatResponse = async (data) => {
    if (data.success) {
      const streamedResponse = await streamResponse(data.response);
      const botMessage = { 
        id: Date.now() + 1, 
        type: 'bot', 
        content: streamedResponse 
      };
      setMessages(prev => [...prev, botMessage]);

      // Handle extracted data with county validation awareness
      if (data.extractedData) {
        const newData = { ...data.extractedData };
        
        // If county was extracted, validate it immediately
        if (newData.county && affidavitData.state) {
          try {
            const countyResult = await validateCounty(newData.county, affidavitData.state);
            setCountyValidation(countyResult);
            
            // If county is invalid but we have a suggestion, mention it in chat
            if (!countyResult.isValid && countyResult.normalizedCounty && countyResult.confidence > 0.7) {
              const suggestionMessage = {
                id: Date.now() + 2,
                type: 'bot',
                content: `I noticed you mentioned "${newData.county}" county. Did you mean "${countyResult.normalizedCounty}" county? I can update that for you.`,
                suggestion: {
                  type: 'county_correction',
                  original: newData.county,
                  suggested: countyResult.normalizedCounty
                }
              };
              setMessages(prev => [...prev, suggestionMessage]);
            }
          } catch (error) {
            console.error('County validation error:', error);
          }
        }
        
        onDataUpdate(newData);
      }
      
      if (data.validation) onValidationUpdate(data.validation);
      if (data.conversationComplete) onDocumentComplete(true);
      
      await onSaveSession();
    } else {
      const errorMessage = { 
        id: Date.now() + 1, 
        type: 'bot', 
        content: data.error || 'Sorry, I encountered an error.',
        error: true
      };
      setMessages(prev => [...prev, errorMessage]);
    }
  };

  const handleRetry = useCallback((retryMessage) => {
    if (retryCount < 3) {
      setRetryCount(prev => prev + 1);
      sendMessage(retryMessage);
    } else {
      setError('Too many retries. Please refresh the page and try again.');
    }
  }, [retryCount]);

  const handleCountyCorrection = useCallback((original, suggested) => {
    onDataUpdate({ county: suggested });
    
    const confirmationMessage = {
      id: Date.now(),
      type: 'bot',
      content: `Perfect! I've updated your county to "${suggested}".`
    };
    setMessages(prev => [...prev, confirmationMessage]);
  }, [onDataUpdate]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border h-full flex flex-col">
      {/* Compact Header */}
      <div className="p-4 border-b flex-shrink-0">
        <h2 className="text-lg font-semibold text-gray-900">AI Assistant</h2>
        <p className="text-sm text-gray-600">I'll guide you through creating your state-compliant affidavit.</p>
        
        {/* Enhanced validation display with county validation */}
        <EnhancedValidationDisplay 
          validation={validation} 
          countyValidation={countyValidation}
        />
        
        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center">
              <AlertCircle className="h-4 w-4 text-red-600 mr-2" />
              <span className="text-sm text-red-700">{error}</span>
            </div>
          </div>
        )}
      </div>
      
      {/* Messages Area - Exactly matched height with other components */}
      <div 
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-4"
        style={{ minHeight: 0 }}
      >
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className="max-w-xs lg:max-w-md">
              <div
                className={`px-4 py-2 rounded-lg ${
                  message.type === 'user'
                    ? 'bg-blue-600 text-white'
                    : message.error
                    ? 'bg-red-50 text-red-900 border border-red-200'
                    : 'bg-gray-100 text-gray-900'
                }`}
              >
                {message.content}
              </div>
              
              {/* County correction suggestion */}
              {message.suggestion?.type === 'county_correction' && (
                <button
                  onClick={() => handleCountyCorrection(
                    message.suggestion.original, 
                    message.suggestion.suggested
                  )}
                  className="mt-2 px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                >
                  Yes, use "{message.suggestion.suggested}"
                </button>
              )}
              
              {/* Retry button for error messages */}
              {message.error && message.retryMessage && retryCount < 3 && (
                <button
                  onClick={() => handleRetry(message.retryMessage)}
                  className="mt-2 flex items-center text-sm text-red-600 hover:text-red-800"
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Try again
                </button>
              )}
              
              {/* Login prompt for auth required */}
              {message.action === 'auth_required' && (
                <button
                  onClick={() => loginWithRedirect()}
                  className="mt-2 px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                >
                  Sign In to Continue
                </button>
              )}
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
      
      {/* Input Area - Compact design */}
      <div className="p-4 border-t bg-white flex-shrink-0">
        <div className="flex space-x-3">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isAuthenticated ? "Type your response..." : "Sign in to continue chatting..."}
            disabled={isLoading}
            className="flex-1 resize-none border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
            rows="1"
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || isLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
        
        {!isAuthenticated && (
          <p className="mt-2 text-xs text-gray-500 text-center">
            Sign in to save your progress and generate your document
          </p>
        )}
      </div>
    </div>
  );
};

export default ChatInterface;