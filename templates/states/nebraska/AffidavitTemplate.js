// templates/states/nebraska/AffidavitTemplate.js
// Nebraska Affidavit Template — LEGALLY COMPLIANT v1.0
// Governing Law: Neb. Rev. Stat. §64-101 et seq. (Nebraska Notarial Acts — oath authority and notarial acts),
//                Neb. Rev. Stat. §28-915 (perjury)

const BaseAffidavitTemplate = require('../../core/BaseAffidavitTemplate');

/**
 * Nebraska Affidavit Template — LEGALLY COMPLIANT v1.0
 *
 * COMPLIANCE NOTES:
 * - Perjury statement REQUIRED — notary oath authority per Neb. Rev. Stat. §64-101 et seq.;
 *   criminal perjury penalty under Neb. Rev. Stat. §28-915
 * - County is REQUIRED for Nebraska affidavits
 * - Case number label: "CASE NO."
 * - Header: "STATE OF NEBRASKA"
 * - Venue: "County of [County]" (title case per Nebraska practice)
 * - Notary block per Neb. Rev. Stat. §64-101 et seq.; notary designated as "Notary Public"
 * - Notary may administer oath or affirmation (subscribed and sworn/affirmed)
 * - Exhibits labeled with letters (A, B, C)
 *
 * @class NebraskaAffidavitTemplate
 * @extends BaseAffidavitTemplate
 */
class NebraskaAffidavitTemplate extends BaseAffidavitTemplate {
  constructor() {
    super();

    this.metadata = require('./metadata.json');
    this.state = this.metadata.stateCode;
    this.stateName = this.metadata.stateName;
    this.requiredFields = this.metadata.requiredFields;

    // Nebraska requires perjury statement — notary oath authority per Neb. Rev. Stat. §64-101 et seq.;
    // criminal perjury penalty per Neb. Rev. Stat. §28-915
    this.sections.perjuryStatement = true;
  }

  /**
   * Nebraska-specific case caption using "CASE NO." terminology
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
   * Nebraska header — "STATE OF NEBRASKA"
   *
   * @returns {string} Header text
   */
  generateHeader() {
    return 'STATE OF NEBRASKA';
  }

  /**
   * Nebraska venue — "County of [County]" (title case per Nebraska practice)
   *
   * @param {string} county - County name
   * @returns {string} Venue text
   */
  generateVenue(county) {
    const countyName = county || '[COUNTY]';
    // Nebraska uses title case for venue
    const countyFormatted = countyName.charAt(0).toUpperCase() + countyName.slice(1).toLowerCase();
    return `County of ${countyFormatted}`;
  }

  /**
   * Nebraska-specific validation
   *
   * @param {Object} affidavitData - The affidavit data to validate
   * @returns {Object} Validation result with errors and warnings
   */
  performStateSpecificValidation(affidavitData) {
    const errors = [];
    const warnings = [];

    // County is REQUIRED for Nebraska affidavits
    if (!affidavitData.county || affidavitData.county.trim().length === 0) {
      errors.push('County is required for Nebraska affidavits');
    }

    return { errors, warnings };
  }

  /**
   * Nebraska notary block per Neb. Rev. Stat. §64-101 et seq.
   * Supports both oath and affirmation
   *
   * @param {Object} affidavitData - The affidavit data
   * @returns {string} Notary block text
   */
  generateNotaryBlock(affidavitData) {
    return `Subscribed and sworn to (or affirmed) before me this _____ day of _______________, 20___.


_________________________________
Notary Public

My commission expires: ___________

(SEAL)`;
  }

  /**
   * Nebraska perjury statement
   * Notary oath authority: Neb. Rev. Stat. §64-101 et seq.; perjury penalty: Neb. Rev. Stat. §28-915
   *
   * @returns {string} Perjury statement text
   */
  generatePerjuryStatement() {
    return `I declare under penalty of perjury under the laws of the State of Nebraska that the foregoing is true and correct.`;
  }

  /**
   * Nebraska exhibit rules — letters, cover page required
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

module.exports = NebraskaAffidavitTemplate;
