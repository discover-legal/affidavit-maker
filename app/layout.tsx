import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import { getSession } from '@auth0/nextjs-auth0';
import Providers from './providers';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://discover.legal'),
  title: {
    default: 'discover.legal — AI Legal Documents',
    template: '%s | discover.legal',
  },
  description:
    'AI-assisted affidavit, divorce petition, and proposed decree drafts using jurisdiction-specific templates.',
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

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Pre-populate the client-side UserProvider with the server-side session so
  // useUser() returns the user on the very first render instead of starting
  // with isLoading:true. Without this, the editor's initialization effect fires
  // before auth resolves, marking the document as initialized while
  // isAuthenticated is still false — the document is then never created.
  const session = await getSession();

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
        <Providers user={session?.user}>{children}</Providers>
      </body>
    </html>
  );
}
