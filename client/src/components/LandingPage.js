// Landing Page - Allow browsing, require auth for action
import React, { useEffect } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { Link } from 'react-router-dom';
import { ChevronRight, Zap, Shield, Scale } from 'lucide-react';

const LandingPage = ({ onGetStarted }) => {
  const { loginWithRedirect, isAuthenticated } = useAuth0();

  // Reset scroll position when page loads
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const handleGetStarted = () => {
    if (isAuthenticated) {
      onGetStarted();
    } else {
      // Prompt for login when they try to start
      loginWithRedirect();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Navigation Bar with Branding */}
      <nav className="bg-white border-b shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Brand Logo */}
            <div className="flex items-center space-x-2 sm:space-x-3">
              <Scale className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600" />
              <div className="text-left">
                <h1 className="text-xl sm:text-2xl font-bold text-blue-600">discover.legal</h1>
                <p className="text-xs text-gray-500 hidden sm:block">AI-Powered Legal Documents</p>
              </div>
            </div>

            {/* Navigation Links & Auth Buttons */}
            <div className="flex items-center gap-3 sm:gap-6">
              <Link
                to="/resources"
                className="text-gray-700 hover:text-gray-900 font-medium text-sm sm:text-base transition-colors whitespace-nowrap"
              >
                Resources
              </Link>
              {isAuthenticated ? (
                <button
                  onClick={onGetStarted}
                  className="bg-blue-600 text-white px-4 sm:px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm sm:text-base font-medium"
                >
                  Go to Dashboard
                </button>
              ) : (
                <button
                  onClick={() => loginWithRedirect()}
                  className="text-gray-700 hover:text-gray-900 font-medium px-4 py-2 text-sm sm:text-base"
                >
                  Sign In
                </button>
              )}
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 sm:pt-16 lg:pt-20 pb-12 sm:pb-16">
        <div className="text-center">
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 mb-4 sm:mb-6 px-4">
            Create Legal Affidavits in Minutes
          </h1>
          <p className="text-base sm:text-lg md:text-xl text-gray-600 mb-6 sm:mb-8 max-w-3xl mx-auto px-4">
            AI-powered document preparation with state-specific templates.
            Professional affidavits for Texas, Utah, and Arizona.
          </p>
          <button
            onClick={handleGetStarted}
            className="inline-flex items-center px-6 sm:px-8 py-3 sm:py-4 bg-blue-600 text-white text-base sm:text-lg font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-lg hover:shadow-xl"
          >
            <span>Get Started</span>
            {!isAuthenticated && <span className="hidden sm:inline ml-1">(Sign Up Required)</span>}
            <ChevronRight className="ml-2 h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="bg-white py-12 sm:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 sm:gap-12">
            <div className="text-center px-4">
              <div className="flex justify-center mb-4">
                <Zap className="h-10 w-10 sm:h-12 sm:w-12 text-blue-600" />
              </div>
              <h3 className="text-base sm:text-lg font-semibold mb-2">Fast & Easy</h3>
              <p className="text-sm sm:text-base text-gray-600">
                AI guides you through state-specific requirements.
                Complete documents in under 10 minutes.
              </p>
            </div>
            <div className="text-center px-4">
              <div className="flex justify-center mb-4">
                <Shield className="h-10 w-10 sm:h-12 sm:w-12 text-blue-600" />
              </div>
              <h3 className="text-base sm:text-lg font-semibold mb-2">State-Compliant Templates</h3>
              <p className="text-sm sm:text-base text-gray-600">
                Built-in templates ensure compliance with Texas, Utah,
                and Arizona legal requirements.
              </p>
            </div>
            <div className="text-center px-4">
              <div className="flex justify-center mb-4">
                <Scale className="h-10 w-10 sm:h-12 sm:w-12 text-blue-600" />
              </div>
              <h3 className="text-base sm:text-lg font-semibold mb-2">Professional Quality</h3>
              <p className="text-sm sm:text-base text-gray-600">
                Court-ready documents with proper formatting,
                notary blocks, and legal language.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="bg-gray-50 py-12 sm:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8 sm:mb-12 px-4">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3 sm:mb-4">
              Trusted by Families Across Three States
            </h2>
            <p className="text-base sm:text-lg text-gray-600">
              Our AI-powered platform makes legal document preparation accessible and affordable
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
            <div className="text-center px-2">
              <div className="text-2xl sm:text-3xl font-bold text-blue-600 mb-2">$79</div>
              <div className="text-xs sm:text-sm text-gray-600">Per Document</div>
            </div>
            <div className="text-center px-2">
              <div className="text-2xl sm:text-3xl font-bold text-blue-600 mb-2">10 Min</div>
              <div className="text-xs sm:text-sm text-gray-600">Average Completion</div>
            </div>
            <div className="text-center px-2">
              <div className="text-2xl sm:text-3xl font-bold text-blue-600 mb-2">3 States</div>
              <div className="text-xs sm:text-sm text-gray-600">TX, UT, AZ Supported</div>
            </div>
            <div className="text-center px-2">
              <div className="text-2xl sm:text-3xl font-bold text-blue-600 mb-2">24/7</div>
              <div className="text-xs sm:text-sm text-gray-600">Available Anytime</div>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-blue-600 py-12 sm:py-16">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3 sm:mb-4">
            Ready to Create Your Affidavit?
          </h2>
          <p className="text-base sm:text-xl text-blue-100 mb-6 sm:mb-8">
            Join thousands of families who have used our platform for their legal document needs
          </p>
          <button
            onClick={handleGetStarted}
            className="inline-flex items-center px-6 sm:px-8 py-3 sm:py-4 bg-white text-blue-600 text-base sm:text-lg font-semibold rounded-lg hover:bg-gray-50 transition-colors shadow-lg hover:shadow-xl"
          >
            Start Creating Now
            <ChevronRight className="ml-2 h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-300 py-8 sm:py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between">
            {/* Brand */}
            <div className="mb-4 md:mb-0 text-center md:text-left">
              <div className="flex items-center justify-center md:justify-start space-x-2 mb-1">
                <Scale className="h-6 w-6 text-blue-400" />
                <span className="text-xl font-bold text-white">discover.legal</span>
              </div>
              <p className="text-sm text-gray-400">
                Professional legal document preparation
              </p>
            </div>

            {/* Links */}
            <div className="flex flex-wrap justify-center md:justify-end gap-4 sm:gap-6">
              <Link
                to="/resources"
                className="text-sm text-gray-300 hover:text-white transition-colors"
              >
                Resources
              </Link>
              <Link
                to="/privacy"
                className="text-sm text-gray-300 hover:text-white transition-colors"
              >
                Privacy Policy
              </Link>
              <Link
                to="/tos"
                className="text-sm text-gray-300 hover:text-white transition-colors"
              >
                Terms of Service
              </Link>
            </div>
          </div>

          {/* Copyright */}
          <div className="mt-6 pt-6 border-t border-gray-800 text-center">
            <p className="text-xs sm:text-sm text-gray-400">
              © {new Date().getFullYear()} discover.legal. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;