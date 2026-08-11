// templates/states/dc/AffidavitTemplate.js
// District of Columbia Affidavit Template — LEGALLY COMPLIANT v1.0
// Governing Law: D.C. Code §1-1201 (DC Notaries Public — oath authority and notarial acts),
//                D.C. Code §22-2402 (perjury)

const BaseAffidavitTemplate = require('../../core/BaseAffidavitTemplate');

/**
 * District of Columbia Affidavit Template — LEGALLY COMPLIANT v1.0
 *
 * COMPLIANCE NOTES:
 * - Perjury statement REQUIRED — notary oath authority per D.C. Code §1-1201;
 *   criminal perjury penalty under D.C. Code §22-2402
 * - DC is a federal district, not a state — no county subdivision; uses "District of Columbia"
 * - Case number label: "CASE NO."
 * - Header: "DISTRICT OF COLUMBIA"
 * - Venue: "District of Columbia" (no county)
 * - Notary block per D.C. Code §1-1201; notary designated as "Notary Public, District of Columbia"
 * - Notary may administer oath or affirmation (subscribed and sworn/affirmed)
 * - Exhibits labeled with letters (A, B, C)
 *
 * @class DCAfidavitTemplate
 * @extends BaseAffidavitTemplate
 */
class DCAffidavitTemplate extends BaseAffidavitTemplate {
  constructor() {
    super();

    this.metadata = require('./metadata.json');
    this.state = this.metadata.stateCode;
    this.stateName = this.metadata.stateName;
    this.requiredFields = this.metadata.requiredFields;

    // DC requires perjury statement — notary oath authority per D.C. Code §1-1201;
    // criminal perjury penalty per D.C. Code §22-2402
    this.sections.perjuryStatement = true;
  }

  /**
   * DC-specific case caption using "CASE NO." terminology
   *
   * @param {Object} affidavitData - The affidavit data
   * @returns {Object} Case caption with formatted text
   */
  generateCaseCaption(affidavitData) {
    let caption = '';

    let courtName = affidavitData.court || affidavitData.courtName || 'SUPERIOR COURT OF THE DISTRICT OF COLUMBIA';
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
   * DC header — "DISTRICT OF COLUMBIA"
   *
   * @returns {string} Header text
   */
  generateHeader() {
    return 'DISTRICT OF COLUMBIA';
  }

  /**
   * DC venue — "District of Columbia" (no county)
   *
   * @param {string} county - Not used for DC
   * @returns {string} Venue text
   */
  generateVenue(county) {
    return 'District of Columbia';
  }

  /**
   * DC-specific validation
   *
   * @param {Object} affidavitData - The affidavit data to validate
   * @returns {Object} Validation result with errors and warnings
   */
  performStateSpecificValidation(affidavitData) {
    const errors = [];
    const warnings = [];

    // DC does not require a county — it is a single jurisdiction
    // No county validation needed

    return { errors, warnings };
  }

  /**
   * DC notary block per D.C. Code §1-1201
   * Supports both oath and affirmation
   *
   * @param {Object} affidavitData - The affidavit data
   * @returns {string} Notary block text
   */
  generateNotaryBlock(affidavitData) {
    return `Subscribed and sworn to (or affirmed) before me this _____ day of _______________, 20___.


_________________________________
Notary Public, District of Columbia

My commission expires: ___________

(SEAL)`;
  }

  /**
   * DC perjury statement
   * Notary oath authority: D.C. Code §1-1201; perjury penalty: D.C. Code §22-2402
   *
   * @returns {string} Perjury statement text
   */
  generatePerjuryStatement() {
    return `I declare under penalty of perjury under the laws of the District of Columbia that the foregoing is true and correct.`;
  }

  /**
   * DC exhibit rules — letters, cover page required
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

module.exports = DCAffidavitTemplate;
