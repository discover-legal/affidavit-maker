// templates/states/maine/AffidavitTemplate.js
// Maine Affidavit Template — LEGALLY COMPLIANT v1.0
// Governing Law: 4 M.R.S. §951 et seq. (Maine Notarial Acts — oath authority and notarial acts),
//                17-A M.R.S. §451 (perjury)

const BaseAffidavitTemplate = require('../../core/BaseAffidavitTemplate');

/**
 * Maine Affidavit Template — LEGALLY COMPLIANT v1.0
 *
 * COMPLIANCE NOTES:
 * - Perjury statement REQUIRED — notary oath authority per 4 M.R.S. §951 et seq.;
 *   criminal perjury penalty under 17-A M.R.S. §451
 * - County is REQUIRED for Maine affidavits
 * - Case number label: "DOCKET NO."
 * - Header: "STATE OF MAINE"
 * - Venue: "County of [County]" (title case per Maine practice)
 * - Notary block per 4 M.R.S. §951 et seq.; notary designated as "Notary Public / Attorney at Law"
 * - In Maine, attorneys at law may also administer oaths
 * - Notary may administer oath or affirmation (subscribed and sworn/affirmed)
 * - Exhibits labeled with letters (A, B, C)
 *
 * @class MaineAffidavitTemplate
 * @extends BaseAffidavitTemplate
 */
class MaineAffidavitTemplate extends BaseAffidavitTemplate {
  constructor() {
    super();

    this.metadata = require('./metadata.json');
    this.state = this.metadata.stateCode;
    this.stateName = this.metadata.stateName;
    this.requiredFields = this.metadata.requiredFields;

    // Maine requires perjury statement — notary oath authority per 4 M.R.S. §951 et seq.;
    // criminal perjury penalty per 17-A M.R.S. §451
    this.sections.perjuryStatement = true;
  }

  /**
   * Maine-specific case caption using "DOCKET NO." terminology
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
   * Maine header — "STATE OF MAINE"
   *
   * @returns {string} Header text
   */
  generateHeader() {
    return 'STATE OF MAINE';
  }

  /**
   * Maine venue — "County of [County]" (title case per Maine practice)
   *
   * @param {string} county - County name
   * @returns {string} Venue text
   */
  generateVenue(county) {
    const countyName = county || '[COUNTY]';
    // Maine uses title case for venue
    const countyFormatted = countyName.charAt(0).toUpperCase() + countyName.slice(1).toLowerCase();
    return `County of ${countyFormatted}`;
  }

  /**
   * Maine-specific validation
   *
   * @param {Object} affidavitData - The affidavit data to validate
   * @returns {Object} Validation result with errors and warnings
   */
  performStateSpecificValidation(affidavitData) {
    const errors = [];
    const warnings = [];

    // County is REQUIRED for Maine affidavits
    if (!affidavitData.county || affidavitData.county.trim().length === 0) {
      errors.push('County is required for Maine affidavits');
    }

    return { errors, warnings };
  }

  /**
   * Maine notary block per 4 M.R.S. §951 et seq.
   * Supports both oath and affirmation; attorneys at law may also administer oaths
   *
   * @param {Object} affidavitData - The affidavit data
   * @returns {string} Notary block text
   */
  generateNotaryBlock(affidavitData) {
    return `Subscribed and sworn to (or affirmed) before me this _____ day of _______________, 20___.


_________________________________
Notary Public / Attorney at Law

My commission expires: ___________

[NOTARY SEAL]`;
  }

  /**
   * Maine perjury statement
   * Notary oath authority: 4 M.R.S. §951 et seq.; perjury penalty: 17-A M.R.S. §451
   *
   * @returns {string} Perjury statement text
   */
  generatePerjuryStatement() {
    return `I declare under penalty of perjury under the laws of the State of Maine that the foregoing is true and correct.`;
  }

  /**
   * Maine exhibit rules — letters, cover page required
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

module.exports = MaineAffidavitTemplate;
