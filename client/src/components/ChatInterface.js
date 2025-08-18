// client/src/components/ChatInterface.js - Complete drop-in with improved error handling
import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, 
  Bot, 
  User, 
  ArrowDown, 
  Check, 
  AlertCircle,
  Loader 
} from 'lucide-react';
import { useAuth0 } from '@auth0/auth0-react';
import { useDocumentState, useDocumentActions } from '../contexts/DocumentContext';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

const ChatInterface = () => {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);
  
  const { currentDocument } = useDocumentState();
  const { updateDocumentData } = useDocumentActions();
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();

  // Scroll to bottom when new messages come in
  useEffect(() => {
    if (isAtBottom) {
      scrollToBottom();
    }
  }, [messages, isAtBottom]);

  // Check if scroll position is at bottom
  const handleScroll = () => {
    if (chatContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
      const isBottom = scrollHeight - scrollTop - clientHeight < 10;
      setIsAtBottom(isBottom);
    }
  };

  // Scroll to the bottom of the chat
  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Handle welcome message on first load
  useEffect(() => {
    // Add welcome message if there are no messages
    if (messages.length === 0) {
      setMessages([
        {
          type: 'bot',
          content: `Welcome to the Affidavit Maker! I'll help you create a legally valid affidavit. Let's get started! Please tell me your full name and what state you're in (Texas, Utah, or Arizona).`
        }
      ]);
    }
  }, [messages]);

  // Send message to AI
  const sendMessage = async (e) => {
    e.preventDefault();
    
    if (!message.trim()) return;
    
    const userMessage = message.trim();
    setMessage('');
    
    // Add user message to chat
    setMessages(prevMessages => [
      ...prevMessages,
      { type: 'user', content: userMessage }
    ]);
    
    setIsLoading(true);
    setError(null);
    
    try {
      let headers = {
        'Content-Type': 'application/json',
      };
      
      // Add auth token if authenticated
      if (isAuthenticated) {
        const token = await getAccessTokenSilently();
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch(`${API_BASE_URL}/api/chat`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          message: userMessage,
          conversationHistory: messages,
          affidavitData: currentDocument
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Something went wrong. Please try again.');
      }
      
      if (data.success) {
        // Add bot response to chat
        setMessages(prevMessages => [
          ...prevMessages,
          { type: 'bot', content: data.response }
        ]);
        
        // Update document data if AI extracted new information
        if (data.affidavitData) {
          updateDocumentData(data.affidavitData);
        }
      } else {
        throw new Error(data.error || 'Failed to get a response.');
      }
    } catch (error) {
      console.error('Chat error:', error);
      setError(error.message);
      
      // Add error message to chat
      setMessages(prevMessages => [
        ...prevMessages,
        { 
          type: 'bot', 
          content: `I'm having trouble processing your message. ${error.message}`,
          isError: true
        }
      ]);
    } finally {
      setIsLoading(false);
      setIsAtBottom(true); // Force scroll to bottom after new message
    }
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow-sm">
      <div className="px-4 py-3 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-800 flex items-center">
          <Bot className="h-5 w-5 mr-2 text-blue-500" />
          Affidavit Assistant
        </h3>
        <p className="text-sm text-gray-500">
          I'll help you create a legally valid affidavit
        </p>
      </div>
      
      <div 
        className="flex-1 overflow-y-auto px-4 py-3"
        ref={chatContainerRef}
        onScroll={handleScroll}
      >
        {messages.map((msg, index) => (
          <div 
            key={index} 
            className={`mb-4 flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div 
              className={`p-3 rounded-lg max-w-[85%] ${
                msg.type === 'user' 
                  ? 'bg-blue-50 text-blue-900' 
                  : msg.isError 
                  ? 'bg-red-50 text-red-900' 
                  : 'bg-gray-100 text-gray-800'
              }`}
            >
              {msg.type === 'user' ? (
                <div className="flex items-start">
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                  <User className="h-4 w-4 ml-2 mt-1 text-blue-600 shrink-0" />
                </div>
              ) : (
                <div className="flex items-start">
                  {msg.isError ? (
                    <AlertCircle className="h-4 w-4 mr-2 mt-1 text-red-600 shrink-0" />
                  ) : (
                    <Bot className="h-4 w-4 mr-2 mt-1 text-gray-600 shrink-0" />
                  )}
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                </div>
              )}
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div className="mb-4 flex justify-start">
            <div className="p-3 rounded-lg bg-gray-100 text-gray-800 flex items-center">
              <Loader className="h-4 w-4 mr-2 animate-spin text-blue-600" />
              <span>Thinking...</span>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>
      
      {!isAtBottom && (
        <button 
          className="absolute bottom-20 right-6 bg-blue-500 text-white rounded-full p-2 shadow-lg hover:bg-blue-600 transition-colors"
          onClick={scrollToBottom}
          aria-label="Scroll to bottom"
        >
          <ArrowDown className="h-5 w-5" />
        </button>
      )}
      
      <div className="px-4 py-3 border-t border-gray-200">
        <form onSubmit={sendMessage} className="flex">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type your message..."
            className="flex-1 p-2 border border-gray-300 rounded-l-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            type="submit"
            disabled={isLoading || !message.trim()}
            className={`p-2 rounded-r-lg ${
              isLoading || !message.trim()
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-500 text-white hover:bg-blue-600'
            } transition-colors`}
          >
            <Send className="h-5 w-5" />
          </button>
        </form>
        
        {currentDocument.affiantName && (
          <div className="mt-3 flex items-center text-xs text-green-600">
            <Check className="h-3 w-3 mr-1" />
            <span>Name recorded: {currentDocument.affiantName}</span>
          </div>
        )}
        
        {currentDocument.state && (
          <div className="mt-1 flex items-center text-xs text-green-600">
            <Check className="h-3 w-3 mr-1" />
            <span>State recorded: {currentDocument.state}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatInterface;