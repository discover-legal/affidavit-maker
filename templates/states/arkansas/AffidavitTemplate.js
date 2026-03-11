// templates/states/arkansas/AffidavitTemplate.js
// Arkansas Affidavit Template — LEGALLY COMPLIANT v1.0
// Governing Law: Ark. Code §21-14-101 et seq. (Arkansas Notary Public Act — oath authority and notarial acts),
//                Ark. Code §5-53-102 (perjury)

const BaseAffidavitTemplate = require('../../core/BaseAffidavitTemplate');

/**
 * Arkansas Affidavit Template — LEGALLY COMPLIANT v1.0
 *
 * COMPLIANCE NOTES:
 * - Perjury statement REQUIRED — notary oath authority per Ark. Code §21-14-101 et seq.;
 *   criminal perjury penalty under Ark. Code §5-53-102
 * - County is REQUIRED for Arkansas affidavits
 * - Case number label: "CASE NO."
 * - Header: "STATE OF ARKANSAS"
 * - Venue: "County of [County]" (title case per Arkansas practice)
 * - Notary block per Arkansas Notary Public Act; notary designated as "Notary Public, State of Arkansas"
 * - Notary may administer oath or affirmation (subscribed and sworn/affirmed)
 * - Exhibits labeled with letters (A, B, C)
 *
 * @class ArkansasAffidavitTemplate
 * @extends BaseAffidavitTemplate
 */
class ArkansasAffidavitTemplate extends BaseAffidavitTemplate {
  constructor() {
    super();

    this.metadata = require('./metadata.json');
    this.state = this.metadata.stateCode;
    this.stateName = this.metadata.stateName;
    this.requiredFields = this.metadata.requiredFields;

    // Arkansas requires perjury statement — notary oath authority per Ark. Code §21-14-101 et seq.;
    // criminal perjury penalty per Ark. Code §5-53-102
    this.sections.perjuryStatement = true;
  }

  /**
   * Arkansas-specific case caption using "CASE NO." terminology
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
   * Arkansas header — "STATE OF ARKANSAS"
   *
   * @returns {string} Header text
   */
  generateHeader() {
    return 'STATE OF ARKANSAS';
  }

  /**
   * Arkansas venue — "County of [County]" (title case per Arkansas practice)
   *
   * @param {string} county - County name
   * @returns {string} Venue text
   */
  generateVenue(county) {
    const countyName = county || '[COUNTY]';
    // Arkansas uses title case for venue
    const countyFormatted = countyName.charAt(0).toUpperCase() + countyName.slice(1).toLowerCase();
    return `County of ${countyFormatted}`;
  }

  /**
   * Arkansas-specific validation
   *
   * @param {Object} affidavitData - The affidavit data to validate
   * @returns {Object} Validation result with errors and warnings
   */
  performStateSpecificValidation(affidavitData) {
    const errors = [];
    const warnings = [];

    // County is REQUIRED for Arkansas affidavits
    if (!affidavitData.county || affidavitData.county.trim().length === 0) {
      errors.push('County is required for Arkansas affidavits');
    }

    return { errors, warnings };
  }

  /**
   * Arkansas notary block per Ark. Code §21-14-101 et seq. (Arkansas Notary Public Act)
   * Supports both oath and affirmation
   *
   * @param {Object} affidavitData - The affidavit data
   * @returns {string} Notary block text
   */
  generateNotaryBlock(affidavitData) {
    return `Subscribed and sworn to (or affirmed) before me this _____ day of _______________, 20___.


_________________________________
Notary Public, State of Arkansas

My commission expires: ___________

[NOTARY SEAL]`;
  }

  /**
   * Arkansas perjury statement
   * Notary oath authority: Ark. Code §21-14-101 et seq.; perjury penalty: Ark. Code §5-53-102
   *
   * @returns {string} Perjury statement text
   */
  generatePerjuryStatement() {
    return `I declare under penalty of perjury under the laws of the State of Arkansas that the foregoing is true and correct.`;
  }

  /**
   * Arkansas exhibit rules — letters, cover page required
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

module.exports = ArkansasAffidavitTemplate;
