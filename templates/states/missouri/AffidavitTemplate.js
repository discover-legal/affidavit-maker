// templates/states/missouri/AffidavitTemplate.js
// Missouri Affidavit Template — LEGALLY COMPLIANT v1.0
// Governing Law: RSMo 486 (Missouri Notary Public Act — oath authority and notarial acts),
//                RSMo 575.040 (perjury)

const BaseAffidavitTemplate = require('../../core/BaseAffidavitTemplate');

/**
 * Missouri Affidavit Template — LEGALLY COMPLIANT v1.0
 *
 * COMPLIANCE NOTES:
 * - Perjury statement REQUIRED — notary oath authority per RSMo 486;
 *   criminal perjury penalty under RSMo 575.040
 * - County is REQUIRED for Missouri affidavits
 * - Case number label: "CASE NO."
 * - Header: "STATE OF MISSOURI"
 * - Venue: "County of [County]" (title case per Missouri practice)
 * - Notary block per RSMo 486 (Missouri Notary Public Act); notary designated as "Notary Public, State of Missouri"
 * - Notary may administer oath or affirmation (subscribed and sworn/affirmed)
 * - Exhibits labeled with letters (A, B, C)
 *
 * @class MissouriAffidavitTemplate
 * @extends BaseAffidavitTemplate
 */
class MissouriAffidavitTemplate extends BaseAffidavitTemplate {
  constructor() {
    super();

    this.metadata = require('./metadata.json');
    this.state = this.metadata.stateCode;
    this.stateName = this.metadata.stateName;
    this.requiredFields = this.metadata.requiredFields;

    // Missouri requires perjury statement — notary oath authority per RSMo 486;
    // criminal perjury penalty per RSMo 575.040
    this.sections.perjuryStatement = true;
  }

  /**
   * Missouri-specific case caption using "CASE NO." terminology
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
   * Missouri header — "STATE OF MISSOURI"
   *
   * @returns {string} Header text
   */
  generateHeader() {
    return 'STATE OF MISSOURI';
  }

  /**
   * Missouri venue — "County of [County]" (title case per Missouri practice)
   *
   * @param {string} county - County name
   * @returns {string} Venue text
   */
  generateVenue(county) {
    const countyName = county || '[COUNTY]';
    // Missouri uses title case for venue
    const countyFormatted = countyName.charAt(0).toUpperCase() + countyName.slice(1).toLowerCase();
    return `County of ${countyFormatted}`;
  }

  /**
   * Missouri-specific validation
   *
   * @param {Object} affidavitData - The affidavit data to validate
   * @returns {Object} Validation result with errors and warnings
   */
  performStateSpecificValidation(affidavitData) {
    const errors = [];
    const warnings = [];

    // County is REQUIRED for Missouri affidavits
    if (!affidavitData.county || affidavitData.county.trim().length === 0) {
      errors.push('County is required for Missouri affidavits');
    }

    return { errors, warnings };
  }

  /**
   * Missouri notary block per RSMo 486 (Missouri Notary Public Act)
   * Supports both oath and affirmation per Missouri Notary Public Act
   *
   * @param {Object} affidavitData - The affidavit data
   * @returns {string} Notary block text
   */
  generateNotaryBlock(affidavitData) {
    return `Subscribed and sworn to (or affirmed) before me this _____ day of _______________, 20___.


_________________________________
Notary Public, State of Missouri

My commission expires: ___________

[NOTARY SEAL]`;
  }

  /**
   * Missouri perjury statement
   * Notary oath authority: RSMo 486; perjury penalty: RSMo 575.040
   *
   * @returns {string} Perjury statement text
   */
  generatePerjuryStatement() {
    return `I declare under penalty of perjury under the laws of the State of Missouri that the foregoing is true and correct.`;
  }

  /**
   * Missouri exhibit rules — letters, cover page required
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

module.exports = MissouriAffidavitTemplate;
