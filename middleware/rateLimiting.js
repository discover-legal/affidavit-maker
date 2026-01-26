// middleware/rateLimiting.js - Simple, Working Rate Limiting
const rateLimit = require('express-rate-limit');
const logger = require('../utils/logger');

/**
 * Custom handler for rate limit exceeded
 */
const rateLimitHandler = (req, res) => {
  const userId = req.user?.id || 'anonymous';
  
  logger.logSecurity('rate_limit_exceeded', {
    userId,
    ip: req.ip,
    path: req.path,
    method: req.method,
    userAgent: req.get('user-agent')
  });

  res.status(429).json({
    success: false,
    error: 'Too many requests. Please try again later.',
    errorType: 'rate_limit_error',
    retryAfter: 60,
    timestamp: new Date().toISOString()
  });
};

/**
 * Standard rate limiter - 100 requests per 15 minutes
 * SECURITY FIX: Uses user ID if authenticated, otherwise IP
 * This prevents bypassing rate limits via IP rotation
 */
const standardLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use user ID if authenticated (prevents IP rotation bypass)
    if (req.user?.id) {
      return `user:${req.user.id}`;
    }
    // Fall back to IP for unauthenticated requests
    return `ip:${req.ip}`;
  },
  handler: rateLimitHandler
});

/**
 * Strict rate limiter for sensitive endpoints - 20 requests per 15 minutes
 * SECURITY FIX: Uses user ID if authenticated
 */
const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    if (req.user?.id) {
      return `user:${req.user.id}`;
    }
    return `ip:${req.ip}`;
  },
  handler: rateLimitHandler
});

/**
 * Chat-specific rate limiter - 50 messages per 15 minutes
 * SECURITY FIX: Uses user ID to prevent abuse via IP rotation
 */
const chatLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    if (req.user?.id) {
      return `user:${req.user.id}`;
    }
    return `ip:${req.ip}`;
  },
  handler: (req, res) => {
    const userId = req.user?.id || 'anonymous';

    logger.logSecurity('chat_rate_limit_exceeded', {
      userId,
      ip: req.ip,
      messageLength: req.body?.message?.length || 0
    });

    res.status(429).json({
      success: false,
      error: 'Too many chat messages. Please wait before sending more messages.',
      errorType: 'rate_limit_error',
      retryAfter: 60,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Authentication rate limiter - 10 attempts per 15 minutes
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip, // Only IP-based for auth
  handler: (req, res) => {
    logger.logSecurity('auth_rate_limit_exceeded', {
      ip: req.ip,
      path: req.path,
      userAgent: req.get('user-agent')
    });

    res.status(429).json({
      success: false,
      error: 'Too many authentication attempts. Please try again later.',
      errorType: 'rate_limit_error',
      retryAfter: 900, // 15 minutes
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Payment rate limiter - 5 payment attempts per hour
 * SECURITY FIX: Uses user ID to prevent abuse
 */
const paymentLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    if (req.user?.id) {
      return `user:${req.user.id}`;
    }
    return `ip:${req.ip}`;
  },
  handler: (req, res) => {
    const userId = req.user?.id || 'anonymous';

    logger.logSecurity('payment_rate_limit_exceeded', {
      userId,
      ip: req.ip
    });

    res.status(429).json({
      success: false,
      error: 'Too many payment attempts. Please contact support if you need assistance.',
      errorType: 'rate_limit_error',
      retryAfter: 3600, // 1 hour
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * PDF generation rate limiter - 10 PDFs per hour
 * SECURITY FIX: Uses user ID to prevent abuse
 */
const pdfLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    if (req.user?.id) {
      return `user:${req.user.id}`;
    }
    return `ip:${req.ip}`;
  },
  handler: (req, res) => {
    const userId = req.user?.id || 'anonymous';

    logger.logSecurity('pdf_rate_limit_exceeded', {
      userId,
      ip: req.ip
    });

    res.status(429).json({
      success: false,
      error: 'PDF generation limit reached. Please wait before generating more documents.',
      errorType: 'rate_limit_error',
      retryAfter: 3600, // 1 hour
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Dynamic rate limiter based on user type
 * SECURITY FIX: Uses user ID for all tiers
 */
const dynamicLimiter = (req, res, next) => {
  const user = req.user;

  // Premium users get higher limits
  if (user?.subscription_type === 'premium' || user?.subscription_tier === 'premium') {
    const premiumLimiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 200, // Double the standard limit
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: (req) => {
        if (req.user?.id) {
          return `user:${req.user.id}`;
        }
        return `ip:${req.ip}`;
      },
      handler: rateLimitHandler
    });

    return premiumLimiter(req, res, next);
  }

  // Standard users
  return standardLimiter(req, res, next);
};

/**
 * Burst protection - prevents rapid successive requests
 * SECURITY FIX: Uses user ID to prevent abuse
 */
const burstLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10, // Max 10 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    if (req.user?.id) {
      return `user:${req.user.id}`;
    }
    return `ip:${req.ip}`;
  },
  handler: (req, res) => {
    logger.logSecurity('burst_limit_exceeded', {
      userId: req.user?.id || 'anonymous',
      ip: req.ip,
      path: req.path
    });

    res.status(429).json({
      success: false,
      error: 'Too many requests in short succession. Please slow down.',
      errorType: 'rate_limit_error',
      retryAfter: 60,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = {
  standardLimiter,
  strictLimiter,
  chatLimiter,
  authLimiter,
  paymentLimiter,
  pdfLimiter,
  dynamicLimiter,
  burstLimiter
};