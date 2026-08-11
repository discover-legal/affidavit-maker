// templates/states/west_virginia/AffidavitTemplate.js
// West Virginia Affidavit Template — LEGALLY COMPLIANT v1.0
// Governing Law: W. Va. Code §39-4-1 et seq. (Revised Uniform Law on Notarial Acts — oath authority),
//                W. Va. Code §61-5-2 (perjury)

const BaseAffidavitTemplate = require('../../core/BaseAffidavitTemplate');

/**
 * West Virginia Affidavit Template — LEGALLY COMPLIANT v1.0
 *
 * COMPLIANCE NOTES:
 * - Perjury statement REQUIRED — notary oath authority per W. Va. Code §39-4-1 et seq.;
 *   criminal perjury penalty under W. Va. Code §61-5-2
 * - County is REQUIRED for West Virginia affidavits
 * - Case number label: "CIVIL ACTION NO."
 * - Header: "STATE OF WEST VIRGINIA"
 * - Venue: "County of [County]" (title case per West Virginia practice)
 * - Notary block per W. Va. Code §39-4-1 et seq.; notary designated as "Notary Public, State of West Virginia"
 * - Notary may administer oath or affirmation (subscribed and sworn/affirmed)
 * - Exhibits labeled with letters (A, B, C)
 *
 * @class WestVirginiaAffidavitTemplate
 * @extends BaseAffidavitTemplate
 */
class WestVirginiaAffidavitTemplate extends BaseAffidavitTemplate {
  constructor() {
    super();

    this.metadata = require('./metadata.json');
    this.state = this.metadata.stateCode;
    this.stateName = this.metadata.stateName;
    this.requiredFields = this.metadata.requiredFields;

    // West Virginia requires perjury statement — notary oath authority per W. Va. Code §39-4-1 et seq.;
    // criminal perjury penalty per W. Va. Code §61-5-2
    this.sections.perjuryStatement = true;
  }

  /**
   * West Virginia-specific case caption using "CIVIL ACTION NO." terminology
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
    caption += `CIVIL ACTION NO. ${caseNumber.toUpperCase()}\n\n`;

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
   * West Virginia header — "STATE OF WEST VIRGINIA"
   *
   * @returns {string} Header text
   */
  generateHeader() {
    return 'STATE OF WEST VIRGINIA';
  }

  /**
   * West Virginia venue — "County of [County]" (title case per West Virginia practice)
   *
   * @param {string} county - County name
   * @returns {string} Venue text
   */
  generateVenue(county) {
    const countyName = county || '[COUNTY]';
    // West Virginia uses title case for venue
    const countyFormatted = countyName.charAt(0).toUpperCase() + countyName.slice(1).toLowerCase();
    return `County of ${countyFormatted}`;
  }

  /**
   * West Virginia-specific validation
   *
   * @param {Object} affidavitData - The affidavit data to validate
   * @returns {Object} Validation result with errors and warnings
   */
  performStateSpecificValidation(affidavitData) {
    const errors = [];
    const warnings = [];

    // County is REQUIRED for West Virginia affidavits
    if (!affidavitData.county || affidavitData.county.trim().length === 0) {
      errors.push('County is required for West Virginia affidavits');
    }

    return { errors, warnings };
  }

  /**
   * West Virginia notary block per W. Va. Code §39-4-1 et seq.
   * Supports both oath and affirmation
   *
   * @param {Object} affidavitData - The affidavit data
   * @returns {string} Notary block text
   */
  generateNotaryBlock(affidavitData) {
    return `Subscribed and sworn to (or affirmed) before me this _____ day of _______________, 20___.


_________________________________
Notary Public, State of West Virginia

My commission expires: ___________

(SEAL)`;
  }

  /**
   * West Virginia perjury statement
   * Notary oath authority: W. Va. Code §39-4-1 et seq.; perjury penalty: W. Va. Code §61-5-2
   *
   * @returns {string} Perjury statement text
   */
  generatePerjuryStatement() {
    return `I declare under penalty of perjury under the laws of the State of West Virginia that the foregoing is true and correct.`;
  }

  /**
   * West Virginia exhibit rules — letters, cover page required
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

module.exports = WestVirginiaAffidavitTemplate;
