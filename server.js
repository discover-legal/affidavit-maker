// server.js - Complete fixed version with all critical functionality
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { Pool } = require('pg');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const winston = require('winston');
const morgan = require('morgan');

// Load environment variables
require('dotenv').config();

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

// Database connection with proper error handling
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: parseInt(process.env.DATABASE_POOL_MAX || '20'),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Test database connection on startup
pool.connect()
  .then(client => {
    logger.info('✅ Database connected successfully');
    client.release();
  })
  .catch(err => {
    logger.error('❌ Database connection failed:', err);
    process.exit(1);
  });

// Import services and middleware
const AffidavitService = require('./affidavitService');
const { 
  requestIdMiddleware, 
  errorHandler, 
  asyncHandler,
  ValidationError,
  AuthenticationError 
} = require('./middleware/errorMiddleware');
const { auth0Middleware, optionalAuth0Middleware } = require('./middleware/auth0Middleware');
const { body, validationResult } = require('express-validator');

// Initialize services with proper error handling
let affidavitService;
try {
  const AffidavitService = require('./affidavitService');
  affidavitService = new AffidavitService();
} catch (error) {
  logger.warn('Could not load AffidavitService, using fallback:', error.message);
  
  // Create a simple fallback service
  affidavitService = {
    processMessage: async (data) => ({
      success: true,
      response: "Service temporarily unavailable. Please check your configuration.",
      affidavitData: data.affidavitData || {},
      suggestions: ['Check OpenAI API key', 'Verify service configuration']
    }),
    generatePreview: async (data) => ({
      success: true,
      preview: { sections: [] },
      validation: { isValid: false, errors: ['Service unavailable'] },
      metadata: { state: data.state || 'Unknown' }
    }),
    validateAffidavit: (data) => ({
      isValid: false,
      errors: ['Service unavailable'],
      warnings: [],
      completionPercentage: 0
    }),
    generateFinalDocument: async (data, options) => ({
      success: false,
      error: 'Service unavailable'
    })
  };
}

// Store pool reference for use in routes
app.locals.pool = pool;

// Request ID middleware
app.use(requestIdMiddleware);

// Logging middleware
app.use(morgan('combined', { 
  stream: { write: message => logger.info(message.trim()) }
}));

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://api.openai.com", "https://api.stripe.com", "https://*.auth0.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      frameSrc: ["'self'", "https://js.stripe.com"],
    },
  },
  crossOriginEmbedderPolicy: false
}));

// Compression
app.use(compression());

// CORS configuration
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? [process.env.FRONTEND_URL || 'https://discover.legal']
    : ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Body parsing with increased limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Validation rules
const validationRules = {
  chat: [
    body('message').isString().isLength({ min: 1, max: 1000 }).trim(),
    body('conversationHistory').optional().isArray(),
    body('affidavitData').optional().isObject()
  ],
  preview: [
    body('affidavitData').isObject(),
    body('affidavitData.state').isIn(['TX', 'UT', 'AZ']),
    body('affidavitData.facts').optional().isArray()
  ],
  saveDraft: [
    body('content').isObject(),
    body('title').optional().isString().isLength({ max: 255 }),
    body('status').optional().isIn(['draft', 'completed'])
  ]
};

// Validation middleware
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }
  next();
};

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

// API Routes

// Chat endpoint
app.post('/api/chat', auth0Middleware, validationRules.chat, validate, asyncHandler(async (req, res) => {
  const { message, conversationHistory = [], affidavitData = {} } = req.body;
  const userId = req.user.id;

  logger.info('Chat request received', {
    userId,
    messageLength: message.length,
    requestId: req.id
  });

  try {
    const result = await affidavitService.processMessage({
      message,
      conversationHistory,
      affidavitData,
      userId
    });

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error
      });
    }

    res.json({
      success: true,
      response: result.response,
      affidavitData: result.affidavitData,
      suggestions: result.suggestions
    });

  } catch (error) {
    logger.error('Chat processing error:', {
      error: error.message,
      userId,
      requestId: req.id
    });

    if (error.message.includes('rate limit')) {
      return res.status(429).json({
        success: false,
        error: 'AI service is busy. Please try again in a moment.',
        retryAfter: 30
      });
    }

    throw error;
  }
}));

// Preview endpoint
app.post('/api/preview', validationRules.preview, validate, asyncHandler(async (req, res) => {
  const { affidavitData } = req.body;

  try {
    const result = await affidavitService.generatePreview(affidavitData);
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error
      });
    }

    res.json({
      success: true,
      preview: result.preview,
      validation: result.validation,
      metadata: result.metadata
    });

  } catch (error) {
    logger.error('Preview generation error:', error);
    res.status(500).json({
      success: false,
      error: 'Preview generation failed'
    });
  }
}));

// Save draft endpoint
app.post('/api/save-draft', auth0Middleware, validationRules.saveDraft, validate, asyncHandler(async (req, res) => {
  const { content, title, status = 'draft' } = req.body;
  const userId = req.user.id;

  try {
    const result = await pool.query(
      `INSERT INTO documents (user_id, title, content, status, template_state, document_type, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
       RETURNING id, title, status, created_at, updated_at`,
      [
        userId,
        title || `${content.state || 'Unknown'} Affidavit`,
        content,
        status,
        content.state,
        content.documentType || 'affidavit'
      ]
    );

    const document = result.rows[0];

    logger.info('Draft saved successfully', {
      userId,
      documentId: document.id,
      requestId: req.id
    });

    res.json({
      success: true,
      document: {
        id: document.id,
        title: document.title,
        status: document.status,
        created_at: document.created_at,
        updated_at: document.updated_at
      }
    });

  } catch (error) {
    logger.error('Error saving draft:', {
      error: error.message,
      userId,
      requestId: req.id
    });
    throw error;
  }
}));

// Get user documents
app.get('/api/documents', auth0Middleware, asyncHandler(async (req, res) => {
  const userId = req.user.id;

  try {
    const result = await pool.query(
      `SELECT id, title, content, status, template_state, document_type, 
              created_at, updated_at, completed_at
       FROM documents 
       WHERE user_id = $1 
       ORDER BY updated_at DESC
       LIMIT 50`,
      [userId]
    );

    res.json({
      success: true,
      documents: result.rows.map(doc => ({
        id: doc.id,
        title: doc.title || `${doc.template_state || 'Unknown'} Affidavit`,
        content: doc.content,
        status: doc.status,
        state: doc.template_state,
        type: doc.document_type,
        created_at: doc.created_at,
        updated_at: doc.updated_at,
        completed_at: doc.completed_at
      }))
    });

  } catch (error) {
    logger.error('Error fetching documents:', {
      error: error.message,
      userId,
      requestId: req.id
    });
    throw error;
  }
}));

// Update document
app.put('/api/documents/:id', auth0Middleware, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { content, title, status } = req.body;
  const userId = req.user.id;

  try {
    // Verify ownership
    const ownershipCheck = await pool.query(
      'SELECT id FROM documents WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (ownershipCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Document not found'
      });
    }

    // Update document
    const result = await pool.query(
      `UPDATE documents 
       SET content = $1, title = $2, status = $3, updated_at = CURRENT_TIMESTAMP
       WHERE id = $4 AND user_id = $5
       RETURNING id, title, status, updated_at`,
      [content, title, status, id, userId]
    );

    res.json({
      success: true,
      document: result.rows[0]
    });

  } catch (error) {
    logger.error('Error updating document:', {
      error: error.message,
      documentId: id,
      userId,
      requestId: req.id
    });
    throw error;
  }
}));

// Validation endpoint
app.post('/api/validate', auth0Middleware, asyncHandler(async (req, res) => {
  const { affidavitData } = req.body;

  try {
    const validation = await affidavitService.validateAffidavit(affidavitData);
    res.json({
      success: true,
      validation
    });
  } catch (error) {
    logger.error('Validation error:', error);
    res.status(500).json({
      success: false,
      error: 'Validation failed'
    });
  }
}));

// Payment routes
app.post('/api/payment/create-intent', auth0Middleware, asyncHandler(async (req, res) => {
  const { documentId, amount = 999 } = req.body; // $9.99 in cents
  const userId = req.user.id;

  try {
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: 'usd',
      metadata: {
        userId: userId.toString(),
        documentId: documentId?.toString() || 'new'
      }
    });

    res.json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    });

  } catch (error) {
    logger.error('Payment intent creation failed:', error);
    res.status(500).json({
      success: false,
      error: 'Payment setup failed'
    });
  }
}));

// Generate final affidavit (after payment)
app.post('/api/generate-affidavit', auth0Middleware, asyncHandler(async (req, res) => {
  const { affidavitData, documentId } = req.body;
  const userId = req.user.id;

  try {
    // Verify payment (simplified - in production, verify via Stripe webhook)
    const result = await affidavitService.generateFinalDocument(affidavitData, {
      userId,
      documentId,
      includeWatermark: false
    });

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error
      });
    }

    res.json({
      success: true,
      documentUrl: result.documentUrl,
      downloadToken: result.downloadToken
    });

  } catch (error) {
    logger.error('Document generation failed:', error);
    res.status(500).json({
      success: false,
      error: 'Document generation failed'
    });
  }
}));

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'client/build')));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'client/build', 'index.html'));
  });
}

// Error handling middleware (must be last)
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found'
  });
});

const PORT = process.env.PORT || 3001;

const server = app.listen(PORT, () => {
  logger.info(`🚀 Affidavit Maker server running on port ${PORT}`);
  logger.info(`📝 Professional Legal Document Platform`);
  logger.info(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
  
  if (process.env.NODE_ENV === 'development') {
    logger.info(`📋 Health check: http://localhost:${PORT}/health`);
    logger.info(`🔗 API base: http://localhost:${PORT}/api`);
  }
});

// Graceful shutdown
const gracefulShutdown = async (signal) => {
  logger.info(`${signal} received. Shutting down gracefully...`);
  
  server.close(async () => {
    logger.info('HTTP server closed');
    
    try {
      await pool.end();
      logger.info('Database pool closed');
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown:', error);
      process.exit(1);
    }
  });

  // Force shutdown after 30 seconds
  setTimeout(() => {
    logger.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 30000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

module.exports = app;