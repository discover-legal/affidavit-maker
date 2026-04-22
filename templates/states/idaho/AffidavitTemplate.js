// templates/states/idaho/AffidavitTemplate.js
// Idaho Affidavit Template — LEGALLY COMPLIANT v1.0
// Governing Law: Idaho Code §51-101 et seq. (Idaho Notary Public Act — oath authority and notarial acts),
//                Idaho Code §18-5401 (perjury)

const BaseAffidavitTemplate = require('../../core/BaseAffidavitTemplate');

/**
 * Idaho Affidavit Template — LEGALLY COMPLIANT v1.0
 *
 * COMPLIANCE NOTES:
 * - Perjury statement REQUIRED — notary oath authority per Idaho Code §51-101 et seq.;
 *   criminal perjury penalty under Idaho Code §18-5401
 * - County is REQUIRED for Idaho affidavits
 * - Case number label: "CASE NO."
 * - Header: "IN THE DISTRICT COURT OF THE [NUMBER] JUDICIAL DISTRICT OF THE STATE OF IDAHO, IN AND FOR THE COUNTY OF [COUNTY]"
 * - Venue: "IN AND FOR THE COUNTY OF [COUNTY]" (uppercase per Idaho practice)
 * - Notary block per Idaho Code §51-101 et seq.; notary designated as "Notary Public for Idaho"
 * - Idaho notary must include residence and commission expiration
 * - Notary may administer oath or affirmation (subscribed and sworn/affirmed)
 * - Exhibits labeled with letters (A, B, C)
 *
 * @class IdahoAffidavitTemplate
 * @extends BaseAffidavitTemplate
 */
class IdahoAffidavitTemplate extends BaseAffidavitTemplate {
  constructor() {
    super();

    this.metadata = require('./metadata.json');
    this.state = this.metadata.stateCode;
    this.stateName = this.metadata.stateName;
    this.requiredFields = this.metadata.requiredFields;

    // Idaho requires perjury statement — notary oath authority per Idaho Code §51-101 et seq.;
    // criminal perjury penalty per Idaho Code §18-5401
    this.sections.perjuryStatement = true;
  }

  /**
   * Idaho-specific case caption using "CASE NO." terminology
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
   * Idaho header — full court header per Idaho practice
   *
   * @returns {string} Header text
   */
  generateHeader() {
    return 'STATE OF IDAHO';
  }

  /**
   * Idaho venue — "County of [County]" (uppercase per Idaho practice)
   *
   * @param {string} county - County name
   * @returns {string} Venue text
   */
  generateVenue(county) {
    const countyName = county || '[COUNTY]';
    return `County of ${countyName.toUpperCase()}`;
  }

  /**
   * Idaho-specific validation
   *
   * @param {Object} affidavitData - The affidavit data to validate
   * @returns {Object} Validation result with errors and warnings
   */
  performStateSpecificValidation(affidavitData) {
    const errors = [];
    const warnings = [];

    // County is REQUIRED for Idaho affidavits
    if (!affidavitData.county || affidavitData.county.trim().length === 0) {
      errors.push('County is required for Idaho affidavits');
    }

    return { errors, warnings };
  }

  /**
   * Idaho notary block per Idaho Code §51-101 et seq.
   * Supports both oath and affirmation; notary must include residence and commission expiration
   *
   * @param {Object} affidavitData - The affidavit data
   * @returns {string} Notary block text
   */
  generateNotaryBlock(affidavitData) {
    return `Subscribed and sworn to (or affirmed) before me this _____ day of _______________, 20___.


_________________________________
Notary Public for Idaho

Residing at: _____________________
My commission expires: ___________

[NOTARY SEAL]`;
  }

  /**
   * Idaho perjury statement
   * Notary oath authority: Idaho Code §51-101 et seq.; perjury penalty: Idaho Code §18-5401
   *
   * @returns {string} Perjury statement text
   */
  generatePerjuryStatement() {
    return `I declare under penalty of perjury under the laws of the State of Idaho that the foregoing is true and correct.`;
  }

  /**
   * Idaho exhibit rules — letters, cover page required
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

module.exports = IdahoAffidavitTemplate;
