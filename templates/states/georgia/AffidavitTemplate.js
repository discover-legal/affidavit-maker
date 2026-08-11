// templates/states/georgia/AffidavitTemplate.js
// Georgia Affidavit Template — LEGALLY COMPLIANT v1.0
// Governing Law: O.C.G.A. § 16-10-71 (perjury), O.C.G.A. § 45-17-8 (notary)

const BaseAffidavitTemplate = require('../../core/BaseAffidavitTemplate');

/**
 * Georgia Affidavit Template — LEGALLY COMPLIANT v1.0
 *
 * COMPLIANCE NOTES:
 * - Perjury statement REQUIRED per O.C.G.A. § 16-10-71
 * - County is REQUIRED for Georgia affidavits
 * - Case number label: "CIVIL ACTION FILE NO." (official Georgia AOC Superior Court form label)
 * - Header: "STATE OF GEORGIA"
 * - Venue: "COUNTY OF [COUNTY]" (uppercase)
 * - Notary block per O.C.G.A. § 45-17-8
 * - Exhibits labeled with letters (A, B, C)
 *
 * @class GeorgiaAffidavitTemplate
 * @extends BaseAffidavitTemplate
 */
class GeorgiaAffidavitTemplate extends BaseAffidavitTemplate {
  constructor() {
    super();

    this.metadata = require('./metadata.json');
    this.state = this.metadata.stateCode;
    this.stateName = this.metadata.stateName;
    this.requiredFields = this.metadata.requiredFields;

    // Georgia requires perjury statement per O.C.G.A. § 16-10-71
    this.sections.perjuryStatement = true;
  }

  /**
   * Georgia-specific case caption using "CIVIL ACTION FILE NO." terminology
   *
   * @param {Object} affidavitData - The affidavit data
   * @returns {Object} Case caption with formatted text
   */
  generateCaseCaption(affidavitData) {
    let caption = '';

    let courtName = affidavitData.court || affidavitData.courtName || '[COURT NAME]';
    courtName = courtName.toUpperCase();

    caption += `IN THE ${courtName}\n\n`;

    // Georgia Superior Courts use "CIVIL ACTION FILE NO." (official AOC form label)
    const caseNumber = affidavitData.caseNumber || '[CASE NUMBER]';
    caption += `CIVIL ACTION FILE NO. ${caseNumber.toUpperCase()}\n\n`;

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
   * Georgia header — "STATE OF GEORGIA"
   *
   * @returns {string} Header text
   */
  generateHeader() {
    return 'STATE OF GEORGIA';
  }

  /**
   * Georgia venue — "COUNTY OF [COUNTY]" (uppercase)
   *
   * @param {string} county - County name
   * @returns {string} Venue text
   */
  generateVenue(county) {
    const countyUpper = (county || '[COUNTY]').toUpperCase();
    return `COUNTY OF ${countyUpper}`;
  }

  /**
   * Georgia-specific validation
   *
   * @param {Object} affidavitData - The affidavit data to validate
   * @returns {Object} Validation result with errors and warnings
   */
  performStateSpecificValidation(affidavitData) {
    const errors = [];
    const warnings = [];

    // County is REQUIRED for Georgia affidavits
    if (!affidavitData.county || affidavitData.county.trim().length === 0) {
      errors.push('County is required for Georgia affidavits');
    }

    // Warn if no facts provided
    if (!affidavitData.facts || affidavitData.facts.length === 0) {
      warnings.push('No facts provided — the affidavit will be incomplete');
    }

    return { errors, warnings };
  }

  /**
   * Georgia notary block per O.C.G.A. § 45-17-8
   * Sworn and subscribed format with county-specific notary designation
   *
   * @param {Object} affidavitData - The affidavit data
   * @returns {string} Notary block text
   */
  generateNotaryBlock(affidavitData) {
    const county = affidavitData.county || '_______________';

    return `Sworn to and subscribed before me this _____ day of _______________, 20___.


_________________________________
Notary Public, ${county} County, Georgia

My commission expires: ___________

(SEAL)`;
  }

  /**
   * Georgia perjury statement per O.C.G.A. § 16-10-71
   *
   * @returns {string} Perjury statement text
   */
  generatePerjuryStatement() {
    return `I declare under penalty of perjury under the laws of the State of Georgia that the foregoing is true and correct.`;
  }

  /**
   * Georgia exhibit rules — letters, cover page required
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
      instructions: 'Each exhibit must be labeled sequentially (Exhibit A, Exhibit B, etc.) and referenced in the body of the affidavit. Attach exhibits after the signature and notary block.'
    };
  }
}

module.exports = GeorgiaAffidavitTemplate;
