/** @type {import('next').NextConfig} */
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

  async headers() {
    const securityHeaders = [
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      {
        key: 'Strict-Transport-Security',
        value: 'max-age=31536000; includeSubDomains; preload',
      },
      {
        key: 'Permissions-Policy',
        value:
          'camera=(), microphone=(), geolocation=(), payment=(self), usb=(), magnetometer=(), gyroscope=(), accelerometer=()',
      },
    ];

    return [
      {
        source: '/:path*',
        headers: securityHeaders,
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
