// server.js - Fixed version
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
const logger = require('./services/logger');


// Import middleware
const { errorMiddleware } = require('./middleware/errorMiddleware');

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

// Create singleton instances of services
const { StateTemplateManager } = require('./templates/StateTemplateManager');
const templateManager = new StateTemplateManager();
const affidavitService = new AffidavitService();

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
      stripe: process.env.STRIPE_SECRET_KEY ? 'OK' : 'Not Configured'
    }
  });
});

// Import routes AFTER creating the services they depend on
const auth0WebhooksRouter = require('./routes/auth0-webhooks');
const documentsRouter = require('./routes/documents');

// API routes - only include routes that exist and are properly exported
app.use('/api/webhooks/auth0', auth0WebhooksRouter);
app.use('/api/documents', documentsRouter);

// Optional routes - only include if they exist
try {
  const authRouter = require('./routes/auth');
  app.use('/api/auth', authRouter);
} catch (err) {
  logger.warn('Auth routes not loaded', { error: err.message });
}

try {
  const chatRouter = require('./routes/chat');
  app.use('/api/chat', chatRouter);
} catch (err) {
  logger.warn('Chat routes not loaded', { error: err.message });
}

try {
  const paymentRouter = require('./routes/payment');
  app.use('/api/payment', paymentRouter);
} catch (err) {
  logger.warn('Payment routes not loaded', { error: err.message });
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
app.use(errorMiddleware);

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  logger.info(`Server started on port ${PORT}`);
});

module.exports = app;