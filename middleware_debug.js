// middleware/rateLimiting.js - FIXED VERSION
const rateLimit = require('express-rate-limit');
const logger = require('../utils/logger'); // ✅ FIXED: Correct path

/**
 * Custom handler for rate limit exceeded
 */
const rateLimitHandler = (req, res) => {
  const userId = req.user?.id || 'anonymous';
  
  // ✅ FIXED: Use safe logger methods
  if (logger.logSecurity) {
    logger.logSecurity('rate_limit_exceeded', {
      userId,
      ip: req.ip,
      path: req.path,
      method: req.method,
      userAgent: req.get('user-agent')
    });
  } else {
    logger.warn('Rate limit exceeded', {
      userId,
      ip: req.ip,
      path: req.path,
      method: req.method
    });
  }

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
 */
const standardLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler
});

/**
 * Strict rate limiter for sensitive endpoints - 20 requests per 15 minutes
 */
const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler
});

/**
 * Chat-specific rate limiter - 50 messages per 15 minutes
 */
const chatLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    const userId = req.user?.id || 'anonymous';
    
    if (logger.logSecurity) {
      logger.logSecurity('chat_rate_limit_exceeded', {
        userId,
        ip: req.ip,
        messageLength: req.body?.message?.length || 0
      });
    } else {
      logger.warn('Chat rate limit exceeded', {
        userId,
        ip: req.ip
      });
    }

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
    if (logger.logSecurity) {
      logger.logSecurity('auth_rate_limit_exceeded', {
        ip: req.ip,
        path: req.path,
        userAgent: req.get('user-agent')
      });
    } else {
      logger.warn('Auth rate limit exceeded', {
        ip: req.ip,
        path: req.path
      });
    }

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
 */
const paymentLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    const userId = req.user?.id || 'anonymous';
    
    if (logger.logSecurity) {
      logger.logSecurity('payment_rate_limit_exceeded', {
        userId,
        ip: req.ip
      });
    } else {
      logger.warn('Payment rate limit exceeded', {
        userId,
        ip: req.ip
      });
    }

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
 */
const pdfLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    const userId = req.user?.id || 'anonymous';
    
    if (logger.logSecurity) {
      logger.logSecurity('pdf_rate_limit_exceeded', {
        userId,
        ip: req.ip
      });
    } else {
      logger.warn('PDF rate limit exceeded', {
        userId,
        ip: req.ip
      });
    }

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
 */
const dynamicLimiter = (req, res, next) => {
  const user = req.user;
  
  // Premium users get higher limits
  if (user?.subscription_type === 'premium') {
    const premiumLimiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 200, // Double the standard limit
      standardHeaders: true,
      legacyHeaders: false,
      handler: rateLimitHandler
    });
    
    return premiumLimiter(req, res, next);
  }
  
  // Standard users
  return standardLimiter(req, res, next);
};

/**
 * Burst protection - prevents rapid successive requests
 */
const burstLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10, // Max 10 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    if (logger.logSecurity) {
      logger.logSecurity('burst_limit_exceeded', {
        userId: req.user?.id || 'anonymous',
        ip: req.ip,
        path: req.path
      });
    } else {
      logger.warn('Burst limit exceeded', {
        userId: req.user?.id || 'anonymous',
        ip: req.ip,
        path: req.path
      });
    }

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