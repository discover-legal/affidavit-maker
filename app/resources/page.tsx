import type { Metadata } from 'next';
import MarketingHeader from '@/components/marketing/MarketingHeader';
import ResourcesContent from '@/components/marketing/ResourcesContent';
import { jsonLd } from '@/lib/json-ld';
import {
  getArticlesForLocale,
  getCategoriesForLocale,
  getFeaturedArticlesForLocale,
} from '@/lib/content/articles';
import { getLocale } from '@/lib/locale.server';

const pageTitle = 'Legal Resources & Guides';
const pageDescription =
  'Free guides and articles to help you understand legal documents and navigate the legal system. Expert advice on affidavits, legal forms, and court procedures.';
const pageUrl = 'https://discover.legal/resources';

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
    card: 'summary_large_image',
    title: `${pageTitle} | discover.legal`,
    description: pageDescription,
    images: ['https://discover.legal/app-icon-1024.png'],
  },
  robots: { index: true, follow: true },
};

export default function ResourcesPage() {
  // Locale is resolved server-side from the host header (or `locale` cookie
  // set by the in-nav flag toggle). Articles, featured list, and categories
  // are filtered to what's relevant for the current locale — Canadian
  // visitors see Canadian-tagged guides, US visitors see US-tagged guides,
  // and 'both'-tagged articles surface for everyone.
  const locale = getLocale();
  const articles = getArticlesForLocale(locale);
  const featured = getFeaturedArticlesForLocale(locale);
  const categories = ['All', ...getCategoriesForLocale(locale)];

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': pageUrl,
    url: pageUrl,
    name: `${pageTitle} | discover.legal`,
    description: pageDescription,
    publisher: {
      '@type': 'Organization',
      name: 'discover.legal',
      url: 'https://discover.legal',
    },
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: articles.map((article, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        url: `https://discover.legal/resources/${article.slug}`,
        name: article.title,
      })),
    },
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(structuredData) }}
      />
      <MarketingHeader />
      <ResourcesContent articles={articles} featured={featured} categories={categories} />
    </div>
  );
}
