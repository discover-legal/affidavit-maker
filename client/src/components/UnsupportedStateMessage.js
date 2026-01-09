// client/src/components/UnsupportedStateMessage.js
// Component to handle users from unsupported states gracefully

import React, { useEffect, useState } from 'react';

const UnsupportedStateMessage = ({ detectedState, onClose }) => {
  const [supportedStates, setSupportedStates] = useState([]);
  const [country, setCountry] = useState('US');

  // Detect country based on subdomain
  useEffect(() => {
    const hostname = window.location.hostname;
    if (hostname.startsWith('ca.') || hostname.startsWith('canada.')) {
      setCountry('CA');
    } else {
      setCountry('US');
    }
  }, []);

  // Fetch supported states/provinces dynamically
  useEffect(() => {
    fetch('/api/templates/states')
      .then(res => res.json())
      .then(data => {
        // API now returns array directly (not wrapped in {states: ...})
        if (Array.isArray(data)) {
          // Filter by country if needed
          const filtered = country === 'CA'
            ? data.filter(s => s.country === 'CA')
            : data.filter(s => s.country === 'US' || !s.country);
          setSupportedStates(filtered);
        }
      })
      .catch(() => {
        // Fallback to hardcoded list if API fails
        if (country === 'US') {
          setSupportedStates([
            { stateCode: 'TX', stateName: 'Texas' },
            { stateCode: 'UT', stateName: 'Utah' },
            { stateCode: 'AZ', stateName: 'Arizona' },
            { stateCode: 'CA', stateName: 'California' }
          ]);
        } else {
          setSupportedStates([]);
        }
      });
  }, [country]);

  const jurisdictionType = country === 'CA' ? 'province' : 'state';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-8 max-w-md mx-4 shadow-xl">
        <div className="text-center">
          {/* Icon */}
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-yellow-100 mb-4">
            <svg className="h-6 w-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>

          {/* Title */}
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Service Not Available in Your {jurisdictionType === 'province' ? 'Province' : 'State'}
          </h3>

          {/* Message */}
          <div className="text-sm text-gray-600 mb-6">
            {detectedState && (
              <p className="mb-3">
                We detected you're located in <strong>{detectedState}</strong>.
              </p>
            )}
            <p className="mb-3">
              Currently, our service is available in these {jurisdictionType}s:
            </p>
            <ul className="text-left space-y-1 mb-4">
              {supportedStates.map(state => (
                <li key={state.stateCode} className="flex items-center">
                  <svg className="h-4 w-4 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  {state.stateName} ({state.stateCode})
                </li>
              ))}
            </ul>
            <p className="text-xs text-gray-500">
              We're continuously expanding to serve more {jurisdictionType}s!
            </p>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              I understand
            </button>
            <a
              href={`mailto:support@affidavit-maker.com?subject=Expansion Request&body=I'm interested in using your service in [YOUR ${jurisdictionType.toUpperCase()}]. Please let me know when you expand!`}
              className={`px-4 py-2 text-sm font-medium text-white ${country === 'CA' ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500' : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'} border border-transparent rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2`}
            >
              Request My {jurisdictionType === 'province' ? 'Province' : 'State'}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

// Hook to handle unsupported state errors in chat
export const useUnsupportedStateHandler = () => {
  const [unsupportedState, setUnsupportedState] = React.useState(null);

  const handleChatResponse = (response) => {
    if (response.unsupportedState) {
      setUnsupportedState({
        detectedState: response.detectedState,
        message: response.error
      });
      return true; // Indicates error was handled
    }
    return false; // No error to handle
  };

  const clearUnsupportedState = () => {
    setUnsupportedState(null);
  };

  return {
    unsupportedState,
    handleChatResponse,
    clearUnsupportedState
  };
};

export default UnsupportedStateMessage;

// ========================================
// UPDATE TO EXISTING CHAT COMPONENT
// ========================================

// Add this to your existing ChatInterface component:

/*
import UnsupportedStateMessage, { useUnsupportedStateHandler } from './UnsupportedStateMessage';

// Inside your ChatInterface component:
const ChatInterface = () => {
  const { unsupportedState, handleChatResponse, clearUnsupportedState } = useUnsupportedStateHandler();
  // ... existing state and methods

  const sendMessage = async (message) => {
    try {
      setIsLoading(true);
      
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          message,
          conversationHistory,
          affidavitData
        })
      });

      const data = await response.json();
      
      // Check for unsupported state error
      if (handleChatResponse(data)) {
        setIsLoading(false);
        return; // Stop processing - show unsupported state modal
      }

      // Continue with normal chat handling
      if (data.success) {
        setMessages(prev => [...prev, 
          { type: 'user', content: message },
          { type: 'bot', content: data.response }
        ]);
        setAffidavitData(data.affidavitData);
      } else {
        // Handle other errors
        console.error('Chat error:', data.error);
      }
      
    } catch (error) {
      console.error('Network error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      {/* Your existing chat interface */}
      
      {/* Add unsupported state modal */}
      {unsupportedState && (
        <UnsupportedStateMessage 
          detectedState={unsupportedState.detectedState}
          onClose={clearUnsupportedState}
        />
      )}
    </div>
  );
};
*/