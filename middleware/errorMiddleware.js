// middleware/errorMiddleware.js - Consistent Error Handling
const logger = require('../utils/logger');
const { errorResponse } = require('../utils/responseHelpers');

/**
 * Custom error classes for better error handling
 */
class AppError extends Error {
  constructor(message, statusCode = 500, errorType = null, additionalProps = {}) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.errorType = errorType;
    Object.assign(this, additionalProps);
    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message, errors = []) {
    super(message, 400, 'validation_error');
    this.name = 'ValidationError';
    this.errors = errors;
  }
}

class AuthenticationError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 401, 'authentication_error');
    this.name = 'AuthenticationError';
    this.requiresLogin = true;
  }
}

class AuthorizationError extends AppError {
  constructor(message = 'Access denied') {
    super(message, 403, 'authorization_error');
    this.name = 'AuthorizationError';
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404, 'not_found_error');
    this.name = 'NotFoundError';
  }
}

class RateLimitError extends AppError {
  constructor(message = 'Too many requests', retryAfter = 60) {
    super(message, 429, 'rate_limit_error');
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

class ExternalServiceError extends AppError {
  constructor(message, service, retryAfter = null) {
    super(message, 503, 'external_service_error');
    this.name = 'ExternalServiceError';
    this.service = service;
    if (retryAfter) this.retryAfter = retryAfter;
  }
}

/**
 * Sanitize request body for logging (remove sensitive data)
 */
const sanitizeRequestBody = (body) => {
  if (!body || typeof body !== 'object') return body;
  
  const sensitiveFields = [
    'password', 'token', 'secret', 'key', 'authorization',
    'credit_card', 'ssn', 'social_security'
  ];
  
  const sanitized = { ...body };
  
  const sanitizeObject = (obj) => {
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const lowerKey = key.toLowerCase();
        if (sensitiveFields.some(field => lowerKey.includes(field))) {
          obj[key] = '[REDACTED]';
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
          sanitizeObject(obj[key]);
        }
      }
    }
  };
  
  sanitizeObject(sanitized);
  return sanitized;
};

/**
 * Enhanced error handler with detailed logging and consistent responses
 */
const errorHandler = (err, req, res, next) => {
  // Don't handle if response already sent
  if (res.headersSent) {
    return next(err);
  }

  // Set userId for logging if available
  if (req.user?.id) {
    req.userId = req.user.id;
  }

  // Default to 500 server error
  let statusCode = err.statusCode || 500;
  let errorMessage = err.message || 'Internal server error';
  let errorType = err.errorType;

  // Handle specific error types and adjust status codes
  if (err.code) {
    switch (err.code) {
      case '23505': // PostgreSQL unique violation
        statusCode = 409;
        errorMessage = 'A record with this information already exists';
        errorType = 'conflict_error';
        break;
      case '23503': // PostgreSQL foreign key violation
        statusCode = 400;
        errorMessage = 'Referenced resource not found';
        errorType = 'validation_error';
        break;
      case '22P02': // PostgreSQL invalid input
        statusCode = 400;
        errorMessage = 'Invalid data format provided';
        errorType = 'validation_error';
        break;
      case 'ECONNREFUSED':
        statusCode = 503;
        errorMessage = 'External service unavailable';
        errorType = 'external_service_error';
        break;
      case 'ETIMEDOUT':
        statusCode = 504;
        errorMessage = 'Request timed out';
        errorType = 'timeout_error';
        break;
      case 'ENOTFOUND':
        statusCode = 502;
        errorMessage = 'External service not found';
        errorType = 'external_service_error';
        break;
    }
  }

  // Handle Stripe errors
  if (err.type?.startsWith('Stripe')) {
    statusCode = 400;
    errorMessage = `Payment failed: ${err.message}`;
    errorType = 'payment_error';
    err.paymentCode = err.code;
  }

  // Handle OpenAI/external API errors
  if (err.response?.status === 429) {
    statusCode = 503;
    errorMessage = 'AI service is currently busy. Please try again in a moment.';
    errorType = 'external_service_error';
    err.service = 'openai';
    err.retryAfter = 30;
  }

  if (err.response?.status === 401 && err.response?.data?.error?.type === 'invalid_api_key') {
    statusCode = 503;
    errorMessage = 'AI service configuration error';
    errorType = 'external_service_error';
    err.service = 'openai';
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    errorMessage = 'Invalid authentication token';
    errorType = 'authentication_error';
    err.requiresLogin = true;
  }

  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    errorMessage = 'Authentication token has expired';
    errorType = 'authentication_error';
    err.requiresLogin = true;
  }

  // Handle multer file upload errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    statusCode = 413;
    errorMessage = 'File size too large';
    errorType = 'validation_error';
  }

  if (err.code === 'LIMIT_FILE_COUNT') {
    statusCode = 413;
    errorMessage = 'Too many files uploaded';
    errorType = 'validation_error';
  }

  // Handle validation errors from express-validator
  if (err.name === 'ValidationError' && err.errors) {
    statusCode = 400;
    errorType = 'validation_error';
  }

  // Create logging data
  const logData = {
    error: {
      name: err.name,
      message: errorMessage,
      code: err.code,
      type: err.type,
      statusCode,
      errorType
    },
    request: {
      id: req.id,
      path: req.path,
      method: req.method,
      userId: req.userId,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      referer: req.get('Referer')
    }
  };

  // Add additional context for server errors
  if (statusCode >= 500) {
    logData.error.stack = err.stack;
    logData.request.body = sanitizeRequestBody(req.body);
    logData.request.query = req.query;
    logData.request.params = req.params;
    logData.request.headers = sanitizeRequestBody(req.headers);
    
    logger.logError(err, logData.request, req.id);
  } else {
    logger.warn('Client error occurred', logData);
  }

  // Track error in monitoring (if service available)
  try {
    if (req.app.locals.monitoringService) {
      req.app.locals.monitoringService.trackError(err, {
        requestId: req.id,
        endpoint: req.path,
        userId: req.userId,
        statusCode
      });
    }
  } catch (monitoringError) {
    logger.warn('Failed to track error in monitoring:', monitoringError.message);
  }

  // Create error object with processed values
  const errorObj = new Error(errorMessage);
  errorObj.statusCode = statusCode;
  errorObj.errorType = errorType;
  if (err.requiresLogin) errorObj.requiresLogin = true;
  if (err.retryAfter) errorObj.retryAfter = err.retryAfter;
  if (err.service) errorObj.service = err.service;
  if (err.paymentCode) errorObj.paymentCode = err.paymentCode;
  if (err.errors) errorObj.errors = err.errors;

  // Create standardized error response
  const { response, statusCode: responseCode } = errorResponse(errorObj, req.id, statusCode);

  // Don't expose internal error details in production
  if (process.env.NODE_ENV === 'production' && statusCode >= 500) {
    response.error = 'An unexpected error occurred. Please try again later.';
    delete response.stack;
  }

  res.status(responseCode).json(response);
};

/**
 * 404 handler for unmatched routes
 */
const notFoundHandler = (req, res) => {
  const message = `Endpoint ${req.method} ${req.path} not found`;
  
  logger.warn('Route not found', {
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    requestId: req.id
  });

  const error = new NotFoundError(message);
  const { response, statusCode } = errorResponse(error, req.id);
  
  res.status(statusCode).json(response);
};

/**
 * Async wrapper that automatically handles errors with standard format
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next))
    .then(result => {
      // If the handler returns a value and hasn't sent a response, send it as success
      if (result !== undefined && !res.headersSent) {
        res.sendSuccess(result);
      }
    })
    .catch(next);
};

/**
 * Global error handlers for uncaught exceptions
 */
const setupGlobalErrorHandlers = () => {
  process.on('uncaughtException', (error) => {
    logger.logError(error, {
      type: 'uncaught_exception',
      fatal: true
    });
    
    // Give logger time to write then exit
    setTimeout(() => {
      process.exit(1);
    }, 1000);
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.logError(new Error('Unhandled Rejection'), {
      type: 'unhandled_rejection',
      reason: reason?.toString(),
      promise: promise?.toString(),
      fatal: false
    });
  });
};

module.exports = {
  // Error classes
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  RateLimitError,
  ExternalServiceError,
  
  // Middleware
  errorHandler,
  notFoundHandler,
  asyncHandler,
  
  // Setup
  setupGlobalErrorHandlers,
  
  // Utilities
  sanitizeRequestBody
};