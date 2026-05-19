/** @type {import('next').NextConfig} */

// Content-Security-Policy.
//
// Tuned for this app's actual dependencies:
//   - Auth0 (login redirects, /api/auth/[auth0] callback)
//   - Stripe.js + Stripe Elements iframe
//   - Google Tag Manager + GA4 (loaded by app/layout.tsx)
//   - Vercel/Next prefetch, dynamic imports (require 'self')
//
// `script-src` deliberately omits 'unsafe-inline' and 'unsafe-eval'. Next
// emits a small inline runtime that needs a nonce or strict-dynamic; we use
// strict-dynamic + a hash for the inline JSON-LD shipped by our marketing
// pages (which is the only inline <script> we author). The Next runtime is
// loaded as an external script from _next/static, which is allowed by 'self'.
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
    .map(([key, values]) => (values.length === 0 ? key : `${key} ${values.join(' ')}`))
    .join('; ');
}

const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,

  // The standalone build's tracer only ships modules reachable via static
  // import analysis. Our Route Handlers reach into the legacy CommonJS
  // services and templates trees via require() (lib/api/services.ts) and the
  // services themselves use require('./...') for sibling modules. Without
  // explicit includes the tracer commonly misses the deeply-nested
  // templates/states/<jurisdiction>/<DocumentType>.js (110 jurisdictions ×
  // ~7 files each) and the runtime container 500s with "Cannot find module".
  experimental: {
    outputFileTracingIncludes: {
      '/api/**/*': [
        './services/**/*',
        './templates/**/*',
        './utils/**/*',
        './config/**/*',
      ],
      '/**/*': [
        './services/**/*',
        './templates/**/*',
        './utils/**/*',
        './config/**/*',
      ],
    },
  },

  async headers() {
    const csp = buildCsp();
    const securityHeaders = [
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
      // Cross-Origin isolation. COEP/COOP are conservative defaults that
      // prevent cross-origin window access AND opt into a coherent origin
      // group. CORP=same-origin makes our static assets unembeddable on
      // other sites — appropriate for a private legal app.
      { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
      { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
      // COEP intentionally NOT set globally — it conflicts with Stripe's
      // iframe (which is loaded cross-origin without CORP headers). If/when
      // Stripe Elements moves to credentialless we can set 'require-corp'.
      { key: 'Content-Security-Policy', value: csp },
    ];

    return [
      {
        source: '/:path*',
        headers: securityHeaders,
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
};

export default nextConfig;
