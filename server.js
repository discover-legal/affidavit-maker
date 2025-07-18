// server.js - Complete drop-in replacement with county validation
const express = require('express');
const cors = require('cors');
const compression = require('compression');
const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');

// Import configuration
const config = require('./config');

// Import middleware
const { checkJwt, optionalAuth } = require('./middleware/auth');
const { helmetConfig, validationRules, validate, generateCSRFToken, validateCSRFToken, authRateLimit, apiRateLimit } = require('./middleware/securityMiddleware');
const { morganMiddleware, errorLogger, performanceMonitor } = require('./middleware/loggingMiddleware');
const { requestIdMiddleware, errorHandler, notFoundHandler } = require('./middleware/errorMiddleware');

// Import routes
const authRoutes = require('./routes/auth');
const documentRoutes = require('./routes/documents');
const paymentRoutes = require('./routes/payments');
const templateRoutes = require('./routes/templates');
const chatRoutes = require('./routes/chat');

// Import services
const logger = require('./services/logger');
const monitoringService = require('./services/monitoringService');
const { enhancedPdfService } = require('./services/enhancedPdfService');
const AffidavitService = require('./affidavitService');
const CountyValidationService = require('./services/countyValidationService');

// Initialize services
const affidavitService = new AffidavitService(config.openaiApiKey);
const countyValidator = new CountyValidationService(config.openaiApiKey);

const app = express();
const PORT = config.port || 3001;

// Enhanced database connection pool with proper error handling
const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: config.nodeEnv === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Make services available to routes
app.locals.pool = pool;
app.locals.affidavitService = affidavitService;
app.locals.countyValidator = countyValidator;
app.locals.config = config;

// Test database connection
pool.on('connect', () => {
  logger.info('Database connected successfully');
});

pool.on('error', (err) => {
  logger.error('Database connection error:', err);
  monitoringService.trackError(err, { context: 'database_pool' });
});

// Apply middleware in correct order
app.use(compression());
app.use(helmetConfig);
app.use(cors({
  origin: config.nodeEnv === 'production' 
    ? [config.frontendUrl, 'https://affidavit-maker.com', 'https://www.affidavit-maker.com']
    : ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true,
  optionsSuccessStatus: 200
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request tracking
app.use(requestIdMiddleware);
app.use(morganMiddleware);
app.use(performanceMonitor);

// Security middleware
app.use('/api/auth', authRateLimit);
app.use('/api/payment', authRateLimit);
app.use('/api', apiRateLimit);

// Utility function for safe activity logging
async function safeLogActivity(pool, userId, action, resourceType, resourceId, req) {
  try {
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'activity_logs'
      );
    `);
    
    if (!tableCheck.rows[0].exists) {
      logger.info('Activity (table missing):', {
        userId,
        action,
        resourceType,
        resourceId,
        ip: req.ip,
        requestId: req.id
      });
      return;
    }

    await pool.query(
      `INSERT INTO activity_logs (user_id, action, resource_type, resource_id, ip_address, user_agent, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        userId, 
        action, 
        resourceType, 
        resourceId, 
        req.ip, 
        req.get('user-agent'),
        JSON.stringify({ 
          timestamp: new Date().toISOString(),
          requestId: req.id 
        })
      ]
    );
  } catch (error) {
    logger.error('Activity logging failed:', {
      error: error.message,
      code: error.code,
      userId,
      action,
      requestId: req.id
    });
  }
}

// Health check endpoint (no auth required)
app.get('/health', async (req, res) => {
  try {
    const healthCheck = {
      status: 'OK',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: config.nodeEnv,
      services: {}
    };

    // Check database
    try {
      const dbCheck = await pool.query('SELECT NOW()');
      healthCheck.services.database = {
        status: 'healthy',
        timestamp: dbCheck.rows[0].now
      };
    } catch (dbError) {
      healthCheck.services.database = {
        status: 'unhealthy',
        error: dbError.message
      };
      healthCheck.status = 'DEGRADED';
    }

    // Check OpenAI
    healthCheck.services.openai = {
      status: affidavitService.openai ? 'configured' : 'not configured'
    };

    // Check template system
    try {
      const states = affidavitService.getSupportedStates();
      healthCheck.services.templates = {
        status: 'healthy',
        supportedStates: states.length
      };
    } catch (templateError) {
      healthCheck.services.templates = {
        status: 'unhealthy',
        error: templateError.message
      };
    }

    // Check Auth0
    healthCheck.services.auth0 = {
      status: 'configured',
      domain: config.auth0.domain,
      hasClientId: !!config.auth0.clientId
    };

    // Check county validation
    healthCheck.services.countyValidation = {
      status: countyValidator ? 'configured' : 'not configured',
      cacheSize: countyValidator?.cache?.size || 0
    };

    res.status(healthCheck.status === 'OK' ? 200 : 503).json(healthCheck);
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(503).json({
      status: 'ERROR',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// CSRF token endpoint
app.get('/api/csrf-token', (req, res) => {
  const token = generateCSRFToken();
  res.json({ success: true, csrfToken: token });
});

// Mount basic routes first
app.use('/api/templates', templateRoutes);

// County validation endpoints
app.post('/api/validate/county', optionalAuth, async (req, res, next) => {
  try {
    const { county, state } = req.body;
    
    if (!state) {
      return res.status(400).json({
        success: false,
        error: 'State is required for county validation',
        requestId: req.id
      });
    }

    if (!county || county.trim() === '') {
      return res.json({
        success: true,
        validation: {
          isValid: true,
          county: '',
          normalizedCounty: '',
          confidence: 1.0,
          source: 'empty_allowed',
          reasoning: 'Empty county is allowed'
        },
        requestId: req.id
      });
    }

    const validation = await countyValidator.validateCounty(county, state);
    
    res.json({
      success: true,
      validation,
      requestId: req.id
    });

  } catch (error) {
    logger.error('County validation error:', {
      error: error.message,
      county: req.body.county,
      state: req.body.state,
      requestId: req.id
    });
    
    next(error);
  }
});

// Batch county validation endpoint
app.post('/api/validate/counties/batch', optionalAuth, async (req, res, next) => {
  try {
    const { counties, state } = req.body;
    
    if (!state) {
      return res.status(400).json({
        success: false,
        error: 'State is required for county validation',
        requestId: req.id
      });
    }

    if (!Array.isArray(counties)) {
      return res.status(400).json({
        success: false,
        error: 'Counties must be an array',
        requestId: req.id
      });
    }

    if (counties.length > 10) {
      return res.status(400).json({
        success: false,
        error: 'Maximum 10 counties per batch request',
        requestId: req.id
      });
    }

    const validations = await countyValidator.validateMultipleCounties(counties, state);
    
    res.json({
      success: true,
      validations,
      state,
      count: validations.length,
      requestId: req.id
    });

  } catch (error) {
    next(error);
  }
});

// Get common counties for a state (for autocomplete)
app.get('/api/counties/:state', (req, res) => {
  try {
    const { state } = req.params;
    
    if (!['TX', 'UT', 'AZ'].includes(state.toUpperCase())) {
      return res.status(400).json({
        success: false,
        error: 'Invalid state. Must be TX, UT, or AZ',
        requestId: req.id
      });
    }

    const counties = countyValidator.getCommonCounties(state.toUpperCase());
    
    res.json({
      success: true,
      state: state.toUpperCase(),
      counties,
      count: counties.length,
      requestId: req.id
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get counties',
      requestId: req.id
    });
  }
});

// Enhanced preview endpoint with county validation
app.post('/api/preview', optionalAuth, async (req, res, next) => {
  try {
    const { affidavitData } = req.body;
    const userId = req.userId;

    if (!affidavitData) {
      return res.status(400).json({
        success: false,
        error: 'Affidavit data is required',
        requestId: req.id
      });
    }

    if (!affidavitData.state) {
      return res.status(400).json({
        success: false,
        error: 'State is required for preview generation',
        requestId: req.id
      });
    }

    // Validate county if provided
    let countyValidation = null;
    if (affidavitData.county && affidavitData.county.trim()) {
      try {
        countyValidation = await countyValidator.validateCounty(
          affidavitData.county, 
          affidavitData.state
        );
        
        logger.info('County validation performed', {
          county: affidavitData.county,
          state: affidavitData.state,
          isValid: countyValidation.isValid,
          confidence: countyValidation.confidence,
          source: countyValidation.source,
          requestId: req.id
        });
      } catch (error) {
        logger.warn('County validation failed, proceeding anyway:', {
          error: error.message,
          county: affidavitData.county,
          state: affidavitData.state,
          requestId: req.id
        });
      }
    }

    const preview = affidavitService.generatePreview(affidavitData, true);
    
    // Add county validation to the response
    const response = {
      ...preview,
      countyValidation,
      requestId: req.id
    };

    // Safe activity logging
    if (userId && req.user) {
      await safeLogActivity(
        pool, 
        req.user.id, 
        'preview_generated', 
        'document', 
        affidavitData.documentId, 
        req
      );
    }
    
    res.json(response);

  } catch (error) {
    console.error('Preview generation error:', error);
    next(error);
  }
});

// GET /api/preview - Fallback for GET requests
app.get('/api/preview', (req, res) => {
  res.status(405).json({
    success: false,
    error: 'Method not allowed. Use POST with affidavit data.',
    method: 'POST',
    expectedBody: {
      affidavitData: {
        state: 'TX|UT|AZ',
        affiantName: 'string (optional)',
        facts: ['array of strings (optional)'],
        county: 'string (optional)',
        caseNumber: 'string (optional)'
      }
    },
    requestId: req.id
  });
});

// Sample preview endpoint
app.get('/api/preview/sample/:state', async (req, res, next) => {
  try {
    const { state } = req.params;
    
    if (!['TX', 'UT', 'AZ'].includes(state.toUpperCase())) {
      return res.status(400).json({
        success: false,
        error: 'Invalid state. Must be TX, UT, or AZ',
        requestId: req.id
      });
    }

    const sampleData = {
      state: state.toUpperCase(),
      documentType: 'general',
      affiantName: 'Sample User',
      county: state === 'TX' ? 'Travis' : state === 'UT' ? 'Salt Lake' : undefined,
      facts: [
        'This is a sample fact for demonstration purposes.',
        'The information provided here is for preview only.'
      ]
    };

    const preview = affidavitService.generatePreview(sampleData, true);
    
    res.json({
      ...preview,
      sample: true,
      note: 'This is a sample preview for demonstration purposes'
    });

  } catch (error) {
    next(error);
  }
});

// Mount authenticated routes
app.use('/api/auth', authRoutes);
app.use('/api/documents', checkJwt, documentRoutes);
app.use('/api/payment', checkJwt, paymentRoutes);
app.use('/api/chat', checkJwt, chatRoutes);

// Webhook endpoints (no auth)
app.post('/api/webhooks/stripe', express.raw({type: 'application/json'}), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  
  try {
    const stripe = require('stripe')(config.stripeSecretKey);
    const event = stripe.webhooks.constructEvent(req.body, sig, config.stripeWebhookSecret);
    
    // Handle the event
    switch (event.type) {
      case 'payment_intent.succeeded':
        const paymentIntent = event.data.object;
        logger.info('Payment succeeded:', { paymentIntentId: paymentIntent.id });
        break;
      case 'payment_intent.payment_failed':
        const failedPayment = event.data.object;
        logger.warn('Payment failed:', { paymentIntentId: failedPayment.id });
        break;
      default:
        logger.info(`Unhandled webhook event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (err) {
    logger.error('Webhook signature verification failed:', err);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
});

// Error handling middleware (must be last)
app.use(errorLogger);
app.use(notFoundHandler);
app.use(errorHandler);

// Graceful shutdown
const gracefulShutdown = async (signal) => {
  logger.info(`${signal} received, starting graceful shutdown`);
  
  // Stop accepting new connections
  server.close(() => {
    logger.info('HTTP server closed');
  });

  try {
    // Close database connections
    await pool.end();
    logger.info('Database pool closed');
    
    // Close PDF service if available
    if (enhancedPdfService && enhancedPdfService.cleanup) {
      await enhancedPdfService.cleanup();
      logger.info('PDF service cleaned up');
    }
    
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown:', error);
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', { promise, reason });
});

// Start server
const server = app.listen(PORT, () => {
  logger.info(`🚀 Server running on port ${PORT}`);
  logger.info(`📍 Environment: ${config.nodeEnv}`);
  logger.info(`🔐 Auth0 Domain: ${config.auth0.domain}`);
  
  try {
    const states = affidavitService.getSupportedStates();
    const docTypes = affidavitService.getSupportedDocumentTypes();
    logger.info(`🗺️  Supported states: ${states.map(s => s.name).join(', ')}`);
    logger.info(`📄 Document types: ${docTypes.join(', ')}`);
    logger.info(`🏛️  County validation: ${countyValidator ? 'enabled' : 'disabled'}`);
  } catch (e) {
    logger.warn('⚠️  Template system not fully configured');
  }
  
  logger.info(`🔗 Health check: http://localhost:${PORT}/health`);
  logger.info(`📍 County validation: http://localhost:${PORT}/api/validate/county`);
});

module.exports = app;