// middleware/loggingMiddleware.js
const morgan = require('morgan');
const logger = require('../services/logger');

// Custom morgan token for user ID
morgan.token('user-id', (req) => req.userId || 'anonymous');

// Custom morgan token for response time in ms
morgan.token('response-time-ms', (req, res) => {
  if (!req._startAt || !res._startAt) {
    return '';
  }
  const ms = (res._startAt[0] - req._startAt[0]) * 1000 +
    (res._startAt[1] - req._startAt[1]) / 1000000;
  return ms.toFixed(3);
});

// Define custom format
const customFormat = ':method :url :status :response-time-ms ms - :user-id - :remote-addr';

// Create morgan middleware
const morganMiddleware = morgan(customFormat, {
  stream: logger.stream,
  skip: (req, res) => {
    // Skip logging for health checks
    return req.url === '/health';
  },
});

// Error logging middleware
const errorLogger = (err, req, res, next) => {
  logger.logError(err, {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userId: req.userId,
  });
  next(err);
};

// Performance monitoring middleware
const performanceMonitor = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    
    // Log slow requests (over 1 second)
    if (duration > 1000) {
      logger.warn({
        message: 'Slow request detected',
        method: req.method,
        url: req.url,
        duration: `${duration}ms`,
        userId: req.userId,
      });
    }
  });
  
  next();
};

module.exports = {
  morganMiddleware,
  errorLogger,
  performanceMonitor,
};