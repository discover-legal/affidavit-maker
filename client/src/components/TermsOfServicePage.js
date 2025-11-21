import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { TERMS_OF_SERVICE, TOS_VERSION, TOS_LAST_UPDATED, TOOLTIP_DEFINITIONS } from '../content/termsOfService';
import Tooltip from './Tooltip';

// Helper function to parse tooltip syntax {{term}} and render Tooltip components
const parseTooltips = (content) => {
  // Handle arrays of children
  if (Array.isArray(content)) {
    return content.map((child, idx) => {
      if (typeof child === 'string') {
        return <React.Fragment key={idx}>{parseTooltips(child)}</React.Fragment>;
      }
      return child;
    });
  }

  // Handle non-string content
  if (typeof content !== 'string') {
    return content;
  }

  const parts = [];
  let lastIndex = 0;
  const regex = /\{\{([^}]+)\}\}/g;
  let match;

  while ((match = regex.exec(content)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      parts.push(content.substring(lastIndex, match.index));
    }

    // Add the tooltip component
    const term = match[1];
    const definition = TOOLTIP_DEFINITIONS[term] || TOOLTIP_DEFINITIONS[term.toLowerCase()];

    if (definition) {
      parts.push(
        <Tooltip key={match.index} term={term} definition={definition}>
          {term}
        </Tooltip>
      );
    } else {
      // If no definition found, just render the term without tooltip
      parts.push(term);
    }

    lastIndex = regex.lastIndex;
  }

  // Add remaining text
  if (lastIndex < content.length) {
    parts.push(content.substring(lastIndex));
  }

  return parts.length > 0 ? parts : content;
};

const TermsOfServicePage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Navigation Bar */}
      <nav className="bg-white border-b shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <button
                onClick={() => navigate('/')}
                className="flex items-center text-gray-600 hover:text-gray-900 transition-colors mr-4"
                aria-label="Back to home"
              >
                <ArrowLeft className="h-5 w-5 mr-2" />
                <span className="text-sm font-medium">Back</span>
              </button>
              <span className="text-xl sm:text-2xl font-bold text-blue-600">discover.legal</span>
            </div>
          </div>
        </div>
      </nav>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="bg-white rounded-lg shadow-lg p-6 sm:p-8 lg:p-12">
          <div className="mb-6">
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">Terms of Service</h1>
            <p className="text-sm text-gray-600">
              Version {TOS_VERSION} • Last Updated: {TOS_LAST_UPDATED}
            </p>
          </div>

          <div className="prose prose-sm sm:prose max-w-none">
            <ReactMarkdown
              components={{
                h1: ({ node: _node, children, ...props }) => (
                  <h1 className="text-3xl font-bold mt-8 mb-4 text-gray-900" {...props}>
                    {children}
                  </h1>
                ),
                h2: ({ node: _node, children, ...props }) => (
                  <h2 className="text-2xl font-bold mt-6 mb-3 text-gray-900" {...props}>
                    {children}
                  </h2>
                ),
                h3: ({ node: _node, children, ...props }) => (
                  <h3 className="text-xl font-semibold mt-5 mb-2 text-gray-800" {...props}>
                    {children}
                  </h3>
                ),
                p: ({ node: _node, children, ...props }) => (
                  <p className="mb-4 text-gray-700 leading-relaxed" {...props}>
                    {parseTooltips(children)}
                  </p>
                ),
                ul: ({ node: _node, ...props }) => (
                  <ul className="mb-4 ml-6 list-disc" {...props} />
                ),
                li: ({ node: _node, children, ...props }) => (
                  <li className="mb-2 text-gray-700" {...props}>
                    {parseTooltips(children)}
                  </li>
                ),
                strong: ({ node: _node, children, ...props }) => (
                  <strong className="font-semibold text-gray-900" {...props}>
                    {parseTooltips(children)}
                  </strong>
                ),
                hr: ({ node: _node, ...props }) => (
                  <hr className="my-6 border-gray-300" {...props} />
                ),
                a: ({ node: _node, children, ...props }) => (
                  <a className="text-blue-600 hover:text-blue-800 underline" {...props}>
                    {children}
                  </a>
                ),
              }}
            >
              {TERMS_OF_SERVICE}
            </ReactMarkdown>
          </div>

          {/* Footer */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <button
              onClick={() => navigate('/')}
              className="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
            >
              <ArrowLeft className="h-5 w-5 mr-2" />
              Back to Home
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TermsOfServicePage;
