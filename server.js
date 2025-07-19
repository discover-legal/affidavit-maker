// server.js 
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const { Pool } = require('pg');

// Import services and middleware
const logger = require('./services/logger');
const AffidavitService = require('./services/affidavitService');
const { auth0Middleware } = require('./middleware/auth0Middleware');
const { asyncHandler, ValidationError } = require('./middleware/errorMiddleware');

// Initialize Express app
const app = express();
const port = process.env.PORT || 3001;

// Initialize services
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: parseInt(process.env.DATABASE_POOL_MAX) || 20,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const affidavitService = new AffidavitService();

// Make services available to routes
app.locals.pool = pool;
app.locals.affidavitService = affidavitService;

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
    body('affidavitData.state').optional().isIn(['TX', 'UT', 'AZ']),
    body('affidavitData.facts').optional().isArray()
  ],
  saveDraft: [
    body('content').optional().isObject(),
    body('affidavitData').optional().isObject(),
    body('documentId').optional().isInt(),
    body('title').optional().isString().isLength({ max: 255 })
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

// Chat endpoint with streaming support and LLM extraction
app.post('/api/chat', auth0Middleware, validationRules.chat, validate, asyncHandler(async (req, res) => {
  const { message, conversationHistory = [], affidavitData = {} } = req.body;
  const userId = req.user.id;

  logger.info('Chat request received', {
    userId,
    messageLength: message.length,
    requestId: req.id
  });

  try {
    // Set headers for streaming
    res.writeHead(200, {
      'Content-Type': 'text/plain',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept, Authorization'
    });

    // Try streaming first
    try {
      const stream = await affidavitService.processMessageStream({
        message,
        conversationHistory,
        affidavitData,
        userId
      });

      let fullResponse = '';
      const updatedAffidavitData = { ...affidavitData };

      // Process stream and extract data
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          fullResponse += content;
          res.write(`data: ${JSON.stringify({ type: 'token', content })}\n\n`);
        }
      }

      // LLM-powered name extraction
      if (!updatedAffidavitData.affiantName || updatedAffidavitData.affiantName === 'thats all') {
        try {
          const extractedName = await affidavitService.extractNameFromMessage(
            message, 
            updatedAffidavitData.affiantName
          );
          
          if (extractedName) {
            updatedAffidavitData.affiantName = extractedName;
            logger.info('Name extracted via LLM', {
              userId,
              extractedName,
              messagePreview: message.substring(0, 50)
            });
          }
        } catch (nameError) {
          logger.warn('LLM name extraction failed, using fallback:', nameError.message);
          
          // Fallback to simple regex as backup
          const simpleNameMatch = message.match(/(?:my name is|i am|i'm)\s+([A-Z][a-z]+\s+[A-Z][a-z]+)/i);
          if (simpleNameMatch && simpleNameMatch[1]) {
            const name = simpleNameMatch[1].trim();
            if (name.length > 3) {
              updatedAffidavitData.affiantName = name;
              logger.info('Name extracted via fallback regex', { userId, extractedName: name });
            }
          }
        }
      }

      // LLM-powered state extraction  
      if (!updatedAffidavitData.state) {
        try {
          const extractedState = await affidavitService.extractStateFromMessage(
            message,
            updatedAffidavitData.state
          );
          
          if (extractedState) {
            updatedAffidavitData.state = extractedState;
            logger.info('State extracted via LLM', { userId, extractedState });
          }
        } catch (stateError) {
          logger.warn('LLM state extraction failed, using fallback:', stateError.message);
          
          // Fallback to keyword detection
          const lowerMessage = message.toLowerCase();
          if (lowerMessage.includes('texas') || lowerMessage.includes(' tx ')) {
            updatedAffidavitData.state = 'TX';
          } else if (lowerMessage.includes('utah') || lowerMessage.includes(' ut ')) {
            updatedAffidavitData.state = 'UT';
          } else if (lowerMessage.includes('arizona') || lowerMessage.includes(' az ')) {
            updatedAffidavitData.state = 'AZ';
          }
        }
      }

      // Extract case number (keep existing logic) 
      if (!updatedAffidavitData.caseNumber) {
        const caseNumberMatch = message.match(/case\s*(?:number|file|#)?\s*:?\s*([a-z0-9\-]+)/i);
        if (caseNumberMatch && caseNumberMatch[1]) {
          updatedAffidavitData.caseNumber = caseNumberMatch[1];
        }
      }

      // Extract facts using enhanced LLM system
      if (message.length > 15) {
        try {
          const factResult = await affidavitService.extractAndCategorizeFacts(
            message, 
            updatedAffidavitData.facts || []
          );
          
          if (factResult.newFacts.length > 0) {
            updatedAffidavitData.facts = factResult.facts;
            logger.info('New facts extracted via streaming', {
              userId,
              newFactsCount: factResult.newFacts.length,
              categories: factResult.newFacts.map(f => f.category)
            });
          }
        } catch (factError) {
          logger.warn('Fact extraction failed, skipping:', factError.message);
        }
      }

      // Send extracted data
      res.write(`data: ${JSON.stringify({ type: 'data', affidavitData: updatedAffidavitData })}\n\n`);

      // Send completion signal
      res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);

    } catch (streamError) {
      logger.error('Streaming error, falling back to non-streaming:', streamError);
      
      // Fallback to simple response
      res.write(`data: ${JSON.stringify({ 
        type: 'token', 
        content: 'I understand you want to create an affidavit. Could you please tell me your full name and which state this is for?'
      })}\n\n`);
      
      res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    }

    res.end();

  } catch (error) {
    logger.error('Chat processing error:', {
      error: error.message,
      userId,
      requestId: req.id
    });

    if (error.message.includes('rate limit')) {
      res.write(`data: ${JSON.stringify({ 
        type: 'error', 
        error: 'AI service is busy. Please try again in a moment.',
        retryAfter: 30 
      })}\n\n`);
    } else {
      res.write(`data: ${JSON.stringify({ 
        type: 'error', 
        error: 'An error occurred. Please try again.' 
      })}\n\n`);
    }

    res.end();
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

// Fixed save draft endpoint
app.post('/api/save-draft', auth0Middleware, validationRules.saveDraft, validate, asyncHandler(async (req, res) => {
  const { affidavitData, documentId, title } = req.body;
  const userId = req.user.id;

  if (!affidavitData || typeof affidavitData !== 'object') {
    throw new ValidationError('Invalid affidavit data provided');
  }

  try {
    let document;
    
    if (documentId) {
      // Update existing document
      const updateResult = await pool.query(
        `UPDATE documents 
         SET content = $1, template_state = $2, document_type = $3, updated_at = NOW() 
         WHERE id = $4 AND user_id = $5
         RETURNING *`,
        [
          JSON.stringify(affidavitData), 
          affidavitData.state,
          affidavitData.documentType || 'general',
          documentId, 
          userId
        ]
      );
      
      if (updateResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Document not found or access denied'
        });
      }
      
      document = updateResult.rows[0];
      
    } else {
      // Create new document
      const insertResult = await pool.query(
        `INSERT INTO documents (user_id, content, template_state, document_type, status, created_at)
         VALUES ($1, $2, $3, $4, 'draft', NOW())
         RETURNING *`,
        [
          userId, 
          JSON.stringify(affidavitData), 
          affidavitData.state,
          affidavitData.documentType || 'general'
        ]
      );
      
      document = insertResult.rows[0];
    }

    logger.info('Draft saved successfully', {
      documentId: document.id,
      userId,
      requestId: req.id
    });

    res.json({
      success: true,
      documentId: document.id,
      document: {
        id: document.id,
        status: document.status,
        created_at: document.created_at,
        updated_at: document.updated_at,
        state: affidavitData.state,
        documentType: affidavitData.documentType,
        affiantName: affidavitData.affiantName
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
      `SELECT id, content, status, template_state, document_type, 
              created_at, updated_at, completed_at
       FROM documents 
       WHERE user_id = $1 
       ORDER BY updated_at DESC
       LIMIT 50`,
      [userId]
    );

    const documents = result.rows.map(doc => {
      let content = {};
      try {
        content = typeof doc.content === 'string' ? JSON.parse(doc.content) : doc.content || {};
      } catch (e) {
        content = {};
      }

              return {
        id: doc.id,
        title: content.affiantName ? `${content.affiantName}'s Affidavit` : `Affidavit #${doc.id}`,
        content: content,
        status: doc.status,
        state: doc.template_state,
        type: doc.document_type,
        affiantName: content.affiantName,
        created_at: doc.created_at,
        updated_at: doc.updated_at,
        completed_at: doc.completed_at
      };
    });

    res.json({
      success: true,
      documents: documents
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

// Delete document
app.delete('/api/documents/:id', auth0Middleware, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  try {
    const deleteResult = await pool.query(
      'DELETE FROM documents WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, userId]
    );

    if (deleteResult.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Document not found or access denied'
      });
    }

    logger.info('Document deleted', {
      documentId: id,
      userId,
      requestId: req.id
    });

    res.json({ 
      success: true, 
      message: 'Document deleted successfully' 
    });

  } catch (error) {
    logger.error('Error deleting document:', {
      error: error.message,
      documentId: id,
      userId,
      requestId: req.id
    });
    throw error;
  }
}));

// Rename document
app.put('/api/documents/:id/rename', auth0Middleware, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { newName } = req.body;
  const userId = req.user.id;

  if (!newName || newName.trim().length === 0) {
    throw new ValidationError('New name is required');
  }

  try {
    const doc = await pool.query(
      'SELECT content FROM documents WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (doc.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Document not found or access denied'
      });
    }

    let content = {};
    try {
      content = typeof doc.rows[0].content === 'string' 
        ? JSON.parse(doc.rows[0].content) 
        : doc.rows[0].content || {};
    } catch (e) {
      content = {};
    }

    content.affiantName = newName.trim();

    const updatedDoc = await pool.query(
      'UPDATE documents SET content = $1, updated_at = NOW() WHERE id = $2 RETURNING id, content',
      [JSON.stringify(content), id]
    );

    logger.info('Document renamed', {
      documentId: id,
      userId,
      newName: newName.trim(),
      requestId: req.id
    });

    res.json({ 
      success: true, 
      document: updatedDoc.rows[0] 
    });

  } catch (error) {
    logger.error('Error renaming document:', {
      error: error.message,
      documentId: id,
      userId,
      requestId: req.id
    });
    throw error;
  }
}));

// Error handling middleware
app.use((error, req, res, next) => {
  logger.error('Unhandled error:', {
    error: error.message,
    stack: error.stack,
    requestId: req.id,
    userId: req.user?.id
  });

  if (error instanceof ValidationError) {
    return res.status(400).json({
      success: false,
      error: error.message,
      details: error.details
    });
  }

  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found'
  });
});

// Start server
app.listen(port, () => {
  logger.info(`Server running on port ${port} in ${process.env.NODE_ENV || 'development'} mode`);
});

module.exports = app;