// routes/validation.js
const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../middleware/errorMiddleware');
const { auth0Middleware } = require('../middleware/auth0Middleware');
const { chatLimiter } = require('../middleware/rateLimiting');
const logger = require('../utils/logger');

router.post('/',
  chatLimiter,  // Rate limit LLM-powered validation to prevent cost exhaustion
  auth0Middleware,
  asyncHandler(async (req, res) => {
    const { affidavitData } = req.body;
    const userId = req.user?.id;
    
    if (!affidavitData) {
      return res.status(400).json({
        success: false,
        error: 'affidavitData is required'
      });
    }

    try {
      const { 
        templateManager, 
        affidavitService, 
        enhancedFactValidationService 
      } = req.app.locals;
      
      // Start with template validation
      let validation = templateManager.validateDocument(affidavitData);
      
      // Add enhanced fact validation if facts exist
      if (affidavitData.facts && affidavitData.facts.length > 0) {
        const factValidation = await enhancedFactValidationService.validateFactsBatchProfessional(
          affidavitData.facts,
          {
            state: affidavitData.state,
            affiantName: affidavitData.affiantName,
            documentType: affidavitData.documentType || 'general'
          }
        );
        
        // Merge fact validation results
        validation.factValidation = factValidation;
        if (!factValidation.isValid) {
          validation.isValid = false;
          validation.errors.push(...factValidation.results.flatMap(r => r.errors));
          validation.warnings.push(...factValidation.results.flatMap(r => r.warnings));
        }
      }

      logger.info('Document validation completed', {
        userId,
        state: affidavitData.state,
        isValid: validation.isValid,
        factCount: affidavitData.facts?.length || 0
      });

      res.json({
        success: true,
        validation
      });

    } catch (error) {
      logger.error('Validation error', { error: error.message, userId });
      res.status(500).json({
        success: false,
        error: 'Validation failed',
        validation: {
          isValid: false,
          errors: ['Validation service temporarily unavailable'],
          warnings: []
        }
      });
    }
  })
);

module.exports = router;