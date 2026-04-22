// templates/StateTemplateManager.js
// Thin wrapper around TemplateRegistry — all templates loaded via auto-discovery.
// Legacy inline template classes have been removed; the canonical implementations
// live in templates/states/*/AffidavitTemplate.js and extend
// templates/core/BaseAffidavitTemplate.js.

const logger = require('../utils/logger');

/**
 * StateTemplateManager
 *
 * Manages state-specific document templates via a TemplateRegistry.
 * Supports multiple document types: affidavit, divorce_petition, divorce_decree.
 *
 * MUST be initialised with a registry (returned by initializeTemplates()).
 */
class StateTemplateManager {
  /**
   * @param {Object} options
   * @param {import('./core/TemplateRegistry')} options.registry - Required registry instance
   */
  constructor(options = {}) {
    if (!options.registry) {
      throw new Error(
        'StateTemplateManager requires a registry. Use initializeTemplates() to create one.'
      );
    }

    this.registry = options.registry;
    this.defaultState = 'TX';
    this.defaultDocumentType = 'affidavit';
    this.validDocumentTypes = ['affidavit', 'divorce_petition', 'divorce_decree'];

    logger.info('StateTemplateManager initialized', {
      states: this.registry.getStateCount(),
      documentTypes: this.validDocumentTypes,
    });
  }

  // ---------------------------------------------------------------------------
  // Template access
  // ---------------------------------------------------------------------------

  getTemplate(stateCode, documentType = 'affidavit') {
    const normalizedCode = stateCode ? stateCode.toUpperCase() : this.defaultState;
    const template = this.registry.getTemplate(normalizedCode, documentType);
    if (template) return template;

    logger.warn(`Template for ${normalizedCode}/${documentType} not found, using default state`);
    return this.registry.getTemplate(this.defaultState, documentType);
  }

  getSupportedStates() {
    return this.registry.getSupportedStates();
  }

  getDocumentTypes(stateCode) {
    const normalizedCode = stateCode ? stateCode.toUpperCase() : this.defaultState;
    return this.registry.getDocumentTypes(normalizedCode);
  }

  hasDocumentType(stateCode, documentType) {
    const normalizedCode = stateCode ? stateCode.toUpperCase() : this.defaultState;
    return this.registry.hasDocumentType(normalizedCode, documentType);
  }

  getSupportedDocuments() {
    return this.registry.getSupportedDocuments();
  }

  // ---------------------------------------------------------------------------
  // Validation
  // ---------------------------------------------------------------------------

  validateAffidavitData(stateCode, affidavitData) {
    const template = this.getTemplate(stateCode, 'affidavit');
    return template.validateData(affidavitData);
  }

  validateDivorceData(stateCode, divorceData, documentType = 'divorce_petition') {
    const template = this.getTemplate(stateCode, documentType);
    if (!template) {
      return {
        isValid: false,
        errors: [`No ${documentType} template available for state ${stateCode}`],
        warnings: [],
      };
    }
    return template.validateData(divorceData);
  }

  // ---------------------------------------------------------------------------
  // Document generation
  // ---------------------------------------------------------------------------

  generateAffidavit(stateCode, affidavitData) {
    const template = this.getTemplate(stateCode, 'affidavit');
    return template.generateDocument(affidavitData);
  }

  generateDivorcePetition(stateCode, divorceData) {
    const template = this.getTemplate(stateCode, 'divorce_petition');
    if (!template) {
      throw new Error(`No divorce petition template available for state ${stateCode}`);
    }
    return template.generateDocument(divorceData);
  }

  generateDivorceDecree(stateCode, divorceData) {
    const template = this.getTemplate(stateCode, 'divorce_decree');
    if (!template) {
      throw new Error(`No divorce decree template available for state ${stateCode}`);
    }
    return template.generateDocument(divorceData);
  }

  generateDocument(stateCode, documentType, data) {
    const template = this.getTemplate(stateCode, documentType);
    if (!template) {
      throw new Error(`No ${documentType} template available for state ${stateCode}`);
    }
    return template.generateDocument(data);
  }

  // ---------------------------------------------------------------------------
  // Metadata & citations
  // ---------------------------------------------------------------------------

  getLegalCitations(stateCode) {
    return this.registry.getLegalCitations(stateCode);
  }

  getMetadata(stateCode, documentType = 'affidavit') {
    return this.registry.getMetadata(stateCode?.toUpperCase(), documentType);
  }

  getAllMetadataForState(stateCode) {
    return this.registry.getAllMetadataForState(stateCode?.toUpperCase());
  }
}

module.exports = { StateTemplateManager };
