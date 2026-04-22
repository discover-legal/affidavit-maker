// templates/states/delaware/AffidavitTemplate.js
// Delaware Affidavit Template — LEGALLY COMPLIANT v1.0
// Governing Law: Del. Code tit. 29, §4301 (Delaware Notaries Public — oath authority and notarial acts),
//                Del. Code tit. 11, §1221 (perjury)

const BaseAffidavitTemplate = require('../../core/BaseAffidavitTemplate');

/**
 * Delaware Affidavit Template — LEGALLY COMPLIANT v1.0
 *
 * COMPLIANCE NOTES:
 * - Perjury statement REQUIRED — notary oath authority per Del. Code tit. 29, §4301;
 *   criminal perjury penalty under Del. Code tit. 11, §1221
 * - County is REQUIRED for Delaware affidavits
 * - Case number label: "PETITION NO."
 * - Header: "STATE OF DELAWARE"
 * - Venue: "County of [County]" (title case per Delaware practice)
 * - Notary block per Del. Code tit. 29, §4301; notary designated as "Notary Public, State of Delaware"
 * - Notary may administer oath or affirmation (subscribed and sworn/affirmed)
 * - Exhibits labeled with letters (A, B, C)
 *
 * @class DelawareAffidavitTemplate
 * @extends BaseAffidavitTemplate
 */
class DelawareAffidavitTemplate extends BaseAffidavitTemplate {
  constructor() {
    super();

    this.metadata = require('./metadata.json');
    this.state = this.metadata.stateCode;
    this.stateName = this.metadata.stateName;
    this.requiredFields = this.metadata.requiredFields;

    // Delaware requires perjury statement — notary oath authority per Del. Code tit. 29, §4301;
    // criminal perjury penalty per Del. Code tit. 11, §1221
    this.sections.perjuryStatement = true;
  }

  /**
   * Delaware-specific case caption using "PETITION NO." terminology
   *
   * @param {Object} affidavitData - The affidavit data
   * @returns {Object} Case caption with formatted text
   */
  generateCaseCaption(affidavitData) {
    let caption = '';

    let courtName = affidavitData.court || affidavitData.courtName || '[COURT NAME]';
    courtName = courtName.toUpperCase();

    caption += `IN THE ${courtName}\n\n`;

    const caseNumber = affidavitData.caseNumber || '[CASE NUMBER]';
    caption += `PETITION NO. ${caseNumber.toUpperCase()}\n\n`;

    const plaintiff = affidavitData.plaintiff || '[PLAINTIFF NAME]';
    const defendant = affidavitData.defendant || '[DEFENDANT NAME]';

    caption += `${plaintiff.toUpperCase()},\n`;
    caption += `    Petitioner,\n\n`;
    caption += `v.\n\n`;
    caption += `${defendant.toUpperCase()},\n`;
    caption += `    Respondent.`;

    return {
      courtName,
      caseNumber: affidavitData.caseNumber,
      plaintiff: affidavitData.plaintiff,
      defendant: affidavitData.defendant,
      formatted: caption
    };
  }

  /**
   * Delaware header — "STATE OF DELAWARE"
   *
   * @returns {string} Header text
   */
  generateHeader() {
    return 'STATE OF DELAWARE';
  }

  /**
   * Delaware venue — "County of [County]" (title case per Delaware practice)
   *
   * @param {string} county - County name
   * @returns {string} Venue text
   */
  generateVenue(county) {
    const countyName = county || '[COUNTY]';
    // Delaware uses title case for venue
    const countyFormatted = countyName.charAt(0).toUpperCase() + countyName.slice(1).toLowerCase();
    return `County of ${countyFormatted}`;
  }

  /**
   * Delaware-specific validation
   *
   * @param {Object} affidavitData - The affidavit data to validate
   * @returns {Object} Validation result with errors and warnings
   */
  performStateSpecificValidation(affidavitData) {
    const errors = [];
    const warnings = [];

    // County is REQUIRED for Delaware affidavits
    if (!affidavitData.county || affidavitData.county.trim().length === 0) {
      errors.push('County is required for Delaware affidavits');
    }

    return { errors, warnings };
  }

  /**
   * Delaware notary block per Del. Code tit. 29, §4301
   * Supports both oath and affirmation
   *
   * @param {Object} affidavitData - The affidavit data
   * @returns {string} Notary block text
   */
  generateNotaryBlock(affidavitData) {
    return `Subscribed and sworn to (or affirmed) before me this _____ day of _______________, 20___.


_________________________________
Notary Public, State of Delaware

My commission expires: ___________

[NOTARY SEAL]`;
  }

  /**
   * Delaware perjury statement
   * Notary oath authority: Del. Code tit. 29, §4301; perjury penalty: Del. Code tit. 11, §1221
   *
   * @returns {string} Perjury statement text
   */
  generatePerjuryStatement() {
    return `I declare under penalty of perjury under the laws of the State of Delaware that the foregoing is true and correct.`;
  }

  /**
   * Delaware exhibit rules — letters, cover page required
   *
   * @returns {Object} Exhibit formatting rules
   */
  getExhibitRules() {
    return {
      labelStyle: 'letters',
      requireCoverPage: true,
      coverPageFormat: {
        title: 'EXHIBIT [LABEL]',
        centered: true,
        description: true
      },
      allowedFormats: ['PDF', 'JPG', 'PNG'],
      maxFileSize: 25 * 1024 * 1024,
      maxTotalSize: 100 * 1024 * 1024,
      instructions: 'Label exhibits sequentially (Exhibit A, Exhibit B, etc.) and reference each in the body of the affidavit. Attach exhibits at the end of the document.'
    };
  }
}

module.exports = DelawareAffidavitTemplate;
