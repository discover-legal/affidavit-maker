// templates/StateTemplateManager.js
// LEGAL COMPLIANCE VERSION 2.0 - Updated to conform with TX, UT, and AZ statutory requirements
// Last Legal Review: 2025-01-XX
// Changes: Fixed all critical compliance issues identified in legal audit

const logger = require('../utils/logger');

/**
 * Base template class for affidavit generation
 * Provides common functionality across all states
 */
class BaseAffidavitTemplate {
  constructor() {
    this.state = null;
    this.stateName = null;
    this.requiredFields = ['affiantName', 'state'];
    this.sections = {
      header: true,
      venue: true,
      caseCaption: true,
      title: true,
      introduction: true,
      competencyStatement: true,
      facts: true,
      conclusion: true,
      perjuryStatement: false, // Default false, overridden by state
      signatureBlock: true,
      notaryBlock: true,
      footer: true
    };
    this.formatting = {
      fontSize: '12pt',
      fontFamily: 'Times New Roman',
      lineHeight: '2',
      margin: '1in'
    };
  }

  getRequirements() {
    return {
      requiredFields: this.requiredFields,
      sections: this.sections,
      formatting: this.formatting
    };
  }

  getFormattingRules() {
    return this.formatting;
  }

  validateData(affidavitData) {
    const errors = [];
    const warnings = [];
    
    // Check required fields
    if (!affidavitData.affiantName || affidavitData.affiantName.trim().length < 2) {
      errors.push('Affiant name is required and must be at least 2 characters');
    }
    
    if (!affidavitData.state) {
      errors.push('State is required');
    }
    
    // Check county requirement (state-specific)
    if (this.requiredFields.includes('county')) {
      if (!affidavitData.county || affidavitData.county.trim().length === 0) {
        errors.push(`County is required for ${this.stateName} affidavits`);
      }
    }
    
    // Check facts
    if (!affidavitData.facts || affidavitData.facts.length === 0) {
      warnings.push('No facts provided - affidavit will be incomplete');
    }
    
    // State-specific validation
    const stateValidation = this.performStateSpecificValidation(affidavitData);
    errors.push(...stateValidation.errors);
    warnings.push(...stateValidation.warnings);
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Generate case caption for court documents
   * Override in state-specific templates if needed
   * FIXED: Use 'court' field name, show placeholder when no data provided
   */
  generateCaseCaption(affidavitData) {
    // FIXED: Always show case caption section, even with placeholders
    // This ensures WYSIWYG preview matches final PDF
    let caption = '';

    // Court name - use 'court' field (matches schema), fallback to courtName for backwards compatibility
    let courtName = affidavitData.court || affidavitData.courtName || '[COURT NAME]';
    courtName = courtName.toUpperCase();

    // State-specific court formatting handled in subclasses
    caption += `IN THE ${courtName}\n\n`;

    // Case number - show placeholder if not provided
    const caseNumber = affidavitData.caseNumber || '[CASE NUMBER]';
    caption += `CAUSE NO. ${caseNumber.toUpperCase()}\n\n`;

    // Add party names if both are provided (style of cause format)
    // Extract from affidavitData or use placeholders
    const plaintiff = affidavitData.plaintiff || '[PLAINTIFF NAME]';
    const defendant = affidavitData.defendant || '[DEFENDANT NAME]';

    caption += `${plaintiff.toUpperCase()}\n\n`;
    caption += `V.\n\n`;
    caption += `${defendant.toUpperCase()}`;

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

    // Generate all sections
    const header = this.generateHeader();

    let venue = null;
    if (this.sections.venue && affidavitData.county) {
      venue = this.generateVenue(affidavitData.county);
    }

    let caseCaption = null;
    if (this.sections.caseCaption) {
      caseCaption = this.generateCaseCaption(affidavitData);
    }

    const title = this.generateTitle(affidavitData.affiantName);
    const introduction = this.generateIntroduction(affidavitData);
    const competencyStatement = this.generateCompetencyStatement(affidavitData.affiantName);

    // Process facts with original fact data structure preserved
    const processedFacts = this.processFactsForDocument(affidavitData.facts || []);

    // FIXED: Return facts as {items: [...]} for consistency with preview and PDF expectations
    // Include competency statement as first fact for proper rendering
    const facts = {
      items: [competencyStatement, ...processedFacts]
    };

    const conclusion = this.generateConclusion();

    // Perjury statement is state-specific
    const perjuryStatement = this.generatePerjuryStatement();

    const signatureBlock = this.generateSignatureBlock(affidavitData.affiantName);
    const notaryBlock = this.generateNotaryBlock(affidavitData);
    const footer = this.generateFooter();

    return {
      id,
      state: this.state,
      timestamp: new Date(),
      sections: {
        header,
        venue,
        caseCaption,
        title,
        introduction,
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
    // Base class returns null - override in state-specific templates
    return null;
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
      version: '2.0'
    };
  }

  generateFullText(sections) {
    let text = '';

    if (sections.header) text += sections.header + '\n\n';
    if (sections.venue) text += sections.venue + '\n\n';
    if (sections.caseCaption?.formatted) text += sections.caseCaption.formatted + '\n\n';
    if (sections.title) text += sections.title + '\n\n';
    if (sections.introduction) text += sections.introduction + '\n\n';

    // FIXED: Handle facts.items array (includes competency statement)
    if (sections.facts?.items && Array.isArray(sections.facts.items)) {
      sections.facts.items.forEach(fact => {
        text += `${fact.number}. ${fact.content}\n\n`;
      });
    }

    if (sections.conclusion) text += sections.conclusion + '\n\n';
    if (sections.perjuryStatement) text += sections.perjuryStatement + '\n\n';
    if (sections.signatureBlock?.formatted) text += sections.signatureBlock.formatted + '\n\n';
    if (sections.notaryBlock) text += sections.notaryBlock + '\n\n';

    return text;
  }

  generateHTMLContent(sections) {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Affidavit - ${this.stateName}</title>
  <style>
    body {
      font-family: 'Times New Roman', serif;
      font-size: 12pt;
      line-height: 2;
      margin: 1in;
      color: #000;
      background: white;
    }
    .header {
      text-align: center;
      font-weight: bold;
      margin-bottom: 10px;
    }
    .venue {
      text-align: center;
      font-weight: bold;
      margin-bottom: 20px;
    }
    .case-caption {
      text-align: center;
      margin-bottom: 20px;
      white-space: pre-line;
    }
    .title {
      text-align: center;
      font-weight: bold;
      text-decoration: underline;
      margin: 20px 0;
    }
    .fact {
      margin-bottom: 15px;
      text-align: justify;
    }
    .signature-block {
      margin-top: 40px;
      margin-bottom: 30px;
      white-space: pre-line;
    }
    .notary-block {
      margin-top: 30px;
      padding: 20px;
      border: 2px solid #000;
      white-space: pre-line;
      background-color: #f9f9f9;
    }
    .notary-instruction {
      margin-top: 30px;
      margin-bottom: 10px;
      padding: 15px;
      border: 2px solid #0066cc;
      background-color: #e6f2ff;
      font-size: 10pt;
      font-weight: bold;
      color: #003366;
    }
    @media print {
      body {
        margin: 0;
        padding: 1in;
      }
      .notary-instruction {
        border-color: #000;
        background-color: #f0f0f0;
      }
    }
  </style>
</head>
<body>
  ${sections.header ? `<div class="header">${sections.header}</div>` : ''}
  ${sections.venue ? `<div class="venue">${sections.venue}</div>` : ''}
  ${sections.caseCaption?.formatted ? `<div class="case-caption">${sections.caseCaption.formatted}</div>` : ''}
  ${sections.title ? `<div class="title">${sections.title}</div>` : ''}
  ${sections.introduction ? `<p>${sections.introduction}</p>` : ''}
  ${sections.facts?.items ? sections.facts.items.map(f => `<p class="fact">${f.number}. ${f.content}</p>`).join('\n  ') : ''}
  ${sections.conclusion ? `<p>${sections.conclusion}</p>` : ''}
  ${sections.perjuryStatement ? `<p>${sections.perjuryStatement}</p>` : ''}
  ${sections.signatureBlock?.formatted ? `<div class="signature-block"><pre>${sections.signatureBlock.formatted}</pre></div>` : ''}
  ${sections.notaryInstruction ? `<div class="notary-instruction">${sections.notaryInstruction}</div>` : ''}
  ${sections.notaryBlock ? `<div class="notary-block"><pre>${sections.notaryBlock}</pre></div>` : ''}
</body>
</html>`;
  }

  performStateSpecificValidation(affidavitData) {
    return { errors: [], warnings: [] };
  }
}

/**
 * ==========================================
 * TEXAS TEMPLATE - LEGALLY COMPLIANT v2.0
 * ==========================================
 * Governing Law: Tex. Gov't Code § 312.011, Tex. Civ. Prac. & Rem. Code § 18.002
 * 
 * FIXES IMPLEMENTED:
 * - REMOVED perjury statement (NOT required for Texas sworn affidavits per § 312.011)
 * - Verified notary block matches statutory form (§ 18.002)
 * - Confirmed county as required field
 */
class TexasTemplate extends BaseAffidavitTemplate {
  constructor() {
    super();
    this.state = 'TX';
    this.stateName = 'Texas';
    this.requiredFields = ['affiantName', 'state', 'county'];
    
    // Texas does NOT include perjury statement in sworn affidavits
    this.sections.perjuryStatement = false;
  }

  performStateSpecificValidation(affidavitData) {
    const errors = [];
    const warnings = [];
    
    // County is REQUIRED for Texas
    if (!affidavitData.county || affidavitData.county.trim().length === 0) {
      errors.push('County is required for Texas affidavits');
    }
    
    // Warn if perjury statement is somehow present (shouldn't be)
    const factsText = (affidavitData.facts || []).join(' ').toLowerCase();
    if (factsText.includes('penalty of perjury') || factsText.includes('under perjury')) {
      warnings.push('Texas sworn affidavits do not require perjury statement in document text - oath provides warning');
    }
    
    return { errors, warnings };
  }

  /**
   * Texas notary block per Tex. Civ. Prac. & Rem. Code § 18.002
   * COMPLIANT WITH: Statutory jurat format
   */
  generateNotaryBlock(affidavitData) {
    return `SWORN TO AND SUBSCRIBED before me on this _____ day of _____________, 20___.


_________________________________
Notary Public, State of Texas

Notary's printed name: _______________________

My commission expires: ___________`;
  }

  /**
   * FIXED: No perjury statement for Texas sworn affidavits
   * The oath administered by the notary provides the perjury warning per § 312.011
   */
  generatePerjuryStatement() {
    return null;
  }
}

/**
 * ==========================================
 * UTAH TEMPLATE - LEGALLY COMPLIANT v2.0
 * ==========================================
 * Governing Law: Utah Code § 46-1-6.5 (PRESCRIPTIVE STATUTORY FORM)
 * 
 * CRITICAL FIXES IMPLEMENTED:
 * 1. FIXED header: "State of Utah" (sentence case per § 46-1-6.5)
 * 2. FIXED notary block: Complete revision per § 46-1-6.5(2)(b) including:
 *    - Notary name field (REQUIRED)
 *    - Proper date format: (date) day of (month), in the year (year)
 *    - Affiant name field (REQUIRED)
 *    - Commission expiration line (required per § 46-1-16)
 * 3. ADDED mandatory oath instruction (§ 46-1-6.5(2)(a))
 * 4. REMOVED perjury statement (NOT required for sworn affidavits)
 * 5. ENHANCED competency statement for stronger URCP Rule 56 compliance
 */
class UtahTemplate extends BaseAffidavitTemplate {
  constructor() {
    super();
    this.state = 'UT';
    this.stateName = 'Utah';
    this.requiredFields = ['affiantName', 'state', 'county'];
    
    // Utah does NOT include perjury statement in sworn affidavits
    this.sections.perjuryStatement = false;
  }

  /**
   * FIXED: Utah Code § 46-1-6.5 requires "State of Utah" (sentence case)
   * NOT "STATE OF UTAH" (all caps)
   */
  generateHeader() {
    return 'State of Utah'; // CRITICAL FIX: Sentence case per statute
  }

  /**
   * FIXED: Utah Code § 46-1-6.5 format
   */
  generateVenue(county) {
    // Properly capitalize county name (title case for each word)
    const countyName = county
      ? county.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ')
      : '____________';
    return `County of ${countyName}`; // Matches statutory form
  }

  performStateSpecificValidation(affidavitData) {
    const errors = [];
    const warnings = [];
    
    // County is REQUIRED for Utah
    if (!affidavitData.county || affidavitData.county.trim().length === 0) {
      errors.push('County is required for Utah affidavits per Utah Code § 46-1-6.5');
    }
    
    // Check for incorrect header format
    if (affidavitData._generatedHeader === 'STATE OF UTAH') {
      errors.push('Utah header must be "State of Utah" (sentence case) per § 46-1-6.5, not "STATE OF UTAH"');
    }
    
    return { errors, warnings };
  }

  /**
   * ENHANCED: Stronger competency statement for URCP Rule 56(c)(4) compliance
   * Explicitly addresses "competent to testify" requirement
   */
  generateCompetencyStatement(affiantName) {
    const name = affiantName || 'I';
    return {
      number: 1,
      content: `${name} am over the age of eighteen (18) years, of sound mind, and otherwise competent to make this affidavit. The facts stated herein are within my personal knowledge and are true and correct. If called as a witness, I could testify competently to the matters stated herein.`,
      type: 'competency'
    };
  }

  /**
   * FIXED: Complete revision per Utah Code § 46-1-6.5(2)(b)
   * STATUTORY REQUIREMENTS:
   * - Must include notary's name
   * - Must use specific date format: (date) day of (month), in the year (year)
   * - Must include document signer's name
   * - Must include commission expiration (§ 46-1-16)
   */
  generateNotaryBlock(affidavitData) {
    return `Subscribed and sworn to before me, ________________________________,
                                    (notary public name)

on this _______ day of _________________, in the year _______,
        (date)          (month)                      (year)

by ________________________________.
    (name of document signer)


(SEAL)                              _________________________________
                                    Notary Public, State of Utah

My commission expires: ___________`;
  }

  /**
   * NEW: Mandatory oath instruction per Utah Code § 46-1-6.5(2)(a)
   * The notary MUST administer this specific oath
   */
  generateNotaryInstruction() {
    return `INSTRUCTION FOR NOTARY PUBLIC:
Before completing the jurat below, you MUST administer the following oath to the affiant as required by Utah Code § 46-1-6.5(2)(a):
"Do you swear or affirm under penalty of perjury that the statements in your document are true?"
Only after administering this oath may you complete the certificate below.`;
  }

  /**
   * FIXED: No perjury statement for Utah sworn affidavits
   * Perjury warning is provided through the MANDATORY oath (§ 46-1-6.5(2)(a))
   */
  generatePerjuryStatement() {
    return null;
  }

  /**
   * Override document generation to include notary instruction
   */
  generateDocument(affidavitData = {}) {
    const doc = super.generateDocument(affidavitData);

    // Add notary instruction to sections
    doc.sections.notaryInstruction = this.generateNotaryInstruction();

    // Update full text to include instruction
    const instructionText = '\n\n' + this.generateNotaryInstruction() + '\n\n';
    const notaryBlockIndex = doc.fullText.indexOf(doc.sections.notaryBlock);
    if (notaryBlockIndex > -1) {
      doc.fullText = doc.fullText.slice(0, notaryBlockIndex) +
                     instructionText +
                     doc.fullText.slice(notaryBlockIndex);
    }

    return doc;
  }
}

/**
 * ==========================================
 * ARIZONA TEMPLATE - LEGALLY COMPLIANT v2.0
 * ==========================================
 * Governing Law: A.R.S. § 13-2702 (Perjury), A.R.S. § 41-313 (Notary)
 * 
 * FIXES IMPLEMENTED:
 * 1. REVISED perjury statement to Arizona-specific wording
 * 2. ADDED commission expiration line (best practice per A.R.S. § 41-313(D)(2))
 * 3. ENFORCED county as required field (universal practice + seal requirement)
 * 4. ENHANCED competency statement with explicit "competent to testify" language
 * 5. CLARIFIED notary block format
 */
class ArizonaTemplate extends BaseAffidavitTemplate {
  constructor() {
    super();
    this.state = 'AZ';
    this.stateName = 'Arizona';
    this.requiredFields = ['affiantName', 'state', 'county']; // FIXED: County now required
    
    // Arizona DOES include perjury statement (best practice)
    this.sections.perjuryStatement = true;
  }

  /**
   * Arizona venue with proper county name capitalization
   */
  generateVenue(county) {
    // Properly capitalize county name (title case for each word)
    const countyName = county
      ? county.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ')
      : '[COUNTY]';
    return `County of ${countyName}`;
  }

  performStateSpecificValidation(affidavitData) {
    const errors = [];
    const warnings = [];

    // FIXED: County is now REQUIRED for Arizona
    if (!affidavitData.county || affidavitData.county.trim().length === 0) {
      errors.push('County is required for Arizona affidavits (universal practice and A.R.S. § 41-313(D)(2) seal requirement)');
    }

    return { errors, warnings };
  }

  /**
   * ENHANCED: Explicitly address Rule 56 competency requirement
   * Per Elerick v. Rocklin, 103 Ariz. 76
   */
  generateCompetencyStatement(affiantName) {
    const name = affiantName || 'I';
    return {
      number: 1,
      content: `${name} am over the age of eighteen (18) years, of sound mind, and otherwise competent to make this affidavit. The facts stated herein are within my personal knowledge and are true and correct. I am competent to testify to the matters stated in this affidavit.`,
      type: 'competency'
    };
  }

  /**
   * FIXED: Arizona-specific perjury statement
   * Includes state-specific reference per A.R.S. § 13-2702
   */
  generatePerjuryStatement() {
    return 'I declare under penalty of perjury under the laws of the State of Arizona that the foregoing is true and correct.';
  }

  /**
   * FIXED: Complete Arizona notary block
   * - Added "or affirmed" option
   * - Added commission expiration line (best practice per A.R.S. § 41-313(D)(2))
   * - Clarified seal placement
   */
  generateNotaryBlock(affidavitData) {
    return `Subscribed and sworn to (or affirmed) before me this _____ day of 
_____________, 20___.


(SEAL)                              _________________________________
                                    Notary Public

My commission expires: ___________`;
  }
}

/**
 * ==========================================
 * STATE TEMPLATE MANAGER
 * ==========================================
 * Main class for managing state-specific affidavit templates
 */
class StateTemplateManager {
  constructor() {
    this.templates = {
      'TX': new TexasTemplate(),
      'UT': new UtahTemplate(),
      'AZ': new ArizonaTemplate()
    };
    this.defaultState = 'TX';
    
    logger.info('StateTemplateManager initialized (Legal Compliance v2.0)', {
      states: Object.keys(this.templates),
      version: '2.0'
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
        countyRequired: template.requiredFields.includes('county'),
        perjuryStatement: template.sections.perjuryStatement
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

  /**
   * Get legal citation information for a state
   */
  getLegalCitations(stateCode) {
    const citations = {
      'TX': {
        primary: 'Tex. Gov\'t Code § 312.011',
        secondary: ['Tex. Civ. Prac. & Rem. Code § 18.002', 'Tex. R. Civ. P. 15'],
        notes: 'Texas affidavits do not require perjury statement in text - oath provides warning'
      },
      'UT': {
        primary: 'Utah Code § 46-1-6.5',
        secondary: ['Utah Code § 46-1-16', 'URCP Rule 56(c)(4)', 'Utah Code § 78B-5-701'],
        notes: 'Utah has prescriptive statutory form requirements with minimal flexibility'
      },
      'AZ': {
        primary: 'A.R.S. § 13-2702',
        secondary: ['A.R.S. § 41-313', 'Arizona Rule 56', 'Elerick v. Rocklin, 103 Ariz. 76'],
        notes: 'Arizona follows substantial compliance standard with best practice perjury statement'
      }
    };
    
    return citations[stateCode.toUpperCase()] || null;
  }
}

module.exports = {
  StateTemplateManager,
  BaseAffidavitTemplate,
  TexasTemplate,
  UtahTemplate,
  ArizonaTemplate
};