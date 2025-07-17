// Landing Page - Allow browsing, require auth for action
import React from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { ChevronRight, Zap, Shield, Scale } from 'lucide-react';

const LandingPage = ({ onGetStarted }) => {
  const { loginWithRedirect, isAuthenticated } = useAuth0();

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
      <nav className="absolute top-0 right-0 p-6">
        {isAuthenticated ? (
          <button
            onClick={onGetStarted}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
          >
            Go to Dashboard
          </button>
        ) : (
          <button
            onClick={() => loginWithRedirect()}
            className="text-gray-700 hover:text-gray-900 font-medium"
          >
            Sign In
          </button>
        )}
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
        <div className="text-center">
          <h1 className="text-5xl font-bold text-gray-900 mb-6">
            Create Legal Affidavits in Minutes
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            AI-powered document preparation with state-specific templates. 
            Professional affidavits for Texas, Utah, and Arizona.
          </p>
          <button
            onClick={handleGetStarted}
            className="inline-flex items-center px-8 py-4 bg-blue-600 text-white text-lg font-semibold rounded-lg hover:bg-blue-700 transition-colors"
          >
            Get Started {!isAuthenticated && '(Sign Up Required)'}
            <ChevronRight className="ml-2 h-5 w-5" />
          </button>
          {!isAuthenticated && (
            <p className="mt-4 text-sm text-gray-500">
              No credit card required for your first document
            </p>
          )}
        </div>
      </div>

      <div className="bg-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="flex justify-center mb-4">
                <Zap className="h-12 w-12 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Fast & Easy</h3>
              <p className="text-gray-600">
                AI guides you through state-specific requirements. 
                Complete documents in under 10 minutes.
              </p>
            </div>
            <div className="text-center">
              <div className="flex justify-center mb-4">
                <Shield className="h-12 w-12 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold mb-2">State-Compliant Templates</h3>
              <p className="text-gray-600">
                Built-in templates ensure compliance with Texas, Utah, 
                and Arizona legal requirements.
              </p>
            </div>
            <div className="text-center">
              <div className="flex justify-center mb-4">
                <Scale className="h-12 w-12 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Professional Quality</h3>
              <p className="text-gray-600">
                Court-ready documents with proper formatting, 
                notary blocks, and legal language.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="bg-gray-50 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Trusted by Families Across Three States
            </h2>
            <p className="text-lg text-gray-600">
              Our AI-powered platform makes legal document preparation accessible and affordable
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600 mb-2">$9.99</div>
              <div className="text-sm text-gray-600">Per Document</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600 mb-2">10 Min</div>
              <div className="text-sm text-gray-600">Average Completion</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600 mb-2">3 States</div>
              <div className="text-sm text-gray-600">TX, UT, AZ Supported</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600 mb-2">24/7</div>
              <div className="text-sm text-gray-600">Available Anytime</div>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-blue-600 py-16">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-white mb-4">
            Ready to Create Your Affidavit?
          </h2>
          <p className="text-xl text-blue-100 mb-8">
            Join thousands of families who have used our platform for their legal document needs
          </p>
          <button
            onClick={handleGetStarted}
            className="inline-flex items-center px-8 py-4 bg-white text-blue-600 text-lg font-semibold rounded-lg hover:bg-gray-50 transition-colors"
          >
            Start Creating Now
            <ChevronRight className="ml-2 h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;