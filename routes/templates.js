// routes/templates.js - Template system routes
const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../middleware/errorMiddleware');
const { standardLimiter } = require('../middleware/rateLimiting');
const logger = require('../utils/logger');

// AffidavitTypeRegistry — canonical bank of all supported affidavit types
let affidavitTypeRegistry = null;
try {
  affidavitTypeRegistry = require('../services/affidavits/AffidavitTypeRegistry');
} catch (err) {
  logger.warn('AffidavitTypeRegistry not available', { error: err.message });
}

// ─── Affidavit type endpoints (powered by AffidavitTypeRegistry) ──────────────

/**
 * GET /api/templates/affidavit-types
 * Returns all available affidavit types, optionally filtered by ?state=TX
 * and ?includeFamily=true to include divorce_package.
 */
router.get('/affidavit-types', standardLimiter, asyncHandler(async (req, res) => {
  const { state, includeFamily } = req.query;

  if (state && !/^[A-Za-z]{2}$/.test(state)) {
    return res.status(400).json({ success: false, error: 'Invalid state code format.' });
  }

  if (!affidavitTypeRegistry) {
    return res.json({ success: true, types: [], count: 0 });
  }

  const types = affidavitTypeRegistry.getTypes(
    state || null,
    includeFamily === 'true'
  );

  res.json({ success: true, types, count: types.length });
}));

/**
 * GET /api/templates/affidavit-types/by-category
 * Returns all types grouped by category for the type-picker UI.
 * Optional ?state=TX to filter to state-applicable types.
 */
router.get('/affidavit-types/by-category', standardLimiter, asyncHandler(async (req, res) => {
  const { state } = req.query;

  if (state && !/^[A-Za-z]{2}$/.test(state)) {
    return res.status(400).json({ success: false, error: 'Invalid state code format.' });
  }

  if (!affidavitTypeRegistry) {
    return res.json({ success: true, categories: {} });
  }

  const categories = affidavitTypeRegistry.getTypesByCategory(state || null);
  res.json({ success: true, categories });
}));

/**
 * GET /api/templates/affidavit-types/:typeId
 * Returns metadata for a single affidavit type.
 */
router.get('/affidavit-types/:typeId', standardLimiter, asyncHandler(async (req, res) => {
  const { typeId } = req.params;

  // Basic validation: only alphanumeric and underscores
  if (!/^[a-z_]{1,60}$/.test(typeId)) {
    return res.status(400).json({ success: false, error: 'Invalid type ID format.' });
  }

  if (!affidavitTypeRegistry) {
    return res.status(503).json({ success: false, error: 'Registry not available.' });
  }

  const type = affidavitTypeRegistry.getType(typeId);
  if (!type) {
    return res.status(404).json({ success: false, error: 'Affidavit type not found.' });
  }

  res.json({ success: true, type });
}));

// Get supported states (public endpoint)
router.get('/states', standardLimiter, asyncHandler(async (req, res) => {
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
router.get('/document-types', standardLimiter, asyncHandler(async (req, res) => {
  try {
    let documentTypes;

    if (affidavitTypeRegistry) {
      // Use registry as canonical source — return all type IDs (including divorce)
      documentTypes = Object.keys(affidavitTypeRegistry.all);
    } else {
      // Legacy fallback
      documentTypes = ['general', 'divorce', 'custody', 'financial', 'property', 'identity'];
    }

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

    res.json({
      success: true,
      documentTypes: ['general', 'divorce', 'custody', 'financial', 'property', 'identity'],
      count: 6
    });
  }
}));

// Validate affidavit data (public endpoint)
router.post('/validate', standardLimiter, asyncHandler(async (req, res) => {
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

// =============================================
// DIVORCE DOCUMENT ENDPOINTS
// =============================================

// Get states that support divorce documents (public endpoint)
router.get('/divorce/states', standardLimiter, asyncHandler(async (req, res) => {
  const templateManager = req.app.locals.templateManager;

  try {
    const states = templateManager.getSupportedStates();

    // Filter to only states that have divorce document types
    const divorceStates = states.filter(state => {
      const docTypes = templateManager.getDocumentTypes(state.code);
      return docTypes.includes('divorce_petition') || docTypes.includes('divorce_decree');
    });

    res.json({
      success: true,
      data: {
        states: divorceStates.map(s => s.code),
        stateDetails: divorceStates.map(s => ({
          code: s.code,
          name: s.name
        })),
        documentTypes: ['divorce_petition', 'divorce_decree']
      }
    });
  } catch (error) {
    logger.error('Failed to get divorce states:', {
      error: error.message,
      requestId: req.id
    });

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve divorce-supported states',
      requestId: req.id
    });
  }
}));

// Get divorce requirements for a state (public endpoint)
router.get('/divorce/requirements/:state', standardLimiter, asyncHandler(async (req, res) => {
  const { state } = req.params;
  const templateManager = req.app.locals.templateManager;

  // Validate state format
  if (!state || !/^[A-Za-z]{2}$/.test(state)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid state code format. Must be a 2-letter state code.',
      requestId: req.id
    });
  }

  try {
    const stateCode = state.toUpperCase();

    const docTypes = templateManager.getDocumentTypes(stateCode);
    if (!docTypes.includes('divorce_petition') && !docTypes.includes('divorce_decree')) {
      return res.status(400).json({
        success: false,
        error: `State does not support divorce documents. Supported states: TX, UT, AZ, CA, FL, IL, NY, CO, GA, MA, MI, NC, NJ, OH, PA, VA, WA, ON, BC, AB, QC, MB, NB, NL, NS, PE, SK`,
        requestId: req.id
      });
    }

    // Get metadata for divorce petition
    const metadata = templateManager.getMetadata(stateCode, 'divorce_petition');

    // Get state info
    const states = templateManager.getSupportedStates();
    const stateInfo = states.find(s => s.code === stateCode);

    res.json({
      success: true,
      data: {
        stateCode: stateCode,
        stateName: stateInfo?.name || stateCode,
        residencyRequirements: metadata?.residencyRequirements || null,
        waitingPeriod: metadata?.waitingPeriod || null,
        // Support both key names: some states use groundsForDissolution, others groundsForDivorce
        groundsForDivorce: metadata?.groundsForDivorce || metadata?.groundsForDissolution || null,
        requiredForms: metadata?.requiredForms || [],
        terminology: metadata?.terminology || {},
        fees: metadata?.fees || null,
        specialRequirements: metadata?.specialRequirements || [],
        legalCitations: metadata?.legalCitations || []
      }
    });
  } catch (error) {
    logger.error('Failed to get divorce requirements:', {
      error: error.message,
      state,
      requestId: req.id
    });

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve divorce requirements',
      requestId: req.id
    });
  }
}));

// Get available divorce document types for a state (public endpoint)
router.get('/divorce/document-types/:state', standardLimiter, asyncHandler(async (req, res) => {
  const { state } = req.params;
  const templateManager = req.app.locals.templateManager;

  // Validate state format
  if (!state || !/^[A-Za-z]{2}$/.test(state)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid state code format. Must be a 2-letter state code.',
      requestId: req.id
    });
  }

  try {
    const stateCode = state.toUpperCase();

    const allDocTypes = templateManager.getDocumentTypes(stateCode);

    // Filter to only divorce-related document types
    const divorceDocTypes = allDocTypes.filter(type =>
      type === 'divorce_petition' || type === 'divorce_decree'
    );

    // Get metadata for each type
    const documentTypes = divorceDocTypes.map(type => {
      const metadata = templateManager.getMetadata(stateCode, type);
      return {
        type: type,
        name: metadata?.documentTitle || type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        available: true,
        description: metadata?.description || null
      };
    });

    res.json({
      success: true,
      data: {
        stateCode: stateCode,
        documentTypes: documentTypes
      }
    });
  } catch (error) {
    logger.error('Failed to get divorce document types:', {
      error: error.message,
      state,
      requestId: req.id
    });

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve divorce document types',
      requestId: req.id
    });
  }
}));

// Validate divorce document data (public endpoint)
router.post('/divorce/validate', standardLimiter, asyncHandler(async (req, res) => {
  const { state, documentType, data } = req.body;
  const templateManager = req.app.locals.templateManager;

  // Validate required fields
  if (!state || !documentType || !data) {
    return res.status(400).json({
      success: false,
      error: 'state, documentType, and data are required',
      requestId: req.id
    });
  }

  // Validate state format
  if (!/^[A-Za-z]{2}$/.test(state)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid state code format. Must be a 2-letter state code.',
      requestId: req.id
    });
  }

  // Validate document type
  const validDocTypes = ['divorce_petition', 'divorce_decree'];
  if (!validDocTypes.includes(documentType)) {
    return res.status(400).json({
      success: false,
      error: `Invalid document type. Must be one of: ${validDocTypes.join(', ')}`,
      requestId: req.id
    });
  }

  try {
    const stateCode = state.toUpperCase();

    const validation = templateManager.validateAffidavitData(stateCode, data, documentType);

    // Calculate completion percentage
    const metadata = templateManager.getMetadata(stateCode, documentType);
    const requiredFields = metadata?.requiredFields || ['petitionerName', 'respondentName', 'state'];
    const filledRequired = requiredFields.filter(field => data[field] && data[field].toString().trim());
    const completionPercentage = Math.round((filledRequired.length / requiredFields.length) * 100);

    res.json({
      success: true,
      data: {
        isValid: validation.isValid,
        errors: validation.errors || [],
        warnings: validation.warnings || [],
        completionPercentage: completionPercentage,
        state: stateCode,
        documentType: documentType
      }
    });
  } catch (error) {
    logger.error('Divorce validation error:', {
      error: error.message,
      state,
      documentType,
      requestId: req.id
    });

    res.json({
      success: true,
      data: {
        isValid: false,
        errors: ['Validation service temporarily unavailable'],
        warnings: [],
        completionPercentage: 0,
        state: state.toUpperCase(),
        documentType: documentType
      }
    });
  }
}));

// =============================================
// EXISTING AFFIDAVIT ENDPOINTS
// =============================================

// Get template requirements for a state (public endpoint)
// SECURITY (HIGH-03): Added rate limiting
// SECURITY (MED-15): Don't echo user-supplied state in error message
router.get('/requirements/:state', standardLimiter, asyncHandler(async (req, res) => {
  const { state } = req.params;
  const templateManager = req.app.locals.templateManager;

  // SECURITY: Validate state format (2-letter code only)
  if (!state || !/^[A-Za-z]{2}$/.test(state)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid state code format. Must be a 2-letter state code.',
      requestId: req.id
    });
  }

  // Dynamically check if state is supported
  const supportedStates = templateManager.getSupportedStates();
  const isSupported = supportedStates.some(s => s.code === state.toUpperCase());

  if (!isSupported) {
    // SECURITY: Don't echo user-supplied state value back
    return res.status(400).json({
      success: false,
      error: `State not supported. Supported states: ${supportedStates.map(s => s.code).join(', ')}`,
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