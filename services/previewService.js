// services/previewService.js - Enhanced preview generation
const { StateTemplateManager } = require('../templates/StateTemplateManager');

class PreviewService {
  constructor() {
    this.templateManager = new StateTemplateManager();
  }

  generatePreview(affidavitData) {
    try {
      // Validate required data
      if (!affidavitData) {
        return this.createEmptyPreview();
      }

      // Get state template
      const template = this.templateManager.getTemplate(affidavitData.state || 'TX');
      const stateName = this.getStateName(affidavitData.state);

      // Generate document sections
      const sections = this.generateSections(affidavitData, template, stateName);

      // Calculate validation and completion
      const validation = this.validateDocument(affidavitData, template);
      const completion = this.calculateCompletion(affidavitData);

      return {
        success: true,
        preview: {
          sections,
          formatting: this.getFormattingRules(template),
          estimatedPages: this.estimatePages(sections)
        },
        validation,
        completion,
        metadata: {
          state: affidavitData.state,
          stateName,
          template: template.constructor.name,
          generatedAt: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error('Preview generation error:', error);
      return {
        success: false,
        error: error.message,
        preview: this.createEmptyPreview()
      };
    }
  }

  generateSections(affidavitData, template, stateName) {
    const sections = {};

    // Header section
    sections.header = this.generateHeader(affidavitData.state, stateName);

    // Venue section (state-dependent)
    sections.venue = this.generateVenue(affidavitData, template);

    // Case caption (if applicable)
    if (affidavitData.caseNumber || affidavitData.caseType) {
      sections.caseCaption = this.generateCaseCaption(affidavitData);
    }

    // Title section
    sections.title = this.generateTitle(affidavitData);

    // Introduction paragraph
    sections.introduction = this.generateIntroduction(affidavitData);

    // Facts section
    sections.facts = this.generateFacts(affidavitData);

    // Conclusion
    sections.conclusion = this.generateConclusion(affidavitData);

    // Perjury statement (state-specific)
    sections.perjuryStatement = this.generatePerjuryStatement(affidavitData.state);

    // Signature block
    sections.signatureBlock = this.generateSignatureBlock(affidavitData);

    // Notary block (state-specific)
    sections.notaryBlock = this.generateNotaryBlock(affidavitData, template);

    return sections;
  }

  generateHeader(state, stateName) {
    return state ? `STATE OF ${stateName.toUpperCase()}` : 'STATE OF [STATE]';
  }

  generateVenue(affidavitData, template) {
    if (!template.requirements.venue) {
      return null; // Arizona doesn't use venue
    }

    let venue = '';
    
    if (affidavitData.state === 'TX') {
      venue = `STATE OF TEXAS\n\nCOUNTY OF ${(affidavitData.county || '[COUNTY]').toUpperCase()}`;
    } else if (affidavitData.state === 'UT') {
      venue = `STATE OF UTAH\n\nCounty of ${affidavitData.county || '[COUNTY]'}`;
    } else {
      venue = `STATE OF [STATE]\n\nCOUNTY OF [COUNTY]`;
    }

    return venue;
  }

  generateCaseCaption(affidavitData) {
    const parts = [];
    
    if (affidavitData.caseNumber) {
      parts.push(`Case No. ${affidavitData.caseNumber}`);
    }
    
    if (affidavitData.caseType) {
      parts.push(affidavitData.caseType);
    }
    
    if (affidavitData.court) {
      parts.push(`${affidavitData.court}`);
    }

    return {
      caseNumber: affidavitData.caseNumber,
      caseType: affidavitData.caseType,
      court: affidavitData.court,
      formatted: parts.length > 0 ? parts.join('\n') : null
    };
  }

  generateTitle(affidavitData) {
    if (affidavitData.affiantName) {
      return `AFFIDAVIT OF ${affidavitData.affiantName.toUpperCase()}`;
    }
    return 'AFFIDAVIT OF [AFFIANT NAME]';
  }

  generateIntroduction(affidavitData) {
    const name = affidavitData.affiantName || '[AFFIANT NAME]';
    return `I, ${name}, being of legal age and competent to testify, do hereby swear and affirm under penalty of perjury that the following statements are true and correct to the best of my knowledge:`;
  }

  generateFacts(affidavitData) {
    const facts = [];
    let factNumber = 1;

    // Add competency statement as first fact
    facts.push({
      number: factNumber++,
      content: `I am competent to make this affidavit and have personal knowledge of the facts stated herein.`,
      type: 'competency'
    });

    // Add user-provided facts
    if (affidavitData.facts && affidavitData.facts.length > 0) {
      for (const fact of affidavitData.facts) {
        const content = typeof fact === 'object' ? fact.content : fact;
        if (content && content.trim()) {
          facts.push({
            number: factNumber++,
            content: content.trim(),
            type: 'user_fact',
            category: fact.category || 'general'
          });
        }
      }
    }

    // Add placeholder if no facts
    if (facts.length === 1) {
      facts.push({
        number: factNumber,
        content: '[Additional facts will be listed here as you provide them]',
        type: 'placeholder'
      });
    }

    return facts;
  }

  generateConclusion(affidavitData) {
    return `The facts stated in this affidavit are true and correct to the best of my knowledge and belief.`;
  }

  generatePerjuryStatement(state) {
    const stateNames = {
      'TX': 'Texas',
      'UT': 'Utah', 
      'AZ': 'Arizona'
    };
    
    const stateName = stateNames[state] || '[STATE]';
    return `I declare under penalty of perjury under the laws of the State of ${stateName} that the foregoing is true and correct.`;
  }

  generateSignatureBlock(affidavitData) {
    return {
      line: '_'.repeat(40),
      name: affidavitData.affiantName || '[AFFIANT NAME]',
      title: 'Affiant',
      date: null // Will be filled when signed
    };
  }

  generateNotaryBlock(affidavitData, template) {
    const name = affidavitData.affiantName || '[AFFIANT NAME]';
    
    if (affidavitData.state === 'TX') {
      return `SUBSCRIBED AND SWORN TO before me on this _____ day of __________, 20____, by ${name}.


_________________________________
Notary Public, State of Texas

My commission expires: ________________


[NOTARY SEAL]`;
    } else if (affidavitData.state === 'UT') {
      return `SUBSCRIBED AND SWORN to before me this _____ day of __________, 20____.


_________________________________
Notary Public

Residing at: _________________________

My commission expires: ________________


[NOTARY SEAL]`;
    } else if (affidavitData.state === 'AZ') {
      return `SUBSCRIBED AND SWORN TO before me this _____ day of __________, 20____.


_________________________________
Notary Public

My commission expires: ________________


[NOTARY SEAL]`;
    } else {
      return `SUBSCRIBED AND SWORN TO before me this _____ day of __________, 20____.


_________________________________
Notary Public

My commission expires: ________________


[NOTARY SEAL]`;
    }
  }

  validateDocument(affidavitData, template) {
    const errors = [];
    const warnings = [];

    // Required field validation
    if (!affidavitData.affiantName || affidavitData.affiantName.trim().length < 2) {
      errors.push('Affiant name is required and must be at least 2 characters');
    }

    if (!affidavitData.state) {
      errors.push('State selection is required');
    }

    // State-specific validations
    if (template.requirements.countyRequired && (!affidavitData.county || affidavitData.county.trim().length === 0)) {
      errors.push(`County is required for ${template.stateName} affidavits`);
    }

    // Facts validation
    if (!affidavitData.facts || affidavitData.facts.length === 0) {
      warnings.push('No facts provided - affidavit will be incomplete');
    } else if (affidavitData.facts.length > 20) {
      warnings.push('Consider consolidating facts for better readability (20+ facts provided)');
    }

    // Name format validation
    if (affidavitData.affiantName) {
      if (affidavitData.affiantName.length > 255) {
        errors.push('Affiant name is too long (maximum 255 characters)');
      }
      
      if (!/^[A-Za-z\s\-'.]+$/.test(affidavitData.affiantName)) {
        warnings.push('Affiant name contains unusual characters');
      }
      
      if (affidavitData.affiantName.split(' ').length < 2) {
        warnings.push('Consider providing both first and last name');
      }
    }

    // County format validation
    if (affidavitData.county && affidavitData.county.length > 100) {
      errors.push('County name is too long (maximum 100 characters)');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      completion: this.calculateCompletion(affidavitData)
    };
  }

  calculateCompletion(affidavitData) {
    const requiredFields = ['affiantName', 'state', 'facts'];
    const completedFields = requiredFields.filter(field => {
      const value = affidavitData[field];
      return value && (Array.isArray(value) ? value.length > 0 : value.trim().length > 0);
    });
    
    const percentage = Math.round((completedFields.length / requiredFields.length) * 100);
    
    return {
      percentage,
      completed: completedFields,
      remaining: requiredFields.filter(field => !completedFields.includes(field)),
      isComplete: percentage === 100
    };
  }

  estimatePages(sections) {
    let estimatedLines = 0;
    
    // Count lines for each section
    if (sections.header) estimatedLines += 2;
    if (sections.venue) estimatedLines += 3;
    if (sections.caseCaption) estimatedLines += 3;
    if (sections.title) estimatedLines += 2;
    if (sections.introduction) estimatedLines += 3;
    if (sections.facts) estimatedLines += sections.facts.length * 2;
    if (sections.conclusion) estimatedLines += 2;
    if (sections.perjuryStatement) estimatedLines += 2;
    if (sections.signatureBlock) estimatedLines += 5;
    if (sections.notaryBlock) estimatedLines += 8;
    
    // Estimate pages (assuming ~40 lines per page with margins)
    return Math.max(1, Math.ceil(estimatedLines / 40));
  }

  getFormattingRules(template) {
    return {
      fontFamily: 'Times New Roman',
      fontSize: '12pt',
      lineHeight: 1.5,
      margins: '1 inch',
      paperSize: 'Letter (8.5" x 11")',
      stateSpecific: template.formatRules
    };
  }

  getStateName(stateCode) {
    const stateNames = {
      'TX': 'Texas',
      'UT': 'Utah',
      'AZ': 'Arizona'
    };
    return stateNames[stateCode] || stateCode;
  }

  createEmptyPreview() {
    return {
      sections: {
        header: 'STATE OF [STATE]',
        title: 'AFFIDAVIT OF [AFFIANT NAME]',
        introduction: 'I, [AFFIANT NAME], being of legal age and competent to testify...',
        facts: [
          {
            number: 1,
            content: '[Facts will be listed here as you provide them in the chat]',
            type: 'placeholder'
          }
        ],
        conclusion: 'The facts stated in this affidavit are true and correct.',
        signatureBlock: {
          name: '[AFFIANT NAME]',
          title: 'Affiant'
        },
        notaryBlock: 'NOTARY ACKNOWLEDGMENT SECTION'
      }
    };
  }
}

module.exports = PreviewService;