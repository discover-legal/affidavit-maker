// routes/documents.js - Enhanced with Preview Fix and Consolidated Data Support
const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const { asyncHandler } = require('../middleware/errorMiddleware');
const { auth0Middleware } = require('../middleware/auth0Middleware');
const { standardLimiter } = require('../middleware/rateLimiting');

/**
 * ✅ ENHANCED: Preview generation with fallback and caching
 */
router.post('/preview', 
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

      // ✅ Check for cached preview first
      const pool = req.app.locals.pool;
      const userId = req.user?.id;
      
      if (pool && userId && affidavitData.documentId) {
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
      }

      // ✅ Generate new preview with enhanced error handling
      let preview;
      try {
        preview = await templateManager.generatePreview(affidavitData);
      } catch (templateError) {
        logger.warn('Template manager preview failed, using fallback', { 
          error: templateError.message 
        });
        preview = createFallbackPreview(affidavitData);
      }

      // ✅ Enhance preview with consolidated data
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
 * ✅ Save document with enhanced validation and preview caching
 */
router.post('/save', 
  auth0Middleware,
  standardLimiter,
  asyncHandler(async (req, res) => {
    const { affidavitData, validation, categories } = req.body;
    const userId = req.user.id;
    const pool = req.app.locals.pool;

    if (!pool) {
      return res.status(503).json({
        success: false,
        error: 'Database service unavailable'
      });
    }

    try {
      // ✅ Enhanced save with new schema columns
      const result = await pool.query(
        `INSERT INTO documents (
          user_id, content, status, title, document_type,
          validation_result, fact_categories, processing_metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
        RETURNING id, created_at`,
        [
          userId,
          JSON.stringify(affidavitData),
          'draft',
          `Affidavit - ${affidavitData.affiantName || 'Draft'}`,
          affidavitData.documentType || 'general',
          JSON.stringify(validation || {}),
          JSON.stringify(categories || {}),
          JSON.stringify({
            savedAt: new Date().toISOString(),
            factCount: affidavitData.facts?.length || 0,
            processingMethod: 'consolidated_llm',
            version: '3.0.0'
          })
        ]
      );

      const documentId = result.rows[0].id;

      logger.logBusinessEvent('document_saved', userId, {
        documentId,
        factCount: affidavitData.facts?.length || 0,
        categories: Object.keys(categories || {}),
        hasValidation: !!validation
      });

      res.json({
        success: true,
        message: 'Document saved successfully',
        documentId,
        createdAt: result.rows[0].created_at
      });

    } catch (error) {
      logger.error('Save document failed', { 
        error: error.message,
        userId,
        factCount: affidavitData.facts?.length || 0
      });

      res.status(500).json({
        success: false,
        error: 'Failed to save document. Please try again.'
      });
    }
  })
);

/**
 * ✅ Get user's documents with enhanced metadata
 */
router.get('/', 
  auth0Middleware,
  standardLimiter,
  asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const pool = req.app.locals.pool;
    const { page = 1, limit = 10, status } = req.query;

    if (!pool) {
      return res.status(503).json({
        success: false,
        error: 'Database service unavailable'
      });
    }

    try {
      let query = `
        SELECT 
          id, title, status, document_type, created_at, updated_at,
          (content->>'affiantName') as affiant_name,
          (content->>'state') as state,
          (content->>'facts') as facts_json,
          validation_result,
          fact_categories,
          processing_metadata
        FROM documents 
        WHERE user_id = $1
      `;
      
      const params = [userId];
      
      if (status) {
        query += ` AND status = $${params.length + 1}`;
        params.push(status);
      }
      
      query += ` ORDER BY updated_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));

      const result = await pool.query(query, params);
      
      // Enhanced document list with metadata
      const documents = result.rows.map(row => {
        const facts = row.facts_json ? JSON.parse(row.facts_json) : [];
        const validation = row.validation_result || {};
        const categories = row.fact_categories || {};
        
        return {
          id: row.id,
          title: row.title,
          status: row.status,
          documentType: row.document_type,
          affiantName: row.affiant_name,
          state: row.state,
          factCount: facts.length,
          categories: Object.keys(categories),
          qualityScore: validation.overall_quality_score || 0,
          hasIssues: (validation.critical_issues || 0) > 0,
          createdAt: row.created_at,
          updatedAt: row.updated_at
        };
      });

      // Get total count for pagination
      const countResult = await pool.query(
        'SELECT COUNT(*) FROM documents WHERE user_id = $1' + (status ? ' AND status = $2' : ''),
        status ? [userId, status] : [userId]
      );
      
      const total = parseInt(countResult.rows[0].count);

      res.json({
        success: true,
        documents,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / limit)
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
 * ✅ Helper: Create fallback preview when template manager fails
 */
function createFallbackPreview(affidavitData) {
  const facts = affidavitData.facts || [];
  
  return {
    sections: {
      header: {
        type: 'header',
        title: 'AFFIDAVIT',
        content: `STATE OF ${affidavitData.state || '[STATE]'}
COUNTY OF ${affidavitData.county || '[COUNTY]'}

BEFORE ME, the undersigned notary public, personally appeared ${affidavitData.affiantName || '[NAME]'}, who proved to me on the basis of satisfactory evidence to be the person whose name is subscribed to the within instrument and acknowledged to me that he/she executed the same in his/her authorized capacity, and that by his/her signature on the instrument the person, or the entity upon behalf of which the person acted, executed the instrument.`
      },
      facts: {
        type: 'facts',
        title: 'FACTS',
        content: facts.length > 0 
          ? facts.map((fact, index) => {
              const content = fact.professionalRewrite || fact.content || fact;
              return `${index + 1}. ${content}`;
            }).join('\n\n')
          : 'No facts have been added yet.'
      },
      signature: {
        type: 'signature',
        title: 'SIGNATURE',
        content: `I declare under penalty of perjury that the foregoing is true and correct.

Executed on _____________, 2025.

_________________________________
${affidavitData.affiantName || '[NAME]'}

NOTARY ACKNOWLEDGMENT
[Notary section will be completed at signing]`
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
 * ✅ Enhance preview with category information
 */
function enhancePreviewWithCategories(preview, affidavitData) {
  if (!preview || !affidavitData.facts) return preview;
  
  const enhanced = { ...preview };
  
  // Add category breakdown to metadata
  if (!enhanced.metadata) enhanced.metadata = {};
  
  enhanced.metadata.categories = getCategorySummary(affidavitData.facts);
  enhanced.metadata.qualityMetrics = calculateQualityMetrics(affidavitData.facts);
  
  // Enhance facts section with category information
  if (enhanced.sections?.facts && Array.isArray(affidavitData.facts)) {
    enhanced.sections.facts = affidavitData.facts.map(fact => ({
      ...fact,
      category: fact.category || 'general',
      displayContent: fact.professionalRewrite || fact.content,
      hasIssues: (fact.validationIssues || []).length > 0,
      severity: fact.severity || 'success'
    }));
  }
  
  return enhanced;
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

function calculateCompletionScore(preview) {
  let score = 0;
  const maxScore = 100;
  
  // Name (25 points)
  if (preview.sections?.header?.content?.includes('[NAME]') === false) score += 25;
  
  // State (15 points)
  if (preview.sections?.header?.content?.includes('[STATE]') === false) score += 15;
  
  // Facts (50 points)
  const factContent = preview.sections?.facts?.content || '';
  if (factContent && !factContent.includes('No facts')) {
    const factCount = (factContent.match(/\d+\./g) || []).length;
    score += Math.min(50, factCount * 8);
  }
  
  // County (10 points)
  if (preview.sections?.header?.content?.includes('[COUNTY]') === false) score += 10;
  
  return Math.round((score / maxScore) * 100);
}

/**
 * ✅ Update existing document with enhanced support
 */
router.put('/:id',
  auth0Middleware,
  standardLimiter,
  asyncHandler(async (req, res) => {
    const documentId = req.params.id;
    const userId = req.user.id;
    const { affidavitData, validation, categories } = req.body;
    const pool = req.app.locals.pool;

    if (!pool) {
      return res.status(503).json({
        success: false,
        error: 'Database service unavailable'
      });
    }

    try {
      // ✅ Enhanced update with all new columns
      const result = await pool.query(
        `UPDATE documents 
         SET 
           content = $1, 
           title = $2,
           updated_at = CURRENT_TIMESTAMP,
           validation_result = $3,
           fact_categories = $4,
           processing_metadata = $5,
           preview_data = NULL,
           last_preview_generated = NULL
         WHERE id = $6 AND user_id = $7 
         RETURNING id, updated_at`,
        [
          JSON.stringify(affidavitData),
          `Affidavit - ${affidavitData.affiantName || 'Draft'}`,
          JSON.stringify(validation || {}),
          JSON.stringify(categories || {}),
          JSON.stringify({
            lastUpdate: new Date().toISOString(),
            factCount: affidavitData.facts?.length || 0,
            updateMethod: 'consolidated_llm',
            version: '3.0.0'
          }),
          documentId,
          userId
        ]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Document not found'
        });
      }

      logger.logBusinessEvent('document_updated', userId, {
        documentId,
        factCount: affidavitData.facts?.length || 0,
        categories: Object.keys(categories || {})
      });

      res.json({
        success: true,
        message: 'Document updated successfully',
        documentId,
        updatedAt: result.rows[0].updated_at
      });

    } catch (error) {
      logger.error('Update document failed', { 
        error: error.message, 
        documentId, 
        userId 
      });

      res.status(500).json({
        success: false,
        error: 'Failed to update document'
      });
    }
  })
);

/**
 * ✅ Get specific document with enhanced data
 */
router.get('/:id',
  auth0Middleware,
  standardLimiter,
  asyncHandler(async (req, res) => {
    const documentId = req.params.id;
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
        `SELECT 
          id, title, status, content, document_type,
          validation_result, fact_categories, processing_metadata,
          preview_data, last_preview_generated,
          created_at, updated_at
         FROM documents 
         WHERE id = $1 AND user_id = $2`,
        [documentId, userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Document not found'
        });
      }

      const doc = result.rows[0];
      const content = typeof doc.content === 'string' ? JSON.parse(doc.content) : doc.content;

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

module.exports = router;