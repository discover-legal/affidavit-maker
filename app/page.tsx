import type { Metadata } from 'next';
import ConsultancyPage from '@/components/marketing/consultancy/ConsultancyPage';
import { GITHUB_ORG, SERVICES } from '@/components/marketing/consultancy/content';
import { jsonLd } from '@/lib/json-ld';

const pageTitle = 'Legal Technology Consultancy: Buy, Build, Run';
const pageDescription =
  'discover.legal helps law firms and legal teams select legal technology, build custom intake and document automation, and run it as a managed service. Two free solutions: discover.legal Documents and the open-source BigLaw platform.';
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
        alt: 'discover.legal — Legal technology consultancy',
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
    'legal technology consultancy',
    'legaltech consulting',
    'law firm technology',
    'legal software selection',
    'legal document automation',
    'client intake software',
    'legal AI',
    'managed services for law firms',
    'fractional CTO law firm',
    'open source legal AI',
  ],
  robots: { index: true, follow: true },
};

export default function HomePage() {
  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'ProfessionalService',
        '@id': 'https://discover.legal/#organization',
        name: 'discover.legal',
        url: 'https://discover.legal',
        logo: { '@type': 'ImageObject', url: 'https://discover.legal/logo512.png' },
        sameAs: [GITHUB_ORG],
        description: pageDescription,
        knowsAbout: ['Legal technology', 'Document automation', 'Legal AI', 'Managed services'],
        hasOfferCatalog: {
          '@type': 'OfferCatalog',
          name: 'Consultancy services',
          itemListElement: SERVICES.map((s) => ({
            '@type': 'Offer',
            itemOffered: { '@type': 'Service', name: `${s.name}: ${s.headline}`, description: s.body, url: `https://discover.legal/services#${s.key}` },
          })),
        },
      },
      {
        '@type': 'WebSite',
        '@id': 'https://discover.legal/#website',
        url: 'https://discover.legal',
        name: 'discover.legal',
        description: pageDescription,
        publisher: { '@id': 'https://discover.legal/#organization' },
      },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(structuredData) }} />
      <ConsultancyPage />
    </>
  );
}
