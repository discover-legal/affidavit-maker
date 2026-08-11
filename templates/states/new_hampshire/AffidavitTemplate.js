// templates/states/new_hampshire/AffidavitTemplate.js
// New Hampshire Affidavit Template — LEGALLY COMPLIANT v1.0
// Governing Law: RSA 455 (New Hampshire Notaries Public — oath authority and notarial acts),
//                RSA 641:1 (perjury)

const BaseAffidavitTemplate = require('../../core/BaseAffidavitTemplate');

/**
 * New Hampshire Affidavit Template — LEGALLY COMPLIANT v1.0
 *
 * COMPLIANCE NOTES:
 * - Perjury statement REQUIRED — notary oath authority per RSA 455;
 *   criminal perjury penalty under RSA 641:1
 * - County is REQUIRED for New Hampshire affidavits
 * - Case number label: "CASE NO."
 * - Header: "STATE OF NEW HAMPSHIRE"
 * - Venue: "County of [County]" (title case per NH practice)
 * - Notary block per RSA 455; notary designated as "Notary Public / Justice of the Peace, State of New Hampshire"
 * - New Hampshire allows both notaries public and justices of the peace to administer oaths
 * - Notary may administer oath or affirmation (subscribed and sworn/affirmed)
 * - Exhibits labeled with letters (A, B, C)
 *
 * @class NewHampshireAffidavitTemplate
 * @extends BaseAffidavitTemplate
 */
class NewHampshireAffidavitTemplate extends BaseAffidavitTemplate {
  constructor() {
    super();

    this.metadata = require('./metadata.json');
    this.state = this.metadata.stateCode;
    this.stateName = this.metadata.stateName;
    this.requiredFields = this.metadata.requiredFields;

    // New Hampshire requires perjury statement — notary oath authority per RSA 455;
    // criminal perjury penalty per RSA 641:1
    this.sections.perjuryStatement = true;
  }

  /**
   * New Hampshire-specific case caption using "CASE NO." terminology
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
   * New Hampshire header — "STATE OF NEW HAMPSHIRE"
   *
   * @returns {string} Header text
   */
  generateHeader() {
    return 'STATE OF NEW HAMPSHIRE';
  }

  /**
   * New Hampshire venue — "County of [County]" (title case per NH practice)
   *
   * @param {string} county - County name
   * @returns {string} Venue text
   */
  generateVenue(county) {
    const countyName = county || '[COUNTY]';
    // New Hampshire uses title case for venue
    const countyFormatted = countyName.charAt(0).toUpperCase() + countyName.slice(1).toLowerCase();
    return `County of ${countyFormatted}`;
  }

  /**
   * New Hampshire-specific validation
   *
   * @param {Object} affidavitData - The affidavit data to validate
   * @returns {Object} Validation result with errors and warnings
   */
  performStateSpecificValidation(affidavitData) {
    const errors = [];
    const warnings = [];

    // County is REQUIRED for New Hampshire affidavits
    if (!affidavitData.county || affidavitData.county.trim().length === 0) {
      errors.push('County is required for New Hampshire affidavits');
    }

    return { errors, warnings };
  }

  /**
   * New Hampshire notary block per RSA 455
   * Supports both oath and affirmation; allows notary public or justice of the peace
   *
   * @param {Object} affidavitData - The affidavit data
   * @returns {string} Notary block text
   */
  generateNotaryBlock(affidavitData) {
    return `Subscribed and sworn to (or affirmed) before me this _____ day of _______________, 20___.


_________________________________
Notary Public / Justice of the Peace
State of New Hampshire

My commission expires: ___________

(SEAL)`;
  }

  /**
   * New Hampshire perjury statement
   * Notary oath authority: RSA 455; perjury penalty: RSA 641:1
   *
   * @returns {string} Perjury statement text
   */
  generatePerjuryStatement() {
    return `I declare under penalty of perjury under the laws of the State of New Hampshire that the foregoing is true and correct.`;
  }

  /**
   * New Hampshire exhibit rules — letters, cover page required
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

module.exports = NewHampshireAffidavitTemplate;
