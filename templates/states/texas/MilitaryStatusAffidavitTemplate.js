// templates/states/texas/MilitaryStatusAffidavitTemplate.js
// Texas Affidavit of Military Status (Non-Military Status Affidavit)
// Required before default judgment against a respondent
// Complies with Servicemembers Civil Relief Act (SCRA), 50 U.S.C. § 3931

const BaseAffidavitTemplate = require('../../core/BaseAffidavitTemplate');

/**
 * Valid values for the militaryStatus field
 * @typedef {'not_military'|'military'|'unknown'} MilitaryStatusValue
 */

/**
 * Texas Affidavit of Military Status Template
 *
 * LEGAL COMPLIANCE NOTES:
 * - Mandated by the Servicemembers Civil Relief Act (SCRA), 50 U.S.C. § 3931
 * - A court may not enter a default judgment against a defendant until the
 *   plaintiff files an affidavit stating whether or not the defendant is in
 *   military service (50 U.S.C. § 3931(b)(1))
 * - Failure to file this affidavit before a default judgment is a federal
 *   statutory violation and may result in the judgment being vacated
 * - The affiant must have personally performed the DMDC search or have
 *   personal knowledge of the respondent's military status
 * - This is a sworn affidavit — notarization is required
 * - Texas uses "CAUSE NO." rather than "CASE NO."
 * - No perjury statement required (Texas oath suffices per § 312.011)
 *
 * Recommended search method:
 * - Defense Manpower Data Center (DMDC) online database at scra.dmdc.osd.mil
 * - Search using respondent's full name AND Social Security Number (last 4) or DOB
 *
 * Legal References:
 * - 50 U.S.C. § 3931 - Protection of servicemembers against default judgments
 * - Tex. Civ. Prac. & Rem. Code § 18.002 - Statutory jurat format
 * - Tex. Gov't Code § 312.011 - Affidavit requirements
 *
 * @class TexasMilitaryStatusAffidavitTemplate
 * @extends BaseAffidavitTemplate
 */
class TexasMilitaryStatusAffidavitTemplate extends BaseAffidavitTemplate {
  constructor() {
    super();

    this.state = 'TX';
    this.stateName = 'Texas';
    this.documentTitle = 'AFFIDAVIT OF MILITARY STATUS';

    this.sections = {
      header: true,
      venue: true,
      caseCaption: true,
      title: true,
      introduction: true,
      competencyStatement: false, // Covered by first numbered fact item
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

    const petitioner = (data.affiantName || data.petitioner || '[PETITIONER NAME]').toUpperCase();
    const respondent = (data.respondentName || data.respondent || '[RESPONDENT NAME]').toUpperCase();

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
   * Document title per SCRA affidavit convention
   *
   * @returns {string} Document title
   */
  generateTitle() {
    return this.documentTitle;
  }

  /**
   * Sworn introduction — affiant is duly sworn
   *
   * @param {Object} data - Document data
   * @returns {string} Introduction text
   */
  generateIntroduction(data) {
    const name = data.affiantName || '[NAME]';
    return `I, ${name}, being duly sworn, depose and state as follows:`;
  }

  /**
   * Competency statement is suppressed; content is covered by the first numbered fact.
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
   * Affiant (petitioner) signature block
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
      'SWORN TO AND SUBSCRIBED before me on this _____ day of _____________, 20___.',
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
   * Texas-specific validation for Military Status Affidavit
   *
   * @param {Object} data - Document data
   * @returns {Object} Validation result
   */
  performStateSpecificValidation(data) {
    const errors = [];
    const warnings = [];

    if (!data.county || data.county.trim().length === 0) {
      errors.push('County is required for Texas Affidavit of Military Status');
    }

    if (!data.respondentName || data.respondentName.trim().length === 0) {
      errors.push('Respondent name is required for Affidavit of Military Status');
    }

    const validStatuses = ['not_military', 'military', 'unknown'];
    if (!data.militaryStatus || !validStatuses.includes(data.militaryStatus)) {
      warnings.push(
        'Military status must be one of: "not_military", "military", or "unknown". ' +
        'A placeholder will be used if not specified.'
      );
    }

    if (!data.searchDate || data.searchDate.trim().length === 0) {
      warnings.push('Search date should be provided; it documents when the DMDC search was performed');
    }

    if (!data.searchMethod || data.searchMethod.trim().length === 0) {
      warnings.push(
        'Search method should be specified (e.g., "Defense Manpower Data Center (DMDC) online database at scra.dmdc.osd.mil")'
      );
    }

    if (!data.caseNumber) {
      warnings.push('Cause number should be included for proper court filing identification');
    }

    return { errors, warnings };
  }

  /**
   * Generate the complete Affidavit of Military Status document
   *
   * @param {Object} data - Document data
   * @param {string}                data.affiantName         - Full legal name of petitioner/affiant
   * @param {string}                data.county              - County where suit is pending
   * @param {string}                data.state               - State (should be "Texas")
   * @param {string}                [data.caseNumber]        - Cause number
   * @param {string}                [data.courtName]         - Court name
   * @param {string}                [data.respondentName]    - Full legal name of respondent
   * @param {string}                [data.respondentDOB]     - Respondent's date of birth (optional, for search documentation)
   * @param {string}                [data.respondentSSNLast4]- Last 4 digits of respondent's SSN (optional, for search documentation)
   * @param {MilitaryStatusValue}   [data.militaryStatus]    - Result of DMDC search: 'not_military', 'military', or 'unknown'
   * @param {string}                [data.searchDate]        - Date on which the DMDC search was performed
   * @param {string}                [data.searchMethod]      - Description of search method used
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

    const factItems = this._buildMilitaryStatusFacts(data);
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
   * Build the military status finding paragraph based on the search result.
   * Returns the appropriate statutory-language sentence for the given status.
   *
   * @param {MilitaryStatusValue} militaryStatus - The result of the DMDC search
   * @param {string} respondentName - Full name of the respondent
   * @returns {string} Military status finding text
   * @private
   */
  _buildStatusFinding(militaryStatus, respondentName) {
    const name = respondentName || '[RESPONDENT NAME]';

    switch (militaryStatus) {
      case 'not_military':
        return (
          `Based on my search, ${name} is NOT currently a member of the United States ` +
          `Armed Forces, National Guard, or other branch of military service.`
        );

      case 'military':
        return (
          `Based on my search, ${name} IS currently a member of the United States Armed ` +
          `Forces. The provisions of the Servicemembers Civil Relief Act (50 U.S.C. § 3931) ` +
          `may apply.`
        );

      case 'unknown':
        return (
          `I was unable to definitively determine the military status of ${name} based on ` +
          `the information available to me.`
        );

      default:
        return (
          `[MILITARY STATUS FINDING: State whether ${name} is NOT currently a member of ` +
          `the United States Armed Forces, IS currently a member, or whether military status ` +
          `could not be determined.]`
        );
    }
  }

  /**
   * Build the numbered fact items for the Military Status Affidavit
   *
   * @param {Object} data - Document data
   * @returns {Array} Array of numbered fact objects
   * @private
   */
  _buildMilitaryStatusFacts(data) {
    const affiantName = data.affiantName || '[PETITIONER NAME]';
    const respondentName = data.respondentName || '[RESPONDENT NAME]';
    const searchDate = data.searchDate ? data.searchDate.trim() : '[DATE OF SEARCH]';
    const searchMethod = data.searchMethod
      ? data.searchMethod.trim()
      : 'Defense Manpower Data Center (DMDC) online database at scra.dmdc.osd.mil';

    const items = [];

    // Fact 1: Affiant identity and personal knowledge
    items.push({
      number: 1,
      content: (
        `I, ${affiantName}, am the Petitioner in this case, and I have personal knowledge ` +
        `of the facts stated herein.`
      ),
      type: 'fact'
    });

    // Fact 2: Respondent identity (with optional DOB / SSN-last-4 for documentation)
    let respondentIdentityText = `The Respondent in this case is ${respondentName}.`;
    const identifiers = [];
    if (data.respondentDOB && data.respondentDOB.trim()) {
      identifiers.push(`date of birth: ${data.respondentDOB.trim()}`);
    }
    if (data.respondentSSNLast4 && data.respondentSSNLast4.toString().trim()) {
      identifiers.push(`last four digits of Social Security Number: XXX-XX-${data.respondentSSNLast4.toString().trim()}`);
    }
    if (identifiers.length > 0) {
      respondentIdentityText += ` For purposes of the DMDC search, the following identifying information was used: ${identifiers.join('; ')}.`;
    }

    items.push({
      number: 2,
      content: respondentIdentityText,
      type: 'fact'
    });

    // Fact 3: Search performed — date and method
    items.push({
      number: 3,
      content: (
        `On ${searchDate}, I searched the ${searchMethod} to determine whether ` +
        `${respondentName} is a member of the United States Armed Forces.`
      ),
      type: 'fact'
    });

    // Fact 4: Military status finding
    const statusFinding = this._buildStatusFinding(data.militaryStatus, respondentName);
    items.push({
      number: 4,
      content: statusFinding,
      type: 'fact'
    });

    // Fact 5: Statutory purpose
    items.push({
      number: 5,
      content: (
        `I make this affidavit for the purpose of complying with the requirements of the ` +
        `Servicemembers Civil Relief Act, 50 U.S.C. § 3931.`
      ),
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
  <title>Affidavit of Military Status - Texas</title>
  <style>
    body { font-family: 'Times New Roman', serif; font-size: 12pt; line-height: 2; margin: 1in; color: #000; background: white; }
    .header { text-align: center; font-weight: bold; margin-bottom: 10px; }
    .venue { text-align: center; font-weight: bold; margin-bottom: 20px; }
    .case-caption { text-align: center; margin-bottom: 20px; white-space: pre-line; }
    .title { text-align: center; font-weight: bold; text-decoration: underline; margin: 20px 0; }
    .fact { margin-bottom: 15px; text-align: justify; }
    .signature-block { margin-top: 40px; margin-bottom: 30px; white-space: pre-line; }
    .notary-block { margin-top: 30px; padding: 20px; border: 2px solid #000; white-space: pre-line; background-color: #f9f9f9; }
    .scra-notice { margin-top: 20px; padding: 12px; border: 1px solid #888; font-size: 10pt; font-style: italic; }
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
  <div class="scra-notice">This affidavit is required by the Servicemembers Civil Relief Act, 50 U.S.C. § 3931, prior to entry of a default judgment. The search should be performed at the Defense Manpower Data Center (DMDC) website: scra.dmdc.osd.mil. Retain a copy of the DMDC search certificate as an exhibit to this affidavit.</div>
</body>
</html>`;
  }
}

module.exports = TexasMilitaryStatusAffidavitTemplate;
