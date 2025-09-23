// templates/StateTemplateManager.js - FINAL FIXED VERSION
// Complete drop-in replacement with enhanced facts processing

const logger = require('../utils/logger');

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

  /**
   * ✅ FULLY FIXED: Generate document preview with robust facts processing
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
    
    // ✅ CRITICAL FIX: Facts processing with multiple fallback strategies
    sections.facts = {
      type: 'facts',
      title: 'STATEMENT OF FACTS',
      content: this.processFactsForPreview(affidavitData.facts || [])
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
   * ✅ BULLETPROOF: Convert facts array to readable preview content with multiple fallbacks
   */
  processFactsForPreview(facts) {
    // Debug logging
    console.log('🔍 processFactsForPreview called with:', {
      factsType: typeof facts,
      isArray: Array.isArray(facts),
      factsLength: Array.isArray(facts) ? facts.length : 'not array',
      facts: facts
    });

    // Handle empty/invalid facts
    if (!facts || !Array.isArray(facts) || facts.length === 0) {
      console.log('🔍 No valid facts array, returning default message');
      return 'No facts have been added yet. Start chatting to add facts to your affidavit.';
    }
    
    const processedFacts = [];
    
    facts.forEach((fact, index) => {
      let content = '';
      
      console.log(`🔍 Processing fact ${index + 1}:`, {
        type: typeof fact,
        isObject: typeof fact === 'object',
        isNull: fact === null,
        keys: typeof fact === 'object' && fact !== null ? Object.keys(fact) : 'not object'
      });
      
      // Strategy 1: Handle string facts
      if (typeof fact === 'string' && fact.trim().length > 0) {
        content = fact.trim();
        console.log(`🔍 Fact ${index + 1}: Used string directly`);
      }
      // Strategy 2: Handle object facts with multiple content fields
      else if (typeof fact === 'object' && fact !== null) {
        // Try professional rewrite first
        if (fact.professionalRewrite && typeof fact.professionalRewrite === 'string') {
          content = fact.professionalRewrite;
          console.log(`🔍 Fact ${index + 1}: Used professionalRewrite`);
        }
        // Try original content
        else if (fact.content && typeof fact.content === 'string') {
          content = fact.content;
          console.log(`🔍 Fact ${index + 1}: Used content`);
        }
        // Try text field
        else if (fact.text && typeof fact.text === 'string') {
          content = fact.text;
          console.log(`🔍 Fact ${index + 1}: Used text`);
        }
        // Try description field
        else if (fact.description && typeof fact.description === 'string') {
          content = fact.description;
          console.log(`🔍 Fact ${index + 1}: Used description`);
        }
        // Last resort: stringify the object
        else {
          try {
            content = JSON.stringify(fact);
            console.log(`🔍 Fact ${index + 1}: Used JSON.stringify`);
          } catch (e) {
            content = `[Fact ${index + 1}: Unable to process]`;
            console.log(`🔍 Fact ${index + 1}: Failed to stringify, used placeholder`);
          }
        }
      }
      // Strategy 3: Convert other types to string
      else {
        content = String(fact);
        console.log(`🔍 Fact ${index + 1}: Used String() conversion`);
      }
      
      // Ensure we have content
      if (!content || content.trim().length === 0) {
        content = `[Fact ${index + 1}: No content available]`;
        console.log(`🔍 Fact ${index + 1}: No content found, used placeholder`);
      }
      
      // Add to processed facts with numbering
      const numberedFact = `${index + 1}. ${content.trim()}`;
      processedFacts.push(numberedFact);
      
      console.log(`🔍 Fact ${index + 1}: Final content: "${content.substring(0, 50)}..."`);
    });
    
    const result = processedFacts.join('\n\n');
    console.log('🔍 Final facts preview result:', {
      totalFacts: processedFacts.length,
      resultLength: result.length,
      preview: result.substring(0, 200) + '...'
    });
    
    return result;
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
   * Generate notary block
   */
  generateNotaryBlock(affidavitData) {
    return `NOTARY ACKNOWLEDGMENT

State of ${this.stateName}
County of ${affidavitData.county || '_______'}

On this _____ day of _________, 2025, before me personally appeared ${affidavitData.affiantName || '[NAME]'}, who proved to me on the basis of satisfactory evidence to be the person whose name is subscribed to the within instrument and acknowledged to me that he/she executed the same in his/her authorized capacity, and that by his/her signature on the instrument the person, or the entity upon behalf of which the person acted, executed the instrument.

I certify under PENALTY OF PERJURY under the laws of the State of ${this.stateName} that the foregoing paragraph is true and correct.

WITNESS my hand and official seal.


_________________________________
Signature of Notary Public`;
  }

  /**
   * Validate document for completeness and legal requirements
   */
  validateDocument(affidavitData) {
    const errorSet = new Set();
    const warningSet = new Set();
    
    // Required field validation
    this.requiredFields.forEach(field => {
      if (!affidavitData[field] || affidavitData[field].trim() === '') {
        errorSet.add(`${field} is required`);
      }
    });
    
    // Facts validation
    if (!affidavitData.facts || !Array.isArray(affidavitData.facts) || affidavitData.facts.length === 0) {
      warningSet.add('No facts have been added to the affidavit');
    } else {
      // Check for fact quality issues
      affidavitData.facts.forEach((fact, index) => {
        const content = this.extractFactContent(fact);
        if (content.length < 10) {
          warningSet.add(`Fact ${index + 1} is very short and may need more detail`);
        }
      });
    }
    
    // State-specific validation
    const stateValidation = this.performStateSpecificValidation(affidavitData);
    stateValidation.errors.forEach(error => errorSet.add(error));
    stateValidation.warnings.forEach(warning => warningSet.add(warning));
    
    return {
      isValid: errorSet.size === 0,
      errors: Array.from(errorSet),
      warnings: Array.from(warningSet)
    };
  }

  /**
   * ✅ NEW: Extract content from a fact object (used by validation and calculations)
   */
  extractFactContent(fact) {
    if (typeof fact === 'string') {
      return fact;
    } else if (typeof fact === 'object' && fact !== null) {
      return fact.professionalRewrite || fact.content || fact.text || JSON.stringify(fact);
    } else {
      return String(fact);
    }
  }

  /**
   * State-specific validation (override in subclasses)
   */
  performStateSpecificValidation(affidavitData) {
    return { errors: [], warnings: [] };
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
   * ✅ FIXED: Calculate word count from facts
   */
  calculateWordCount(facts) {
    if (!facts || !Array.isArray(facts)) return 0;
    
    return facts.reduce((count, fact) => {
      const content = this.extractFactContent(fact);
      return count + content.split(/\s+/).filter(word => word.length > 0).length;
    }, 0);
  }

  /**
   * ✅ FIXED: Extract categories from facts
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
 * Texas-specific affidavit template
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
    
    // Texas requires county
    if (!affidavitData.county || affidavitData.county.trim() === '') {
      errors.push('County is required for Texas affidavits');
    }
    
    // Texas prefers case information if available
    if (!affidavitData.caseNumber && !affidavitData.caseType) {
      warnings.push('Consider adding case number or case type if this relates to a legal proceeding');
    }
    
    return { errors, warnings };
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
 * Utah-specific affidavit template
 */
class UtahTemplate extends BaseAffidavitTemplate {
  constructor() {
    super();
    this.state = 'UT';
    this.stateName = 'Utah';
    this.requiredFields = ['affiantName', 'state'];
    this.sections = {
      venue: true,
      caseCaption: false,
      notaryBlock: true
    };
  }

  performStateSpecificValidation(affidavitData) {
    const errors = [];
    const warnings = [];
    
    // Utah recommendations
    if (!affidavitData.county) {
      warnings.push('County information is recommended for Utah affidavits');
    }
    
    return { errors, warnings };
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
 * Arizona-specific affidavit template
 */
class ArizonaTemplate extends BaseAffidavitTemplate {
  constructor() {
    super();
    this.state = 'AZ';
    this.stateName = 'Arizona';
    this.requiredFields = ['affiantName', 'state'];
    this.sections = {
      venue: false, // Arizona doesn't require venue section
      caseCaption: false,
      notaryBlock: true
    };
  }

  performStateSpecificValidation(affidavitData) {
    const errors = [];
    const warnings = [];
    
    // Arizona-specific recommendations
    if (!affidavitData.county) {
      warnings.push('County information is helpful for Arizona affidavits');
    }
    
    return { errors, warnings };
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
 * Main StateTemplateManager class
 */
class StateTemplateManager {
  constructor() {
    this.templates = {
      'TX': new TexasTemplate(),
      'UT': new UtahTemplate(),
      'AZ': new ArizonaTemplate()
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
   * Validate document for a specific state
   */
  validateDocument(affidavitData) {
    const stateCode = affidavitData.state || this.defaultState;
    const template = this.getTemplate(stateCode);
    
    return template.validateDocument(affidavitData);
  }
  
  /**
   * ✅ COMPLETELY FIXED: Generate document preview with enhanced metadata and robust facts processing
   */
  generatePreview(affidavitData) {
    const stateCode = affidavitData.state || this.defaultState;
    const template = this.getTemplate(stateCode);
    
    console.log('🔍 StateTemplateManager.generatePreview called with:', {
      stateCode,
      factsCount: affidavitData.facts?.length || 0,
      affiantName: affidavitData.affiantName
    });
    
    const sections = template.generatePreview(affidavitData);
    
    const preview = {
      sections,
      formatting: template.formatting,
      metadata: {
        factCount: affidavitData.facts?.length || 0,
        wordCount: template.calculateWordCount(affidavitData.facts || []),
        stateName: template.stateName,
        estimatedPages: Math.max(1, Math.ceil(((affidavitData.facts?.length || 0) * 50 + 200) / 250)),
        categories: template.extractCategories(affidavitData.facts || []),
        lastUpdated: new Date().toISOString(),
        qualityMetrics: this.calculateQualityMetrics(affidavitData)
      }
    };
    
    console.log('🔍 StateTemplateManager.generatePreview result:', {
      sectionsCount: Object.keys(sections).length,
      factsContentLength: sections.facts?.content?.length || 0,
      factsContentPreview: sections.facts?.content?.substring(0, 100) || 'no content'
    });
    
    return preview;
  }
  
  /**
   * ✅ FIXED: Calculate quality metrics
   */
  calculateQualityMetrics(affidavitData) {
    const validation = this.validateDocument(affidavitData);
    
    return {
      completionScore: this.calculateCompletionScore(affidavitData),
      criticalIssues: validation.errors.length,
      warnings: validation.warnings.length,
      factQuality: this.assessFactQuality(affidavitData.facts || [])
    };
  }
  
  /**
   * ✅ FIXED: Calculate completion score
   */
  calculateCompletionScore(affidavitData) {
    let score = 0;
    let maxScore = 100;
    
    // Name (25 points)
    if (affidavitData.affiantName) score += 25;
    
    // State (15 points)
    if (affidavitData.state) score += 15;
    
    // Facts (50 points)
    const factCount = affidavitData.facts?.length || 0;
    score += Math.min(50, factCount * 10);
    
    // Additional details (10 points)
    if (affidavitData.county) score += 5;
    if (affidavitData.caseNumber || affidavitData.caseType) score += 5;
    
    return Math.round((score / maxScore) * 100);
  }
  
  /**
   * ✅ FIXED: Assess fact quality
   */
  assessFactQuality(facts) {
    if (!facts || facts.length === 0) return 'none';
    
    let qualityScore = 0;
    let totalFacts = facts.length;
    
    facts.forEach(fact => {
      const template = this.getTemplate('TX'); // Use any template for content extraction
      const content = template.extractFactContent(fact);
      
      // Length check
      if (content.length > 50) qualityScore += 1;
      
      // Professional rewrite check
      if (typeof fact === 'object' && fact !== null && fact.professionalRewrite) qualityScore += 1;
      
      // Category check
      if (typeof fact === 'object' && fact !== null && fact.category) qualityScore += 1;
    });
    
    const averageScore = qualityScore / (totalFacts * 3);
    
    if (averageScore > 0.8) return 'high';
    if (averageScore > 0.5) return 'medium';
    return 'low';
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