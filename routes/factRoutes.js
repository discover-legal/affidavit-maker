// routes/factRoutes.js - NEW: On-demand professional rewrite endpoint

const express = require('express');
const router = express.Router();
const { optionalAuth } = require('../middleware/auth');
const { validateInput } = require('../middleware/validation');
const logger = require('../utils/logger');

/**
 * POST /api/facts/rewrite
 * Generate professional rewrite for a single fact on-demand
 */
router.post('/rewrite', optionalAuth, async (req, res) => {
  try {
    const { fact, allFacts, factIndex, context } = req.body;

    // Validate input
    if (!fact || !fact.content) {
      return res.status(400).json({
        success: false,
        error: 'Fact content is required'
      });
    }

    if (fact.content.length > 1000) {
      return res.status(400).json({
        success: false,
        error: 'Fact is too long (maximum 1000 characters)'
      });
    }

    // Get validation service
    const validationService = req.app.locals.enhancedFactValidationService;
    if (!validationService) {
      return res.status(503).json({
        success: false,
        error: 'Rewrite service temporarily unavailable'
      });
    }

    // Generate professional rewrite with full context
    const professionalRewrite = await validationService.generateProfessionalRewriteWithLLM(
      fact,
      context,
      allFacts,
      factIndex
    );

    logger.info('Professional rewrite generated', {
      userId: req.user?.id || 'anonymous',
      factLength: fact.content.length,
      rewriteLength: professionalRewrite.length,
      category: fact.category
    });

    return res.json({
      success: true,
      professionalRewrite,
      original: fact.content,
      category: fact.category
    });

  } catch (error) {
    logger.error('Professional rewrite failed:', {
      error: error.message,
      userId: req.user?.id || 'anonymous'
    });

    return res.status(500).json({
      success: false,
      error: 'Failed to generate professional rewrite'
    });
  }
});

module.exports = router;