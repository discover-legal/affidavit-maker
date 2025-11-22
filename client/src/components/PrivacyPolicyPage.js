import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Scale } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { PRIVACY_POLICY, PRIVACY_POLICY_VERSION, PRIVACY_POLICY_LAST_UPDATED } from '../content/privacyPolicy';

const PrivacyPolicyPage = () => {
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Navigation Bar */}
      <nav className="bg-white border-b shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <button
                onClick={() => navigate('/')}
                className="flex items-center text-gray-600 hover:text-gray-900 transition-colors mr-3 sm:mr-4"
                aria-label="Back to home"
              >
                <ArrowLeft className="h-5 w-5 mr-1 sm:mr-2" />
                <span className="text-sm font-medium hidden sm:inline">Back</span>
              </button>
              <div className="flex items-center space-x-2 sm:space-x-3">
                <Scale className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600" />
                <div className="text-left">
                  <h1 className="text-xl sm:text-2xl font-bold text-blue-600">discover.legal</h1>
                  <p className="text-xs text-gray-500 hidden sm:block">AI-Powered Legal Documents</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="bg-white rounded-lg shadow-lg p-6 sm:p-8 lg:p-12">
          <div className="mb-6">
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
            <p className="text-sm text-gray-600">
              Version {PRIVACY_POLICY_VERSION} • Last Updated: {PRIVACY_POLICY_LAST_UPDATED}
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
                p: ({ node: _node, ...props }) => (
                  <p className="mb-4 text-gray-700 leading-relaxed" {...props} />
                ),
                ul: ({ node: _node, ...props }) => (
                  <ul className="mb-4 ml-6 list-disc" {...props} />
                ),
                li: ({ node: _node, ...props }) => (
                  <li className="mb-2 text-gray-700" {...props} />
                ),
                strong: ({ node: _node, ...props }) => (
                  <strong className="font-semibold text-gray-900" {...props} />
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
              {PRIVACY_POLICY}
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

export default PrivacyPolicyPage;
