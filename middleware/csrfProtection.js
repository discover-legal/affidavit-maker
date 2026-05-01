// middleware/csrfProtection.js
// CSRF protection for JWT-based API
const logger = require('../utils/logger');

// Helper to normalize origin/referer URL (remove trailing slash)
const normalizeUrl = (url) => {
  if (!url) return null;
  return url.replace(/\/$/, '');
};

// Single source of truth — shared with server.js CORS config
const { getAllowedOrigins } = require('../config/allowedOrigins');

/**
 * CSRF Protection Middleware
 *
 * For JWT-based APIs, traditional CSRF tokens are less critical because:
 * - Custom headers (Authorization) cannot be set by cross-site requests
 * - Same-origin policy prevents token theft
 *
 * However, we still validate Origin/Referer headers for defense in depth.
 */
// Explicit whitelist of webhook paths that skip CSRF (they have signature verification)
// SECURITY (MED-11): Removed '/api/auth0-webhooks/user-delete' - route doesn't exist
// SECURITY FIX: Paths must match actual mounted routes in server.js
// Auth0 webhooks are mounted at /api/webhooks/auth0 (not /api/auth0-webhooks)
const WEBHOOK_PATHS = new Set([
  '/api/payment/webhook',
  '/api/webhooks/auth0/user-update',
  '/api/webhooks/auth0/email-update'
]);

const csrfProtection = (req, res, next) => {
  // Skip CSRF check for:
  // - GET/HEAD/OPTIONS requests (safe methods)
  // - Webhook endpoints (have their own signature verification)
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  const isWebhook = WEBHOOK_PATHS.has(req.path);

  if (safeMethods.includes(req.method) || isWebhook) {
    return next();
  }

  // Get allowed origins
  const allowedOrigins = getAllowedOrigins();

  // Check Origin header (modern browsers)
  const origin = req.headers.origin;
  const referer = req.headers.referer;

  // At least one of Origin or Referer must be present
  if (!origin && !referer) {
    logger.logSecurity('csrf_missing_origin_referer', {
      method: req.method,
      path: req.path,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      allowedOrigins,
      nodeEnv: process.env.NODE_ENV
    });

    return res.status(403).json({
      success: false,
      error: 'Missing origin or referer header',
      errorType: 'csrf_protection'
    });
  }

  // Validate Origin header if present
  if (origin) {
    const normalizedOrigin = normalizeUrl(origin);
    const isAllowedOrigin = allowedOrigins.some(allowed => {
      // Exact match (normalized)
      return normalizedOrigin === allowed;
    });

    if (!isAllowedOrigin) {
      logger.logSecurity('csrf_invalid_origin', {
        origin,
        normalizedOrigin,
        allowedOrigins,
        method: req.method,
        path: req.path,
        ip: req.ip,
        userId: req.user?.id,
        nodeEnv: process.env.NODE_ENV
      });

      return res.status(403).json({
        success: false,
        error: 'Invalid origin',
        errorType: 'csrf_protection',
        debug: process.env.NODE_ENV !== 'production' ? {
          receivedOrigin: origin,
          normalizedOrigin,
          allowedOrigins,
          nodeEnv: process.env.NODE_ENV
        } : undefined
      });
    }
  }

  // Validate Referer header if Origin is not present
  if (!origin && referer) {
    const normalizedReferer = normalizeUrl(referer);
    const isAllowedReferer = allowedOrigins.some(allowed => {
      // Check if referer starts with allowed origin
      return normalizedReferer === allowed || normalizedReferer.startsWith(allowed + '/');
    });

    if (!isAllowedReferer) {
      logger.logSecurity('csrf_invalid_referer', {
        referer,
        normalizedReferer,
        allowedOrigins,
        method: req.method,
        path: req.path,
        ip: req.ip,
        userId: req.user?.id,
        nodeEnv: process.env.NODE_ENV
      });

      return res.status(403).json({
        success: false,
        error: 'Invalid referer',
        errorType: 'csrf_protection',
        debug: process.env.NODE_ENV !== 'production' ? {
          receivedReferer: referer,
          normalizedReferer,
          allowedOrigins,
          nodeEnv: process.env.NODE_ENV
        } : undefined
      });
    }
  }

  // Origin/Referer validation passed
  next();
};

module.exports = {
  csrfProtection
};
