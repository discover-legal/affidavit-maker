// templates/StateTemplateManager.js - COMPLETE DROP-IN REPLACEMENT
// ✅ NOW INCLUDES CALIFORNIA (CA) - Declaration format for family law
// Court-compliant notary blocks (shortened to fit on page)

const logger = require('../utils/logger');
const { extractFactContent } = require('../utils/factNormalizer');

/**
 * Base template class for all affidavit templates
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

  validateData(affidavitData = {}) {
    const errors = [];
    const warnings = [];

    if (!affidavitData.affiantName || affidavitData.affiantName.trim().length < 2) {
      errors.push('Affiant name is required and must be at least 2 characters');
    }

    if (!Array.isArray(affidavitData.facts) || affidavitData.facts.length === 0) {
      warnings.push('No facts provided - affidavit will be incomplete');
    }

    const stateValidation = this.performStateSpecificValidation(affidavitData) || { errors: [], warnings: [] };
    errors.push(...(stateValidation.errors || []));
    warnings.push(...(stateValidation.warnings || []));

    return { isValid: errors.length === 0, errors, warnings };
  }

  generateDocument(affidavitData = {}) {
    const validation = this.validateData(affidavitData);
    if (!validation.isValid && this.state === 'TX') {
      throw new Error('Invalid data for Texas');
    }

    const id = require('uuid').v4();
    const header = this.state === 'TX' ? 'THE STATE OF TEXAS' : `STATE OF ${this.stateName.toUpperCase()}`;
    
    let venue = null;
    if (this.sections.venue) {
      const countyUpper = (affidavitData.county || '[COUNTY]').toUpperCase();
      venue = this.state === 'TX' 
        ? `COUNTY OF ${countyUpper}`
        : `County of ${countyUpper}`;
    }

    const title = `AFFIDAVIT OF ${(affidavitData.affiantName || '[NAME]').toUpperCase()}`;
    const facts = this.processFactsForDocument(affidavitData.facts || []);
    const notaryBlock = this.generateNotaryBlock(affidavitData);
    
    const htmlContent = `<html><head><style>body{font-family:'Times New Roman',serif;font-size:12pt;line-height:2;margin:1in;}</style></head><body>${header}${venue ? `<div class="venue">${venue}</div>` : ''}<div class="title">${title}</div><div class="facts">${facts.map(f=>`<p class="fact">${f.number}. ${f.content}</p>`).join('')}</div><div class="notary">${notaryBlock.replace(/\n/g,'<br/>')}</div></body></html>`;

    return {
      id,
      state: this.state,
      sections: {
        header,
        venue: venue || null,
        title,
        facts,
        notaryBlock
      },
      htmlContent,
      validation
    };
  }

  generatePreview(affidavitData) {
    const sections = {};
    
    sections.header = {
      type: 'header',
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
      type: 'signature',
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

  processFactsForPreview(facts) {
    if (!Array.isArray(facts) || facts.length === 0) {
      return 'Start chatting to add facts to your affidavit.';
    }
    
    const processedFacts = [];
    
    facts.forEach((fact, index) => {
      const content = extractFactContent(fact);
      
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

  processFactsForDocument(facts) {
    if (!Array.isArray(facts)) return [];
    
    return facts.map((fact, index) => ({
      number: index + 1,
      content: extractFactContent(fact),
      type: 'fact'
    })).filter(f => f.content && f.content.trim().length > 0);
  }

  extractFactContent(fact) {
    return extractFactContent(fact);
  }

  generateIntroduction(affidavitData) {
    const name = affidavitData.affiantName || '[YOUR NAME]';
    return `I, ${name}, being first duly sworn, depose and state that I am over the age of eighteen (18) years, of sound mind, and otherwise competent to make this affidavit. The facts stated herein are within my personal knowledge and are true and correct.`;
  }

  generateSignatureBlock(affidavitData) {
    const name = affidavitData.affiantName || '[YOUR NAME]';
    return `I declare under penalty of perjury that the foregoing is true and correct.

FURTHER AFFIANT SAYETH NOT.

Executed on this _____ day of _________, 2025.


_________________________________
${name}, Affiant`;
  }

  // ✅ SHORTENED NOTARY BLOCK - Court compliant but compact
  generateNotaryBlock(affidavitData) {
    return `NOTARY ACKNOWLEDGMENT

Sworn to and subscribed before me this _____ day of _________, 2025.


_________________________________
Notary Public

My commission expires: ___________`;
  }

  performStateSpecificValidation(affidavitData) {
    return { errors: [], warnings: [] };
  }

  getCountyValidationRules() {
    return {
      required: false,
      stateName: this.stateName,
      stateCode: this.state,
      commonCounties: []
    };
  }

  getTemplateConfig() {
    return {
      state: this.state,
      stateName: this.stateName,
      requiredFields: this.requiredFields,
      sections: this.sections,
      formatting: this.formatting
    };
  }

  calculateWordCount(facts) {
    if (!facts || !Array.isArray(facts)) return 0;
    
    return facts.reduce((count, fact) => {
      const content = this.extractFactContent(fact);
      return count + content.split(/\s+/).filter(word => word.length > 0).length;
    }, 0);
  }

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

  generateDocumentTypeSpecificFacts(affidavitData = {}) {
    return [];
  }
}

/**
 * Texas-specific template
 */
class TexasTemplate extends BaseAffidavitTemplate {
  constructor() {
    super();
    this.state = 'TX';
    this.stateName = 'Texas';
    this.requiredFields = ['affiantName', 'state', 'county'];
    this.sections = {
      venue: true,
      caseCaption: true,
      notaryBlock: true
    };
  }

  performStateSpecificValidation(affidavitData) {
    const errors = [];
    const warnings = [];
    
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
      required: true,
      stateName: 'Texas',
      stateCode: 'TX',
      commonCounties: [
        'Harris', 'Dallas', 'Tarrant', 'Bexar', 'Travis',
        'Collin', 'Denton', 'Fort Bend', 'Hidalgo', 'El Paso'
      ]
    };
  }

  // ✅ TEXAS: Shortened but court-compliant jurat
  generateNotaryBlock(affidavitData) {
    return `NOTARY ACKNOWLEDGMENT

SWORN TO AND SUBSCRIBED before me on this _____ day of _________, 2025.


_________________________________
Notary Public, State of Texas

My commission expires: ___________`;
  }

  generateDocumentTypeSpecificFacts(affidavitData = {}) {
    const type = affidavitData.documentType || affidavitData.type || 'general';
    const facts = [];

    if (type === 'divorce') {
      facts.push({ type: 'divorce', content: `was married on ${affidavitData.marriageDate || 'UNKNOWN'} to ${affidavitData.spouseName || 'UNKNOWN'}` });
      facts.push({ type: 'divorce', content: `separated on ${affidavitData.separationDate || 'UNKNOWN'}` });
    }

    if (type === 'custody') {
      facts.push({ type: 'custody', content: `is a parent of ${ (affidavitData.children || []).join(', ') }` });
      facts.push({ type: 'custody', content: `current custody arrangement: ${affidavitData.currentCustody || 'Unknown'}` });
    }

    if (type === 'financial') {
      const income = affidavitData.monthlyIncome ? `$${affidavitData.monthlyIncome}` : 'Unknown';
      facts.push({ type: 'financial', content: `Monthly income: ${income}` });
      facts.push({ type: 'financial', content: `Monthly expenses: ${affidavitData.monthlyExpenses || 'Unknown'}` });
    }

    return facts;
  }
}

/**
 * Utah-specific template
 */
class UtahTemplate extends BaseAffidavitTemplate {
  constructor() {
    super();
    this.state = 'UT';
    this.stateName = 'Utah';
    this.requiredFields = ['affiantName', 'state', 'county'];
    this.sections = {
      venue: true,
      caseCaption: false,
      notaryBlock: true
    };
  }

  performStateSpecificValidation(affidavitData) {
    const errors = [];
    const warnings = [];
    
    if (!affidavitData.county || affidavitData.county.trim() === '') {
      errors.push('County is required for Utah affidavits');
    }
    
    return { errors, warnings };
  }

  getCountyValidationRules() {
    return {
      required: true,
      stateName: 'Utah',
      stateCode: 'UT',
      commonCounties: [
        'Salt Lake', 'Utah', 'Davis', 'Weber', 'Washington',
        'Cache', 'Summit', 'Tooele', 'Iron', 'Sanpete'
      ]
    };
  }

  // ✅ UTAH: Shortened verification format
  generateNotaryBlock(affidavitData) {
    return `NOTARY ACKNOWLEDGMENT

Subscribed and sworn to before me this _____ day of _________, 2025.


_________________________________
Notary Public, State of Utah

My commission expires: ___________`;
  }
}

/**
 * Arizona-specific template
 */
class ArizonaTemplate extends BaseAffidavitTemplate {
  constructor() {
    super();
    this.state = 'AZ';
    this.stateName = 'Arizona';
    this.requiredFields = ['affiantName', 'state'];
    this.sections = {
      venue: false,
      caseCaption: false,
      notaryBlock: true
    };
  }

  performStateSpecificValidation(affidavitData) {
    const errors = [];
    const warnings = [];
    
    if (!affidavitData.county) {
      warnings.push('County information is helpful for Arizona affidavits but not required');
    }
    
    return { errors, warnings };
  }

  getCountyValidationRules() {
    return {
      required: false,
      stateName: 'Arizona',
      stateCode: 'AZ',
      commonCounties: [
        'Maricopa', 'Pima', 'Pinal', 'Yavapai', 'Mohave',
        'Coconino', 'Yuma', 'Navajo', 'Apache', 'Cochise'
      ]
    };
  }

  // ✅ ARIZONA: Simplified verification
  generateNotaryBlock(affidavitData) {
    return `VERIFICATION

Subscribed and sworn to before me this _____ day of _________, 2025.


_________________________________
Notary Public, State of Arizona

My commission expires: ___________`;
  }
}

/**
 * ✅ NEW: California-specific template
 * Uses DECLARATION format per CCP § 2015.5 - NO NOTARY REQUIRED
 */
class CaliforniaTemplate extends BaseAffidavitTemplate {
  constructor() {
    super();
    this.state = 'CA';
    this.stateName = 'California';
    this.requiredFields = ['affiantName', 'state'];
    this.sections = {
      venue: false, // County optional in CA
      caseCaption: false,
      notaryBlock: false // ✅ NO NOTARY for declarations
    };
  }

  performStateSpecificValidation(affidavitData) {
    const errors = [];
    const warnings = [];
    
    // County is helpful but not required
    if (!affidavitData.county) {
      warnings.push('County is optional but recommended for California declarations');
    }
    
    // Check if execution location is specified
    if (!affidavitData.executionCity && !affidavitData.executionLocation) {
      warnings.push('Consider specifying execution location (city) for declarations executed in California');
    }
    
    return { errors, warnings };
  }

  getCountyValidationRules() {
    return {
      required: false,
      stateName: 'California',
      stateCode: 'CA',
      commonCounties: [
        'Los Angeles', 'San Diego', 'Orange', 'Riverside', 'San Bernardino',
        'Santa Clara', 'Alameda', 'Sacramento', 'Contra Costa', 'Fresno',
        'Kern', 'San Francisco', 'Ventura', 'San Mateo', 'San Joaquin'
      ]
    };
  }

  // Override to change document title for CA
  generateDocument(affidavitData = {}) {
    const validation = this.validateData(affidavitData);
    
    const id = require('uuid').v4();
    const header = 'STATE OF CALIFORNIA';
    
    // County is optional
    let venue = null;
    if (affidavitData.county) {
      venue = `County of ${affidavitData.county}`;
    }

    // California uses "Declaration" not "Affidavit"
    const title = `DECLARATION OF ${(affidavitData.affiantName || '[NAME]').toUpperCase()}`;
    const facts = this.processFactsForDocument(affidavitData.facts || []);
    const declarationBlock = this.generateNotaryBlock(affidavitData); // Actually generates declaration jurat
    
    const htmlContent = `<html><head><style>body{font-family:'Times New Roman',serif;font-size:12pt;line-height:2;margin:1in;}</style></head><body>${header}${venue ? `<div class="venue">${venue}</div>` : ''}<div class="title">${title}</div><div class="facts">${facts.map(f=>`<p class="fact">${f.number}. ${f.content}</p>`).join('')}</div><div class="declaration">${declarationBlock.replace(/\n/g,'<br/>')}</div></body></html>`;

    return {
      id,
      state: this.state,
      sections: {
        header,
        venue: venue || null,
        title,
        facts,
        notaryBlock: declarationBlock // Actually the declaration jurat
      },
      htmlContent,
      validation
    };
  }

  // Override preview generation
  generatePreview(affidavitData) {
    const sections = {};
    
    sections.header = {
      type: 'header',
      content: 'STATE OF CALIFORNIA'
    };
    
    if (affidavitData.county) {
      sections.venue = {
        type: 'venue',
        content: `STATE OF CALIFORNIA\nCounty of ${affidavitData.county}`
      };
    }
    
    sections.introduction = {
      type: 'introduction',
      title: 'DECLARATION',
      content: this.generateIntroduction(affidavitData)
    };
    
    sections.facts = {
      type: 'facts',
      title: 'STATEMENT OF FACTS',
      content: this.processFactsForPreview(affidavitData.facts || [])
    };
    
    sections.signatureBlock = {
      type: 'signature',
      title: 'DECLARATION UNDER PENALTY OF PERJURY',
      content: this.generateSignatureBlock(affidavitData)
    };
    
    // No notary block - just the penalty of perjury declaration
    sections.notaryBlock = {
      type: 'declarationBlock',
      title: 'PENALTY OF PERJURY STATEMENT',
      content: this.generateNotaryBlock(affidavitData)
    };
    
    return sections;
  }

  generateIntroduction(affidavitData) {
    const name = affidavitData.affiantName || '[YOUR NAME]';
    return `I, ${name}, declare as follows:\n\nI am over the age of eighteen (18) years and am competent to testify to the matters stated herein. The facts stated herein are within my personal knowledge and are true and correct.`;
  }

  generateSignatureBlock(affidavitData) {
    const name = affidavitData.affiantName || '[YOUR NAME]';
    const executionCity = affidavitData.executionCity || affidavitData.executionLocation || '[CITY]';
    
    // Per CCP § 2015.5 - different formats for in-state vs out-of-state
    return `I declare under penalty of perjury under the laws of the State of California that the foregoing is true and correct.

Executed on _____________, 2025, at ${executionCity}, California.


_________________________________
${name}, Declarant`;
  }

  // ✅ CALIFORNIA: Declaration format per CCP § 2015.5 - NO NOTARY NEEDED
  generateNotaryBlock(affidavitData) {
    const executionCity = affidavitData.executionCity || affidavitData.executionLocation || '[CITY]';
    
    return `DECLARATION UNDER PENALTY OF PERJURY

I declare under penalty of perjury under the laws of the State of California that the foregoing is true and correct.

Executed on _____________, 2025

At: ${executionCity}, California


_________________________________
Signature of Declarant

_________________________________
Printed Name

NOTE: No notarization required for California family law declarations.
This declaration has the same legal force and effect as a notarized affidavit
per California Code of Civil Procedure § 2015.5.`;
  }
}

/**
 * Main StateTemplateManager class
 */
class StateTemplateManager {
  constructor() {
    this.templates = {
      'TX': new TexasTemplate(),
      'UT': new UtahTemplate(),
      'AZ': new ArizonaTemplate(),
      'CA': new CaliforniaTemplate() // ✅ NEW: California support
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
      requirements: template.sections
    }));
  }
  
  validateDocument(affidavitData) {
    const stateCode = affidavitData.state || this.defaultState;
    const template = this.getTemplate(stateCode);
    
    const errors = [];
    const warnings = [];

    if (!affidavitData.affiantName || affidavitData.affiantName.trim().length < 2) {
      errors.push('Affiant name is required');
    }

    if (!affidavitData.state) {
      errors.push('State is required');
    }

    const stateValidation = template.performStateSpecificValidation(affidavitData);
    errors.push(...stateValidation.errors);
    warnings.push(...stateValidation.warnings);

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  validateAffidavitData(affidavitData = {}, stateCode) {
    const state = stateCode || affidavitData.state || this.defaultState;
    const template = this.getTemplate(state);
    return template.validateData(affidavitData);
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

// Export all classes
module.exports = { 
  StateTemplateManager, 
  BaseAffidavitTemplate, 
  TexasTemplate, 
  UtahTemplate, 
  ArizonaTemplate,
  CaliforniaTemplate // ✅ NEW export
};
