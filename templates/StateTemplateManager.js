// templates/StateTemplateManager.js
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
   * Validate document against state requirements
   * @param {Object} affidavitData Document data
   * @returns {Object} Validation result
   */
  validateDocument(affidavitData) {
    const errors = [];
    const warnings = [];
    
    // Check required fields
    Object.keys(this.requiredFields).forEach(field => {
      const fieldConfig = this.requiredFields[field];
      
      if (fieldConfig.required) {
        if (!affidavitData[field]) {
          errors.push(fieldConfig.errorMessage);
        } else if (field === 'facts' && Array.isArray(affidavitData[field])) {
          if (affidavitData[field].length < (fieldConfig.minItems || 1)) {
            errors.push(fieldConfig.errorMessage);
          }
        }
      }
    });
    
    // State-specific validation logic
    const stateValidation = this.performStateSpecificValidation(affidavitData);
    errors.push(...stateValidation.errors);
    warnings.push(...stateValidation.warnings);
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      requiredFields: this.requiredFields
    };
  }
  
  /**
   * Template method for state-specific validation
   * @param {Object} affidavitData Document data
   * @returns {Object} Validation errors and warnings
   */
  performStateSpecificValidation(affidavitData) {
    // Override in subclasses
    return { errors: [], warnings: [] };
  }
  
  /**
   * Generate introduction paragraph
   * @param {Object} affidavitData Document data
   * @returns {string} Introduction text
   */
  generateIntroduction(affidavitData) {
    const { affiantName } = affidavitData;
    
    if (!affiantName) {
      return 'I, __________________, being of sound mind and over the age of 18, hereby state under oath as follows:';
    }
    
    return `I, ${affiantName}, being of sound mind and over the age of 18, hereby state under oath as follows:`;
  }
  
  /**
   * Generate perjury statement
   * @returns {string} Perjury statement for this state
   */
  generatePerjuryStatement() {
    return 'I declare under penalty of perjury that the foregoing is true and correct to the best of my knowledge.';
  }
  
  /**
   * Generate notary block
   * @param {Object} affidavitData Document data
   * @returns {string} Notary block text
   */
  generateNotaryBlock(affidavitData) {
    const state = this.stateName || 'STATE OF __________';
    
    return `
STATE OF ${state}      §
                       §
COUNTY OF ________     §

SUBSCRIBED AND SWORN TO BEFORE ME on the _____ day of _______________, 20_____.

                                        _______________________________
                                        NOTARY PUBLIC, STATE OF ${state}
                                        
                                        My commission expires: __________
`;
  }
  
  /**
   * Generate HTML preview
   * @param {Object} affidavitData Document data
   * @returns {Object} HTML sections for document preview
   */
  generatePreview(affidavitData) {
    return {
      header: this.generateHeader(affidavitData),
      venue: this.generateVenue(affidavitData),
      caseCaption: this.generateCaseCaption(affidavitData),
      title: this.generateTitle(affidavitData),
      introduction: this.generateIntroduction(affidavitData),
      facts: this.generateFacts(affidavitData),
      conclusion: this.generateConclusion(affidavitData),
      perjuryStatement: this.generatePerjuryStatement(),
      signatureBlock: this.generateSignatureBlock(affidavitData),
      notaryBlock: this.generateNotaryBlock(affidavitData),
      footer: this.generateFooter(affidavitData)
    };
  }
  
  /**
   * Generate header
   * @param {Object} affidavitData Document data
   * @returns {string} Header text
   */
  generateHeader(affidavitData) {
    return `AFFIDAVIT OF ${affidavitData.affiantName?.toUpperCase() || '________________'}`;
  }
  
  /**
   * Generate venue
   * @param {Object} affidavitData Document data
   * @returns {string} Venue text
   */
  generateVenue(affidavitData) {
    const state = this.stateName || 'STATE OF __________';
    const county = affidavitData.county?.toUpperCase() || 'COUNTY OF __________';
    
    return `${state}
${county}`;
  }
  
  /**
   * Generate case caption
   * @param {Object} affidavitData Document data
   * @returns {string} Case caption
   */
  generateCaseCaption(affidavitData) {
    if (!affidavitData.caseNumber && !affidavitData.caseType) {
      return '';
    }
    
    return `
${affidavitData.caseType || '________________'}

CASE NO. ${affidavitData.caseNumber || '________________'}
`;
  }
  
  /**
   * Generate title
   * @param {Object} affidavitData Document data
   * @returns {string} Title text
   */
  generateTitle(affidavitData) {
    const documentType = affidavitData.documentType || 'GENERAL';
    return `AFFIDAVIT OF ${affidavitData.affiantName?.toUpperCase() || '________________'} (${documentType.toUpperCase()})`;
  }
  
  /**
   * Generate facts section
   * @param {Object} affidavitData Document data
   * @returns {Array} List of formatted facts
   */
  generateFacts(affidavitData) {
    if (!affidavitData.facts || !Array.isArray(affidavitData.facts) || affidavitData.facts.length === 0) {
      return ['____________________'];
    }
    
    return affidavitData.facts;
  }
  
  /**
   * Generate conclusion
   * @param {Object} affidavitData Document data
   * @returns {string} Conclusion text
   */
  generateConclusion(affidavitData) {
    return 'Further affiant sayeth not.';
  }
  
  /**
   * Generate signature block
   * @param {Object} affidavitData Document data
   * @returns {Object} Signature block components
   */
  generateSignatureBlock(affidavitData) {
    return {
      name: affidavitData.affiantName || '________________',
      title: 'Affiant',
      date: 'Date: ________________'
    };
  }
  
  /**
   * Generate footer
   * @param {Object} affidavitData Document data
   * @returns {Object} Footer information
   */
  generateFooter(affidavitData) {
    return {
      disclaimer: 'This document was prepared using automated document assembly software.',
      pageCount: 'Page {0} of {1}'
    };
  }
  
  /**
   * Get all template settings
   * @returns {Object} Template configuration
   */
  getTemplateConfig() {
    return {
      state: this.state,
      stateName: this.stateName,
      requiredFields: this.requiredFields,
      formatting: this.formatting,
      sections: this.sections,
      documentTypes: this.documentTypes
    };
  }
}

/**
 * Texas-specific template
 */
class TexasTemplate extends BaseAffidavitTemplate {
  constructor() {
    super();
    this.state = 'TX';
    this.stateName = 'TEXAS';
    
    // Texas requires county
    this.requiredFields.county = { 
      required: true, 
      errorMessage: 'County is required for Texas affidavits' 
    };
    
    // Add Texas-specific document types
    this.documentTypes.push('family_law', 'probate');
  }
  
  performStateSpecificValidation(affidavitData) {
    const errors = [];
    const warnings = [];
    
    if (!affidavitData.county) {
      errors.push('County is required for Texas affidavits');
    }
    
    // Texas-specific content warnings
    if (Array.isArray(affidavitData.facts)) {
      affidavitData.facts.forEach((fact, index) => {
        if (fact && fact.length > 250) {
          warnings.push(`Fact #${index + 1} is very long. Consider breaking into shorter statements.`);
        }
      });
    }
    
    return { errors, warnings };
  }
  
  generateNotaryBlock(affidavitData) {
    const county = affidavitData.county?.toUpperCase() || '________';
    
    return `
STATE OF TEXAS        §
                      §
COUNTY OF ${county}   §

SUBSCRIBED AND SWORN TO BEFORE ME on the _____ day of _______________, 20_____, 
to certify which witness my hand and seal of office.

                                        _______________________________
                                        NOTARY PUBLIC, STATE OF TEXAS
                                        
                                        My commission expires: __________
`;
  }
}

/**
 * Utah-specific template
 */
class UtahTemplate extends BaseAffidavitTemplate {
  constructor() {
    super();
    this.state = 'UT';
    this.stateName = 'UTAH';
    
    // Utah has additional document types
    this.documentTypes.push('divorce', 'custody');
  }
  
  performStateSpecificValidation(affidavitData) {
    const errors = [];
    const warnings = [];
    
    // Utah-specific content validation
    if (Array.isArray(affidavitData.facts) && affidavitData.facts.length < 2) {
      warnings.push('Utah affidavits typically contain at least 2 factual statements.');
    }
    
    return { errors, warnings };
  }
  
  generateNotaryBlock(affidavitData) {
    return `
STATE OF UTAH         §
                      §
COUNTY OF ________    §

On this _____ day of _______________, 20_____, personally appeared before me
${affidavitData.affiantName || '________________'}, the signer of the foregoing instrument,
who duly acknowledged to me that he/she executed the same.

                                        _______________________________
                                        NOTARY PUBLIC, STATE OF UTAH
                                        
                                        My commission expires: __________
                                        Residing at: ___________________
`;
  }
}

/**
 * Arizona-specific template
 */
class ArizonaTemplate extends BaseAffidavitTemplate {
  constructor() {
    super();
    this.state = 'AZ';
    this.stateName = 'ARIZONA';
    
    // Arizona doesn't typically use venue section in the same way
    this.sections.venue = false;
    
    // Arizona has additional document types
    this.documentTypes.push('property', 'immigration');
  }
  
  performStateSpecificValidation(affidavitData) {
    const errors = [];
    const warnings = [];
    
    // Arizona-specific content validation
    if (Array.isArray(affidavitData.facts)) {
      let personalKnowledgeFound = false;
      
      affidavitData.facts.forEach(fact => {
        if (fact && fact.toLowerCase().includes('personal knowledge')) {
          personalKnowledgeFound = true;
        }
      });
      
      if (!personalKnowledgeFound) {
        warnings.push('Arizona affidavits typically state that facts are based on personal knowledge.');
      }
    }
    
    return { errors, warnings };
  }
  
  generateHeader(affidavitData) {
    return `AFFIDAVIT OF ${affidavitData.affiantName?.toUpperCase() || '________________'}`;
  }
  
  generateNotaryBlock(affidavitData) {
    return `
STATE OF ARIZONA      §
                      §
COUNTY OF ________    §

SUBSCRIBED AND SWORN TO BEFORE ME on this _____ day of _______________, 20_____, 
by ${affidavitData.affiantName || '________________'}.

                                        _______________________________
                                        NOTARY PUBLIC, STATE OF ARIZONA
                                        
                                        My commission expires: __________
`;
  }
  
  generateIntroduction(affidavitData) {
    const { affiantName } = affidavitData;
    
    if (!affiantName) {
      return 'I, __________________, being first duly sworn upon oath, depose and state:';
    }
    
    return `I, ${affiantName}, being first duly sworn upon oath, depose and state:`;
  }
}

/**
 * Manager class for state templates
 */
class StateTemplateManager {
  constructor() {
    // Initialize all state templates
    this.templates = {
      'TX': new TexasTemplate(),
      'UT': new UtahTemplate(),
      'AZ': new ArizonaTemplate()
    };
    
    // Default state if none specified
    this.defaultState = 'TX';
    
    logger.info('StateTemplateManager initialized with states:', Object.keys(this.templates));
  }
  
  /**
   * Get template for specific state
   * @param {string} stateCode Two-letter state code
   * @returns {BaseAffidavitTemplate} State template
   */
  getTemplate(stateCode) {
    if (!stateCode) {
      logger.warn('No state specified, using default state:', this.defaultState);
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
   * @returns {Array} List of state info objects
   */
  getSupportedStates() {
    return Object.values(this.templates).map(template => ({
      code: template.state,
      name: template.stateName,
      requirements: template.requiredFields
    }));
  }
  
  /**
   * Get supported document types for a state
   * @param {string} stateCode Two-letter state code
   * @returns {Array} List of document types
   */
  getSupportedDocumentTypes(stateCode) {
    const template = this.getTemplate(stateCode);
    return template.documentTypes;
  }
  
  /**
   * Validate document for a specific state
   * @param {Object} affidavitData Document data
   * @returns {Object} Validation result
   */
  validateDocument(affidavitData) {
    const stateCode = affidavitData.state || this.defaultState;
    const template = this.getTemplate(stateCode);
    
    return template.validateDocument(affidavitData);
  }
  
  /**
   * Generate document preview
   * @param {Object} affidavitData Document data
   * @returns {Object} Document sections
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
   * @param {string} stateCode Two-letter state code
   * @returns {Object} Template configuration
   */
  getTemplateConfig(stateCode) {
    const template = this.getTemplate(stateCode);
    return template.getTemplateConfig();
  }
  
  /**
   * Generate document sections
   * Each section is generated through the template
   * @param {Object} affidavitData Document data
   * @returns {Object} Document sections
   */
  generateDocumentSections(affidavitData) {
    const stateCode = affidavitData.state || this.defaultState;
    const template = this.getTemplate(stateCode);
    
    return {
      header: template.generateHeader(affidavitData),
      venue: template.sections.venue ? template.generateVenue(affidavitData) : null,
      caseCaption: template.sections.caseCaption ? template.generateCaseCaption(affidavitData) : null,
      title: template.sections.title ? template.generateTitle(affidavitData) : null,
      introduction: template.sections.introduction ? template.generateIntroduction(affidavitData) : null,
      facts: template.sections.facts ? template.generateFacts(affidavitData) : null,
      conclusion: template.sections.conclusion ? template.generateConclusion(affidavitData) : null,
      perjuryStatement: template.sections.perjuryStatement ? template.generatePerjuryStatement() : null,
      signatureBlock: template.sections.signatureBlock ? template.generateSignatureBlock(affidavitData) : null,
      notaryBlock: template.sections.notaryBlock ? template.generateNotaryBlock(affidavitData) : null,
      footer: template.sections.footer ? template.generateFooter(affidavitData) : null
    };
  }
}

module.exports = {
  StateTemplateManager,
  BaseAffidavitTemplate,
  TexasTemplate,
  UtahTemplate,
  ArizonaTemplate
};