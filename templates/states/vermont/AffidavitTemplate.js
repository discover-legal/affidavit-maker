// templates/states/vermont/AffidavitTemplate.js
// Vermont Affidavit Template — LEGALLY COMPLIANT v1.0
// Governing Law: 26 V.S.A. § 5341 et seq. (Vermont Notarial Acts — oath authority and notarial acts),
//                13 V.S.A. § 2901 (perjury)

const BaseAffidavitTemplate = require('../../core/BaseAffidavitTemplate');

/**
 * Vermont Affidavit Template — LEGALLY COMPLIANT v1.0
 *
 * COMPLIANCE NOTES:
 * - Perjury statement REQUIRED — notary oath authority per 26 V.S.A. § 5341 et seq.;
 *   criminal perjury penalty under 13 V.S.A. § 2901
 * - County is REQUIRED for Vermont affidavits
 * - Case number label: "DOCKET NO."
 * - Header: "STATE OF VERMONT"
 * - Venue: "County of [County]" (title case per Vermont practice)
 * - Notary block per 26 V.S.A. § 5341 et seq. (Vermont Notarial Acts); notary designated as "Notary Public, State of Vermont"
 * - Notary may administer oath or affirmation (subscribed and sworn/affirmed)
 * - Exhibits labeled with letters (A, B, C)
 *
 * @class VermontAffidavitTemplate
 * @extends BaseAffidavitTemplate
 */
class VermontAffidavitTemplate extends BaseAffidavitTemplate {
  constructor() {
    super();

    this.metadata = require('./metadata.json');
    this.state = this.metadata.stateCode;
    this.stateName = this.metadata.stateName;
    this.requiredFields = this.metadata.requiredFields;

    // Vermont requires perjury statement — notary oath authority per 26 V.S.A. § 5341 et seq.;
    // criminal perjury penalty per 13 V.S.A. § 2901
    this.sections.perjuryStatement = true;
  }

  /**
   * Vermont-specific case caption using "DOCKET NO." terminology
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
    caption += `DOCKET NO. ${caseNumber.toUpperCase()}\n\n`;

    const plaintiff = affidavitData.plaintiff || '[PLAINTIFF NAME]';
    const defendant = affidavitData.defendant || '[DEFENDANT NAME]';

    caption += `${plaintiff.toUpperCase()},\n`;
    caption += `    Plaintiff,\n\n`;
    caption += `v.\n\n`;
    caption += `${defendant.toUpperCase()},\n`;
    caption += `    Defendant.`;

    return {
      courtName,
      caseNumber: affidavitData.caseNumber,
      plaintiff: affidavitData.plaintiff,
      defendant: affidavitData.defendant,
      formatted: caption
    };
  }

  /**
   * Vermont header — "STATE OF VERMONT"
   *
   * @returns {string} Header text
   */
  generateHeader() {
    return 'STATE OF VERMONT';
  }

  /**
   * Vermont venue — "County of [County]" (title case per Vermont practice)
   *
   * @param {string} county - County name
   * @returns {string} Venue text
   */
  generateVenue(county) {
    const countyName = county || '[COUNTY]';
    // Vermont uses title case for venue
    const countyFormatted = countyName.charAt(0).toUpperCase() + countyName.slice(1).toLowerCase();
    return `County of ${countyFormatted}`;
  }

  /**
   * Vermont-specific validation
   *
   * @param {Object} affidavitData - The affidavit data to validate
   * @returns {Object} Validation result with errors and warnings
   */
  performStateSpecificValidation(affidavitData) {
    const errors = [];
    const warnings = [];

    // County is REQUIRED for Vermont affidavits
    if (!affidavitData.county || affidavitData.county.trim().length === 0) {
      errors.push('County is required for Vermont affidavits');
    }

    return { errors, warnings };
  }

  /**
   * Vermont notary block per 26 V.S.A. § 5341 et seq. (Vermont Notarial Acts)
   * Supports both oath and affirmation per Vermont Notarial Acts
   *
   * @param {Object} affidavitData - The affidavit data
   * @returns {string} Notary block text
   */
  generateNotaryBlock(affidavitData) {
    return `Subscribed and sworn to (or affirmed) before me this _____ day of _______________, 20___.


_________________________________
Notary Public, State of Vermont

My commission expires: ___________

(SEAL)`;
  }

  /**
   * Vermont perjury statement
   * Notary oath authority: 26 V.S.A. § 5341 et seq.; perjury penalty: 13 V.S.A. § 2901
   *
   * @returns {string} Perjury statement text
   */
  generatePerjuryStatement() {
    return `I declare under penalty of perjury under the laws of the State of Vermont that the foregoing is true and correct.`;
  }

  /**
   * Vermont exhibit rules — letters, cover page required
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

module.exports = VermontAffidavitTemplate;
