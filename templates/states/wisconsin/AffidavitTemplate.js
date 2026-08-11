// templates/states/wisconsin/AffidavitTemplate.js
// Wisconsin Affidavit Template — LEGALLY COMPLIANT v1.0
// Governing Law: Wis. Stat. §887.01 (oaths and affidavits — authority to administer oaths),
//                Wis. Stat. §946.32 (perjury — false swearing)

const BaseAffidavitTemplate = require('../../core/BaseAffidavitTemplate');

/**
 * Wisconsin Affidavit Template — LEGALLY COMPLIANT v1.0
 *
 * COMPLIANCE NOTES:
 * - Perjury statement REQUIRED — oath authority per Wis. Stat. §887.01;
 *   criminal perjury penalty under Wis. Stat. §946.32
 * - County is REQUIRED for Wisconsin affidavits
 * - Case number label: "CASE NO."
 * - Header: "STATE OF WISCONSIN"
 * - Venue: "County of [County]" (title case per Wisconsin practice)
 * - Notary block per Wis. Stat. §887.01; notary designated as "Notary Public, State of Wisconsin"
 * - Notary may administer oath or affirmation (subscribed and sworn)
 * - Exhibits labeled with letters (A, B, C)
 *
 * @class WisconsinAffidavitTemplate
 * @extends BaseAffidavitTemplate
 */
class WisconsinAffidavitTemplate extends BaseAffidavitTemplate {
  constructor() {
    super();

    this.metadata = require('./metadata.json');
    this.state = this.metadata.stateCode;
    this.stateName = this.metadata.stateName;
    this.requiredFields = this.metadata.requiredFields;

    // Wisconsin requires perjury statement — oath authority per Wis. Stat. §887.01;
    // criminal perjury penalty per Wis. Stat. §946.32
    this.sections.perjuryStatement = true;
  }

  /**
   * Wisconsin-specific case caption using "CASE NO." terminology
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
   * Wisconsin header — "STATE OF WISCONSIN"
   *
   * @returns {string} Header text
   */
  generateHeader() {
    return 'STATE OF WISCONSIN';
  }

  /**
   * Wisconsin venue — "County of [County]" (title case per Wisconsin practice)
   *
   * @param {string} county - County name
   * @returns {string} Venue text
   */
  generateVenue(county) {
    const countyName = county || '[COUNTY]';
    // Wisconsin uses title case for venue
    const countyFormatted = countyName.charAt(0).toUpperCase() + countyName.slice(1).toLowerCase();
    return `County of ${countyFormatted}`;
  }

  /**
   * Wisconsin-specific validation
   *
   * @param {Object} affidavitData - The affidavit data to validate
   * @returns {Object} Validation result with errors and warnings
   */
  performStateSpecificValidation(affidavitData) {
    const errors = [];
    const warnings = [];

    // County is REQUIRED for Wisconsin affidavits
    if (!affidavitData.county || affidavitData.county.trim().length === 0) {
      errors.push('County is required for Wisconsin affidavits');
    }

    return { errors, warnings };
  }

  /**
   * Wisconsin notary block per Wis. Stat. §887.01
   * Notary may administer oath or affirmation
   *
   * @param {Object} affidavitData - The affidavit data
   * @returns {string} Notary block text
   */
  generateNotaryBlock(affidavitData) {
    return `Subscribed and sworn to before me this _____ day of _______________, 20___.


_________________________________
Notary Public, State of Wisconsin

My commission expires: ___________

(SEAL)`;
  }

  /**
   * Wisconsin perjury statement
   * Oath authority: Wis. Stat. §887.01; perjury penalty: Wis. Stat. §946.32
   *
   * @returns {string} Perjury statement text
   */
  generatePerjuryStatement() {
    return `I declare under penalty of perjury under the laws of the State of Wisconsin that the foregoing is true and correct.`;
  }

  /**
   * Wisconsin exhibit rules — letters, cover page required
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

module.exports = WisconsinAffidavitTemplate;
