// templates/states/minnesota/AffidavitTemplate.js
// Minnesota Affidavit Template — LEGALLY COMPLIANT v1.0
// Governing Law: Minn. Stat. § 358 (Minnesota Notarial Acts — oath authority and notarial acts),
//                Minn. Stat. § 609.48 (perjury)

const BaseAffidavitTemplate = require('../../core/BaseAffidavitTemplate');

/**
 * Minnesota Affidavit Template — LEGALLY COMPLIANT v1.0
 *
 * COMPLIANCE NOTES:
 * - Perjury statement REQUIRED — notary oath authority per Minn. Stat. § 358;
 *   criminal perjury penalty under Minn. Stat. § 609.48
 * - County is REQUIRED for Minnesota affidavits
 * - Case number label: "COURT FILE NO."
 * - Header: "STATE OF MINNESOTA"
 * - Venue: "County of [County]" (title case per Minnesota practice)
 * - Notary block per Minn. Stat. § 358; notary designated as "Notary Public, State of Minnesota"
 * - Notary may administer oath or affirmation (subscribed and sworn/affirmed)
 * - Exhibits labeled with letters (A, B, C)
 *
 * @class MinnesotaAffidavitTemplate
 * @extends BaseAffidavitTemplate
 */
class MinnesotaAffidavitTemplate extends BaseAffidavitTemplate {
  constructor() {
    super();

    this.metadata = require('./metadata.json');
    this.state = this.metadata.stateCode;
    this.stateName = this.metadata.stateName;
    this.requiredFields = this.metadata.requiredFields;

    // Minnesota requires perjury statement — notary oath authority per Minn. Stat. § 358;
    // criminal perjury penalty per Minn. Stat. § 609.48
    this.sections.perjuryStatement = true;
  }

  /**
   * Minnesota-specific case caption using "COURT FILE NO." terminology
   *
   * @param {Object} affidavitData - The affidavit data
   * @returns {Object} Case caption with formatted text
   */
  generateCaseCaption(affidavitData) {
    let caption = '';

    let courtName = affidavitData.court || affidavitData.courtName || '[COURT NAME]';
    courtName = courtName.toUpperCase();

    caption += `${courtName}\n\n`;

    const caseNumber = affidavitData.caseNumber || '[COURT FILE NUMBER]';
    caption += `COURT FILE NO. ${caseNumber.toUpperCase()}\n\n`;

    const plaintiff = affidavitData.plaintiff || '[PLAINTIFF NAME]';
    const defendant = affidavitData.defendant || '[DEFENDANT NAME]';

    caption += `${plaintiff.toUpperCase()},\n`;
    caption += `    Petitioner,\n\n`;
    caption += `vs.\n\n`;
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
   * Minnesota header — "STATE OF MINNESOTA"
   *
   * @returns {string} Header text
   */
  generateHeader() {
    return 'STATE OF MINNESOTA';
  }

  /**
   * Minnesota venue — "County of [County]" (title case per Minnesota practice)
   *
   * @param {string} county - County name
   * @returns {string} Venue text
   */
  generateVenue(county) {
    const countyName = county || '[COUNTY]';
    const countyFormatted = countyName.charAt(0).toUpperCase() + countyName.slice(1).toLowerCase();
    return `County of ${countyFormatted}`;
  }

  /**
   * Minnesota-specific validation
   *
   * @param {Object} affidavitData - The affidavit data to validate
   * @returns {Object} Validation result with errors and warnings
   */
  performStateSpecificValidation(affidavitData) {
    const errors = [];
    const warnings = [];

    // County is REQUIRED for Minnesota affidavits
    if (!affidavitData.county || affidavitData.county.trim().length === 0) {
      errors.push('County is required for Minnesota affidavits');
    }

    return { errors, warnings };
  }

  /**
   * Minnesota notary block per Minn. Stat. § 358
   * Supports both oath and affirmation
   *
   * @param {Object} affidavitData - The affidavit data
   * @returns {string} Notary block text
   */
  generateNotaryBlock(affidavitData) {
    return `Subscribed and sworn to (or affirmed) before me this _____ day of _______________, 20___.


_________________________________
Notary Public, State of Minnesota

My commission expires: ___________

(SEAL)`;
  }

  /**
   * Minnesota perjury statement
   * Notary oath authority: Minn. Stat. § 358; perjury penalty: Minn. Stat. § 609.48
   *
   * @returns {string} Perjury statement text
   */
  generatePerjuryStatement() {
    return `I declare under penalty of perjury under the laws of the State of Minnesota that the foregoing is true and correct.`;
  }

  /**
   * Minnesota exhibit rules — letters, cover page required
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

module.exports = MinnesotaAffidavitTemplate;
