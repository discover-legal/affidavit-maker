// templates/states/texas/CertLastKnownAddressTemplate.js
// Texas Certificate of Last Known Address
// Complies with Tex. R. Civ. P. 3a (effective 2021) and Tex. Fam. Code § 102.009

const BaseAffidavitTemplate = require('../../core/BaseAffidavitTemplate');
const { captionUpper } = require('../../core/nameCase');

/**
 * Texas Certificate of Last Known Address Template
 *
 * LEGAL COMPLIANCE NOTES:
 * - Governed by Tex. R. Civ. P. 3a (effective January 1, 2021) and
 *   Tex. Fam. Code § 102.009 (for family law proceedings)
 * - Rule 3a requires the petitioner to file a certificate stating the last
 *   known address of each party who has not yet appeared in the case,
 *   as a prerequisite for service by publication or posting
 * - This document is a sworn affidavit (requires notarization) because the
 *   petitioner attests under oath that the information is true and correct
 *   and that reasonable efforts to locate the respondent have been made
 * - Texas uses "CAUSE NO." rather than "CASE NO."
 * - County is required; court name and cause number are expected
 *
 * Legal References:
 * - Tex. R. Civ. P. 3a - Certificate of Last Known Address
 * - Tex. Fam. Code § 102.009 - Service by Publication (family law)
 * - Tex. R. Civ. P. 109 - Service by Publication
 * - Tex. R. Civ. P. 109a - Service by Posting
 * - Tex. Civ. Prac. & Rem. Code § 18.002 - Statutory jurat format
 *
 * @class TexasCertLastKnownAddressTemplate
 * @extends BaseAffidavitTemplate
 */
class TexasCertLastKnownAddressTemplate extends BaseAffidavitTemplate {
  constructor() {
    super();

    this.state = 'TX';
    this.stateName = 'Texas';
    this.documentTitle = 'CERTIFICATE OF LAST KNOWN ADDRESS';

    this.sections = {
      header: true,
      venue: true,
      caseCaption: true,
      title: true,
      introduction: true,
      competencyStatement: false, // Covered by the sworn introduction
      facts: true,
      conclusion: true,
      perjuryStatement: false,    // Texas sworn affidavit — oath suffices per § 312.011
      signatureBlock: true,
      notaryBlock: true,          // Sworn affidavit — notarization required
      footer: true
    };

    this.requiredFields = ['affiantName', 'state', 'county'];

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

    // captionUpper preserves McPherson/DiCaprio style internal capitals.
    const petitioner = captionUpper(data.affiantName || data.petitioner || '[PETITIONER NAME]');
    const respondent = captionUpper(data.respondentName || data.respondent || '[RESPONDENT NAME]');

    caption += `${petitioner}\n`;
    caption += `Petitioner,\n\n`;
    caption += `V.\n\n`;
    caption += `${respondent}\n`;
    caption += `Respondent`;

    return {
      courtName,
      caseNumber: data.caseNumber,
      petitioner: data.affiantName || data.petitioner,
      respondent: data.respondentName || data.respondent,
      formatted: caption
    };
  }

  /**
   * Document title per Tex. R. Civ. P. 3a convention
   *
   * @returns {string} Document title
   */
  generateTitle() {
    return this.documentTitle;
  }

  /**
   * Sworn introduction — petitioner is duly sworn and attests under oath
   *
   * @param {Object} data - Document data
   * @returns {string} Introduction text
   */
  generateIntroduction(data) {
    const name = data.affiantName || '[NAME]';
    return `I, ${name}, being duly sworn, depose and state as follows:`;
  }

  /**
   * Competency statement is suppressed; content is covered by the sworn introduction
   * and the first numbered fact item.
   *
   * @returns {null}
   */
  generateCompetencyStatement() {
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
   * Standard Texas conclusion
   *
   * @returns {string} Conclusion text
   */
  generateConclusion() {
    return 'Further, Affiant sayeth not.';
  }

  /**
   * No perjury statement for Texas sworn affidavits — oath suffices per § 312.011
   *
   * @returns {null}
   */
  generatePerjuryStatement() {
    return null;
  }

  /**
   * Affiant signature block
   *
   * @param {string} affiantName - Full name of affiant
   * @returns {Object} Signature block object
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
   * Texas statutory notary/jurat block per Tex. Civ. Prac. & Rem. Code § 18.002
   *
   * @param {Object} data - Document data
   * @returns {string} Notary block text
   */
  generateNotaryBlock(data) {
    return [
      `SWORN TO AND SUBSCRIBED before me on this _____ day of _____________, 20___.`,
      '',
      '',
      '_________________________________',
      'Notary Public, State of Texas',
      '',
      'Notary\'s printed name: _______________________',
      '',
      'My commission expires: ___________'
    ].join('\n');
  }

  /**
   * Texas-specific validation for Certificate of Last Known Address
   *
   * @param {Object} data - Document data
   * @returns {Object} Validation result
   */
  performStateSpecificValidation(data) {
    const errors = [];
    const warnings = [];

    if (!data.county || data.county.trim().length === 0) {
      errors.push('County is required for Texas Certificate of Last Known Address');
    }

    if (!data.respondentName || data.respondentName.trim().length === 0) {
      errors.push('Respondent name is required for Certificate of Last Known Address');
    }

    if (!data.lastKnownAddress || data.lastKnownAddress.trim().length === 0) {
      warnings.push('Last known address of Respondent should be provided, or state "unknown" if address is completely unknown');
    }

    if (!data.lastContactDate || data.lastContactDate.trim().length === 0) {
      warnings.push('Last contact date should be provided to demonstrate recency of knowledge');
    }

    if (!data.caseNumber) {
      warnings.push('Cause number should be included for proper court filing identification');
    }

    return { errors, warnings };
  }

  /**
   * Generate the complete Certificate of Last Known Address document
   *
   * @param {Object} data - Document data
   * @param {string}  data.affiantName         - Full legal name of petitioner/affiant
   * @param {string}  data.county              - County where suit is pending
   * @param {string}  data.state               - State (should be "Texas")
   * @param {string}  [data.caseNumber]        - Cause number
   * @param {string}  [data.courtName]         - Court name
   * @param {string}  [data.respondentName]    - Full legal name of respondent
   * @param {string}  [data.lastKnownAddress]  - Street address
   * @param {string}  [data.lastKnownCity]     - City
   * @param {string}  [data.lastKnownState]    - State abbreviation (e.g., "TX")
   * @param {string}  [data.lastKnownZip]      - ZIP code
   * @param {string}  [data.lastContactDate]   - Date of last contact or knowledge of address
   * @returns {Object} Complete document structure
   */
  generateDocument(data = {}) {
    const validation = this.validateData(data);

    // eslint-disable-next-line global-require
    const { randomUUID: uuidv4 } = require('node:crypto');
    const id = uuidv4();

    const header = this.generateHeader();
    const venue = this.generateVenue(data.county);
    const caseCaption = this.generateCaseCaption(data);
    const title = this.generateTitle();
    const introduction = this.generateIntroduction(data);

    const factItems = this._buildCertificateFacts(data);
    const facts = { items: factItems };

    const conclusion = this.generateConclusion();
    const signatureBlock = this.generateSignatureBlock(data.affiantName);
    const notaryBlock = this.generateNotaryBlock(data);
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
        perjuryStatement: null,
        signatureBlock,
        notaryBlock,
        footer
      },
      fullText: this._buildFullText({
        header, venue, caseCaption, title, introduction,
        facts, conclusion, signatureBlock, notaryBlock
      }),
      htmlContent: this._buildHtmlContent({
        header, venue, caseCaption, title, introduction,
        facts, conclusion, signatureBlock, notaryBlock
      }),
      validation,
      formatting: this.formatting
    };
  }

  /**
   * Build the numbered fact items for the certificate
   *
   * @param {Object} data - Document data
   * @returns {Array} Array of numbered fact objects
   * @private
   */
  _buildCertificateFacts(data) {
    const affiantName = data.affiantName || '[PETITIONER NAME]';
    const respondentName = data.respondentName || '[RESPONDENT NAME]';

    // Build the last known address string
    const address = data.lastKnownAddress ? data.lastKnownAddress.trim() : '[STREET ADDRESS]';
    const city = data.lastKnownCity ? data.lastKnownCity.trim() : '[CITY]';
    const addrState = data.lastKnownState ? data.lastKnownState.trim().toUpperCase() : '[STATE]';
    const zip = data.lastKnownZip ? data.lastKnownZip.trim() : '[ZIP]';
    const fullAddress = `${address}, ${city}, ${addrState} ${zip}`;

    const lastContactDate = data.lastContactDate
      ? data.lastContactDate.trim()
      : '[DATE]';

    const items = [];

    // Fact 1: Petitioner status
    items.push({
      number: 1,
      content: `I, ${affiantName}, am the Petitioner in this case.`,
      type: 'fact'
    });

    // Fact 2: Last known address of Respondent
    items.push({
      number: 2,
      content: `The last known address of ${respondentName}, Respondent, is: ${fullAddress}.`,
      type: 'fact'
    });

    // Fact 3: Date of last contact
    items.push({
      number: 3,
      content: `The last time I had contact with or knowledge of the Respondent's address was on or about ${lastContactDate}.`,
      type: 'fact'
    });

    // Fact 4: Reasonable efforts to locate
    items.push({
      number: 4,
      content: `I have made reasonable efforts to determine the Respondent's current address and am unable to do so.`,
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
    if (sections.introduction) lines.push(sections.introduction, '');

    if (sections.facts && sections.facts.items) {
      sections.facts.items.forEach(item => {
        lines.push(`${item.number}. ${item.content}`, '');
      });
    }

    if (sections.conclusion) lines.push(sections.conclusion, '');
    if (sections.signatureBlock && sections.signatureBlock.formatted) {
      lines.push(sections.signatureBlock.formatted, '');
    }
    if (sections.notaryBlock) lines.push(sections.notaryBlock, '');

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
  <title>Certificate of Last Known Address - Texas</title>
  <style>
    body { font-family: 'Times New Roman', serif; font-size: 12pt; line-height: 2; margin: 1in; color: #000; background: white; }
    .header { text-align: center; font-weight: bold; margin-bottom: 10px; }
    .venue { text-align: center; font-weight: bold; margin-bottom: 20px; }
    .case-caption { text-align: center; margin-bottom: 20px; white-space: pre-line; }
    .title { text-align: center; font-weight: bold; text-decoration: underline; margin: 20px 0; }
    .fact { margin-bottom: 15px; text-align: justify; }
    .signature-block { margin-top: 40px; margin-bottom: 30px; white-space: pre-line; }
    .notary-block { margin-top: 30px; padding: 20px; border: 2px solid #000; white-space: pre-line; background-color: #f9f9f9; }
    @media print { body { margin: 0; padding: 1in; } .notary-block { background-color: #f0f0f0; } }
  </style>
</head>
<body>
  ${sections.header ? `<div class="header">${esc(sections.header)}</div>` : ''}
  ${sections.venue ? `<div class="venue">${esc(sections.venue)}</div>` : ''}
  ${sections.caseCaption && sections.caseCaption.formatted ? `<div class="case-caption">${esc(sections.caseCaption.formatted)}</div>` : ''}
  ${sections.title ? `<div class="title">${esc(sections.title)}</div>` : ''}
  ${sections.introduction ? `<p>${esc(sections.introduction)}</p>` : ''}
${factRows}
  ${sections.conclusion ? `<p>${esc(sections.conclusion)}</p>` : ''}
  ${sections.signatureBlock && sections.signatureBlock.formatted ? `<div class="signature-block"><pre>${esc(sections.signatureBlock.formatted)}</pre></div>` : ''}
  ${sections.notaryBlock ? `<div class="notary-block"><pre>${esc(sections.notaryBlock)}</pre></div>` : ''}
</body>
</html>`;
  }
}

module.exports = TexasCertLastKnownAddressTemplate;
