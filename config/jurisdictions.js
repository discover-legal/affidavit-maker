'use strict';

/**
 * config/jurisdictions.js
 *
 * Central definition of North American jurisdiction codes and the two
 * feature flags that gate which jurisdictions load:
 *
 *   1. JURISDICTION_ALLOWLIST — comma-separated allow-list ("ON,UT"). When
 *      set, ONLY those codes load. Overrides everything else. Use this to
 *      launch with a narrow slate and expand progressively.
 *
 *   2. ENABLE_INTERNATIONAL — when 'true', ~110 jurisdictions load; when
 *      unset/false, only the NA_JURISDICTIONS set (US 51 + CA 13 = 64).
 *      Ignored when JURISDICTION_ALLOWLIST is set.
 *
 * Imported by TemplateLoader, catalog routes, and chat routes to
 * consistently gate content behind a single control point.
 */

const NA_JURISDICTIONS = new Set([
  // US states + DC (51)
  'TX', 'AZ', 'CA', 'FL', 'IL', 'NY', 'UT',
  'CO', 'GA', 'MA', 'MI', 'NC', 'NJ', 'OH', 'PA', 'VA', 'WA',
  'IN', 'TN', 'MO', 'MD', 'MN', 'KY',
  'WI', 'SC', 'AL', 'OR', 'OK',
  'LA', 'CT', 'NV', 'NM', 'ID',
  'IA', 'AR', 'KS', 'MS', 'NE', 'WV', 'HI', 'ME', 'NH', 'RI', 'MT', 'DE', 'DC',
  'AK', 'ND', 'SD', 'VT', 'WY',
  // Canadian provinces (10)
  'ON', 'BC', 'AB', 'QC', 'MB', 'NB', 'NL', 'NS', 'PE', 'SK',
  // Canadian territories (3)
  'NT', 'YT', 'NU',
]);

/**
 * Parse JURISDICTION_ALLOWLIST env var. Returns a normalized Set of
 * uppercase codes, or null when the env var is unset/empty (meaning no
 * allowlist override — fall through to international-flag logic).
 * A malformed allowlist ("," / whitespace-only) is treated as unset.
 */
function readAllowlist() {
  const raw = process.env.JURISDICTION_ALLOWLIST;
  if (typeof raw !== 'string') return null;
  const codes = raw
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  if (codes.length === 0) return null;
  return new Set(codes);
}

/** Returns true when the ENABLE_INTERNATIONAL env-var is explicitly 'true'. */
function isInternationalEnabled() {
  return process.env.ENABLE_INTERNATIONAL === 'true';
}

/**
 * Returns true if the jurisdiction code should be active under the current
 * feature-flag setting. Priority:
 *   1. JURISDICTION_ALLOWLIST set → only listed codes allowed.
 *   2. Otherwise: NA_JURISDICTIONS always allowed; international allowed
 *      only when ENABLE_INTERNATIONAL=true.
 */
function isAllowedJurisdiction(stateCode) {
  if (!stateCode) return false;
  const code = String(stateCode).toUpperCase();
  const allowlist = readAllowlist();
  if (allowlist) return allowlist.has(code);
  if (NA_JURISDICTIONS.has(code)) return true;
  return isInternationalEnabled();
}

/**
 * Returns a Set of the currently-active jurisdiction codes, computed at
 * call time so callers see live env changes in tests. Useful for building
 * UI lists / catalog responses that should never surface a code the loader
 * would refuse to instantiate.
 */
function activeJurisdictions() {
  const allowlist = readAllowlist();
  if (allowlist) return new Set(allowlist);
  // Without an allowlist we cannot statically enumerate international codes
  // (they live in templates/states/); return the NA set, which the loader
  // will union with any international dirs when ENABLE_INTERNATIONAL=true.
  return new Set(NA_JURISDICTIONS);
}

module.exports = {
  NA_JURISDICTIONS,
  isInternationalEnabled,
  isAllowedJurisdiction,
  activeJurisdictions,
  readAllowlist,
};
