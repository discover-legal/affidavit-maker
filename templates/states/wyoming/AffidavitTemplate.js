// templates/states/wyoming/AffidavitTemplate.js
// Wyoming Affidavit Template — LEGALLY COMPLIANT v1.0
// Governing Law: Wyo. Stat. § 32-1-101 et seq. (Wyoming Notarial Acts — oath authority and notarial acts),
//                Wyo. Stat. § 6-5-301 (perjury)

const BaseAffidavitTemplate = require('../../core/BaseAffidavitTemplate');

/**
 * Wyoming Affidavit Template — LEGALLY COMPLIANT v1.0
 *
 * COMPLIANCE NOTES:
 * - Perjury statement REQUIRED — notary oath authority per Wyo. Stat. § 32-1-101 et seq.;
 *   criminal perjury penalty under Wyo. Stat. § 6-5-301
 * - County is REQUIRED for Wyoming affidavits
 * - Case number label: "CIVIL NO."
 * - Header: "STATE OF WYOMING"
 * - Venue: "County of [County]" (title case per Wyoming practice)
 * - Notary block per Wyo. Stat. § 32-1-101 et seq. (Wyoming Notarial Acts); notary designated as "Notary Public, State of Wyoming"
 * - Notary may administer oath or affirmation (subscribed and sworn/affirmed)
 * - Exhibits labeled with letters (A, B, C)
 *
 * @class WyomingAffidavitTemplate
 * @extends BaseAffidavitTemplate
 */
class WyomingAffidavitTemplate extends BaseAffidavitTemplate {
  constructor() {
    super();

    this.metadata = require('./metadata.json');
    this.state = this.metadata.stateCode;
    this.stateName = this.metadata.stateName;
    this.requiredFields = this.metadata.requiredFields;

    // Wyoming requires perjury statement — notary oath authority per Wyo. Stat. § 32-1-101 et seq.;
    // criminal perjury penalty per Wyo. Stat. § 6-5-301
    this.sections.perjuryStatement = true;
  }

  /**
   * Wyoming-specific case caption using "CIVIL NO." terminology
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
    caption += `CIVIL NO. ${caseNumber.toUpperCase()}\n\n`;

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
   * Wyoming header — "STATE OF WYOMING"
   *
   * @returns {string} Header text
   */
  generateHeader() {
    return 'STATE OF WYOMING';
  }

  /**
   * Wyoming venue — "County of [County]" (title case per Wyoming practice)
   *
   * @param {string} county - County name
   * @returns {string} Venue text
   */
  generateVenue(county) {
    const countyName = county || '[COUNTY]';
    // Wyoming uses title case for venue
    const countyFormatted = countyName.charAt(0).toUpperCase() + countyName.slice(1).toLowerCase();
    return `County of ${countyFormatted}`;
  }

  /**
   * Wyoming-specific validation
   *
   * @param {Object} affidavitData - The affidavit data to validate
   * @returns {Object} Validation result with errors and warnings
   */
  performStateSpecificValidation(affidavitData) {
    const errors = [];
    const warnings = [];

    // County is REQUIRED for Wyoming affidavits
    if (!affidavitData.county || affidavitData.county.trim().length === 0) {
      errors.push('County is required for Wyoming affidavits');
    }

    return { errors, warnings };
  }

  /**
   * Wyoming notary block per Wyo. Stat. § 32-1-101 et seq. (Wyoming Notarial Acts)
   * Supports both oath and affirmation per Wyoming Notarial Acts
   *
   * @param {Object} affidavitData - The affidavit data
   * @returns {string} Notary block text
   */
  generateNotaryBlock(affidavitData) {
    return `Subscribed and sworn to (or affirmed) before me this _____ day of _______________, 20___.


_________________________________
Notary Public, State of Wyoming

My commission expires: ___________

(SEAL)`;
  }

  /**
   * Wyoming perjury statement
   * Notary oath authority: Wyo. Stat. § 32-1-101 et seq.; perjury penalty: Wyo. Stat. § 6-5-301
   *
   * @returns {string} Perjury statement text
   */
  generatePerjuryStatement() {
    return `I declare under penalty of perjury under the laws of the State of Wyoming that the foregoing is true and correct.`;
  }

  /**
   * Wyoming exhibit rules — letters, cover page required
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

module.exports = WyomingAffidavitTemplate;
