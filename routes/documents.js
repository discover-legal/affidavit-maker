// routes/documents.js - Complete drop-in with LLM validation
const express = require('express');
const router = express.Router();
const { auth0Middleware } = require('../middleware/auth0Middleware');
const { asyncHandler } = require('../middleware/errorMiddleware');
const { createRouteRateLimiter } = require('../middleware/rateLimitingMiddleware');
const logger = require('../services/logger');

// Rate limiters
const strictLimiter = createRouteRateLimiter({ 
  windowMs: 15 * 60 * 1000, 
  max: 20,
  message: 'Too many document operations. Please try again later.'
});

const pdfLimiter = createRouteRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: 'PDF generation limit reached. Please try again later.'
});

// Validation middleware
const validateAffidavitData = (req, res, next) => {
  const { affidavitData } = req.body;
  
  if (!affidavitData) {
    return res.status(400).json({
      success: false,
      error: 'Affidavit data is required'
    });
  }
  
  next();
};

/**
 * Get user documents
 */
router.get('/',
  auth0Middleware,
  asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { dbService } = req.app.locals;
    
    const result = await dbService.query(
      `SELECT id, title, document_type, template_state, status, 
       completion_percentage, created_at, updated_at
       FROM documents
       WHERE user_id = $1 AND deleted_at IS NULL
       ORDER BY updated_at DESC`,
      [userId]
    );
    
    logger.info('Documents retrieved', {
      userId,
      count: result.rows.length
    });
    
    res.json({
      success: true,
      documents: result.rows
    });
  })
);

/**
 * Get document by ID
 */
router.get('/:id',
  auth0Middleware,
  asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const documentId = req.params.id;
    const { dbService } = req.app.locals;
    
    const result = await dbService.query(
      `SELECT * FROM documents
       WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`,
      [documentId, userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Document not found'
      });
    }
    
    const document = result.rows[0];
    
    logger.info('Document retrieved', {
      userId,
      documentId
    });
    
    res.json({
      success: true,
      document
    });
  })
);

/**
 * Save document
 */
router.post('/save',
  strictLimiter,
  auth0Middleware,
  validateAffidavitData,
  asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { documentId, affidavitData } = req.body;
    const { dbService, templateManager } = req.app.locals;
    
    // Validate affidavit data
    const validation = templateManager.validateDocument(affidavitData);
    
    // Convert to JSON for storage
    const contentJson = JSON.stringify(affidavitData);
    
    let document;
    
    if (documentId) {
      // Update existing document
      // First verify ownership
      const ownerCheck = await dbService.query(
        'SELECT id FROM documents WHERE id = $1 AND user_id = $2',
        [documentId, userId]
      );
      
      if (ownerCheck.rows.length === 0) {
        return res.status(403).json({
          success: false,
          error: 'You do not have permission to update this document'
        });
      }
      
      const result = await dbService.query(
        `UPDATE documents SET
         content = $1,
         template_state = $2,
         title = $3,
         completion_percentage = $4,
         validation_results = $5,
         updated_at = NOW()
         WHERE id = $6 AND user_id = $7
         RETURNING *`,
        [
          contentJson,
          affidavitData.state || 'TX',
          `Affidavit of ${affidavitData.affiantName || 'Unnamed'}`,
          validation.isValid ? 100 : 50,
          JSON.stringify(validation),
          documentId,
          userId
        ]
      );
      
      document = result.rows[0];
      
      logger.info('Document updated', {
        userId,
        documentId,
        isValid: validation.isValid
      });
    } else {
      // Create new document
      const result = await dbService.query(
        `INSERT INTO documents
         (user_id, content, template_state, title, document_type, status, completion_percentage, validation_results)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          userId,
          contentJson,
          affidavitData.state || 'TX',
          `Affidavit of ${affidavitData.affiantName || 'Unnamed'}`,
          affidavitData.documentType || 'general',
          'draft',
          validation.isValid ? 100 : 50,
          JSON.stringify(validation)
        ]
      );
      
      document = result.rows[0];
      
      // Update user stats
      await dbService.query(
        'UPDATE users SET total_documents_created = total_documents_created + 1 WHERE id = $1',
        [userId]
      );
      
      logger.info('New document created', {
        userId,
        documentId: document.id,
        isValid: validation.isValid
      });
    }
    
    res.json({
      success: true,
      document,
      validation
    });
  })
);

/**
 * Preview document
 */
router.post('/preview',
  validateAffidavitData,
  asyncHandler(async (req, res) => {
    const { affidavitData } = req.body;
    const userId = req.user?.id;
    const { templateManager } = req.app.locals;
    
    // Generate preview
    const preview = templateManager.generatePreview(affidavitData);
    
    // Run basic validation
    const validation = templateManager.validateDocument(affidavitData);
    
    logger.info('Preview generated', {
      userId: userId || 'anonymous',
      state: affidavitData.state,
      isValid: validation.isValid
    });
    
    res.json({
      success: true,
      preview,
      validation
    });
  })
);

/**
 * Validate document with LLM
 */
router.post('/validate',
  strictLimiter,
  auth0Middleware,
  validateAffidavitData,
  asyncHandler(async (req, res) => {
    const { affidavitData } = req.body;
    const userId = req.user.id;
    const { llmValidationService } = req.app.locals;
    
    // Perform enhanced validation with LLM
    const validation = await llmValidationService.validateAffidavit(affidavitData);
    
    logger.info('LLM validation performed', {
      userId,
      state: affidavitData.state,
      isValid: validation.isValid,
      errorCount: validation.errors?.length || 0,
      warningCount: validation.warnings?.length || 0
    });
    
    res.json({
      success: true,
      validation
    });
  })
);

/**
 * Generate final affidavit (after payment verification)
 */
router.post('/generate',
  strictLimiter,
  pdfLimiter,
  auth0Middleware,
  validateAffidavitData,
  asyncHandler(async (req, res) => {
    const { affidavitData, documentId, paymentIntentId } = req.body;
    const userId = req.user.id;
    const { dbService, pdfService } = req.app.locals;
    
    // Verify payment if provided
    if (paymentIntentId) {
      const paymentResult = await dbService.query(
        'SELECT id, status FROM payments WHERE stripe_payment_intent_id = $1 AND user_id = $2',
        [paymentIntentId, userId]
      );
      
      if (paymentResult.rows.length === 0 || paymentResult.rows[0].status !== 'succeeded') {
        return res.status(403).json({
          success: false,
          error: 'Valid payment required to generate final document'
        });
      }
    }
    
    logger.info('Final generation requested', {
      userId,
      documentId,
      paymentIntentId,
      state: affidavitData.state,
      hasPayment: !!paymentIntentId
    });
    
    try {
      // Generate PDF
      const pdfResult = await pdfService.generatePDF({
        sections: req.app.locals.templateManager.generateDocumentSections(affidavitData),
        metadata: {
          documentId,
          userId,
          generatedAt: new Date().toISOString(),
          hasWatermark: !paymentIntentId
        }
      }, {
        documentId,
        includeWatermark: !paymentIntentId
      });
      
      if (!pdfResult.success) {
        throw new Error(pdfResult.error || 'PDF generation failed');
      }
      
      // Update document record
      if (documentId) {
        await dbService.query(
          `UPDATE documents SET
           pdf_generated = true,
           pdf_file_path = $1,
           pdf_generation_date = NOW(),
           payment_completed = $2,
           status = $3,
           updated_at = NOW()
           WHERE id = $4 AND user_id = $5`,
          [
            pdfResult.filepath,
            !!paymentIntentId,
            paymentIntentId ? 'completed' : 'preview',
            documentId,
            userId
          ]
        );
      }
      
      // Generate a temporary download token
      const downloadToken = require('crypto').randomBytes(16).toString('hex');
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      
      // Store download token
      await dbService.query(
        `INSERT INTO sessions
         (user_id, session_token, data, expires_at)
         VALUES ($1, $2, $3, $4)`,
        [
          userId,
          downloadToken,
          JSON.stringify({
            type: 'download',
            filePath: pdfResult.filepath,
            documentId
          }),
          expiresAt
        ]
      );
      
      logger.info('Final generation completed', {
        userId,
        documentId,
        hasWatermark: !paymentIntentId
      });
      
      res.json({
        success: true,
        documentUrl: `/api/documents/download/${downloadToken}`,
        downloadToken,
        expiresAt
      });
    } catch (error) {
      logger.error('PDF generation failed', {
        error: error.message,
        userId,
        documentId
      });
      
      throw error;
    }
  })
);

/**
 * Download document
 */
router.get('/download/:token',
  asyncHandler(async (req, res) => {
    const downloadToken = req.params.token;
    const { dbService } = req.app.locals;
    
    // Verify download token
    const sessionResult = await dbService.query(
      `SELECT * FROM sessions
       WHERE session_token = $1 AND expires_at > NOW()`,
      [downloadToken]
    );
    
    if (sessionResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Download link expired or invalid'
      });
    }
    
    const session = sessionResult.rows[0];
    const sessionData = session.data;
    
    if (sessionData.type !== 'download' || !sessionData.filePath) {
      return res.status(400).json({
        success: false,
        error: 'Invalid download token'
      });
    }
    
    // Update document if exists
    if (sessionData.documentId) {
      await dbService.query(
        `UPDATE documents SET
         downloaded_at = NOW(),
         status = 'downloaded'
         WHERE id = $1 AND user_id = $2`,
        [sessionData.documentId, session.user_id]
      );
    }
    
    logger.info('Document downloaded', {
      userId: session.user_id,
      documentId: sessionData.documentId,
      token: downloadToken
    });
    
    // Serve the file
    res.download(sessionData.filePath);
  })
);

module.exports = router;