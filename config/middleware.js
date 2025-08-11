// config/middleware.js - Middleware Configuration
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const timeout = require('connect-timeout');
const { v4: uuidv4 } = require('uuid');

const logger = require('../utils/logger');
const { responseMiddleware } = require('../utils/responseHelpers');
const { standardLimiter } = require('../middleware/rateLimiting');

/**
 * Request ID middleware - adds unique ID to each request
 */
const requestIdMiddleware = (req, res, next) => {
  req.id = uuidv4();
  res.setHeader('X-Request-ID', req.id);
  next();
};

/**
 * Request timeout middleware with custom handler
 */
const timeoutMiddleware = timeout('30s');

const haltOnTimedout = (req, res, next) => {
  if (!req.timedout) next();
};

/**
 * Enhanced logging middleware using Morgan + Winston
 */
const loggingMiddleware = morgan((tokens, req, res) => {
  const responseTime = parseInt(tokens['response-time'](req, res));
  
  // Use our custom logger instead of default Morgan output
  logger.logRequest(req, res, responseTime);
  
  return null; // Don't output to console, we handle it in logger
}, {
  skip: (req, res) => {
    // Skip logging for health checks and static assets
    return req.path === '/health' || req.path.startsWith('/static');
  }
});

/**
 * Security middleware configuration
 */
const securityMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: [
        "'self'", 
        "'unsafe-inline'", 
        "https://fonts.googleapis.com",
        "https://cdn.jsdelivr.net"
      ],
      scriptSrc: [
        "'self'", 
        "'unsafe-inline'", 
        "'unsafe-eval'",
        "https://js.stripe.com",
        "https://*.auth0.com"
      ],
      imgSrc: [
        "'self'", 
        "data:", 
        "https:",
        "blob:"
      ],
      connectSrc: [
        "'self'", 
        "https://api.openai.com", 
        "https://api.stripe.com", 
        "https://*.auth0.com",
        process.env.NODE_ENV === 'development' ? "ws://localhost:*" : ""
      ].filter(Boolean),
      fontSrc: [
        "'self'", 
        "https://fonts.gstatic.com"
      ],
      frameSrc: [
        "'self'", 
        "https://js.stripe.com"
      ],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null
    },
  },
  crossOriginEmbedderPolicy: false,
  // Additional security headers
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
});

/**
 * CORS configuration with environment-specific origins
 */
const corsMiddleware = cors({
  origin: (origin, callback) => {
    const allowedOrigins = process.env.NODE_ENV === 'production' 
      ? [
          process.env.FRONTEND_URL || 'https://discover.legal',
          'https://discover.legal',
          'https://www.discover.legal'
        ]
      : [
          'http://localhost:3000',
          'http://localhost:3001',
          'http://127.0.0.1:3000'
        ];

    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      logger.logSecurity('cors_blocked', {
        origin,
        allowedOrigins
      });
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'X-Request-ID',
    'Cache-Control',
    'Pragma',
    'Expires'
  ]
});

/**
 * Compression middleware with customization
 */
const compressionMiddleware = compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
  threshold: 1024, // Only compress responses > 1KB
  level: 6 // Balance between compression ratio and speed
});

/**
 * Body parsing middleware with security
 */
const bodyParsingMiddleware = [
  express.json({ 
    limit: '10mb',
    strict: true,
    verify: (req, res, buf) => {
      // Store raw body for webhook verification if needed
      if (req.path.includes('webhook')) {
        req.rawBody = buf;
      }
    }
  }),
  express.urlencoded({ 
    extended: true, 
    limit: '10mb',
    parameterLimit: 100 // Prevent parameter pollution
  })
];

/**
 * Request size monitoring middleware
 */
const requestSizeMiddleware = (req, res, next) => {
  const contentLength = parseInt(req.get('content-length') || '0');
  
  if (contentLength > 0) {
    logger.logPerformance('request_size', contentLength, {
      path: req.path,
      method: req.method,
      contentType: req.get('content-type')
    });
    
    // Warn about large requests
    if (contentLength > 5 * 1024 * 1024) { // 5MB
      logger.warn('Large request detected', {
        size: contentLength,
        path: req.path,
        userId: req.user?.id,
        ip: req.ip
      });
    }
  }
  
  next();
};

/**
 * User context middleware - attaches user info from auth
 */
const userContextMiddleware = (req, res, next) => {
  // This will be populated by auth middleware
  if (req.user) {
    req.userId = req.user.id;
    
    // Add user info to logger context for all subsequent logs
    const originalJson = res.json.bind(res);
    res.json = function(data) {
      // Add user context to response logging if needed
      return originalJson(data);
    };
  }
  
  next();
};

/**
 * Error handling for timeouts
 */
const timeoutErrorHandler = (req, res, next) => {
  if (req.timedout) {
    logger.warn('Request timeout', {
      path: req.path,
      method: req.method,
      userId: req.user?.id,
      ip: req.ip
    });
    
    return res.status(408).json({
      success: false,
      error: 'Request timeout. Please try again.',
      errorType: 'timeout_error',
      timestamp: new Date().toISOString()
    });
  }
  next();
};

/**
 * API versioning middleware
 */
const versioningMiddleware = (req, res, next) => {
  // Extract version from header or URL
  const version = req.get('API-Version') || 'v1';
  req.apiVersion = version;
  
  // Set response header
  res.setHeader('API-Version', version);
  
  next();
};

/**
 * Health check bypass middleware - skip heavy middleware for health checks
 */
const healthCheckBypass = (req, res, next) => {
  if (req.path === '/health' || req.path === '/ping') {
    // Skip rate limiting and other heavy middleware for health checks
    req.skipMiddleware = true;
  }
  next();
};

/**
 * Apply all middleware in the correct order
 */
const applyMiddleware = (app) => {
  // Order is important! Apply middleware in the right sequence
  
  // 1. Essential middleware that should run first
  app.use(healthCheckBypass);
  app.use(requestIdMiddleware);
  app.use(responseMiddleware);
  
  // 2. Security and parsing
  app.use(securityMiddleware);
  app.use(corsMiddleware);
  app.use(compressionMiddleware);
  
  // 3. Request processing
  app.use(timeoutMiddleware);
  app.use(haltOnTimedout);
  app.use(requestSizeMiddleware);
  app.use(...bodyParsingMiddleware);
  
  // 4. Logging and monitoring
  app.use(loggingMiddleware);
  app.use(versioningMiddleware);
  
  // 5. Rate limiting (after logging, before auth)
  app.use((req, res, next) => {
    if (req.skipMiddleware) return next();
    standardLimiter(req, res, next);
  });
  
  // 6. User context (after auth middleware is applied in routes)
  app.use(userContextMiddleware);
  
  // 7. Timeout error handling
  app.use(timeoutErrorHandler);
  
  logger.info('All middleware applied successfully');
};

module.exports = {
  applyMiddleware,
  requestIdMiddleware,
  timeoutMiddleware,
  haltOnTimedout,
  loggingMiddleware,
  securityMiddleware,
  corsMiddleware,
  compressionMiddleware,
  bodyParsingMiddleware,
  requestSizeMiddleware,
  userContextMiddleware,
  timeoutErrorHandler,
  versioningMiddleware,
  healthCheckBypass
};