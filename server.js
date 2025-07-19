// server.js - Updated with fixes for scrolling and document saving
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { Pool } = require('pg');
const path = require('path');

const app = express();

// Security middleware with CSP adjustments to prevent scrolling issues
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://api.openai.com", "https://api.stripe.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      frameSrc: ["'self'", "https://js.stripe.com"],
    },
  },
  crossOriginEmbedderPolicy: false
}));

// CORS configuration
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://discover.legal', 'https://www.discover.legal']
    : ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true
}));

// Body parsing with increased limits for document content
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Make pool available to routes
app.locals.pool = pool;
app.locals.config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  stripeSecretKey: process.env.STRIPE_SECRET_KEY,
  stripeApiVersion: '2023-10-16',
  openaiApiKey: process.env.OPENAI_API_KEY,
  auth0Domain: process.env.AUTH0_DOMAIN,
  auth0Audience: process.env.AUTH0_AUDIENCE
};

// Import services
const AffidavitService = require('./affidavitService');
const CountyValidationService = require('./services/countyValidationService');
const PDFService = require('./services/pdfService');
const { auth0Middleware } = require('./middleware/auth0Middleware');
const { validationRules, validate } = require('./middleware/securityMiddleware');
const { asyncHandler } = require('./middleware/errorMiddleware');

// Initialize services
const affidavitService = new AffidavitService(process.env.OPENAI_API_KEY);
const countyValidationService = new CountyValidationService(process.env.OPENAI_API_KEY);
const pdfService = new PDFService();

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    brand: 'Discover.Legal',
    version: '2.0.0'
  });
});

// County validation endpoint - enhanced
app.post('/api/validate-county', auth0Middleware, asyncHandler(async (req, res) => {
  const { county, state } = req.body;
  
  if (!county || !state) {
    return res.status(400).json({
      success: false,
      error: 'County and state are required'
    });
  }

  try {
    const validation = await countyValidationService.validateCounty(county, state);
    res.json({
      success: true,
      ...validation
    });
  } catch (error) {
    console.error('County validation error:', error);
    res.status(500).json({
      success: false,
      error: 'County validation failed'
    });
  }
}));

// Documents endpoints - fixed saving issues
app.get('/api/documents', auth0Middleware, asyncHandler(async (req, res) => {
  const user = req.user;
  
  try {
    const result = await pool.query(
      `SELECT id, title, content, status, template_state, document_type, 
              created_at, updated_at, completed_at
       FROM documents 
       WHERE user_id = $1 
       ORDER BY updated_at DESC`,
      [user.id]
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
    console.error('Error fetching documents:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch documents'
    });
  }
}));

// Save draft endpoint - improved error handling
app.post('/api/save-draft', auth0Middleware, validationRules.saveDraft, validate, asyncHandler(async (req, res) => {
  const { documentId, affidavitData, title } = req.body;
  const user = req.user;
  
  try {
    let result;
    const documentTitle = title || `${affidavitData.state || 'Unknown'} Affidavit`;
    
    if (documentId) {
      // Update existing document
      result = await pool.query(
        `UPDATE documents 
         SET content = $1, title = $2, template_state = $3, updated_at = CURRENT_TIMESTAMP
         WHERE id = $4 AND user_id = $5
         RETURNING id, title, status`,
        [JSON.stringify(affidavitData), documentTitle, affidavitData.state, documentId, user.id]
      );
      
      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Document not found or access denied'
        });
      }
    } else {
      // Create new document
      result = await pool.query(
        `INSERT INTO documents (user_id, title, content, template_state, document_type, status)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, title, status`,
        [
          user.id,
          documentTitle,
          JSON.stringify(affidavitData),
          affidavitData.state,
          affidavitData.documentType || 'general',
          'draft'
        ]
      );
    }
    
    res.json({
      success: true,
      documentId: result.rows[0].id,
      title: result.rows[0].title,
      status: result.rows[0].status,
      message: documentId ? 'Document updated successfully' : 'Document saved successfully'
    });
    
  } catch (error) {
    console.error('Error saving document:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save document'
    });
  }
}));

// Generate document endpoint - enhanced multi-page support
app.post('/api/generate-document', auth0Middleware, validationRules.generateDocument, validate, asyncHandler(async (req, res) => {
  const { affidavitData, strategy = 'simple', format = 'pdf' } = req.body;
  const user = req.user;
  
  try {
    // Process the affidavit
    const result = await affidavitService.processAffidavit(affidavitData, strategy);
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error
      });
    }

    let documentInfo;
    
    if (format.toLowerCase() === 'pdf') {
      // Generate PDF
      const pdfResult = await pdfService.generatePDF(result.document, {
        documentId: affidavitData.documentId,
        userId: user.id
      });
      
      if (!pdfResult.success) {
        throw new Error('PDF generation failed');
      }
      
      documentInfo = {
        format: 'pdf',
        filename: pdfResult.filename,
        filepath: pdfResult.filepath,
        pages: pdfResult.pages,
        document: result.document
      };
    } else {
      // Generate other formats
      documentInfo = await affidavitService.generateDocument(affidavitData, strategy, format);
    }
    
    // Update document status in database
    if (affidavitData.documentId) {
      await pool.query(
        `UPDATE documents 
         SET status = $1, file_path = $2, completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE id = $3 AND user_id = $4`,
        ['completed', documentInfo.filepath || null, affidavitData.documentId, user.id]
      );
    }
    
    res.json({
      success: true,
      document: documentInfo,
      message: 'Document generated successfully'
    });
    
  } catch (error) {
    console.error('Document generation error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Document generation failed'
    });
  }
}));

// Download endpoint - fixed file serving
app.get('/api/download/:documentId', auth0Middleware, asyncHandler(async (req, res) => {
  const { documentId } = req.params;
  const user = req.user;
  
  try {
    const result = await pool.query(
      `SELECT id, title, file_path, status, template_state
       FROM documents 
       WHERE id = $1 AND user_id = $2 AND status IN ('paid', 'completed')`,
      [documentId, user.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Document not found or not available for download'
      });
    }
    
    const document = result.rows[0];
    
    if (!document.file_path) {
      return res.status(404).json({
        success: false,
        error: 'File not found'
      });
    }
    
    // Check if file exists
    const fs = require('fs').promises;
    try {
      await fs.access(document.file_path);
    } catch (error) {
      return res.status(404).json({
        success: false,
        error: 'File not found on server'
      });
    }
    
    // Set proper headers for download
    const filename = `${document.title.replace(/[^a-z0-9]/gi, '_')}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-cache');
    
    // Update download timestamp
    await pool.query(
      'UPDATE documents SET downloaded_at = CURRENT_TIMESTAMP WHERE id = $1',
      [documentId]
    );
    
    // Send file
    res.sendFile(path.resolve(document.file_path));
    
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({
      success: false,
      error: 'Download failed'
    });
  }
}));

// Delete document endpoint
app.delete('/api/documents/:documentId', auth0Middleware, asyncHandler(async (req, res) => {
  const { documentId } = req.params;
  const user = req.user;
  
  try {
    // Get document info first to clean up files
    const document = await pool.query(
      'SELECT file_path FROM documents WHERE id = $1 AND user_id = $2',
      [documentId, user.id]
    );
    
    if (document.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Document not found'
      });
    }
    
    // Delete from database
    await pool.query(
      'DELETE FROM documents WHERE id = $1 AND user_id = $2',
      [documentId, user.id]
    );
    
    // Clean up file if it exists
    if (document.rows[0].file_path) {
      try {
        const fs = require('fs').promises;
        await fs.unlink(document.rows[0].file_path);
      } catch (error) {
        console.warn('Failed to delete file:', error.message);
      }
    }
    
    res.json({
      success: true,
      message: 'Document deleted successfully'
    });
    
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete document'
    });
  }
}));

// Rename document endpoint
app.put('/api/documents/:documentId/rename', auth0Middleware, validationRules.renameDocument, validate, asyncHandler(async (req, res) => {
  const { documentId } = req.params;
  const { newName } = req.body;
  const user = req.user;
  
  try {
    const result = await pool.query(
      `UPDATE documents 
       SET title = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 AND user_id = $3
       RETURNING title`,
      [newName.trim(), documentId, user.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Document not found'
      });
    }
    
    res.json({
      success: true,
      title: result.rows[0].title,
      message: 'Document renamed successfully'
    });
    
  } catch (error) {
    console.error('Rename error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to rename document'
    });
  }
}));

// Chat endpoint
app.post('/api/chat', auth0Middleware, validationRules.chat, validate, asyncHandler(async (req, res) => {
  const { message, affidavitData, conversationHistory } = req.body;
  
  try {
    const response = await affidavitService.processMessage(
      message,
      affidavitData,
      conversationHistory
    );
    
    res.json({
      success: true,
      response: response.reply,
      extractedData: response.extractedData,
      isComplete: response.isComplete,
      nextSteps: response.nextSteps
    });
    
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({
      success: false,
      error: 'Chat processing failed',
      fallbackResponse: "I apologize, but I'm having trouble processing your request right now. Please try again."
    });
  }
}));

// Preview endpoint - no scrolling issues
app.post('/api/preview', validationRules.preview, validate, asyncHandler(async (req, res) => {
  const { affidavitData } = req.body;
  
  try {
    const result = await affidavitService.processAffidavit(affidavitData, 'simple');
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error
      });
    }
    
    // Return clean preview without extra formatting that could cause scroll issues
    res.json({
      success: true,
      preview: {
        sections: result.document.sections,
        metadata: {
          state: result.document.metadata.state,
          stateName: result.document.metadata.stateName,
          estimatedPages: Math.max(1, Math.ceil((affidavitData.facts?.length || 0) / 10))
        }
      }
    });
    
  } catch (error) {
    console.error('Preview error:', error);
    res.status(500).json({
      success: false,
      error: 'Preview generation failed'
    });
  }
}));

// Payment routes
const paymentRoutes = require('./routes/payments');
app.use('/api/payment', paymentRoutes);

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
    console.error('Validation error:', error);
    res.status(500).json({
      success: false,
      error: 'Validation failed'
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

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  
  // Don't send stack traces in production
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  res.status(error.status || 500).json({
    success: false,
    error: isDevelopment ? error.message : 'Internal server error',
    ...(isDevelopment && { stack: error.stack })
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found'
  });
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`🚀 Discover.Legal server running on port ${PORT}`);
  console.log(`📝 Professional Affidavit Creation Platform`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
  
  if (process.env.NODE_ENV === 'development') {
    console.log(`📋 Health check: http://localhost:${PORT}/health`);
    console.log(`🔗 API base: http://localhost:${PORT}/api`);
  }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  await pool.end();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received. Shutting down gracefully...');
  await pool.end();
  process.exit(0);
});

module.exports = app;