// utils/responseHelpers.js - Consistent Response Formatting
const logger = require('./logger');

/**
 * Standard success response format
 */
const successResponse = (data, message = null, statusCode = 200) => {
  const response = {
    success: true,
    timestamp: new Date().toISOString()
  };
  
  if (data !== undefined) response.data = data;
  if (message) response.message = message;
  
  return { response, statusCode };
};

/**
 * Standard error response format
 */
const errorResponse = (error, requestId = null, statusCode = 500) => {
  const response = {
    success: false,
    error: typeof error === 'string' ? error : error.message,
    timestamp: new Date().toISOString()
  };
  
  if (requestId) response.requestId = requestId;
  
  // Add error type for client handling
  if (error.errorType) {
    response.errorType = error.errorType;
  } else if (statusCode >= 500) {
    response.errorType = 'server_error';
  } else if (statusCode === 401) {
    response.errorType = 'authentication_error';
    response.requiresLogin = true;
  } else if (statusCode === 403) {
    response.errorType = 'authorization_error';
  } else if (statusCode === 429) {
    response.errorType = 'rate_limit_error';
    if (error.retryAfter) response.retryAfter = error.retryAfter;
  } else {
    response.errorType = 'client_error';
  }
  
  // Add specific error properties
  if (error.service) response.service = error.service;
  if (error.paymentCode) response.paymentCode = error.paymentCode;
  
  return { response, statusCode };
};

/**
 * Validation error response format
 */
const validationErrorResponse = (errors, requestId = null) => {
  const response = {
    success: false,
    error: 'Validation failed',
    errorType: 'validation_error',
    details: Array.isArray(errors) ? errors.map(e => ({
      field: e.path || e.param || e.field,
      message: e.msg || e.message,
      value: e.value
    })) : [{ message: errors }],
    timestamp: new Date().toISOString()
  };
  
  if (requestId) response.requestId = requestId;
  
  return { response, statusCode: 400 };
};

/**
 * Paginated response format
 */
const paginatedResponse = (data, page, limit, total, additionalData = {}) => {
  const totalPages = Math.ceil(total / limit);
  
  return {
    response: {
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
    },
    statusCode: 200
  };
};

/**
 * Express middleware for consistent response handling
 */
const responseMiddleware = (req, res, next) => {
  // Helper methods attached to response object
  res.sendSuccess = (data, message = null, statusCode = 200) => {
    const { response, statusCode: code } = successResponse(data, message, statusCode);
    res.status(code).json(response);
  };

  res.sendError = (error, statusCode = 500) => {
    const { response, statusCode: code } = errorResponse(error, req.id, statusCode);
    res.status(code).json(response);
  };

  res.sendValidationError = (errors) => {
    const { response, statusCode } = validationErrorResponse(errors, req.id);
    res.status(statusCode).json(response);
  };

  res.sendPaginated = (data, page, limit, total, additionalData = {}) => {
    const { response, statusCode } = paginatedResponse(data, page, limit, total, additionalData);
    res.status(statusCode).json(response);
  };

  next();
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
 * Create error with specific properties
 */
const createError = (message, statusCode = 500, errorType = null, additionalProps = {}) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  if (errorType) error.errorType = errorType;
  Object.assign(error, additionalProps);
  return error;
};

module.exports = {
  successResponse,
  errorResponse,
  validationErrorResponse,
  paginatedResponse,
  responseMiddleware,
  asyncHandler,
  createError
};