// middleware/validation.js - Input Validation Middleware
const { body, param, query, validationResult } = require('express-validator');
const logger = require('../utils/logger');
const { createError } = require('../utils/responseHelpers');

/**
 * Constants for validation limits
 */
const LIMITS = {
  MESSAGE_MAX_WORDS: 5000,
  MESSAGE_MAX_CHARS: 25000, // ~5k words
  DOCUMENT_MAX_SIZE: 25 * 1024 * 1024, // 25MB
  NAME_MAX_LENGTH: 255,
  COUNTY_MAX_LENGTH: 100,
  FACTS_MAX_COUNT: 50,
  FACT_MAX_WORDS: 500,
  TITLE_MAX_LENGTH: 500
};

/**
 * Helper function to count words
 */
const countWords = (text) => {
  if (!text || typeof text !== 'string') return 0;
  return text.trim().split(/\s+/).filter(word => word.length > 0).length;
};

/**
 * Helper function to sanitize text input
 */
const sanitizeText = (text) => {
  if (!text) return text;
  return text
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
    .replace(/<[^>]*>/g, '') // Remove other HTML tags
    .trim();
};

/**
 * Custom validation middleware to check for validation errors
 */
const checkValidationResult = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.logSecurity('validation_failed', {
      requestId: req.id,
      userId: req.user?.id,
      path: req.path,
      errors: errors.array()
    });
    
    return res.sendValidationError(errors.array());
  }
  next();
};

/**
 * Custom validator for word count
 */
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

/**
 * Custom validator for JSON size
 */
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

/**
 * Chat message validation
 */
const validateChatMessage = [
  body('message')
    .trim()
    .notEmpty()
    .withMessage('Message is required')
    .isLength({ max: LIMITS.MESSAGE_MAX_CHARS })
    .withMessage(`Message exceeds maximum length of ${LIMITS.MESSAGE_MAX_CHARS} characters`)
    .custom(wordCountValidator(LIMITS.MESSAGE_MAX_WORDS, 'Message'))
    .customSanitizer(sanitizeText),
  
  body('conversationHistory')
    .optional()
    .isArray()
    .withMessage('Conversation history must be an array')
    .custom(jsonSizeValidator(2 * 1024 * 1024)) // 2MB limit for conversation history
    .customSanitizer((history) => {
      if (!Array.isArray(history)) return history;
      return history.slice(-20); // Keep only last 20 messages
    }),
  
  body('affidavitData')
    .optional()
    .isObject()
    .withMessage('Affidavit data must be an object')
    .custom(jsonSizeValidator(1024 * 1024)), // 1MB limit for affidavit data
  
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
  
  checkValidationResult
];

/**
 * Affidavit data validation
 */
const validateAffidavitData = [
  body('affiantName')
    .trim()
    .notEmpty()
    .withMessage('Affiant name is required')
    .isLength({ max: LIMITS.NAME_MAX_LENGTH })
    .withMessage(`Affiant name exceeds maximum length of ${LIMITS.NAME_MAX_LENGTH} characters`)
    .matches(/^[a-zA-Z\s\-'.]+$/)
    .withMessage('Affiant name contains invalid characters')
    .customSanitizer(sanitizeText),
  
  body('state')
    .trim()
    .notEmpty()
    .withMessage('State is required')
    .isIn(['TX', 'UT', 'AZ', 'Texas', 'Utah', 'Arizona'])
    .withMessage('Invalid state'),
  
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
    .isInt({ min: 1, max: 1000 })
    .withMessage('Page must be between 1 and 1000'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  
  checkValidationResult
];

/**
 * Payment validation
 */
const validatePayment = [
  body('amount')
    .optional()
    .isInt({ min: 999, max: 99999 }) // $9.99 to $999.99
    .withMessage('Invalid payment amount'),
  
  body('documentId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Invalid document ID'),
  
  checkValidationResult
];

/**
 * File upload validation middleware
 */
const validateFileUpload = (req, res, next) => {
  if (req.file) {
    // Check file size
    if (req.file.size > LIMITS.DOCUMENT_MAX_SIZE) {
      return res.sendValidationError([{
        field: 'file',
        message: `File size exceeds maximum of ${LIMITS.DOCUMENT_MAX_SIZE / 1024 / 1024}MB`
      }]);
    }
    
    // Check file type
    const allowedTypes = ['application/pdf', 'application/json', 'text/plain'];
    if (!allowedTypes.includes(req.file.mimetype)) {
      return res.sendValidationError([{
        field: 'file',
        message: 'Invalid file type'
      }]);
    }
  }
  next();
};

/**
 * Rate limit validation - check if user is within limits
 */
const validateRateLimit = (req, res, next) => {
  const userId = req.user?.id;
  if (!userId) return next();
  
  // This could be enhanced with Redis for distributed rate limiting
  // For now, just log the attempt
  logger.logBusinessEvent('rate_limit_check', userId, {
    endpoint: req.path,
    ip: req.ip
  });
  
  next();
};

module.exports = {
  validateChatMessage,
  validateDocumentSave,
  validateAffidavitData,
  validateId,
  validatePagination,
  validatePayment,
  validateFileUpload,
  validateRateLimit,
  checkValidationResult,
  LIMITS,
  countWords,
  sanitizeText
};