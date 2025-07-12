// middleware/securityMiddleware.js
const helmet = require('helmet');
const { body, validationResult } = require('express-validator');
const crypto = require('crypto');
const logger = require('../services/logger');

// CSRF Protection
const csrfTokens = new Map();

const generateCSRFToken = () => {
  const token = crypto.randomBytes(32).toString('hex');
  const expiry = Date.now() + (60 * 60 * 1000); // 1 hour
  csrfTokens.set(token, expiry);
  return token;
};

const validateCSRFToken = (req, res, next) => {
  // Skip CSRF for API endpoints that use JWT
  if (req.path.startsWith('/api/') && req.headers.authorization) {
    return next();
  }

  const token = req.headers['x-csrf-token'] || req.body._csrf;
  
  if (!token || !csrfTokens.has(token)) {
    return res.status(403).json({
      success: false,
      error: 'Invalid or missing CSRF token'
    });
  }

  const expiry = csrfTokens.get(token);
  if (Date.now() > expiry) {
    csrfTokens.delete(token);
    return res.status(403).json({
      success: false,
      error: 'CSRF token expired'
    });
  }

  // Token is valid, continue
  next();
};

// Clean expired tokens periodically
setInterval(() => {
  const now = Date.now();
  for (const [token, expiry] of csrfTokens) {
    if (now > expiry) {
      csrfTokens.delete(token);
    }
  }
}, 60 * 60 * 1000); // Every hour

// Input validation rules
const validationRules = {
  // Chat endpoint validation
  chat: [
    body('message')
      .trim()
      .isLength({ min: 1, max: 5000 })
      .withMessage('Message must be between 1 and 5000 characters')
      .escape(),
    body('conversationHistory')
      .isArray()
      .withMessage('Conversation history must be an array'),
    body('currentData.affiantName')
      .optional()
      .trim()
      .isLength({ max: 255 })
      .matches(/^[a-zA-Z\s\-'.]+$/)
      .withMessage('Invalid name format'),
    body('currentData.state')
      .optional()
      .isIn(['TX', 'UT', 'AZ', ''])
      .withMessage('Invalid state'),
    body('currentData.facts')
      .optional()
      .isArray()
      .withMessage('Facts must be an array'),
    body('currentData.facts.*')
      .optional()
      .trim()
      .isLength({ max: 2000 })
      .escape()
  ],

  // Preview validation
  preview: [
    body('affidavitData.affiantName')
      .trim()
      .notEmpty()
      .isLength({ max: 255 })
      .matches(/^[a-zA-Z\s\-'.]+$/)
      .withMessage('Invalid name format'),
    body('affidavitData.state')
      .isIn(['TX', 'UT', 'AZ'])
      .withMessage('Invalid state'),
    body('affidavitData.county')
      .optional()
      .trim()
      .isLength({ max: 100 })
      .matches(/^[a-zA-Z\s]+$/)
      .withMessage('Invalid county format'),
    body('affidavitData.caseNumber')
      .optional()
      .trim()
      .matches(/^[a-zA-Z0-9\-\/]+$/)
      .withMessage('Invalid case number format')
  ],

  // Payment validation
  payment: [
    body('documentType')
      .isIn(['single_affidavit', 'family_law_package', 'all_state_access'])
      .withMessage('Invalid document type'),
    body('documentId')
      .optional()
      .isInt()
      .withMessage('Invalid document ID')
  ]
};

// Validation middleware
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.warn('Validation failed', {
      endpoint: req.path,
      errors: errors.array(),
      ip: req.ip
    });
    
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array().map(err => ({
        field: err.param,
        message: err.msg
      }))
    });
  }
  next();
};

// SQL Injection prevention for raw queries
const sanitizeSQL = (input) => {
  if (typeof input !== 'string') return input;
  
  // Remove or escape potentially dangerous characters
  return input
    .replace(/'/g, "''")
    .replace(/;/g, '')
    .replace(/--/g, '')
    .replace(/\/\*/g, '')
    .replace(/\*\//g, '')
    .replace(/xp_/gi, '')
    .replace(/exec/gi, '');
};

// XSS Prevention for output
const sanitizeOutput = (data) => {
  if (typeof data === 'string') {
    return data
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }
  
  if (typeof data === 'object' && data !== null) {
    const sanitized = {};
    for (const [key, value] of Object.entries(data)) {
      sanitized[key] = sanitizeOutput(value);
    }
    return sanitized;
  }
  
  return data;
};

// Configure Helmet with custom options
const helmetConfig = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdn.jsdelivr.net", "https://*.auth0.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://*.auth0.com", "https://api.stripe.com", "wss://localhost:*"],
      frameSrc: ["https://js.stripe.com", "https://*.auth0.com"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
});

// Rate limiting for specific endpoints
const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: 'Too many authentication attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

const apiRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute
  message: 'Too many API requests, please slow down.',
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  generateCSRFToken,
  validateCSRFToken,
  validationRules,
  validate,
  sanitizeSQL,
  sanitizeOutput,
  helmetConfig,
  authRateLimit,
  apiRateLimit
};