import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import Providers from './providers';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://discover.legal'),
  title: {
    default: 'discover.legal — AI Legal Documents',
    template: '%s | discover.legal',
  },
  description:
    'Court-ready affidavits and complete divorce packages prepared in minutes. Jurisdiction-specific templates for all 50 U.S. states + D.C. and every Canadian province & territory.',
  applicationName: 'discover.legal',
  authors: [{ name: 'discover.legal' }],
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/logo512.png', type: 'image/png', sizes: '512x512' },
      { url: '/logo512.png', type: 'image/png', sizes: '192x192' },
    ],
    apple: '/logo512.png',
  },
  manifest: '/manifest.json',
  other: {
    'facebook-domain-verification': '6a8hixmvx9gtrerhvtbxzcgn06h9mg',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#2563eb',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-LZE32YYQ9P"
          strategy="afterInteractive"
        />
        <Script src="/gtm.js" strategy="afterInteractive" />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
