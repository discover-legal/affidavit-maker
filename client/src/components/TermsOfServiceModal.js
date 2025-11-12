import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { TERMS_OF_SERVICE, TOS_VERSION, TOS_LAST_UPDATED } from '../content/termsOfService';

const TermsOfServiceModal = ({ isOpen, onAccept, onDecline, userName }) => {
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const [isAccepting, setIsAccepting] = useState(false);
  const [tosChecked, setTosChecked] = useState(false);
  const [researchConsent, setResearchConsent] = useState(false);
  const scrollContainerRef = useRef(null);

  useEffect(() => {
    // Reset scroll state when modal opens
    if (isOpen) {
      setHasScrolledToBottom(false);
      setTosChecked(false);
      setResearchConsent(false);
    }
  }, [isOpen]);

  const handleScroll = () => {
    const container = scrollContainerRef.current;
    if (!container) return;

    // Check if user has scrolled to bottom (with 10px threshold for flexibility)
    const isAtBottom =
      container.scrollHeight - container.scrollTop <= container.clientHeight + 10;

    if (isAtBottom && !hasScrolledToBottom) {
      setHasScrolledToBottom(true);
    }
  };

  const handleAccept = async () => {
    setIsAccepting(true);
    try {
      await onAccept(TOS_VERSION, researchConsent);
    } catch (error) {
      console.error('Error accepting TOS:', error);
      setIsAccepting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Terms of Service</h2>
            <p className="text-sm text-gray-600 mt-1">
              Welcome{userName ? `, ${userName}` : ''}! Please review and accept our terms to continue.
            </p>
          </div>
          {onDecline && (
            <button
              onClick={onDecline}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Close"
            >
              <X className="w-6 h-6" />
            </button>
          )}
        </div>

        {/* Scrollable Content */}
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto px-6 py-4 prose prose-sm max-w-none"
          style={{ scrollBehavior: 'smooth' }}
        >
          <ReactMarkdown
            components={{
              h1: ({ node, ...props }) => <h1 className="text-3xl font-bold mt-6 mb-4" {...props} />,
              h2: ({ node, ...props }) => <h2 className="text-2xl font-bold mt-6 mb-3" {...props} />,
              h3: ({ node, ...props }) => <h3 className="text-xl font-bold mt-4 mb-2" {...props} />,
              p: ({ node, ...props }) => <p className="mb-4 text-gray-700 leading-relaxed" {...props} />,
              ul: ({ node, ...props }) => <ul className="mb-4 ml-6 list-disc" {...props} />,
              li: ({ node, ...props }) => <li className="mb-2 text-gray-700" {...props} />,
              strong: ({ node, ...props }) => <strong className="font-semibold text-gray-900" {...props} />,
              hr: ({ node, ...props }) => <hr className="my-6 border-gray-300" {...props} />,
            }}
          >
            {TERMS_OF_SERVICE}
          </ReactMarkdown>
        </div>

        {/* Scroll Indicator */}
        {!hasScrolledToBottom && (
          <div className="px-6 py-2 bg-blue-50 border-t border-blue-200">
            <p className="text-sm text-blue-800 text-center">
              ⬇️ Please scroll to the bottom to continue
            </p>
          </div>
        )}

        {/* Footer with Action Buttons */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-start space-x-3 mb-4">
            <input
              type="checkbox"
              id="tos-checkbox"
              checked={tosChecked}
              onChange={(e) => setTosChecked(e.target.checked)}
              disabled={!hasScrolledToBottom}
              className={`mt-1 w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 ${
                !hasScrolledToBottom ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
              }`}
            />
            <label
              htmlFor="tos-checkbox"
              className={`text-sm ${
                !hasScrolledToBottom ? 'text-gray-400' : 'text-gray-700'
              }`}
            >
              I have read and agree to the Terms of Service (Version {TOS_VERSION}, last updated {TOS_LAST_UPDATED})
            </label>
          </div>

          <div className="flex items-start space-x-3 mb-4 pl-1">
            <input
              type="checkbox"
              id="research-checkbox"
              checked={researchConsent}
              onChange={(e) => setResearchConsent(e.target.checked)}
              disabled={!hasScrolledToBottom}
              className={`mt-1 w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 ${
                !hasScrolledToBottom ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
              }`}
            />
            <label
              htmlFor="research-checkbox"
              className={`text-xs ${
                !hasScrolledToBottom ? 'text-gray-400' : 'text-gray-600'
              }`}
            >
              <span className="font-medium">Optional:</span> I consent to the use of de-identified data for research purposes to improve legal accessibility
            </label>
          </div>

          <div className="flex items-center justify-end space-x-3">
            {onDecline && (
              <button
                onClick={onDecline}
                disabled={isAccepting}
                className="px-6 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Decline
              </button>
            )}
            <button
              onClick={handleAccept}
              disabled={!hasScrolledToBottom || !tosChecked || isAccepting}
              className={`px-8 py-2 rounded-lg font-semibold transition-all ${
                hasScrolledToBottom && tosChecked && !isAccepting
                  ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-md hover:shadow-lg'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              {isAccepting ? 'Accepting...' : 'I Accept'}
            </button>
          </div>

          {!hasScrolledToBottom && (
            <p className="text-xs text-gray-500 text-center mt-3">
              Please scroll to the bottom and check the box above to continue
            </p>
          )}
          {hasScrolledToBottom && !tosChecked && (
            <p className="text-xs text-gray-500 text-center mt-3">
              Please check the Terms of Service box to continue
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default TermsOfServiceModal;
