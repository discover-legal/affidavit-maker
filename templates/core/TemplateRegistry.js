// templates/core/TemplateRegistry.js
// Dynamic registry for managing state templates with multi-document type support

const logger = require('../../utils/logger');

/**
 * Default document type when not specified (backwards compatibility)
 */
const DEFAULT_DOCUMENT_TYPE = 'affidavit';

/**
 * Valid document types that can be registered
 * @type {Set<string>}
 */
const VALID_DOCUMENT_TYPES = new Set([
  'affidavit',
  'divorce_petition',
  'divorce_decree'
]);

/**
 * TemplateRegistry
 *
 * Central registry for managing state-specific document templates.
 * Supports multiple document types per state (affidavits, divorce petitions, etc.)
 * Provides a consistent interface for template access, validation, and document generation.
 *
 * @class TemplateRegistry
 */
class TemplateRegistry {
  constructor() {
    // Map of stateCode -> Map of documentType -> template instance
    // Structure: { 'TX' => { 'affidavit' => templateInstance, 'divorce_petition' => templateInstance } }
    this.templates = new Map();

    // Map of stateCode -> Map of documentType -> metadata
    // Structure: { 'TX' => { 'affidavit' => metadata, 'divorce_petition' => metadata } }
    this.metadata = new Map();

    // Default state to use when no state is specified
    this.defaultState = 'TX';

    // Default document type (for backwards compatibility)
    this.defaultDocumentType = DEFAULT_DOCUMENT_TYPE;

    logger.info('TemplateRegistry initialized (multi-document type support enabled)');
  }

  /**
   * Validate document type is one of the allowed types
   * @param {string} documentType - Document type to validate
   * @returns {boolean} True if valid
   * @private
   */
  _isValidDocumentType(documentType) {
    return VALID_DOCUMENT_TYPES.has(documentType);
  }

  /**
   * Ensure state entry exists in maps
   * @param {string} stateCode - Normalized state code
   * @private
   */
  _ensureStateEntry(stateCode) {
    if (!this.templates.has(stateCode)) {
      this.templates.set(stateCode, new Map());
    }
    if (!this.metadata.has(stateCode)) {
      this.metadata.set(stateCode, new Map());
    }
  }

  /**
   * Register a template with the registry
   *
   * @param {string} stateCode - Two-letter state code (e.g., 'TX', 'UT', 'AZ')
   * @param {class} TemplateClass - Template class (should extend BaseAffidavitTemplate or BaseDivorcePetitionTemplate)
   * @param {Object} metadata - Template metadata
   * @param {string} [documentType='affidavit'] - Document type (affidavit, divorce_petition, divorce_decree)
   * @throws {Error} If document type is invalid
   */
  register(stateCode, TemplateClass, metadata, documentType = DEFAULT_DOCUMENT_TYPE) {
    const normalizedCode = stateCode.toUpperCase();
    const normalizedDocType = documentType.toLowerCase();

    // Validate document type
    if (!this._isValidDocumentType(normalizedDocType)) {
      throw new Error(`Invalid document type: ${documentType}. Valid types: ${Array.from(VALID_DOCUMENT_TYPES).join(', ')}`);
    }

    // Ensure state entry exists
    this._ensureStateEntry(normalizedCode);

    // Instantiate the template
    const templateInstance = new TemplateClass();

    // Store template instance and metadata under state -> documentType
    this.templates.get(normalizedCode).set(normalizedDocType, templateInstance);
    this.metadata.get(normalizedCode).set(normalizedDocType, metadata);

    logger.info(`Registered template: ${normalizedCode}/${normalizedDocType} (${metadata.stateName})`);
  }

  /**
   * Get template instance for a state and document type
   * Maintains backwards compatibility - defaults to 'affidavit' if documentType not specified
   *
   * @param {string} stateCode - Two-letter state code
   * @param {string} [documentType='affidavit'] - Document type
   * @returns {Object} Template instance
   */
  getTemplate(stateCode, documentType = DEFAULT_DOCUMENT_TYPE) {
    const normalizedDocType = documentType.toLowerCase();

    if (!stateCode) {
      logger.warn('No state code provided, using default:', this.defaultState);
      return this._getTemplateInternal(this.defaultState, normalizedDocType);
    }

    const normalizedCode = stateCode.toUpperCase();

    if (!this.templates.has(normalizedCode)) {
      logger.warn(`Template for state ${normalizedCode} not found, using default:`, this.defaultState);
      return this._getTemplateInternal(this.defaultState, normalizedDocType);
    }

    return this._getTemplateInternal(normalizedCode, normalizedDocType);
  }

  /**
   * Internal method to get template with fallback logic
   * @param {string} stateCode - Normalized state code
   * @param {string} documentType - Normalized document type
   * @returns {Object} Template instance
   * @private
   */
  _getTemplateInternal(stateCode, documentType) {
    const stateTemplates = this.templates.get(stateCode);

    if (!stateTemplates) {
      logger.warn(`No templates found for state ${stateCode}`);
      return null;
    }

    if (stateTemplates.has(documentType)) {
      return stateTemplates.get(documentType);
    }

    // Fallback to default document type if requested type not found
    if (documentType !== DEFAULT_DOCUMENT_TYPE && stateTemplates.has(DEFAULT_DOCUMENT_TYPE)) {
      logger.warn(`Document type ${documentType} not found for ${stateCode}, falling back to ${DEFAULT_DOCUMENT_TYPE}`);
      return stateTemplates.get(DEFAULT_DOCUMENT_TYPE);
    }

    // Return first available template for state
    const firstTemplate = stateTemplates.values().next().value;
    if (firstTemplate) {
      logger.warn(`Requested document type ${documentType} not found for ${stateCode}, using first available`);
      return firstTemplate;
    }

    return null;
  }

  /**
   * Get list of all supported states
   * Maintains backwards compatibility - returns affidavit requirements by default
   *
   * @param {string} [documentType='affidavit'] - Document type to get requirements for
   * @returns {Array} Array of state objects with code, name, and requirements
   */
  getSupportedStates(documentType = DEFAULT_DOCUMENT_TYPE) {
    const states = [];
    const normalizedDocType = documentType.toLowerCase();

    for (const [stateCode, stateTemplates] of this.templates) {
      // Get template for the specified document type, or first available
      let template = stateTemplates.get(normalizedDocType);
      if (!template) {
        template = stateTemplates.values().next().value;
      }

      if (template) {
        states.push({
          code: template.state,
          name: template.stateName,
          requirements: {
            venue: template.sections?.venue ?? true,
            caseCaption: template.sections?.caseCaption ?? true,
            notaryBlock: template.sections?.notaryBlock ?? true,
            countyRequired: template.requiredFields?.includes('county') ?? false,
            perjuryStatement: template.sections?.perjuryStatement ?? false
          }
        });
      }
    }

    return states;
  }

  /**
   * Get all document types available for a state
   *
   * @param {string} stateCode - Two-letter state code
   * @returns {Array<string>} Array of available document types for the state
   */
  getDocumentTypes(stateCode) {
    const normalizedCode = stateCode.toUpperCase();
    const stateTemplates = this.templates.get(normalizedCode);

    if (!stateTemplates) {
      return [];
    }

    return Array.from(stateTemplates.keys());
  }

  /**
   * Check if a specific document type is available for a state
   *
   * @param {string} stateCode - Two-letter state code
   * @param {string} documentType - Document type to check
   * @returns {boolean} True if document type is available
   */
  hasDocumentType(stateCode, documentType) {
    const normalizedCode = stateCode.toUpperCase();
    const normalizedDocType = documentType.toLowerCase();
    const stateTemplates = this.templates.get(normalizedCode);

    if (!stateTemplates) {
      return false;
    }

    return stateTemplates.has(normalizedDocType);
  }

  /**
   * Get all supported state/document type combinations
   *
   * @returns {Array<Object>} Array of { stateCode, documentType, stateName } objects
   */
  getSupportedDocuments() {
    const documents = [];

    for (const [stateCode, stateTemplates] of this.templates) {
      for (const [documentType, template] of stateTemplates) {
        documents.push({
          stateCode,
          documentType,
          stateName: template.stateName,
          documentTitle: template.documentTitle || template.generateTitle?.() || documentType
        });
      }
    }

    return documents;
  }

  /**
   * Validate document data against state requirements
   * Delegates to template's validateData method
   *
   * @param {string} stateCode - Two-letter state code
   * @param {Object} documentData - Data to validate
   * @param {string} [documentType='affidavit'] - Document type
   * @returns {Object} Validation result with isValid, errors, and warnings
   */
  validateAffidavitData(stateCode, documentData, documentType = DEFAULT_DOCUMENT_TYPE) {
    const template = this.getTemplate(stateCode, documentType);
    if (!template) {
      return {
        isValid: false,
        errors: [`No template found for ${stateCode}/${documentType}`],
        warnings: []
      };
    }
    return template.validateData(documentData);
  }

  /**
   * Alias for validateAffidavitData that supports any document type
   * @param {string} stateCode - Two-letter state code
   * @param {Object} documentData - Data to validate
   * @param {string} [documentType='affidavit'] - Document type
   * @returns {Object} Validation result
   */
  validateDocumentData(stateCode, documentData, documentType = DEFAULT_DOCUMENT_TYPE) {
    return this.validateAffidavitData(stateCode, documentData, documentType);
  }

  /**
   * Generate document
   * Delegates to template's generateDocument method
   *
   * @param {string} stateCode - Two-letter state code
   * @param {Object} documentData - Data for document
   * @param {string} [documentType='affidavit'] - Document type
   * @returns {Object} Generated document with sections, validation, and metadata
   */
  generateAffidavit(stateCode, documentData, documentType = DEFAULT_DOCUMENT_TYPE) {
    const template = this.getTemplate(stateCode, documentType);
    if (!template) {
      throw new Error(`No template found for ${stateCode}/${documentType}`);
    }
    return template.generateDocument(documentData);
  }

  /**
   * Alias for generateAffidavit that supports any document type
   * @param {string} stateCode - Two-letter state code
   * @param {Object} documentData - Data for document
   * @param {string} [documentType='affidavit'] - Document type
   * @returns {Object} Generated document
   */
  generateDocument(stateCode, documentData, documentType = DEFAULT_DOCUMENT_TYPE) {
    return this.generateAffidavit(stateCode, documentData, documentType);
  }

  /**
   * Get legal citation information for a state and document type
   *
   * @param {string} stateCode - Two-letter state code
   * @param {string} [documentType='affidavit'] - Document type
   * @returns {Object|null} Legal citations object or null if not found
   */
  getLegalCitations(stateCode, documentType = DEFAULT_DOCUMENT_TYPE) {
    const normalizedCode = stateCode.toUpperCase();
    const normalizedDocType = documentType.toLowerCase();
    const stateMetadata = this.metadata.get(normalizedCode);

    if (!stateMetadata) {
      return null;
    }

    const metadata = stateMetadata.get(normalizedDocType);
    if (!metadata || !metadata.legalCitations) {
      return null;
    }

    // Transform metadata citations to match old format
    return {
      primary: metadata.legalCitations[0]?.code || '',
      secondary: metadata.legalCitations.slice(1).map(c => c.code),
      notes: metadata.legalCitations[0]?.description || ''
    };
  }

  /**
   * Get metadata for a state and document type
   *
   * @param {string} stateCode - Two-letter state code
   * @param {string} [documentType='affidavit'] - Document type
   * @returns {Object|null} State metadata or null if not found
   */
  getMetadata(stateCode, documentType = DEFAULT_DOCUMENT_TYPE) {
    const normalizedCode = stateCode.toUpperCase();
    const normalizedDocType = documentType.toLowerCase();
    const stateMetadata = this.metadata.get(normalizedCode);

    if (!stateMetadata) {
      return null;
    }

    return stateMetadata.get(normalizedDocType) || null;
  }

  /**
   * Get all metadata for a state (all document types)
   *
   * @param {string} stateCode - Two-letter state code
   * @returns {Object} Map of documentType -> metadata
   */
  getAllMetadataForState(stateCode) {
    const normalizedCode = stateCode.toUpperCase();
    const stateMetadata = this.metadata.get(normalizedCode);

    if (!stateMetadata) {
      return {};
    }

    const result = {};
    for (const [docType, meta] of stateMetadata) {
      result[docType] = meta;
    }
    return result;
  }

  /**
   * Get all registered state codes
   *
   * @returns {Array} Array of state codes
   */
  getStateCodes() {
    return Array.from(this.templates.keys());
  }

  /**
   * Check if a state is registered (has any document type)
   *
   * @param {string} stateCode - Two-letter state code
   * @returns {boolean} True if state is registered
   */
  hasState(stateCode) {
    const normalizedCode = stateCode.toUpperCase();
    const stateTemplates = this.templates.get(normalizedCode);
    return stateTemplates !== undefined && stateTemplates.size > 0;
  }

  /**
   * Get count of registered templates (total across all states and document types)
   *
   * @returns {number} Number of registered templates
   */
  getTemplateCount() {
    let count = 0;
    for (const stateTemplates of this.templates.values()) {
      count += stateTemplates.size;
    }
    return count;
  }

  /**
   * Get count of registered states
   *
   * @returns {number} Number of registered states
   */
  getStateCount() {
    return this.templates.size;
  }

  /**
   * Clear all registered templates (useful for testing)
   */
  clear() {
    this.templates.clear();
    this.metadata.clear();
    logger.info('TemplateRegistry cleared');
  }
}

// Export class and constants
module.exports = TemplateRegistry;
module.exports.DEFAULT_DOCUMENT_TYPE = DEFAULT_DOCUMENT_TYPE;
module.exports.VALID_DOCUMENT_TYPES = VALID_DOCUMENT_TYPES;
