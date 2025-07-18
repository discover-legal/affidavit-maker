// utils/responseHelpers.js - Standardized response formats
const logger = require('../services/logger');

// Standard success response
const successResponse = (data, message = null, meta = {}) => {
  const response = {
    success: true,
    timestamp: new Date().toISOString(),
    ...data
  };
  
  if (message) response.message = message;
  if (Object.keys(meta).length > 0) response.meta = meta;
  
  return response;
};

// Standard error response
const errorResponse = (error, requestId = null, statusCode = 500) => {
  const response = {
    success: false,
    error: typeof error === 'string' ? error : error.message,
    timestamp: new Date().toISOString()
  };
  
  if (requestId) response.requestId = requestId;
  
  // Add details for validation errors
  if (error.errors && Array.isArray(error.errors)) {
    response.details = error.errors;
  }
  
  // Add specific error codes for client handling
  if (error.name === 'ValidationError') {
    response.errorType = 'validation';
  } else if (error.name === 'AuthenticationError') {
    response.errorType = 'authentication';
    response.requiresLogin = true;
  } else if (error.name === 'AuthorizationError') {
    response.errorType = 'authorization';
  } else if (error.name === 'RateLimitError') {
    response.errorType = 'rate_limit';
    response.retryAfter = error.retryAfter || 60;
  } else if (error.name === 'ExternalServiceError') {
    response.errorType = 'external_service';
    response.service = error.service;
    response.retryAfter = 30;
  } else if (statusCode >= 500) {
    response.errorType = 'server_error';
  } else {
    response.errorType = 'client_error';
  }
  
  return response;
};

// Validation error response
const validationErrorResponse = (errors, requestId = null) => {
  return {
    success: false,
    error: 'Validation failed',
    errorType: 'validation',
    details: Array.isArray(errors) ? errors : [errors],
    timestamp: new Date().toISOString(),
    ...(requestId && { requestId })
  };
};

// Paginated response helper
const paginatedResponse = (data, page, limit, total, additionalData = {}) => {
  const totalPages = Math.ceil(total / limit);
  
  return {
    success: true,
    data,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: parseInt(total),
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1
    },
    timestamp: new Date().toISOString(),
    ...additionalData
  };
};

// Express middleware for consistent error handling
const errorResponseMiddleware = (err, req, res, next) => {
  // Log the error
  if (err.statusCode >= 500 || !err.statusCode) {
    logger.error('Server error:', {
      error: err,
      stack: err.stack,
      requestId: req.id,
      path: req.path,
      method: req.method,
      userId: req.userId,
      ip: req.ip
    });
  } else {
    logger.warn('Client error:', {
      error: err.message,
      statusCode: err.statusCode,
      requestId: req.id,
      path: req.path,
      userId: req.userId
    });
  }

  const statusCode = err.statusCode || 500;
  const response = errorResponse(err, req.id, statusCode);
  
  // Don't expose internal error details in production
  if (process.env.NODE_ENV === 'production' && statusCode === 500) {
    response.error = 'An unexpected error occurred. Please try again later.';
  }
  
  res.status(statusCode).json(response);
};

// Async wrapper that automatically handles errors with standard format
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next))
    .then(result => {
      // If the handler returns a value, send it as a success response
      if (result && !res.headersSent) {
        res.json(successResponse(result));
      }
    })
    .catch(next);
};

// Response helper methods for controllers
const sendSuccess = (res, data, message = null, statusCode = 200) => {
  res.status(statusCode).json(successResponse(data, message));
};

const sendError = (res, error, statusCode = 500, requestId = null) => {
  res.status(statusCode).json(errorResponse(error, requestId, statusCode));
};

const sendValidationError = (res, errors, requestId = null) => {
  res.status(400).json(validationErrorResponse(errors, requestId));
};

const sendPaginated = (res, data, page, limit, total, additionalData = {}) => {
  res.json(paginatedResponse(data, page, limit, total, additionalData));
};

module.exports = {
  successResponse,
  errorResponse,
  validationErrorResponse,
  paginatedResponse,
  errorResponseMiddleware,
  asyncHandler,
  sendSuccess,
  sendError,
  sendValidationError,
  sendPaginated
};