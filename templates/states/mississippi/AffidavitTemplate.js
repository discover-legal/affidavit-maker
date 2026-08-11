// templates/states/mississippi/AffidavitTemplate.js
// Mississippi Affidavit Template — LEGALLY COMPLIANT v1.0
// Governing Law: Miss. Code §25-33-1 et seq. (Mississippi Notary Public Act — oath authority and notarial acts),
//                Miss. Code §97-9-59 (perjury)

const BaseAffidavitTemplate = require('../../core/BaseAffidavitTemplate');

/**
 * Mississippi Affidavit Template — LEGALLY COMPLIANT v1.0
 *
 * COMPLIANCE NOTES:
 * - Perjury statement REQUIRED — notary oath authority per Miss. Code §25-33-1 et seq.;
 *   criminal perjury penalty under Miss. Code §97-9-59
 * - County is REQUIRED for Mississippi affidavits
 * - Case number label: "CAUSE NO."
 * - Header: "STATE OF MISSISSIPPI"
 * - Venue: "County of [County]" (title case per Mississippi practice)
 * - Notary block per Mississippi Notary Public Act; notary designated as "Notary Public, State of Mississippi"
 * - Notary may administer oath or affirmation (subscribed and sworn/affirmed)
 * - Exhibits labeled with letters (A, B, C)
 * - Mississippi uses Chancery Court for domestic matters
 * - Mississippi uniquely uses "Complainant" (not Plaintiff/Petitioner)
 *
 * @class MississippiAffidavitTemplate
 * @extends BaseAffidavitTemplate
 */
class MississippiAffidavitTemplate extends BaseAffidavitTemplate {
  constructor() {
    super();

    this.metadata = require('./metadata.json');
    this.state = this.metadata.stateCode;
    this.stateName = this.metadata.stateName;
    this.requiredFields = this.metadata.requiredFields;

    // Mississippi requires perjury statement — notary oath authority per Miss. Code §25-33-1 et seq.;
    // criminal perjury penalty per Miss. Code §97-9-59
    this.sections.perjuryStatement = true;
  }

  /**
   * Mississippi-specific case caption using "CAUSE NO." terminology
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

    const plaintiff = affidavitData.plaintiff || '[COMPLAINANT NAME]';
    const defendant = affidavitData.defendant || '[DEFENDANT NAME]';

    caption += `${plaintiff.toUpperCase()},\n`;
    caption += `    Complainant,\n\n`;
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
   * Mississippi header — "STATE OF MISSISSIPPI"
   *
   * @returns {string} Header text
   */
  generateHeader() {
    return 'STATE OF MISSISSIPPI';
  }

  /**
   * Mississippi venue — "County of [County]" (title case per Mississippi practice)
   *
   * @param {string} county - County name
   * @returns {string} Venue text
   */
  generateVenue(county) {
    const countyName = county || '[COUNTY]';
    // Mississippi uses title case for venue
    const countyFormatted = countyName.charAt(0).toUpperCase() + countyName.slice(1).toLowerCase();
    return `County of ${countyFormatted}`;
  }

  /**
   * Mississippi-specific validation
   *
   * @param {Object} affidavitData - The affidavit data to validate
   * @returns {Object} Validation result with errors and warnings
   */
  performStateSpecificValidation(affidavitData) {
    const errors = [];
    const warnings = [];

    // County is REQUIRED for Mississippi affidavits
    if (!affidavitData.county || affidavitData.county.trim().length === 0) {
      errors.push('County is required for Mississippi affidavits');
    }

    return { errors, warnings };
  }

  /**
   * Mississippi notary block per Miss. Code §25-33-1 et seq. (Mississippi Notary Public Act)
   * Supports both oath and affirmation
   *
   * @param {Object} affidavitData - The affidavit data
   * @returns {string} Notary block text
   */
  generateNotaryBlock(affidavitData) {
    return `Subscribed and sworn to (or affirmed) before me this _____ day of _______________, 20___.


_________________________________
Notary Public, State of Mississippi

My commission expires: ___________

(SEAL)`;
  }

  /**
   * Mississippi perjury statement
   * Notary oath authority: Miss. Code §25-33-1 et seq.; perjury penalty: Miss. Code §97-9-59
   *
   * @returns {string} Perjury statement text
   */
  generatePerjuryStatement() {
    return `I declare under penalty of perjury under the laws of the State of Mississippi that the foregoing is true and correct.`;
  }

  /**
   * Mississippi exhibit rules — letters, cover page required
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

module.exports = MississippiAffidavitTemplate;
