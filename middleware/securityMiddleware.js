// middleware/securityMiddleware.js - Enhanced security middleware
const helmet = require('helmet');
const { body, validationResult } = require('express-validator');
const crypto = require('crypto');
const logger = require('../services/logger');
const rateLimit = require('express-rate-limit');

// CSRF Protection with Redis support (falls back to in-memory)
class CSRFTokenManager {
  constructor() {
    this.tokens = new Map();
    this.tokenTTL = 60 * 60 * 1000; // 1 hour
    
    // Cleanup expired tokens every 5 minutes
    setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }
  
  generate() {
    const token = crypto.randomBytes(32).toString('hex');
    const expiry = Date.now() + this.tokenTTL;
    this.tokens.set(token, expiry);
    return token;
  }
  
  validate(token) {
    if (!token || !this.tokens.has(token)) {
      return false;
    }
    
    const expiry = this.tokens.get(token);
    if (Date.now() > expiry) {
      this.tokens.delete(token);
      return false;
    }
    
    // Token is valid, delete it (one-time use)
    this.tokens.delete(token);
    return true;
  }
  
  cleanup() {
    const now = Date.now();
    for (const [token, expiry] of this.tokens) {
      if (now > expiry) {
        this.tokens.delete(token);
      }
    }
  }
}

const csrfManager = new CSRFTokenManager();

const generateCSRFToken = () => csrfManager.generate();

const validateCSRFToken = (req, res, next) => {
  // Skip CSRF for API endpoints that use JWT
  if (req.path.startsWith('/api/') && req.headers.authorization) {
    return next();
  }
  
  // Skip for webhooks
  if (req.path.includes('/webhook')) {
    return next();
  }
  
  const token = req.headers['x-csrf-token'] || req.body._csrf;
  
  if (!csrfManager.validate(token)) {
    logger.warn('Invalid CSRF token', {
      path: req.path,
      method: req.method,
      ip: req.ip,
      requestId: req.id
    });
    
    return res.status(403).json({
      success: false,
      error: 'Invalid or missing CSRF token',
      requestId: req.id
    });
  }
  
  next();
};

// Input validation rules
const validationRules = {
  // Chat endpoint validation
  chat: [
    body('message')
      .trim()
      .isLength({ min: 1, max: 5000 })
      .withMessage('Message must be between 1 and 5000 characters'),
    body('conversationHistory')
      .isArray()
      .withMessage('Conversation history must be an array'),
    body('conversationHistory')
      .custom((value) => value.length <= 50)
      .withMessage('Conversation history too long'),
    body('currentData.affiantName')
      .optional({ checkFalsy: true })
      .trim()
      .isLength({ max: 255 })
      .matches(/^[\p{L}\p{M}\p{N}\s\-'.#]+$/u)
      .withMessage('Invalid name format'),
    body('currentData.state')
      .optional()
      .isIn(['TX', 'UT', 'AZ', '', 'Texas', 'Utah', 'Arizona'])
      .withMessage('Invalid state'),
    body('currentData.facts')
      .optional()
      .isArray({ max: 100 })
      .withMessage('Too many facts'),
    body('currentData.facts.*')
      .optional()
      .trim()
      .isLength({ max: 2000 })
  ],

  // Preview validation
  preview: [
    body('affidavitData.affiantName')
      .optional({ checkFalsy: true })
      .trim()
      .isLength({ max: 255 })
      .matches(/^[\p{L}\p{M}\p{N}\s\-'.#]+$/u)
      .withMessage('Invalid name format'),
    body('affidavitData.state')
      .optional()
      .isIn(['TX', 'UT', 'AZ', 'Texas', 'Utah', 'Arizona'])
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

  // Save draft validation
  saveDraft: [
    body('documentId')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Invalid document ID'),
    body('affidavitData')
      .isObject()
      .withMessage('Affidavit data must be an object'),
    body('affidavitData.state')
      .optional()
      .isIn(['TX', 'UT', 'AZ', '', 'Texas', 'Utah', 'Arizona'])
      .withMessage('Invalid state')
  ],

  // Generate document validation
  generateDocument: [
    body('affidavitData')
      .isObject()
      .withMessage('Affidavit data must be an object'),
    body('affidavitData.state')
      .isIn(['TX', 'UT', 'AZ', 'Texas', 'Utah', 'Arizona'])
      .withMessage('Valid state is required'),
    body('affidavitData.affiantName')
      .trim()
      .notEmpty()
      .isLength({ min: 2, max: 255 })
      .withMessage('Valid affiant name is required'),
    body('strategy')
      .optional()
      .isIn(['simple', 'detailed', 'persuasive', 'legal', 'template_only'])
      .withMessage('Invalid generation strategy'),
    body('format')
      .optional()
      .isIn(['pdf', 'html', 'text', 'json'])
      .withMessage('Invalid format')
  ],

  // Payment validation
  payment: [
    body('documentType')
      .isIn(['single_affidavit', 'family_law_package', 'all_state_access'])
      .withMessage('Invalid document type'),
    body('documentId')
      .optional()
      .custom((value) => value === 'new' || /^\d+$/.test(value))
      .withMessage('Invalid document ID')
  ],

  // Rename document validation
  renameDocument: [
    body('newName')
      .trim()
      .notEmpty({ ignore_whitespace: true })
      .withMessage('Name cannot be empty.')
      .isLength({ min: 2, max: 255 })
      .withMessage('Name must be between 2 and 255 characters.')
      .matches(/^[\p{L}\p{M}\p{N}\s\-'.#]+$/u)
      .withMessage('Invalid name format. Only letters, numbers, and common punctuation (including #) are allowed.')
  ]
};

// Validation middleware
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.warn('Validation failed', {
      endpoint: req.path,
      errors: errors.array(),
      ip: req.ip,
      requestId: req.id
    });
    
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array().map(err => ({
        field: err.path,
        message: err.msg
      })),
      requestId: req.id
    });
  }
  next();
};

// SQL Injection prevention for raw queries
const sanitizeSQL = (input) => {
  if (typeof input !== 'string') return input;
  
  return input
    .replace(/'/g, "''")
    .replace(/;/g, '')
    .replace(/--/g, '')
    .replace(/\/\*/g, '')
    .replace(/\*\//g, '')
    .replace(/xp_/gi, '')
    .replace(/exec/gi, '')
    .replace(/union/gi, '')
    .replace(/select/gi, '')
    .replace(/insert/gi, '')
    .replace(/update/gi, '')
    .replace(/delete/gi, '')
    .replace(/drop/gi, '');
};

// XSS Prevention for output
const sanitizeOutput = (data) => {
  if (typeof data === 'string') {
    return data
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;')
      .replace(/\\/g, '&#x5C;')
      .replace(/`/g, '&#x60;');
  }
  
  if (Array.isArray(data)) {
    return data.map(sanitizeOutput);
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
  },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
});

// Rate limiting configurations
const createRateLimiter = (options) => {
  return rateLimit({
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      logger.warn('Rate limit exceeded', {
        ip: req.ip,
        path: req.path,
        requestId: req.id
      });
      
      res.status(429).json({
        success: false,
        error: options.message || 'Too many requests, please try again later.',
        retryAfter: Math.round(options.windowMs / 1000),
        requestId: req.id
      });
    },
    ...options
  });
};

const authRateLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: 'Too many authentication attempts, please try again later.',
  skipSuccessfulRequests: true
});

const apiRateLimit = createRateLimiter({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute
  message: 'Too many API requests, please slow down.'
});

const strictRateLimit = createRateLimiter({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10, // 10 requests per minute
  message: 'Too many requests to this endpoint, please wait.'
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
  apiRateLimit,
  strictRateLimit
};
