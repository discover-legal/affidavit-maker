// server.js 
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const morgan = require('morgan');
const compression = require('compression');

// Load environment variables
require('dotenv').config();

// Import services
const { dbService } = require('./services/DatabaseService');
const { ResilientOpenAIService } = require('./services/ResilientOpenAIService');
const AffidavitService = require('./affidavitService');
const logger = require('./utils/logger');
const EnhancedFactValidationService = require('./services/enhancedFactValidationService');

// Import middleware
const { errorHandler } = require('./middleware/errorMiddleware');

const { responseMiddleware } = require('./utils/responseHelpers'); 

// Initialize Express app
const app = express();

// Request ID middleware 
app.use((req, res, next) => {
  req.id = uuidv4();
  res.setHeader('X-Request-ID', req.id);
  next();
});


// ✅ FIXED: Response helpers middleware (second, before any routes)

app.use(responseMiddleware);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://js.stripe.com", "https://*.auth0.com"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: [
        "'self'", 
        "https://api.openai.com", 
        "https://api.stripe.com", 
        "https://*.auth0.com",
        process.env.NODE_ENV === 'development' ? "ws://localhost:*" : ""
      ].filter(Boolean),
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      frameSrc: ["'self'", "https://js.stripe.com"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"]
    },
  },
  crossOriginEmbedderPolicy: false
}));

// CORS configuration
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? [
        process.env.FRONTEND_URL || 'https://discover.legal',
        'https://discover.legal',
        'https://www.discover.legal'
      ]
    : [
        'http://localhost:3000',
        'http://localhost:3001',
        'http://127.0.0.1:3000'
      ],
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
}));

// Compression middleware
app.use(compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
  threshold: 1024
}));

// Body parsing middleware
app.use(express.json({ 
  limit: '10mb',
  strict: true,
  verify: (req, res, buf) => {
    if (req.path.includes('webhook')) {
      req.rawBody = buf;
    }
  }
}));

app.use(express.urlencoded({ 
  extended: true, 
  limit: '10mb',
  parameterLimit: 100
}));

// Enhanced logging middleware
app.use(morgan((tokens, req, res) => {
  const responseTime = parseInt(tokens['response-time'](req, res));
  
  // Use custom logger
  const logData = {
    method: req.method,
    url: req.originalUrl,
    status: res.statusCode,
    responseTime: `${responseTime}ms`,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user?.id || 'anonymous',
    requestId: req.id
  };
  
  if (responseTime > 1000) {
    logger.warn('Slow request detected', logData);
  } else {
    logger.info('Request processed', logData);
  }
  
  return null; // Don't output to console, we handle it
}, {
  skip: (req, res) => req.path === '/health' || req.path.startsWith('/static')
}));

// Initialize services asynchronously
let affidavitService = null;
let templateManager = null;
let openAIService = null;

async function initializeServices() {
  try {
    // Configuration logging
    console.log('🔧 Configuration loaded:');
    console.log(`  - Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`  - Port: ${process.env.PORT || 3001}`);
    console.log(`  - Auth0 Domain: ${process.env.AUTH0_DOMAIN || 'Not configured'}`);
    console.log(`  - Auth0 Issuer: ${process.env.AUTH0_ISSUER_BASE_URL || 'Not configured'}`);
    console.log(`  - Database: ${process.env.DATABASE_URL ? '✓ Configured' : '❌ Not configured'}`);
    console.log(`  - OpenAI: ${process.env.OPENAI_API_KEY ? '✓ Configured' : '❌ Not configured'}`);
    console.log(`  - Stripe: ${process.env.STRIPE_SECRET_KEY ? '✓ Configured' : '❌ Not configured'}`);

    // Initialize template manager first
    const { StateTemplateManager } = require('./templates/StateTemplateManager');
    templateManager = new StateTemplateManager();
    app.locals.templateManager = templateManager;

    // Initialize OpenAI services
    const OpenAI = require('openai');
    const openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: 45000, // ✅ This is correct - timeout at client level
      maxRetries: 0   // We handle retries in ResilientService
    });

    openAIService = new ResilientOpenAIService(openaiClient, {
      maxRetries: 3,
      initialRetryDelay: 1000,
      chatTimeout: 45000,
      chatThreshold: 5,
      resetTimeout: 120000
    });

    // Make OpenAI service globally available
    global.openAIService = openAIService;

    // Initialize validation service
    const validationService = new EnhancedFactValidationService(
      openaiClient,
      'en',
      100
    );

    // Initialize affidavit service with dependencies
    affidavitService = new AffidavitService(templateManager);

    // Add services to app locals
    app.locals.pool = dbService.pool;
    app.locals.openAIService = openAIService;
    app.locals.affidavitService = affidavitService;
    app.locals.templateManager = templateManager;
    app.locals.enhancedFactValidationService  = validationService;
    app.locals.logger = logger;

    logger.info('✅ All services initialized successfully');
  } catch (error) {
    logger.error('❌ Service initialization failed:', error);
    console.error('❌ Service initialization failed:', error.message);
  }
}
 
// Initialize services immediately
initializeServices();

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    services: {
      database: dbService ? 'OK' : 'Not Connected',
      templates: templateManager ? 'OK' : 'Not Initialized',
      auth: process.env.AUTH0_DOMAIN ? 'OK' : 'Not Configured',
      stripe: process.env.STRIPE_SECRET_KEY ? 'OK' : 'Not Connected',
      openai: openAIService ? 'OK' : 'Not Initialized'
    },
    memory: {
      heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB',
      heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + ' MB'
    },
    uptime: Math.floor(process.uptime()) + ' seconds'
  });
});

// ✅ FIXED: Debug endpoints for development (circuit breaker management)
if (process.env.NODE_ENV === 'development') {
  
  // Reset OpenAI circuit breaker
  app.get('/api/debug/reset-openai', (req, res) => {
    try {
      if (!affidavitService?.openAIService) {
        return res.json({
          success: false,
          error: 'OpenAI service not available'
        });
      }
      
      affidavitService.openAIService.resetCircuitBreakers();
      const status = affidavitService.openAIService.getStatus();
      
      logger.info('Circuit breakers manually reset');
      
      res.json({
        success: true,
        message: 'Circuit breakers reset successfully',
        status: {
          chat: status.circuitBreakers.chat.state,
          embedding: status.circuitBreakers.embedding.state,
          cacheSize: status.cache.size
        }
      });
    } catch (error) {
      logger.error('Failed to reset circuit breakers:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });
  
  // Get OpenAI service status
  app.get('/api/debug/openai-status', (req, res) => {
    try {
      if (!affidavitService?.openAIService) {
        return res.json({
          success: false,
          error: 'OpenAI service not available'
        });
      }
      
      const status = affidavitService.openAIService.getStatus();
      res.json({
        success: true,
        status,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });
  
  // Test OpenAI connection directly
  app.post('/api/debug/test-openai', async (req, res) => {
    try {
      if (!affidavitService?.openAIService) {
        return res.json({
          success: false,
          error: 'OpenAI service not available'
        });
      }
      
      const testResult = await affidavitService.openAIService.chat([
        { role: 'user', content: 'Test connection - respond with just "Connection OK"' }
      ], {
        model: 'gpt-3.5-turbo',
        max_tokens: 10
        // ✅ REMOVED: timeout parameter
      });
      
      res.json({
        success: true,
        message: 'OpenAI connection test successful',
        response: testResult.choices[0].message.content,
        usage: testResult.usage
      });
    } catch (error) {
      logger.error('OpenAI test failed:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        type: error.constructor.name
      });
    }
  });
  
}

// Safe route import function
const safeImportRouter = (routePath, routeName) => {
  try {
    const router = require(routePath);
    if (typeof router === 'function' || (router && typeof router.use === 'function')) {
      logger.info(`✅ ${routeName} routes loaded successfully`);
      return router;
    } else {
      logger.error(`❌ ${routeName} routes: exported value is not a valid router/middleware`);
      return null;
    }
  } catch (err) {
    logger.error(`❌ Failed to load ${routeName} routes:`, { error: err.message });
    return null;
  }
};

// Import and use routes with safety checks
const auth0WebhooksRouter = safeImportRouter('./routes/auth0-webhooks', 'Auth0 Webhooks');
if (auth0WebhooksRouter) {
  app.use('/api/webhooks/auth0', auth0WebhooksRouter);
}

const documentsRouter = safeImportRouter('./routes/documents', 'Documents');
if (documentsRouter) {
  app.use('/api/documents', documentsRouter);
  
  // ✅ FIXED: Elegant preview route alias
  // This allows /api/preview to work while maintaining /api/documents/preview
  app.use('/api/preview', (req, res, next) => {
    // Rewrite the URL to point to the preview endpoint
    req.url = '/preview';
    documentsRouter(req, res, next);
  });
}

// Optional routes with enhanced error handling
const authRouter = safeImportRouter('./routes/auth', 'Auth');
if (authRouter) {
  app.use('/api/auth', authRouter);
}

const chatRouter = safeImportRouter('./routes/chat', 'Chat');
if (chatRouter) {
  app.use('/api/chat', chatRouter);
}

const paymentRouter = safeImportRouter('./routes/payment', 'Payment');
if (paymentRouter) {
  app.use('/api/payment', paymentRouter);
}

const templatesRouter = safeImportRouter('./routes/templates', 'Templates');
if (templatesRouter) {
  app.use('/api/templates', templatesRouter);
}

const validationRouter = safeImportRouter('./routes/validation', 'Validation');
if (validationRouter) {
  app.use('/api/validate', validationRouter);
}

// Basic fallback routes for critical endpoints if files are missing
if (!documentsRouter) {
  app.get('/api/documents', (req, res) => {
    res.status(503).json({ 
      success: false, 
      error: 'Documents service temporarily unavailable' 
    });
  });
  
  // Fallback preview route if documents router failed
  app.post('/api/preview', (req, res) => {
    res.status(503).json({
      success: false,
      error: 'Preview service temporarily unavailable'
    });
  });
}

if (!chatRouter) {
  app.post('/api/chat', (req, res) => {
    res.status(503).json({ 
      success: false, 
      error: 'Chat service temporarily unavailable' 
    });
  });
}

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'client/build')));
  
  // Catch-all route for React SPA
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'client/build', 'index.html'));
  });
}

// 404 handler for unmatched API routes
app.use('/api/*', (req, res) => {
  logger.warn('API endpoint not found', {
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    requestId: req.id
  });

  res.status(404).json({
    success: false,
    error: `Endpoint ${req.method} ${req.path} not found`,
    requestId: req.id,
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware (must be last)
app.use(errorHandler);

// Graceful shutdown handling
const gracefulShutdown = (signal) => {
  console.log(`\n${signal} received. Starting graceful shutdown...`);
  
  // Close server
  server.close(() => {
    console.log('HTTP server closed.');
    
    // Close database connections
    if (dbService) {
      dbService.end().then(() => {
        console.log('Database connections closed.');
        process.exit(0);
      }).catch((err) => {
        console.error('Error closing database:', err);
        process.exit(1);
      });
    } else {
      process.exit(0);
    }
  });
  
  // Force exit after 10 seconds
  setTimeout(() => {
    console.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

// Start server
const PORT = process.env.PORT || 3001;
const server = app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`✅ Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`✅ Health check: http://localhost:${PORT}/health`);
  
  if (process.env.NODE_ENV === 'development') {
    console.log(`🔧 Debug endpoints available:`);
    console.log(`   - Circuit breaker status: http://localhost:${PORT}/api/debug/openai-status`);
    console.log(`   - Reset circuit breaker: http://localhost:${PORT}/api/debug/reset-openai`);
    console.log(`   - Test OpenAI: POST http://localhost:${PORT}/api/debug/test-openai`);
  }
  
  logger.info(`Server started on port ${PORT}`);
});

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Application specific logging, throwing an error, or other logic here
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception thrown:', error);
  // Application specific logging, throwing an error, or other logic here
  process.exit(1);
});

module.exports = app;