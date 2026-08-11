// templates/states/new_mexico/AffidavitTemplate.js
// New Mexico Affidavit Template — LEGALLY COMPLIANT v1.0
// Governing Law: NMSA §14-12A (notarial acts, oath authority),
//                NMSA §30-25-1 (perjury)

const BaseAffidavitTemplate = require('../../core/BaseAffidavitTemplate');

/**
 * New Mexico Affidavit Template — LEGALLY COMPLIANT v1.0
 *
 * COMPLIANCE NOTES:
 * - Perjury statement REQUIRED — notary oath authority per NMSA §14-12A;
 *   criminal perjury penalty under NMSA §30-25-1
 * - County is REQUIRED for New Mexico affidavits
 * - Case number label: "No."
 * - Header: "STATE OF NEW MEXICO"
 * - Venue: "COUNTY OF [COUNTY]" (uppercase per New Mexico practice)
 * - Notary block per NMSA §14-12A; notary designated as "Notary Public, State of New Mexico"
 * - Notary may administer oath or affirmation (subscribed and sworn/affirmed)
 * - Exhibits labeled with letters (A, B, C)
 *
 * @class NewMexicoAffidavitTemplate
 * @extends BaseAffidavitTemplate
 */
class NewMexicoAffidavitTemplate extends BaseAffidavitTemplate {
  constructor() {
    super();

    this.metadata = require('./metadata.json');
    this.state = this.metadata.stateCode;
    this.stateName = this.metadata.stateName;
    this.requiredFields = this.metadata.requiredFields;

    // New Mexico requires perjury statement — notary oath authority per NMSA §14-12A;
    // criminal perjury penalty per NMSA §30-25-1
    this.sections.perjuryStatement = true;
  }

  /**
   * New Mexico-specific case caption using "No." terminology
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
    caption += `No. ${caseNumber.toUpperCase()}\n\n`;

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
   * New Mexico header — "STATE OF NEW MEXICO"
   *
   * @returns {string} Header text
   */
  generateHeader() {
    return 'STATE OF NEW MEXICO';
  }

  /**
   * New Mexico venue — "COUNTY OF [COUNTY]" (uppercase per New Mexico practice)
   *
   * @param {string} county - County name
   * @returns {string} Venue text
   */
  generateVenue(county) {
    const countyName = county || '[COUNTY]';
    return `COUNTY OF ${countyName.toUpperCase()}`;
  }

  /**
   * New Mexico-specific validation
   *
   * @param {Object} affidavitData - The affidavit data to validate
   * @returns {Object} Validation result with errors and warnings
   */
  performStateSpecificValidation(affidavitData) {
    const errors = [];
    const warnings = [];

    // County is REQUIRED for New Mexico affidavits
    if (!affidavitData.county || affidavitData.county.trim().length === 0) {
      errors.push('County is required for New Mexico affidavits');
    }

    return { errors, warnings };
  }

  /**
   * New Mexico notary block per NMSA §14-12A
   * Supports both oath and affirmation
   *
   * @param {Object} affidavitData - The affidavit data
   * @returns {string} Notary block text
   */
  generateNotaryBlock(affidavitData) {
    return `Subscribed and sworn to (or affirmed) before me this _____ day of _______________, 20___.


_________________________________
Notary Public, State of New Mexico

My commission expires: ___________

(SEAL)`;
  }

  /**
   * New Mexico perjury statement
   * Notary oath authority: NMSA §14-12A; perjury penalty: NMSA §30-25-1
   *
   * @returns {string} Perjury statement text
   */
  generatePerjuryStatement() {
    return `I declare under penalty of perjury under the laws of the State of New Mexico that the foregoing is true and correct.`;
  }

  /**
   * New Mexico exhibit rules — letters, cover page required
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

module.exports = NewMexicoAffidavitTemplate;
