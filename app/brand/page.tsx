import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowLeft, Download } from 'lucide-react';
import MarketingHeader from '@/components/marketing/MarketingHeader';

const pageTitle = 'Brand Assets & Logos';
const pageDescription =
  'Download official discover.legal logos, brand assets, and design resources. Available in multiple formats and sizes.';
const pageUrl = 'https://discover.legal/brand';

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
  inLanguage: 'en-US',
};

const SITE_ORIGIN = 'https://discover.legal';

const logos = [
  {
    name: 'App Icon (1024x1024)',
    path: '/app-icon-1024.png',
    size: '1024×1024',
    format: 'PNG',
    description: 'High resolution app icon, ideal for Auth0 and social media',
  },
  {
    name: 'Logo (512x512)',
    path: '/logo512.png',
    size: '512×512',
    format: 'PNG',
    description: 'Medium resolution logo for web apps and PWAs',
  },
  {
    name: 'Logo (192x192)',
    path: '/logo192.png',
    size: '192×192',
    format: 'PNG',
    description: 'Smaller logo for mobile and thumbnails',
  },
  {
    name: 'App Icon (SVG)',
    path: '/app-icon.svg',
    size: 'Vector',
    format: 'SVG',
    description: 'Scalable vector format, perfect for any size',
  },
] as const;

export default function BrandAssetsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      <MarketingHeader />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">Brand Assets</h1>
          <p className="text-lg text-gray-600">
            Download our logo files for Auth0, social media, and other integrations.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          {logos.map((logo) => (
            <div
              key={logo.path}
              className="bg-white rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition-shadow"
            >
              <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-12 flex items-center justify-center border-b">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={logo.path}
                  alt={logo.name}
                  className="max-w-[200px] max-h-[200px] object-contain"
                  style={{ imageRendering: 'crisp-edges' }}
                />
              </div>

              <div className="p-6">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 mb-1">{logo.name}</h3>
                    <p className="text-sm text-gray-600">{logo.description}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 mb-4 text-sm text-gray-600">
                  <span className="font-semibold">Size: {logo.size}</span>
                  <span className="font-semibold">Format: {logo.format}</span>
                </div>

                <a
                  href={logo.path}
                  download
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors w-full justify-center"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download {logo.format}
                </a>

                <div className="mt-3 p-3 bg-gray-50 rounded border border-gray-200">
                  <p className="text-xs text-gray-600 mb-1 font-semibold">Direct URL:</p>
                  <code className="text-xs text-gray-800 break-all">
                    {SITE_ORIGIN}
                    {logo.path}
                  </code>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6 sm:p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Usage Guidelines</h2>

          <div className="space-y-4 text-gray-700">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">For Auth0</h3>
              <p className="mb-2">
                We recommend using the <strong>1024×1024 PNG</strong> or{' '}
                <strong>512×512 PNG</strong> for Auth0 configuration.
              </p>
              <ul className="list-disc ml-6 space-y-1">
                <li>Go to Auth0 Dashboard → Branding → Universal Login</li>
                <li>Upload the logo file in the Logo section</li>
                <li>Or use the direct URL provided above</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Brand Colors</h3>
              <div className="flex flex-wrap gap-4 mt-2">
                <div className="flex items-center gap-2">
                  <div
                    className="w-12 h-12 rounded border border-gray-300"
                    style={{ backgroundColor: '#2563EB' }}
                  />
                  <div>
                    <p className="font-semibold text-sm">Primary Blue</p>
                    <code className="text-xs text-gray-600">#2563EB</code>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div
                    className="w-12 h-12 rounded border border-gray-300"
                    style={{ backgroundColor: '#FFFFFF' }}
                  />
                  <div>
                    <p className="font-semibold text-sm">White</p>
                    <code className="text-xs text-gray-600">#FFFFFF</code>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Icon Description</h3>
              <p>
                Our logo features a <strong>scale (balance)</strong> icon in white on a blue
                rounded square background, symbolizing justice, fairness, and legal services.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8 text-center">
          <Link
            href="/"
            className="inline-flex items-center px-6 py-3 bg-gray-100 text-gray-700 font-semibold rounded-lg hover:bg-gray-200 transition-colors"
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
