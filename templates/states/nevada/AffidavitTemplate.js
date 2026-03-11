// templates/states/nevada/AffidavitTemplate.js
// Nevada Affidavit Template — LEGALLY COMPLIANT v1.0
// Governing Law: NRS 240.001 et seq. (Nevada Notary Public Act — oath authority and notarial acts),
//                NRS 199.120 (perjury)

const BaseAffidavitTemplate = require('../../core/BaseAffidavitTemplate');

/**
 * Nevada Affidavit Template — LEGALLY COMPLIANT v1.0
 *
 * COMPLIANCE NOTES:
 * - Perjury statement REQUIRED — notary oath authority per NRS 240.001 et seq.;
 *   criminal perjury penalty under NRS 199.120
 * - County is REQUIRED for Nevada affidavits
 * - Case number label: "CASE NO."
 * - Header: "STATE OF NEVADA"
 * - Venue: "COUNTY OF [COUNTY]" (uppercase per Nevada practice)
 * - Notary block per NRS 240.001 et seq.; notary designated as "Notary Public, State of Nevada"
 * - Nevada notary must include appointment expiration date
 * - Notary may administer oath or affirmation (subscribed and sworn/affirmed)
 * - Exhibits labeled with letters (A, B, C)
 *
 * @class NevadaAffidavitTemplate
 * @extends BaseAffidavitTemplate
 */
class NevadaAffidavitTemplate extends BaseAffidavitTemplate {
  constructor() {
    super();

    this.metadata = require('./metadata.json');
    this.state = this.metadata.stateCode;
    this.stateName = this.metadata.stateName;
    this.requiredFields = this.metadata.requiredFields;

    // Nevada requires perjury statement — notary oath authority per NRS 240.001 et seq.;
    // criminal perjury penalty per NRS 199.120
    this.sections.perjuryStatement = true;
  }

  /**
   * Nevada-specific case caption using "CASE NO." terminology
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
   * Nevada header — "STATE OF NEVADA"
   *
   * @returns {string} Header text
   */
  generateHeader() {
    return 'STATE OF NEVADA';
  }

  /**
   * Nevada venue — "COUNTY OF [COUNTY]" (uppercase per Nevada practice)
   *
   * @param {string} county - County name
   * @returns {string} Venue text
   */
  generateVenue(county) {
    const countyName = county || '[COUNTY]';
    return `COUNTY OF ${countyName.toUpperCase()}`;
  }

  /**
   * Nevada-specific validation
   *
   * @param {Object} affidavitData - The affidavit data to validate
   * @returns {Object} Validation result with errors and warnings
   */
  performStateSpecificValidation(affidavitData) {
    const errors = [];
    const warnings = [];

    // County is REQUIRED for Nevada affidavits
    if (!affidavitData.county || affidavitData.county.trim().length === 0) {
      errors.push('County is required for Nevada affidavits');
    }

    return { errors, warnings };
  }

  /**
   * Nevada notary block per NRS 240.001 et seq.
   * Supports both oath and affirmation; notary must include appointment expiration
   *
   * @param {Object} affidavitData - The affidavit data
   * @returns {string} Notary block text
   */
  generateNotaryBlock(affidavitData) {
    return `Subscribed and sworn to (or affirmed) before me this _____ day of _______________, 20___.


_________________________________
Notary Public, State of Nevada

My appointment expires: ___________

[NOTARY SEAL/STAMP]`;
  }

  /**
   * Nevada perjury statement
   * Notary oath authority: NRS 240.001 et seq.; perjury penalty: NRS 199.120
   *
   * @returns {string} Perjury statement text
   */
  generatePerjuryStatement() {
    return `I declare under penalty of perjury under the laws of the State of Nevada that the foregoing is true and correct.`;
  }

  /**
   * Nevada exhibit rules — letters, cover page required
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

module.exports = NevadaAffidavitTemplate;
