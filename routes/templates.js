// routes/templates.js - Template system routes
const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../middleware/errorMiddleware');
const logger = require('../utils/logger');

// Get supported states (public endpoint)
router.get('/states', asyncHandler(async (req, res) => {
  const affidavitService = req.app.locals.affidavitService;
  
  try {
    const states = affidavitService.getSupportedStates();
    
    res.json({
      success: true,
      states,
      count: states.length
    });
  } catch (error) {
    logger.error('Failed to get supported states:', {
      error: error.message,
      requestId: req.id
    });
    
    // Fallback response
    res.json({
      success: true,
      states: [
        { code: 'TX', name: 'Texas', requirements: { venue: true, countyRequired: true } },
        { code: 'UT', name: 'Utah', requirements: { venue: true, countyRequired: true } },
        { code: 'AZ', name: 'Arizona', requirements: { venue: false, countyRequired: false } }
      ],
      count: 3
    });
  }
}));

// Get supported document types (public endpoint)
router.get('/document-types', asyncHandler(async (req, res) => {
  const affidavitService = req.app.locals.affidavitService;
  
  try {
    const documentTypes = affidavitService.getSupportedDocumentTypes();
    
    res.json({
      success: true,
      documentTypes,
      count: documentTypes.length
    });
  } catch (error) {
    logger.error('Failed to get document types:', {
      error: error.message,
      requestId: req.id
    });
    
    // Fallback response
    res.json({
      success: true,
      documentTypes: ['general', 'divorce', 'custody', 'financial', 'property', 'identity'],
      count: 6
    });
  }
}));

// Validate affidavit data (public endpoint)
router.post('/validate', asyncHandler(async (req, res) => {
  const { affidavitData, state } = req.body;
  const affidavitService = req.app.locals.affidavitService;
  
  if (!affidavitData || !state) {
    return res.status(400).json({
      success: false,
      error: 'affidavitData and state are required',
      requestId: req.id
    });
  }
  
  try {
    const validation = affidavitService.validateAffidavitData(affidavitData, state);
    
    res.json({
      success: true,
      validation,
      state
    });
  } catch (error) {
    logger.error('Validation error:', {
      error: error.message,
      state,
      requestId: req.id
    });
    
    // Return basic validation result on error
    res.json({
      success: true,
      validation: {
        isValid: false,
        errors: ['Validation service temporarily unavailable'],
        warnings: []
      },
      state
    });
  }
}));

// Get template requirements for a state (public endpoint)
router.get('/requirements/:state', asyncHandler(async (req, res) => {
  const { state } = req.params;
  const affidavitService = req.app.locals.affidavitService;

  // Dynamically check if state is supported
  const supportedStates = affidavitService.getSupportedStates();
  const isSupported = supportedStates.some(s => s.stateCode === state.toUpperCase());

  if (!isSupported) {
    return res.status(400).json({
      success: false,
      error: `State '${state}' is not supported. Supported states: ${supportedStates.map(s => s.stateCode).join(', ')}`,
      requestId: req.id
    });
  }

  try {
    const template = affidavitService.templateManager.getTemplate(state);
    const requirements = template.getRequirements();
    const formatRules = template.getFormattingRules();

    res.json({
      success: true,
      state: state.toUpperCase(),
      stateName: template.stateName,
      requirements,
      formatRules
    });
  } catch (error) {
    logger.error('Failed to get template requirements:', {
      error: error.message,
      state,
      requestId: req.id
    });

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve template requirements',
      requestId: req.id
    });
  }
}));

module.exports = router;