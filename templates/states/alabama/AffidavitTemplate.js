// templates/states/alabama/AffidavitTemplate.js
// Alabama Affidavit Template — LEGALLY COMPLIANT v1.0
// Governing Law: Ala. Code §36-20-73 (notary public, authority to administer oaths),
//                Ala. Code §13A-10-101 (perjury in the first degree)

const BaseAffidavitTemplate = require('../../core/BaseAffidavitTemplate');

/**
 * Alabama Affidavit Template — LEGALLY COMPLIANT v1.0
 *
 * COMPLIANCE NOTES:
 * - Perjury statement REQUIRED — notary oath authority per Ala. Code §36-20-73;
 *   criminal perjury penalty under Ala. Code §13A-10-101
 * - County is REQUIRED for Alabama affidavits
 * - Case number label: "CASE NO."
 * - Header: "STATE OF ALABAMA"
 * - Venue: "COUNTY OF [COUNTY]" (uppercase per Alabama practice)
 * - Notary block per Ala. Code §36-20-73; notary designated as "Notary Public, State of Alabama"
 * - Alabama notary includes commission expiration
 * - Exhibits labeled with letters (A, B, C)
 *
 * @class AlabamaAffidavitTemplate
 * @extends BaseAffidavitTemplate
 */
class AlabamaAffidavitTemplate extends BaseAffidavitTemplate {
  constructor() {
    super();

    this.metadata = require('./metadata.json');
    this.state = this.metadata.stateCode;
    this.stateName = this.metadata.stateName;
    this.requiredFields = this.metadata.requiredFields;

    // Alabama requires perjury statement — notary oath authority per Ala. Code §36-20-73;
    // criminal perjury penalty per Ala. Code §13A-10-101
    this.sections.perjuryStatement = true;
  }

  /**
   * Alabama-specific case caption using "CASE NO." terminology
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
   * Alabama header — "STATE OF ALABAMA"
   *
   * @returns {string} Header text
   */
  generateHeader() {
    return 'STATE OF ALABAMA';
  }

  /**
   * Alabama venue — "COUNTY OF [COUNTY]" (uppercase per Alabama practice)
   *
   * @param {string} county - County name
   * @returns {string} Venue text
   */
  generateVenue(county) {
    const countyName = county || '[COUNTY]';
    return `COUNTY OF ${countyName.toUpperCase()}`;
  }

  /**
   * Alabama-specific validation
   *
   * @param {Object} affidavitData - The affidavit data to validate
   * @returns {Object} Validation result with errors and warnings
   */
  performStateSpecificValidation(affidavitData) {
    const errors = [];
    const warnings = [];

    // County is REQUIRED for Alabama affidavits
    if (!affidavitData.county || affidavitData.county.trim().length === 0) {
      errors.push('County is required for Alabama affidavits');
    }

    return { errors, warnings };
  }

  /**
   * Alabama notary block per Ala. Code §36-20-73
   *
   * @param {Object} affidavitData - The affidavit data
   * @returns {string} Notary block text
   */
  generateNotaryBlock(affidavitData) {
    return `Subscribed and sworn to before me this _____ day of _______________, 20___.


_________________________________
Notary Public, State of Alabama

My commission expires: ___________

[NOTARY SEAL]`;
  }

  /**
   * Alabama perjury statement
   * Notary oath authority: Ala. Code §36-20-73; perjury penalty: Ala. Code §13A-10-101
   *
   * @returns {string} Perjury statement text
   */
  generatePerjuryStatement() {
    return `I declare under penalty of perjury under the laws of the State of Alabama that the foregoing is true and correct.`;
  }

  /**
   * Alabama exhibit rules — letters, cover page required
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

module.exports = AlabamaAffidavitTemplate;
