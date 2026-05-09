import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowLeft } from 'lucide-react';
import MarketingHeader from '@/components/marketing/MarketingHeader';
import TermsMarkdown from '@/components/marketing/TermsMarkdown';
import { jsonLd } from '@/lib/json-ld';
import {
  TERMS_OF_SERVICE,
  TOS_VERSION,
  TOS_LAST_UPDATED,
} from '@/lib/content/termsOfService';

const pageTitle = 'Terms of Service';
const pageDescription =
  'Terms of service for discover.legal. Learn about the terms and conditions governing your use of our AI-powered legal document platform.';
const pageUrl = 'https://discover.legal/tos';

export const metadata: Metadata = {
  title: pageTitle,
  description: pageDescription,
  alternates: { canonical: pageUrl },
  openGraph: {
    type: 'website',
    url: pageUrl,
    title: `${pageTitle} | discover.legal`,
    description: pageDescription,
    siteName: 'discover.legal',
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
    card: 'summary',
    title: `${pageTitle} | discover.legal`,
    description: pageDescription,
    images: ['https://discover.legal/app-icon-1024.png'],
  },
  robots: { index: true, follow: true },
};

const structuredData = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  '@id': pageUrl,
  url: pageUrl,
  name: `${pageTitle} | discover.legal`,
  description: pageDescription,
  isPartOf: {
    '@type': 'WebSite',
    '@id': 'https://discover.legal/#website',
    url: 'https://discover.legal',
    name: 'discover.legal',
  },
  datePublished: '2024-01-01',
  dateModified: TOS_LAST_UPDATED,
  inLanguage: 'en-US',
};

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(structuredData) }}
      />

      <MarketingHeader />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="bg-white rounded-lg shadow-lg p-6 sm:p-8 lg:p-12">
          <div className="mb-6">
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">Terms of Service</h1>
            <p className="text-sm text-gray-600">
              Version {TOS_VERSION} • Last Updated: {TOS_LAST_UPDATED}
            </p>
          </div>

          <div className="prose prose-sm sm:prose max-w-none">
            <TermsMarkdown>{TERMS_OF_SERVICE}</TermsMarkdown>
          </div>

          <div className="mt-8 pt-6 border-t border-gray-200">
            <Link
              href="/"
              className="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
            >
              <ArrowLeft className="h-5 w-5 mr-2" />
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
