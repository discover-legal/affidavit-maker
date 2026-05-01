/**
 * Allowed Origins — Single Source of Truth
 *
 * Used by CORS (server.js), CSRF protection (csrfProtection.js), and CSP
 * (server.js). When adding a new domain, update ONLY this file.
 *
 * The international subdomains (uk., ie., au., …) are gated behind the
 * same ENABLE_INTERNATIONAL flag that gates the international jurisdiction
 * templates and orchestrators. With the flag off, those subdomains can't
 * reach the API even if they're DNS-pointed at it — keeping the surface
 * area honest about what's actually shipping.
 */

const { isInternationalEnabled } = require('./jurisdictions');

// Always-on production origins — North America + the brand domain.
const NA_ORIGINS = [
  'https://discover.legal',
  'https://www.discover.legal',
  'https://make.discover.legal',     // legacy app subdomain (kept during transition)
  'https://ca.discover.legal',
  'https://canada.discover.legal',
];

// Wave 1+ international subdomains — gated by ENABLE_INTERNATIONAL.
const INTERNATIONAL_ORIGINS = [
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

// Development origins — never returned in production builds. They don't
// resolve outside localhost so they're safe to leave here in dev.
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
  const origins = [...NA_ORIGINS];

  if (isInternationalEnabled()) {
    origins.push(...INTERNATIONAL_ORIGINS);
  }

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

// Back-compat: keep PRODUCTION_ORIGINS exported for existing imports. It
// still represents the always-on set; international additions live in a
// separate export so callers that need a strictly-NA list can use that.
module.exports = {
  PRODUCTION_ORIGINS: NA_ORIGINS,
  NA_ORIGINS,
  INTERNATIONAL_ORIGINS,
  DEVELOPMENT_ORIGINS,
  getAllowedOrigins,
};
