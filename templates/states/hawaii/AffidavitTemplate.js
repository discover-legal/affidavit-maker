// templates/states/hawaii/AffidavitTemplate.js
// Hawaii Affidavit Template — LEGALLY COMPLIANT v1.0
// Governing Law: HRS §456-1 et seq. (Notaries Public — oath authority and notarial acts),
//                HRS §710-1060 (perjury)

const BaseAffidavitTemplate = require('../../core/BaseAffidavitTemplate');

/**
 * Hawaii Affidavit Template — LEGALLY COMPLIANT v1.0
 *
 * COMPLIANCE NOTES:
 * - Perjury statement REQUIRED — notary oath authority per HRS §456-1 et seq.;
 *   criminal perjury penalty under HRS §710-1060
 * - County is REQUIRED for Hawaii affidavits (corresponds to judicial circuit)
 * - Case number label: "FC-D NO."
 * - Header: "STATE OF HAWAII"
 * - Venue: "County of [County]" (title case per Hawaii practice)
 * - Notary block per HRS §456-1 et seq.; notary designated as "Notary Public, State of Hawaii"
 * - Hawaii notary must include judicial circuit
 * - Notary may administer oath or affirmation (subscribed and sworn/affirmed)
 * - Exhibits labeled with letters (A, B, C)
 *
 * @class HawaiiAffidavitTemplate
 * @extends BaseAffidavitTemplate
 */
class HawaiiAffidavitTemplate extends BaseAffidavitTemplate {
  constructor() {
    super();

    this.metadata = require('./metadata.json');
    this.state = this.metadata.stateCode;
    this.stateName = this.metadata.stateName;
    this.requiredFields = this.metadata.requiredFields;

    // Hawaii requires perjury statement — notary oath authority per HRS §456-1 et seq.;
    // criminal perjury penalty per HRS §710-1060
    this.sections.perjuryStatement = true;
  }

  /**
   * Hawaii-specific case caption using "FC-D NO." terminology
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
    caption += `FC-D NO. ${caseNumber.toUpperCase()}\n\n`;

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
   * Hawaii header — "STATE OF HAWAII"
   *
   * @returns {string} Header text
   */
  generateHeader() {
    return 'STATE OF HAWAII';
  }

  /**
   * Hawaii venue — "County of [County]" (title case per Hawaii practice)
   *
   * @param {string} county - County name
   * @returns {string} Venue text
   */
  generateVenue(county) {
    const countyName = county || '[COUNTY]';
    // Hawaii uses title case for venue
    const countyFormatted = countyName.charAt(0).toUpperCase() + countyName.slice(1).toLowerCase();
    return `County of ${countyFormatted}`;
  }

  /**
   * Hawaii-specific validation
   *
   * @param {Object} affidavitData - The affidavit data to validate
   * @returns {Object} Validation result with errors and warnings
   */
  performStateSpecificValidation(affidavitData) {
    const errors = [];
    const warnings = [];

    // County is REQUIRED for Hawaii affidavits
    if (!affidavitData.county || affidavitData.county.trim().length === 0) {
      errors.push('County is required for Hawaii affidavits');
    }

    return { errors, warnings };
  }

  /**
   * Hawaii notary block per HRS §456-1 et seq.
   * Supports both oath and affirmation; notary must include judicial circuit
   *
   * @param {Object} affidavitData - The affidavit data
   * @returns {string} Notary block text
   */
  generateNotaryBlock(affidavitData) {
    return `Subscribed and sworn to (or affirmed) before me this _____ day of _______________, 20___.


_________________________________
Notary Public, State of Hawaii

My commission expires: ___________
Judicial Circuit: _________________

(SEAL)`;
  }

  /**
   * Hawaii perjury statement
   * Notary oath authority: HRS §456-1 et seq.; perjury penalty: HRS §710-1060
   *
   * @returns {string} Perjury statement text
   */
  generatePerjuryStatement() {
    return `I declare under penalty of perjury under the laws of the State of Hawaii that the foregoing is true and correct.`;
  }

  /**
   * Hawaii exhibit rules — letters, cover page required
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

module.exports = HawaiiAffidavitTemplate;
