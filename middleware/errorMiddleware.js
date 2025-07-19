// middleware/errorMiddleware.js - Complete error handling middleware
const { v4: uuidv4 } = require('uuid');
const winston = require('winston');

// Initialize logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'affidavit-maker' },
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// Request ID middleware - adds unique ID to each request
const requestIdMiddleware = (req, res, next) => {
  req.id = req.headers['x-request-id'] || uuidv4();
  res.setHeader('X-Request-ID', req.id);
  
  // Log request start
  req.startTime = Date.now();
  
  // Add user ID to request for logging
  req.userId = null;
  
  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - req.startTime;
    
    const logData = {
      requestId: req.id,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      userId: req.userId || 'anonymous',
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent')
    };

    if (res.statusCode >= 400) {
      logger.warn('Request completed with error', logData);
    } else {
      logger.info('Request completed', logData);
    }
  });
  
  next();
};

// Custom error classes
class ValidationError extends Error {
  constructor(message, errors = []) {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = 400;
    this.errors = errors;
    this.errorType = 'validation';
  }
}

class AuthenticationError extends Error {
  constructor(message = 'Authentication required') {
    super(message);
    this.name = 'AuthenticationError';
    this.statusCode = 401;
    this.errorType = 'authentication';
    this.requiresLogin = true;
  }
}

class AuthorizationError extends Error {
  constructor(message = 'Access denied') {
    super(message);
    this.name = 'AuthorizationError';
    this.statusCode = 403;
    this.errorType = 'authorization';
  }
}

class NotFoundError extends Error {
  constructor(message = 'Resource not found') {
    super(message);
    this.name = 'NotFoundError';
    this.statusCode = 404;
    this.errorType = 'not_found';
  }
}

class ConflictError extends Error {
  constructor(message = 'Resource conflict') {
    super(message);
    this.name = 'ConflictError';
    this.statusCode = 409;
    this.errorType = 'conflict';
  }
}

class RateLimitError extends Error {
  constructor(message = 'Too many requests', retryAfter = 60) {
    super(message);
    this.name = 'RateLimitError';
    this.statusCode = 429;
    this.errorType = 'rate_limit';
    this.retryAfter = retryAfter;
  }
}

class ExternalServiceError extends Error {
  constructor(message, service, retryAfter = 30) {
    super(message);
    this.name = 'ExternalServiceError';
    this.statusCode = 503;
    this.errorType = 'external_service';
    this.service = service;
    this.retryAfter = retryAfter;
  }
}

class PaymentError extends Error {
  constructor(message, paymentCode = null) {
    super(message);
    this.name = 'PaymentError';
    this.statusCode = 402;
    this.errorType = 'payment';
    this.paymentCode = paymentCode;
  }
}

// Async error handler wrapper
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Standardized error response helper
const createErrorResponse = (err, requestId = null, statusCode = 500) => {
  const response = {
    success: false,
    error: typeof err === 'string' ? err : err.message,
    timestamp: new Date().toISOString()
  };
  
  if (requestId) response.requestId = requestId;
  
  // Add error type for client handling
  if (err.errorType) {
    response.errorType = err.errorType;
  } else if (statusCode >= 500) {
    response.errorType = 'server_error';
  } else {
    response.errorType = 'client_error';
  }
  
  // Add specific properties based on error type
  if (err.requiresLogin) response.requiresLogin = true;
  if (err.retryAfter) response.retryAfter = err.retryAfter;
  if (err.service) response.service = err.service;
  if (err.paymentCode) response.paymentCode = err.paymentCode;
  
  // Add validation details
  if (err.errors && Array.isArray(err.errors)) {
    response.details = err.errors.map(e => ({
      field: e.path || e.param,
      message: e.msg || e.message,
      value: e.value
    }));
  }
  
  return response;
};

// Main error handler middleware
const errorHandler = (err, req, res, next) => {
  // Set userId for logging if available
  if (req.user?.id) {
    req.userId = req.user.id;
  }

  // Default to 500 server error
  let statusCode = err.statusCode || 500;
  let errorMessage = err.message || 'Internal server error';

  // Handle specific error types and adjust status codes
  if (err.code) {
    switch (err.code) {
      case '23505': // PostgreSQL unique violation
        statusCode = 409;
        errorMessage = 'A record with this information already exists';
        err.name = 'ConflictError';
        break;
      case '23503': // PostgreSQL foreign key violation
        statusCode = 400;
        errorMessage = 'Referenced resource not found';
        err.name = 'ValidationError';
        break;
      case '22P02': // PostgreSQL invalid input
        statusCode = 400;
        errorMessage = 'Invalid data format provided';
        err.name = 'ValidationError';
        break;
      case 'ECONNREFUSED':
        statusCode = 503;
        errorMessage = 'External service unavailable';
        err.name = 'ExternalServiceError';
        break;
      case 'ETIMEDOUT':
        statusCode = 503;
        errorMessage = 'Request timed out';
        err.name = 'ExternalServiceError';
        break;
    }
  }

  // Handle Stripe errors
  if (err.type?.startsWith('Stripe')) {
    statusCode = 400;
    errorMessage = `Payment failed: ${err.message}`;
    err.name = 'PaymentError';
    err.paymentCode = err.code;
  }

  // Handle OpenAI/external API errors
  if (err.response?.status === 429) {
    statusCode = 503;
    errorMessage = 'AI service is currently busy. Please try again in a moment.';
    err.name = 'ExternalServiceError';
    err.service = 'openai';
    err.retryAfter = 30;
  }

  if (err.response?.status === 401 && err.response?.data?.error?.type === 'invalid_api_key') {
    statusCode = 503;
    errorMessage = 'AI service configuration error';
    err.name = 'ExternalServiceError';
    err.service = 'openai';
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    errorMessage = 'Invalid authentication token';
    err.name = 'AuthenticationError';
    err.requiresLogin = true;
  }

  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    errorMessage = 'Authentication token has expired';
    err.name = 'AuthenticationError';
    err.requiresLogin = true;
  }

  // Log the error
  const logData = {
    error: {
      name: err.name,
      message: errorMessage,
      code: err.code,
      type: err.type,
      statusCode
    },
    request: {
      id: req.id,
      path: req.path,
      method: req.method,
      userId: req.userId,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    }
  };

  if (statusCode >= 500) {
    logData.error.stack = err.stack;
    logData.request.body = sanitizeRequestBody(req.body);
    logData.request.query = req.query;
    logData.request.params = req.params;
    logger.error('Server error occurred', logData);
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

  // Create standardized error response
  err.message = errorMessage; // Use the processed message
  let errorResponse = createErrorResponse(err, req.id, statusCode);

  // Don't expose internal error details in production
  if (process.env.NODE_ENV === 'production' && statusCode >= 500) {
    errorResponse.error = 'An unexpected error occurred. Please try again later.';
    delete errorResponse.stack;
    delete errorResponse.details;
  } else if (process.env.NODE_ENV === 'development') {
    // Include stack trace and additional details in development
    errorResponse.stack = err.stack;
    errorResponse.details = {
      name: err.name,
      code: err.code,
      type: err.type
    };
  }

  res.status(statusCode).json(errorResponse);
};

// 404 handler for unmatched routes
const notFoundHandler = (req, res, next) => {
  const error = new NotFoundError(`Endpoint not found: ${req.method} ${req.path}`);
  next(error);
};

// Database transaction wrapper with error handling
const withTransaction = async (pool, callback) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Transaction rolled back due to error:', error);
    throw error;
  } finally {
    client.release();
  }
};

// Sanitize request body for logging (remove sensitive data)
const sanitizeRequestBody = (body) => {
  if (!body || typeof body !== 'object') return body;
  
  const sensitiveFields = [
    'password', 'token', 'apiKey', 'secret', 'creditCard', 
    'ssn', 'socialSecurity', 'bankAccount', 'routingNumber'
  ];
  
  const sanitized = { ...body };
  
  const sanitizeObject = (obj) => {
    for (const key in obj) {
      if (sensitiveFields.some(field => key.toLowerCase().includes(field.toLowerCase()))) {
        obj[key] = '[REDACTED]';
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        sanitizeObject(obj[key]);
      }
    }
  };
  
  sanitizeObject(sanitized);
  return sanitized;
};

// Validation error handler for express-validator
const handleValidationErrors = (req, res, next) => {
  const { validationResult } = require('express-validator');
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }
  
  next();
};

// Rate limiting error handler
const handleRateLimitError = (req, res, next) => {
  throw new RateLimitError(
    'Too many requests from this IP, please try again later.',
    parseInt(req.rateLimit?.resetTime) || 60
  );
};

module.exports = {
  // Middleware functions
  requestIdMiddleware,
  errorHandler,
  notFoundHandler,
  asyncHandler,
  handleValidationErrors,
  handleRateLimitError,
  
  // Error classes
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  ExternalServiceError,
  PaymentError,
  
  // Utility functions
  createErrorResponse,
  withTransaction,
  sanitizeRequestBody,
  
  // Logger instance
  logger
};