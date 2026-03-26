/**
 * Allowed Origins — Single Source of Truth
 *
 * Used by CORS (server.js), CSRF protection (csrfProtection.js), and CSP (server.js).
 * When adding a new domain, update ONLY this file.
 */

// Production domains — all discover.legal subdomains
const PRODUCTION_ORIGINS = [
  'https://make.discover.legal',
  'https://discover.legal',
  'https://www.discover.legal',
  'https://ca.discover.legal',
  'https://canada.discover.legal',
  // International subdomains (Wave 1+)
  'https://uk.discover.legal',
  'https://ie.discover.legal',
  'https://au.discover.legal',
  'https://nz.discover.legal',
  'https://in.discover.legal',
  'https://pk.discover.legal',
  'https://bd.discover.legal',
  'https://lk.discover.legal',
  'https://sa.discover.legal',
  'https://ng.discover.legal',
  'https://ke.discover.legal',
  'https://gh.discover.legal',
  'https://ug.discover.legal',
  'https://tz.discover.legal',
  'https://zm.discover.legal',
  'https://zw.discover.legal',
  'https://bw.discover.legal',
  'https://mw.discover.legal',
  'https://na.discover.legal',
  'https://sg.discover.legal',
  'https://hk.discover.legal',
  'https://my.discover.legal',
  'https://jm.discover.legal',
  'https://tt.discover.legal',
  'https://bb.discover.legal',
  'https://bs.discover.legal',
  'https://bm.discover.legal',
  'https://fj.discover.legal',
  'https://pg.discover.legal',
  'https://cy.discover.legal',
];

// Development origins — safe to include always (they don't resolve in production)
const DEVELOPMENT_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3000',
  'http://ca.localhost:3000',
  'http://canada.localhost:3000',
];

/**
 * Get the full list of allowed origins for the current environment.
 * Includes FRONTEND_URL env var if set, deduplicates automatically.
 *
 * @returns {string[]} Unique list of allowed origin URLs
 */
function getAllowedOrigins() {
  const origins = [...PRODUCTION_ORIGINS];

  // Include FRONTEND_URL if set (e.g., staging deployments)
  if (process.env.FRONTEND_URL && process.env.FRONTEND_URL.trim()) {
    origins.push(process.env.FRONTEND_URL.trim().replace(/\/$/, ''));
  }

  // Only include dev origins outside production
  if (process.env.NODE_ENV !== 'production') {
    origins.push(...DEVELOPMENT_ORIGINS);
  }

  return [...new Set(origins)];
}

module.exports = {
  PRODUCTION_ORIGINS,
  DEVELOPMENT_ORIGINS,
  getAllowedOrigins,
};
