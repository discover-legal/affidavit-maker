// Landing Page - Allow browsing, require auth for action
import React, { useEffect, useState } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ChevronRight, Zap, Shield, Scale } from 'lucide-react';

const LandingPage = ({ onGetStarted }) => {
  const { loginWithRedirect, isAuthenticated } = useAuth0();
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

  // Country-specific configuration
  const config = {
    US: {
      colors: {
        primary: 'blue-600',
        primaryHover: 'blue-700',
        primaryLight: 'blue-50',
        primaryIcon: 'blue-600',
        primaryButton: 'blue-600',
        primaryCTA: 'blue-600'
      },
      copy: {
        hero: {
          subtitle: 'AI-powered document preparation with state-specific templates.',
          description: 'Professional affidavits with legal compliance built-in.'
        },
        features: {
          compliance: 'State-Compliant Templates',
          complianceDesc: "Built-in templates ensure compliance with your state's legal requirements."
        },
        social: {
          heading: 'Trusted by Families Across the Country'
        },
        stats: {
          coverage: 'Multi-State',
          coverageDesc: 'Growing Coverage'
        }
      }
    },
    CA: {
      colors: {
        primary: 'red-600',
        primaryHover: 'red-700',
        primaryLight: 'red-50',
        primaryIcon: 'red-600',
        primaryButton: 'red-600',
        primaryCTA: 'red-600'
      },
      copy: {
        hero: {
          subtitle: 'AI-powered document preparation with province-specific templates.',
          description: 'Professional affidavits with legal compliance built-in.'
        },
        features: {
          compliance: 'Province-Compliant Templates',
          complianceDesc: "Built-in templates ensure compliance with your province's legal requirements."
        },
        social: {
          heading: 'Trusted by Families Across Canada'
        },
        stats: {
          coverage: 'Multi-Province',
          coverageDesc: 'Growing Coverage'
        }
      }
    }
  };

  const currentConfig = config[country];

  // SEO configuration
  const pageTitle = country === 'CA'
    ? 'Create Legal Affidavits Online | AI-Powered Document Generator | discover.legal'
    : 'Create Legal Affidavits Online | AI-Powered Affidavit Generator | discover.legal';

  const pageDescription = country === 'CA'
    ? 'Generate professional, court-ready affidavits in minutes with AI assistance. Province-compliant templates for all Canadian provinces. Fast, accurate, and affordable legal document creation.'
    : 'Generate professional, court-ready affidavits in minutes with AI assistance. State-compliant templates for Texas, Utah, Arizona, and more. Fast, accurate, and affordable legal document creation.';

  const pageUrl = 'https://discover.legal/';

  // Structured data for SEO
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": "https://discover.legal/#organization",
        "name": "discover.legal",
        "url": "https://discover.legal",
        "logo": {
          "@type": "ImageObject",
          "url": "https://discover.legal/logo512.png"
        },
        "description": "AI-powered legal document generation platform specializing in professional affidavits and court-ready legal documents.",
        "sameAs": []
      },
      {
        "@type": "WebSite",
        "@id": "https://discover.legal/#website",
        "url": "https://discover.legal",
        "name": "discover.legal",
        "description": pageDescription,
        "publisher": {
          "@id": "https://discover.legal/#organization"
        }
      },
      {
        "@type": "WebPage",
        "@id": "https://discover.legal/#webpage",
        "url": "https://discover.legal/",
        "name": pageTitle,
        "isPartOf": {
          "@id": "https://discover.legal/#website"
        },
        "description": pageDescription
      }
    ]
  };

  return (
    <div className={`min-h-screen bg-gradient-to-b from-${currentConfig.colors.primaryLight} to-white`}>
      <Helmet>
        {/* Primary Meta Tags */}
        <title>{pageTitle}</title>
        <meta name="title" content={pageTitle} />
        <meta name="description" content={pageDescription} />

        {/* Canonical URL */}
        <link rel="canonical" href={pageUrl} />

        {/* Open Graph / Facebook */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content={pageUrl} />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={pageDescription} />
        <meta property="og:site_name" content="discover.legal" />

        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:url" content={pageUrl} />
        <meta name="twitter:title" content={pageTitle} />
        <meta name="twitter:description" content={pageDescription} />

        {/* Additional SEO */}
        <meta name="robots" content="index, follow" />
        <meta name="author" content="discover.legal" />
        <meta name="keywords" content="affidavit generator, legal documents, AI affidavit, create affidavit online, court documents, notarized affidavit, legal forms" />

        {/* Structured Data */}
        <script type="application/ld+json">
          {JSON.stringify(structuredData)}
        </script>
      </Helmet>

      {/* Navigation Bar with Branding */}
      <nav className="bg-white border-b shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Brand Logo */}
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="flex items-center space-x-2 sm:space-x-3 hover:opacity-80 transition-opacity"
            >
              <Scale className={`h-6 w-6 sm:h-8 sm:w-8 text-${currentConfig.colors.primaryIcon}`} />
              <div className="text-left">
                <h1 className={`text-xl sm:text-2xl font-bold text-${currentConfig.colors.primary}`}>discover.legal</h1>
                <p className="text-xs text-gray-500 hidden sm:block">AI-Powered Legal Documents</p>
              </div>
            </button>

            {/* Navigation Links & Auth Buttons */}
            <div className="flex items-center gap-3 sm:gap-6">
              <Link
                to="/resources"
                className="hidden sm:inline text-gray-700 hover:text-gray-900 font-medium text-sm sm:text-base transition-colors whitespace-nowrap"
              >
                Resources
              </Link>
              {isAuthenticated ? (
                <button
                  onClick={onGetStarted}
                  className={`bg-${currentConfig.colors.primaryButton} text-white px-4 sm:px-6 py-2 rounded-lg hover:bg-${currentConfig.colors.primaryHover} transition-colors text-sm sm:text-base font-medium`}
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
            {currentConfig.copy.hero.subtitle}
            {' '}
            {currentConfig.copy.hero.description}
          </p>
          <button
            onClick={handleGetStarted}
            className={`inline-flex items-center px-6 sm:px-8 py-3 sm:py-4 bg-${currentConfig.colors.primaryButton} text-white text-base sm:text-lg font-semibold rounded-lg hover:bg-${currentConfig.colors.primaryHover} transition-colors shadow-lg hover:shadow-xl`}
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
                <Zap className={`h-10 w-10 sm:h-12 sm:w-12 text-${currentConfig.colors.primaryIcon}`} />
              </div>
              <h3 className="text-base sm:text-lg font-semibold mb-2">Fast & Easy</h3>
              <p className="text-sm sm:text-base text-gray-600">
                AI guides you through {country === 'CA' ? 'province' : 'state'}-specific requirements.
                Complete documents in under 10 minutes.
              </p>
            </div>
            <div className="text-center px-4">
              <div className="flex justify-center mb-4">
                <Shield className={`h-10 w-10 sm:h-12 sm:w-12 text-${currentConfig.colors.primaryIcon}`} />
              </div>
              <h3 className="text-base sm:text-lg font-semibold mb-2">{currentConfig.copy.features.compliance}</h3>
              <p className="text-sm sm:text-base text-gray-600">
                {currentConfig.copy.features.complianceDesc}
              </p>
            </div>
            <div className="text-center px-4">
              <div className="flex justify-center mb-4">
                <Scale className={`h-10 w-10 sm:h-12 sm:w-12 text-${currentConfig.colors.primaryIcon}`} />
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
              {currentConfig.copy.social.heading}
            </h2>
            <p className="text-base sm:text-lg text-gray-600">
              Our AI-powered platform makes legal document preparation accessible and affordable
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
            <div className="text-center px-2">
              <div className={`text-2xl sm:text-3xl font-bold text-${currentConfig.colors.primary} mb-2`}>$79</div>
              <div className="text-xs sm:text-sm text-gray-600">Per Document</div>
            </div>
            <div className="text-center px-2">
              <div className={`text-2xl sm:text-3xl font-bold text-${currentConfig.colors.primary} mb-2`}>10 Min</div>
              <div className="text-xs sm:text-sm text-gray-600">Average Completion</div>
            </div>
            <div className="text-center px-2">
              <div className={`text-2xl sm:text-3xl font-bold text-${currentConfig.colors.primary} mb-2`}>{currentConfig.copy.stats.coverage}</div>
              <div className="text-xs sm:text-sm text-gray-600">{currentConfig.copy.stats.coverageDesc}</div>
            </div>
            <div className="text-center px-2">
              <div className={`text-2xl sm:text-3xl font-bold text-${currentConfig.colors.primary} mb-2`}>24/7</div>
              <div className="text-xs sm:text-sm text-gray-600">Available Anytime</div>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className={`bg-${currentConfig.colors.primaryCTA} py-12 sm:py-16`}>
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3 sm:mb-4">
            Ready to Create Your Affidavit?
          </h2>
          <p className="text-base sm:text-xl text-white mb-6 sm:mb-8">
            Create legally compliant affidavits in minutes
          </p>
          <button
            onClick={handleGetStarted}
            className={`inline-flex items-center px-6 sm:px-8 py-3 sm:py-4 bg-white text-${currentConfig.colors.primaryCTA} text-base sm:text-lg font-semibold rounded-lg hover:bg-gray-50 transition-colors shadow-lg hover:shadow-xl`}
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
                <Scale className={`h-6 w-6 text-${country === 'CA' ? 'red-400' : 'blue-400'}`} />
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