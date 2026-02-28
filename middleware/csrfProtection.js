// middleware/csrfProtection.js
// CSRF protection for JWT-based API
const logger = require('../utils/logger');

// Helper to normalize origin/referer URL (remove trailing slash)
const normalizeUrl = (url) => {
  if (!url) return null;
  return url.replace(/\/$/, '');
};

// Build allowed origins list (same logic as CORS in server.js)
const getAllowedOrigins = () => {
  if (process.env.NODE_ENV === 'production') {
    const origins = [];

    // Add FRONTEND_URL if set (normalized)
    if (process.env.FRONTEND_URL && process.env.FRONTEND_URL.trim()) {
      origins.push(normalizeUrl(process.env.FRONTEND_URL.trim()));
    }

    // Always add discover.legal domains for backward compatibility
    // IMPORTANT: Must match CORS config in server.js
    origins.push(
      'https://app.discover.legal',
      'https://discover.legal',
      'https://www.discover.legal'
    );

    // Remove duplicates
    return [...new Set(origins)];
  } else {
    // IMPORTANT: Must match CORS config in server.js
    return [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://127.0.0.1:3000',
      'http://ca.localhost:3000',
      'http://canada.localhost:3000'
    ];
  }
};

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
const WEBHOOK_PATHS = new Set([
  '/api/payment/webhook',
  '/api/auth0-webhooks/user-update',
  '/api/auth0-webhooks/email-update'
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
