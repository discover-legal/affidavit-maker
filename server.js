// server.js
/**
 * Enhanced Express Server with All High/Medium Priority Improvements
 * Integrates all new middleware and services
 * 
 * @version 3.0.0
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const winston = require('winston');
const morgan = require('morgan');

// Load environment variables
require('dotenv').config();

// Import new services and middleware
const { DatabaseService } = require('./services/DatabaseService');
const { ResilientOpenAIService } = require('./services/ResilientOpenAIService');
const EnhancedFactValidationService = require('./services/EnhancedFactValidationService');
const {
  createCachingMiddleware,
  createCacheInvalidationMiddleware,
  createMonitoringMiddleware,
  createCompressionMiddleware
} = require('./middleware/cachingMiddleware');
const {
  createUserTierRateLimiter,
  createRouteRateLimiter,
  createStatsMiddleware,
  DynamicRateLimiter
} = require('./middleware/rateLimitingMiddleware');

// Initialize Express app
const app = express();

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

// Initialize Database Service with optimized pooling
const dbService = DatabaseService.getInstance({
  connectionString: process.env.DATABASE_URL,
  max: parseInt(process.env.DATABASE_POOL_MAX || '20'),
  min: parseInt(process.env.DATABASE_POOL_MIN || '2'),
  cacheMaxSize: 100,
  cacheTTL: 60000
});

// Initialize OpenAI with Circuit Breaker
const openai = require('openai');
const openaiClient = new openai.OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const resilientOpenAI = new ResilientOpenAIService(openaiClient, {
  chatThreshold: 5,
  chatTimeout: 30000,
  resetTimeout: 120000,
  maxRetries: 3,
  cacheMaxSize: 100,
  cacheTTL: 300000
});

// Initialize Enhanced Validation Service
const validationService = new EnhancedFactValidationService(
  resilientOpenAI,
  'en',
  100 // cache size
);

// Initialize AffidavitService with resilient services
const AffidavitService = require('./affidavitService');
const affidavitService = new AffidavitService({
  openai: resilientOpenAI,
  database: dbService,
  validation: validationService,
  logger
});

// Import existing middleware
const { 
  requestIdMiddleware, 
  errorHandler, 
  asyncHandler,
  ValidationError,
  AuthenticationError 
} = require('./middleware/errorMiddleware');
const { auth0Middleware, optionalAuth0Middleware } = require('./middleware/auth0Middleware');
const { body, validationResult } = require('express-validator');

// === MIDDLEWARE SETUP ===

// Basic security and parsing
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", 'https://cdn.auth0.com'],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
    }
  }
}));

app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true
}));

// Enhanced compression
app.use(createCompressionMiddleware({
  level: 6,
  threshold: 1024
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request ID for tracking
app.use(requestIdMiddleware);

// Logging
app.use(morgan('combined', {
  stream: { write: message => logger.info(message.trim()) }
}));

// === MONITORING & CACHING ===

// Create monitoring middleware
const monitoringMiddleware = createMonitoringMiddleware({
  maxMetrics: 1000,
  slowThreshold: 1000
});
app.use(monitoringMiddleware);

// Create caching middleware
const cachingMiddleware = createCachingMiddleware({
  maxSize: 100,
  defaultTTL: 60000,
  cacheNonGet: false
});
app.use(cachingMiddleware);

// Cache invalidation for write operations
const cacheInvalidation = createCacheInvalidationMiddleware(cachingMiddleware.cache);
app.use(cacheInvalidation);

// === RATE LIMITING ===

// Stats collection for rate limiting
app.use(createStatsMiddleware());

// Dynamic rate limiting based on system load
const dynamicRateLimiter = new DynamicRateLimiter();
app.use(dynamicRateLimiter.createMiddleware());

// User tier rate limiting
app.use(createUserTierRateLimiter());

// === HEALTH & MONITORING ENDPOINTS ===

app.get('/health', asyncHandler(async (req, res) => {
  const dbHealth = await dbService.testConnection().catch(() => false);
  const openaiStatus = resilientOpenAI.getStatus();
  const dbStats = dbService.getStats();
  
  const health = {
    status: dbHealth ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    services: {
      database: {
        connected: dbHealth,
        ...dbStats
      },
      openai: openaiStatus,
      cache: cachingMiddleware.cache?.getStats?.() || {}
    },
    memory: process.memoryUsage(),
    cpu: process.cpuUsage()
  };
  
  res.status(dbHealth ? 200 : 503).json(health);
}));

app.get('/metrics', auth0Middleware, asyncHandler(async (req, res) => {
  const metrics = {
    monitoring: monitoringMiddleware.getMetrics(),
    database: dbService.getStats(),
    openai: resilientOpenAI.getStatus(),
    cache: cachingMiddleware.cache?.getStats?.() || {},
    rateLimit: require('./middleware/rateLimitingMiddleware').getStats(),
    timestamp: new Date().toISOString()
  };
  
  res.json(metrics);
}));

// === API ROUTES ===

// Public endpoints
app.get('/api/templates/states', asyncHandler(async (req, res) => {
  const states = await dbService.select('state_templates', {}, {
    columns: 'state_code, state_name, requirements',
    cache: true
  });
  res.json({ success: true, states });
}));

// Chat endpoint with route-specific rate limiting
app.post('/api/chat',
  optionalAuth0Middleware,
  createRouteRateLimiter('/api/chat'),
  [
    body('message').notEmpty().isLength({ max: 5000 }),
    body('conversationHistory').optional().isArray()
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError('Invalid input', errors.array());
    }
    
    const { message, conversationHistory } = req.body;
    
    const result = await resilientOpenAI.processMessage(
      message,
      conversationHistory,
      { userId: req.user?.sub }
    );
    
    res.json(result);
  })
);

// Document generation with enhanced validation
app.post('/api/generate-affidavit',
  auth0Middleware,
  createRouteRateLimiter('/api/generate-affidavit'),
  [
    body('affidavitData').isObject(),
    body('affidavitData.facts').isArray().notEmpty()
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError('Invalid document data', errors.array());
    }
    
    const { affidavitData } = req.body;
    
    // Validate facts with enhanced service
    const validationResult = await validationService.validateFactsBatchProfessional(
      affidavitData.facts,
      {
        state: affidavitData.state,
        documentType: 'affidavit',
        affiantName: affidavitData.affiantName
      }
    );
    
    if (!validationResult.isValid && validationResult.criticalIssues > 0) {
      return res.status(400).json({
        success: false,
        error: 'Document contains critical validation issues',
        validation: validationResult
      });
    }
    
    // Generate document
    const result = await affidavitService.generateDocument(affidavitData, req.user);
    
    // Save to database using optimized service
    const document = await dbService.insert('documents', {
      user_id: req.user.sub,
      content: JSON.stringify(affidavitData),
      validation_results: JSON.stringify(validationResult),
      status: 'generated',
      created_at: new Date()
    });
    
    res.json({
      success: true,
      documentId: document.id,
      validation: validationResult,
      ...result
    });
  })
);

// Save draft with auto-retry
app.post('/api/save-draft',
  auth0Middleware,
  asyncHandler(async (req, res) => {
    const { affidavitData } = req.body;
    
    // Use transaction for data consistency
    const result = await dbService.transaction(async (client) => {
      // Check for existing draft
      const existing = await client.query(
        'SELECT id FROM documents WHERE user_id = $1 AND status = $2 ORDER BY created_at DESC LIMIT 1',
        [req.user.sub, 'draft']
      );
      
      if (existing.rows.length > 0) {
        // Update existing draft
        const updated = await client.query(
          'UPDATE documents SET content = $1, updated_at = $2 WHERE id = $3 RETURNING *',
          [JSON.stringify(affidavitData), new Date(), existing.rows[0].id]
        );
        return updated.rows[0];
      } else {
        // Create new draft
        const created = await client.query(
          'INSERT INTO documents (user_id, content, status, created_at) VALUES ($1, $2, $3, $4) RETURNING *',
          [req.user.sub, JSON.stringify(affidavitData), 'draft', new Date()]
        );
        return created.rows[0];
      }
    });
    
    res.json({
      success: true,
      documentId: result.id,
      savedAt: result.updated_at || result.created_at
    });
  })
);

// Get user documents with caching
app.get('/api/documents',
  auth0Middleware,
  asyncHandler(async (req, res) => {
    const { status, limit = 10, offset = 0 } = req.query;
    
    const conditions = { user_id: req.user.sub };
    if (status) conditions.status = status;
    
    const documents = await dbService.select('documents', conditions, {
      columns: 'id, status, created_at, updated_at',
      orderBy: 'created_at DESC',
      limit: parseInt(limit),
      offset: parseInt(offset),
      cache: true
    });
    
    res.json({
      success: true,
      documents,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });
  })
);

// === STATIC FILES ===

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'client/build')));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'client/build', 'index.html'));
  });
}

// === ERROR HANDLING ===

app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'The requested resource was not found',
    path: req.path
  });
});

app.use(errorHandler);

// === GRACEFUL SHUTDOWN ===

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

async function gracefulShutdown(signal) {
  logger.info(`${signal} received, starting graceful shutdown`);
  
  // Stop accepting new requests
  server.close(() => {
    logger.info('HTTP server closed');
  });
  
  // Close database connections
  await dbService.close();
  logger.info('Database connections closed');
  
  // Clean up services
  validationService.destroy();
  
  // Force shutdown after 10 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
  
  process.exit(0);
}

// === START SERVER ===

const PORT = process.env.PORT || 3001;
const server = app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info('Database pool initialized');
  logger.info('OpenAI circuit breaker active');
  logger.info('Enhanced validation service ready');
  logger.info('All middleware loaded successfully');
});

// Export for testing
module.exports = { app, server, dbService, resilientOpenAI };