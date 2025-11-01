// routes/documents.js - COMPLETE DROP-IN REPLACEMENT with /generate endpoint
const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const { asyncHandler } = require('../middleware/errorMiddleware');
const { auth0Middleware, optionalAuth } = require('../middleware/auth0Middleware');
const { standardLimiter } = require('../middleware/rateLimiting');
const { validatePreview, validateDocumentSave } = require('../middleware/validation');
const { prepareFactsForStorage, prepareFactsForDisplay } = require('../utils/factNormalizer');

// Fixed preview route for routes/documents.js
// Add this to your routes/documents.js file, replacing the existing /preview route

router.post('/preview', 
  validatePreview,
  optionalAuth,
  standardLimiter,
  asyncHandler(async (req, res) => {
    const { affidavitData } = req.body;
    
    if (!affidavitData || typeof affidavitData !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'affidavitData is required'
      });
    }

    try {
      const templateManager = req.app.locals.templateManager;
      const pool = req.app.locals.pool;
      const userId = req.user?.id;

      // ✅ REMOVED: Preview caching to fix fact reorder issue
      // Preview caching was causing stale previews to be returned when facts were reordered.
      // The cache would return the old preview if it was less than 5 minutes old,
      // even though the facts had changed. We'll always generate a fresh preview now.

      // Generate new preview
      let preview;
      
      // FIX: Check if template manager exists AND has the correct method
      if (templateManager && typeof templateManager.generateDocument === 'function') {
        try {
          // Use generateDocument instead of generatePreview
          const template = templateManager.getTemplate(affidavitData.state || 'TX');
          const document = template.generateDocument(affidavitData);
          
          preview = {
            sections: document.sections || document,
            htmlContent: document.htmlContent,
            metadata: {
              wordCount: template.calculateWordCount ? 
                template.calculateWordCount(affidavitData.facts) : 
                (affidavitData.facts?.length || 0) * 50
            }
          };
          
          logger.info('StateTemplateManager preview generated successfully');
        } catch (templateError) {
          logger.warn('Template manager preview failed, using fallback', { 
            error: templateError.message 
          });
          preview = createFallbackPreview(affidavitData);
        }
      } else {
        // Use fallback if template manager not available
        logger.info('Template manager not available, using fallback preview');
        preview = createFallbackPreview(affidavitData);
      }

      // Enhance preview with categories
      const enhancedPreview = enhancePreviewWithCategories(preview, affidavitData);

      // ✅ REMOVED: Preview caching update
      // Cache updates have been removed to ensure previews always reflect current document state

      logger.info('Preview generated successfully', {
        hasTemplate: !!templateManager,
        documentId: affidavitData.documentId,
        factCount: affidavitData.facts?.length || 0
      });

      res.json({
        success: true,
        preview: enhancedPreview,
        metadata: {
          generatedAt: new Date().toISOString(),
          factCount: affidavitData.facts?.length || 0,
          categories: getCategorySummary(affidavitData.facts),
          completionScore: calculateCompletionScore(enhancedPreview)
        }
      });

    } catch (error) {
      logger.error('Preview generation failed', { error: error.message });
      
      res.json({
        success: true,
        preview: createFallbackPreview(affidavitData),
        fallback: true,
        error: error.message
      });
    }
  })
);

/**
 * ✅ NEW: Generate and download PDF
 */
router.post('/generate', 
  auth0Middleware,
  standardLimiter,
  asyncHandler(async (req, res) => {
    const { affidavitData, documentId, skipPayment } = req.body;
    const userId = req.user.id;
    const pool = req.app.locals.pool;
    const pdfService = req.app.locals.pdfService;
    const templateManager = req.app.locals.templateManager;

    // Validate inputs
    if (!affidavitData || typeof affidavitData !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Valid affidavit data is required'
      });
    }

    if (!pdfService) {
      return res.status(503).json({
        success: false,
        error: 'PDF generation service unavailable'
      });
    }

    try {
      // STEP 1: Check payment status (if not skipped)
      if (!skipPayment && pool) {
        try {
          const paymentCheck = await pool.query(
            'SELECT payment_status FROM documents WHERE id = $1 AND user_id = $2',
            [documentId, userId]
          );

          if (paymentCheck.rows.length === 0) {
            return res.status(404).json({
              success: false,
              error: 'Document not found'
            });
          }

          const paymentStatus = paymentCheck.rows[0].payment_status;
          if (paymentStatus !== 'completed' && paymentStatus !== 'free') {
            return res.status(402).json({
              success: false,
              error: 'Payment required',
              errorType: 'payment_required',
              documentId
            });
          }
        } catch (dbError) {
          logger.warn('Payment check failed, allowing generation', { 
            error: dbError.message 
          });
        }
      }

      // STEP 2: Generate document structure using template manager
      let documentStructure;
      if (templateManager) {
        try {
          documentStructure = templateManager.generateDocument(affidavitData);
        } catch (templateError) {
          logger.error('Template generation failed', { 
            error: templateError.message,
            state: affidavitData.state 
          });
          return res.status(400).json({
            success: false,
            error: 'Failed to generate document structure',
            details: templateError.message
          });
        }
      } else {
        // Fallback: create basic structure
        documentStructure = {
          sections: {
            header: affidavitData.state ? `THE STATE OF ${affidavitData.state}` : 'AFFIDAVIT',
            venue: affidavitData.county ? `COUNTY OF ${affidavitData.county}` : '',
            title: `AFFIDAVIT OF ${(affidavitData.affiantName || '[NAME]').toUpperCase()}`,
            introduction: `I, ${affidavitData.affiantName || '[NAME]'}, being duly sworn, do hereby state under oath as follows:`,
            facts: affidavitData.facts || [],
            conclusion: 'The facts stated herein are within my personal knowledge and are true and correct.',
            perjuryStatement: 'I declare under penalty of perjury that the foregoing is true and correct.',
            signatureBlock: {
              line: '_'.repeat(40),
              name: affidavitData.affiantName || '[AFFIANT NAME]',
              title: 'Affiant',
              date: `Date: ________________`
            },
            notaryBlock: `NOTARY ACKNOWLEDGMENT\n\nSworn to and subscribed before me this _____ day of _________, ${new Date().getFullYear()}.\n\n\n_________________________________\nNotary Public\n\nMy commission expires: ___________`
          },
          metadata: {
            documentId: documentId || 'draft',
            affiantName: affidavitData.affiantName,
            state: affidavitData.state,
            generatedAt: new Date().toISOString()
          }
        };
      }

      // STEP 3: Generate PDF using pdfService
      const result = await pdfService.generatePDF(documentStructure, {
        documentId: documentId || Date.now(),
        userId
      });

      if (!result.success || !result.filepath) {
        throw new Error('PDF generation failed - no filepath returned');
      }

      logger.info('PDF generated successfully', {
        documentId,
        userId,
        filepath: result.filepath,
        pages: result.pages
      });

      // STEP 4: Update document status in database
      if (pool && documentId) {
        try {
          await pool.query(
            `UPDATE documents 
             SET status = 'completed', 
                 pdf_generated_at = CURRENT_TIMESTAMP,
                 processing_metadata = jsonb_set(
                   COALESCE(processing_metadata, '{}'::jsonb),
                   '{pdfPages}',
                   $1::text::jsonb
                 )
             WHERE id = $2 AND user_id = $3`,
            [result.pages, documentId, userId]
          );
        } catch (dbError) {
          logger.warn('Failed to update document status', { 
            error: dbError.message 
          });
        }
      }

      // STEP 5: Stream PDF file to client
      const fs = require('fs');
      const stat = await fs.promises.stat(result.filepath);
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Length', stat.size);
      res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
      
      const fileStream = fs.createReadStream(result.filepath);
      fileStream.pipe(res);

      // STEP 6: Clean up PDF file after streaming
      fileStream.on('end', async () => {
        setTimeout(async () => {
          try {
            await fs.promises.unlink(result.filepath);
            logger.info('Cleaned up PDF file', { filepath: result.filepath });
          } catch (cleanupError) {
            logger.warn('Failed to cleanup PDF file', { 
              error: cleanupError.message 
            });
          }
        }, 60 * 60 * 1000); // 1 hour
      });

    } catch (error) {
      logger.error('PDF generation failed', { 
        error: error.message, 
        stack: error.stack,
        userId,
        documentId: affidavitData?.documentId 
      });

      res.status(500).json({
        success: false,
        error: 'Failed to generate PDF',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  })
);

/**
 * ✅ Save document endpoint
 */
router.post('/save', 
  validateDocumentSave,
  auth0Middleware,
  standardLimiter,
  asyncHandler(async (req, res) => {
    const { affidavitData, validation, categories } = req.body;
    const userId = req.user.id;
    const pool = req.app.locals.pool;

    if (!affidavitData || typeof affidavitData !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Valid affidavit data is required to save the document'
      });
    }

    if (!pool) {
      return res.status(503).json({
        success: false,
        error: 'Database service unavailable'
      });
    }

    try {
      const normalizedFacts = affidavitData.facts 
        ? prepareFactsForStorage(affidavitData.facts)
        : [];

      const documentTitle = affidavitData.affiantName 
        ? `Affidavit of ${affidavitData.affiantName}`
        : 'Untitled Affidavit';

      const contentToSave = {
        ...affidavitData,
        facts: normalizedFacts
      };

      let savedDocument;

      if (affidavitData.documentId) {
        // Update existing document
        const result = await pool.query(
          `UPDATE documents 
           SET content = $1,
               title = $2,
               template_state = $3,
               validation_result = $4,
               fact_categories = $5,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $6 AND user_id = $7
           RETURNING *`,
          [
            JSON.stringify(contentToSave),
            documentTitle,
            affidavitData.state || null,
            validation ? JSON.stringify(validation) : null,
            categories ? JSON.stringify(categories) : null,
            affidavitData.documentId,
            userId
          ]
        );

        if (result.rows.length === 0) {
          return res.status(404).json({
            success: false,
            error: 'Document not found'
          });
        }

        savedDocument = result.rows[0];
        logger.info('Document updated', { documentId: savedDocument.id, userId });
      } else {
        // Create new document
        const result = await pool.query(
          `INSERT INTO documents (
            user_id, title, content, template_state, document_type,
            status, validation_result, fact_categories, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          RETURNING *`,
          [
            userId,
            documentTitle,
            JSON.stringify(contentToSave),
            affidavitData.state || null,
            affidavitData.documentType || 'general',
            'draft',
            validation ? JSON.stringify(validation) : null,
            categories ? JSON.stringify(categories) : null
          ]
        );

        savedDocument = result.rows[0];
        logger.info('New document created', { documentId: savedDocument.id, userId });
      }

      res.json({
        success: true,
        message: 'Document saved successfully',
        document: {
          id: savedDocument.id,
          title: savedDocument.title,
          status: savedDocument.status,
          updatedAt: savedDocument.updated_at
        }
      });

    } catch (error) {
      logger.error('Save document failed', { 
        error: error.message, 
        userId,
        documentId: affidavitData?.documentId 
      });

      res.status(500).json({
        success: false,
        error: 'Failed to save document'
      });
    }
  })
);

/**
 * ✅ Get user's documents with pagination
 */
router.get('/', 
  auth0Middleware,
  standardLimiter,
  asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const pool = req.app.locals.pool;
    
    if (!pool) {
      return res.status(503).json({
        success: false,
        error: 'Database service unavailable'
      });
    }

    try {
      const { page = 1, limit = 10, status, state } = req.query;
      const offset = (parseInt(page) - 1) * parseInt(limit);

      let query = `
        SELECT id, title, status, template_state, document_type,
               processing_metadata, content, created_at, updated_at
        FROM documents
        WHERE user_id = $1
      `;
      let params = [userId];
      let paramIndex = 2;

      if (status) {
        query += ` AND status = $${paramIndex}`;
        params.push(status);
        paramIndex++;
      }

      if (state) {
        query += ` AND template_state = $${paramIndex}`;
        params.push(state);
        paramIndex++;
      }

      query += ` ORDER BY updated_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(parseInt(limit), offset);

      const result = await pool.query(query, params);

      // Process documents to extract state and facts from content
      const processedDocuments = result.rows.map(doc => {
        const processedDoc = { ...doc };

        // Extract state from content, fallback to template_state
        if (doc.content && doc.content.state) {
          processedDoc.state = doc.content.state;
        } else {
          processedDoc.state = doc.template_state;
        }

        // Extract facts array from content
        if (doc.content && doc.content.facts) {
          processedDoc.facts = doc.content.facts;
        } else {
          processedDoc.facts = [];
        }

        return processedDoc;
      });

      // Get total count
      let countQuery = 'SELECT COUNT(*) FROM documents WHERE user_id = $1';
      let countParams = [userId];
      let countParamIndex = 2;

      if (status) {
        countQuery += ` AND status = $${countParamIndex}`;
        countParams.push(status);
        countParamIndex++;
      }

      if (state) {
        countQuery += ` AND template_state = $${countParamIndex}`;
        countParams.push(state);
      }

      const countResult = await pool.query(countQuery, countParams);
      const totalCount = parseInt(countResult.rows[0].count);

      res.json({
        success: true,
        documents: processedDocuments,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalCount,
          pages: Math.ceil(totalCount / parseInt(limit))
        }
      });

    } catch (error) {
      logger.error('Get documents failed', { error: error.message, userId });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve documents'
      });
    }
  })
);

/**
 * ✅ Get specific document by ID
 */
router.get('/:id', 
  auth0Middleware,
  standardLimiter,
  asyncHandler(async (req, res) => {
    const { id: documentId } = req.params;
    const userId = req.user.id;
    const pool = req.app.locals.pool;

    if (!pool) {
      return res.status(503).json({
        success: false,
        error: 'Database service unavailable'
      });
    }

    try {
      const result = await pool.query(
        'SELECT * FROM documents WHERE id = $1 AND user_id = $2',
        [documentId, userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Document not found'
        });
      }

      const doc = result.rows[0];
      
      let content;
      try {
        content = typeof doc.content === 'string' ? 
          JSON.parse(doc.content) : doc.content;
      } catch (parseError) {
        logger.warn('Failed to parse document content', { documentId });
        content = doc.content;
      }

      res.json({
        success: true,
        document: {
          id: doc.id,
          title: doc.title,
          status: doc.status,
          documentType: doc.document_type,
          affidavitData: content,
          validation: doc.validation_result || {},
          categories: doc.fact_categories || {},
          metadata: doc.processing_metadata || {},
          previewCache: doc.preview_data,
          lastPreviewGenerated: doc.last_preview_generated,
          createdAt: doc.created_at,
          updatedAt: doc.updated_at
        }
      });

    } catch (error) {
      logger.error('Get document failed', { 
        error: error.message, 
        documentId, 
        userId 
      });

      res.status(500).json({
        success: false,
        error: 'Failed to retrieve document'
      });
    }
  })
);

/**
 * ✅ Delete document
 */
router.delete('/:id', 
  auth0Middleware,
  standardLimiter,
  asyncHandler(async (req, res) => {
    const { id: documentId } = req.params;
    const userId = req.user.id;
    const pool = req.app.locals.pool;

    if (!pool) {
      return res.status(503).json({
        success: false,
        error: 'Database service unavailable'
      });
    }

    try {
      const result = await pool.query(
        'DELETE FROM documents WHERE id = $1 AND user_id = $2 RETURNING id',
        [documentId, userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Document not found'
        });
      }

      logger.info('Document deleted', { documentId, userId });

      res.json({
        success: true,
        message: 'Document deleted successfully'
      });

    } catch (error) {
      logger.error('Delete document failed', { 
        error: error.message, 
        documentId, 
        userId 
      });

      res.status(500).json({
        success: false,
        error: 'Failed to delete document'
      });
    }
  })
);

/**
 * ✅ Helper: Enhance preview with category information
 */
function enhancePreviewWithCategories(preview, affidavitData) {
  if (!preview || !preview.sections) {
    return preview;
  }

  const enhanced = { ...preview };
  
  if (!affidavitData.facts || affidavitData.facts.length === 0) {
    return enhanced;
  }

  const items = prepareFactsForDisplay(affidavitData.facts);

  let formattedString = '';
  if (enhanced.sections.facts) {
    if (typeof enhanced.sections.facts === 'string') {
      formattedString = enhanced.sections.facts;
    } else if (enhanced.sections.facts.formatted) {
      formattedString = enhanced.sections.facts.formatted;
    } else if (items.length > 0) {
      formattedString = items.map(f => `${f.index}. ${f.displayContent}`).join('\n\n');
    }
  }

  enhanced.sections.facts = {
    type: 'facts',
    title: enhanced.sections.facts?.title || 'STATEMENT OF FACTS',
    formatted: formattedString,
    items: items,
    metadata: {
      totalFacts: affidavitData.facts.length,
      categories: getCategorySummary(affidavitData.facts),
      qualityMetrics: calculateQualityMetrics(affidavitData.facts)
    }
  };
  
  return enhanced;
}

/**
 * ✅ Helper: Get category summary
 */
function getCategorySummary(facts) {
  const categories = {};
  
  facts.forEach(fact => {
    const category = fact.category || 'general';
    categories[category] = (categories[category] || 0) + 1;
  });
  
  return categories;
}

/**
 * ✅ Helper: Calculate quality metrics
 */
function calculateQualityMetrics(facts) {
  const total = facts.length;
  if (total === 0) return { score: 0, hasIssues: 0, needsReview: 0 };
  
  const hasIssues = facts.filter(f => 
    (Array.isArray(f.issues) && f.issues.length > 0) ||
    (Array.isArray(f.languageIssues) && f.languageIssues.length > 0)
  ).length;
  
  const needsReview = facts.filter(f => 
    f.needsReview || 
    f.severity === 'error' || 
    f.severity === 'critical'
  ).length;
  
  const score = Math.round(((total - hasIssues - needsReview) / total) * 100);
  
  return { score, hasIssues, needsReview };
}

/**
 * ✅ Helper: Create fallback preview
 */
function createFallbackPreview(affidavitData) {
  const facts = affidavitData.facts || [];
  
  return {
    sections: {
      header: {
        type: 'header',
        title: 'AFFIDAVIT',
        content: `STATE OF ${getStateName(affidavitData.state)}`
      },
      venue: {
        type: 'venue',
        content: `STATE OF ${getStateName(affidavitData.state)}\nCOUNTY OF ${affidavitData.county || '[COUNTY]'}`
      },
      introduction: {
        type: 'introduction',
        title: 'INTRODUCTION',
        content: `I, ${affidavitData.affiantName || '[YOUR NAME]'}, being first duly sworn, depose and state as follows:`
      },
      facts: {
        type: 'facts',
        title: 'STATEMENT OF FACTS',
        content: facts.length > 0 
          ? facts.map((fact, index) => {
              const content = fact.professionalRewrite || fact.content || String(fact);
              return `${index + 1}. ${content}`;
            }).join('\n\n')
          : 'No facts have been added yet.'
      },
      conclusion: {
        type: 'conclusion',
        content: 'The facts stated herein are within my personal knowledge and are true and correct.'
      },
      signature: {
        type: 'signature',
        content: `\n\n_________________________________\n${affidavitData.affiantName || '[YOUR NAME]'}, Affiant`
      },
      notary: {
        type: 'notary',
        content: `NOTARY ACKNOWLEDGMENT\n\nSworn to and subscribed before me this _____ day of _________, ${new Date().getFullYear()}.\n\n\n_________________________________\nNotary Public\n\nMy commission expires: ___________`
      }
    },
    metadata: {
      fallback: true,
      totalFacts: facts.length,
      completionScore: facts.length > 0 ? Math.min(100, Math.round((facts.length / 3) * 100)) : 0
    }
  };
}

/**
 * ✅ Helper: Get state name
 */
function getStateName(stateCode) {
  const stateMap = {
    'TX': 'Texas',
    'UT': 'Utah', 
    'AZ': 'Arizona',
    'CA': 'California'
  };
  return stateMap[stateCode] || stateCode || 'Unknown';
}

/**
 * ✅ Helper: Estimate word count
 */
function estimateWordCount(facts) {
  if (!Array.isArray(facts)) return 0;
  return facts.reduce((count, fact) => {
    const content = fact.professionalRewrite || fact.content || '';
    return count + (content.split(/\s+/).length || 0);
  }, 0);
}

/**
 * ✅ Helper: Calculate completion score
 */
function calculateCompletionScore(preview) {
  let score = 0;
  const maxScore = 100;
  
  if (!preview || !preview.sections) return 0;
  
  if (preview.sections.header) score += 15;
  if (preview.sections.introduction) score += 15;
  
  if (preview.sections.facts?.items?.length > 0) {
    const factScore = Math.min(50, preview.sections.facts.items.length * 10);
    score += factScore;
  }
  
  if (preview.sections.signature) score += 10;
  if (preview.sections.notary) score += 10;
  
  return Math.min(maxScore, score);
}

module.exports = router;
