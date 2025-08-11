// routes/documents.js - Document Routes with SQL Protection
const express = require('express');
const router = express.Router();

const logger = require('../utils/logger');
const { asyncHandler, NotFoundError, AuthorizationError } = require('../middleware/errorMiddleware');
const { auth0Middleware } = require('../middleware/auth0Middleware');
const { 
  validateDocumentSave, 
  validateAffidavitData, 
  validateId, 
  validatePagination 
} = require('../middleware/validation');
const { strictLimiter, pdfLimiter } = require('../middleware/rateLimiting');
const { escapeIdentifier, escapeLike } = require('../config/database');

/**
 * Helper function to safely build ORDER BY clause
 */
const buildOrderByClause = (sort = 'created_at', order = 'DESC') => {
  const allowedSortFields = ['created_at', 'updated_at', 'title', 'status'];
  const allowedOrders = ['ASC', 'DESC'];
  
  const safeSort = allowedSortFields.includes(sort) ? sort : 'created_at';
  const safeOrder = allowedOrders.includes(order.toUpperCase()) ? order.toUpperCase() : 'DESC';
  
  return `${safeSort} ${safeOrder}`;
};

/**
 * Helper function to verify document ownership
 */
const verifyDocumentOwnership = async (pool, documentId, userId) => {
  const result = await pool.query(
    'SELECT id, user_id, title, status FROM documents WHERE id = $1',
    [documentId]
  );
  
  if (result.rows.length === 0) {
    throw new NotFoundError('Document not found');
  }
  
  const document = result.rows[0];
  if (document.user_id !== userId) {
    throw new AuthorizationError('You do not have permission to access this document');
  }
  
  return document;
};

/**
 * Generate document preview
 */
router.post('/preview', 
  auth0Middleware,
  validateAffidavitData,
  asyncHandler(async (req, res) => {
    const { affidavitData } = req.body;
    const userId = req.user.id;

    logger.logBusinessEvent('preview_requested', userId, {
      state: affidavitData.state,
      hasName: !!affidavitData.affiantName,
      factCount: affidavitData.facts?.length || 0
    });

    // Check if affidavit service is available
    if (!req.app.locals.affidavitService) {
      throw new Error('Preview service is not available. Please try again later.');
    }

    const result = await req.app.locals.affidavitService.generatePreview(affidavitData);

    if (!result.success) {
      throw new Error(result.error || 'Preview generation failed');
    }

    res.sendSuccess({
      preview: result.preview,
      validation: result.validation,
      metadata: result.metadata
    });
  })
);

/**
 * Save document draft
 */
router.post('/save-draft',
  auth0Middleware,
  validateDocumentSave,
  asyncHandler(async (req, res) => {
    const { title, content, status = 'draft' } = req.body;
    const userId = req.user.id;
    const pool = req.app.locals.pool;

    logger.logBusinessEvent('draft_saved', userId, {
      title: title.substring(0, 50),
      status,
      contentSize: JSON.stringify(content).length
    });

    const result = await pool.query(
      `INSERT INTO documents (user_id, title, content, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING id, title, status, created_at`,
      [userId, title, JSON.stringify(content), status]
    );

    res.sendSuccess({
      document: result.rows[0],
      message: 'Draft saved successfully'
    });
  })
);

/**
 * Update existing document
 */
router.put('/:id',
  auth0Middleware,
  validateId,
  validateDocumentSave,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { title, content, status } = req.body;
    const userId = req.user.id;
    const pool = req.app.locals.pool;

    // Verify ownership first
    await verifyDocumentOwnership(pool, id, userId);

    logger.logBusinessEvent('document_updated', userId, {
      documentId: id,
      title: title.substring(0, 50),
      status,
      contentSize: JSON.stringify(content).length
    });

    const result = await pool.query(
      `UPDATE documents 
       SET title = $1, content = $2, status = $3, updated_at = CURRENT_TIMESTAMP
       WHERE id = $4 AND user_id = $5
       RETURNING id, title, status, updated_at`,
      [title, JSON.stringify(content), status, id, userId]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Document not found or you do not have permission to update it');
    }

    res.sendSuccess({
      document: result.rows[0],
      message: 'Document updated successfully'
    });
  })
);

/**
 * Get user's documents with pagination and filtering
 */
router.get('/',
  auth0Middleware,
  validatePagination,
  asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const pool = req.app.locals.pool;
    
    // Safely handle query parameters
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));
    const offset = (page - 1) * limit;
    const status = req.query.status;
    const search = req.query.search;
    const sort = req.query.sort || 'created_at';
    const order = req.query.order || 'DESC';

    // Build WHERE clause safely
    let whereClause = 'WHERE user_id = $1';
    const queryParams = [userId];
    let paramIndex = 2;

    // Add status filter if provided
    if (status && ['draft', 'completed', 'archived'].includes(status)) {
      whereClause += ` AND status = $${paramIndex}`;
      queryParams.push(status);
      paramIndex++;
    }

    // Add search filter if provided (safe LIKE query)
    if (search && search.trim().length > 0) {
      const searchTerm = `%${escapeLike(search.trim())}%`;
      whereClause += ` AND (title ILIKE $${paramIndex} OR content::text ILIKE $${paramIndex})`;
      queryParams.push(searchTerm);
      paramIndex++;
    }

    // Build ORDER BY clause safely
    const orderByClause = buildOrderByClause(sort, order);

    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM documents 
      ${whereClause}
    `;
    const countResult = await pool.query(countQuery, queryParams);
    const total = parseInt(countResult.rows[0].total);

    // Get documents with pagination
    const documentsQuery = `
      SELECT 
        id, 
        title, 
        status, 
        created_at, 
        updated_at,
        CASE 
          WHEN LENGTH(content::text) > 500 
          THEN LEFT(content::text, 500) || '...' 
          ELSE content::text 
        END as content_preview
      FROM documents 
      ${whereClause}
      ORDER BY ${orderByClause}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    
    queryParams.push(limit, offset);
    const documentsResult = await pool.query(documentsQuery, queryParams);

    logger.logBusinessEvent('documents_listed', userId, {
      page,
      limit,
      total,
      status,
      hasSearch: !!search,
      resultCount: documentsResult.rows.length
    });

    res.sendPaginated(
      documentsResult.rows,
      page,
      limit,
      total,
      {
        filters: { status, search },
        sort: { field: sort, order }
      }
    );
  })
);

/**
 * Get specific document by ID
 */
router.get('/:id',
  auth0Middleware,
  validateId,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;
    const pool = req.app.locals.pool;

    const result = await pool.query(
      `SELECT id, title, content, status, created_at, updated_at
       FROM documents 
       WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Document not found');
    }

    const document = result.rows[0];
    
    // Parse content if it's JSON string
    if (typeof document.content === 'string') {
      try {
        document.content = JSON.parse(document.content);
      } catch (error) {
        logger.warn('Failed to parse document content as JSON', {
          documentId: id,
          userId,
          error: error.message
        });
      }
    }

    logger.logBusinessEvent('document_viewed', userId, {
      documentId: id,
      title: document.title.substring(0, 50)
    });

    res.sendSuccess({ document });
  })
);

/**
 * Delete document
 */
router.delete('/:id',
  auth0Middleware,
  validateId,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;
    const pool = req.app.locals.pool;

    // Verify ownership first
    const document = await verifyDocumentOwnership(pool, id, userId);

    const result = await pool.query(
      'DELETE FROM documents WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, userId]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Document not found');
    }

    logger.logBusinessEvent('document_deleted', userId, {
      documentId: id,
      title: document.title.substring(0, 50)
    });

    res.sendSuccess({
      message: 'Document deleted successfully',
      documentId: id
    });
  })
);

/**
 * Validate affidavit data
 */
router.post('/validate',
  auth0Middleware,
  validateAffidavitData,
  asyncHandler(async (req, res) => {
    const { affidavitData } = req.body;
    const userId = req.user.id;

    if (!req.app.locals.affidavitService) {
      throw new Error('Validation service is not available. Please try again later.');
    }

    const validation = await req.app.locals.affidavitService.validateAffidavit(affidavitData);

    logger.logBusinessEvent('validation_requested', userId, {
      state: affidavitData.state,
      isValid: validation.isValid,
      errorCount: validation.errors?.length || 0,
      warningCount: validation.warnings?.length || 0
    });

    res.sendSuccess({ validation });
  })
);

/**
 * Generate final affidavit (after payment verification)
 */
router.post('/generate',
  strictLimiter, // More restrictive rate limiting for PDF generation
  pdfLimiter,
  auth0Middleware,
  validateAffidavitData,
  asyncHandler(async (req, res) => {
    const { affidavitData, documentId, paymentIntentId } = req.body;
    const userId = req.user.id;
    const pool = req.app.locals.pool;

    // Verify payment if provided
    if (paymentIntentId) {
      const paymentResult = await pool.query(
        'SELECT id, status FROM payments WHERE stripe_payment_intent_id = $1 AND user_id = $2',
        [paymentIntentId, userId]
      );

      if (paymentResult.rows.length === 0 || paymentResult.rows[0].status !== 'succeeded') {
        throw new AuthorizationError('Valid payment required to generate final document');
      }
    }

    logger.logBusinessEvent('final_generation_requested', userId, {
      documentId,
      paymentIntentId,
      state: affidavitData.state,
      hasPayment: !!paymentIntentId
    });

    if (!req.app.locals.affidavitService) {
      throw new Error('Document generation service is not available. Please try again later.');
    }

    const result = await req.app.locals.affidavitService.generateFinalDocument(affidavitData, {
      userId,
      documentId,
      includeWatermark: !paymentIntentId // Add watermark if no payment
    });

    if (!result.success) {
      throw new Error(result.error || 'Document generation failed');
    }

    logger.logBusinessEvent('final_generation_completed', userId, {
      documentId,
      downloadUrl: result.documentUrl,
      hasWatermark: !paymentIntentId
    });

    res.sendSuccess({
      documentUrl: result.documentUrl,
      downloadToken: result.downloadToken,
      expiresAt: result.expiresAt
    });
  })
);

module.exports = router;