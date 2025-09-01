// templates/StateTemplateManager.js - COMPLETE DROP-IN REPLACEMENT
const logger = require('../services/logger');

/**
 * Base template class with common functionality
 */
class BaseAffidavitTemplate {
  constructor() {
    this.state = '';
    this.stateName = '';
    this.documentTypes = ['general', 'financial', 'personal'];
    
    // Define required fields for all states
    this.requiredFields = {
      affiantName: { required: true, errorMessage: 'Affiant name is required' },
      facts: { required: true, errorMessage: 'At least one fact is required', minItems: 1 }
    };
    
    // Styling and formatting for all states
    this.formatting = {
      fontFamily: 'Times New Roman, serif',
      fontSize: '12pt',
      lineHeight: 1.5,
      margins: { top: '1in', bottom: '1in', left: '1in', right: '1in' },
      pageSize: 'letter'
    };
    
    // Default sections structure
    this.sections = {
      header: true,
      venue: true,
      caseCaption: false,
      title: true,
      introduction: true,
      facts: true,
      conclusion: true,
      perjuryStatement: true,
      signatureBlock: true,
      notaryBlock: true,
      footer: true
    };
  }
  
  /**
   * ✅ FIXED: Validate document against state requirements with deduplication
   */
  validateDocument(affidavitData) {
    // ✅ Use Set to prevent duplicate errors
    const errorSet = new Set();
    const warningSet = new Set();
    
    // Check required fields
    Object.keys(this.requiredFields).forEach(field => {
      const fieldConfig = this.requiredFields[field];
      
      if (fieldConfig.required) {
        if (!affidavitData[field]) {
          errorSet.add(fieldConfig.errorMessage);
        } else if (field === 'facts' && Array.isArray(affidavitData[field])) {
          if (affidavitData[field].length < (fieldConfig.minItems || 1)) {
            errorSet.add(fieldConfig.errorMessage);
          }
        }
      }
    });
    
    // State-specific validation logic
    const stateValidation = this.performStateSpecificValidation(affidavitData);
    
    // ✅ Add to sets to prevent duplicates
    stateValidation.errors.forEach(error => errorSet.add(error));
    stateValidation.warnings.forEach(warning => warningSet.add(warning));
    
    return {
      isValid: errorSet.size === 0,
      errors: Array.from(errorSet),
      warnings: Array.from(warningSet)
    };
  }
  
  /**
   * Template method for state-specific validation
   */
  performStateSpecificValidation(affidavitData) {
    // Override in subclasses
    return { errors: [], warnings: [] };
  }
  
  /**
   * Generate document preview
   */
  generatePreview(affidavitData) {
    const sections = {};
    
    // Header
    sections.header = {
      type: 'header',
      title: 'AFFIDAVIT',
      content: `STATE OF ${this.stateName.toUpperCase()}`
    };
    
    // Venue
    if (this.sections.venue) {
      sections.venue = {
        type: 'venue',
        content: `STATE OF ${this.stateName.toUpperCase()}\nCOUNTY OF ${(affidavitData.county || '_______').toUpperCase()}`
      };
    }
    
    // Introduction
    sections.introduction = {
      type: 'introduction',
      title: 'INTRODUCTION',
      content: this.generateIntroduction(affidavitData)
    };
    
    // Facts
    sections.facts = {
      type: 'facts',
      title: 'STATEMENT OF FACTS',
      content: affidavitData.facts || []
    };
    
    // Signature block
    sections.signatureBlock = {
      type: 'signatureBlock',
      title: 'SIGNATURE',
      content: this.generateSignatureBlock(affidavitData)
    };
    
    // Notary block
    sections.notaryBlock = {
      type: 'notaryBlock',
      title: 'NOTARIZATION',
      content: this.generateNotaryBlock(affidavitData)
    };
    
    return sections;
  }
  
  /**
   * Generate introduction paragraph
   */
  generateIntroduction(affidavitData) {
    const { affiantName } = affidavitData;
    
    if (!affiantName) {
      return 'I, __________________, being of sound mind and over the age of 18, hereby state under oath as follows:';
    }
    
    return `I, ${affiantName}, being of sound mind and over the age of 18, hereby state under oath as follows:`;
  }
  
  /**
   * Generate signature block
   */
  generateSignatureBlock(affidavitData) {
    return `I declare under penalty of perjury that the foregoing is true and correct to the best of my knowledge.\n\n_________________________________\n${affidavitData.affiantName || '[Affiant Name]'}\n\nDate: _________________`;
  }
  
  /**
   * Generate notary block
   */
  generateNotaryBlock(affidavitData) {
    return `SUBSCRIBED AND SWORN TO BEFORE ME on the _____ day of _______________, 20_____.\n\n_________________________________\nNotary Public\nMy Commission Expires: __________`;
  }
  
  /**
   * Get template configuration
   */
  getTemplateConfig() {
    return {
      state: this.state,
      stateName: this.stateName,
      documentTypes: this.documentTypes,
      formatting: this.formatting,
      sections: this.sections,
      requiredFields: this.requiredFields
    };
  }
}

/**
 * ✅ FIXED: Texas template with no duplicate county validation
 */
class TexasAffidavitTemplate extends BaseAffidavitTemplate {
  constructor() {
    super();
    this.state = 'TX';
    this.stateName = 'Texas';
    
    // ✅ Add county to base required fields (prevents duplication)
    this.requiredFields = {
      ...this.requiredFields,
      county: { 
        required: true, 
        errorMessage: 'County is required for Texas affidavits' 
      }
    };
  }
  
  /**
   * ✅ FIXED: No duplicate county validation
   */
  performStateSpecificValidation(affidavitData) {
    const errors = [];
    const warnings = [];
    
    // Only add validations NOT already in requiredFields
    if (affidavitData.caseNumber && affidavitData.caseNumber.length > 50) {
      warnings.push('Case numbers longer than 50 characters may cause formatting issues');
    }
    
    return { errors, warnings };
  }
}

/**
 * Utah template
 */
class UtahAffidavitTemplate extends BaseAffidavitTemplate {
  constructor() {
    super();
    this.state = 'UT';
    this.stateName = 'Utah';
    
    this.requiredFields = {
      ...this.requiredFields,
      county: { 
        required: true, 
        errorMessage: 'County is required for Utah affidavits' 
      }
    };
  }
  
  performStateSpecificValidation(affidavitData) {
    const errors = [];
    const warnings = [];
    
    if (affidavitData.facts && affidavitData.facts.length > 20) {
      warnings.push('Consider condensing facts for better readability');
    }
    
    return { errors, warnings };
  }
}

/**
 * Arizona template  
 */
class ArizonaAffidavitTemplate extends BaseAffidavitTemplate {
  constructor() {
    super();
    this.state = 'AZ';
    this.stateName = 'Arizona';
    
    // Arizona doesn't require county
    this.sections = {
      ...this.sections,
      venue: false // Arizona doesn't use venue section
    };
  }
  
  performStateSpecificValidation(affidavitData) {
    const errors = [];
    const warnings = [];
    
    if (!affidavitData.documentType || affidavitData.documentType === 'general') {
      warnings.push('Consider specifying a more specific document type');
    }
    
    return { errors, warnings };
  }
}

/**
 * ✅ State Template Manager - manages all templates
 */
class StateTemplateManager {
  constructor() {
    this.templates = {
      'TX': new TexasAffidavitTemplate(),
      'UT': new UtahAffidavitTemplate(),
      'AZ': new ArizonaAffidavitTemplate()
    };
    
    this.defaultState = 'TX';
    
    logger.info('StateTemplateManager initialized with states:', {
      ...Object.keys(this.templates).reduce((acc, key, index) => ({
        ...acc,
        [index]: key
      }), {})
    });
  }
  
  /**
   * Get template for a specific state
   */
  getTemplate(stateCode) {
    if (!stateCode) {
      logger.warn('No state code provided, using default:', this.defaultState);
      return this.templates[this.defaultState];
    }
    
    const normalizedCode = stateCode.toUpperCase();
    
    if (!this.templates[normalizedCode]) {
      logger.warn(`Template for state ${normalizedCode} not found, using default:`, this.defaultState);
      return this.templates[this.defaultState];
    }
    
    return this.templates[normalizedCode];
  }
  
  /**
   * Get list of supported states
   */
  getSupportedStates() {
    return Object.values(this.templates).map(template => ({
      code: template.state,
      name: template.stateName,
      requirements: template.requiredFields
    }));
  }
  
  /**
   * ✅ Validate document for a specific state (deduplication handled in template)
   */
  validateDocument(affidavitData) {
    const stateCode = affidavitData.state || this.defaultState;
    const template = this.getTemplate(stateCode);
    
    return template.validateDocument(affidavitData);
  }
  
  /**
   * ✅ Generate document preview
   */
  generatePreview(affidavitData) {
    const stateCode = affidavitData.state || this.defaultState;
    const template = this.getTemplate(stateCode);
    
    return {
      sections: template.generatePreview(affidavitData),
      formatting: template.formatting,
      config: template.getTemplateConfig()
    };
  }
  
  /**
   * Get template configuration for a state
   */
  getTemplateConfig(stateCode) {
    const template = this.getTemplate(stateCode);
    return template.getTemplateConfig();
  }
}

module.exports = { StateTemplateManager, BaseAffidavitTemplate };