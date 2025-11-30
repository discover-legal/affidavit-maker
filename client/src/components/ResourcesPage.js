import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ArrowLeft, BookOpen, Clock, ChevronRight, Scale } from 'lucide-react';
import { ARTICLES, getCategories } from '../content/articles';

const ResourcesPage = () => {
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState('All');
  const categories = ['All', ...getCategories()];

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const filteredArticles = selectedCategory === 'All'
    ? ARTICLES
    : ARTICLES.filter(article => article.category === selectedCategory);

  const featuredArticles = ARTICLES.filter(article => article.featured);

  const pageTitle = 'Legal Resources & Guides | discover.legal';
  const pageDescription = 'Free guides and articles to help you understand legal documents and navigate the legal system. Expert advice on affidavits, legal forms, and court procedures.';
  const pageUrl = 'https://discover.legal/resources';

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
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
      </Helmet>
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

      {/* Hero Section */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white py-12 sm:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="flex justify-center mb-4">
              <BookOpen className="h-12 w-12 sm:h-16 sm:w-16" />
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
              Legal Resources & Guides
            </h1>
            <p className="text-lg sm:text-xl text-blue-100 max-w-3xl mx-auto">
              Free guides and articles to help you understand legal documents and navigate the legal system
            </p>
          </div>
        </div>
      </div>

      {/* Featured Articles */}
      {featuredArticles.length > 0 && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6">Featured Articles</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {featuredArticles.map((article) => (
              <div
                key={article.id}
                onClick={() => navigate(`/resources/${article.slug}`)}
                className="bg-white rounded-lg shadow-md hover:shadow-xl transition-shadow cursor-pointer overflow-hidden group"
              >
                <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-8 text-center">
                  <span className="text-6xl">{article.image}</span>
                </div>
                <div className="p-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-blue-600 uppercase tracking-wide">
                      {article.category}
                    </span>
                    <span className="flex items-center text-xs text-gray-500">
                      <Clock className="h-3 w-3 mr-1" />
                      {article.readTime}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
                    {article.title}
                  </h3>
                  <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                    {article.description}
                  </p>
                  <div className="flex items-center text-blue-600 font-semibold text-sm">
                    Read More
                    <ChevronRight className="h-4 w-4 ml-1 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Category Filter */}
      <div className="bg-white border-y">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  selectedCategory === category
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* All Articles */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6">
          {selectedCategory === 'All' ? 'All Articles' : `${selectedCategory} Articles`}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredArticles.map((article) => (
            <div
              key={article.id}
              onClick={() => navigate(`/resources/${article.slug}`)}
              className="bg-white rounded-lg shadow-md hover:shadow-xl transition-shadow cursor-pointer overflow-hidden group"
            >
              <div className="bg-gradient-to-br from-gray-100 to-gray-200 p-8 text-center">
                <span className="text-6xl">{article.image}</span>
              </div>
              <div className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-blue-600 uppercase tracking-wide">
                    {article.category}
                  </span>
                  <span className="flex items-center text-xs text-gray-500">
                    <Clock className="h-3 w-3 mr-1" />
                    {article.readTime}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
                  {article.title}
                </h3>
                <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                  {article.description}
                </p>
                <p className="text-xs text-gray-500 mb-3">
                  {article.publishDate}
                </p>
                <div className="flex items-center text-blue-600 font-semibold text-sm">
                  Read Article
                  <ChevronRight className="h-4 w-4 ml-1 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-blue-600 py-12 sm:py-16">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">
            Ready to Create Your Affidavit?
          </h2>
          <p className="text-base sm:text-xl text-blue-100 mb-6 sm:mb-8">
            Skip the hassle and create professional legal documents in minutes
          </p>
          <button
            onClick={() => navigate('/')}
            className="inline-flex items-center px-6 sm:px-8 py-3 sm:py-4 bg-white text-blue-600 text-base sm:text-lg font-semibold rounded-lg hover:bg-gray-50 transition-colors shadow-lg hover:shadow-xl"
          >
            Get Started Now
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
              <button
                onClick={() => navigate('/')}
                className="text-sm text-gray-300 hover:text-white transition-colors"
              >
                Home
              </button>
              <button
                onClick={() => navigate('/resources')}
                className="text-sm text-gray-300 hover:text-white transition-colors"
              >
                Resources
              </button>
              <button
                onClick={() => navigate('/privacy')}
                className="text-sm text-gray-300 hover:text-white transition-colors"
              >
                Privacy Policy
              </button>
              <button
                onClick={() => navigate('/tos')}
                className="text-sm text-gray-300 hover:text-white transition-colors"
              >
                Terms of Service
              </button>
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

export default ResourcesPage;
