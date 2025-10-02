// routes/documents.js - COMPLETE FIXED VERSION (Drop-in Replacement)
// This version fixes the enhancePreviewWithCategories function that was overwriting processed facts

const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const { asyncHandler } = require('../middleware/errorMiddleware');
const { auth0Middleware, optionalAuth } = require('../middleware/auth0Middleware');
const { standardLimiter } = require('../middleware/rateLimiting');
const { validatePreview, validateDocumentSave } = require('../middleware/validation');
const { prepareFactsForStorage } = require('../utils/factNormalizer');


/**
 * ✅ FIXED: Preview generation with proper facts processing
 */
router.post('/preview', 
  validatePreview,
  optionalAuth, // Allow both authenticated and anonymous preview generation
  standardLimiter,
  asyncHandler(async (req, res) => {
    const { affidavitData } = req.body;
    
    // Input validation
    if (!affidavitData || typeof affidavitData !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'affidavitData is required'
      });
    }

    try {
      const templateManager = req.app.locals.templateManager;
      
      if (!templateManager) {
        // ✅ FALLBACK: Create basic preview without template manager
        return res.json({
          success: true,
          preview: createFallbackPreview(affidavitData),
          fallback: true
        });
      }

      // ✅ Check for cached preview first (only for authenticated users)
      const pool = req.app.locals.pool;
      const userId = req.user?.id;
      
      if (pool && userId && affidavitData.documentId) {
        try {
          const cachedResult = await pool.query(
            'SELECT preview_data, last_preview_generated FROM documents WHERE id = $1 AND user_id = $2',
            [affidavitData.documentId, userId]
          );
          
          if (cachedResult.rows.length > 0) {
            const cached = cachedResult.rows[0];
            // Use cache if less than 5 minutes old
            if (cached.last_preview_generated && 
                Date.now() - new Date(cached.last_preview_generated).getTime() < 5 * 60 * 1000) {
              
              logger.info('Using cached preview', { documentId: affidavitData.documentId });
              return res.json({
                success: true,
                preview: cached.preview_data,
                fromCache: true
              });
            }
          }
        } catch (cacheError) {
          logger.warn('Preview cache check failed', { error: cacheError.message });
          // Continue to generate fresh preview
        }
      }

      // ✅ Generate new preview with enhanced error handling
      let preview;
      try {
        preview = templateManager.generatePreview(affidavitData);
        logger.info('StateTemplateManager preview generated successfully');
      } catch (templateError) {
        logger.warn('Template manager preview failed, using fallback', { 
          error: templateError.message 
        });
        preview = createFallbackPreview(affidavitData);
      }

      // ✅ FIXED: Enhance preview WITHOUT overwriting processed facts content
      const enhancedPreview = enhancePreviewWithCategories(preview, affidavitData);
      
      // ✅ Cache the preview if we have database access
      if (pool && userId && affidavitData.documentId) {
        try {
          await pool.query(
            `UPDATE documents 
             SET preview_data = $1, last_preview_generated = CURRENT_TIMESTAMP 
             WHERE id = $2 AND user_id = $3`,
            [JSON.stringify(enhancedPreview), affidavitData.documentId, userId]
          );
        } catch (cacheError) {
          logger.warn('Preview cache update failed', { error: cacheError.message });
          // Don't fail the request if caching fails
        }
      }

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
      
      // ✅ Always return a preview, even if basic
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
 * ✅ FIXED: Save document with enhanced validation and preview caching
 */
router.post('/save', 
  validateDocumentSave,
  auth0Middleware,
  standardLimiter,
  asyncHandler(async (req, res) => {
    const { affidavitData, validation, categories } = req.body;
    const userId = req.user.id;
    const pool = req.app.locals.pool;

    // ✅ CRITICAL FIX: Validate affidavitData exists before accessing properties
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
      // ✅ FIXED: Normalize facts before saving to ensure consistent structure
      const normalizedFacts = affidavitData.facts 
        ? prepareFactsForStorage(affidavitData.facts)
        : [];

      // ✅ FIXED: Safe title generation with proper null checking
      const documentTitle = affidavitData.affiantName 
        ? `Affidavit of ${affidavitData.affiantName}` 
        : 'Untitled Affidavit';
      
      // Prepare document data with normalized facts
      const documentData = {
        content: JSON.stringify({
          ...affidavitData,
          facts: normalizedFacts // Use normalized facts
        }),
        status: 'draft',
        template_state: affidavitData.state || 'TX',
        document_type: affidavitData.documentType || 'general',
        validation_result: validation || null,
        fact_categories: categories || null,
        processing_metadata: {
          lastModified: new Date().toISOString(),
          factCount: normalizedFacts.length,
          completionScore: calculateCompletionScore({ 
            sections: { 
              facts: { 
                items: normalizedFacts 
              } 
            } 
          })
        }
      };

      let result;
      
      // Update existing document or create new one
      if (affidavitData.documentId) {
        // Update existing document
        result = await pool.query(
          `UPDATE documents 
           SET title = $1, content = $2, status = $3, template_state = $4, 
               document_type = $5, validation_result = $6, fact_categories = $7,
               processing_metadata = $8, updated_at = CURRENT_TIMESTAMP
           WHERE id = $9 AND user_id = $10
           RETURNING *`,
          [
            documentTitle, documentData.content, documentData.status,
            documentData.template_state, documentData.document_type,
            documentData.validation_result, documentData.fact_categories,
            documentData.processing_metadata, affidavitData.documentId, userId
          ]
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
          `INSERT INTO documents 
           (user_id, title, content, status, template_state, document_type, 
            validation_result, fact_categories, processing_metadata, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
           RETURNING *`,
          [
            userId, documentTitle, documentData.content, documentData.status,
            documentData.template_state, documentData.document_type,
            documentData.validation_result, documentData.fact_categories,
            documentData.processing_metadata
          ]
        );
      }

      const savedDocument = result.rows[0];

      logger.info('Document saved successfully', {
        documentId: savedDocument.id,
        userId,
        factCount: normalizedFacts.length,
        isUpdate: !!affidavitData.documentId
      });

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
 * ✅ Get user's documents with pagination and filtering
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

      // Build query with optional filters
      let query = `
        SELECT id, title, status, template_state, document_type, 
               processing_metadata, created_at, updated_at
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

      // Get total count for pagination
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
        documents: result.rows,
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
      
      // Parse content safely
      let content;
      try {
        content = typeof doc.content === 'string' ? JSON.parse(doc.content) : doc.content;
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
 * ✅ COMPLETELY FIXED: Enhance preview with category information
 * Keeps BOTH formatted string for PDF AND items array for UI
 * Never overwrites processed facts from StateTemplateManager
 */
function enhancePreviewWithCategories(preview, affidavitData) {
  if (!preview || !preview.sections) {
    return preview;
  }

  const enhanced = { ...preview };
  
  // Only enhance if we have facts
  if (!affidavitData.facts || affidavitData.facts.length === 0) {
    return enhanced;
  }

  // Check if StateTemplateManager already processed facts into a formatted string
  const hasFormattedString = typeof enhanced.sections.facts?.content === 'string' && 
                             enhanced.sections.facts.content.length > 10 && 
                             !enhanced.sections.facts.content.includes('No facts');

  if (hasFormattedString) {
    // StateTemplateManager already formatted facts for PDF
    // Keep the formatted string AND add items array for UI
    enhanced.sections.facts = {
      ...enhanced.sections.facts,
      formatted: enhanced.sections.facts.content, // For PDF generation
      items: prepareFactsForDisplay(affidavitData.facts), // For UI display
      metadata: {
        totalFacts: affidavitData.facts.length,
        categories: getCategorySummary(affidavitData.facts),
        qualityMetrics: calculateQualityMetrics(affidavitData.facts)
      }
    };
  } else {
    // StateTemplateManager didn't process facts - create both formats
    const items = prepareFactsForDisplay(affidavitData.facts);
    
    // Create formatted string for PDF
    const formatted = items.map((fact, index) => 
      `${index + 1}. ${fact.displayContent}`
    ).join('\n\n');
    
    enhanced.sections.facts = {
      type: 'facts',
      title: 'STATEMENT OF FACTS',
      formatted: formatted, // For PDF
      items: items, // For UI
      metadata: {
        totalFacts: affidavitData.facts.length,
        categories: getCategorySummary(affidavitData.facts),
        qualityMetrics: calculateQualityMetrics(affidavitData.facts)
      }
    };
  }
  
  return enhanced;
}

/**
 * Helper: Get category summary
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
 * Helper: Calculate quality metrics
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
 * ✅ Helper: Create fallback preview when template manager fails
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
          : 'No facts have been added yet. Start chatting to add facts to your affidavit.'
      },
      conclusion: {
        type: 'conclusion',
        title: 'CONCLUSION',
        content: `I declare under penalty of perjury that the foregoing is true and correct to the best of my knowledge and belief.\n\nFURTHER AFFIANT SAYETH NOT.`
      },
      signature: {
        type: 'signature',
        title: 'SIGNATURE AND NOTARIZATION',
        content: `Executed on this _____ day of _________, 2025.\n\n\n_________________________________\n${affidavitData.affiantName || '[NAME]'}\n\nNOTARY ACKNOWLEDGMENT\n[Notary section will be completed at signing]`
      }
    },
    metadata: {
      stateName: getStateName(affidavitData.state),
      estimatedPages: Math.max(1, Math.ceil((facts.length * 2 + 4) / 25)),
      wordCount: estimateWordCount(facts),
      factCount: facts.length,
      isComplete: !!(affidavitData.affiantName && affidavitData.state && facts.length > 0),
      isFallback: true
    }
  };
}

/**
 * ✅ Get category summary for metadata
 */
function getCategorySummary(facts) {
  if (!Array.isArray(facts)) return {};
  
  const summary = {};
  facts.forEach(fact => {
    const category = fact.category || 'general';
    if (!summary[category]) {
      summary[category] = { count: 0, issues: 0 };
    }
    summary[category].count++;
    if (fact.severity === 'critical' || fact.severity === 'warning') {
      summary[category].issues++;
    }
  });
  
  return summary;
}

/**
 * ✅ Calculate quality metrics
 */
function calculateQualityMetrics(facts) {
  if (!Array.isArray(facts) || facts.length === 0) {
    return { score: 0, issues: 0, completeness: 0 };
  }
  
  const totalFacts = facts.length;
  const criticalIssues = facts.filter(f => f.severity === 'critical').length;
  const warnings = facts.filter(f => f.severity === 'warning').length;
  const avgConfidence = facts.reduce((sum, f) => sum + (f.confidence || 0.8), 0) / totalFacts;
  
  const score = Math.max(0, Math.min(10, 
    (avgConfidence * 10) - (criticalIssues * 3) - (warnings * 1)
  ));
  
  return {
    score: Math.round(score * 10) / 10,
    avgConfidence: Math.round(avgConfidence * 100) / 100,
    criticalIssues,
    warnings,
    completeness: totalFacts >= 3 ? 100 : Math.round((totalFacts / 3) * 100)
  };
}

/**
 * ✅ Helper functions
 */
function getStateName(stateCode) {
  const stateMap = {
    'TX': 'Texas',
    'UT': 'Utah', 
    'AZ': 'Arizona'
  };
  return stateMap[stateCode] || stateCode || 'Unknown';
}

function estimateWordCount(facts) {
  if (!Array.isArray(facts)) return 0;
  return facts.reduce((count, fact) => {
    const content = fact.professionalRewrite || fact.content || '';
    return count + (content.split(/\s+/).length || 0);
  }, 0);
}

/**
 * Helper: Calculate completion score
 */
function calculateCompletionScore(preview) {
  let score = 0;
  const maxScore = 100;
  
  if (!preview || !preview.sections) return 0;
  
  // Basic info (30 points)
  if (preview.sections.header) score += 15;
  if (preview.sections.introduction) score += 15;
  
  // Facts (50 points)
  if (preview.sections.facts?.items?.length > 0) {
    const factScore = Math.min(50, preview.sections.facts.items.length * 10);
    score += factScore;
  }
  
  // Footer (20 points)
  if (preview.sections.signature) score += 10;
  if (preview.sections.notary) score += 10;
  
  return Math.min(maxScore, score);
}

module.exports = router;