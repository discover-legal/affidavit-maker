'use strict';

/**
 * config/features.js
 *
 * Centralised feature flags. Each flag resolves from process.env at call time
 * (not module load) so tests can flip flags between assertions without
 * reimporting modules.
 *
 * Conventions:
 *   - A flag is "enabled" only when the env var is the exact string 'true'.
 *     Anything else (undefined, '', '1', 'false', 'TRUE') is disabled.
 *   - All flags default to **off**. Adding a flag never changes runtime
 *     behaviour for existing deployments unless they opt in.
 *   - Code that depends on a flag should call `assertEnabled(name)` at the
 *     entry point so unauthorised use throws a clear, traceable error
 *     instead of silently mutating state.
 */

const { AuthorizationError } = require('../middleware/errorMiddleware');

const FLAGS = Object.freeze({
  ENABLE_INTERNATIONAL: 'ENABLE_INTERNATIONAL',
  ENABLE_MARKETPLACE: 'ENABLE_MARKETPLACE',
  // Sub-flag: when MARKETPLACE_AUTO_APPROVE=true, published templates skip
  // the pending_review queue. Only honoured when ENABLE_MARKETPLACE=true.
  MARKETPLACE_AUTO_APPROVE: 'MARKETPLACE_AUTO_APPROVE',
});

function isEnabled(flagName) {
  return process.env[flagName] === 'true';
}

function isMarketplaceEnabled() {
  return isEnabled(FLAGS.ENABLE_MARKETPLACE);
}

function isMarketplaceAutoApprove() {
  return isMarketplaceEnabled() && isEnabled(FLAGS.MARKETPLACE_AUTO_APPROVE);
}

/**
 * Throws AuthorizationError if the named flag is not enabled. Use at every
 * marketplace service entry point so disabled deployments fail loud rather
 * than silently mutating state.
 */
function assertEnabled(flagName) {
  if (!isEnabled(flagName)) {
    throw new AuthorizationError(`Feature '${flagName}' is not enabled on this deployment`);
  }
}

/**
 * Express middleware that 404s any request to a route group when the flag is
 * disabled. Disguising the route as not-found is intentional: it prevents
 * disabled deployments from advertising the existence of feature endpoints.
 */
function requireFlag(flagName) {
  return function featureFlagGate(req, res, next) {
    if (!isEnabled(flagName)) {
      return res.status(404).json({
        success: false,
        error: 'Not found',
        errorType: 'NotFoundError',
      });
    }
    next();
  };
}

module.exports = {
  FLAGS,
  isEnabled,
  isMarketplaceEnabled,
  isMarketplaceAutoApprove,
  assertEnabled,
  requireFlag,
};
