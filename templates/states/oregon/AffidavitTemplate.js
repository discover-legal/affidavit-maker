// templates/states/oregon/AffidavitTemplate.js
// Oregon Affidavit Template — LEGALLY COMPLIANT v1.0
// Governing Law: ORS §194 (Oregon Notary Public Act — oath authority and notarial acts),
//                ORS §162.065 (perjury)

const BaseAffidavitTemplate = require('../../core/BaseAffidavitTemplate');

/**
 * Oregon Affidavit Template — LEGALLY COMPLIANT v1.0
 *
 * COMPLIANCE NOTES:
 * - Perjury statement REQUIRED — notary oath authority per ORS §194;
 *   criminal perjury penalty under ORS §162.065
 * - County is REQUIRED for Oregon affidavits
 * - Case number label: "CASE NO."
 * - Header: "IN THE CIRCUIT COURT OF THE STATE OF OREGON"
 * - Venue: "FOR THE COUNTY OF [County]" (uppercase per Oregon practice)
 * - Notary block per ORS §194 (Oregon Notary Public Act); notary designated as "Notary Public for Oregon"
 * - Notary may administer oath or affirmation (subscribed and sworn/affirmed)
 * - Exhibits labeled with letters (A, B, C)
 *
 * @class OregonAffidavitTemplate
 * @extends BaseAffidavitTemplate
 */
class OregonAffidavitTemplate extends BaseAffidavitTemplate {
  constructor() {
    super();

    this.metadata = require('./metadata.json');
    this.state = this.metadata.stateCode;
    this.stateName = this.metadata.stateName;
    this.requiredFields = this.metadata.requiredFields;

    // Oregon requires perjury statement — notary oath authority per ORS §194;
    // criminal perjury penalty per ORS §162.065
    this.sections.perjuryStatement = true;
  }

  /**
   * Oregon-specific case caption using "CASE NO." terminology
   *
   * @param {Object} affidavitData - The affidavit data
   * @returns {Object} Case caption with formatted text
   */
  generateCaseCaption(affidavitData) {
    let caption = '';

    let courtName = affidavitData.court || affidavitData.courtName || 'IN THE CIRCUIT COURT OF THE STATE OF OREGON';
    courtName = courtName.toUpperCase();

    caption += `${courtName}\n`;

    const county = affidavitData.county || '[COUNTY]';
    caption += `FOR THE COUNTY OF ${county.toUpperCase()}\n\n`;

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
   * Oregon header — "IN THE CIRCUIT COURT OF THE STATE OF OREGON"
   *
   * @returns {string} Header text
   */
  generateHeader() {
    return 'IN THE CIRCUIT COURT OF THE STATE OF OREGON';
  }

  /**
   * Oregon venue — "FOR THE COUNTY OF [County]" (uppercase per Oregon practice)
   *
   * @param {string} county - County name
   * @returns {string} Venue text
   */
  generateVenue(county) {
    const countyName = county || '[COUNTY]';
    return `FOR THE COUNTY OF ${countyName.toUpperCase()}`;
  }

  /**
   * Oregon-specific validation
   *
   * @param {Object} affidavitData - The affidavit data to validate
   * @returns {Object} Validation result with errors and warnings
   */
  performStateSpecificValidation(affidavitData) {
    const errors = [];
    const warnings = [];

    // County is REQUIRED for Oregon affidavits
    if (!affidavitData.county || affidavitData.county.trim().length === 0) {
      errors.push('County is required for Oregon affidavits');
    }

    return { errors, warnings };
  }

  /**
   * Oregon notary block per ORS §194 (Oregon Notary Public Act)
   * Supports both oath and affirmation
   *
   * @param {Object} affidavitData - The affidavit data
   * @returns {string} Notary block text
   */
  generateNotaryBlock(affidavitData) {
    return `Subscribed and sworn to (or affirmed) before me this _____ day of _______________, 20___.


_________________________________
Notary Public for Oregon

My commission expires: ___________

(SEAL)`;
  }

  /**
   * Oregon perjury statement
   * Notary oath authority: ORS §194; perjury penalty: ORS §162.065
   *
   * @returns {string} Perjury statement text
   */
  generatePerjuryStatement() {
    return `I declare under penalty of perjury under the laws of the State of Oregon that the foregoing is true and correct.`;
  }

  /**
   * Oregon exhibit rules — letters, cover page required
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

module.exports = OregonAffidavitTemplate;
