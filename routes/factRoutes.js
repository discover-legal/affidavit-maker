// routes/factRoutes.js - NEW: On-demand professional rewrite endpoint

const express = require('express');
const router = express.Router();
const { auth0Middleware } = require('../middleware/auth0Middleware');
const { asyncHandler } = require('../middleware/errorMiddleware');
const { chatLimiter } = require('../middleware/rateLimiting');
const logger = require('../utils/logger');

/**
 * POST /api/facts/rewrite
 * Generate professional rewrite for a single fact on-demand
 */
// SECURITY: Requires auth to prevent unauthenticated LLM cost exhaustion
router.post('/rewrite', chatLimiter, auth0Middleware, asyncHandler(async (req, res) => {
  const { fact, allFacts, factIndex, context } = req.body;

  // Validate input
  if (!fact || !fact.content) {
    return res.status(400).json({
      success: false,
      error: 'Fact content is required',
      errorType: 'validation_error'
    });
  }

  if (fact.content.length > 1000) {
    return res.status(400).json({
      success: false,
      error: 'Fact is too long (maximum 1000 characters)',
      errorType: 'validation_error'
    });
  }

  // Validate fact structure
  if (typeof fact.content !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Fact content must be a string',
      errorType: 'validation_error'
    });
  }

  // Get validation service
  const validationService = req.app.locals.enhancedFactValidationService;
  if (!validationService) {
    return res.status(503).json({
      success: false,
      error: 'Rewrite service temporarily unavailable',
      errorType: 'service_unavailable'
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

  res.json({
    success: true,
    professionalRewrite,
    original: fact.content,
    category: fact.category
  });
}));

module.exports = router;