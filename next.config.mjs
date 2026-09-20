/** @type {import('next').NextConfig} */

import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT_ROOT = path.dirname(fileURLToPath(import.meta.url));

// Content-Security-Policy.
//
// Tuned for this app's actual dependencies:
//   - Auth0 (login redirects, /api/auth/[auth0] callback)
//   - Stripe.js + Stripe Elements iframe
//   - Google Tag Manager + GA4 (loaded by app/layout.tsx)
//   - Vercel/Next prefetch, dynamic imports (require 'self')
//
// Production `script-src` omits 'unsafe-eval' but currently INCLUDES
// 'unsafe-inline'. Development adds 'unsafe-eval' because Next's React
// Refresh runtime evaluates generated modules; without it the HTML renders
// but hydration fails and every client interaction is inert.
// Next emits a small inline bootstrap runtime, and our marketing pages ship
// inline JSON-LD <script> tags. Moving to nonces or hashes (with
// strict-dynamic) would let the inline allowance drop — until then, do not
// remove 'unsafe-inline' without verifying hydration and JSON-LD still load.
//
// `connect-src` includes Auth0 and Stripe API hosts so the SPA can reach
// them, and 'self' for our own API routes.
//
// `frame-src` allows Stripe Elements (hcaptcha not used).
//
// `style-src` keeps 'unsafe-inline' for Tailwind's @apply runtime tooltip
// styles and the Stripe widgets. If/when those are factored out the inline
// allowance can drop.
//
// Report-Only is OFF — the policy is enforced. If a deploy starts failing
// because of a new third-party widget, prefer to add the host explicitly
// rather than weaken the policy.
const CSP_DIRECTIVES = {
  'default-src': ["'self'"],
  'base-uri': ["'self'"],
  'object-src': ["'none'"],
  'frame-ancestors': ["'none'"], // also enforced by X-Frame-Options: DENY
  'form-action': ["'self'", 'https://*.auth0.com'],

  'script-src': [
    "'self'",
    "'unsafe-inline'", // required for Next's runtime + JSON-LD; tighten with nonces later
    'https://js.stripe.com',
    'https://www.googletagmanager.com',
    'https://www.google-analytics.com',
    'https://ssl.google-analytics.com',
    'https://cdn.auth0.com',
  ],
  'script-src-elem': [
    "'self'",
    "'unsafe-inline'",
    'https://js.stripe.com',
    'https://www.googletagmanager.com',
    'https://www.google-analytics.com',
    'https://cdn.auth0.com',
  ],

  'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
  'font-src': ["'self'", 'data:', 'https://fonts.gstatic.com'],

  'img-src': [
    "'self'",
    'data:',
    'blob:',
    'https://*.stripe.com',
    'https://www.googletagmanager.com',
    'https://*.google-analytics.com',
    'https://*.gravatar.com',
  ],

  'connect-src': [
    "'self'",
    'https://api.stripe.com',
    'https://maps.googleapis.com',
    'https://*.auth0.com',
    'https://www.google-analytics.com',
    'https://*.google-analytics.com',
    'https://stats.g.doubleclick.net',
  ],

  'frame-src': [
    "'self'",
    'https://js.stripe.com',
    'https://hooks.stripe.com',
  ],

  'manifest-src': ["'self'"],
  'media-src': ["'self'"],
  'worker-src': ["'self'", 'blob:'],
  'upgrade-insecure-requests': [],
};

function buildCsp() {
  return Object.entries(CSP_DIRECTIVES)
    .map(([key, values]) => {
      const resolvedValues =
        key === 'script-src' && process.env.NODE_ENV !== 'production'
          ? [...values, "'unsafe-eval'"]
          : values;

      return resolvedValues.length === 0 ? key : `${key} ${resolvedValues.join(' ')}`;
    })
    .join('; ');
}

const LEGACY_SERVER_FILES = [
  './services/**/*',
  './templates/**/*',
  './utils/**/*',
  './matters/**/*',
];

// YAML matter definitions are read from disk at runtime (services/matters);
// every route that touches the catalog needs them traced into standalone.
const MATTER_DEFINITION_FILES = ['./matters/**/*'];

const OCR_RUNTIME_FILES = [
  './node_modules/tesseract.js/**/*',
  './node_modules/tesseract.js-core/**/*',
  './node_modules/@tesseract.js-data/**/*',
  './node_modules/wasm-feature-detect/**/*',
  './node_modules/is-url/**/*',
  './node_modules/regenerator-runtime/**/*',
  './node_modules/idb-keyval/**/*',
  './node_modules/zlibjs/**/*',
  './node_modules/bmp-js/**/*',
  './node_modules/is-electron/**/*',
];

const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,
  turbopack: {
    // A separate lockfile exists above this checkout on the developer
    // machine. Pin tracing/build resolution to this application root so a
    // production build cannot accidentally include sibling workspace files.
    root: PROJECT_ROOT,
  },

  // pdfkit and pdf-lib must load from node_modules at runtime, NOT be
  // bundled into route handlers. Bundling breaks pdfkit's CJS constructor
  // and severs its fs-relative font assets.
  serverExternalPackages: ['pdfkit', 'pdf-lib', 'tesseract.js'],

  // The standalone build's tracer only ships modules reachable via static
  // import analysis. Our Route Handlers reach into the legacy CommonJS
  // services and templates trees via require() (lib/api/services.ts) and the
  // services themselves use require('./...') for sibling modules. Without
  // explicit includes the tracer commonly misses the deeply-nested
  // templates/states/<jurisdiction>/<DocumentType>.js (110 jurisdictions ×
  // ~7 files each) and the runtime container 500s with "Cannot find module".
  outputFileTracingIncludes: {
    '/api/catalog/**/*': MATTER_DEFINITION_FILES,
    '/api/chat': LEGACY_SERVER_FILES,
    '/api/documents/generate': LEGACY_SERVER_FILES,
    '/api/documents/preview': LEGACY_SERVER_FILES,
    '/api/documents/packet': LEGACY_SERVER_FILES,
    '/api/documents/[id]/render': LEGACY_SERVER_FILES,
    '/api/evidence/**/*': LEGACY_SERVER_FILES,
    '/api/facts/rewrite': LEGACY_SERVER_FILES,
    '/api/templates/**/*': LEGACY_SERVER_FILES,
    '/api/validate': LEGACY_SERVER_FILES,
    // tesseract.js loads its worker and trained data by string path, which is
    // invisible to static tracing. Keep that extra weight scoped to OCR only.
    '/api/profile/ingest': [...LEGACY_SERVER_FILES, ...OCR_RUNTIME_FILES],
  },

  async headers() {
    const csp = buildCsp();

    // Headers that are safe on every response (pages AND API redirects).
    // These don't change Content-Type, don't restrict cross-origin
    // navigation, and don't interfere with Auth0/Stripe redirect flows.
    const baseSecurityHeaders = [
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-DNS-Prefetch-Control', value: 'off' },
      { key: 'X-Permitted-Cross-Domain-Policies', value: 'none' },
      { key: 'X-Download-Options', value: 'noopen' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      // 2 years HSTS with preload-ready directives. Only safe once HTTPS is
      // guaranteed on every connection (discover.legal serves only HTTPS).
      {
        key: 'Strict-Transport-Security',
        value: 'max-age=63072000; includeSubDomains; preload',
      },
      {
        key: 'Permissions-Policy',
        value:
          'camera=(), microphone=(), geolocation=(), payment=(self), usb=(), magnetometer=(), gyroscope=(), accelerometer=(), interest-cohort=()',
      },
    ];

    // Headers that are safe on RENDERED PAGES only. We deliberately do
    // NOT apply these to /api/* because:
    //   - CSP doesn't affect a redirect's body, but it ships header bytes
    //     for nothing.
    //   - Cross-Origin-Opener-Policy:same-origin and
    //     Cross-Origin-Resource-Policy:same-origin on a 302 response that
    //     redirects to an external origin (Auth0, Stripe) have been
    //     observed to confuse some browsers / Next.js Link client
    //     navigation into treating the response as a downloadable
    //     resource instead of a redirect.
    const pageOnlySecurityHeaders = [
      { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
      { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
      { key: 'Content-Security-Policy', value: csp },
    ];

    return [
      // Everything gets the base set.
      {
        source: '/:path*',
        headers: baseSecurityHeaders,
      },
      // Pages (anything not under /api/) additionally get COOP/CORP/CSP.
      // path-to-regexp negative-lookahead syntax: any path that does NOT
      // start with `api/`.
      {
        source: '/((?!api/).*)',
        headers: pageOnlySecurityHeaders,
      },
      // The Auth0 callback writes the session cookie; ensure no caching
      // for any /api/auth/* route.
      {
        source: '/api/auth/:path*',
        headers: [{ key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, max-age=0' }],
      },
      {
        source: '/api/payment/:path*',
        headers: [{ key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, max-age=0' }],
      },
    ];
  },

  async redirects() {
    // Two rules — :path* covers /foo/bar but the apex `/` itself can be
    // ambiguous in some Next.js versions, so we add an explicit rule for it.
    // Both go to the canonical apex.
    return [
      {
        source: '/',
        has: [{ type: 'host', value: 'www.discover.legal' }],
        destination: 'https://discover.legal/',
        permanent: true,
      },
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'www.discover.legal' }],
        destination: 'https://discover.legal/:path*',
        permanent: true,
      },
    ];
  },

  async rewrites() {
    // The staging Render service health-checks /health while the app serves
    // /api/health — answer both so a dashboard misconfiguration can't fail
    // an otherwise good deploy.
    return [{ source: '/health', destination: '/api/health' }];
  },
};

export default nextConfig;
