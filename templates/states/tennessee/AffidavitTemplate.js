// templates/states/tennessee/AffidavitTemplate.js
// Tennessee Affidavit Template — LEGALLY COMPLIANT v1.0
// Governing Law: TCA 8-16-101 et seq. (Tennessee Notary Public Act — oath authority and notarial acts),
//                TCA 39-16-702 (perjury)

const BaseAffidavitTemplate = require('../../core/BaseAffidavitTemplate');

/**
 * Tennessee Affidavit Template — LEGALLY COMPLIANT v1.0
 *
 * COMPLIANCE NOTES:
 * - Perjury statement REQUIRED — notary oath authority per TCA 8-16-101 et seq.;
 *   criminal perjury penalty under TCA 39-16-702
 * - County is REQUIRED for Tennessee affidavits
 * - Case number label: "CASE NO."
 * - Header: "STATE OF TENNESSEE"
 * - Venue: "County of [County]" (title case per Tennessee practice)
 * - Notary block per TCA 8-16-101 et seq. (Tennessee Notary Public Act); notary designated as "Notary Public, State of Tennessee"
 * - Notary may administer oath or affirmation (subscribed and sworn/affirmed)
 * - Exhibits labeled with letters (A, B, C)
 *
 * @class TennesseeAffidavitTemplate
 * @extends BaseAffidavitTemplate
 */
class TennesseeAffidavitTemplate extends BaseAffidavitTemplate {
  constructor() {
    super();

    this.metadata = require('./metadata.json');
    this.state = this.metadata.stateCode;
    this.stateName = this.metadata.stateName;
    this.requiredFields = this.metadata.requiredFields;

    // Tennessee requires perjury statement — notary oath authority per TCA 8-16-101 et seq.;
    // criminal perjury penalty per TCA 39-16-702
    this.sections.perjuryStatement = true;
  }

  /**
   * Tennessee-specific case caption using "CASE NO." terminology
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
   * Tennessee header — "STATE OF TENNESSEE"
   *
   * @returns {string} Header text
   */
  generateHeader() {
    return 'STATE OF TENNESSEE';
  }

  /**
   * Tennessee venue — "County of [County]" (title case per Tennessee practice)
   *
   * @param {string} county - County name
   * @returns {string} Venue text
   */
  generateVenue(county) {
    const countyName = county || '[COUNTY]';
    // Tennessee uses title case for venue
    const countyFormatted = countyName.charAt(0).toUpperCase() + countyName.slice(1).toLowerCase();
    return `County of ${countyFormatted}`;
  }

  /**
   * Tennessee-specific validation
   *
   * @param {Object} affidavitData - The affidavit data to validate
   * @returns {Object} Validation result with errors and warnings
   */
  performStateSpecificValidation(affidavitData) {
    const errors = [];
    const warnings = [];

    // County is REQUIRED for Tennessee affidavits
    if (!affidavitData.county || affidavitData.county.trim().length === 0) {
      errors.push('County is required for Tennessee affidavits');
    }

    return { errors, warnings };
  }

  /**
   * Tennessee notary block per TCA 8-16-101 et seq. (Tennessee Notary Public Act)
   * Supports both oath and affirmation per Tennessee Notary Public Act
   *
   * @param {Object} affidavitData - The affidavit data
   * @returns {string} Notary block text
   */
  generateNotaryBlock(affidavitData) {
    return `Subscribed and sworn to (or affirmed) before me this _____ day of _______________, 20___.


_________________________________
Notary Public, State of Tennessee

My commission expires: ___________

(SEAL)`;
  }

  /**
   * Tennessee perjury statement
   * Notary oath authority: TCA 8-16-101 et seq.; perjury penalty: TCA 39-16-702
   *
   * @returns {string} Perjury statement text
   */
  generatePerjuryStatement() {
    return `I declare under penalty of perjury under the laws of the State of Tennessee that the foregoing is true and correct.`;
  }

  /**
   * Tennessee exhibit rules — letters, cover page required
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

module.exports = TennesseeAffidavitTemplate;
