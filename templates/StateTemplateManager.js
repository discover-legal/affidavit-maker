// templates/StateTemplateManager.js 
class StateTemplateManager {
  constructor() {
    this.templates = new Map();
    this.initializeTemplates();
  }

  initializeTemplates() {
    this.templates.set('TX', new TexasTemplate());
    this.templates.set('Texas', new TexasTemplate());
    this.templates.set('UT', new UtahTemplate());
    this.templates.set('Utah', new UtahTemplate());
    this.templates.set('AZ', new ArizonaTemplate());
    this.templates.set('Arizona', new ArizonaTemplate());
  }

  getTemplate(state) {
    const normalizedState = this.normalizeState(state);
    const template = this.templates.get(normalizedState);
    
    if (!template) {
      throw new Error(`Unsupported state: ${state}. Supported states: Texas, Utah, Arizona`);
    }
    
    return template;
  }

  normalizeState(state) {
    if (!state) return null;
    
    const stateMap = {
      'texas': 'TX', 'tx': 'TX', 'TX': 'TX',
      'utah': 'UT', 'ut': 'UT', 'UT': 'UT', 
      'arizona': 'AZ', 'az': 'AZ', 'AZ': 'AZ'
    };
    
    return stateMap[state.toLowerCase()] || state;
  }

  getSupportedStates() {
    return [
      { code: 'TX', name: 'Texas', requiresCounty: true },
      { code: 'UT', name: 'Utah', requiresCounty: true },
      { code: 'AZ', name: 'Arizona', requiresCounty: false }
    ];
  }

  validateAffidavitData(state, data) {
    try {
      const template = this.getTemplate(state);
      return template.validateData(data);
    } catch (error) {
      return {
        isValid: false,
        errors: [error.message],
        warnings: []
      };
    }
  }
}

// Base template class
class BaseAffidavitTemplate {
  constructor() {
    this.state = '';
    this.stateName = '';
    this.requirements = {
      venue: true,
      countyRequired: false,
      notaryCommissionExpiration: true,
      perjuryWarning: true,
      witnessSignature: false
    };
    this.formatRules = {
      headerFormat: '',
      venueFormat: '',
      countyFormat: ''
    };
  }

  validateData(data) {
    const errors = [];
    const warnings = [];

    // Required fields
    if (!data.affiantName || data.affiantName.trim().length === 0) {
      errors.push('Affiant name is required');
    }

    if (!data.state) {
      errors.push('State is required');
    }

    if (!data.facts || data.facts.length === 0) {
      errors.push('At least one fact statement is required');
    }

    // State-specific validations
    if (this.requirements.countyRequired && (!data.county || data.county.trim().length === 0)) {
      errors.push(`County is required for ${this.stateName} affidavits`);
    }

    // Format validations
    if (data.affiantName && data.affiantName.length > 255) {
      errors.push('Affiant name is too long (maximum 255 characters)');
    }

    if (data.county && data.county.length > 100) {
      errors.push('County name is too long (maximum 100 characters)');
    }

    // Warnings
    if (data.facts && data.facts.length > 20) {
      warnings.push('Consider consolidating facts for better readability');
    }

    if (data.affiantName && !/^[A-Za-z\s\-'.]+$/.test(data.affiantName)) {
      warnings.push('Affiant name contains unusual characters');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      requirements: this.requirements
    };
  }

  getCountyValidationRules() {
    return {
      required: this.requirements.countyRequired,
      format: this.formatRules.countyFormat,
      stateName: this.stateName,
      stateCode: this.state
    };
  }

  generateDocument(data) {
    const sections = {
      header: this.generateHeader(data),
      venue: this.generateVenue(data),
      caseCaption: this.generateCaseCaption(data),
      title: this.generateTitle(data),
      introduction: this.generateIntroduction(data),
      facts: this.generateFacts(data),
      conclusion: this.generateConclusion(data),
      perjuryStatement: this.generatePerjuryStatement(data),
      signatureBlock: this.generateSignatureBlock(data),
      notaryBlock: this.generateNotaryBlock(data)
    };

    return {
      sections,
      metadata: {
        state: this.state,
        stateName: this.stateName,
        requirements: this.requirements,
        generatedAt: new Date().toISOString()
      }
    };
  }
}

// Texas Template - Enhanced
class TexasTemplate extends BaseAffidavitTemplate {
  constructor() {
    super();
    this.state = 'TX';
    this.stateName = 'Texas';
    this.requirements = {
      venue: true,
      countyRequired: true,
      notaryCommissionExpiration: true,
      perjuryWarning: true,
      witnessSignature: false
    };
    this.formatRules = {
      headerFormat: 'STATE OF TEXAS',
      venueFormat: 'COUNTY OF {COUNTY}',
      countyFormat: 'County of'
    };
  }

  generateVenue(data) {
    if (!data.county) {
      return 'STATE OF TEXAS\n\nCOUNTY OF _____________';
    }
    return `STATE OF TEXAS\n\nCOUNTY OF ${data.county.toUpperCase()}`;
  }

  generatePerjuryStatement(data) {
    return `I declare under penalty of perjury under the laws of the State of Texas that the foregoing is true and correct.`;
  }

  generateNotaryBlock(data) {
    return `SUBSCRIBED AND SWORN TO before me on this _____ day of __________, 20____, by ${data.affiantName || '[AFFIANT NAME]'}.


_________________________________
Notary Public, State of Texas

My commission expires: ________________


[NOTARY SEAL]`;
  }

  getCountyValidationRules() {
    return {
      ...super.getCountyValidationRules(),
      // Texas has 254 counties - specific validation rules
      commonCounties: [
        'Harris', 'Dallas', 'Tarrant', 'Bexar', 'Travis', 'Collin', 'Denton',
        'Fort Bend', 'Williamson', 'Montgomery', 'Galveston', 'Brazoria'
      ]
    };
  }
}

// Utah Template - Enhanced
class UtahTemplate extends BaseAffidavitTemplate {
  constructor() {
    super();
    this.state = 'UT';
    this.stateName = 'Utah';
    this.requirements = {
      venue: true,
      countyRequired: true,
      notaryCommissionExpiration: true,
      perjuryWarning: true,
      witnessSignature: false
    };
    this.formatRules = {
      headerFormat: 'STATE OF UTAH',
      venueFormat: 'County of {COUNTY}',
      countyFormat: 'County of'
    };
  }

  generateVenue(data) {
    if (!data.county) {
      return 'STATE OF UTAH\n\nCounty of _____________';
    }
    return `STATE OF UTAH\n\nCounty of ${data.county}`;
  }

  generatePerjuryStatement(data) {
    return `I declare under penalty of perjury under the laws of the State of Utah that the foregoing is true and correct.`;
  }

  generateNotaryBlock(data) {
    return `SUBSCRIBED AND SWORN to before me this _____ day of __________, 20____.


_________________________________
Notary Public

Residing at: _________________________

My commission expires: ________________


[NOTARY SEAL]`;
  }

  getCountyValidationRules() {
    return {
      ...super.getCountyValidationRules(),
      // Utah has 29 counties
      commonCounties: [
        'Salt Lake', 'Utah', 'Davis', 'Weber', 'Washington', 'Cache', 'Box Elder',
        'Iron', 'Tooele', 'Sanpete', 'Carbon', 'Sevier'
      ]
    };
  }
}

// Arizona Template - Enhanced
class ArizonaTemplate extends BaseAffidavitTemplate {
  constructor() {
    super();
    this.state = 'AZ';
    this.stateName = 'Arizona';
    this.requirements = {
      venue: false, // Arizona uses simplified format
      countyRequired: false,
      notaryCommissionExpiration: true,
      perjuryWarning: true,
      witnessSignature: false
    };
    this.formatRules = {
      headerFormat: 'STATE OF ARIZONA',
      venueFormat: '',
      countyFormat: ''
    };
  }

  generateVenue(data) {
    // Arizona doesn't use venue format in standard affidavits
    return null;
  }

  generatePerjuryStatement(data) {
    return `I declare under penalty of perjury under the laws of the State of Arizona that the foregoing is true and correct.`;
  }

  generateNotaryBlock(data) {
    return `SUBSCRIBED AND SWORN TO before me this _____ day of __________, 20____.


_________________________________
Notary Public

My commission expires: ________________


[NOTARY SEAL]`;
  }

  getCountyValidationRules() {
    return {
      ...super.getCountyValidationRules(),
      // Arizona has 15 counties
      commonCounties: [
        'Maricopa', 'Pima', 'Pinal', 'Mohave', 'Yavapai', 'Coconino', 'Cochise',
        'Navajo', 'Yuma', 'Apache', 'Gila', 'Santa Cruz', 'Graham', 'Greenlee', 'La Paz'
      ]
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