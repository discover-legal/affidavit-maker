// middleware/csrfProtection.js
// CSRF protection for JWT-based API
const logger = require('../utils/logger');

/**
 * CSRF Protection Middleware
 *
 * For JWT-based APIs, traditional CSRF tokens are less critical because:
 * - Custom headers (Authorization) cannot be set by cross-site requests
 * - Same-origin policy prevents token theft
 *
 * However, we still validate Origin/Referer headers for defense in depth.
 */
const csrfProtection = (req, res, next) => {
  // Skip CSRF check for:
  // - GET/HEAD/OPTIONS requests (safe methods)
  // - Webhook endpoints (have their own signature verification)
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  const isWebhook = req.path.includes('/webhook') || req.path.includes('/webhooks');

  if (safeMethods.includes(req.method) || isWebhook) {
    return next();
  }

  // Get allowed origins from CORS config
  const allowedOrigins = process.env.NODE_ENV === 'production'
    ? [
        process.env.FRONTEND_URL || 'https://discover.legal',
        'https://discover.legal',
        'https://www.discover.legal'
      ]
    : [
        'http://localhost:3000',
        'http://localhost:3001',
        'http://127.0.0.1:3000'
      ];

  // Check Origin header (modern browsers)
  const origin = req.headers.origin;
  const referer = req.headers.referer;

  // At least one of Origin or Referer must be present
  if (!origin && !referer) {
    logger.logSecurity('csrf_missing_origin_referer', {
      method: req.method,
      path: req.path,
      ip: req.ip,
      userAgent: req.get('user-agent')
    });

    return res.status(403).json({
      success: false,
      error: 'Missing origin or referer header',
      errorType: 'csrf_protection'
    });
  }

  // Validate Origin header if present
  if (origin) {
    const isAllowedOrigin = allowedOrigins.some(allowed => {
      // Exact match or subdomain match
      return origin === allowed || origin.endsWith('.' + allowed);
    });

    if (!isAllowedOrigin) {
      logger.logSecurity('csrf_invalid_origin', {
        origin,
        method: req.method,
        path: req.path,
        ip: req.ip,
        userId: req.user?.id
      });

      return res.status(403).json({
        success: false,
        error: 'Invalid origin',
        errorType: 'csrf_protection'
      });
    }
  }

  // Validate Referer header if Origin is not present
  if (!origin && referer) {
    const isAllowedReferer = allowedOrigins.some(allowed => {
      return referer.startsWith(allowed);
    });

    if (!isAllowedReferer) {
      logger.logSecurity('csrf_invalid_referer', {
        referer,
        method: req.method,
        path: req.path,
        ip: req.ip,
        userId: req.user?.id
      });

      return res.status(403).json({
        success: false,
        error: 'Invalid referer',
        errorType: 'csrf_protection'
      });
    }
  }

  // Origin/Referer validation passed
  next();
};

module.exports = {
  csrfProtection
};
