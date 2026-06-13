'use strict';

/**
 * config/marketplace.js
 *
 * Central definition of the document-marketplace feature flag. Imported by
 * CommonJS services and (via the TS shim in lib/marketplace/flag.ts) by Route
 * Handlers and pages so the entire marketplace surface — UI routes, API
 * endpoints, and SDK-backed reads — is gated behind a single env-var toggle.
 *
 * ENABLE_MARKETPLACE=true  -> marketplace UI + /api/marketplace/* endpoints live
 * ENABLE_MARKETPLACE=false -> the marketplace does not exist: pages 404, API
 *                             routes 404, nav surfaces nothing. Current users
 *                             see exactly the pre-marketplace product.
 *
 * Default is OFF. Production stays off (render.yaml) until launch.
 */

/** Returns true only when ENABLE_MARKETPLACE is explicitly the string 'true'. */
function isMarketplaceEnabled() {
  return process.env.ENABLE_MARKETPLACE === 'true';
}

module.exports = { isMarketplaceEnabled };
