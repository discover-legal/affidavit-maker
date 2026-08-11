// templates/states/rhode_island/AffidavitTemplate.js
// Rhode Island Affidavit Template — LEGALLY COMPLIANT v1.0
// Governing Law: R.I. Gen. Laws §42-30 (Rhode Island Notaries Public — oath authority and notarial acts),
//                R.I. Gen. Laws §11-33-2 (perjury)

const BaseAffidavitTemplate = require('../../core/BaseAffidavitTemplate');

/**
 * Rhode Island Affidavit Template — LEGALLY COMPLIANT v1.0
 *
 * COMPLIANCE NOTES:
 * - Perjury statement REQUIRED — notary oath authority per R.I. Gen. Laws §42-30;
 *   criminal perjury penalty under R.I. Gen. Laws §11-33-2
 * - County is REQUIRED for Rhode Island affidavits
 * - Case number label: "NO."
 * - Header: "STATE OF RHODE ISLAND"
 * - Venue: "County of [County]" (title case per RI practice)
 * - Notary block per R.I. Gen. Laws §42-30; notary designated as "Notary Public, State of Rhode Island"
 * - Notary may administer oath or affirmation (subscribed and sworn/affirmed)
 * - Exhibits labeled with letters (A, B, C)
 *
 * @class RhodeIslandAffidavitTemplate
 * @extends BaseAffidavitTemplate
 */
class RhodeIslandAffidavitTemplate extends BaseAffidavitTemplate {
  constructor() {
    super();

    this.metadata = require('./metadata.json');
    this.state = this.metadata.stateCode;
    this.stateName = this.metadata.stateName;
    this.requiredFields = this.metadata.requiredFields;

    // Rhode Island requires perjury statement — notary oath authority per R.I. Gen. Laws §42-30;
    // criminal perjury penalty per R.I. Gen. Laws §11-33-2
    this.sections.perjuryStatement = true;
  }

  /**
   * Rhode Island-specific case caption using "NO." terminology
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
    caption += `NO. ${caseNumber.toUpperCase()}\n\n`;

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
   * Rhode Island header — "STATE OF RHODE ISLAND"
   *
   * @returns {string} Header text
   */
  generateHeader() {
    return 'STATE OF RHODE ISLAND';
  }

  /**
   * Rhode Island venue — "County of [County]" (title case per RI practice)
   *
   * @param {string} county - County name
   * @returns {string} Venue text
   */
  generateVenue(county) {
    const countyName = county || '[COUNTY]';
    // Rhode Island uses title case for venue
    const countyFormatted = countyName.charAt(0).toUpperCase() + countyName.slice(1).toLowerCase();
    return `County of ${countyFormatted}`;
  }

  /**
   * Rhode Island-specific validation
   *
   * @param {Object} affidavitData - The affidavit data to validate
   * @returns {Object} Validation result with errors and warnings
   */
  performStateSpecificValidation(affidavitData) {
    const errors = [];
    const warnings = [];

    // County is REQUIRED for Rhode Island affidavits
    if (!affidavitData.county || affidavitData.county.trim().length === 0) {
      errors.push('County is required for Rhode Island affidavits');
    }

    return { errors, warnings };
  }

  /**
   * Rhode Island notary block per R.I. Gen. Laws §42-30
   * Supports both oath and affirmation
   *
   * @param {Object} affidavitData - The affidavit data
   * @returns {string} Notary block text
   */
  generateNotaryBlock(affidavitData) {
    return `Subscribed and sworn to (or affirmed) before me this _____ day of _______________, 20___.


_________________________________
Notary Public, State of Rhode Island

My commission expires: ___________

(SEAL)`;
  }

  /**
   * Rhode Island perjury statement
   * Notary oath authority: R.I. Gen. Laws §42-30; perjury penalty: R.I. Gen. Laws §11-33-2
   *
   * @returns {string} Perjury statement text
   */
  generatePerjuryStatement() {
    return `I declare under penalty of perjury under the laws of the State of Rhode Island that the foregoing is true and correct.`;
  }

  /**
   * Rhode Island exhibit rules — letters, cover page required
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

module.exports = RhodeIslandAffidavitTemplate;
