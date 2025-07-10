// client/src/components/ChatInterface.js
import React, { useState, useEffect, useRef } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { useAuth0 } from '@auth0/auth0-react';
import ValidationDisplay from './ValidationDisplay';

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
  const { getAccessTokenSilently, loginWithRedirect } = useAuth0();
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
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingMessage]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
    }
  }, [input]);

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
    if (!input.trim() || isLoading) return;

    const userMessage = {
      id: Date.now(),
      type: 'user',
      content: input.trim()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const token = await getAccessTokenSilently({
        authorizationParams: {
          audience: process.env.REACT_APP_AUTH0_AUDIENCE
        }
      });
      
      const response = await fetch(`${API_BASE}/api/chat`, {
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

        if (data.extractedData) {
          onDataUpdate(data.extractedData);
        }

        if (data.validation) {
          onValidationUpdate(data.validation);
        }

        if (data.conversationComplete) {
          onDocumentComplete(true);
        }

        await onSaveSession();
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

  return (
    <div className="bg-white rounded-lg shadow-sm border h-full flex flex-col">
      <div className="p-6 border-b">
        <h2 className="text-lg font-semibold text-gray-900">AI Assistant</h2>
        <p className="text-sm text-gray-600">I'll guide you through creating your state-compliant affidavit.</p>
        <ValidationDisplay validation={validation} />
      </div>
      
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
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
            disabled={isLoading}
            className="flex-1 resize-none border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
            rows="1"
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || isLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;