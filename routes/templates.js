// routes/templates.js - Template system routes
const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../middleware/errorMiddleware');
const logger = require('../utils/logger');

// Get supported states (public endpoint)
router.get('/states', asyncHandler(async (req, res) => {
  const templateManager = req.app.locals.templateManager;

  try {
    const states = templateManager.getSupportedStates();

    // Transform to match frontend expectations (stateCode/stateName instead of code/name)
    const transformedStates = states.map(state => ({
      stateCode: state.code,
      stateName: state.name,
      requirements: state.requirements
    }));

    // Return array directly (frontend expects array, not wrapped object)
    res.json(transformedStates);
  } catch (error) {
    logger.error('Failed to get supported states:', {
      error: error.message,
      requestId: req.id
    });

    // Fallback response (also return array directly)
    res.json([
      { stateCode: 'TX', stateName: 'Texas', requirements: { venue: true, countyRequired: true } },
      { stateCode: 'UT', stateName: 'Utah', requirements: { venue: true, countyRequired: true } },
      { stateCode: 'AZ', stateName: 'Arizona', requirements: { venue: false, countyRequired: false } },
      { stateCode: 'CA', stateName: 'California', requirements: { venue: true, countyRequired: true } }
    ]);
  }
}));

// Get supported document types (public endpoint)
router.get('/document-types', asyncHandler(async (req, res) => {
  try {
    // Document types are currently standard across all states
    const documentTypes = ['general', 'divorce', 'custody', 'financial', 'property', 'identity'];

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
  const templateManager = req.app.locals.templateManager;

  if (!affidavitData || !state) {
    return res.status(400).json({
      success: false,
      error: 'affidavitData and state are required',
      requestId: req.id
    });
  }

  try {
    const validation = templateManager.validateAffidavitData(state, affidavitData);

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
  const templateManager = req.app.locals.templateManager;

  // Dynamically check if state is supported
  const supportedStates = templateManager.getSupportedStates();
  const isSupported = supportedStates.some(s => s.code === state.toUpperCase());

  if (!isSupported) {
    return res.status(400).json({
      success: false,
      error: `State '${state}' is not supported. Supported states: ${supportedStates.map(s => s.code).join(', ')}`,
      requestId: req.id
    });
  }

  try {
    const template = templateManager.getTemplate(state);
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