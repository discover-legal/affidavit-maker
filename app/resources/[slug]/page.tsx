import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ArrowLeft, Clock, ChevronRight, Scale } from 'lucide-react';
import ArticleMarkdown from '@/components/marketing/ArticleMarkdown';
import { ARTICLES, getArticleBySlug, type Article } from '@/lib/content/articles';
import { jsonLd } from '@/lib/json-ld';

type ArticlePageProps = {
  params: { slug: string };
};

export function generateStaticParams() {
  return ARTICLES.map((article) => ({ slug: article.slug }));
}

// Article publishDate is human-readable ("June 10, 2026"); schema.org and
// og:article:published_time require ISO 8601. Format from local date parts
// rather than toISOString() so the UTC conversion can't shift the day.
function toIsoDate(humanDate: string): string {
  const parsed = new Date(humanDate);
  if (Number.isNaN(parsed.getTime())) return humanDate;
  const y = parsed.getFullYear();
  const m = String(parsed.getMonth() + 1).padStart(2, '0');
  const d = String(parsed.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function generateMetadata({ params }: ArticlePageProps): Metadata {
  const article = getArticleBySlug(params.slug);
  if (!article) {
    return {};
  }

  const pageUrl = `https://discover.legal/resources/${article.slug}`;

  return {
    title: article.title,
    description: article.description,
    alternates: { canonical: pageUrl },
    openGraph: {
      type: 'article',
      url: pageUrl,
      title: `${article.title} | discover.legal`,
      description: article.description,
      siteName: 'discover.legal',
      publishedTime: toIsoDate(article.publishDate),
      section: article.category,
      images: [
        {
          url: 'https://discover.legal/app-icon-1024.png',
          width: 1024,
          height: 1024,
          alt: 'discover.legal — AI-Powered Legal Documents',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${article.title} | discover.legal`,
      description: article.description,
      images: ['https://discover.legal/app-icon-1024.png'],
    },
    robots: { index: true, follow: true },
  };
}

function buildStructuredData(article: Article) {
  const pageUrl = `https://discover.legal/resources/${article.slug}`;
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.description,
    url: pageUrl,
    datePublished: toIsoDate(article.publishDate),
    dateModified: toIsoDate(article.publishDate),
    author: {
      '@type': 'Organization',
      name: 'discover.legal',
      url: 'https://discover.legal',
    },
    publisher: {
      '@type': 'Organization',
      name: 'discover.legal',
      url: 'https://discover.legal',
      logo: {
        '@type': 'ImageObject',
        url: 'https://discover.legal/logo512.png',
      },
    },
    articleSection: article.category,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': pageUrl,
    },
  };
}

export default function ArticlePage({ params }: ArticlePageProps) {
  const article = getArticleBySlug(params.slug);
  if (!article) {
    notFound();
  }

  // Related-article suggestions match the locale of the article being viewed
  // (not the visitor's), so a Canadian article links to other Canadian
  // articles even if a US visitor lands here from an external link.
  const articleLocale = article.locale ?? 'us';
  const relatedArticles = ARTICLES.filter((a) => {
    if (a.slug === article.slug) return false;
    if (a.category !== article.category) return false;
    const tag = a.locale ?? 'us';
    return tag === 'both' || tag === articleLocale;
  }).slice(0, 3);

  // Replace #cta links with internal navigation to home
  const processedContent = article.content.replace(
    /\[([^\]]+)\]\(#cta\)/g,
    '**[Get Started Now →](/)**',
  );

  const structuredData = buildStructuredData(article);

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(structuredData) }}
      />

      <nav className="bg-white border-b shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Link
                href="/resources"
                className="flex items-center text-gray-600 hover:text-gray-900 transition-colors mr-3 sm:mr-4"
                aria-label="Back to resources"
              >
                <ArrowLeft className="h-5 w-5 mr-1 sm:mr-2" />
                <span className="text-sm font-medium hidden sm:inline">Resources</span>
              </Link>
              <Link href="/" className="flex items-center space-x-2 sm:space-x-3">
                <Scale className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600" />
                <div className="text-left">
                  <h1 className="text-xl sm:text-2xl font-bold text-blue-600">discover.legal</h1>
                  <p className="text-xs text-gray-500 hidden sm:block">
                    AI-Powered Legal Documents
                  </p>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </nav>

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
          <p className="text-lg sm:text-xl text-gray-600">{article.description}</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="bg-white rounded-lg shadow-lg p-6 sm:p-8 lg:p-12">
          <div className="prose prose-sm sm:prose lg:prose-lg max-w-none">
            <ArticleMarkdown>{processedContent}</ArticleMarkdown>
          </div>

          <div className="mt-12 bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg p-8 text-center">
            <h3 className="text-2xl font-bold text-white mb-3">
              Ready to Create Your Legal Document?
            </h3>
            <p className="text-blue-100 mb-6">
              Save time and money with our AI-powered platform. Professional documents in minutes.
            </p>
            <Link
              href="/"
              className="inline-flex items-center px-8 py-4 bg-white text-blue-600 text-lg font-semibold rounded-lg hover:bg-gray-50 transition-colors shadow-lg hover:shadow-xl"
            >
              Get Started Now
              <ChevronRight className="ml-2 h-5 w-5" />
            </Link>
          </div>
        </div>
      </div>

      {relatedArticles.length > 0 && (
        <div className="bg-gray-50 py-12 sm:py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6">
              Related Articles
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {relatedArticles.map((related) => (
                <Link
                  key={related.id}
                  href={`/resources/${related.slug}`}
                  className="bg-white rounded-lg shadow-md hover:shadow-xl transition-shadow overflow-hidden group"
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
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      <footer className="bg-gray-900 text-gray-300 py-8 sm:py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between">
            <div className="mb-4 md:mb-0 text-center md:text-left">
              <div className="flex items-center justify-center md:justify-start space-x-2 mb-1">
                <Scale className="h-6 w-6 text-blue-400" />
                <span className="text-xl font-bold text-white">discover.legal</span>
              </div>
              <p className="text-sm text-gray-400">Professional legal document preparation.</p>
            </div>

            <div className="flex flex-wrap justify-center md:justify-end gap-4 sm:gap-6">
              <Link href="/" className="text-sm text-gray-300 hover:text-white transition-colors">
                Home
              </Link>
              <Link
                href="/resources"
                className="text-sm text-gray-300 hover:text-white transition-colors"
              >
                Resources
              </Link>
              <Link
                href="/privacy"
                className="text-sm text-gray-300 hover:text-white transition-colors"
              >
                Privacy Policy
              </Link>
              <Link href="/tos" className="text-sm text-gray-300 hover:text-white transition-colors">
                Terms of Service
              </Link>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-gray-800 text-center">
            <p className="text-xs sm:text-sm text-gray-400">
              © {new Date().getFullYear()} discover.legal. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
