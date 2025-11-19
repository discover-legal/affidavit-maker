// utils/logger.js - Consistent Logging Patterns
const winston = require('winston');
const path = require('path');

// Ensure logs directory exists
const fs = require('fs');
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define colors for each level
const colors = {
  error: 'red',
  warn: 'yellow', 
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

winston.addColors(colors);

// Custom format for structured logging
const structuredFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
    return `${timestamp} [${level.toUpperCase()}]: ${message} ${metaStr}`;
  })
);

// JSON format for file logs
const jsonFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, requestId, userId, ...meta }) => {
    let prefix = `${timestamp} ${level}:`;
    if (requestId) prefix += ` [${requestId}]`;
    if (userId) prefix += ` [user:${userId}]`;
    
    const metaStr = Object.keys(meta).length && process.env.NODE_ENV === 'development' 
      ? ` ${JSON.stringify(meta)}` 
      : '';
    
    return `${prefix} ${message}${metaStr}`;
  })
);

// Create the logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  levels,
  format: jsonFormat,
  transports: [
    // Console transport
    new winston.transports.Console({
      format: consoleFormat,
      silent: process.env.NODE_ENV === 'test'
    }),
    // Error file transport
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      format: jsonFormat
    }),
    // Combined file transport
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      format: jsonFormat
    }),
  ],
  exitOnError: false,
});

// Create a stream object for Morgan middleware
logger.stream = {
  write: (message) => logger.http(message.trim()),
};

/**
 * Enhanced logging methods with consistent structure
 */

// List of sensitive field patterns to redact
const SENSITIVE_PATTERNS = [
  'password', 'passwd', 'pwd',
  'secret', 'token', 'auth', 'bearer',
  'api_key', 'apikey', 'api-key',
  'private_key', 'privatekey', 'private-key',
  'access_token', 'refresh_token',
  'session', 'cookie',
  'credit_card', 'creditcard', 'card_number',
  'ssn', 'social_security',
  'credential', 'authorization'
];

/**
 * Sanitize an object by redacting sensitive fields
 * @param {Object} obj - Object to sanitize
 * @param {number} depth - Current recursion depth
 * @returns {Object} Sanitized object
 */
const sanitizeObject = (obj, depth = 0) => {
  // Prevent infinite recursion
  if (depth > 5 || obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item, depth + 1));
  }

  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();

    // Check if key matches sensitive pattern
    const isSensitive = SENSITIVE_PATTERNS.some(pattern =>
      lowerKey.includes(pattern)
    );

    if (isSensitive) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value, depth + 1);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
};

// Log errors with context
logger.logError = (error, context = {}, requestId = null) => {
  const errorData = {
    message: error.message,
    // Only include stack traces in development
    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    name: error.name,
    code: error.code,
    statusCode: error.statusCode,
    // Sanitize context to remove sensitive data
    ...sanitizeObject(context)
  };

  if (requestId) errorData.requestId = requestId;

  logger.error('Error occurred', errorData);
};

// Log API requests consistently  
logger.logRequest = (req, res, responseTime) => {
  const logData = {
    method: req.method,
    url: req.originalUrl,
    status: res.statusCode,
    responseTime: `${responseTime}ms`,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    requestId: req.id,
    userId: req.user?.id || req.userId || 'anonymous',
    contentLength: req.get('content-length') || 0
  };
  
  // Add warning for slow requests
  if (responseTime > 2000) {
    logger.warn('Slow request detected', logData);
  } else {
    logger.http('Request processed', logData);
  }
};

// Log database operations
logger.logDatabase = (operation, table, duration, params = {}) => {
  const logData = {
    type: 'database',
    operation,
    table,
    duration: `${duration}ms`,
    // Sanitize params to prevent logging sensitive query data
    ...sanitizeObject(params)
  };

  if (duration > 1000) {
    logger.warn('Slow database query', logData);
  } else {
    logger.debug('Database operation', logData);
  }
};

// Log AI interactions
logger.logAI = (model, prompt, response, duration, context = {}) => {
  const logData = {
    type: 'ai_interaction',
    model,
    promptLength: prompt.length,
    responseLength: response.length,
    duration: `${duration}ms`,
    ...context
  };
  
  logger.info('AI interaction completed', logData);
};

// Log business events
logger.logBusinessEvent = (event, userId, data = {}) => {
  const logData = {
    type: 'business_event',
    event,
    userId,
    timestamp: new Date().toISOString(),
    ...data
  };
  
  logger.info('Business event', logData);
};

// Log security events
logger.logSecurity = (event, details = {}, level = 'warn') => {
  const logData = {
    type: 'security_event',
    event,
    timestamp: new Date().toISOString(),
    // Sanitize details to prevent logging sensitive data
    ...sanitizeObject(details)
  };

  logger[level]('Security event', logData);
};

// Log authentication events
logger.logAuth = (event, userId, details = {}) => {
  const logData = {
    type: 'auth_event',
    event,
    userId,
    timestamp: new Date().toISOString(),
    ...details
  };
  
  logger.info('Authentication event', logData);
};

// Log chat events specifically
logger.logChat = (event, sessionId, userId, details = {}) => {
  const logData = {
    type: 'chat_event',
    event,
    sessionId,
    userId,
    timestamp: new Date().toISOString(),
    ...details
  };
  
  logger.info('Chat event', logData);
};

// Log performance metrics
logger.logPerformance = (metric, value, context = {}) => {
  const logData = {
    type: 'performance_metric',
    metric,
    value,
    timestamp: new Date().toISOString(),
    ...context
  };
  
  logger.info('Performance metric', logData);
};

module.exports = logger;