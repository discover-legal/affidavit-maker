import React, { useState, useEffect, useRef } from 'react';
import { Send, FileText, Download, AlertCircle, Loader2, CreditCard, Lock, CheckCircle } from 'lucide-react';

// Payment Modal Component
const PaymentModal = ({ isOpen, onClose, affidavitData, onPaymentSuccess }) => {
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
      const response = await fetch('http://localhost:3001/api/payment/create-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customerData: {
            name: cardData.name,
            email: cardData.email,
            state: affidavitData.state,
            caseNumber: affidavitData.caseNumber
          },
          documentType: 'single_affidavit'
        })
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Payment failed');
      }

      // Simulate payment processing
      setTimeout(async () => {
        const confirmResponse = await fetch('http://localhost:3001/api/payment/confirm', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            paymentId: data.paymentIntentId || data.orderReference,
            paymentDetails: {}
          })
        });

        const confirmData = await confirmResponse.json();

        if (confirmData.success) {
          setSuccess(true);
          setLoading(false);
          
          setTimeout(() => {
            onPaymentSuccess({
              paymentId: data.orderReference,
              amount: data.amount,
              sessionId: data.orderReference
            });
            onClose();
          }, 2000);
        } else {
          throw new Error('Payment confirmation failed');
        }
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
          <p className="text-gray-600">Your affidavit will be generated shortly.</p>
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
              className="w-full py-3 px-4 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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

// Main Chatbot Component
const AffidavitChatbot = () => {
  const [messages, setMessages] = useState([
    {
      id: 1,
      type: 'bot',
      content: "Hi! I'm your AI legal document assistant. I'll help you create a professional affidavit for your family court case. Before we begin, please note: I provide document preparation assistance only, not legal advice. For legal advice, please consult an attorney.\n\nWhich state is your case in? (Currently serving Texas, Utah, and Arizona)"
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [affidavitData, setAffidavitData] = useState({
    state: null,
    caseType: null,
    affiantName: null,
    caseNumber: null,
    facts: [],
    completionStatus: 0
  });
  const [documentReady, setDocumentReady] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [paymentComplete, setPaymentComplete] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = {
      id: messages.length + 1,
      type: 'user',
      content: input
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('http://localhost:3001/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: input,
          conversationHistory: messages,
          currentData: affidavitData
        })
      });

      const data = await response.json();

      if (data.success) {
        const botMessage = {
          id: messages.length + 2,
          type: 'bot',
          content: data.response
        };

        setMessages(prev => [...prev, botMessage]);

        // Update affidavit data
        if (data.extractedData) {
          setAffidavitData(prev => ({
            ...prev,
            ...data.extractedData
          }));

          // Check if data is complete
          if (data.extractedData.dataComplete) {
            setDocumentReady(true);
            // Show payment modal
            setTimeout(() => {
              setShowPayment(true);
            }, 1000);
          }
        }
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

  const handlePaymentSuccess = (paymentData) => {
    setPaymentComplete(true);
    setSessionId(paymentData.sessionId);
    setShowPayment(false);
    
    // Add success message
    const successMessage = {
      id: messages.length + 1,
      type: 'bot',
      content: 'Payment successful! I\'m now generating your affidavit. This will take just a moment...'
    };
    setMessages(prev => [...prev, successMessage]);
    
    // Generate document
    generateDocument(paymentData.sessionId);
  };

  const generateDocument = async (sessionId) => {
    try {
      const response = await fetch('http://localhost:3001/api/generate-affidavit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          affidavitData,
          sessionId
        })
      });

      const data = await response.json();

      if (data.success) {
        const completeMessage = {
          id: messages.length + 1,
          type: 'bot',
          content: 'Your affidavit has been generated successfully! You can download it using the button below.'
        };
        setMessages(prev => [...prev, completeMessage]);
        setDocumentReady(true);
      }
    } catch (error) {
      console.error('Document generation error:', error);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow-sm px-6 py-4">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-800">AI Legal Document Assistant</h1>
          <p className="text-sm text-gray-600 mt-1">Document preparation service - Not legal advice</p>
        </div>
      </div>

      {/* Chat Container */}
      <div className="flex-1 overflow-hidden">
        <div className="max-w-4xl mx-auto h-full flex flex-col">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`mb-4 flex ${
                  message.type === 'user' ? 'justify-end' : 'justify-start'
                }`}
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
            {isLoading && (
              <div className="flex justify-start mb-4">
                <div className="bg-white text-gray-800 shadow px-4 py-3 rounded-lg">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="border-t bg-white px-6 py-4">
            <div className="flex gap-3">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Type your response..."
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isLoading || documentReady}
              />
              <button
                onClick={handleSend}
                disabled={isLoading || !input.trim() || documentReady}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Document Ready Banner */}
          {documentReady && paymentComplete && (
            <div className="bg-green-50 border-t border-green-200 px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="h-6 w-6 text-green-600" />
                  <div>
                    <p className="font-semibold text-green-800">Your affidavit is ready!</p>
                    <p className="text-sm text-green-600">Click download to save your document</p>
                  </div>
                </div>
                <button className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2">
                  <Download className="h-5 w-5" />
                  Download PDF
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* State Compliance Disclaimer */}
      <div className="bg-gray-50 border-t px-6 py-3">
        <div className="max-w-4xl mx-auto flex items-center gap-2 text-xs text-gray-600">
          <AlertCircle className="h-4 w-4" />
          <span>
            This service is authorized for document preparation in Texas, Utah, and Arizona. 
            Always consult with an attorney for legal advice.
          </span>
        </div>
      </div>

      {/* Payment Modal */}
      <PaymentModal
        isOpen={showPayment}
        onClose={() => setShowPayment(false)}
        affidavitData={affidavitData}
        onPaymentSuccess={handlePaymentSuccess}
      />
    </div>
  );
};

export default AffidavitChatbot;