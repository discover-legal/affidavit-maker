// server.js - Final Fixed Version - All Issues Resolved
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
const logger = require('./services/logger');

// Import middleware
const { errorHandler } = require('./middleware/errorMiddleware');

// Initialize Express app
const app = express();

// Request ID middleware
app.use((req, res, next) => {
  req.id = uuidv4();
  next();
});

// Security middleware
app.use(helmet());

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
    'X-Request-ID'
  ]
}));

// Compression middleware
app.use(compression());

// Body parsing middleware
app.use(express.json({ 
  limit: '10mb',
  strict: true
}));

app.use(express.urlencoded({ 
  extended: true, 
  limit: '10mb'
}));

// Logging middleware
app.use(morgan('combined', {
  stream: {
    write: (message) => logger.info(message.trim())
  },
  skip: (req, res) => res.statusCode < 400
}));

// Create services in correct order - FIXED: No double initialization
const { StateTemplateManager } = require('./templates/StateTemplateManager');
const OpenAI = require('openai');

// Create OpenAI client first
const openaiClient = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Create services - pass templateManager to AffidavitService to prevent double init
const openAIService = new ResilientOpenAIService(openaiClient);
const templateManager = new StateTemplateManager();
const affidavitService = new AffidavitService(templateManager); // FIXED: Pass template manager

// Make openAIService available globally for services that need it
global.openAIService = openAIService;

// Add services to app locals for easy access in routes
app.locals.dbService = dbService;
app.locals.openAIService = openAIService;
app.locals.affidavitService = affidavitService;
app.locals.templateManager = templateManager;
app.locals.logger = logger;

// Define routes
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    services: {
      database: dbService ? 'OK' : 'Not Connected',
      templates: templateManager ? 'OK' : 'Not Initialized',
      auth: process.env.AUTH0_DOMAIN ? 'OK' : 'Not Configured',
      stripe: process.env.STRIPE_SECRET_KEY ? 'OK' : 'Not Connected'
    }
  });
});

// FIXED: Safer route imports with validation
const safeImportRouter = (routePath, routeName) => {
  try {
    const router = require(routePath);
    // Validate that it's actually a router/middleware function
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

// Basic fallback routes for critical endpoints if files are missing
if (!documentsRouter) {
  app.get('/api/documents', (req, res) => {
    res.status(503).json({ 
      success: false, 
      error: 'Documents service temporarily unavailable' 
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

// Error handling middleware
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`✅ Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`✅ Health check: http://localhost:${PORT}/health`);
  logger.info(`Server started on port ${PORT}`);
});

module.exports = app;