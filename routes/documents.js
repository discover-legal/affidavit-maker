// routes/documents.js - Document management routes
const express = require('express');
const router = express.Router();
const { validationRules, validate } = require('../middleware/securityMiddleware');
const { asyncHandler, ValidationError, NotFoundError, withTransaction } = require('../middleware/errorMiddleware');
const logger = require('../services/logger');
const path = require('path');
const fs = require('fs').promises;

// Get all user documents
router.get('/', asyncHandler(async (req, res) => {
  const user = req.user;
  const pool = req.app.locals.pool;
  
  const documents = await pool.query(
    `SELECT id, content, generated_text, template_state, document_type, 
            validation_results, generation_metadata, status, file_path,
            created_at, updated_at, completed_at
     FROM documents 
     WHERE user_id = $1 
     ORDER BY updated_at DESC`,
    [user.id]
  );

  // Parse and enhance documents
  const enhancedDocuments = documents.rows.map(doc => {
    let content = {};
    let validation = null;
    let metadata = null;

    try {
      content = typeof doc.content === 'string' 
        ? JSON.parse(doc.content) 
        : doc.content || {};
    } catch (e) {
      logger.error('Error parsing document content:', { error: e, documentId: doc.id });
      content = {};
    }

    try {
      validation = typeof doc.validation_results === 'string'
        ? JSON.parse(doc.validation_results)
        : doc.validation_results || null;
    } catch (e) {
      validation = null;
    }

    try {
      metadata = typeof doc.generation_metadata === 'string'
        ? JSON.parse(doc.generation_metadata)
        : doc.generation_metadata || null;
    } catch (e) {
      metadata = null;
    }

    return {
      id: doc.id,
      status: doc.status,
      created_at: doc.created_at,
      updated_at: doc.updated_at,
      completed_at: doc.completed_at,
      state: doc.template_state || content.state,
      template_state: doc.template_state,
      document_type: doc.document_type || content.documentType,
      documentType: doc.document_type || content.documentType,
      affiantName: content.affiantName,
      caseNumber: content.caseNumber,
      county: content.county,
      validation,
      metadata,
      hasFile: !!doc.file_path,
      content
    };
  });

  res.json({
    success: true,
    documents: enhancedDocuments,
    count: enhancedDocuments.length
  });
}));

// Save draft document
router.post('/save-draft', validationRules.saveDraft, validate, asyncHandler(async (req, res) => {
  const { documentId, affidavitData } = req.body;
  const user = req.user;
  const pool = req.app.locals.pool;
  const affidavitService = req.app.locals.affidavitService;

  if (!affidavitData || typeof affidavitData !== 'object') {
    throw new ValidationError('Invalid affidavit data provided');
  }

  // Validate data if state is selected
  let validation = null;
  if (affidavitData.state) {
    try {
      validation = affidavitService.validateAffidavitData(affidavitData, affidavitData.state);
    } catch (validationError) {
      logger.error('Validation error:', validationError);
      validation = {
        isValid: false,
        errors: ['Validation temporarily unavailable'],
        warnings: []
      };
    }
  }

  let document;
  
  await withTransaction(pool, async (client) => {
    if (documentId) {
      // Update existing draft
      const updateResult = await client.query(
        `UPDATE documents 
         SET content = $1, validation_results = $2, template_state = $3, 
             document_type = $4, updated_at = NOW() 
         WHERE id = $5 AND user_id = $6
         RETURNING *`,
        [
          JSON.stringify(affidavitData), 
          JSON.stringify(validation),
          affidavitData.state,
          affidavitData.documentType || 'general',
          documentId, 
          user.id
        ]
      );
      
      if (updateResult.rows.length === 0) {
        throw new NotFoundError('Document not found or access denied');
      }
      
      document = updateResult.rows[0];
      
    } else {
      // Create new draft
      const insertResult = await client.query(
        `INSERT INTO documents (user_id, content, validation_results, template_state, 
                               document_type, status, created_at)
         VALUES ($1, $2, $3, $4, $5, 'draft', NOW())
         RETURNING *`,
        [
          user.id, 
          JSON.stringify(affidavitData), 
          JSON.stringify(validation),
          affidavitData.state,
          affidavitData.documentType || 'general'
        ]
      );
      
      document = insertResult.rows[0];
    }

    // Log activity
    await client.query(
      `INSERT INTO activity_logs (user_id, action, resource_type, resource_id, ip_address, user_agent, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        user.id,
        documentId ? 'draft_updated' : 'draft_created',
        'document',
        document.id,
        req.ip,
        req.get('user-agent'),
        JSON.stringify({ requestId: req.id })
      ]
    );
  });

  logger.info('Draft saved successfully', {
    documentId: document.id,
    userId: user.id,
    requestId: req.id
  });

  res.json({ 
    success: true, 
    documentId: document.id,
    validation,
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
}));

// Generate final document
router.post('/generate', validationRules.generateDocument, validate, asyncHandler(async (req, res) => {
  const { affidavitData, strategy = 'simple', format = 'pdf' } = req.body;
  const user = req.user;
  const pool = req.app.locals.pool;
  const affidavitService = req.app.locals.affidavitService;

  if (!affidavitData || !affidavitData.state) {
    throw new ValidationError('Affidavit data and state are required');
  }

  // Generate document using template service
  const result = await affidavitService.processAffidavit(affidavitData, strategy, {
    documentId: affidavitData.documentId
  });

  if (!result.success) {
    throw new ValidationError(result.error || 'Failed to generate affidavit');
  }

  // Save to database
  const document = await withTransaction(pool, async (client) => {
    const doc = await client.query(
      `INSERT INTO documents (user_id, content, generated_text, template_state, 
                             document_type, generation_metadata, status, completed_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'completed', NOW())
       RETURNING *`,
      [
        user.id,
        JSON.stringify(affidavitData),
        result.document.fullText,
        affidavitData.state,
        affidavitData.documentType || 'general',
        JSON.stringify(result.metadata)
      ]
    );

    // Log activity
    await client.query(
      `INSERT INTO activity_logs (user_id, action, resource_type, resource_id, ip_address, user_agent, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        user.id,
        'document_generated',
        'document',
        doc.rows[0].id,
        req.ip,
        req.get('user-agent'),
        JSON.stringify({ 
          requestId: req.id,
          strategy,
          format
        })
      ]
    );

    return doc.rows[0];
  });

  // Generate PDF if requested
  let filePath = null;
  if (format === 'pdf') {
    try {
      const { enhancedPdfService } = require('../services/enhancedPdfService');
      if (enhancedPdfService) {
        filePath = await enhancedPdfService.generatePDF(result.document, {
          documentId: document.id,
          userId: user.id
        });
      } else {
        const { generatePDF } = require('../services/pdfService');
        filePath = await generatePDF(result.document, {
          documentId: document.id,
          userId: user.id
        });
      }

      // Update document with file path
      await pool.query(
        'UPDATE documents SET file_path = $1 WHERE id = $2',
        [filePath, document.id]
      );
    } catch (pdfError) {
      logger.error('PDF generation error:', { error: pdfError, documentId: document.id });
      // Continue without PDF - user can still get text version
    }
  }

  logger.info('Document generated successfully', {
    documentId: document.id,
    userId: user.id,
    format,
    strategy,
    requestId: req.id
  });

  res.json({
    success: true,
    documentId: document.id,
    content: result.document.fullText,
    htmlContent: result.document.htmlContent,
    downloadUrl: filePath ? `/api/documents/${document.id}/download` : null,
    metadata: result.metadata,
    validation: result.validation
  });
}));

// Download document
router.get('/:documentId/download', asyncHandler(async (req, res) => {
  const { documentId } = req.params;
  const user = req.user;
  const pool = req.app.locals.pool;

  // Validate documentId format
  if (!documentId || !/^\d+$/.test(documentId)) {
    throw new ValidationError('Invalid document ID');
  }

  const document = await pool.query(
    'SELECT file_path, content FROM documents WHERE id = $1 AND user_id = $2',
    [documentId, user.id]
  );

  if (document.rows.length === 0) {
    throw new NotFoundError('Document not found');
  }

  const filePath = document.rows[0].file_path;
  if (!filePath) {
    throw new NotFoundError('File not found');
  }

  // Validate file path to prevent directory traversal
  const documentsDir = path.join(__dirname, '..', 'documents');
  const resolvedPath = path.resolve(filePath);
  
  if (!resolvedPath.startsWith(documentsDir)) {
    logger.error('Potential directory traversal attempt:', {
      filePath,
      userId: user.id,
      requestId: req.id
    });
    throw new ValidationError('Invalid file path');
  }

  // Check if file exists
  try {
    await fs.access(resolvedPath);
  } catch (error) {
    throw new NotFoundError('File not found on disk');
  }

  // Log download activity
  await pool.query(
    `INSERT INTO activity_logs (user_id, action, resource_type, resource_id, ip_address, user_agent, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      user.id,
      'document_downloaded',
      'document',
      documentId,
      req.ip,
      req.get('user-agent'),
      JSON.stringify({ requestId: req.id })
    ]
  );

  // Update download timestamp
  await pool.query(
    'UPDATE documents SET downloaded_at = NOW() WHERE id = $1',
    [documentId]
  );

  logger.info('Document downloaded', {
    documentId,
    userId: user.id,
    requestId: req.id
  });

  res.download(resolvedPath, `affidavit-${documentId}.pdf`);
}));

// Rename document
router.put('/:id/rename', validationRules.renameDocument, validate, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { newName } = req.body;
  const user = req.user;
  const pool = req.app.locals.pool;

  const doc = await pool.query(
    'SELECT content FROM documents WHERE id = $1 AND user_id = $2',
    [id, user.id]
  );

  if (doc.rows.length === 0) {
    throw new NotFoundError('Document not found or access denied');
  }

  let content = {};
  try {
    content = typeof doc.rows[0].content === 'string' 
      ? JSON.parse(doc.rows[0].content) 
      : doc.rows[0].content || {};
  } catch (e) {
    content = {};
  }

  content.affiantName = newName;

  const updatedDoc = await pool.query(
    'UPDATE documents SET content = $1, updated_at = NOW() WHERE id = $2 RETURNING id, content',
    [JSON.stringify(content), id]
  );

  logger.info('Document renamed', {
    documentId: id,
    userId: user.id,
    newName,
    requestId: req.id
  });

  res.json({ 
    success: true, 
    document: updatedDoc.rows[0] 
  });
}));

// Delete document
router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const user = req.user;
  const pool = req.app.locals.pool;

  const deleteResult = await pool.query(
    'DELETE FROM documents WHERE id = $1 AND user_id = $2 RETURNING id, file_path',
    [id, user.id]
  );

  if (deleteResult.rowCount === 0) {
    throw new NotFoundError('Document not found or access denied');
  }

  // Delete associated file if exists
  const filePath = deleteResult.rows[0].file_path;
  if (filePath) {
    try {
      await fs.unlink(filePath);
    } catch (error) {
      logger.error('Failed to delete document file:', {
        error,
        filePath,
        documentId: id
      });
    }
  }

  logger.info('Document deleted', {
    documentId: id,
    userId: user.id,
    requestId: req.id
  });

  res.json({ 
    success: true, 
    message: 'Document deleted successfully' 
  });
}));

module.exports = router;