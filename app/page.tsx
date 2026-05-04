import type { Metadata } from 'next';
import LandingPage from '@/components/marketing/LandingPage';

const pageTitle =
  'AI Legal Documents — Affidavits & Divorce Filings for All 50 States';
const pageDescription =
  'Court-ready affidavits and complete divorce packages prepared in minutes. State-specific templates for all 50 states and D.C. From $79.';
const pageUrl = 'https://discover.legal/';

export const metadata: Metadata = {
  title: { absolute: `${pageTitle} | discover.legal` },
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
  keywords: [
    'affidavit generator',
    'divorce papers online',
    'divorce package',
    'AI legal documents',
    'sworn statement',
    'court forms',
    'family law',
    'legal document preparation',
  ],
  robots: { index: true, follow: true },
};

const structuredData = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': 'https://discover.legal/#organization',
      name: 'discover.legal',
      url: 'https://discover.legal',
      logo: { '@type': 'ImageObject', url: 'https://discover.legal/logo512.png' },
      description:
        'AI-powered legal document preparation — affidavits and divorce filings tailored to every U.S. state and Canadian province.',
    },
    {
      '@type': 'WebSite',
      '@id': 'https://discover.legal/#website',
      url: 'https://discover.legal',
      name: 'discover.legal',
      description: pageDescription,
      publisher: { '@id': 'https://discover.legal/#organization' },
    },
    {
      '@type': 'Product',
      name: 'General Affidavit',
      description:
        "AI-guided sworn statement of facts, formatted to your jurisdiction's requirements.",
      offers: { '@type': 'Offer', price: '79.00', priceCurrency: 'USD' },
    },
    {
      '@type': 'Product',
      name: 'Divorce Package',
      description:
        'Complete divorce filing package — petition, decree, and supporting documents.',
      offers: { '@type': 'Offer', price: '249.00', priceCurrency: 'USD' },
    },
  ],
};

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <LandingPage />
    </>
  );
}
