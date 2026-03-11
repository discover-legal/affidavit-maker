// templates/states/kentucky/AffidavitTemplate.js
// Kentucky Affidavit Template — LEGALLY COMPLIANT v1.0
// Governing Law: KRS 423 (Kentucky Notarial Acts — oath authority and notarial acts),
//                KRS 523.020 (perjury in the first degree)

const BaseAffidavitTemplate = require('../../core/BaseAffidavitTemplate');

/**
 * Kentucky Affidavit Template — LEGALLY COMPLIANT v1.0
 *
 * COMPLIANCE NOTES:
 * - Perjury statement REQUIRED — notary oath authority per KRS 423;
 *   criminal perjury penalty under KRS 523.020
 * - County is REQUIRED for Kentucky affidavits
 * - Case number label: "CASE NO."
 * - Header: "COMMONWEALTH OF KENTUCKY" (Kentucky is a Commonwealth)
 * - Venue: "County of [County]" (title case per Kentucky practice)
 * - Notary block per KRS 423; notary designated as "Notary Public, Commonwealth of Kentucky"
 * - Notary may administer oath or affirmation (subscribed and sworn/affirmed)
 * - Exhibits labeled with letters (A, B, C)
 *
 * @class KentuckyAffidavitTemplate
 * @extends BaseAffidavitTemplate
 */
class KentuckyAffidavitTemplate extends BaseAffidavitTemplate {
  constructor() {
    super();

    this.metadata = require('./metadata.json');
    this.state = this.metadata.stateCode;
    this.stateName = this.metadata.stateName;
    this.requiredFields = this.metadata.requiredFields;

    // Kentucky requires perjury statement — notary oath authority per KRS 423;
    // criminal perjury penalty per KRS 523.020
    this.sections.perjuryStatement = true;
  }

  /**
   * Kentucky-specific case caption using "CASE NO." terminology
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
    caption += `CASE NO. ${caseNumber.toUpperCase()}\n\n`;

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
   * Kentucky header — "COMMONWEALTH OF KENTUCKY"
   *
   * @returns {string} Header text
   */
  generateHeader() {
    return 'COMMONWEALTH OF KENTUCKY';
  }

  /**
   * Kentucky venue — "County of [County]" (title case per Kentucky practice)
   *
   * @param {string} county - County name
   * @returns {string} Venue text
   */
  generateVenue(county) {
    const countyName = county || '[COUNTY]';
    const countyFormatted = countyName.charAt(0).toUpperCase() + countyName.slice(1).toLowerCase();
    return `County of ${countyFormatted}`;
  }

  /**
   * Kentucky-specific validation
   *
   * @param {Object} affidavitData - The affidavit data to validate
   * @returns {Object} Validation result with errors and warnings
   */
  performStateSpecificValidation(affidavitData) {
    const errors = [];
    const warnings = [];

    // County is REQUIRED for Kentucky affidavits
    if (!affidavitData.county || affidavitData.county.trim().length === 0) {
      errors.push('County is required for Kentucky affidavits');
    }

    return { errors, warnings };
  }

  /**
   * Kentucky notary block per KRS 423
   * Supports both oath and affirmation
   * Note: Kentucky is a Commonwealth — notary designation reflects this
   *
   * @param {Object} affidavitData - The affidavit data
   * @returns {string} Notary block text
   */
  generateNotaryBlock(affidavitData) {
    return `Subscribed and sworn to (or affirmed) before me this _____ day of _______________, 20___.


_________________________________
Notary Public, Commonwealth of Kentucky

My commission expires: ___________

[NOTARY SEAL]`;
  }

  /**
   * Kentucky perjury statement
   * Notary oath authority: KRS 423; perjury penalty: KRS 523.020
   *
   * @returns {string} Perjury statement text
   */
  generatePerjuryStatement() {
    return `I declare under penalty of perjury under the laws of the Commonwealth of Kentucky that the foregoing is true and correct.`;
  }

  /**
   * Kentucky exhibit rules — letters, cover page required
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

module.exports = KentuckyAffidavitTemplate;
