// templates/states/oklahoma/AffidavitTemplate.js
// Oklahoma Affidavit Template — LEGALLY COMPLIANT v1.0
// Governing Law: 49 O.S. §113 (Oklahoma notarial acts — oath authority),
//                21 O.S. §491 (perjury)

const BaseAffidavitTemplate = require('../../core/BaseAffidavitTemplate');

/**
 * Oklahoma Affidavit Template — LEGALLY COMPLIANT v1.0
 *
 * COMPLIANCE NOTES:
 * - Perjury statement REQUIRED — notary oath authority per 49 O.S. §113;
 *   criminal perjury penalty under 21 O.S. §491
 * - County is REQUIRED for Oklahoma affidavits
 * - Case number label: "CASE NO."
 * - Header: "STATE OF OKLAHOMA"
 * - Venue: "County of [County]" (title case per Oklahoma practice)
 * - Notary block per 49 O.S. §113 (Oklahoma notarial acts); notary designated
 *   as "Notary Public, State of Oklahoma"
 * - Oklahoma notary must include commission number and expiration
 * - Notary may administer oath or affirmation (subscribed and sworn/affirmed)
 * - Exhibits labeled with letters (A, B, C)
 *
 * @class OklahomaAffidavitTemplate
 * @extends BaseAffidavitTemplate
 */
class OklahomaAffidavitTemplate extends BaseAffidavitTemplate {
  constructor() {
    super();

    this.metadata = require('./metadata.json');
    this.state = this.metadata.stateCode;
    this.stateName = this.metadata.stateName;
    this.requiredFields = this.metadata.requiredFields;

    // Oklahoma requires perjury statement — notary oath authority per 49 O.S. §113;
    // criminal perjury penalty per 21 O.S. §491
    this.sections.perjuryStatement = true;
  }

  /**
   * Oklahoma-specific case caption using "CASE NO." terminology
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
   * Oklahoma header — "STATE OF OKLAHOMA"
   *
   * @returns {string} Header text
   */
  generateHeader() {
    return 'STATE OF OKLAHOMA';
  }

  /**
   * Oklahoma venue — "County of [County]" (title case per Oklahoma practice)
   *
   * @param {string} county - County name
   * @returns {string} Venue text
   */
  generateVenue(county) {
    const countyName = county || '[COUNTY]';
    // Oklahoma uses title case for venue
    const countyFormatted = countyName.charAt(0).toUpperCase() + countyName.slice(1).toLowerCase();
    return `County of ${countyFormatted}`;
  }

  /**
   * Oklahoma-specific validation
   *
   * @param {Object} affidavitData - The affidavit data to validate
   * @returns {Object} Validation result with errors and warnings
   */
  performStateSpecificValidation(affidavitData) {
    const errors = [];
    const warnings = [];

    // County is REQUIRED for Oklahoma affidavits
    if (!affidavitData.county || affidavitData.county.trim().length === 0) {
      errors.push('County is required for Oklahoma affidavits');
    }

    return { errors, warnings };
  }

  /**
   * Oklahoma notary block per 49 O.S. §113 (Oklahoma notarial acts)
   * Supports both oath and affirmation; notary must include commission number
   * and expiration
   *
   * @param {Object} affidavitData - The affidavit data
   * @returns {string} Notary block text
   */
  generateNotaryBlock(affidavitData) {
    return `Subscribed and sworn to (or affirmed) before me this _____ day of _______________, 20___.


_________________________________
Notary Public, State of Oklahoma

My commission number: ____________
My commission expires: ___________

[NOTARY SEAL]`;
  }

  /**
   * Oklahoma perjury statement
   * Notary oath authority: 49 O.S. §113; perjury penalty: 21 O.S. §491
   *
   * @returns {string} Perjury statement text
   */
  generatePerjuryStatement() {
    return `I declare under penalty of perjury under the laws of the State of Oklahoma that the foregoing is true and correct.`;
  }

  /**
   * Oklahoma exhibit rules — letters, cover page required
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

module.exports = OklahomaAffidavitTemplate;
