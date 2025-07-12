// services/logger.js
const winston = require('winston');
const path = require('path');

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

// Tell winston about the colors
winston.addColors(colors);

// Define format for logs
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`,
  ),
);

// Define transports
const transports = [
  // Console transport
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple(),
    ),
  }),
  // Error file transport
  new winston.transports.File({
    filename: path.join(__dirname, '../logs/error.log'),
    level: 'error',
    format: winston.format.combine(
      winston.format.uncolorize(),
      winston.format.json(),
    ),
  }),
  // Combined file transport
  new winston.transports.File({
    filename: path.join(__dirname, '../logs/combined.log'),
    format: winston.format.combine(
      winston.format.uncolorize(),
      winston.format.json(),
    ),
  }),
];

// Create the logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  levels,
  format,
  transports,
  exitOnError: false,
});

// Create a stream object for Morgan middleware
logger.stream = {
  write: (message) => logger.http(message.trim()),
};

// Helper functions for structured logging
logger.logError = (error, context = {}) => {
  logger.error({
    message: error.message,
    stack: error.stack,
    ...context,
    timestamp: new Date().toISOString(),
  });
};

logger.logAPIRequest = (req, res, responseTime) => {
  logger.info({
    method: req.method,
    url: req.url,
    status: res.statusCode,
    responseTime: `${responseTime}ms`,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    userId: req.userId || 'anonymous',
  });
};

logger.logDatabaseQuery = (query, params, duration) => {
  logger.debug({
    type: 'database',
    query: query.substring(0, 100), // Truncate long queries
    paramCount: params?.length || 0,
    duration: `${duration}ms`,
  });
};

logger.logAIInteraction = (prompt, response, model, duration) => {
  logger.info({
    type: 'ai_interaction',
    model,
    promptLength: prompt.length,
    responseLength: response.length,
    duration: `${duration}ms`,
    timestamp: new Date().toISOString(),
  });
};

module.exports = logger;