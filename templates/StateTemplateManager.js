// templates/StateTemplateManager.js - Complete production template system
const { v4: uuidv4 } = require('uuid');

class StateTemplateManager {
  constructor() {
    this.templates = {
      'TX': new TexasTemplate(),
      'UT': new UtahTemplate(),
      'AZ': new ArizonaTemplate()
    };
    
    this.documentTypes = [
      'general',
      'divorce',
      'custody',
      'financial',
      'property',
      'identity'
    ];
  }

  getTemplate(state) {
    const template = this.templates[state?.toUpperCase()];
    if (!template) {
      console.warn(`No template found for state: ${state}, defaulting to Texas`);
      return this.templates['TX'];
    }
    return template;
  }

  getSupportedStates() {
    return Object.keys(this.templates).map(state => ({
      code: state,
      name: this.templates[state].stateName,
      requirements: this.templates[state].getRequirements()
    }));
  }

  getSupportedDocumentTypes() {
    return this.documentTypes;
  }

  validateAffidavitData(data, state) {
    const template = this.getTemplate(state);
    return template.validateData(data);
  }
}

// Base template class with all common functionality
class BaseAffidavitTemplate {
  constructor() {
    this.state = '';
    this.stateName = '';
    this.requirements = {};
    this.formatRules = {};
  }

  // Validation methods
  validateData(data) {
    const errors = [];
    const warnings = [];

    if (!data.affiantName || data.affiantName.trim().length < 2) {
      errors.push('Affiant name is required and must be at least 2 characters');
    }

    if (this.requirements.countyRequired && !data.county) {
      errors.push(`County is required for ${this.stateName} affidavits`);
    }

    if (!data.facts || data.facts.length === 0) {
      warnings.push('No facts provided - affidavit will be incomplete');
    }

    if (data.facts && data.facts.some(fact => fact.length < 10)) {
      warnings.push('Some facts are very short - consider adding more detail');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  // Core generation methods
  generateDocument(data, options = {}) {
    const validation = this.validateData(data);
    if (!validation.isValid) {
      throw new Error(`Invalid data for ${this.stateName}: ${validation.errors.join(', ')}`);
    }

    const documentId = options.documentId || uuidv4();
    const timestamp = new Date();

    const sections = {
      metadata: this.generateMetadata(data, documentId, timestamp),
      header: this.generateHeader(data),
      venue: this.generateVenue(data),
      caseCaption: this.generateCaseCaption(data),
      title: this.generateTitle(data),
      introduction: this.generateIntroduction(data),
      competencyStatement: this.generateCompetencyStatement(data),
      facts: this.generateFactsSection(data),
      conclusion: this.generateConclusion(data),
      perjuryStatement: this.generatePerjuryStatement(data),
      signatureBlock: this.generateSignatureBlock(data),
      notaryBlock: this.generateNotaryBlock(data),
      footer: this.generateFooter(data)
    };

    const document = {
      id: documentId,
      state: this.state,
      timestamp,
      sections,
      fullText: this.assembleFullText(sections),
      htmlContent: this.generateHTML(sections),
      validation,
      formatting: this.getFormattingRules()
    };

    return document;
  }

  generateMetadata(data, documentId, timestamp) {
    return {
      documentId,
      state: this.state,
      stateName: this.stateName,
      documentType: data.documentType || 'general',
      affiantName: data.affiantName,
      caseNumber: data.caseNumber,
      county: data.county,
      generatedAt: timestamp.toISOString(),
      templateVersion: this.getVersion(),
      requirements: this.requirements
    };
  }

  generateHeader(data) {
    return this.formatRules.headerFormat.replace('{STATE}', this.getStateHeaderName());
  }

  generateVenue(data) {
    if (!this.requirements.venue || !data.county) {
      return null;
    }
    return this.formatRules.venueFormat
      .replace('{COUNTY_FORMAT}', this.getCountyFormat())
      .replace('{COUNTY}', data.county.toUpperCase());
  }

  generateCaseCaption(data) {
    if (!data.caseNumber) return null;
    
    return {
      caseNumber: data.caseNumber,
      caseType: data.caseType,
      court: data.court,
      formatted: `CAUSE NO. ${data.caseNumber}${data.caseType ? `\n${data.caseType}` : ''}`
    };
  }

  generateTitle(data) {
    const baseTitle = 'AFFIDAVIT';
    if (data.affiantName) {
      return `${baseTitle} OF ${data.affiantName.toUpperCase()}`;
    }
    return baseTitle;
  }

  generateIntroduction(data) {
    return `BEFORE ME, the undersigned Notary Public, on this day personally appeared ${data.affiantName || '[AFFIANT NAME]'}, who being by me duly sworn, deposed as follows:`;
  }

  generateCompetencyStatement(data) {
    return {
      number: 1,
      content: `My name is ${data.affiantName || '[AFFIANT NAME]'}. I am over the age of eighteen (18) years, and I am fully competent to make this affidavit. The facts stated in this affidavit are within my personal knowledge and are true and correct.`,
      type: 'competency'
    };
  }

  generateFactsSection(data) {
    const facts = [];
    
    // Add competency statement
    facts.push(this.generateCompetencyStatement(data));

    // Add user facts
    if (data.facts && data.facts.length > 0) {
      data.facts.forEach((fact, index) => {
        facts.push({
          number: index + 2,
          content: fact.trim(),
          type: 'fact'
        });
      });
    }

    // Add document-type specific facts
    const additionalFacts = this.generateDocumentTypeSpecificFacts(data);
    additionalFacts.forEach(fact => {
      facts.push({
        number: facts.length + 1,
        content: fact,
        type: 'document_specific'
      });
    });

    return facts;
  }

  generateDocumentTypeSpecificFacts(data) {
    switch (data.documentType) {
      case 'divorce':
        return this.generateDivorceFacts(data);
      case 'custody':
        return this.generateCustodyFacts(data);
      case 'financial':
        return this.generateFinancialFacts(data);
      default:
        return [];
    }
  }

  generateDivorceFacts(data) {
    const facts = [];
    if (data.marriageDate) {
      facts.push(`I was married to ${data.spouseName || '[SPOUSE NAME]'} on ${data.marriageDate}.`);
    }
    if (data.separationDate) {
      facts.push(`We separated on ${data.separationDate}.`);
    }
    if (data.grounds) {
      facts.push(`The grounds for this divorce are: ${data.grounds}.`);
    }
    return facts;
  }

  generateCustodyFacts(data) {
    const facts = [];
    if (data.children && data.children.length > 0) {
      facts.push(`I am the parent of the following minor child(ren): ${data.children.join(', ')}.`);
    }
    if (data.currentCustody) {
      facts.push(`Current custody arrangement: ${data.currentCustody}.`);
    }
    return facts;
  }

  generateFinancialFacts(data) {
    const facts = [];
    if (data.monthlyIncome) {
      facts.push(`My current monthly gross income is approximately $${data.monthlyIncome}.`);
    }
    if (data.monthlyExpenses) {
      facts.push(`My current monthly expenses are approximately $${data.monthlyExpenses}.`);
    }
    return facts;
  }

  generateConclusion(data) {
    return 'Further, affiant sayeth not.';
  }

  generatePerjuryStatement(data) {
    return `I certify under PENALTY OF PERJURY under the laws of the State of ${this.stateName} that the foregoing is true and correct.`;
  }

  generateSignatureBlock(data) {
    return {
      line: '_'.repeat(40),
      name: data.affiantName || '[AFFIANT NAME]',
      title: 'Affiant',
      date: `Date: _________________`
    };
  }

  generateFooter(data) {
    return {
      disclaimer: 'This document was prepared using automated document assembly software.',
      timestamp: new Date().toLocaleDateString(),
      version: this.getVersion()
    };
  }

  // Assembly methods
  assembleFullText(sections) {
    let text = '';

    if (sections.header) {
      text += sections.header + '\n\n';
    }

    if (sections.venue) {
      text += sections.venue + '\n\n';
    }

    if (sections.caseCaption) {
      text += sections.caseCaption.formatted + '\n\n';
    }

    if (sections.title) {
      text += sections.title + '\n\n';
    }

    if (sections.introduction) {
      text += sections.introduction + '\n\n';
    }

    if (sections.facts && sections.facts.length > 0) {
      sections.facts.forEach(fact => {
        text += `${fact.number}. ${fact.content}\n\n`;
      });
    }

    if (sections.conclusion) {
      text += sections.conclusion + '\n\n';
    }

    if (sections.perjuryStatement) {
      text += sections.perjuryStatement + '\n\n';
    }

    if (sections.signatureBlock) {
      text += `${sections.signatureBlock.line}\n`;
      text += `${sections.signatureBlock.name}\n`;
      text += `${sections.signatureBlock.title}\n\n`;
      text += `${sections.signatureBlock.date}\n\n`;
    }

    if (sections.notaryBlock) {
      text += sections.notaryBlock + '\n';
    }

    return text;
  }

  generateHTML(sections) {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Affidavit - ${sections.metadata.affiantName}</title>
    <style>
        ${this.getCSS()}
    </style>
</head>
<body>
    <div class="document">
        ${sections.header ? `<div class="header">${sections.header}</div>` : ''}
        ${sections.venue ? `<div class="venue">${sections.venue}</div>` : ''}
        ${sections.caseCaption ? `<div class="case-caption">${sections.caseCaption.formatted.replace(/\n/g, '<br>')}</div>` : ''}
        ${sections.title ? `<div class="title">${sections.title}</div>` : ''}
        ${sections.introduction ? `<div class="introduction">${sections.introduction}</div>` : ''}
        
        <div class="facts-section">
            ${sections.facts.map(fact => `
                <div class="fact">
                    <span class="fact-number">${fact.number}.</span>
                    <span class="fact-content">${fact.content}</span>
                </div>
            `).join('')}
        </div>
        
        ${sections.conclusion ? `<div class="conclusion">${sections.conclusion}</div>` : ''}
        ${sections.perjuryStatement ? `<div class="perjury">${sections.perjuryStatement}</div>` : ''}
        
        <div class="signature-block">
            <div class="signature-line">${sections.signatureBlock.line}</div>
            <div class="signature-name">${sections.signatureBlock.name}</div>
            <div class="signature-title">${sections.signatureBlock.title}</div>
            <div class="signature-date">${sections.signatureBlock.date}</div>
        </div>
        
        ${sections.notaryBlock ? `<div class="notary-block"><pre>${sections.notaryBlock}</pre></div>` : ''}
    </div>
</body>
</html>`;
  }

  getCSS() {
    return `
        body {
            font-family: 'Times New Roman', serif;
            font-size: 12pt;
            line-height: 1.8;
            margin: 0;
            padding: 1in;
            color: #000;
            background: white;
        }
        
        .document {
            max-width: 8.5in;
            margin: 0 auto;
        }
        
        .header {
            text-align: center;
            font-weight: bold;
            font-size: 14pt;
            margin-bottom: 20px;
        }
        
        .venue {
            text-align: center;
            font-weight: bold;
            margin-bottom: 20px;
        }
        
        .case-caption {
            text-align: right;
            margin-bottom: 20px;
            font-weight: bold;
        }
        
        .title {
            text-align: center;
            font-weight: bold;
            font-size: 14pt;
            text-decoration: underline;
            margin: 30px 0;
        }
        
        .introduction {
            text-align: justify;
            margin-bottom: 20px;
            text-indent: 0.5in;
        }
        
        .facts-section {
            margin: 20px 0;
        }
        
        .fact {
            margin-bottom: 15px;
            text-align: justify;
            display: flex;
            align-items: flex-start;
        }
        
        .fact-number {
            font-weight: bold;
            margin-right: 10px;
            min-width: 30px;
        }
        
        .fact-content {
            flex: 1;
        }
        
        .conclusion {
            text-align: justify;
            margin: 20px 0;
            text-indent: 0.5in;
        }
        
        .perjury {
            text-align: justify;
            margin: 20px 0;
            text-indent: 0.5in;
        }
        
        .signature-block {
            margin-top: 50px;
            margin-bottom: 30px;
        }
        
        .signature-line {
            margin-bottom: 5px;
        }
        
        .signature-name {
            font-weight: bold;
        }
        
        .signature-date {
            margin-top: 20px;
        }
        
        .notary-block {
            margin-top: 50px;
            border: 2px solid #000;
            padding: 20px;
            background-color: #f9f9f9;
        }
        
        @media print {
            body { margin: 0; padding: 0.5in; }
            .document { max-width: none; }
        }
    `;
  }

  // Utility methods
  getRequirements() {
    return this.requirements;
  }

  getFormattingRules() {
    return this.formatRules;
  }

  getVersion() {
    return '1.0.0';
  }

  // Abstract methods to be implemented by state templates
  getStateHeaderName() {
    throw new Error('getStateHeaderName must be implemented by state template');
  }

  getCountyFormat() {
    throw new Error('getCountyFormat must be implemented by state template');
  }

  generateNotaryBlock(data) {
    throw new Error('generateNotaryBlock must be implemented by state template');
  }
}

// Texas Template
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
      headerFormat: 'THE STATE OF TEXAS',
      venueFormat: 'COUNTY OF {COUNTY}',
      countyFormat: 'COUNTY OF'
    };
  }

  getStateHeaderName() {
    return 'TEXAS';
  }

  getCountyFormat() {
    return 'COUNTY OF';
  }

  generateNotaryBlock(data) {
    return `SWORN TO AND SUBSCRIBED before me, the undersigned authority, on this _____ day of __________, 20____.


_________________________________
Notary Public, State of Texas

My commission expires: ________________


[NOTARY SEAL]`;
  }
}

// Utah Template
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

  getStateHeaderName() {
    return 'UTAH';
  }

  getCountyFormat() {
    return 'County of';
  }

  generateNotaryBlock(data) {
    return `SUBSCRIBED AND SWORN to before me this _____ day of __________, 20____.


_________________________________
Notary Public

Residing at: _________________________

My commission expires: ________________


[NOTARY SEAL]`;
  }
}

// Arizona Template
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

  getStateHeaderName() {
    return 'ARIZONA';
  }

  getCountyFormat() {
    return '';
  }

  generateVenue(data) {
    // Arizona doesn't use venue format
    return null;
  }

  generateNotaryBlock(data) {
    return `SUBSCRIBED AND SWORN TO before me this _____ day of __________, 20____.


_________________________________
Notary Public

My commission expires: ________________


[NOTARY SEAL]`;
  }
}

module.exports = {
  StateTemplateManager,
  BaseAffidavitTemplate,
  TexasTemplate,
  UtahTemplate,
  ArizonaTemplate
};