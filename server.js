// server.js - COMPLETE DROP-IN REPLACEMENT with PDFService
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
const AffidavitService = require('./services/affidavitService');
const logger = require('./utils/logger');
const EnhancedFactValidationService = require('./services/enhancedFactValidationService');

// Import middleware
const { errorHandler } = require('./middleware/errorMiddleware');
const { responseMiddleware } = require('./utils/responseHelpers');
const { cleanupDbClient } = require('./middleware/auth0Middleware'); 

// Initialize Express app
const app = express();

// Trust proxy - required for correct IP detection behind reverse proxies/load balancers
// This enables express-rate-limit and other middleware to correctly identify users
// Set to 1 to trust the first proxy (cloud platform load balancer)
app.set('trust proxy', 1);

// Request ID middleware 
app.use((req, res, next) => {
  req.id = uuidv4();
  res.setHeader('X-Request-ID', req.id);
  next();
});

// ✅ FIXED: Response helpers middleware (second, before any routes)
app.use(responseMiddleware);

// ✅ NEW: Database client cleanup middleware
// Ensures database connections are properly released after each request
app.use(cleanupDbClient);

// WWW to non-WWW redirect middleware
// Redirects www.discover.legal → discover.legal to eliminate duplicate content
app.use((req, res, next) => {
  const host = req.get('host');

  if (host && host.startsWith('www.')) {
    const newHost = host.replace(/^www\./, '');

    // In production, always use HTTPS (cloud platforms terminate SSL at load balancer)
    // In development, use the detected protocol from Express (trust proxy handles X-Forwarded-Proto)
    const protocol = process.env.NODE_ENV === 'production' ? 'https' : req.protocol;

    return res.redirect(301, `${protocol}://${newHost}${req.originalUrl}`);
  }

  next();
});

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      // IMPORTANT: 'unsafe-inline' needed for DocumentPreview component's CSS-in-JS styling
      // The preview uses inline <style> tags and style attributes for WYSIWYG rendering
      styleSrc: [
        "'self'",
        "https://fonts.googleapis.com",
        "'unsafe-inline'"
      ],
      // SECURITY: 'unsafe-eval' needed for Google Analytics gtag.js library
      // The gtag library uses Function() constructor internally for performance
      scriptSrc: [
        "'self'",
        "https://js.stripe.com",
        "https://*.auth0.com",
        "https://www.googletagmanager.com",
        "https://www.google-analytics.com",
        "'unsafe-eval'", // Required for gtag.js
        ...(process.env.NODE_ENV === 'development' ? ["'unsafe-inline'"] : [])
      ],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: [
        "'self'",
        "https://api.openai.com",
        "https://api.stripe.com",
        "https://*.auth0.com",
        "https://www.google-analytics.com",
        "https://www.googletagmanager.com",
        "https://analytics.google.com",
        "https://affidavit-maker.onrender.com",
        "https://discover.legal",
        "https://www.discover.legal",
        // Dynamically include FRONTEND_URL so staging/other deployments work
        process.env.FRONTEND_URL && process.env.FRONTEND_URL.trim()
          ? process.env.FRONTEND_URL.trim()
          : "",
        process.env.NODE_ENV === 'development' ? "ws://localhost:*" : ""
      ].filter(Boolean),
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      frameSrc: ["'self'", "https://js.stripe.com", "https://*.auth0.com"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"]
    },
  },
  // Additional security headers
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  },
  frameguard: { action: 'deny' },
  noSniff: true,
  xssFilter: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  // SECURITY: Add Permissions-Policy to restrict browser APIs (MED-03)
  permissionsPolicy: {
    features: {
      camera: [],
      microphone: [],
      geolocation: [],
      payment: ["'self'"],
      usb: [],
      magnetometer: [],
      gyroscope: [],
      accelerometer: []
    }
  }
}));

// SECURITY: Global request timeout to prevent Slowloris attacks (HIGH-04)
// Chat/LLM routes need longer timeouts (handled by their own middleware)
const requestTimeout = require('connect-timeout');
app.use((req, res, next) => {
  // Skip global timeout for chat routes — they have their own 60s timeout
  if (req.path.startsWith('/api/chat')) {
    return next();
  }
  requestTimeout('30s')(req, res, next);
});
app.use((req, res, next) => {
  if (!req.timedout) next();
});

// CORS configuration
// Helper to normalize origin URL (remove trailing slash)
const normalizeOrigin = (origin) => {
  if (!origin) return null;
  return origin.replace(/\/$/, '');
};

// Build allowed origins list
const getAllowedOrigins = () => {
  const origins = [];

  // Production domains
  origins.push(
    'https://discover.legal',
    'https://www.discover.legal',
    'https://ca.discover.legal',
    'https://canada.discover.legal'
  );

  // Add FRONTEND_URL if set (normalized)
  if (process.env.FRONTEND_URL && process.env.FRONTEND_URL.trim()) {
    origins.push(normalizeOrigin(process.env.FRONTEND_URL.trim()));
  }

  // Always include localhost for development (safe - these don't resolve in production)
  if (process.env.NODE_ENV !== 'production' || !process.env.FRONTEND_URL) {
    origins.push(
      'http://localhost:3000',
      'http://localhost:3001',
      'http://127.0.0.1:3000',
      'http://ca.localhost:3000',
      'http://canada.localhost:3000'
    );
  }

  // Remove duplicates
  const uniqueOrigins = [...new Set(origins)];

  logger.info('CORS allowed origins:', { origins: uniqueOrigins, nodeEnv: process.env.NODE_ENV });
  return uniqueOrigins;
};

const allowedOrigins = getAllowedOrigins();

app.use(cors({
  origin: (origin, callback) => {
    // SECURITY: Allow requests without Origin header
    // These are typically same-origin requests, health checks, or server-to-server calls
    // The Origin header is sent by browsers for cross-origin requests
    // Blocking requests without Origin breaks legitimate use cases like:
    // - Health checks and monitoring
    // - Same-origin browser requests
    // - Server-to-server API calls
    if (!origin) {
      return callback(null, true);
    }

    const normalizedOrigin = normalizeOrigin(origin);

    if (allowedOrigins.includes(normalizedOrigin)) {
      callback(null, true);
    } else {
      logger.warn('CORS blocked origin', {
        origin,
        normalizedOrigin,
        allowedOrigins,
        nodeEnv: process.env.NODE_ENV
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
let pdfService = null; // ✅ NEW

async function initializeServices() {
  try {
    // SECURITY: Validate required environment variables
    const REQUIRED_ENV_VARS = {
      production: [
        'DATABASE_URL',
        'AUTH0_DOMAIN',
        'AUTH0_ISSUER_BASE_URL',
        'AUTH0_AUDIENCE',
        'OPENAI_API_KEY',
        'STRIPE_SECRET_KEY',
        'STRIPE_WEBHOOK_SECRET',
        'AUTH0_WEBHOOK_SECRET'
      ],
      development: [
        'DATABASE_URL',
        'AUTH0_DOMAIN',
        'AUTH0_ISSUER_BASE_URL',
        'AUTH0_AUDIENCE'
      ]
    };

    const requiredVars = process.env.NODE_ENV === 'production'
      ? REQUIRED_ENV_VARS.production
      : REQUIRED_ENV_VARS.development;

    const missingVars = requiredVars.filter(varName => {
      const value = process.env[varName];
      return !value || value.trim() === '';
    });

    if (missingVars.length > 0) {
      logger.error('❌ Missing required environment variables:', {
        missing: missingVars,
        environment: process.env.NODE_ENV || 'development'
      });
      console.error('\n❌ ERROR: Missing required environment variables:');
      missingVars.forEach(varName => console.error(`   - ${varName}`));
      console.error('\nPlease set these variables in your .env file or environment.\n');
      process.exit(1);
    }

    logger.info('✅ All required environment variables configured');

    // Configuration logging (non-sensitive values only)
    console.log('🔧 Configuration loaded:');
    console.log(`  - Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`  - Port: ${process.env.PORT || 3001}`);
    console.log(`  - Auth0 Domain: ${process.env.AUTH0_DOMAIN || 'Not configured'}`);
    console.log(`  - Auth0 Issuer: ${process.env.AUTH0_ISSUER_BASE_URL || 'Not configured'}`);
    console.log(`  - Database: ${process.env.DATABASE_URL ? '✓ Configured' : '❌ Not configured'}`);
    console.log(`  - OpenAI: ${process.env.OPENAI_API_KEY ? '✓ Configured' : '❌ Not configured'}`);
    console.log(`  - Stripe: ${process.env.STRIPE_SECRET_KEY ? '✓ Configured' : '❌ Not configured'}`);

    // Initialize template manager
    // Feature flag to switch between old and new template system
    const useNewTemplateSystem = process.env.USE_NEW_TEMPLATE_SYSTEM !== 'false';

    if (useNewTemplateSystem) {
      logger.info('Using new template system (auto-discovery)');
      const { initializeTemplates } = require('./templates/initialize');
      templateManager = await initializeTemplates();
    } else {
      logger.info('Using legacy template system');
      const { StateTemplateManager } = require('./templates/StateTemplateManager');
      templateManager = new StateTemplateManager();
    }

    app.locals.templateManager = templateManager;
    logger.info('✅ Template Manager initialized');

    // ✅ NEW: Initialize PDF Service
    const PDFService = require('./services/pdfService');
    pdfService = new PDFService();
    app.locals.pdfService = pdfService;
    logger.info('✅ PDF Service initialized');

    // Initialize Multi-Provider LLM Client
    const MultiProviderLLM = require('./services/MultiProviderLLM');
    const llmClient = new MultiProviderLLM();

    // Log provider info
    const providerInfo = llmClient.getProviderInfo();
    logger.info('✅ LLM Provider ready', providerInfo);

    openAIService = new ResilientOpenAIService(llmClient, {
      maxRetries: 3,
      initialRetryDelay: 1000,
      chatTimeout: 45000,
      chatThreshold: 5,
      resetTimeout: 120000
    });

    // Make OpenAI service globally available
    global.openAIService = openAIService;

    // Initialize validation service with multi-provider client
    const validationService = new EnhancedFactValidationService(
      llmClient,
      'en',
      100
    );

    // Initialize affidavit service with dependencies
    affidavitService = new AffidavitService(templateManager);

    // Add services to app locals (pool is already set before initializeServices())
    app.locals.openAIService = openAIService;
    app.locals.affidavitService = affidavitService;
    app.locals.templateManager = templateManager;
    app.locals.pdfService = pdfService; // ✅ NEW
    app.locals.enhancedFactValidationService  = validationService;
    app.locals.logger = logger;

    logger.info('✅ All services initialized successfully');
  } catch (error) {
    logger.error('❌ Service initialization failed:', error);
    console.error('❌ Service initialization failed:', error.message);
  }
}

// ✅ FIX: Set database pool immediately (dbService is initialized synchronously on import)
// This prevents "Database pool not available" errors during route initialization
app.locals.pool = dbService.pool;

// Health check endpoint
// SECURITY: Simplified to not expose internal service details (HIGH-07)
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString()
  });
});

// SECURITY: Debug endpoint removed - was exposing configuration
// See SECURITY_AUDIT_REVIEW_2026-01-27.md CRIT-03

// Safe router import utility
const safeImportRouter = (routePath, routeName) => {
  try {
    const router = require(routePath);
    
    if (typeof router === 'function' || (router && typeof router.handle === 'function')) {
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

// CSRF Protection Middleware (Origin/Referer validation)
const { csrfProtection } = require('./middleware/csrfProtection');
app.use(csrfProtection);

const factRouter = safeImportRouter('./routes/factRoutes', 'Facts');
if (factRouter) {
  app.use('/api/facts', factRouter);
}

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

const evidenceRouter = safeImportRouter('./routes/evidence', 'Evidence');
if (evidenceRouter) {
  app.use('/api/evidence', evidenceRouter);
}

const casesRouter = safeImportRouter('./routes/cases', 'Cases');
if (casesRouter) {
  app.use('/api/cases', casesRouter);
}

const catalogRouter = safeImportRouter('./routes/catalog', 'Catalog');
if (catalogRouter) {
  app.use('/api/catalog', catalogRouter);
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
  // Serve static assets with caching (they have content hashes in filenames)
  app.use(express.static(path.join(__dirname, 'client/build'), {
    maxAge: '1y', // Cache JS/CSS bundles for 1 year (they have content hashes)
    etag: true,
    lastModified: true
  }));

  // Catch-all route for React SPA - NO CACHING for index.html
  app.get('*', (req, res) => {
    // Prevent caching of index.html to ensure users get the latest app version
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
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
  
  // Force shutdown after 10 seconds
  setTimeout(() => {
    console.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

// Server instance (will be set when server starts)
let server;

// Listen for shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Async server startup function
async function startServer() {
  try {
    // Initialize all services before starting server
    console.log('⏳ Initializing services...');
    await initializeServices();
    console.log('✅ Services initialized successfully');

    // Start server
    const PORT = process.env.PORT || 3001;
    server = app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
      console.log(`📍 Health check: http://localhost:${PORT}/health`);
    });

    // Handle server errors
    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use`);
      } else {
        console.error('❌ Server error:', error);
      }
      process.exit(1);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();

module.exports = app;
