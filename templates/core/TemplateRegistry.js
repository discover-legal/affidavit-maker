// templates/core/TemplateRegistry.js
// Dynamic registry for managing state templates

const logger = require('../../utils/logger');

/**
 * TemplateRegistry
 *
 * Central registry for managing state-specific document templates.
 * Provides a consistent interface for template access, validation, and document generation.
 * Drop-in replacement for StateTemplateManager with improved extensibility.
 *
 * @class TemplateRegistry
 */
class TemplateRegistry {
  constructor() {
    // Map of stateCode -> template instance
    this.templates = new Map();

    // Map of stateCode -> metadata
    this.metadata = new Map();

    // Default state to use when no state is specified
    this.defaultState = 'TX';

    logger.info('TemplateRegistry initialized');
  }

  /**
   * Register a template with the registry
   *
   * @param {string} stateCode - Two-letter state code (e.g., 'TX', 'UT', 'AZ')
   * @param {class} TemplateClass - Template class (should extend BaseAffidavitTemplate)
   * @param {Object} metadata - Template metadata
   */
  register(stateCode, TemplateClass, metadata) {
    const normalizedCode = stateCode.toUpperCase();

    // Instantiate the template
    const templateInstance = new TemplateClass();

    // Store template instance and metadata
    this.templates.set(normalizedCode, templateInstance);
    this.metadata.set(normalizedCode, metadata);

    logger.info(`Registered template for state: ${normalizedCode} (${metadata.stateName})`);
  }

  /**
   * Get template instance for a state
   * Matches StateTemplateManager interface
   *
   * @param {string} stateCode - Two-letter state code
   * @returns {Object} Template instance
   */
  getTemplate(stateCode) {
    if (!stateCode) {
      logger.warn('No state code provided, using default:', this.defaultState);
      return this.templates.get(this.defaultState);
    }

    const normalizedCode = stateCode.toUpperCase();

    if (!this.templates.has(normalizedCode)) {
      logger.warn(`Template for state ${normalizedCode} not found, using default:`, this.defaultState);
      return this.templates.get(this.defaultState);
    }

    return this.templates.get(normalizedCode);
  }

  /**
   * Get list of all supported states
   * Matches StateTemplateManager interface
   *
   * @returns {Array} Array of state objects with code, name, and requirements
   */
  getSupportedStates() {
    const states = [];

    for (const [stateCode, template] of this.templates) {
      states.push({
        code: template.state,
        name: template.stateName,
        requirements: {
          venue: template.sections.venue,
          caseCaption: template.sections.caseCaption,
          notaryBlock: template.sections.notaryBlock,
          countyRequired: template.requiredFields.includes('county'),
          perjuryStatement: template.sections.perjuryStatement
        }
      });
    }

    return states;
  }

  /**
   * Validate affidavit data against state requirements
   * Delegates to template's validateData method
   * Matches StateTemplateManager interface
   *
   * @param {string} stateCode - Two-letter state code
   * @param {Object} affidavitData - Data to validate
   * @returns {Object} Validation result with isValid, errors, and warnings
   */
  validateAffidavitData(stateCode, affidavitData) {
    const template = this.getTemplate(stateCode);
    return template.validateData(affidavitData);
  }

  /**
   * Generate affidavit document
   * Delegates to template's generateDocument method
   * Matches StateTemplateManager interface
   *
   * @param {string} stateCode - Two-letter state code
   * @param {Object} affidavitData - Data for affidavit
   * @returns {Object} Generated document with sections, validation, and metadata
   */
  generateAffidavit(stateCode, affidavitData) {
    const template = this.getTemplate(stateCode);
    return template.generateDocument(affidavitData);
  }

  /**
   * Get legal citation information for a state
   * Matches StateTemplateManager interface
   *
   * @param {string} stateCode - Two-letter state code
   * @returns {Object|null} Legal citations object or null if not found
   */
  getLegalCitations(stateCode) {
    const normalizedCode = stateCode.toUpperCase();
    const metadata = this.metadata.get(normalizedCode);

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
   * Get metadata for a state
   *
   * @param {string} stateCode - Two-letter state code
   * @returns {Object|null} State metadata or null if not found
   */
  getMetadata(stateCode) {
    const normalizedCode = stateCode.toUpperCase();
    return this.metadata.get(normalizedCode) || null;
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
   * Check if a state is registered
   *
   * @param {string} stateCode - Two-letter state code
   * @returns {boolean} True if state is registered
   */
  hasState(stateCode) {
    return this.templates.has(stateCode.toUpperCase());
  }

  /**
   * Get count of registered templates
   *
   * @returns {number} Number of registered templates
   */
  getTemplateCount() {
    return this.templates.size;
  }
}

module.exports = TemplateRegistry;
