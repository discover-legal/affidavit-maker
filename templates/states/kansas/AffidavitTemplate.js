// templates/states/kansas/AffidavitTemplate.js
// Kansas Affidavit Template — LEGALLY COMPLIANT v1.0
// Governing Law: K.S.A. §53-101 et seq. (Kansas Notary Public Act — oath authority and notarial acts),
//                K.S.A. §21-5903 (perjury)

const BaseAffidavitTemplate = require('../../core/BaseAffidavitTemplate');

/**
 * Kansas Affidavit Template — LEGALLY COMPLIANT v1.0
 *
 * COMPLIANCE NOTES:
 * - Perjury statement REQUIRED — notary oath authority per K.S.A. §53-101 et seq.;
 *   criminal perjury penalty under K.S.A. §21-5903
 * - County is REQUIRED for Kansas affidavits
 * - Case number label: "CASE NO."
 * - Header: "STATE OF KANSAS"
 * - Venue: "County of [County]" (title case per Kansas practice)
 * - Notary block per Kansas Notary Public Act; notary designated as "Notary Public, State of Kansas"
 * - Notary may administer oath or affirmation (subscribed and sworn/affirmed)
 * - Exhibits labeled with letters (A, B, C)
 *
 * @class KansasAffidavitTemplate
 * @extends BaseAffidavitTemplate
 */
class KansasAffidavitTemplate extends BaseAffidavitTemplate {
  constructor() {
    super();

    this.metadata = require('./metadata.json');
    this.state = this.metadata.stateCode;
    this.stateName = this.metadata.stateName;
    this.requiredFields = this.metadata.requiredFields;

    // Kansas requires perjury statement — notary oath authority per K.S.A. §53-101 et seq.;
    // criminal perjury penalty per K.S.A. §21-5903
    this.sections.perjuryStatement = true;
  }

  /**
   * Kansas-specific case caption using "CASE NO." terminology
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

    const plaintiff = affidavitData.plaintiff || '[PETITIONER NAME]';
    const defendant = affidavitData.defendant || '[RESPONDENT NAME]';

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
   * Kansas header — "STATE OF KANSAS"
   *
   * @returns {string} Header text
   */
  generateHeader() {
    return 'STATE OF KANSAS';
  }

  /**
   * Kansas venue — "County of [County]" (title case per Kansas practice)
   *
   * @param {string} county - County name
   * @returns {string} Venue text
   */
  generateVenue(county) {
    const countyName = county || '[COUNTY]';
    // Kansas uses title case for venue
    const countyFormatted = countyName.charAt(0).toUpperCase() + countyName.slice(1).toLowerCase();
    return `County of ${countyFormatted}`;
  }

  /**
   * Kansas-specific validation
   *
   * @param {Object} affidavitData - The affidavit data to validate
   * @returns {Object} Validation result with errors and warnings
   */
  performStateSpecificValidation(affidavitData) {
    const errors = [];
    const warnings = [];

    // County is REQUIRED for Kansas affidavits
    if (!affidavitData.county || affidavitData.county.trim().length === 0) {
      errors.push('County is required for Kansas affidavits');
    }

    return { errors, warnings };
  }

  /**
   * Kansas notary block per K.S.A. §53-101 et seq. (Kansas Notary Public Act)
   * Supports both oath and affirmation
   *
   * @param {Object} affidavitData - The affidavit data
   * @returns {string} Notary block text
   */
  generateNotaryBlock(affidavitData) {
    return `Subscribed and sworn to (or affirmed) before me this _____ day of _______________, 20___.


_________________________________
Notary Public, State of Kansas

My commission expires: ___________

[NOTARY SEAL]`;
  }

  /**
   * Kansas perjury statement
   * Notary oath authority: K.S.A. §53-101 et seq.; perjury penalty: K.S.A. §21-5903
   *
   * @returns {string} Perjury statement text
   */
  generatePerjuryStatement() {
    return `I declare under penalty of perjury under the laws of the State of Kansas that the foregoing is true and correct.`;
  }

  /**
   * Kansas exhibit rules — letters, cover page required
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

module.exports = KansasAffidavitTemplate;
