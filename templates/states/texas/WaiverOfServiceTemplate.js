// templates/states/texas/WaiverOfServiceTemplate.js
// Texas Waiver of Service
// Complies with Tex. R. Civ. P. 119a

const BaseAffidavitTemplate = require('../../core/BaseAffidavitTemplate');

/**
 * Texas Waiver of Service Template
 *
 * LEGAL COMPLIANCE NOTES:
 * - Governed by Tex. R. Civ. P. 119a
 * - The RESPONDENT (not the petitioner) executes this document
 * - No notarization required by Rule 119a; respondent's voluntary signature suffices
 * - Respondent must sign in person or through an attorney authorized to do so
 * - The waiver must be filed with the clerk of court
 * - Waiver is effective as to notice of ALL subsequent pleadings unless respondent
 *   later files an answer or appearance (Tex. R. Civ. P. 119a(c))
 * - Case cannot be heard until 60 days after petition was filed (Tex. Fam. Code § 6.702
 *   for divorce; other civil cases may differ)
 * - This document uses a simple signature block, NOT a notary block
 *
 * Legal References:
 * - Tex. R. Civ. P. 119a - Waiver of Citation
 * - Tex. Fam. Code § 6.702 - Waiting period for divorce (60 days)
 * - Tex. R. Civ. P. 121 - Appearance by filing waiver
 *
 * @class TexasWaiverOfServiceTemplate
 * @extends BaseAffidavitTemplate
 */
class TexasWaiverOfServiceTemplate extends BaseAffidavitTemplate {
  constructor() {
    super();

    this.state = 'TX';
    this.stateName = 'Texas';
    this.documentTitle = 'WAIVER OF SERVICE';

    this.sections = {
      header: true,
      venue: true,
      caseCaption: true,
      title: true,
      introduction: false,      // No oath introduction — Respondent makes a voluntary statement
      competencyStatement: false,
      facts: true,              // Body paragraphs
      conclusion: false,
      perjuryStatement: false,
      signatureBlock: true,     // Respondent signature only
      notaryBlock: false,       // Not required per Rule 119a
      footer: true
    };

    this.requiredFields = ['respondentName', 'petitionerName', 'state', 'county'];

    this.formatting = {
      fontSize: '12pt',
      fontFamily: 'Times New Roman',
      lineHeight: '2',
      margin: '1in'
    };
  }

  /**
   * Generate Texas-style header
   *
   * @returns {string} Header text
   */
  generateHeader() {
    return 'THE STATE OF TEXAS';
  }

  /**
   * Generate Texas-style venue
   *
   * @param {string} county - County name
   * @returns {string} Venue text
   */
  generateVenue(county) {
    const countyUpper = (county || '[COUNTY]').toUpperCase();
    return `COUNTY OF ${countyUpper}`;
  }

  /**
   * Generate Texas case caption using "CAUSE NO." terminology
   *
   * @param {Object} data - Document data
   * @returns {Object} Case caption object with formatted text
   */
  generateCaseCaption(data) {
    let caption = '';

    const courtName = (data.court || data.courtName || '[COURT NAME]').toUpperCase();
    caption += `IN THE ${courtName}\n\n`;

    const caseNumber = data.caseNumber || '[CAUSE NUMBER]';
    caption += `CAUSE NO. ${caseNumber.toUpperCase()}\n\n`;

    const petitioner = (data.petitionerName || '[PETITIONER NAME]').toUpperCase();
    const respondent = (data.respondentName || '[RESPONDENT NAME]').toUpperCase();

    caption += `${petitioner}\n`;
    caption += `Petitioner,\n\n`;
    caption += `V.\n\n`;
    caption += `${respondent}\n`;
    caption += `Respondent`;

    return {
      courtName,
      caseNumber: data.caseNumber,
      petitioner: data.petitionerName,
      respondent: data.respondentName,
      formatted: caption
    };
  }

  /**
   * Document title per Tex. R. Civ. P. 119a convention
   *
   * @returns {string} Document title
   */
  generateTitle() {
    return this.documentTitle;
  }

  /**
   * No oath introduction for a Waiver of Service; returns null
   *
   * @returns {null}
   */
  generateIntroduction() {
    return null;
  }

  /**
   * No competency statement for a Waiver of Service; returns null
   *
   * @returns {null}
   */
  generateCompetencyStatement() {
    return null;
  }

  /**
   * No conclusion paragraph; returns null
   *
   * @returns {null}
   */
  generateConclusion() {
    return null;
  }

  /**
   * No perjury statement; returns null
   *
   * @returns {null}
   */
  generatePerjuryStatement() {
    return null;
  }

  /**
   * Process facts for document generation.
   * Numbering starts at 1 (no preceding competency statement).
   *
   * @param {Array} facts - Array of fact objects or strings
   * @returns {Array} Processed fact objects
   */
  processFactsForDocument(facts) {
    if (!Array.isArray(facts)) return [];

    const processedFacts = [];
    let factNumber = 1;

    facts.forEach((fact) => {
      const content = typeof fact === 'string'
        ? fact
        : (fact.professionalRewrite || fact.content || '');

      if (content && content.trim()) {
        processedFacts.push({
          number: factNumber++,
          content: content.trim(),
          type: typeof fact === 'object' && fact.type ? fact.type : 'fact'
        });
      }
    });

    return processedFacts;
  }

  /**
   * Respondent signature block with address line
   * Title is "Respondent" (not "Affiant") because this is a waiver, not an affidavit
   *
   * @param {string} respondentName - Full name of the respondent
   * @returns {Object} Signature block object
   */
  generateSignatureBlock(respondentName) {
    const name = respondentName || '[RESPONDENT NAME]';
    return {
      line: '_________________________________',
      name,
      title: 'Respondent',
      formatted: [
        '_________________________________',
        name,
        'Respondent',
        '',
        'Date: _____________________________',
        '',
        'Address: ________________________________',
        '',
        '         ________________________________',
        '',
        'Phone:   ________________________________'
      ].join('\n')
    };
  }

  /**
   * No notary block for Waiver of Service per Tex. R. Civ. P. 119a
   *
   * @returns {null}
   */
  generateNotaryBlock() {
    return null;
  }

  /**
   * Texas-specific validation for waiver of service
   *
   * @param {Object} data - Document data
   * @returns {Object} Validation result
   */
  performStateSpecificValidation(data) {
    const errors = [];
    const warnings = [];

    if (!data.county || data.county.trim().length === 0) {
      errors.push('County is required for Texas Waiver of Service');
    }

    if (!data.respondentName || data.respondentName.trim().length === 0) {
      errors.push('Respondent name is required for Waiver of Service');
    }

    if (!data.petitionerName || data.petitionerName.trim().length === 0) {
      errors.push('Petitioner name is required for Waiver of Service');
    }

    if (!data.petitionTitle) {
      warnings.push('Petition title not provided; a placeholder will be used. Specify the exact petition title for accuracy.');
    }

    if (!data.caseNumber) {
      warnings.push('Cause number not provided. If the case has been filed, include the cause number for proper court identification.');
    }

    return { errors, warnings };
  }

  /**
   * Generate the complete Waiver of Service document
   *
   * @param {Object} data - Document data
   * @param {string}  data.respondentName  - Full legal name of the respondent (signer)
   * @param {string}  data.petitionerName  - Full legal name of the petitioner
   * @param {string}  data.county          - County where suit is pending
   * @param {string}  data.state           - State (should be "Texas")
   * @param {string}  [data.caseNumber]    - Cause number
   * @param {string}  [data.courtName]     - Court name
   * @param {string}  [data.petitionTitle] - Exact title of the petition (e.g., "Original Petition for Divorce")
   * @returns {Object} Complete document structure
   */
  generateDocument(data = {}) {
    // Validate using respondentName as the primary name field
    const normalizedData = Object.assign({}, data, {
      affiantName: data.respondentName || data.affiantName
    });

    const validation = this.validateData(normalizedData);

    // eslint-disable-next-line global-require
    const { randomUUID: uuidv4 } = require('node:crypto');
    const id = uuidv4();

    const header = this.generateHeader();
    const venue = this.generateVenue(data.county);
    const caseCaption = this.generateCaseCaption(data);
    const title = this.generateTitle();

    const factItems = this._buildWaiverBody(data);
    const facts = { items: factItems };

    const signatureBlock = this.generateSignatureBlock(data.respondentName);

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
        introduction: null,
        facts,
        conclusion: null,
        perjuryStatement: null,
        signatureBlock,
        notaryBlock: null,
        footer
      },
      fullText: this._buildFullText({
        header, venue, caseCaption, title, facts, signatureBlock
      }),
      htmlContent: this._buildHtmlContent({
        header, venue, caseCaption, title, facts, signatureBlock
      }),
      validation,
      formatting: this.formatting
    };
  }

  /**
   * Build the numbered body paragraphs for the waiver
   *
   * @param {Object} data - Document data
   * @returns {Array} Array of numbered fact/paragraph objects
   * @private
   */
  _buildWaiverBody(data) {
    const respondentName = data.respondentName || '[RESPONDENT NAME]';
    const petitionTitle = data.petitionTitle
      ? data.petitionTitle.trim()
      : '[PETITION TITLE, e.g., Original Petition for Divorce]';

    const items = [];

    // Paragraph 1: Acknowledgment of receipt
    items.push({
      number: 1,
      content: `I, ${respondentName}, Respondent in this case, state that I have received a copy of the ${petitionTitle} filed in this case.`,
      type: 'fact'
    });

    // Paragraph 2: Waiver of citation
    items.push({
      number: 2,
      content: 'I waive the issuance and service of citation on me in this case.',
      type: 'fact'
    });

    // Paragraph 3: Waiver of notices and delay periods
    items.push({
      number: 3,
      content: 'I waive all other notices and all periods of delay prescribed by law.',
      type: 'fact'
    });

    // Paragraph 4: Agreement on hearing timing (60-day waiting period)
    items.push({
      number: 4,
      content: 'I agree that this case may be heard at any time after the expiration of 60 days after the date the petition was filed.',
      type: 'fact'
    });

    // Paragraph 5: Acknowledgment of rights waived
    items.push({
      number: 5,
      content: 'I understand that I am giving up my right to be officially served with court papers in this case.',
      type: 'fact'
    });

    return items;
  }

  /**
   * Build plain-text representation of the document
   *
   * @param {Object} sections - Document sections
   * @returns {string} Plain text document
   * @private
   */
  _buildFullText(sections) {
    const lines = [];

    if (sections.header) lines.push(sections.header, '');
    if (sections.venue) lines.push(sections.venue, '');
    if (sections.caseCaption && sections.caseCaption.formatted) {
      lines.push(sections.caseCaption.formatted, '');
    }
    if (sections.title) lines.push(sections.title, '');

    if (sections.facts && sections.facts.items) {
      sections.facts.items.forEach(item => {
        lines.push(`${item.number}. ${item.content}`, '');
      });
    }

    if (sections.signatureBlock && sections.signatureBlock.formatted) {
      lines.push(sections.signatureBlock.formatted, '');
    }

    return lines.join('\n');
  }

  /**
   * Build HTML representation of the document
   *
   * @param {Object} sections - Document sections
   * @returns {string} HTML document
   * @private
   */
  _buildHtmlContent(sections) {
    const esc = (str) => {
      if (str == null) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    };

    const factRows = sections.facts && sections.facts.items
      ? sections.facts.items.map(f => `  <p class="fact">${f.number}. ${esc(f.content)}</p>`).join('\n')
      : '';

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Waiver of Service - Texas</title>
  <style>
    body { font-family: 'Times New Roman', serif; font-size: 12pt; line-height: 2; margin: 1in; color: #000; background: white; }
    .header { text-align: center; font-weight: bold; margin-bottom: 10px; }
    .venue { text-align: center; font-weight: bold; margin-bottom: 20px; }
    .case-caption { text-align: center; margin-bottom: 20px; white-space: pre-line; }
    .title { text-align: center; font-weight: bold; text-decoration: underline; margin: 20px 0; }
    .fact { margin-bottom: 15px; text-align: justify; }
    .signature-block { margin-top: 40px; margin-bottom: 30px; white-space: pre-line; }
    .notice { margin-top: 20px; padding: 12px; border: 1px solid #888; font-size: 10pt; font-style: italic; }
    @media print { body { margin: 0; padding: 1in; } }
  </style>
</head>
<body>
  ${sections.header ? `<div class="header">${esc(sections.header)}</div>` : ''}
  ${sections.venue ? `<div class="venue">${esc(sections.venue)}</div>` : ''}
  ${sections.caseCaption && sections.caseCaption.formatted ? `<div class="case-caption">${esc(sections.caseCaption.formatted)}</div>` : ''}
  ${sections.title ? `<div class="title">${esc(sections.title)}</div>` : ''}
${factRows}
  ${sections.signatureBlock && sections.signatureBlock.formatted ? `<div class="signature-block"><pre>${esc(sections.signatureBlock.formatted)}</pre></div>` : ''}
  <div class="notice">This Waiver of Service is executed pursuant to Tex. R. Civ. P. 119a. No notarization is required. By signing this document, Respondent voluntarily waives the right to formal service of citation.</div>
</body>
</html>`;
  }
}

module.exports = TexasWaiverOfServiceTemplate;
