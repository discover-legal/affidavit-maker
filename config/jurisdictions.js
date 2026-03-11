'use strict';

/**
 * config/jurisdictions.js
 *
 * Central definition of North American jurisdiction codes and the
 * ENABLE_INTERNATIONAL feature flag.  Imported by TemplateLoader,
 * catalog routes, and chat routes to consistently gate international
 * content behind a single env-var toggle.
 *
 * ENABLE_INTERNATIONAL=true  -> all ~110 jurisdictions active
 * ENABLE_INTERNATIONAL=false -> only US (50 states + DC) + Canada (10 provinces + 3 territories)
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

/** Returns true when the ENABLE_INTERNATIONAL env-var is explicitly 'true'. */
function isInternationalEnabled() {
  return process.env.ENABLE_INTERNATIONAL === 'true';
}

/**
 * Returns true if the jurisdiction code should be active under the current
 * feature-flag setting.  Always allows NA codes; allows international codes
 * only when ENABLE_INTERNATIONAL=true.
 */
function isAllowedJurisdiction(stateCode) {
  if (!stateCode) return false;
  if (NA_JURISDICTIONS.has(stateCode.toUpperCase())) return true;
  return isInternationalEnabled();
}

module.exports = { NA_JURISDICTIONS, isInternationalEnabled, isAllowedJurisdiction };
