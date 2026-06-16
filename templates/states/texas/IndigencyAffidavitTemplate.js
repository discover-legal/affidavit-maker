// templates/states/texas/IndigencyAffidavitTemplate.js
// Texas Statement of Inability to Afford Payment of Court Costs
// Complies with Tex. R. Civ. P. 145 (amended 2016) and Texas Supreme Court
// Misc. Docket No. 15-9171

const BaseAffidavitTemplate = require('../../core/BaseAffidavitTemplate');

/**
 * Texas Statement of Inability to Afford Payment of Court Costs
 *
 * LEGAL COMPLIANCE NOTES:
 * - Governed by Tex. R. Civ. P. 145 (as amended effective 2016)
 * - Texas Supreme Court Misc. Docket No. 15-9171 adopted the current form
 * - Uses an UNSWORN DECLARATION under penalty of perjury (not a notarized affidavit)
 *   per Tex. Civ. Prac. & Rem. Code § 132.001 (unsworn declaration in lieu of affidavit)
 * - Rule 145 expressly permits the unsworn declaration form for indigency statements
 * - NO notary block required or appropriate for this document type
 * - County/court case caption is optional but included when provided
 * - Declarant must personally sign; no notarization needed
 *
 * Legal References:
 * - Tex. R. Civ. P. 145 - Statement of Inability to Afford Payment of Court Costs
 * - Tex. Civ. Prac. & Rem. Code § 132.001 - Unsworn Declaration
 * - Texas Supreme Court Misc. Docket No. 15-9171 (2016 amendment)
 *
 * @class TexasIndigencyAffidavitTemplate
 * @extends BaseAffidavitTemplate
 */
class TexasIndigencyAffidavitTemplate extends BaseAffidavitTemplate {
  constructor() {
    super();

    this.state = 'TX';
    this.stateName = 'Texas';
    this.documentTitle = 'STATEMENT OF INABILITY TO AFFORD PAYMENT OF COURT COSTS OR AN APPEAL BOND';

    // This document uses an unsworn declaration, not a sworn affidavit
    this.sections = {
      header: true,
      venue: true,
      caseCaption: true,
      title: true,
      introduction: true,
      competencyStatement: false, // Not used - covered by opening declaration
      facts: true,
      conclusion: false,         // Not used - prayer is last fact item
      perjuryStatement: true,    // Tex. Civ. Prac. & Rem. Code § 132.001 unsworn declaration
      signatureBlock: true,
      notaryBlock: false,        // Rule 145 does NOT require notarization
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

    // Party identifiers: affiant is the party filing; respondent/opposing party may or may not be known
    const petitioner = (data.petitioner || data.affiantName || '[PETITIONER/PLAINTIFF NAME]').toUpperCase();
    const respondent = (data.respondent || data.defendant || '[RESPONDENT/DEFENDANT NAME]').toUpperCase();

    caption += `${petitioner}\n\n`;
    caption += `V.\n\n`;
    caption += `${respondent}`;

    return {
      courtName,
      caseNumber: data.caseNumber,
      petitioner: data.petitioner || data.affiantName,
      respondent: data.respondent || data.defendant,
      formatted: caption
    };
  }

  /**
   * Per Tex. R. Civ. P. 145, the title is prescribed by the rule
   *
   * @returns {string} Document title
   */
  generateTitle() {
    return this.documentTitle;
  }

  /**
   * Introduction paragraph for Rule 145 unsworn declaration
   * Uses perjury declaration language per Tex. Civ. Prac. & Rem. Code § 132.001
   *
   * @param {Object} data - Document data
   * @returns {string} Introduction text
   */
  generateIntroduction(data) {
    const name = data.affiantName || '[NAME]';
    return `I, ${name}, declare under penalty of perjury that the following is true and correct:`;
  }

  /**
   * Competency statement is not separately numbered for this document type;
   * the opening declaration covers it. Return null to suppress it.
   *
   * @returns {null}
   */
  generateCompetencyStatement() {
    return null;
  }

  /**
   * Process facts for this document. Because the competency statement is suppressed,
   * numbering starts at 1.
   *
   * @param {Array} facts - Array of fact objects or strings
   * @returns {Array} Processed fact objects
   */
  processFactsForDocument(facts) {
    if (!Array.isArray(facts)) return [];

    const processedFacts = [];
    let factNumber = 1; // Start at 1 (no preceding competency statement)

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
   * Generate the unsworn perjury declaration closing per Tex. Civ. Prac. & Rem. Code § 132.001
   * This replaces the notary block for Rule 145 documents.
   *
   * @returns {string} Unsworn declaration closing
   */
  generatePerjuryStatement() {
    return [
      'I declare under penalty of perjury that the foregoing is true and correct.',
      '',
      'Executed on _____________________, 20___, in _________________________ County, Texas.'
    ].join('\n');
  }

  /**
   * Signature block for the declarant (not labeled "Affiant" for this document type)
   *
   * @param {string} affiantName - Name of declarant
   * @returns {Object} Signature block
   */
  generateSignatureBlock(affiantName) {
    const name = affiantName || '[NAME]';
    return {
      line: '_________________________________',
      name,
      title: 'Declarant',
      formatted: `_________________________________\n${name}\nDeclarant\n\nAddress: ________________________________\n\n________________________________\n\nPhone: ________________________________`
    };
  }

  /**
   * No notary block for Rule 145 Statement of Inability — returns null
   *
   * @returns {null}
   */
  generateNotaryBlock() {
    return null;
  }

  /**
   * No separate conclusion paragraph; the prayer is the last numbered fact item
   *
   * @returns {null}
   */
  generateConclusion() {
    return null;
  }

  /**
   * Texas-specific validation for indigency statement
   *
   * @param {Object} data - Document data
   * @returns {Object} Validation result
   */
  performStateSpecificValidation(data) {
    const errors = [];
    const warnings = [];

    if (!data.county || data.county.trim().length === 0) {
      errors.push('County is required for Texas Statement of Inability to Afford Payment of Court Costs');
    }

    if (data.monthlyIncome === undefined || data.monthlyIncome === null) {
      warnings.push('Monthly income should be provided for a complete Rule 145 statement');
    }

    if (data.monthlyExpenses === undefined || data.monthlyExpenses === null) {
      warnings.push('Monthly expenses should be provided for a complete Rule 145 statement');
    }

    if (data.dependents === undefined || data.dependents === null) {
      warnings.push('Number of dependents should be stated per Rule 145 requirements');
    }

    return { errors, warnings };
  }

  /**
   * Generate the complete indigency statement document
   *
   * @param {Object} data - Document data
   * @param {string}  data.affiantName      - Full legal name of declarant
   * @param {string}  data.county           - County where suit is pending
   * @param {string}  data.state            - State (should be "Texas")
   * @param {string}  [data.caseNumber]     - Cause number (if assigned)
   * @param {string}  [data.courtName]      - Court name
   * @param {number}  [data.monthlyIncome]  - Gross monthly income in dollars
   * @param {string}  [data.incomeSource]   - Description of income sources
   * @param {number}  [data.monthlyExpenses]- Total monthly expenses in dollars
   * @param {string}  [data.expenseDetails] - Description of major expense categories
   * @param {string}  [data.assets]         - Description of property and bank accounts
   * @param {number}  [data.dependents]     - Number of persons dependent on declarant
   * @param {string}  [data.reason]         - Narrative explanation of inability to pay
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

    // Build numbered fact items
    const factItems = this._buildIndigencyFacts(data);

    const facts = { items: factItems };

    const perjuryStatement = this.generatePerjuryStatement();

    const signatureBlock = this.generateSignatureBlock(data.affiantName);

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
        conclusion: null,
        perjuryStatement,
        signatureBlock,
        notaryBlock: null,
        footer
      },
      fullText: this._buildFullText({
        header, venue, caseCaption, title, introduction,
        facts, perjuryStatement, signatureBlock
      }),
      htmlContent: this._buildHtmlContent({
        header, venue, caseCaption, title, introduction,
        facts, perjuryStatement, signatureBlock
      }),
      validation,
      formatting: this.formatting
    };
  }

  /**
   * Build the numbered fact items for the indigency statement
   *
   * @param {Object} data - Document data
   * @returns {Array} Array of numbered fact objects
   * @private
   */
  _buildIndigencyFacts(data) {
    const affiantName = data.affiantName || '[NAME]';
    const items = [];
    let n = 1;

    // Fact 1: Party status and inability to pay
    items.push({
      number: n++,
      content: 'I am a party in this case and I cannot afford to pay the fees and costs of court or an appeal bond.',
      type: 'fact'
    });

    // Fact 2: Monthly income
    const incomeSource = data.incomeSource
      ? data.incomeSource.trim()
      : '[describe sources, e.g., employment, government assistance, self-employment]';

    const incomeAmt = (data.monthlyIncome !== undefined && data.monthlyIncome !== null)
      ? `$${Number(data.monthlyIncome).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : '$[AMOUNT]';

    items.push({
      number: n++,
      content: `My gross monthly income is ${incomeAmt} per month. My income comes from the following sources: ${incomeSource}.`,
      type: 'fact'
    });

    // Fact 3: Monthly expenses
    const expenseDetails = data.expenseDetails
      ? data.expenseDetails.trim()
      : '[describe major expense categories, e.g., rent/mortgage, utilities, food, transportation, medical]';

    const expenseAmt = (data.monthlyExpenses !== undefined && data.monthlyExpenses !== null)
      ? `$${Number(data.monthlyExpenses).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : '$[AMOUNT]';

    items.push({
      number: n++,
      content: `My total monthly expenses are approximately ${expenseAmt} per month. My expenses include the following: ${expenseDetails}.`,
      type: 'fact'
    });

    // Fact 4: Assets
    const assets = data.assets
      ? data.assets.trim()
      : '[describe real property, vehicles, bank accounts, and other significant assets, or state "none"]';

    items.push({
      number: n++,
      content: `I own the following property and assets: ${assets}.`,
      type: 'fact'
    });

    // Fact 5: Dependents
    const depCount = (data.dependents !== undefined && data.dependents !== null)
      ? Number(data.dependents)
      : null;

    const depStatement = depCount === null
      ? `I have [NUMBER] person(s) who are financially dependent upon me, including myself.`
      : depCount === 0
        ? `I have no persons other than myself who are financially dependent upon me.`
        : `I have ${depCount} person${depCount === 1 ? '' : 's'} who ${depCount === 1 ? 'is' : 'are'} financially dependent upon me, including myself.`;

    items.push({
      number: n++,
      content: depStatement,
      type: 'fact'
    });

    // Optional: Reason / additional narrative
    if (data.reason && data.reason.trim()) {
      items.push({
        number: n++,
        content: data.reason.trim(),
        type: 'fact'
      });
    }

    // Final item: Prayer for relief
    items.push({
      number: n++,
      content: `I, ${affiantName}, respectfully request that this Court declare me unable to afford the fees and costs of court and waive their payment, pursuant to Rule 145 of the Texas Rules of Civil Procedure.`,
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

    if (sections.perjuryStatement) lines.push(sections.perjuryStatement, '');
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
  <title>Statement of Inability to Afford Payment of Court Costs - Texas</title>
  <style>
    body { font-family: 'Times New Roman', serif; font-size: 12pt; line-height: 2; margin: 1in; color: #000; background: white; }
    .header { text-align: center; font-weight: bold; margin-bottom: 10px; }
    .venue { text-align: center; font-weight: bold; margin-bottom: 20px; }
    .case-caption { text-align: center; margin-bottom: 20px; white-space: pre-line; }
    .title { text-align: center; font-weight: bold; text-decoration: underline; margin: 20px 0; }
    .fact { margin-bottom: 15px; text-align: justify; }
    .perjury-statement { margin-top: 30px; margin-bottom: 20px; white-space: pre-line; }
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
  ${sections.introduction ? `<p>${esc(sections.introduction)}</p>` : ''}
${factRows}
  ${sections.perjuryStatement ? `<div class="perjury-statement">${esc(sections.perjuryStatement)}</div>` : ''}
  ${sections.signatureBlock && sections.signatureBlock.formatted ? `<div class="signature-block"><pre>${esc(sections.signatureBlock.formatted)}</pre></div>` : ''}
  <div class="notice">This document is a Statement of Inability to Afford Payment of Court Costs pursuant to Tex. R. Civ. P. 145. No notarization is required. The declarant's signature under penalty of perjury satisfies the requirements of Tex. Civ. Prac. &amp; Rem. Code § 132.001.</div>
</body>
</html>`;
  }
}

module.exports = TexasIndigencyAffidavitTemplate;
