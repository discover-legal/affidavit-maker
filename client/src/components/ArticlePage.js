import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ArrowLeft, Clock, ChevronRight, Scale } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { getArticleBySlug, ARTICLES } from '../content/articles';

const ArticlePage = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const article = getArticleBySlug(slug);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [slug]);

  // If article not found, redirect to resources page
  if (!article) {
    navigate('/resources');
    return null;
  }

  // Get related articles (same category, exclude current)
  const relatedArticles = ARTICLES
    .filter(a => a.category === article.category && a.slug !== article.slug)
    .slice(0, 3);

  // Replace #cta links with actual navigation
  const processedContent = article.content.replace(
    /\[([^\]]+)\]\(#cta\)/g,
    '**[Get Started Now →](/)**'
  );

  const pageUrl = `https://discover.legal/resources/${article.slug}`;

  // Structured data for SEO
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": article.title,
    "description": article.description,
    "url": pageUrl,
    "datePublished": article.publishDate,
    "dateModified": article.publishDate,
    "author": {
      "@type": "Organization",
      "name": "discover.legal",
      "url": "https://discover.legal"
    },
    "publisher": {
      "@type": "Organization",
      "name": "discover.legal",
      "url": "https://discover.legal",
      "logo": {
        "@type": "ImageObject",
        "url": "https://discover.legal/logo512.png"
      }
    },
    "articleSection": article.category,
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": pageUrl
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <Helmet>
        {/* Primary Meta Tags */}
        <title>{article.title} | discover.legal</title>
        <meta name="title" content={article.title} />
        <meta name="description" content={article.description} />

        {/* Canonical URL */}
        <link rel="canonical" href={pageUrl} />

        {/* Open Graph / Facebook */}
        <meta property="og:type" content="article" />
        <meta property="og:url" content={pageUrl} />
        <meta property="og:title" content={article.title} />
        <meta property="og:description" content={article.description} />
        <meta property="og:site_name" content="discover.legal" />
        <meta property="article:published_time" content={article.publishDate} />
        <meta property="article:section" content={article.category} />

        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:url" content={pageUrl} />
        <meta name="twitter:title" content={article.title} />
        <meta name="twitter:description" content={article.description} />

        {/* Additional SEO */}
        <meta name="robots" content="index, follow" />
        <meta name="author" content="discover.legal" />

        {/* Structured Data */}
        <script type="application/ld+json">
          {JSON.stringify(structuredData)}
        </script>
      </Helmet>
      {/* Navigation Bar */}
      <nav className="bg-white border-b shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <button
                onClick={() => navigate('/resources')}
                className="flex items-center text-gray-600 hover:text-gray-900 transition-colors mr-3 sm:mr-4"
                aria-label="Back to resources"
              >
                <ArrowLeft className="h-5 w-5 mr-1 sm:mr-2" />
                <span className="text-sm font-medium hidden sm:inline">Resources</span>
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

      {/* Article Header */}
      <div className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
          <div className="flex items-center gap-4 mb-4">
            <span className="text-5xl sm:text-6xl">{article.image}</span>
            <div>
              <span className="inline-block px-3 py-1 text-xs font-semibold text-blue-600 bg-blue-100 rounded-full uppercase tracking-wide mb-2">
                {article.category}
              </span>
              <div className="flex items-center text-sm text-gray-500">
                <Clock className="h-4 w-4 mr-1" />
                {article.readTime} • {article.publishDate}
              </div>
            </div>
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            {article.title}
          </h1>
          <p className="text-lg sm:text-xl text-gray-600">
            {article.description}
          </p>
        </div>
      </div>

      {/* Article Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="bg-white rounded-lg shadow-lg p-6 sm:p-8 lg:p-12">
          <div className="prose prose-sm sm:prose lg:prose-lg max-w-none">
            <ReactMarkdown
              components={{
                h1: ({ node: _node, children, ...props }) => (
                  <h1 className="text-3xl sm:text-4xl font-bold mt-8 mb-4 text-gray-900" {...props}>
                    {children}
                  </h1>
                ),
                h2: ({ node: _node, children, ...props }) => (
                  <h2 className="text-2xl sm:text-3xl font-bold mt-6 mb-3 text-gray-900" {...props}>
                    {children}
                  </h2>
                ),
                h3: ({ node: _node, children, ...props }) => (
                  <h3 className="text-xl sm:text-2xl font-semibold mt-5 mb-2 text-gray-800" {...props}>
                    {children}
                  </h3>
                ),
                h4: ({ node: _node, children, ...props }) => (
                  <h4 className="text-lg sm:text-xl font-semibold mt-4 mb-2 text-gray-800" {...props}>
                    {children}
                  </h4>
                ),
                p: ({ node: _node, ...props }) => (
                  <p className="mb-4 text-gray-700 leading-relaxed" {...props} />
                ),
                ul: ({ node: _node, ...props }) => (
                  <ul className="mb-4 ml-6 list-disc space-y-2" {...props} />
                ),
                ol: ({ node: _node, ...props }) => (
                  <ol className="mb-4 ml-6 list-decimal space-y-2" {...props} />
                ),
                li: ({ node: _node, ...props }) => (
                  <li className="text-gray-700" {...props} />
                ),
                strong: ({ node: _node, ...props }) => (
                  <strong className="font-semibold text-gray-900" {...props} />
                ),
                em: ({ node: _node, ...props }) => (
                  <em className="italic" {...props} />
                ),
                hr: ({ node: _node, ...props }) => (
                  <hr className="my-8 border-gray-300" {...props} />
                ),
                a: ({ node: _node, href, children, ...props }) => {
                  // Check if it's an internal link
                  if (href && href.startsWith('/')) {
                    return (
                      <button
                        onClick={() => navigate(href)}
                        className="text-blue-600 hover:text-blue-800 underline font-semibold"
                        {...props}
                      >
                        {children}
                      </button>
                    );
                  }
                  return (
                    <a
                      href={href}
                      className="text-blue-600 hover:text-blue-800 underline"
                      target="_blank"
                      rel="noopener noreferrer"
                      {...props}
                    >
                      {children}
                    </a>
                  );
                },
                blockquote: ({ node: _node, ...props }) => (
                  <blockquote className="border-l-4 border-blue-500 pl-4 py-2 my-4 italic text-gray-700 bg-blue-50" {...props} />
                ),
                code: ({ node: _node, inline, ...props }) => {
                  if (inline) {
                    return (
                      <code className="bg-gray-100 px-2 py-1 rounded text-sm font-mono text-gray-800" {...props} />
                    );
                  }
                  return (
                    <code className="block bg-gray-100 p-4 rounded text-sm font-mono text-gray-800 overflow-x-auto" {...props} />
                  );
                },
                pre: ({ node: _node, ...props }) => (
                  <pre className="bg-gray-100 p-4 rounded overflow-x-auto my-4" {...props} />
                ),
                table: ({ node: _node, ...props }) => (
                  <div className="overflow-x-auto my-6">
                    <table className="min-w-full divide-y divide-gray-300" {...props} />
                  </div>
                ),
                thead: ({ node: _node, ...props }) => (
                  <thead className="bg-gray-50" {...props} />
                ),
                tbody: ({ node: _node, ...props }) => (
                  <tbody className="divide-y divide-gray-200 bg-white" {...props} />
                ),
                tr: ({ node: _node, ...props }) => (
                  <tr {...props} />
                ),
                th: ({ node: _node, ...props }) => (
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900" {...props} />
                ),
                td: ({ node: _node, ...props }) => (
                  <td className="px-4 py-3 text-sm text-gray-700" {...props} />
                ),
              }}
            >
              {processedContent}
            </ReactMarkdown>
          </div>

          {/* CTA Box */}
          <div className="mt-12 bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg p-8 text-center">
            <h3 className="text-2xl font-bold text-white mb-3">
              Ready to Create Your Legal Document?
            </h3>
            <p className="text-blue-100 mb-6">
              Save time and money with our AI-powered platform. Professional documents in minutes.
            </p>
            <button
              onClick={() => navigate('/')}
              className="inline-flex items-center px-8 py-4 bg-white text-blue-600 text-lg font-semibold rounded-lg hover:bg-gray-50 transition-colors shadow-lg hover:shadow-xl"
            >
              Get Started Now
              <ChevronRight className="ml-2 h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Related Articles */}
      {relatedArticles.length > 0 && (
        <div className="bg-gray-50 py-12 sm:py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6">Related Articles</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {relatedArticles.map((related) => (
                <div
                  key={related.id}
                  onClick={() => navigate(`/resources/${related.slug}`)}
                  className="bg-white rounded-lg shadow-md hover:shadow-xl transition-shadow cursor-pointer overflow-hidden group"
                >
                  <div className="bg-gradient-to-br from-gray-100 to-gray-200 p-8 text-center">
                    <span className="text-6xl">{related.image}</span>
                  </div>
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-blue-600 uppercase tracking-wide">
                        {related.category}
                      </span>
                      <span className="flex items-center text-xs text-gray-500">
                        <Clock className="h-3 w-3 mr-1" />
                        {related.readTime}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
                      {related.title}
                    </h3>
                    <div className="flex items-center text-blue-600 font-semibold text-sm mt-3">
                      Read Article
                      <ChevronRight className="h-4 w-4 ml-1 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

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

export default ArticlePage;
