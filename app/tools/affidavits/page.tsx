import type { Metadata } from 'next';
import LandingPage from '@/components/marketing/LandingPage';
import { jsonLd } from '@/lib/json-ld';

const pageTitle =
  'Free AI-Assisted Divorce Drafts & Affidavits';
const pageDescription =
  'Free guided interviews organize your story into divorce petition, decree, affidavit, and supporting document drafts — with bilingual step-by-step help for serving, responding, and hearings in seven U.S. states.';
const pageUrl = 'https://discover.legal/tools/affidavits';

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
    'free divorce papers',
    'divorce package',
    'divorce papers online',
    'divorce paperwork organizer',
    'court forms help',
    'uncontested divorce',
    'AI legal documents',
    'affidavit generator',
    'sworn statement',
    'family law',
    'court forms',
    'legal document preparation',
    'respond to divorce papers',
    'fee waiver',
    'divorcio gratis',
  ],
  robots: { index: true, follow: true },
};

/**
 * Build the Offer block for a digital-delivery product. Google's
 * Merchant Listings rich result requires `availability`,
 * `hasMerchantReturnPolicy`, and `shippingDetails` even for digital
 * goods — we model instant, free, US delivery and a no-returns
 * policy (these are completed legal documents, not subscriptions).
 */
function digitalOffer(opts: {
  url: string;
  price: string;
  priceCurrency: string;
}) {
  return {
    '@type': 'Offer',
    url: opts.url,
    price: opts.price,
    priceCurrency: opts.priceCurrency,
    availability: 'https://schema.org/InStock',
    itemCondition: 'https://schema.org/NewCondition',
    hasMerchantReturnPolicy: {
      '@type': 'MerchantReturnPolicy',
      applicableCountry: 'US',
      returnPolicyCategory: 'https://schema.org/MerchantReturnNotPermitted',
    },
    shippingDetails: {
      '@type': 'OfferShippingDetails',
      shippingRate: {
        '@type': 'MonetaryAmount',
        value: '0',
        currency: opts.priceCurrency,
      },
      shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'US' },
      deliveryTime: {
        '@type': 'ShippingDeliveryTime',
        handlingTime: { '@type': 'QuantitativeValue', minValue: 0, maxValue: 0, unitCode: 'DAY' },
        transitTime: { '@type': 'QuantitativeValue', minValue: 0, maxValue: 0, unitCode: 'DAY' },
      },
    },
  };
}

const BRAND = { '@type': 'Brand', name: 'discover.legal' } as const;
const PRODUCT_IMAGE = 'https://discover.legal/app-icon-1024.png';

export default function AffidavitsToolPage() {
  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': pageUrl,
        url: pageUrl,
        name: `${pageTitle} | discover.legal`,
        description: pageDescription,
        isPartOf: { '@id': 'https://discover.legal/#website' },
        about: { '@id': 'https://discover.legal/#organization' },
      },
      {
        '@type': 'Product',
        '@id': 'https://discover.legal/#product-divorce-package',
        name: 'Divorce Package',
        description:
          'Guided divorce document preparation: organized petition and proposed decree drafts tailored to your jurisdiction — source material for your court’s official forms or a lawyer’s review.',
        image: [PRODUCT_IMAGE],
        brand: BRAND,
        category: 'Legal document preparation',
        offers: digitalOffer({
          url: pageUrl,
          price: '0.00',
          priceCurrency: 'USD',
        }),
      },
      {
        '@type': 'Product',
        '@id': 'https://discover.legal/#product-general-affidavit',
        name: 'General Affidavit',
        description:
          "AI-guided sworn-statement draft that organizes your facts, formatted to your jurisdiction's conventions.",
        image: [PRODUCT_IMAGE],
        brand: BRAND,
        category: 'Legal document preparation',
        offers: digitalOffer({
          url: pageUrl,
          price: '0.00',
          priceCurrency: 'USD',
        }),
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(structuredData) }}
      />
      <LandingPage />
    </>
  );
}
