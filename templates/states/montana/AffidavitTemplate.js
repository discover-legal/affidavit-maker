// templates/states/montana/AffidavitTemplate.js
// Montana Affidavit Template — LEGALLY COMPLIANT v1.0
// Governing Law: MCA §1-5-601 (Montana Notarial Acts — oath authority and notarial acts),
//                MCA §45-7-201 (perjury)

const BaseAffidavitTemplate = require('../../core/BaseAffidavitTemplate');

/**
 * Montana Affidavit Template — LEGALLY COMPLIANT v1.0
 *
 * COMPLIANCE NOTES:
 * - Perjury statement REQUIRED — notary oath authority per MCA §1-5-601;
 *   criminal perjury penalty under MCA §45-7-201
 * - County is REQUIRED for Montana affidavits
 * - Case number label: "CAUSE NO."
 * - Header: "STATE OF MONTANA"
 * - Venue: "County of [County]" (title case per Montana practice)
 * - Notary block per MCA §1-5-601; notary designated as "Notary Public for the State of Montana"
 * - Montana notary must include residency information
 * - Notary may administer oath or affirmation (subscribed and sworn/affirmed)
 * - Exhibits labeled with letters (A, B, C)
 *
 * @class MontanaAffidavitTemplate
 * @extends BaseAffidavitTemplate
 */
class MontanaAffidavitTemplate extends BaseAffidavitTemplate {
  constructor() {
    super();

    this.metadata = require('./metadata.json');
    this.state = this.metadata.stateCode;
    this.stateName = this.metadata.stateName;
    this.requiredFields = this.metadata.requiredFields;

    // Montana requires perjury statement — notary oath authority per MCA §1-5-601;
    // criminal perjury penalty per MCA §45-7-201
    this.sections.perjuryStatement = true;
  }

  /**
   * Montana-specific case caption using "CAUSE NO." terminology
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
    caption += `CAUSE NO. ${caseNumber.toUpperCase()}\n\n`;

    const plaintiff = affidavitData.plaintiff || '[PLAINTIFF NAME]';
    const defendant = affidavitData.defendant || '[DEFENDANT NAME]';

    caption += `${plaintiff.toUpperCase()},\n`;
    caption += `    Petitioner,\n\n`;
    caption += `v.\n\n`;
    caption += `${defendant.toUpperCase()},\n`;
    caption += `    Respondent.`;

    return {
      courtName,
      caseNumber: affidavitData.caseNumber,
      plaintiff: affidavitData.plaintiff,
      defendant: affidavitData.defendant,
      formatted: caption
    };
  }

  /**
   * Montana header — "STATE OF MONTANA"
   *
   * @returns {string} Header text
   */
  generateHeader() {
    return 'STATE OF MONTANA';
  }

  /**
   * Montana venue — "County of [County]" (title case per Montana practice)
   *
   * @param {string} county - County name
   * @returns {string} Venue text
   */
  generateVenue(county) {
    const countyName = county || '[COUNTY]';
    // Montana uses title case for venue
    const countyFormatted = countyName.charAt(0).toUpperCase() + countyName.slice(1).toLowerCase();
    return `County of ${countyFormatted}`;
  }

  /**
   * Montana-specific validation
   *
   * @param {Object} affidavitData - The affidavit data to validate
   * @returns {Object} Validation result with errors and warnings
   */
  performStateSpecificValidation(affidavitData) {
    const errors = [];
    const warnings = [];

    // County is REQUIRED for Montana affidavits
    if (!affidavitData.county || affidavitData.county.trim().length === 0) {
      errors.push('County is required for Montana affidavits');
    }

    return { errors, warnings };
  }

  /**
   * Montana notary block per MCA §1-5-601
   * Supports both oath and affirmation; notary must include residency
   *
   * @param {Object} affidavitData - The affidavit data
   * @returns {string} Notary block text
   */
  generateNotaryBlock(affidavitData) {
    return `Subscribed and sworn to (or affirmed) before me this _____ day of _______________, 20___.


_________________________________
Notary Public for the State of Montana
Residing at: _______________________

My commission expires: ___________

[NOTARY SEAL]`;
  }

  /**
   * Montana perjury statement
   * Notary oath authority: MCA §1-5-601; perjury penalty: MCA §45-7-201
   *
   * @returns {string} Perjury statement text
   */
  generatePerjuryStatement() {
    return `I declare under penalty of perjury under the laws of the State of Montana that the foregoing is true and correct.`;
  }

  /**
   * Montana exhibit rules — letters, cover page required
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

module.exports = MontanaAffidavitTemplate;
