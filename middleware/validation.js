// middleware/validation.js - CONSOLIDATED Validation Middleware
// Drop-in replacement combining security + business validation
const { body, param, query, validationResult } = require('express-validator');
const helmet = require('helmet');
const logger = require('../utils/logger');

/**
 * Comprehensive validation limits and constants
 */
const LIMITS = {
  // Message and content limits
  MESSAGE_MAX_WORDS: 5000,
  MESSAGE_MAX_CHARS: 25000, // ~5k words, more generous than securityMiddleware
  CONVERSATION_MAX_MESSAGES: 50,
  CONVERSATION_MAX_SIZE: 2 * 1024 * 1024, // 2MB
  
  // Document limits  
  DOCUMENT_MAX_SIZE: 25 * 1024 * 1024, // 25MB
  TITLE_MAX_LENGTH: 500,
  
  // Personal information limits
  NAME_MAX_LENGTH: 255,
  COUNTY_MAX_LENGTH: 100,
  
  // Facts and content limits
  FACTS_MAX_COUNT: 50,
  FACT_MAX_WORDS: 500,
  FACT_CONTENT_MAX_CHARS: 2000,
  
  // Payment limits
  PAYMENT_MIN_CENTS: 999, // $9.99
  PAYMENT_MAX_CENTS: 99999, // $999.99
  
  // Pagination limits
  PAGE_MAX: 1000,
  LIMIT_MAX: 100
};

/**
 * Security configuration - Helmet setup with CSP
 */
const helmetConfig = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdn.jsdelivr.net", "https://*.auth0.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "https://r2cdn.perplexity.ai"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://*.auth0.com", "https://api.stripe.com", "https://api.openai.com", "https://affidavit-maker.onrender.com", "https://discover.legal", "https://www.discover.legal", "wss://localhost:*"],
      frameSrc: ["https://js.stripe.com", "https://*.auth0.com"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
    },
  },
  crossOriginEmbedderPolicy: false,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
});

/**
 * Utility functions for validation and sanitization
 */

// Count words in text
const countWords = (text) => {
  if (!text || typeof text !== 'string') return 0;
  return text.trim().split(/\s+/).filter(word => word.length > 0).length;
};

// Basic text sanitization (remove HTML, trim)
const sanitizeText = (text) => {
  if (!text) return text;
  return text
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
    .replace(/<[^>]*>/g, '') // Remove other HTML tags
    .trim();
};

// NOTE: SQL injection prevention is NOT needed here because all database queries
// use parameterized queries ($1, $2, etc.) which inherently prevent SQL injection.
// String replacement functions like sanitizeSQL are anti-patterns that:
// 1. Provide false security
// 2. Can break legitimate user content (e.g., "I select the following terms...")
// 3. Can be easily bypassed
// The previously existing sanitizeSQL and sanitizeOutput functions have been removed
// as they were unused and provided no actual security benefit.

/**
 * Custom validators
 */

// Word count validator
const wordCountValidator = (maxWords, fieldName = 'field') => {
  return (value) => {
    if (!value) return true; // Allow empty values, let required() handle it
    const wordCount = countWords(value);
    if (wordCount > maxWords) {
      throw new Error(`${fieldName} exceeds maximum of ${maxWords} words (currently ${wordCount} words)`);
    }
    return true;
  };
};

// JSON size validator
const jsonSizeValidator = (maxBytes) => {
  return (value) => {
    if (!value) return true;
    const size = JSON.stringify(value).length;
    if (size > maxBytes) {
      throw new Error(`Data size exceeds maximum of ${Math.round(maxBytes / 1024 / 1024)}MB`);
    }
    return true;
  };
};

// Enhanced validation result checker with security logging
const checkValidationResult = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    // Security logging for failed validation
    logger.logSecurity('validation_failed', {
      requestId: req.id,
      userId: req.user?.id,
      path: req.path,
      method: req.method,
      ip: req.ip,
      errors: errors.array().map(err => ({
        field: err.path,
        message: err.msg,
        value: typeof err.value === 'string' ? err.value.substring(0, 100) : '[non-string]'
      }))
    });
    
    // Send user-friendly error response
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array().map(err => ({
        field: err.path,
        message: err.msg
      })),
      requestId: req.id,
      timestamp: new Date().toISOString()
    });
  }
  next();
};

/**
 * CONSOLIDATED VALIDATION FUNCTIONS
 */

/**
 * Chat message validation - combines both approaches
 */
const validateChatMessage = [
  body('message')
    .trim()
    .notEmpty()
    .withMessage('Message is required')
    .isLength({ min: 1, max: LIMITS.MESSAGE_MAX_CHARS })
    .withMessage(`Message must be between 1 and ${LIMITS.MESSAGE_MAX_CHARS} characters`)
    .custom(wordCountValidator(LIMITS.MESSAGE_MAX_WORDS, 'Message'))
    .customSanitizer(sanitizeText),
  
  body('conversationHistory')
    .optional()
    .isArray()
    .withMessage('Conversation history must be an array')
    .custom((value) => {
      if (!Array.isArray(value)) return true;
      if (value.length > LIMITS.CONVERSATION_MAX_MESSAGES) {
        throw new Error(`Too many conversation messages (maximum ${LIMITS.CONVERSATION_MAX_MESSAGES})`);
      }
      return true;
    })
    .custom(jsonSizeValidator(LIMITS.CONVERSATION_MAX_SIZE))
    .customSanitizer((history) => {
      if (!Array.isArray(history)) return history;
      return history.slice(-20); // Keep only last 20 messages
    }),
  
  body('affidavitData')
    .optional()
    .isObject()
    .withMessage('Affidavit data must be an object')
    .custom(jsonSizeValidator(1024 * 1024)), // 1MB limit for affidavit data

  // Matter type code for new civil/family law matter orchestrators
  body('affidavitData.matterTypeCode')
    .optional()
    .trim()
    .matches(/^[a-z_]+$/)
    .withMessage('matterTypeCode must be lowercase letters and underscores'),

  // Legacy support for currentData from securityMiddleware
  body('currentData.affiantName')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: LIMITS.NAME_MAX_LENGTH })
    .matches(/^[\p{L}\p{M}\p{N}\s\-'.#]+$/u)
    .withMessage('Invalid name format')
    .customSanitizer(sanitizeText),
    
  body('currentData.state')
    .optional()
    .isIn(['TX', 'UT', 'AZ', 'CA', 'FL', 'IL', 'NY', '', 'Texas', 'Utah', 'Arizona', 'California', 'Florida', 'Illinois', 'New York'])
    .withMessage('Invalid state'),
    
  body('currentData.facts')
    .optional()
    .isArray({ max: LIMITS.FACTS_MAX_COUNT })
    .withMessage(`Too many facts (maximum ${LIMITS.FACTS_MAX_COUNT})`)
    .custom((facts) => {
      if (!Array.isArray(facts)) return true;
      
      for (let i = 0; i < facts.length; i++) {
        const fact = facts[i];
        if (typeof fact === 'string') {
          if (fact.length > LIMITS.FACT_CONTENT_MAX_CHARS) {
            throw new Error(`Fact ${i + 1} exceeds maximum length`);
          }
        }
      }
      return true;
    }),
  
  checkValidationResult
];

/**
 * Document save validation
 */
const validateDocumentSave = [
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Title is required')
    .isLength({ max: LIMITS.TITLE_MAX_LENGTH })
    .withMessage(`Title exceeds maximum length of ${LIMITS.TITLE_MAX_LENGTH} characters`)
    .customSanitizer(sanitizeText),
  
  body('content')
    .notEmpty()
    .withMessage('Content is required')
    .custom(jsonSizeValidator(LIMITS.DOCUMENT_MAX_SIZE)),
  
  body('status')
    .optional()
    .isIn(['draft', 'completed', 'archived'])
    .withMessage('Invalid status'),
    
  body('documentId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Invalid document ID'),
  
  body('affidavitData')
    .optional()
    .isObject()
    .withMessage('Affidavit data must be an object'),
  
  checkValidationResult
];

/**
 * Comprehensive affidavit data validation
 */
const validateAffidavitData = [
  body('affiantName')
    .trim()
    .notEmpty()
    .withMessage('Affiant name is required')
    .isLength({ min: 2, max: LIMITS.NAME_MAX_LENGTH })
    .withMessage(`Affiant name must be between 2 and ${LIMITS.NAME_MAX_LENGTH} characters`)
    .matches(/^[\p{L}\p{M}\p{N}\s\-'.#]+$/u) // Allow # for case numbers in names
    .withMessage('Invalid name format. Only letters, numbers, spaces, hyphens, apostrophes, periods, and # allowed')
    .customSanitizer(sanitizeText),
  
  body('state')
    .trim()
    .notEmpty()
    .withMessage('State is required')
    .isIn(['TX', 'UT', 'AZ', 'CA', 'FL', 'IL', 'NY', 'Texas', 'Utah', 'Arizona', 'California', 'Florida', 'Illinois', 'New York'])
    .withMessage('Invalid state. Supported states: TX, UT, AZ, CA, FL, IL, NY'),
  
  body('county')
    .optional()
    .trim()
    .isLength({ max: LIMITS.COUNTY_MAX_LENGTH })
    .withMessage(`County name exceeds maximum length of ${LIMITS.COUNTY_MAX_LENGTH} characters`)
    .matches(/^[a-zA-Z\s\-'.]+$/)
    .withMessage('County name contains invalid characters')
    .customSanitizer(sanitizeText),
  
  body('facts')
    .optional()
    .isArray()
    .withMessage('Facts must be an array')
    .custom((facts) => {
      if (!Array.isArray(facts)) return true;
      
      if (facts.length > LIMITS.FACTS_MAX_COUNT) {
        throw new Error(`Too many facts (maximum ${LIMITS.FACTS_MAX_COUNT})`);
      }
      
      for (let i = 0; i < facts.length; i++) {
        const fact = facts[i];
        if (typeof fact === 'string') {
          if (countWords(fact) > LIMITS.FACT_MAX_WORDS) {
            throw new Error(`Fact ${i + 1} exceeds maximum of ${LIMITS.FACT_MAX_WORDS} words`);
          }
        } else if (fact && typeof fact === 'object' && fact.content) {
          if (countWords(fact.content) > LIMITS.FACT_MAX_WORDS) {
            throw new Error(`Fact ${i + 1} exceeds maximum of ${LIMITS.FACT_MAX_WORDS} words`);
          }
        }
      }
      return true;
    }),
  
  body('caseNumber')
    .optional()
    .trim()
    .matches(/^[a-zA-Z0-9\-/]+$/)
    .withMessage('Invalid case number format'),

  body('documentType')
    .optional()
    .trim()
    .matches(/^[a-z0-9_\-\/]+$/)
    .isLength({ max: 80 })
    .withMessage('Invalid document type'),
  
  checkValidationResult
];

/**
 * Preview validation (from securityMiddleware)
 */
const validatePreview = [
  body('affidavitData')
    .isObject()
    .withMessage('Affidavit data must be an object'),
    
  body('affidavitData.affiantName')
    .optional({ checkFalsy: true })        // ✅ FIXED
    .trim()
    .isLength({ max: LIMITS.NAME_MAX_LENGTH })
    .matches(/^[\p{L}\p{M}\p{N}\s\-'.#]*$/u) // ✅ * allows empty
    .withMessage('Invalid name format')
    .customSanitizer(sanitizeText),
    
  body('affidavitData.state')
    .optional({ checkFalsy: true })        // ✅ FIXED
    .isIn(['TX', 'UT', 'AZ', 'CA', 'FL', 'IL', 'NY', 'Texas', 'Utah', 'Arizona', 'California', 'Florida', 'Illinois', 'New York'])
    .withMessage('Invalid state'),
    
  body('affidavitData.county')
    .optional({ checkFalsy: true })        // ✅ KEY FIX
    .trim()
    .isLength({ max: LIMITS.COUNTY_MAX_LENGTH })
    .matches(/^[a-zA-Z\s\-'.]*$/)          // ✅ * allows empty
    .withMessage('County name contains invalid characters')
    .customSanitizer(sanitizeText),

  body('affidavitData.caseNumber')
    .optional({ checkFalsy: true })        // ✅ KEY FIX
    .trim()
    .matches(/^[a-zA-Z0-9\-/]*$/)         // ✅ * allows empty
    .withMessage('Invalid case number format'),
  
  checkValidationResult
];

/**
 * Document generation validation (from securityMiddleware)
 */
const validateDocumentGeneration = [
  body('affidavitData')
    .isObject()
    .withMessage('Affidavit data must be an object'),
    
  body('affidavitData.state')
    .isIn(['TX', 'UT', 'AZ', 'CA', 'FL', 'IL', 'NY', 'Texas', 'Utah', 'Arizona', 'California', 'Florida', 'Illinois', 'New York'])
    .withMessage('Valid state is required'),
    
  body('affidavitData.affiantName')
    .trim()
    .notEmpty()
    .isLength({ min: 2, max: LIMITS.NAME_MAX_LENGTH })
    .withMessage('Valid affiant name is required')
    .customSanitizer(sanitizeText),
    
  body('strategy')
    .optional()
    .isIn(['simple', 'detailed', 'persuasive', 'legal', 'template_only'])
    .withMessage('Invalid generation strategy'),
    
  body('format')
    .optional()
    .isIn(['pdf', 'html', 'text', 'json'])
    .withMessage('Invalid format'),
    
  body('documentId')
    .optional()
    .custom((value) => value === 'new' || /^\d+$/.test(value))
    .withMessage('Invalid document ID'),
  
  checkValidationResult
];

/**
 * Payment validation (from securityMiddleware)
 */
const validatePayment = [
  body('documentType')
    .isIn(['single_affidavit', 'divorce_package', 'all_state_access'])
    .withMessage('Invalid document type'),
    
  body('documentId')
    .optional()
    .custom((value) => value === 'new' || /^\d+$/.test(value))
    .withMessage('Invalid document ID'),
    
  // SECURITY: Do NOT accept amount from client - it is determined server-side
  body('amount')
    .not().exists()
    .withMessage('Amount cannot be provided by client - it is determined server-side'),
  
  checkValidationResult
];

/**
 * Document rename validation (from securityMiddleware)
 */
const validateDocumentRename = [
  body('newName')
    .trim()
    .notEmpty({ ignore_whitespace: true })
    .withMessage('Name cannot be empty')
    .isLength({ min: 2, max: LIMITS.NAME_MAX_LENGTH })
    .withMessage(`Name must be between 2 and ${LIMITS.NAME_MAX_LENGTH} characters`)
    .matches(/^[\p{L}\p{M}\p{N}\s\-'.#]+$/u)
    .withMessage('Invalid name format. Only letters, numbers, and common punctuation (including #) are allowed')
    .customSanitizer(sanitizeText),
  
  checkValidationResult
];

/**
 * ID parameter validation
 */
const validateId = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Invalid ID'),
  
  checkValidationResult
];

/**
 * Pagination validation
 */
const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1, max: LIMITS.PAGE_MAX })
    .withMessage(`Page must be between 1 and ${LIMITS.PAGE_MAX}`),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: LIMITS.LIMIT_MAX })
    .withMessage(`Limit must be between 1 and ${LIMITS.LIMIT_MAX}`),
  
  checkValidationResult
];

/**
 * File upload validation
 */
const validateFileUpload = (req, res, next) => {
  if (req.file) {
    // Check file size
    if (req.file.size > LIMITS.DOCUMENT_MAX_SIZE) {
      logger.logSecurity('file_upload_size_exceeded', {
        requestId: req.id,
        userId: req.user?.id,
        fileSize: req.file.size,
        maxSize: LIMITS.DOCUMENT_MAX_SIZE
      });
      
      return res.status(400).json({
        success: false,
        error: 'File size exceeds maximum allowed',
        details: [{
          field: 'file',
          message: `File size exceeds maximum of ${LIMITS.DOCUMENT_MAX_SIZE / 1024 / 1024}MB`
        }],
        requestId: req.id
      });
    }
    
    // Check file type
    const allowedTypes = ['application/pdf', 'application/json', 'text/plain'];
    if (!allowedTypes.includes(req.file.mimetype)) {
      logger.logSecurity('file_upload_invalid_type', {
        requestId: req.id,
        userId: req.user?.id,
        mimeType: req.file.mimetype,
        allowedTypes
      });
      
      return res.status(400).json({
        success: false,
        error: 'Invalid file type',
        details: [{
          field: 'file',
          message: 'Only PDF, JSON, and plain text files are allowed'
        }],
        requestId: req.id
      });
    }
  }
  next();
};

/**
 * Rate limit validation middleware
 */
const validateRateLimit = (req, res, next) => {
  const userId = req.user?.id;
  const ip = req.ip;
  
  // Log rate limit check for monitoring
  logger.logBusinessEvent('rate_limit_check', userId || 'anonymous', {
    endpoint: req.path,
    method: req.method,
    ip: ip,
    userAgent: req.get('user-agent'),
    requestId: req.id
  });
  
  next();
};

/**
 * Security middleware to detect suspicious activity
 *
 * NOTE: SQL keyword patterns (union, select, insert, etc.) have been REMOVED
 * because they block legitimate legal content like "I select the following terms..."
 * SQL injection is prevented by parameterized queries, not keyword filtering.
 */
const detectSuspiciousActivity = (req, res, next) => {
  const suspiciousPatterns = [
    // SECURITY (MED-02): Simplified script detection regex to avoid ReDoS
    // Previous pattern had nested quantifiers that could cause catastrophic backtracking
    /<script\b[^>]*>[\s\S]*?<\/script>/gi,
    // Command injection patterns
    /(\b(ls|cat|pwd|whoami|id|uname|ps|netstat|ifconfig|rm|mv|cp|mkdir|chmod|chown|kill|wget|curl|nc|nmap|sqlmap)\b)/gi
  ];
  
  const requestBody = JSON.stringify(req.body || {});
  const queryString = JSON.stringify(req.query || {});
  
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(requestBody) || pattern.test(queryString)) {
      logger.logSecurity('suspicious_activity_detected', {
        requestId: req.id,
        userId: req.user?.id,
        ip: req.ip,
        path: req.path,
        method: req.method,
        userAgent: req.get('user-agent'),
        pattern: pattern.source,
        bodySnippet: requestBody.substring(0, 200)
      });
      
      return res.status(400).json({
        success: false,
        error: 'Invalid input detected',
        requestId: req.id,
        timestamp: new Date().toISOString()
      });
    }
  }
  
  next();
};

/**
 * Divorce document data validation
 */
const validateDivorceData = [
  body('state')
    .trim()
    .notEmpty()
    .withMessage('State is required')
    .isIn(['TX', 'UT', 'AZ', 'CA', 'FL', 'IL', 'NY'])
    .withMessage('Invalid state. Supported states: TX, UT, AZ, CA, FL, IL, NY'),

  body('documentType')
    .trim()
    .notEmpty()
    .withMessage('Document type is required')
    .isIn(['divorce_petition', 'divorce_decree'])
    .withMessage('Invalid document type. Must be divorce_petition or divorce_decree'),

  body('data')
    .isObject()
    .withMessage('Data must be an object'),

  body('data.petitionerName')
    .optional()
    .trim()
    .isLength({ min: 2, max: LIMITS.NAME_MAX_LENGTH })
    .withMessage(`Petitioner name must be between 2 and ${LIMITS.NAME_MAX_LENGTH} characters`)
    .matches(/^[\p{L}\p{M}\p{N}\s\-'.]+$/u)
    .withMessage('Invalid petitioner name format')
    .customSanitizer(sanitizeText),

  body('data.respondentName')
    .optional()
    .trim()
    .isLength({ min: 2, max: LIMITS.NAME_MAX_LENGTH })
    .withMessage(`Respondent name must be between 2 and ${LIMITS.NAME_MAX_LENGTH} characters`)
    .matches(/^[\p{L}\p{M}\p{N}\s\-'.]+$/u)
    .withMessage('Invalid respondent name format')
    .customSanitizer(sanitizeText),

  body('data.marriageDate')
    .optional()
    .isISO8601()
    .withMessage('Marriage date must be a valid date (ISO 8601 format)')
    .custom((value) => {
      const date = new Date(value);
      const now = new Date();
      if (date > now) {
        throw new Error('Marriage date cannot be in the future');
      }
      return true;
    }),

  body('data.separationDate')
    .optional()
    .isISO8601()
    .withMessage('Separation date must be a valid date (ISO 8601 format)')
    .custom((value, { req }) => {
      const separationDate = new Date(value);
      const marriageDate = req.body.data?.marriageDate ? new Date(req.body.data.marriageDate) : null;

      if (marriageDate && separationDate < marriageDate) {
        throw new Error('Separation date cannot be before marriage date');
      }
      return true;
    }),

  body('data.groundsForDivorce')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Grounds for divorce must be 500 characters or less')
    .customSanitizer(sanitizeText),

  body('data.hasChildren')
    .optional()
    .isBoolean()
    .withMessage('hasChildren must be a boolean'),

  body('data.children')
    .optional()
    .isArray({ max: 20 })
    .withMessage('Children must be an array with at most 20 entries'),

  body('data.children.*.name')
    .optional()
    .trim()
    .isLength({ min: 1, max: LIMITS.NAME_MAX_LENGTH })
    .withMessage('Child name is required')
    .matches(/^[\p{L}\p{M}\p{N}\s\-'.]+$/u)
    .withMessage('Invalid child name format')
    .customSanitizer(sanitizeText),

  body('data.children.*.dateOfBirth')
    .optional()
    .isISO8601()
    .withMessage('Child date of birth must be a valid date'),

  body('data.hasProperty')
    .optional()
    .isBoolean()
    .withMessage('hasProperty must be a boolean'),

  body('data.propertyDetails')
    .optional()
    .trim()
    .isLength({ max: 5000 })
    .withMessage('Property details must be 5000 characters or less')
    .customSanitizer(sanitizeText),

  body('data.requestingSpousalSupport')
    .optional()
    .isBoolean()
    .withMessage('requestingSpousalSupport must be a boolean'),

  body('data.spousalSupportDetails')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Spousal support details must be 2000 characters or less')
    .customSanitizer(sanitizeText),

  body('data.county')
    .optional()
    .trim()
    .isLength({ max: LIMITS.COUNTY_MAX_LENGTH })
    .withMessage(`County name exceeds maximum length of ${LIMITS.COUNTY_MAX_LENGTH} characters`)
    .matches(/^[a-zA-Z\s\-'.]+$/)
    .withMessage('County name contains invalid characters')
    .customSanitizer(sanitizeText),

  body('data.caseNumber')
    .optional()
    .trim()
    .matches(/^[a-zA-Z0-9\-/\s]+$/)
    .withMessage('Invalid case number format'),

  checkValidationResult
];

/**
 * Divorce state parameter validation
 */
const validateDivorceStateParam = [
  param('state')
    .trim()
    .notEmpty()
    .withMessage('State is required')
    .matches(/^[A-Za-z]{2}$/)
    .withMessage('State must be a 2-letter code')
    .customSanitizer((value) => value.toUpperCase()),

  checkValidationResult
];

module.exports = {
  // Validation functions
  validateChatMessage,
  validateDocumentSave,
  validateAffidavitData,
  validatePreview,
  validateDocumentGeneration,
  validatePayment,
  validateDocumentRename,
  validateId,
  validatePagination,
  validateFileUpload,
  validateRateLimit,
  validateDivorceData,
  validateDivorceStateParam,

  // Security middleware
  helmetConfig,
  detectSuspiciousActivity,

  // Utility functions
  checkValidationResult,
  countWords,
  sanitizeText,
  wordCountValidator,
  jsonSizeValidator,

  // Constants
  LIMITS
};