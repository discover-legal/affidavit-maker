// templates/states/washington/AffidavitTemplate.js
// Washington State Affidavit Template — LEGALLY COMPLIANT v1.0
// Governing Law: RCW 9A.72.085 (perjury/declarations), RCW 42.44 (notary)

const BaseAffidavitTemplate = require('../../core/BaseAffidavitTemplate');

/**
 * Washington State Affidavit Template — LEGALLY COMPLIANT v1.0
 *
 * COMPLIANCE NOTES:
 * - Perjury statement REQUIRED per RCW 9A.72.085
 * - County is REQUIRED for Washington affidavits
 * - Case number label: "NO."
 * - Header: "STATE OF WASHINGTON"
 * - Venue: "County of [County]" (uppercase per WA practice)
 * - Notary block per RCW 42.44 (Uniform Notarial Acts)
 * - Notary designated as "in and for the State of Washington"
 * - Includes printed name and residence lines per WA practice
 * - Exhibits labeled with letters (A, B, C)
 *
 * @class WashingtonAffidavitTemplate
 * @extends BaseAffidavitTemplate
 */
class WashingtonAffidavitTemplate extends BaseAffidavitTemplate {
  constructor() {
    super();

    this.metadata = require('./metadata.json');
    this.state = this.metadata.stateCode;
    this.stateName = this.metadata.stateName;
    this.requiredFields = this.metadata.requiredFields;

    // Washington requires perjury statement per RCW 9A.72.085
    this.sections.perjuryStatement = true;
  }

  /**
   * Washington-specific case caption using "NO." terminology
   *
   * @param {Object} affidavitData - The affidavit data
   * @returns {Object} Case caption with formatted text
   */
  generateCaseCaption(affidavitData) {
    let caption = '';

    let courtName = affidavitData.court || affidavitData.courtName || '[COURT NAME]';
    courtName = courtName.toUpperCase();

    caption += `IN THE ${courtName}\n\n`;

    // Washington uses "NO." as the case number label
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
   * Washington header — "STATE OF WASHINGTON"
   *
   * @returns {string} Header text
   */
  generateHeader() {
    return 'STATE OF WASHINGTON';
  }

  /**
   * Washington venue — "County of [County]"
   *
   * @param {string} county - County name
   * @returns {string} Venue text
   */
  generateVenue(county) {
    const countyUpper = (county || '[COUNTY]').toUpperCase();
    return `COUNTY OF ${countyUpper}`;
  }

  /**
   * Washington-specific validation
   *
   * @param {Object} affidavitData - The affidavit data to validate
   * @returns {Object} Validation result with errors and warnings
   */
  performStateSpecificValidation(affidavitData) {
    const errors = [];
    const warnings = [];

    // County is REQUIRED for Washington affidavits
    if (!affidavitData.county || affidavitData.county.trim().length === 0) {
      errors.push('County is required for Washington affidavits');
    }

    return { errors, warnings };
  }

  /**
   * Washington notary block per RCW 42.44 (Uniform Notarial Acts)
   * Includes "in and for the State of Washington" designation,
   * printed name line, and residence line per Washington practice
   *
   * @param {Object} affidavitData - The affidavit data
   * @returns {string} Notary block text
   */
  generateNotaryBlock(affidavitData) {
    return `SUBSCRIBED AND SWORN to before me this _____ day of _______________, 20___.


_________________________________
Notary Public in and for the State of Washington

Printed Name: ___________________

Residing at: ___________________

My appointment expires: ___________

(SEAL)`;
  }

  /**
   * Washington perjury statement per RCW 9A.72.085
   *
   * @returns {string} Perjury statement text
   */
  generatePerjuryStatement() {
    return `I declare under penalty of perjury under the laws of the State of Washington that the foregoing is true and correct.`;
  }

  /**
   * Washington exhibit rules — letters, cover page required
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
      instructions: 'Label exhibits sequentially (Exhibit A, Exhibit B, etc.) and reference each exhibit in the body of the affidavit. Attach all exhibits at the end of the document after the notary block.'
    };
  }
}

module.exports = WashingtonAffidavitTemplate;
