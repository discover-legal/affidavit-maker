// client/src/components/ChatInterface.js - Debug Version with Logging
import React, { useState, useEffect, useRef } from 'react';
import { useAuth0 } from '@auth0/auth0-react';

const ChatInterface = ({ affidavitData, onDataUpdate }) => {
  const [messages, setMessages] = useState([
    {
      id: 1,
      type: 'bot',
      content: "Hi! I'm here to help you create a professional affidavit. I can help with Texas, Utah, or Arizona. To get started, which state is your case in?"
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const messagesEndRef = useRef(null);
  const { getAccessTokenSilently } = useAuth0();

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Debug logging for props
  useEffect(() => {
    console.log('🔍 ChatInterface: Props received:', {
      affidavitData,
      onDataUpdateExists: !!onDataUpdate
    });
  }, [affidavitData, onDataUpdate]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) {
      console.log('🔍 ChatInterface: Message send blocked:', {
        messageEmpty: !inputMessage.trim(),
        isLoading
      });
      return;
    }

    const messageToSend = inputMessage.trim();
    setError(null);
    setIsLoading(true);

    console.log('🔍 ChatInterface: Starting to send message:', messageToSend);

    // Add user message to chat immediately
    const userMessage = {
      id: Date.now(),
      type: 'user',
      content: messageToSend
    };

    console.log('🔍 ChatInterface: Adding user message to chat');
    setMessages(prev => {
      const updated = [...prev, userMessage];
      console.log('🔍 ChatInterface: Messages after adding user message:', updated);
      return updated;
    });

    setInputMessage('');

    try {
      console.log('🔍 ChatInterface: Getting auth token...');
      const token = await getAccessTokenSilently();
      console.log('🔍 ChatInterface: Auth token obtained');

      const requestData = {
        message: messageToSend,
        conversationHistory: messages,
        currentData: affidavitData || {}
      };

      console.log('🔍 ChatInterface: Sending request:', {
        url: '/api/chat',
        messageLength: messageToSend.length,
        historyLength: messages.length,
        currentData: affidavitData,
        requestData
      });

      const response = await fetch('http://localhost:3001/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Cache-Control': 'no-cache'
        },
        body: JSON.stringify(requestData)
      });

      console.log('🔍 ChatInterface: Raw response received:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        headers: Object.fromEntries(response.headers.entries())
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('🔍 ChatInterface: Response not ok:', {
          status: response.status,
          statusText: response.statusText,
          errorText
        });
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('🔍 ChatInterface: Parsed response data:', data);

      if (data.success && data.data) {
        console.log('🔍 ChatInterface: Response successful, processing data:', {
          hasResponse: !!data.data.response,
          responseLength: data.data.response?.length || 0,
          responsePreview: data.data.response?.substring(0, 100) + '...',
          hasAffidavitData: !!data.data.affidavitData,
          affidavitData: data.data.affidavitData,
          hasNewFacts: !!(data.data.newFacts && data.data.newFacts.length > 0),
          newFactsCount: data.data.newFacts?.length || 0,
          hasSuggestions: !!(data.data.suggestions && data.data.suggestions.length > 0)
        });

        // Add bot response to chat
        if (data.data.response) {
          const botMessage = {
            id: Date.now() + 1,
            type: 'bot',
            content: data.data.response
          };

          console.log('🔍 ChatInterface: Adding bot message to chat:', botMessage);
          setMessages(prev => {
            const updated = [...prev, botMessage];
            console.log('🔍 ChatInterface: Messages after adding bot message:', updated);
            return updated;
          });
        } else {
          console.warn('🔍 ChatInterface: No response content in data');
        }

        // Update affidavit data if provided
        if (data.data.affidavitData && Object.keys(data.data.affidavitData).length > 0) {
          console.log('🔍 ChatInterface: Updating affidavit data:', {
            oldData: affidavitData,
            newData: data.data.affidavitData,
            onDataUpdateExists: !!onDataUpdate
          });

          if (onDataUpdate) {
            onDataUpdate(data.data.affidavitData);
            console.log('🔍 ChatInterface: Called onDataUpdate with new data');
          } else {
            console.error('🔍 ChatInterface: onDataUpdate function not provided!');
          }
        } else {
          console.log('🔍 ChatInterface: No affidavit data to update');
        }

        // Handle new facts
        if (data.data.newFacts && data.data.newFacts.length > 0) {
          console.log('🔍 ChatInterface: New facts received:', data.data.newFacts);
        }

        // Handle suggestions
        if (data.data.suggestions && data.data.suggestions.length > 0) {
          console.log('🔍 ChatInterface: Suggestions received:', data.data.suggestions);
        }

      } else {
        console.error('🔍 ChatInterface: Response not successful:', data);
        throw new Error(data.error || 'Unknown error occurred');
      }

    } catch (error) {
      console.error('🔍 ChatInterface: Error in handleSendMessage:', {
        error: error.message,
        stack: error.stack,
        name: error.name
      });
      
      setError(`Chat error: ${error.message}`);
      
      // Add error message to chat
      const errorMessage = {
        id: Date.now() + 2,
        type: 'bot',
        content: `Sorry, I encountered an error: ${error.message}. Please try again.`,
        isError: true
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      console.log('🔍 ChatInterface: Message sending completed');
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Debug render logging
  console.log('🔍 ChatInterface: Rendering with state:', {
    messagesCount: messages.length,
    isLoading,
    hasError: !!error,
    inputMessage: inputMessage.substring(0, 50),
    affidavitDataKeys: Object.keys(affidavitData || {})
  });

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="p-4 border-b bg-gray-50">
        <h2 className="text-lg font-semibold text-gray-900">AI Assistant</h2>
        <p className="text-sm text-gray-600">Ask questions to build your affidavit</p>
        {error && (
          <div className="mt-2 p-2 bg-red-100 border border-red-200 rounded text-red-700 text-sm">
            {error}
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                message.type === 'user'
                  ? 'bg-blue-600 text-white'
                  : message.isError
                  ? 'bg-red-100 text-red-800 border border-red-200'
                  : 'bg-gray-100 text-gray-900'
              }`}
            >
              <p className="text-sm whitespace-pre-wrap">{message.content}</p>
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-lg px-4 py-2">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t bg-gray-50">
        <div className="flex space-x-2">
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your message..."
            disabled={isLoading}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
          />
          <button
            onClick={handleSendMessage}
            disabled={isLoading || !inputMessage.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Sending...' : 'Send'}
          </button>
        </div>
      </div>

      {/* Debug Info (remove in production) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="p-2 bg-yellow-50 border-t text-xs text-gray-600">
          <details>
            <summary>Debug Info (click to expand)</summary>
            <pre className="mt-2 whitespace-pre-wrap">
              {JSON.stringify({
                messagesCount: messages.length,
                lastMessage: messages[messages.length - 1],
                affidavitData,
                isLoading,
                error
              }, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
};

export default ChatInterface;