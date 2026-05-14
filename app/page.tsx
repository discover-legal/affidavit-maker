import type { Metadata } from 'next';
import LandingPage from '@/components/marketing/LandingPage';
import { jsonLd } from '@/lib/json-ld';
import { getLocale } from '@/lib/locale.server';
import { getPrice } from '@/lib/pricing';

const pageTitle =
  'AI Divorce Packages & Affidavits — Court-Ready Filings for All 50 States';
const pageDescription =
  'Complete divorce packages and court-ready affidavits prepared in minutes. State-specific templates for all 50 states and D.C. Divorce from $249, affidavits from $79.';
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
    'divorce package',
    'divorce papers online',
    'online divorce filing',
    'uncontested divorce',
    'AI legal documents',
    'affidavit generator',
    'sworn statement',
    'family law',
    'court forms',
    'legal document preparation',
  ],
  robots: { index: true, follow: true },
};

export default function HomePage() {
  const locale = getLocale();
  const divorce = getPrice(locale, 'divorce_package');
  const affidavit = getPrice(locale, 'single_affidavit');

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
        name: 'Divorce Package',
        description:
          'Complete divorce filing package — petition, decree, and supporting documents tailored to your jurisdiction.',
        offers: {
          '@type': 'Offer',
          price: (divorce.amount / 100).toFixed(2),
          priceCurrency: divorce.currency.toUpperCase(),
        },
      },
      {
        '@type': 'Product',
        name: 'General Affidavit',
        description:
          "AI-guided sworn statement of facts, formatted to your jurisdiction's requirements.",
        offers: {
          '@type': 'Offer',
          price: (affidavit.amount / 100).toFixed(2),
          priceCurrency: affidavit.currency.toUpperCase(),
        },
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(structuredData) }}
      />
      <LandingPage locale={locale} />
    </>
  );
}
