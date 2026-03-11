// templates/states/alaska/AffidavitTemplate.js
// Alaska Affidavit Template — LEGALLY COMPLIANT v1.0
// Governing Law: AS 09.63 (Alaska Notary Public Act — oath authority and notarial acts),
//                AS 11.56.200 (perjury)

const BaseAffidavitTemplate = require('../../core/BaseAffidavitTemplate');

/**
 * Alaska Affidavit Template — LEGALLY COMPLIANT v1.0
 *
 * COMPLIANCE NOTES:
 * - Perjury statement REQUIRED — notary oath authority per AS 09.63;
 *   criminal perjury penalty under AS 11.56.200
 * - County/judicial district is REQUIRED for Alaska affidavits
 * - Case number label: "CASE NO."
 * - Header: "STATE OF ALASKA"
 * - Venue: "Judicial District of [District]" (title case per Alaska practice)
 * - Notary block per AS 09.63 (Alaska Notary Public Act); notary designated as "Notary Public, State of Alaska"
 * - Notary may administer oath or affirmation (subscribed and sworn/affirmed)
 * - Exhibits labeled with letters (A, B, C)
 *
 * @class AlaskaAffidavitTemplate
 * @extends BaseAffidavitTemplate
 */
class AlaskaAffidavitTemplate extends BaseAffidavitTemplate {
  constructor() {
    super();

    this.metadata = require('./metadata.json');
    this.state = this.metadata.stateCode;
    this.stateName = this.metadata.stateName;
    this.requiredFields = this.metadata.requiredFields;

    // Alaska requires perjury statement — notary oath authority per AS 09.63;
    // criminal perjury penalty per AS 11.56.200
    this.sections.perjuryStatement = true;
  }

  /**
   * Alaska-specific case caption using "CASE NO." terminology
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
   * Alaska header — "STATE OF ALASKA"
   *
   * @returns {string} Header text
   */
  generateHeader() {
    return 'STATE OF ALASKA';
  }

  /**
   * Alaska venue — "Judicial District of [District]" (title case per Alaska practice)
   *
   * @param {string} county - County/judicial district name
   * @returns {string} Venue text
   */
  generateVenue(county) {
    const countyName = county || '[JUDICIAL DISTRICT]';
    const countyFormatted = countyName.charAt(0).toUpperCase() + countyName.slice(1).toLowerCase();
    return `Judicial District of ${countyFormatted}`;
  }

  /**
   * Alaska-specific validation
   *
   * @param {Object} affidavitData - The affidavit data to validate
   * @returns {Object} Validation result with errors and warnings
   */
  performStateSpecificValidation(affidavitData) {
    const errors = [];
    const warnings = [];

    // County/judicial district is REQUIRED for Alaska affidavits
    if (!affidavitData.county || affidavitData.county.trim().length === 0) {
      errors.push('County or judicial district is required for Alaska affidavits');
    }

    return { errors, warnings };
  }

  /**
   * Alaska notary block per AS 09.63 (Alaska Notary Public Act)
   * Supports both oath and affirmation
   *
   * @param {Object} affidavitData - The affidavit data
   * @returns {string} Notary block text
   */
  generateNotaryBlock(affidavitData) {
    return `Subscribed and sworn to (or affirmed) before me this _____ day of _______________, 20___.


_________________________________
Notary Public, State of Alaska

My commission expires: ___________

[NOTARY SEAL]`;
  }

  /**
   * Alaska perjury statement
   * Notary oath authority: AS 09.63; perjury penalty: AS 11.56.200
   *
   * @returns {string} Perjury statement text
   */
  generatePerjuryStatement() {
    return `I declare under penalty of perjury under the laws of the State of Alaska that the foregoing is true and correct.`;
  }

  /**
   * Alaska exhibit rules — letters, cover page required
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

module.exports = AlaskaAffidavitTemplate;
