// templates/StateTemplateManager.js - UPDATED WITH CASE CAPTION SUPPORT
const logger = require('../utils/logger');
const courtNameService = require('./services/courtNameService');

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
      caseCaption: true, // ✅ NOW ENABLED for all affidavits
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

  /**
   * ✅ NEW: Generate case caption for family law cases
   */
  generateCaseCaption(affidavitData) {
    // Get or generate court name
    const courtName = affidavitData.courtName || 
      courtNameService.getDefaultCourtName(
        this.state,
        affidavitData.county,
        affidavitData.judicialDistrict
      );

    if (!courtName && !affidavitData.caseNumber) {
      return null; // No case caption needed yet
    }

    let caption = '';
    
    // Add court name
    if (courtName) {
      caption += `${courtName.toUpperCase()}\n\n`;
    }
    
    // Add parties if provided
    if (affidavitData.plaintiff && affidavitData.defendant) {
      caption += `${affidavitData.plaintiff.toUpperCase()},\n`;
      caption += `  Petitioner/Plaintiff\n\n`;
      caption += `v.\n\n`;
      caption += `${affidavitData.defendant.toUpperCase()},\n`;
      caption += `  Respondent/Defendant\n`;
    } else if (affidavitData.plaintiff || affidavitData.defendant) {
      // Handle cases where only one party is provided
      const party = affidavitData.plaintiff || affidavitData.defendant;
      caption += `In re: ${party.toUpperCase()}\n`;
    }
    
    // Add case number
    if (affidavitData.caseNumber) {
      caption += `\nCAUSE NO. ${affidavitData.caseNumber.toUpperCase()}`;
    }
    
    return {
      courtName,
      caseNumber: affidavitData.caseNumber,
      plaintiff: affidavitData.plaintiff,
      defendant: affidavitData.defendant,
      formatted: caption
    };
  }

  generateDocument(affidavitData = {}) {
    const validation = this.validateData(affidavitData);
    
    const uuid = require('uuid');
    const id = uuid.v4();
    
    // Generate header
    const header = this.generateHeader();
    
    // Generate venue
    let venue = null;
    if (this.sections.venue && affidavitData.county) {
      venue = this.generateVenue(affidavitData.county);
    }

    // ✅ Generate case caption
    let caseCaption = null;
    if (this.sections.caseCaption) {
      caseCaption = this.generateCaseCaption(affidavitData);
    }

    // Generate title
    const title = this.generateTitle(affidavitData.affiantName);
    
    // Generate introduction
    const introduction = this.generateIntroduction(affidavitData);
    
    // Generate competency statement
    const competencyStatement = this.generateCompetencyStatement(affidavitData.affiantName);
    
    // Process facts
    const facts = this.processFactsForDocument(affidavitData.facts || []);
    
    // Generate conclusion
    const conclusion = this.generateConclusion();
    
    // Generate perjury statement
    const perjuryStatement = this.generatePerjuryStatement();
    
    // Generate signature block
    const signatureBlock = this.generateSignatureBlock(affidavitData.affiantName);
    
    // Generate notary block
    const notaryBlock = this.generateNotaryBlock(affidavitData);
    
    // Generate footer
    const footer = this.generateFooter();

    return {
      id,
      state: this.state,
      timestamp: new Date(),
      sections: {
        header,
        venue,
        caseCaption, // ✅ NEW
        title,
        introduction,
        competencyStatement,
        facts,
        conclusion,
        perjuryStatement,
        signatureBlock,
        notaryBlock,
        footer
      },
      fullText: this.generateFullText({
        header, venue, caseCaption, title, introduction, 
        competencyStatement, facts, conclusion, 
        perjuryStatement, signatureBlock, notaryBlock, footer
      }),
      htmlContent: this.generateHTMLContent({
        header, venue, caseCaption, title, introduction,
        competencyStatement, facts, conclusion,
        perjuryStatement, signatureBlock, notaryBlock, footer
      }),
      validation,
      formatting: this.formatting
    };
  }

  generateHeader() {
    return this.state === 'TX' ? 'THE STATE OF TEXAS' : `STATE OF ${this.stateName.toUpperCase()}`;
  }

  generateVenue(county) {
    const countyUpper = (county || '[COUNTY]').toUpperCase();
    return this.state === 'TX' 
      ? `COUNTY OF ${countyUpper}`
      : `County of ${countyUpper}`;
  }

  generateTitle(affiantName) {
    return `AFFIDAVIT OF ${(affiantName || '[NAME]').toUpperCase()}`;
  }

  generateIntroduction(affidavitData) {
    const name = affidavitData.affiantName || '[NAME]';
    return `I, ${name}, being duly sworn, depose and state as follows:`;
  }

  generateCompetencyStatement(affiantName) {
    const name = affiantName || 'I';
    return {
      number: 1,
      content: `${name} am over the age of eighteen (18) years, of sound mind, and otherwise competent to make this affidavit. The facts stated herein are within my personal knowledge and are true and correct.`,
      type: 'competency'
    };
  }

  processFactsForDocument(facts) {
    if (!Array.isArray(facts)) return [];
    
    const processedFacts = [];
    let factNumber = 2; // Start at 2 (after competency statement)
    
    facts.forEach(fact => {
      const content = typeof fact === 'string' 
        ? fact 
        : (fact.professionalRewrite || fact.content || '');
      
      if (content && content.trim()) {
        processedFacts.push({
          number: factNumber++,
          content: content.trim(),
          type: 'fact'
        });
      }
    });
    
    return processedFacts;
  }

  generateConclusion() {
    return 'Further, Affiant sayeth not.';
  }

  generatePerjuryStatement() {
    return `SIGNED under penalty of perjury on this _____ day of _____________, 2025.`;
  }

  generateSignatureBlock(affiantName) {
    const name = affiantName || '[NAME]';
    return {
      line: '_________________________________',
      name,
      title: 'Affiant',
      formatted: `_________________________________\n${name}\nAffiant`
    };
  }

  generateNotaryBlock(affidavitData) {
    // To be overridden by state-specific templates
    return 'NOTARY BLOCK';
  }

  generateFooter() {
    return {
      disclaimer: 'This document was generated for informational purposes only and does not constitute legal advice.',
      timestamp: new Date().toISOString(),
      version: '1.0'
    };
  }

  generateFullText(sections) {
    let text = '';
    
    if (sections.header) text += sections.header + '\n\n';
    if (sections.venue) text += sections.venue + '\n\n';
    if (sections.caseCaption?.formatted) text += sections.caseCaption.formatted + '\n\n';
    if (sections.title) text += sections.title + '\n\n';
    if (sections.introduction) text += sections.introduction + '\n\n';
    if (sections.competencyStatement) {
      text += `${sections.competencyStatement.number}. ${sections.competencyStatement.content}\n\n`;
    }
    
    sections.facts.forEach(fact => {
      text += `${fact.number}. ${fact.content}\n\n`;
    });
    
    if (sections.conclusion) text += sections.conclusion + '\n\n';
    if (sections.perjuryStatement) text += sections.perjuryStatement + '\n\n';
    if (sections.signatureBlock?.formatted) text += sections.signatureBlock.formatted + '\n\n';
    if (sections.notaryBlock) text += sections.notaryBlock + '\n\n';
    
    return text;
  }

  generateHTMLContent(sections) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Affidavit</title>
  <style>
    body {
      font-family: 'Times New Roman', Times, serif;
      font-size: 12pt;
      line-height: 2.0;
      margin: 1in;
      max-width: 8.5in;
    }
    .header, .venue { text-align: center; font-weight: bold; }
    .case-caption { text-align: center; border-bottom: 2px solid black; padding-bottom: 1em; margin-bottom: 1em; white-space: pre-line; }
    .title { text-align: center; font-weight: bold; text-decoration: underline; margin: 2em 0; }
    .fact { text-indent: -2em; padding-left: 2em; margin-bottom: 1em; text-align: justify; }
    .signature-block { margin-top: 3em; }
    .notary-block { border: 2px solid black; padding: 1em; margin-top: 2em; background: #f9f9f9; }
    @media print {
      body { margin: 1in; }
      .notary-block { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  ${sections.header ? `<div class="header">${sections.header}</div>` : ''}
  ${sections.venue ? `<div class="venue">${sections.venue}</div>` : ''}
  ${sections.caseCaption?.formatted ? `<div class="case-caption">${sections.caseCaption.formatted}</div>` : ''}
  ${sections.title ? `<div class="title">${sections.title}</div>` : ''}
  ${sections.introduction ? `<p>${sections.introduction}</p>` : ''}
  ${sections.competencyStatement ? `<p class="fact">${sections.competencyStatement.number}. ${sections.competencyStatement.content}</p>` : ''}
  ${sections.facts.map(f => `<p class="fact">${f.number}. ${f.content}</p>`).join('\n  ')}
  ${sections.conclusion ? `<p>${sections.conclusion}</p>` : ''}
  ${sections.perjuryStatement ? `<p>${sections.perjuryStatement}</p>` : ''}
  ${sections.signatureBlock?.formatted ? `<div class="signature-block"><pre>${sections.signatureBlock.formatted}</pre></div>` : ''}
  ${sections.notaryBlock ? `<div class="notary-block"><pre>${sections.notaryBlock}</pre></div>` : ''}
</body>
</html>`;
  }

  performStateSpecificValidation(affidavitData) {
    return { errors: [], warnings: [] };
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
  }

  performStateSpecificValidation(affidavitData) {
    const errors = [];
    const warnings = [];
    
    // ✅ County is REQUIRED for Texas
    if (!affidavitData.county || affidavitData.county.trim().length === 0) {
      errors.push('County is required for Texas affidavits');
    }
    
    return { errors, warnings };
  }

  generateNotaryBlock(affidavitData) {
    return `SWORN TO AND SUBSCRIBED before me on this _____ day of _____________, 2025.


_________________________________
Notary Public, State of Texas

My commission expires: ___________`;
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
  }

  performStateSpecificValidation(affidavitData) {
    const errors = [];
    const warnings = [];
    
    if (!affidavitData.county || affidavitData.county.trim().length === 0) {
      errors.push('County is required for Utah affidavits');
    }
    
    return { errors, warnings };
  }

  generateNotaryBlock(affidavitData) {
    return `SUBSCRIBED AND SWORN TO before me on this _____ day of _____________, 2025.


_________________________________
Notary Public
Residing at: _______________
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
    this.requiredFields = ['affiantName', 'state', 'county'];
  }

  performStateSpecificValidation(affidavitData) {
    const errors = [];
    const warnings = [];
    
    if (!affidavitData.county || affidavitData.county.trim().length === 0) {
      errors.push('County is required for Arizona affidavits');
    }
    
    return { errors, warnings };
  }

  generateNotaryBlock(affidavitData) {
    return `SUBSCRIBED AND SWORN TO before me this _____ day of _____________, 2025.


_________________________________
Notary Public, State of Arizona

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
      requirements: {
        venue: template.sections.venue,
        caseCaption: template.sections.caseCaption,
        notaryBlock: template.sections.notaryBlock,
        countyRequired: template.requiredFields.includes('county')
      }
    }));
  }
  
  validateAffidavitData(stateCode, affidavitData) {
    const template = this.getTemplate(stateCode);
    return template.validateData(affidavitData);
  }
  
  generateAffidavit(stateCode, affidavitData) {
    const template = this.getTemplate(stateCode);
    return template.generateDocument(affidavitData);
  }
}

module.exports = {
  StateTemplateManager,
  BaseAffidavitTemplate,
  TexasTemplate,
  UtahTemplate,
  ArizonaTemplate
};
