// templates/states/maryland/AffidavitTemplate.js
// Maryland Affidavit Template — LEGALLY COMPLIANT v1.0
// Governing Law: Md. Code, State Gov't § 18-101 et seq. (Maryland Notarial Acts — oath authority and notarial acts),
//                Md. Code, Crim. Law § 9-101 (perjury)

const BaseAffidavitTemplate = require('../../core/BaseAffidavitTemplate');

/**
 * Maryland Affidavit Template — LEGALLY COMPLIANT v1.0
 *
 * COMPLIANCE NOTES:
 * - Perjury statement REQUIRED — notary oath authority per Md. Code, State Gov't § 18-101 et seq.;
 *   criminal perjury penalty under Md. Code, Crim. Law § 9-101
 * - County is REQUIRED for Maryland affidavits
 * - Case number label: "CASE NO."
 * - Header: "STATE OF MARYLAND"
 * - Venue: "County of [County]" (title case per Maryland practice); Baltimore City uses "Baltimore City"
 * - Notary block per Md. Code, State Gov't § 18-101 et seq.; notary designated as "Notary Public, State of Maryland"
 * - Notary may administer oath or affirmation (subscribed and sworn/affirmed)
 * - Exhibits labeled with letters (A, B, C)
 *
 * @class MarylandAffidavitTemplate
 * @extends BaseAffidavitTemplate
 */
class MarylandAffidavitTemplate extends BaseAffidavitTemplate {
  constructor() {
    super();

    this.metadata = require('./metadata.json');
    this.state = this.metadata.stateCode;
    this.stateName = this.metadata.stateName;
    this.requiredFields = this.metadata.requiredFields;

    // Maryland requires perjury statement — notary oath authority per Md. Code, State Gov't § 18-101 et seq.;
    // criminal perjury penalty per Md. Code, Crim. Law § 9-101
    this.sections.perjuryStatement = true;
  }

  /**
   * Maryland-specific case caption using "CASE NO." terminology
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
   * Maryland header — "STATE OF MARYLAND"
   *
   * @returns {string} Header text
   */
  generateHeader() {
    return 'STATE OF MARYLAND';
  }

  /**
   * Maryland venue — "County of [County]" (title case per Maryland practice)
   *
   * @param {string} county - County name
   * @returns {string} Venue text
   */
  generateVenue(county) {
    const countyName = county || '[COUNTY]';
    // Baltimore City is its own jurisdiction
    if (countyName.toLowerCase().includes('baltimore city')) {
      return 'Baltimore City';
    }
    const countyFormatted = countyName.charAt(0).toUpperCase() + countyName.slice(1).toLowerCase();
    return `County of ${countyFormatted}`;
  }

  /**
   * Maryland-specific validation
   *
   * @param {Object} affidavitData - The affidavit data to validate
   * @returns {Object} Validation result with errors and warnings
   */
  performStateSpecificValidation(affidavitData) {
    const errors = [];
    const warnings = [];

    // County is REQUIRED for Maryland affidavits
    if (!affidavitData.county || affidavitData.county.trim().length === 0) {
      errors.push('County (or Baltimore City) is required for Maryland affidavits');
    }

    return { errors, warnings };
  }

  /**
   * Maryland notary block per Md. Code, State Gov't § 18-101 et seq.
   * Supports both oath and affirmation
   *
   * @param {Object} affidavitData - The affidavit data
   * @returns {string} Notary block text
   */
  generateNotaryBlock(affidavitData) {
    return `Subscribed and sworn to (or affirmed) before me this _____ day of _______________, 20___.


_________________________________
Notary Public, State of Maryland

My commission expires: ___________

(SEAL)`;
  }

  /**
   * Maryland perjury statement
   * Notary oath authority: Md. Code, State Gov't § 18-101 et seq.; perjury penalty: Md. Code, Crim. Law § 9-101
   *
   * @returns {string} Perjury statement text
   */
  generatePerjuryStatement() {
    return `I declare under penalty of perjury under the laws of the State of Maryland that the foregoing is true and correct.`;
  }

  /**
   * Maryland exhibit rules — letters, cover page required
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

module.exports = MarylandAffidavitTemplate;
