// templates/states/north_dakota/AffidavitTemplate.js
// North Dakota Affidavit Template — LEGALLY COMPLIANT v1.0
// Governing Law: NDCC §44-06 (Notaries Public — oath authority and notarial acts),
//                NDCC §12.1-11-01 (perjury)

const BaseAffidavitTemplate = require('../../core/BaseAffidavitTemplate');

/**
 * North Dakota Affidavit Template — LEGALLY COMPLIANT v1.0
 *
 * COMPLIANCE NOTES:
 * - Perjury statement REQUIRED — notary oath authority per NDCC §44-06;
 *   criminal perjury penalty under NDCC §12.1-11-01
 * - County is REQUIRED for North Dakota affidavits
 * - Case number label: "CASE NO."
 * - Header: "STATE OF NORTH DAKOTA"
 * - Venue: "County of [County]" (title case per North Dakota practice)
 * - Notary block per NDCC §44-06; notary designated as "Notary Public, State of North Dakota"
 * - Notary may administer oath or affirmation (subscribed and sworn/affirmed)
 * - Exhibits labeled with letters (A, B, C)
 *
 * @class NorthDakotaAffidavitTemplate
 * @extends BaseAffidavitTemplate
 */
class NorthDakotaAffidavitTemplate extends BaseAffidavitTemplate {
  constructor() {
    super();

    this.metadata = require('./metadata.json');
    this.state = this.metadata.stateCode;
    this.stateName = this.metadata.stateName;
    this.requiredFields = this.metadata.requiredFields;

    // North Dakota requires perjury statement — notary oath authority per NDCC §44-06;
    // criminal perjury penalty per NDCC §12.1-11-01
    this.sections.perjuryStatement = true;
  }

  /**
   * North Dakota-specific case caption using "CASE NO." terminology
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
   * North Dakota header — "STATE OF NORTH DAKOTA"
   *
   * @returns {string} Header text
   */
  generateHeader() {
    return 'STATE OF NORTH DAKOTA';
  }

  /**
   * North Dakota venue — "County of [County]" (title case per North Dakota practice)
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
   * North Dakota-specific validation
   *
   * @param {Object} affidavitData - The affidavit data to validate
   * @returns {Object} Validation result with errors and warnings
   */
  performStateSpecificValidation(affidavitData) {
    const errors = [];
    const warnings = [];

    // County is REQUIRED for North Dakota affidavits
    if (!affidavitData.county || affidavitData.county.trim().length === 0) {
      errors.push('County is required for North Dakota affidavits');
    }

    return { errors, warnings };
  }

  /**
   * North Dakota notary block per NDCC §44-06
   * Supports both oath and affirmation
   *
   * @param {Object} affidavitData - The affidavit data
   * @returns {string} Notary block text
   */
  generateNotaryBlock(affidavitData) {
    return `Subscribed and sworn to (or affirmed) before me this _____ day of _______________, 20___.


_________________________________
Notary Public, State of North Dakota

My commission expires: ___________

(SEAL)`;
  }

  /**
   * North Dakota perjury statement
   * Notary oath authority: NDCC §44-06; perjury penalty: NDCC §12.1-11-01
   *
   * @returns {string} Perjury statement text
   */
  generatePerjuryStatement() {
    return `I declare under penalty of perjury under the laws of the State of North Dakota that the foregoing is true and correct.`;
  }

  /**
   * North Dakota exhibit rules — letters, cover page required
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

module.exports = NorthDakotaAffidavitTemplate;
