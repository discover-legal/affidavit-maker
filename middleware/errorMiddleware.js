// middleware/errorMiddleware.js - Centralized error handling
const { v4: uuidv4 } = require('uuid');
const logger = require('../services/logger');
const monitoringService = require('../services/monitoringService');

// Request ID middleware
const requestIdMiddleware = (req, res, next) => {
  req.id = req.headers['x-request-id'] || uuidv4();
  res.setHeader('X-Request-ID', req.id);
  
  // Log request start
  req.startTime = Date.now();
  
  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - req.startTime;
    
    logger.info('Request completed', {
      requestId: req.id,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      userId: req.userId || 'anonymous',
      ip: req.ip
    });
    
    // Track in monitoring
    monitoringService.trackRequest(req.path, req.method, res.statusCode, duration);
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
  }
}

class AuthenticationError extends Error {
  constructor(message = 'Authentication required') {
    super(message);
    this.name = 'AuthenticationError';
    this.statusCode = 401;
  }
}

class AuthorizationError extends Error {
  constructor(message = 'Access denied') {
    super(message);
    this.name = 'AuthorizationError';
    this.statusCode = 403;
  }
}

class NotFoundError extends Error {
  constructor(message = 'Resource not found') {
    super(message);
    this.name = 'NotFoundError';
    this.statusCode = 404;
  }
}

class RateLimitError extends Error {
  constructor(message = 'Too many requests') {
    super(message);
    this.name = 'RateLimitError';
    this.statusCode = 429;
  }
}

class ExternalServiceError extends Error {
  constructor(message, service) {
    super(message);
    this.name = 'ExternalServiceError';
    this.statusCode = 503;
    this.service = service;
  }
}

// Async error handler wrapper
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// 404 handler
const notFoundHandler = (req, res, next) => {
  const error = new NotFoundError(`Endpoint not found: ${req.method} ${req.path}`);
  next(error);
};

// Main error handler
const errorHandler = (err, req, res, next) => {
  // Default to 500 server error
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal server error';
  let errorResponse = {
    success: false,
    error: message,
    requestId: req.id,
    timestamp: new Date().toISOString()
  };

  // Log the error
  if (statusCode >= 500) {
    logger.error('Server error:', {
      error: err,
      stack: err.stack,
      requestId: req.id,
      path: req.path,
      method: req.method,
      userId: req.userId,
      ip: req.ip,
      body: req.body,
      query: req.query,
      params: req.params
    });
  } else {
    logger.warn('Client error:', {
      error: err.message,
      statusCode,
      requestId: req.id,
      path: req.path,
      method: req.method,
      userId: req.userId
    });
  }

  // Track error in monitoring
  monitoringService.trackError(err, {
    requestId: req.id,
    endpoint: req.path,
    userId: req.userId,
    statusCode
  });

  // Handle specific error types
  if (err.name === 'ValidationError') {
    errorResponse.errors = err.errors;
  }

  if (err.name === 'AuthenticationError') {
    errorResponse.requiresLogin = true;
  }

  if (err.name === 'ExternalServiceError') {
    errorResponse.service = err.service;
    errorResponse.retryAfter = 60; // seconds
  }

  // Handle Stripe errors
  if (err.type === 'StripeCardError') {
    statusCode = 400;
    errorResponse.error = 'Payment failed: ' + err.message;
    errorResponse.code = err.code;
  }

  // Handle OpenAI errors
  if (err.response?.status === 429) {
    statusCode = 503;
    errorResponse.error = 'AI service is currently busy. Please try again in a moment.';
    errorResponse.retryAfter = 30;
  }

  // Handle database errors
  if (err.code === '23505') {
    statusCode = 409;
    errorResponse.error = 'A record with this information already exists';
  }

  if (err.code === 'ECONNREFUSED') {
    statusCode = 503;
    errorResponse.error = 'Service temporarily unavailable';
  }

  // Don't expose internal error details in production
  if (process.env.NODE_ENV === 'production' && statusCode === 500) {
    errorResponse.error = 'An unexpected error occurred. Please try again later.';
    delete errorResponse.stack;
  } else if (process.env.NODE_ENV === 'development') {
    errorResponse.stack = err.stack;
    errorResponse.details = err;
  }

  res.status(statusCode).json(errorResponse);
};

// Database transaction wrapper
const withTransaction = async (pool, callback) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

// Sanitize error messages for user display
const sanitizeErrorMessage = (error) => {
  const userFriendlyMessages = {
    'ECONNREFUSED': 'Service temporarily unavailable. Please try again later.',
    'ETIMEDOUT': 'Request timed out. Please try again.',
    'ENOTFOUND': 'Service unavailable. Please check your internet connection.',
    '23505': 'This information already exists in the system.',
    '23503': 'Related information not found.',
    '22P02': 'Invalid data format provided.',
    'invalid_grant': 'Your session has expired. Please log in again.',
    'Rate limit exceeded': 'Too many requests. Please wait a moment and try again.'
  };

  // Check if we have a user-friendly message
  for (const [key, message] of Object.entries(userFriendlyMessages)) {
    if (error.message.includes(key) || error.code === key) {
      return message;
    }
  }

  // Generic message for unexpected errors
  if (error.statusCode >= 500 || !error.statusCode) {
    return 'An unexpected error occurred. Please try again later.';
  }

  return error.message;
};

module.exports = {
  requestIdMiddleware,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  RateLimitError,
  ExternalServiceError,
  asyncHandler,
  notFoundHandler,
  errorHandler,
  withTransaction,
  sanitizeErrorMessage
};