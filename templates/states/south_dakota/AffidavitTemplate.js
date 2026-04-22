// templates/states/south_dakota/AffidavitTemplate.js
// South Dakota Affidavit Template — LEGALLY COMPLIANT v1.0
// Governing Law: SDCL §18-1 (Notaries Public — oath authority and notarial acts),
//                SDCL §22-29-1 (perjury)

const BaseAffidavitTemplate = require('../../core/BaseAffidavitTemplate');

/**
 * South Dakota Affidavit Template — LEGALLY COMPLIANT v1.0
 *
 * COMPLIANCE NOTES:
 * - Perjury statement REQUIRED — notary oath authority per SDCL §18-1;
 *   criminal perjury penalty under SDCL §22-29-1
 * - County is REQUIRED for South Dakota affidavits
 * - Case number label: "CIV. NO."
 * - Header: "STATE OF SOUTH DAKOTA"
 * - Venue: "County of [County]" (title case per South Dakota practice)
 * - Notary block per SDCL §18-1; notary designated as "Notary Public, State of South Dakota"
 * - Notary may administer oath or affirmation (subscribed and sworn/affirmed)
 * - Exhibits labeled with letters (A, B, C)
 *
 * @class SouthDakotaAffidavitTemplate
 * @extends BaseAffidavitTemplate
 */
class SouthDakotaAffidavitTemplate extends BaseAffidavitTemplate {
  constructor() {
    super();

    this.metadata = require('./metadata.json');
    this.state = this.metadata.stateCode;
    this.stateName = this.metadata.stateName;
    this.requiredFields = this.metadata.requiredFields;

    // South Dakota requires perjury statement — notary oath authority per SDCL §18-1;
    // criminal perjury penalty per SDCL §22-29-1
    this.sections.perjuryStatement = true;
  }

  /**
   * South Dakota-specific case caption using "CIV. NO." terminology
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
    caption += `CIV. NO. ${caseNumber.toUpperCase()}\n\n`;

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
   * South Dakota header — "STATE OF SOUTH DAKOTA"
   *
   * @returns {string} Header text
   */
  generateHeader() {
    return 'STATE OF SOUTH DAKOTA';
  }

  /**
   * South Dakota venue — "County of [County]" (title case per South Dakota practice)
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
   * South Dakota-specific validation
   *
   * @param {Object} affidavitData - The affidavit data to validate
   * @returns {Object} Validation result with errors and warnings
   */
  performStateSpecificValidation(affidavitData) {
    const errors = [];
    const warnings = [];

    // County is REQUIRED for South Dakota affidavits
    if (!affidavitData.county || affidavitData.county.trim().length === 0) {
      errors.push('County is required for South Dakota affidavits');
    }

    return { errors, warnings };
  }

  /**
   * South Dakota notary block per SDCL §18-1
   * Supports both oath and affirmation
   *
   * @param {Object} affidavitData - The affidavit data
   * @returns {string} Notary block text
   */
  generateNotaryBlock(affidavitData) {
    return `Subscribed and sworn to (or affirmed) before me this _____ day of _______________, 20___.


_________________________________
Notary Public, State of South Dakota

My commission expires: ___________

[NOTARY SEAL]`;
  }

  /**
   * South Dakota perjury statement
   * Notary oath authority: SDCL §18-1; perjury penalty: SDCL §22-29-1
   *
   * @returns {string} Perjury statement text
   */
  generatePerjuryStatement() {
    return `I declare under penalty of perjury under the laws of the State of South Dakota that the foregoing is true and correct.`;
  }

  /**
   * South Dakota exhibit rules — letters, cover page required
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

module.exports = SouthDakotaAffidavitTemplate;
