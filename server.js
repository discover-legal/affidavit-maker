// server.js - Fixed version with proper Auth0 configuration and error handling
const express = require('express');
const cors = require('cors');
const compression = require('compression');
const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');

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

// Initialize services
const affidavitService = new AffidavitService(config.openaiApiKey);

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

// Make pool available to routes
app.locals.pool = pool;
app.locals.affidavitService = affidavitService;
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

// Mount routes
app.use('/api/templates', templateRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/documents', checkJwt, documentRoutes);
app.use('/api/payment', checkJwt, paymentRoutes);
app.use('/api/chat', checkJwt, chatRoutes);

// Special routes that don't fit into categories
app.post('/api/preview', optionalAuth, validationRules.preview, validate, async (req, res, next) => {
  try {
    const { affidavitData } = req.body;
    const userId = req.userId;

    if (!affidavitData) {
      return res.status(400).json({
        success: false,
        error: 'Affidavit data is required'
      });
    }

    if (!affidavitData.state) {
      return res.status(400).json({
        success: false,
        error: 'State is required for preview generation'
      });
    }

    const preview = affidavitService.generatePreview(affidavitData, true);
    
    // Log activity if user is logged in
    if (userId && req.user) {
      await logActivity(req.user.id, 'preview_generated', 'document', affidavitData.documentId, req);
    }
    
    res.json(preview);

  } catch (error) {
    next(error);
  }
});

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
        // Additional handling if needed
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

// Utility function for activity logging
async function logActivity(userId, action, resourceType, resourceId, req) {
  try {
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
    logger.error('Activity logging failed:', { error: error.message, userId, action });
  }
}

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
  } catch (e) {
    logger.warn('⚠️  Template system not fully configured');
  }
  
  logger.info(`🔗 Health check: http://localhost:${PORT}/health`);
});

module.exports = app;