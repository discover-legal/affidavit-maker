// templates/states/indiana/AffidavitTemplate.js
// Indiana Affidavit Template — LEGALLY COMPLIANT v1.0
// Governing Law: IC 33-42 (Indiana Notary Public Act — oath authority and notarial acts),
//                IC 35-44.1-2-1 (perjury)

const BaseAffidavitTemplate = require('../../core/BaseAffidavitTemplate');

/**
 * Indiana Affidavit Template — LEGALLY COMPLIANT v1.0
 *
 * COMPLIANCE NOTES:
 * - Perjury statement REQUIRED — notary oath authority per IC 33-42;
 *   criminal perjury penalty under IC 35-44.1-2-1
 * - County is REQUIRED for Indiana affidavits
 * - Case number label: "CAUSE NO."
 * - Header: "STATE OF INDIANA"
 * - Venue: "County of [County]" (title case per Indiana practice)
 * - Notary block per IC 33-42 (Indiana Notary Public Act); notary designated as "Notary Public, State of Indiana"
 * - Indiana notary must include county of residence
 * - Notary may administer oath or affirmation (subscribed and sworn/affirmed)
 * - Exhibits labeled with letters (A, B, C)
 *
 * @class IndianaAffidavitTemplate
 * @extends BaseAffidavitTemplate
 */
class IndianaAffidavitTemplate extends BaseAffidavitTemplate {
  constructor() {
    super();

    this.metadata = require('./metadata.json');
    this.state = this.metadata.stateCode;
    this.stateName = this.metadata.stateName;
    this.requiredFields = this.metadata.requiredFields;

    // Indiana requires perjury statement — notary oath authority per IC 33-42;
    // criminal perjury penalty per IC 35-44.1-2-1
    this.sections.perjuryStatement = true;
  }

  /**
   * Indiana-specific case caption using "CAUSE NO." terminology
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
   * Indiana header — "STATE OF INDIANA"
   *
   * @returns {string} Header text
   */
  generateHeader() {
    return 'STATE OF INDIANA';
  }

  /**
   * Indiana venue — "County of [County]" (title case per Indiana practice)
   *
   * @param {string} county - County name
   * @returns {string} Venue text
   */
  generateVenue(county) {
    const countyName = county || '[COUNTY]';
    // Indiana uses title case for venue
    const countyFormatted = countyName.charAt(0).toUpperCase() + countyName.slice(1).toLowerCase();
    return `County of ${countyFormatted}`;
  }

  /**
   * Indiana-specific validation
   *
   * @param {Object} affidavitData - The affidavit data to validate
   * @returns {Object} Validation result with errors and warnings
   */
  performStateSpecificValidation(affidavitData) {
    const errors = [];
    const warnings = [];

    // County is REQUIRED for Indiana affidavits
    if (!affidavitData.county || affidavitData.county.trim().length === 0) {
      errors.push('County is required for Indiana affidavits');
    }

    return { errors, warnings };
  }

  /**
   * Indiana notary block per IC 33-42 (Indiana Notary Public Act)
   * Supports both oath and affirmation; notary must include county of residence
   *
   * @param {Object} affidavitData - The affidavit data
   * @returns {string} Notary block text
   */
  generateNotaryBlock(affidavitData) {
    return `Subscribed and sworn to (or affirmed) before me this _____ day of _______________, 20___.


_________________________________
Notary Public, State of Indiana

My commission expires: ___________
County of Residence: _____________

(SEAL)`;
  }

  /**
   * Indiana perjury statement
   * Notary oath authority: IC 33-42; perjury penalty: IC 35-44.1-2-1
   *
   * @returns {string} Perjury statement text
   */
  generatePerjuryStatement() {
    return `I declare under penalty of perjury under the laws of the State of Indiana that the foregoing is true and correct.`;
  }

  /**
   * Indiana exhibit rules — letters, cover page required
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

module.exports = IndianaAffidavitTemplate;
