// client/src/components/ChatInterface.js - Complete Fixed Implementation
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Loader2, AlertCircle, RefreshCw, CheckCircle, Save, Clock } from 'lucide-react';
import { useAuth0 } from '@auth0/auth0-react';

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
  const { getAccessTokenSilently, loginWithRedirect, isAuthenticated, user } = useAuth0();
  
  // Initialize messages based on whether user has existing data
  const [messages, setMessages] = useState([{
    id: 1,
    type: 'bot',
    content: affidavitData?.affiantName 
      ? "Welcome back! I see you were working on an affidavit. Let's continue where you left off."
      : "Hi! I'm here to help you create a professional affidavit. I can help with Texas, Utah, or Arizona. To get started, which state is your case in?"
  }]);
  
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState('');
  const [error, setError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const saveTimeoutRef = useRef(null);

  // Auto-scroll to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
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

  // Auto-save functionality
  useEffect(() => {
    if (isAuthenticated && (affidavitData?.affiantName || affidavitData?.state || (affidavitData?.facts && affidavitData.facts.length > 0))) {
      // Clear existing timeout
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      
      // Set new timeout for auto-save (3 seconds after last change)
      saveTimeoutRef.current = setTimeout(() => {
        handleAutoSave();
      }, 3000);
    }
    
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [affidavitData, isAuthenticated]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  const handleAutoSave = async () => {
    if (!isAuthenticated || isSaving || !onSaveSession) return;
    
    try {
      setIsSaving(true);
      await onSaveSession();
      setLastSaved(new Date());
    } catch (error) {
      console.error('Auto-save failed:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return;

    if (!isAuthenticated) {
      const authPrompt = {
        id: Date.now(),
        type: 'bot',
        content: "Please sign in to continue our conversation and save your progress.",
        action: 'auth_required'
      };
      setMessages(prev => [...prev, authPrompt]);
      setTimeout(() => {
        loginWithRedirect({ appState: { returnTo: window.location.pathname } });
      }, 1500);
      return;
    }

    const userMessage = { 
      id: Date.now(), 
      type: 'user', 
      content: input.trim() 
    };
    
    setMessages(prev => [...prev, userMessage]);
    const messageToSend = input.trim();
    setInput('');
    setIsLoading(true);
    setError(null);
    setStreamingMessage('');

    try {
      // Fixed token request with proper configuration
      const token = await getAccessTokenSilently({
        authorizationParams: {
          audience: process.env.REACT_APP_AUTH0_AUDIENCE,
          scope: "openid profile email"
        },
        cacheMode: 'on',
        timeoutInSeconds: 30
      });
      
      // Create proper fetch request for SSE
      const response = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          'Authorization': `Bearer ${token}`,
          'Accept': 'text/event-stream',
          'Cache-Control': 'no-cache'
        },
        body: JSON.stringify({
          message: messageToSend,
          conversationHistory: messages.slice(-10),
          currentData: affidavitData,
          documentId: affidavitData?.documentId
        })
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication expired. Please sign in again.');
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Process SSE stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let accumulatedResponse = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.type === 'connected') {
                continue;
              } else if (data.type === 'token') {
                accumulatedResponse += data.content;
                setStreamingMessage(accumulatedResponse);
              } else if (data.type === 'data') {
                if (data.affidavitData && onDataUpdate) {
                  onDataUpdate(data.affidavitData);
                }
              } else if (data.type === 'complete' || data.type === 'done') {
                const botMessage = {
                  id: Date.now() + 1,
                  type: 'bot',
                  content: data.content || accumulatedResponse
                };
                
                setMessages(prev => [...prev, botMessage]);
                setStreamingMessage('');
                
                if (data.affidavitData && onDataUpdate) {
                  onDataUpdate(data.affidavitData);
                }
              } else if (data.type === 'error') {
                throw new Error(data.error || 'An error occurred');
              }
            } catch (parseError) {
              console.error('Error parsing SSE data:', parseError, 'Line:', line);
            }
          }
        }
      }

    } catch (error) {
      console.error('Chat error:', error);
      setStreamingMessage('');
      setError(error.message);
      
      let errorMessage = "I'm having trouble connecting right now. Please try again.";
      let shouldRetry = true;
      
      if (error.message.includes('Authentication') || error.message.includes('401')) {
        errorMessage = "Your session has expired. Please sign in again.";
        shouldRetry = false;
        setTimeout(() => {
          loginWithRedirect({ appState: { returnTo: window.location.pathname } });
        }, 2000);
      } else if (error.message.includes('fetch') || error.message.includes('Failed to fetch')) {
        errorMessage = "Network connection issue. Please check your internet and try again.";
      } else if (error.message.includes('rate limit')) {
        errorMessage = "AI service is busy. Please try again in a moment.";
      }
      
      const errorBotMessage = {
        id: Date.now() + 1,
        type: 'bot',
        content: errorMessage,
        error: true,
        retryMessage: shouldRetry ? messageToSend : null
      };
      setMessages(prev => [...prev, errorBotMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetry = async (retryMessage) => {
    setInput(retryMessage);
    setTimeout(() => {
      handleSendMessage();
    }, 100);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const getCompletionPercentage = () => {
    if (!affidavitData) return 0;
    
    const requiredFields = ['affiantName', 'state', 'facts'];
    const completedFields = requiredFields.filter(field => {
      const value = affidavitData[field];
      return value && (Array.isArray(value) ? value.length > 0 : value.trim && value.trim().length > 0);
    });
    
    return Math.round((completedFields.length / requiredFields.length) * 100);
  };

  const isDocumentReady = () => {
    return !!(
      affidavitData?.affiantName &&
      affidavitData?.state &&
      affidavitData?.facts &&
      affidavitData.facts.length > 0
    );
  };

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header with Status */}
      <div className="px-4 py-3 border-b bg-gray-50 flex-shrink-0">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-900">AI Assistant</h3>
          
          <div className="flex items-center space-x-3 text-xs">
            {/* Save status */}
            {isAuthenticated && (isSaving ? (
              <div className="flex items-center text-blue-600">
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
                Saving...
              </div>
            ) : lastSaved ? (
              <div className="flex items-center text-green-600">
                <CheckCircle className="h-3 w-3 mr-1" />
                Saved {lastSaved.toLocaleTimeString()}
              </div>
            ) : null)}
            
            {/* Document ready indicator */}
            {isDocumentReady() && (
              <div className="flex items-center text-green-600 bg-green-50 px-2 py-1 rounded">
                <CheckCircle className="h-3 w-3 mr-1" />
                Ready to generate
              </div>
            )}
          </div>
        </div>
        
        {/* Progress bar */}
        {affidavitData && (
          <div className="mt-3">
            <div className="w-full bg-gray-200 rounded-full h-1.5">
              <div 
                className="bg-blue-600 h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${getCompletionPercentage()}%` }}
              />
            </div>
          </div>
        )}
        
        {/* Error display */}
        {error && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center">
              <AlertCircle className="h-4 w-4 text-red-600 mr-2" />
              <span className="text-sm text-red-700">{error}</span>
            </div>
          </div>
        )}
      </div>
      
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ minHeight: 0 }}>
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
              
              {/* Retry button for errors */}
              {message.error && message.retryMessage && (
                <button
                  onClick={() => handleRetry(message.retryMessage)}
                  className="mt-2 flex items-center text-sm text-red-600 hover:text-red-800"
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Try again
                </button>
              )}
              
              {/* Auth prompt */}
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
        
        {/* Streaming message */}
        {streamingMessage && (
          <div className="flex justify-start">
            <div className="max-w-xs lg:max-w-md px-4 py-2 rounded-lg bg-gray-100 text-gray-900">
              {streamingMessage}
              <span className="animate-pulse">|</span>
            </div>
          </div>
        )}
        
        {/* Loading indicator */}
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
      
      {/* Input Area */}
      <div className="p-4 border-t bg-white flex-shrink-0">
        <div className="flex space-x-3">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isAuthenticated ? 
              "Type your response..." : "Sign in to continue..."}
            disabled={isLoading || !isAuthenticated}
            className="flex-1 resize-none border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
            rows="1"
          />
          <button
            onClick={handleSendMessage}
            disabled={!input.trim() || isLoading || !isAuthenticated}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
        
        {!isAuthenticated && (
          <p className="mt-2 text-xs text-gray-500 text-center">
            Sign in to save your progress and generate documents
          </p>
        )}
      </div>
    </div>
  );
};

export default ChatInterface;