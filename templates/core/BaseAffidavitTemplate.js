// templates/core/BaseAffidavitTemplate.js
// Base template class for affidavit generation
// Provides common functionality across all states

/**
 * Escape HTML special characters to prevent XSS/injection
 * @param {string} str - String to escape
 * @returns {string} Escaped string safe for HTML
 */
const escapeHtml = (str) => {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

/**
 * Base template class for affidavit generation
 * Provides common functionality across all states
 *
 * @class BaseAffidavitTemplate
 * @description Abstract base class that defines the common interface and functionality
 * for all state-specific affidavit templates. State templates should extend this class
 * and override state-specific methods as needed.
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

  /**
   * Get template requirements
   * @returns {Object} Template requirements including fields, sections, and formatting
   */
  getRequirements() {
    return {
      requiredFields: this.requiredFields,
      sections: this.sections,
      formatting: this.formatting
    };
  }

  /**
   * Get formatting rules for this template
   * @returns {Object} Formatting rules (font, size, margins, line height)
   */
  getFormattingRules() {
    return this.formatting;
  }

  /**
   * Get exhibit formatting rules for this state
   * Override in state-specific templates
   *
   * @returns {Object} Exhibit rules including label style, cover page requirements, etc.
   */
  getExhibitRules() {
    return {
      labelStyle: 'letters', // 'letters' (A, B, C) or 'numbers' (1, 2, 3)
      requireCoverPage: false,
      coverPageFormat: null,
      allowedFormats: ['PDF', 'JPG', 'PNG'],
      maxFileSize: 25 * 1024 * 1024, // 25MB
      maxTotalSize: 100 * 1024 * 1024, // 100MB
      instructions: 'Attach exhibits after the affidavit.'
    };
  }

  /**
   * Validate affidavit data against template requirements
   *
   * @param {Object} affidavitData - The affidavit data to validate
   * @returns {Object} Validation result with isValid, errors, and warnings
   */
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
   *
   * @param {Object} affidavitData - The affidavit data
   * @returns {Object} Case caption with formatted text and component parts
   */
  generateCaseCaption(affidavitData) {
    // Always show case caption section, even with placeholders
    // This ensures WYSIWYG preview matches final PDF
    let caption = '';

    // Court name - use 'court' field (matches schema), fallback to courtName for backwards compatibility
    let courtName = affidavitData.court || affidavitData.courtName || '[COURT NAME]';
    courtName = courtName.toUpperCase();

    // State-specific court formatting handled in subclasses
    caption += `IN THE ${courtName}\n\n`;

    // Case number - default uses "CASE NO." (override in state-specific templates if needed)
    const caseNumber = affidavitData.caseNumber || '[CASE NUMBER]';
    caption += `CASE NO. ${caseNumber.toUpperCase()}\n\n`;

    // Add party names if both are provided (style of cause format)
    // Extract from affidavitData or use placeholders
    const plaintiff = affidavitData.plaintiff || '[PLAINTIFF NAME]';
    const defendant = affidavitData.defendant || '[DEFENDANT NAME]';

    caption += `${plaintiff.toUpperCase()}\n`;
    caption += `V.\n`;
    caption += `${defendant.toUpperCase()}`;

    return {
      courtName,
      caseNumber: affidavitData.caseNumber,
      plaintiff: affidavitData.plaintiff,
      defendant: affidavitData.defendant,
      formatted: caption
    };
  }

  /**
   * Generate complete affidavit document
   *
   * @param {Object} affidavitData - The affidavit data
   * @returns {Object} Complete document with sections, validation, and metadata
   */
  generateDocument(affidavitData = {}) {
    const validation = this.validateData(affidavitData);

    // Built-in crypto.randomUUID — not the `uuid` npm package, which the
    // Next.js standalone tracer doesn't ship for createRequire-loaded
    // templates (see BaseDivorcePetitionTemplate.js). `require('uuid')` here
    // threw at generation time in the production container.
    const id = require('node:crypto').randomUUID();

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

    // Return facts as {items: [...]} for consistency with preview and PDF expectations
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

  /**
   * Generate document header
   * Override in state-specific templates for custom formatting
   *
   * @returns {string} Header text
   */
  generateHeader() {
    return `STATE OF ${this.stateName.toUpperCase()}`;
  }

  /**
   * Generate venue section
   * Override in state-specific templates for custom formatting
   *
   * @param {string} county - County name
   * @returns {string} Venue text
   */
  generateVenue(county) {
    const countyUpper = (county || '[COUNTY]').toUpperCase();
    return `County of ${countyUpper}`;
  }

  /**
   * Generate affidavit title
   *
   * @param {string} affiantName - Name of affiant
   * @returns {string} Title text
   */
  generateTitle(affiantName) {
    return `AFFIDAVIT OF ${(affiantName || '[NAME]').toUpperCase()}`;
  }

  /**
   * Generate introduction paragraph
   *
   * @param {Object} affidavitData - The affidavit data
   * @returns {string} Introduction text
   */
  generateIntroduction(affidavitData) {
    const name = affidavitData.affiantName || '[NAME]';
    // Residence clause — standard affidavit form, and required for the
    // residency/domicile affidavit types whose interviews collect it.
    const residence = [
      affidavitData.affiantAddress,
      affidavitData.affiantCity,
      affidavitData.affiantStateName,
      affidavitData.affiantZip,
    ]
      .filter((part) => typeof part === 'string' && part.trim() !== '')
      .join(', ');
    const residing = residence ? `, residing at ${residence}` : '';
    return `I, ${name}${residing}, being duly sworn, depose and state as follows:`;
  }

  /**
   * Generate competency statement
   * Override in state-specific templates for enhanced language
   *
   * @param {string} affiantName - Name of affiant
   * @returns {Object} Competency statement fact object
   */
  generateCompetencyStatement(affiantName) {
    return {
      number: 1,
      content: 'I am over the age of eighteen (18) years, of sound mind, and otherwise competent to make this affidavit. The facts stated herein are within my personal knowledge and are true and correct.',
      type: 'competency'
    };
  }

  /**
   * Process facts array for document generation
   *
   * @param {Array} facts - Array of fact objects or strings
   * @returns {Array} Processed facts with numbering and formatting
   */
  processFactsForDocument(facts) {
    if (!Array.isArray(facts)) return [];

    const processedFacts = [];
    let factNumber = 2; // Start at 2 (after competency statement)

    facts.forEach((fact, index) => {
      const content = typeof fact === 'string'
        ? fact
        : (fact.professionalRewrite || fact.content || '');

      if (content && content.trim()) {
        const processedFact = {
          number: factNumber++,
          content: content.trim(),
          type: typeof fact === 'object' && fact.type ? fact.type : 'fact'
        };

        // PRESERVE EVIDENCE DATA: If this is an evidence item, keep evidenceData
        if (typeof fact === 'object' && fact.type === 'evidence' && fact.evidenceData) {
          processedFact.evidenceData = fact.evidenceData;
          processedFact.id = fact.id; // Also preserve ID for matching
          processedFact.category = 'evidence'; // Set category for consistency
        }

        processedFacts.push(processedFact);
      }
    });

    return processedFacts;
  }

  /**
   * Generate conclusion paragraph
   *
   * @returns {string} Conclusion text
   */
  generateConclusion() {
    return 'Further, Affiant sayeth not.';
  }

  /**
   * Generate perjury statement
   * Override in state-specific templates
   *
   * @returns {string|null} Perjury statement or null if not required
   */
  generatePerjuryStatement() {
    // Base class returns null - override in state-specific templates
    return null;
  }

  /**
   * Generate signature block
   *
   * @param {string} affiantName - Name of affiant
   * @returns {Object} Signature block with formatted text
   */
  generateSignatureBlock(affiantName) {
    const name = affiantName || '[NAME]';
    return {
      line: '_________________________________',
      name,
      title: 'Affiant',
      formatted: `_________________________________\n${name}\nAffiant`
    };
  }

  /**
   * Generate notary block
   * MUST be overridden in state-specific templates for legal compliance
   *
   * @param {Object} affidavitData - The affidavit data
   * @returns {string} Notary block text
   */
  generateNotaryBlock(affidavitData) {
    // To be overridden by state-specific templates
    return 'NOTARY BLOCK';
  }

  /**
   * Generate footer with metadata
   *
   * @returns {Object} Footer with disclaimer and metadata
   */
  generateFooter() {
    return {
      disclaimer: 'This document was generated for informational purposes only and does not constitute legal advice.',
      timestamp: new Date().toISOString(),
      version: '2.0'
    };
  }

  /**
   * Generate full text representation of document
   *
   * @param {Object} sections - All document sections
   * @returns {string} Complete document as plain text
   */
  generateFullText(sections) {
    let text = '';

    if (sections.header) text += sections.header + '\n\n';
    if (sections.venue) text += sections.venue + '\n\n';
    if (sections.caseCaption?.formatted) text += sections.caseCaption.formatted + '\n\n';
    if (sections.title) text += sections.title + '\n\n';
    if (sections.introduction) text += sections.introduction + '\n\n';

    // Handle facts.items array (includes competency statement)
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

  /**
   * Generate HTML representation of document
   *
   * @param {Object} sections - All document sections
   * @returns {string} Complete document as HTML
   */
  generateHTMLContent(sections) {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Affidavit - ${escapeHtml(this.stateName)}</title>
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
  ${sections.header ? `<div class="header">${escapeHtml(sections.header)}</div>` : ''}
  ${sections.venue ? `<div class="venue">${escapeHtml(sections.venue)}</div>` : ''}
  ${sections.caseCaption?.formatted ? `<div class="case-caption">${escapeHtml(sections.caseCaption.formatted)}</div>` : ''}
  ${sections.title ? `<div class="title">${escapeHtml(sections.title)}</div>` : ''}
  ${sections.introduction ? `<p>${escapeHtml(sections.introduction)}</p>` : ''}
  ${sections.facts?.items ? sections.facts.items.map(f => `<p class="fact">${f.number}. ${escapeHtml(f.content)}</p>`).join('\n  ') : ''}
  ${sections.conclusion ? `<p>${escapeHtml(sections.conclusion)}</p>` : ''}
  ${sections.perjuryStatement ? `<p>${escapeHtml(sections.perjuryStatement)}</p>` : ''}
  ${sections.signatureBlock?.formatted ? `<div class="signature-block"><pre>${escapeHtml(sections.signatureBlock.formatted)}</pre></div>` : ''}
  ${sections.notaryInstruction ? `<div class="notary-instruction">${escapeHtml(sections.notaryInstruction)}</div>` : ''}
  ${sections.notaryBlock ? `<div class="notary-block"><pre>${escapeHtml(sections.notaryBlock)}</pre></div>` : ''}
</body>
</html>`;
  }

  /**
   * Perform state-specific validation
   * Override in state-specific templates
   *
   * @param {Object} affidavitData - The affidavit data to validate
   * @returns {Object} Validation result with errors and warnings arrays
   */
  performStateSpecificValidation(affidavitData) {
    return { errors: [], warnings: [] };
  }
}

module.exports = BaseAffidavitTemplate;
