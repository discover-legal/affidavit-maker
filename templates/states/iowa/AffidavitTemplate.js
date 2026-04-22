// templates/states/iowa/AffidavitTemplate.js
// Iowa Affidavit Template — LEGALLY COMPLIANT v1.0
// Governing Law: Iowa Code §63A (Iowa Notarial Acts — oath authority and notarial acts),
//                Iowa Code §720.2 (perjury)

const BaseAffidavitTemplate = require('../../core/BaseAffidavitTemplate');

/**
 * Iowa Affidavit Template — LEGALLY COMPLIANT v1.0
 *
 * COMPLIANCE NOTES:
 * - Perjury statement REQUIRED — notary oath authority per Iowa Code §63A;
 *   criminal perjury penalty under Iowa Code §720.2
 * - County is REQUIRED for Iowa affidavits
 * - Case number label: "CASE NO."
 * - Header: "STATE OF IOWA"
 * - Venue: "County of [County]" (title case per Iowa practice)
 * - Notary block per Iowa Code §63A (Iowa Notarial Acts); notary designated as "Notary Public, State of Iowa"
 * - Notary may administer oath or affirmation (subscribed and sworn/affirmed)
 * - Exhibits labeled with letters (A, B, C)
 *
 * @class IowaAffidavitTemplate
 * @extends BaseAffidavitTemplate
 */
class IowaAffidavitTemplate extends BaseAffidavitTemplate {
  constructor() {
    super();

    this.metadata = require('./metadata.json');
    this.state = this.metadata.stateCode;
    this.stateName = this.metadata.stateName;
    this.requiredFields = this.metadata.requiredFields;

    // Iowa requires perjury statement — notary oath authority per Iowa Code §63A;
    // criminal perjury penalty per Iowa Code §720.2
    this.sections.perjuryStatement = true;
  }

  /**
   * Iowa-specific case caption using "CASE NO." terminology
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

    const plaintiff = affidavitData.plaintiff || '[PETITIONER NAME]';
    const defendant = affidavitData.defendant || '[RESPONDENT NAME]';

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
   * Iowa header — "STATE OF IOWA"
   *
   * @returns {string} Header text
   */
  generateHeader() {
    return 'STATE OF IOWA';
  }

  /**
   * Iowa venue — "County of [County]" (title case per Iowa practice)
   *
   * @param {string} county - County name
   * @returns {string} Venue text
   */
  generateVenue(county) {
    const countyName = county || '[COUNTY]';
    // Iowa uses title case for venue
    const countyFormatted = countyName.charAt(0).toUpperCase() + countyName.slice(1).toLowerCase();
    return `County of ${countyFormatted}`;
  }

  /**
   * Iowa-specific validation
   *
   * @param {Object} affidavitData - The affidavit data to validate
   * @returns {Object} Validation result with errors and warnings
   */
  performStateSpecificValidation(affidavitData) {
    const errors = [];
    const warnings = [];

    // County is REQUIRED for Iowa affidavits
    if (!affidavitData.county || affidavitData.county.trim().length === 0) {
      errors.push('County is required for Iowa affidavits');
    }

    return { errors, warnings };
  }

  /**
   * Iowa notary block per Iowa Code §63A (Iowa Notarial Acts)
   * Supports both oath and affirmation
   *
   * @param {Object} affidavitData - The affidavit data
   * @returns {string} Notary block text
   */
  generateNotaryBlock(affidavitData) {
    return `Subscribed and sworn to (or affirmed) before me this _____ day of _______________, 20___.


_________________________________
Notary Public, State of Iowa

My commission expires: ___________

[NOTARY SEAL]`;
  }

  /**
   * Iowa perjury statement
   * Notary oath authority: Iowa Code §63A; perjury penalty: Iowa Code §720.2
   *
   * @returns {string} Perjury statement text
   */
  generatePerjuryStatement() {
    return `I declare under penalty of perjury under the laws of the State of Iowa that the foregoing is true and correct.`;
  }

  /**
   * Iowa exhibit rules — letters, cover page required
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

module.exports = IowaAffidavitTemplate;
