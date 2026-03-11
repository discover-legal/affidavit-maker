// templates/states/massachusetts/AffidavitTemplate.js
// Massachusetts Affidavit Template
// Governing Law: M.G.L. c. 268, § 1A (perjury statement), M.G.L. c. 222 (notary public)

const BaseAffidavitTemplate = require('../../core/BaseAffidavitTemplate');

/**
 * Massachusetts Affidavit Template - Legally Compliant v1.0
 *
 * COMPLIANCE NOTES:
 * - Massachusetts uses "COMMONWEALTH OF MASSACHUSETTS" as header
 * - Perjury statement REQUIRED — M.G.L. c. 268, § 1A — specific statutory language:
 *   "Signed under the penalties of perjury."
 * - County is a REQUIRED field (Probate Courts are organized by county division)
 * - Case number label is "DOCKET NO." (Probate and Family Court standard)
 * - Notary block must conform to M.G.L. c. 222 (Massachusetts Uniform Law on Notarial Acts, effective 2019)
 * - Notary title is simply "Notary Public"; commission expiration required
 * - Header is "COMMONWEALTH OF MASSACHUSETTS" not "STATE OF"
 * - Exhibits labeled with letters; cover page required
 *
 * @class MassachusettsAffidavitTemplate
 * @extends BaseAffidavitTemplate
 */
class MassachusettsAffidavitTemplate extends BaseAffidavitTemplate {
  constructor() {
    super();

    // Load metadata
    this.metadata = require('./metadata.json');
    this.state = this.metadata.stateCode;
    this.stateName = this.metadata.stateName;
    this.requiredFields = this.metadata.requiredFields;

    // Massachusetts requires a perjury statement in sworn affidavits
    this.sections.perjuryStatement = true;
  }

  /**
   * Massachusetts header — "COMMONWEALTH OF MASSACHUSETTS"
   * Massachusetts uses "Commonwealth" rather than "State"
   *
   * @returns {string} Header text
   */
  generateHeader() {
    return 'COMMONWEALTH OF MASSACHUSETTS';
  }

  /**
   * Massachusetts venue format
   * Uses county name followed by "COUNTY" per Massachusetts Probate and Family Court practice.
   * Note: Massachusetts Probate and Family Courts are organized by county division.
   * General District Courts use court name/department, not county.
   *
   * @param {string} county - County name (e.g. "Middlesex", "Suffolk")
   * @returns {string} Formatted venue (e.g. "MIDDLESEX COUNTY")
   */
  generateVenue(county) {
    const countyUpper = (county || '[COUNTY]').toUpperCase();
    return `${countyUpper} COUNTY`;
  }

  /**
   * Massachusetts case caption uses "DOCKET NO." as the case number label
   * Massachusetts Probate and Family Court uses this format
   *
   * @param {Object} affidavitData - The affidavit data
   * @returns {Object} Case caption with formatted text
   */
  generateCaseCaption(affidavitData) {
    let caption = '';

    // Court name — Massachusetts Probate and Family Court
    let courtName = affidavitData.court || affidavitData.courtName || '[COURT NAME]';
    courtName = courtName.toUpperCase();

    caption += `${courtName}\n\n`;

    // Case number — Massachusetts Probate courts use "DOCKET NO."
    const caseNumber = affidavitData.caseNumber || '[DOCKET NUMBER]';
    caption += `DOCKET NO. ${caseNumber.toUpperCase()}\n\n`;

    // Party names
    const plaintiff = affidavitData.plaintiff || '[PLAINTIFF NAME]';
    const defendant = affidavitData.defendant || '[DEFENDANT NAME]';

    caption += `${plaintiff.toUpperCase()},\n`;
    caption += `     Plaintiff,\n\n`;
    caption += `v.\n\n`;
    caption += `${defendant.toUpperCase()},\n`;
    caption += `     Defendant.`;

    return {
      courtName,
      caseNumber: affidavitData.caseNumber,
      plaintiff: affidavitData.plaintiff,
      defendant: affidavitData.defendant,
      formatted: caption
    };
  }

  /**
   * Massachusetts-specific validation
   *
   * @param {Object} affidavitData - The affidavit data to validate
   * @returns {Object} Validation result with errors and warnings
   */
  performStateSpecificValidation(affidavitData) {
    const errors = [];
    const warnings = [];

    // County is REQUIRED for Massachusetts
    if (!affidavitData.county || affidavitData.county.trim().length === 0) {
      errors.push('County is required for Massachusetts affidavits');
    }

    return { errors, warnings };
  }

  /**
   * Massachusetts notary block
   * Compliant with M.G.L. c. 222 (Massachusetts Uniform Law on Notarial Acts)
   * Notary title is "Notary Public"; commission expiration required
   *
   * @param {Object} affidavitData - The affidavit data
   * @returns {string} Notary block text
   */
  generateNotaryBlock(affidavitData) {
    const raw = affidavitData.county || '_______________';
    const county = raw.charAt(0).toUpperCase() + raw.slice(1);
    return `COMMONWEALTH OF MASSACHUSETTS
${county} County

Subscribed and sworn to before me this ___ day of _______________, 20___.


_________________________________
Notary Public

My commission expires: ___________`;
  }

  /**
   * Massachusetts perjury statement
   * M.G.L. c. 268, § 1A — specific Massachusetts statutory language
   * "Signed under the penalties of perjury" is the recognized Massachusetts formulation
   *
   * @returns {string} Perjury statement text
   */
  generatePerjuryStatement() {
    return 'Signed under the penalties of perjury.';
  }

  /**
   * Massachusetts exhibit rules
   * Letters required; cover page required
   *
   * @returns {Object} Exhibit formatting rules
   */
  getExhibitRules() {
    return {
      labelStyle: 'letters', // A, B, C...
      requireCoverPage: true,
      coverPageFormat: {
        title: 'EXHIBIT [LABEL]',
        centered: true,
        description: true
      },
      allowedFormats: ['PDF', 'JPG', 'PNG'],
      maxFileSize: 25 * 1024 * 1024, // 25MB
      maxTotalSize: 100 * 1024 * 1024, // 100MB
      instructions: 'Exhibits must be labeled with letters (A, B, C, etc.) and identified with a cover page. Reference each exhibit in the body of the affidavit and attach at the end of the document.'
    };
  }
}

module.exports = MassachusettsAffidavitTemplate;
