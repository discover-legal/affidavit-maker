// templates/states/south_carolina/AffidavitTemplate.js
// South Carolina Affidavit Template — LEGALLY COMPLIANT v1.0
// Governing Law: S.C. Code §30-1-10 (oaths and affidavits),
//                S.C. Code §16-9-10 (perjury)

const BaseAffidavitTemplate = require('../../core/BaseAffidavitTemplate');

/**
 * South Carolina Affidavit Template — LEGALLY COMPLIANT v1.0
 *
 * COMPLIANCE NOTES:
 * - Perjury statement REQUIRED — oath authority per S.C. Code §30-1-10;
 *   criminal perjury penalty under S.C. Code §16-9-10
 * - County is REQUIRED for South Carolina affidavits
 * - Case number label: "CIVIL ACTION NO."
 * - Header: "STATE OF SOUTH CAROLINA"
 * - Venue: "COUNTY OF [COUNTY]" (uppercase per South Carolina practice)
 * - Notary block: notary designated as "Notary Public for South Carolina"
 * - Notary may administer oath or affirmation (subscribed and sworn)
 * - Exhibits labeled with letters (A, B, C)
 *
 * @class SouthCarolinaAffidavitTemplate
 * @extends BaseAffidavitTemplate
 */
class SouthCarolinaAffidavitTemplate extends BaseAffidavitTemplate {
  constructor() {
    super();

    this.metadata = require('./metadata.json');
    this.state = this.metadata.stateCode;
    this.stateName = this.metadata.stateName;
    this.requiredFields = this.metadata.requiredFields;

    // South Carolina requires perjury statement — oath authority per S.C. Code §30-1-10;
    // criminal perjury penalty per S.C. Code §16-9-10
    this.sections.perjuryStatement = true;
  }

  /**
   * South Carolina-specific case caption using "CIVIL ACTION NO." terminology
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
    caption += `CIVIL ACTION NO. ${caseNumber.toUpperCase()}\n\n`;

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
   * South Carolina header — "STATE OF SOUTH CAROLINA"
   *
   * @returns {string} Header text
   */
  generateHeader() {
    return 'STATE OF SOUTH CAROLINA';
  }

  /**
   * South Carolina venue — "COUNTY OF [COUNTY]" (uppercase per South Carolina practice)
   *
   * @param {string} county - County name
   * @returns {string} Venue text
   */
  generateVenue(county) {
    const countyName = county || '[COUNTY]';
    return `COUNTY OF ${countyName.toUpperCase()}`;
  }

  /**
   * South Carolina-specific validation
   *
   * @param {Object} affidavitData - The affidavit data to validate
   * @returns {Object} Validation result with errors and warnings
   */
  performStateSpecificValidation(affidavitData) {
    const errors = [];
    const warnings = [];

    // County is REQUIRED for South Carolina affidavits
    if (!affidavitData.county || affidavitData.county.trim().length === 0) {
      errors.push('County is required for South Carolina affidavits');
    }

    return { errors, warnings };
  }

  /**
   * South Carolina notary block per S.C. Code §30-1-10
   * Notary designated as "Notary Public for South Carolina"
   *
   * @param {Object} affidavitData - The affidavit data
   * @returns {string} Notary block text
   */
  generateNotaryBlock(affidavitData) {
    return `Subscribed and sworn to before me this _____ day of _______________, 20___.


_________________________________
Notary Public for South Carolina

My commission expires: ___________

[NOTARY SEAL]`;
  }

  /**
   * South Carolina perjury statement
   * Oath authority: S.C. Code §30-1-10; perjury penalty: S.C. Code §16-9-10
   *
   * @returns {string} Perjury statement text
   */
  generatePerjuryStatement() {
    return `I declare under penalty of perjury under the laws of the State of South Carolina that the foregoing is true and correct.`;
  }

  /**
   * South Carolina exhibit rules — letters, cover page required
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

module.exports = SouthCarolinaAffidavitTemplate;
