// templates/states/colorado/AffidavitTemplate.js
// Colorado Affidavit Template — LEGALLY COMPLIANT v1.0
// Governing Law: C.R.S. § 24-21-501 et seq. (Colorado Notaries Public Act — oath authority and notarial acts),
//                C.R.S. § 18-8-502 (perjury in the second degree)

const BaseAffidavitTemplate = require('../../core/BaseAffidavitTemplate');

/**
 * Colorado Affidavit Template — LEGALLY COMPLIANT v1.0
 *
 * COMPLIANCE NOTES:
 * - Perjury statement REQUIRED — notary oath authority per C.R.S. § 24-21-501 et seq.;
 *   criminal perjury penalty under C.R.S. § 18-8-502
 * - County is REQUIRED for Colorado affidavits
 * - Case number label: "CASE NO."
 * - Header: "STATE OF COLORADO"
 * - Venue: "County of [County]" (title case per Colorado practice)
 * - Notary block per C.R.S. § 24-21-501 et seq. (Colorado Notaries Public Act); notary designated as "Notary Public, State of Colorado"
 * - Notary may administer oath or affirmation (subscribed and sworn/affirmed)
 * - Exhibits labeled with letters (A, B, C)
 *
 * @class ColoradoAffidavitTemplate
 * @extends BaseAffidavitTemplate
 */
class ColoradoAffidavitTemplate extends BaseAffidavitTemplate {
  constructor() {
    super();

    this.metadata = require('./metadata.json');
    this.state = this.metadata.stateCode;
    this.stateName = this.metadata.stateName;
    this.requiredFields = this.metadata.requiredFields;

    // Colorado requires perjury statement — notary oath authority per C.R.S. § 24-21-501 et seq.;
    // criminal perjury penalty per C.R.S. § 18-8-502
    this.sections.perjuryStatement = true;
  }

  /**
   * Colorado-specific case caption using "CASE NO." terminology
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
   * Colorado header — "STATE OF COLORADO"
   *
   * @returns {string} Header text
   */
  generateHeader() {
    return 'STATE OF COLORADO';
  }

  /**
   * Colorado venue — "County of [County]" (title case per Colorado practice)
   *
   * @param {string} county - County name
   * @returns {string} Venue text
   */
  generateVenue(county) {
    const countyName = county || '[COUNTY]';
    // Colorado uses title case for venue
    const countyFormatted = countyName.charAt(0).toUpperCase() + countyName.slice(1).toLowerCase();
    return `County of ${countyFormatted}`;
  }

  /**
   * Colorado-specific validation
   *
   * @param {Object} affidavitData - The affidavit data to validate
   * @returns {Object} Validation result with errors and warnings
   */
  performStateSpecificValidation(affidavitData) {
    const errors = [];
    const warnings = [];

    // County is REQUIRED for Colorado affidavits
    if (!affidavitData.county || affidavitData.county.trim().length === 0) {
      errors.push('County is required for Colorado affidavits');
    }

    return { errors, warnings };
  }

  /**
   * Colorado notary block per C.R.S. § 24-21-501 et seq. (Colorado Notaries Public Act)
   * Supports both oath and affirmation per Colorado Notaries Public Act
   *
   * @param {Object} affidavitData - The affidavit data
   * @returns {string} Notary block text
   */
  generateNotaryBlock(affidavitData) {
    return `Subscribed and sworn to (or affirmed) before me this _____ day of _______________, 20___.


_________________________________
Notary Public, State of Colorado

My commission expires: ___________

(SEAL)`;
  }

  /**
   * Colorado perjury statement
   * Notary oath authority: C.R.S. § 24-21-501 et seq.; perjury penalty: C.R.S. § 18-8-502
   *
   * @returns {string} Perjury statement text
   */
  generatePerjuryStatement() {
    return `I declare under penalty of perjury under the laws of the State of Colorado that the foregoing is true and correct.`;
  }

  /**
   * Colorado exhibit rules — letters, cover page required
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

module.exports = ColoradoAffidavitTemplate;
