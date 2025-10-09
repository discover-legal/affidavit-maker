// templates/StateTemplateManager.js - COMPLETE FIXED VERSION
// Drop-in replacement - includes BaseAffidavitTemplate and all state templates

const logger = require('../utils/logger');

/**
 * ✅ Base template class for all affidavit templates
 */
class BaseAffidavitTemplate {
  constructor() {
    this.state = '';
    this.stateName = '';
    this.requiredFields = ['affiantName', 'state'];
    this.sections = {
      venue: true,
      caseCaption: false,
      notaryBlock: true
    };
    this.formatting = {
      fontSize: '12pt',
      fontFamily: 'Times New Roman',
      lineSpacing: 'double',
      margins: '1 inch'
    };
  }

  /**
   * Generate document preview
   */
  generatePreview(affidavitData) {
    const sections = {};
    
    sections.header = {
      type: 'header',
      title: 'AFFIDAVIT',
      content: `STATE OF ${this.stateName.toUpperCase()}`
    };
    
    if (this.sections.venue) {
      sections.venue = {
        type: 'venue',
        content: `STATE OF ${this.stateName.toUpperCase()}\nCOUNTY OF ${(affidavitData.county || '_______').toUpperCase()}`
      };
    }
    
    sections.introduction = {
      type: 'introduction',
      title: 'INTRODUCTION',
      content: this.generateIntroduction(affidavitData)
    };
    
    sections.facts = {
      type: 'facts',
      title: 'STATEMENT OF FACTS',
      content: this.processFactsForPreview(affidavitData.facts || [])
    };
    
    sections.signatureBlock = {
      type: 'signatureBlock',
      title: 'SIGNATURE',
      content: this.generateSignatureBlock(affidavitData)
    };
    
    sections.notaryBlock = {
      type: 'notaryBlock',
      title: 'NOTARIZATION',
      content: this.generateNotaryBlock(affidavitData)
    };
    
    return sections;
  }

  /**
   * Process facts for preview display
   */
  processFactsForPreview(facts) {
    if (!Array.isArray(facts) || facts.length === 0) {
      return 'Start chatting to add facts to your affidavit.';
    }
    
    const processedFacts = [];
    
    facts.forEach((fact, index) => {
      const content = this.extractFactContent(fact);
      
      if (!content || content.trim().length === 0) {
        return;
      }
      
      const numberedFact = `${index + 1}. ${content.trim()}`;
      processedFacts.push(numberedFact);
    });
    
    if (processedFacts.length === 0) {
      return 'No valid facts to display.';
    }
    
    return processedFacts.join('\n\n');
  }

  /**
   * Extract content from fact (handles both string and object facts)
   */
  extractFactContent(fact) {
    if (typeof fact === 'string') {
      return fact;
    } else if (typeof fact === 'object' && fact !== null) {
      return fact.professionalRewrite || fact.content || fact.text || '';
    } else {
      return String(fact);
    }
  }

  /**
   * Generate introduction paragraph
   */
  generateIntroduction(affidavitData) {
    const name = affidavitData.affiantName || '[YOUR NAME]';
    return `I, ${name}, being first duly sworn, depose and state as follows:`;
  }

  /**
   * Generate signature block
   */
  generateSignatureBlock(affidavitData) {
    const name = affidavitData.affiantName || '[YOUR NAME]';
    return `I declare under penalty of perjury that the foregoing is true and correct to the best of my knowledge and belief.

FURTHER AFFIANT SAYETH NOT.

Executed on this _____ day of _________, 2025.


_________________________________
${name}`;
  }

  /**
   * Generate notary block (override in subclasses)
   */
  generateNotaryBlock(affidavitData) {
    return `NOTARY ACKNOWLEDGMENT

State of ${this.stateName}
County of ${affidavitData.county || '_______'}

On this _____ day of _________, 2025, before me personally appeared ${affidavitData.affiantName || '[NAME]'}, who proved to me on the basis of satisfactory evidence to be the person whose name is subscribed to the within instrument.


_________________________________
Notary Public

My commission expires: ___________`;
  }

  /**
   * State-specific validation (override in subclasses)
   */
  performStateSpecificValidation(affidavitData) {
    return { errors: [], warnings: [] };
  }

  /**
   * Get county validation rules (override in subclasses)
   */
  getCountyValidationRules() {
    return {
      required: false,
      stateName: this.stateName,
      stateCode: this.state,
      commonCounties: []
    };
  }

  /**
   * Get template configuration
   */
  getTemplateConfig() {
    return {
      state: this.state,
      stateName: this.stateName,
      requiredFields: this.requiredFields,
      sections: this.sections,
      formatting: this.formatting
    };
  }

  /**
   * Calculate word count from facts
   */
  calculateWordCount(facts) {
    if (!facts || !Array.isArray(facts)) return 0;
    
    return facts.reduce((count, fact) => {
      const content = this.extractFactContent(fact);
      return count + content.split(/\s+/).filter(word => word.length > 0).length;
    }, 0);
  }

  /**
   * Extract categories from facts
   */
  extractCategories(facts) {
    if (!facts || !Array.isArray(facts)) return [];
    
    const categories = new Set();
    facts.forEach(fact => {
      if (typeof fact === 'object' && fact !== null && fact.category) {
        categories.add(fact.category);
      }
    });
    
    return Array.from(categories);
  }
}

/**
 * ✅ Texas-specific affidavit template
 */
class TexasTemplate extends BaseAffidavitTemplate {
  constructor() {
    super();
    this.state = 'TX';
    this.stateName = 'Texas';
    this.requiredFields = ['affiantName', 'state', 'county']; // ✅ County required
    this.sections = {
      venue: true,
      caseCaption: true,
      notaryBlock: true
    };
  }

  performStateSpecificValidation(affidavitData) {
    const errors = [];
    const warnings = [];
    
    // ✅ Texas requires county - ONLY validate here
    if (!affidavitData.county || affidavitData.county.trim() === '') {
      errors.push('County is required for Texas affidavits');
    }
    
    if (!affidavitData.caseNumber && !affidavitData.caseType) {
      warnings.push('Consider adding case number or case type if this relates to a legal proceeding');
    }
    
    return { errors, warnings };
  }

  getCountyValidationRules() {
    return {
      required: true, // ✅ County IS required in Texas
      stateName: 'Texas',
      stateCode: 'TX',
      commonCounties: [
        'Harris', 'Dallas', 'Tarrant', 'Bexar', 'Travis',
        'Collin', 'Denton', 'Fort Bend', 'Hidalgo', 'El Paso'
      ]
    };
  }

  generateNotaryBlock(affidavitData) {
    return `NOTARY ACKNOWLEDGMENT

State of Texas
County of ${affidavitData.county || '_______'}

On this _____ day of _________, 2025, before me, the undersigned notary public, personally appeared ${affidavitData.affiantName || '[NAME]'}, who proved to me on the basis of satisfactory evidence to be the person whose name is subscribed to the within instrument and acknowledged to me that he/she executed the same in his/her authorized capacity, and that by his/her signature on the instrument the person, or the entity upon behalf of which the person acted, executed the instrument.

I certify under PENALTY OF PERJURY under the laws of the State of Texas that the foregoing paragraph is true and correct.

WITNESS my hand and official seal.


_________________________________
Signature of Notary Public

[Notary Seal]

My commission expires: ___________`;
  }
}

/**
 * ✅ Utah-specific affidavit template
 */
class UtahTemplate extends BaseAffidavitTemplate {
  constructor() {
    super();
    this.state = 'UT';
    this.stateName = 'Utah';
    this.requiredFields = ['affiantName', 'state', 'county']; // ✅ County required
    this.sections = {
      venue: true,
      caseCaption: false,
      notaryBlock: true
    };
  }

  performStateSpecificValidation(affidavitData) {
    const errors = [];
    const warnings = [];
    
    // ✅ Utah requires county - ONLY validate here
    if (!affidavitData.county || affidavitData.county.trim() === '') {
      errors.push('County is required for Utah affidavits');
    }
    
    return { errors, warnings };
  }

  getCountyValidationRules() {
    return {
      required: true, // ✅ County IS required in Utah
      stateName: 'Utah',
      stateCode: 'UT',
      commonCounties: [
        'Salt Lake', 'Utah', 'Davis', 'Weber', 'Washington',
        'Cache', 'Summit', 'Tooele', 'Iron', 'Sanpete'
      ]
    };
  }

  generateNotaryBlock(affidavitData) {
    return `NOTARY ACKNOWLEDGMENT

State of Utah
County of ${affidavitData.county || '_______'}

On the _____ day of _________, 2025, personally appeared before me ${affidavitData.affiantName || '[NAME]'}, who duly acknowledged that he/she executed the foregoing instrument.


_________________________________
Notary Public

My commission expires: ___________`;
  }
}

/**
 * ✅ Arizona-specific affidavit template
 */
class ArizonaTemplate extends BaseAffidavitTemplate {
  constructor() {
    super();
    this.state = 'AZ';
    this.stateName = 'Arizona';
    this.requiredFields = ['affiantName', 'state']; // ✅ County NOT required
    this.sections = {
      venue: false, // Arizona doesn't require venue
      caseCaption: false,
      notaryBlock: true
    };
  }

  performStateSpecificValidation(affidavitData) {
    const errors = [];
    const warnings = [];
    
    // ✅ Arizona does NOT require county - only optional warning
    if (!affidavitData.county) {
      warnings.push('County information is helpful for Arizona affidavits but not required');
    }
    
    return { errors, warnings };
  }

  getCountyValidationRules() {
    return {
      required: false, // ✅ County is NOT required in Arizona
      stateName: 'Arizona',
      stateCode: 'AZ',
      commonCounties: [
        'Maricopa', 'Pima', 'Pinal', 'Yavapai', 'Mohave',
        'Coconino', 'Yuma', 'Navajo', 'Apache', 'Cochise'
      ]
    };
  }

  generateNotaryBlock(affidavitData) {
    return `VERIFICATION

State of Arizona
County of ${affidavitData.county || '_______'}

I, ${affidavitData.affiantName || '[NAME]'}, being duly sworn, depose and say that I have read the foregoing affidavit and that the facts stated therein are true and correct to the best of my knowledge and belief.


_________________________________
${affidavitData.affiantName || '[NAME]'}

Subscribed and sworn to before me this _____ day of _________, 2025.


_________________________________
Notary Public

My commission expires: ___________`;
  }
}

/**
 * ✅ Main StateTemplateManager class
 */
class StateTemplateManager {
  constructor() {
    this.templates = {
      'TX': new TexasTemplate(),
      'UT': new UtahTemplate(),
      'AZ': new ArizonaTemplate()
    };
    this.defaultState = 'TX';
    
    logger.info('StateTemplateManager initialized', {
      states: Object.keys(this.templates)
    });
  }
  
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
  
  getSupportedStates() {
    return Object.values(this.templates).map(template => ({
      code: template.state,
      name: template.stateName,
      requirements: template.requiredFields
    }));
  }
  
  validateDocument(affidavitData) {
    const stateCode = affidavitData.state || this.defaultState;
    const template = this.getTemplate(stateCode);
    
    const errors = [];
    const warnings = [];

    // Basic validation
    if (!affidavitData.affiantName || affidavitData.affiantName.trim().length < 2) {
      errors.push('Affiant name is required');
    }

    if (!affidavitData.state) {
      errors.push('State is required');
    }

    // State-specific validation (includes county check)
    const stateValidation = template.performStateSpecificValidation(affidavitData);
    errors.push(...stateValidation.errors);
    warnings.push(...stateValidation.warnings);

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
  
  generatePreview(affidavitData) {
    try {
      const stateCode = affidavitData.state || this.defaultState;
      const template = this.getTemplate(stateCode);
      
      const sections = template.generatePreview(affidavitData);
      const validation = this.validateDocument(affidavitData);
      
      return {
        success: true,
        sections,
        validation,
        metadata: {
          state: stateCode,
          stateName: template.stateName,
          wordCount: template.calculateWordCount(affidavitData.facts),
          factCount: affidavitData.facts?.length || 0,
          categories: template.extractCategories(affidavitData.facts),
          generatedAt: new Date().toISOString()
        }
      };
    } catch (error) {
      logger.error('Preview generation failed:', error);
      return {
        success: false,
        error: error.message,
        sections: {},
        validation: {
          isValid: false,
          errors: ['Preview generation failed'],
          warnings: []
        }
      };
    }
  }
}

module.exports = { StateTemplateManager, BaseAffidavitTemplate };
