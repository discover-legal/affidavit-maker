// templates/states/pennsylvania/AffidavitTemplate.js
// Pennsylvania Affidavit Template
// Governing Law: 42 Pa.C.S. § 6341, 18 Pa.C.S. § 4902, 18 Pa.C.S. § 4904,
//                57 Pa.C.S. § 316 (Pennsylvania Notary Public Law)

const BaseAffidavitTemplate = require('../../core/BaseAffidavitTemplate');

/**
 * Pennsylvania Affidavit Template - Legally Compliant v1.0
 *
 * COMPLIANCE NOTES:
 * - Pennsylvania uses "COMMONWEALTH OF PENNSYLVANIA" as header
 * - Perjury statement REQUIRED — references 18 Pa.C.S. § 4902 (perjury in sworn affidavit)
 * - County is a REQUIRED field
 * - Case number label is "DOCKET NO." (Pennsylvania Court of Common Pleas standard)
 * - Notary block must conform to 57 Pa.C.S. § 316
 * - Exhibits are labeled with letters; cover page required
 *
 * @class PennsylvaniaAffidavitTemplate
 * @extends BaseAffidavitTemplate
 */
class PennsylvaniaAffidavitTemplate extends BaseAffidavitTemplate {
  constructor() {
    super();

    // Load metadata
    this.metadata = require('./metadata.json');
    this.state = this.metadata.stateCode;
    this.stateName = this.metadata.stateName;
    this.requiredFields = this.metadata.requiredFields;

    // Pennsylvania requires a perjury statement in sworn affidavits
    this.sections.perjuryStatement = true;
  }

  /**
   * Pennsylvania header uses "COMMONWEALTH OF PENNSYLVANIA" rather than "STATE OF"
   *
   * @returns {string} Header text
   */
  generateHeader() {
    return 'COMMONWEALTH OF PENNSYLVANIA';
  }

  /**
   * Pennsylvania venue format
   *
   * @param {string} county - County name
   * @returns {string} Formatted venue
   */
  generateVenue(county) {
    const countyUpper = (county || '[COUNTY]').toUpperCase();
    return `COUNTY OF ${countyUpper}`;
  }

  /**
   * Pennsylvania case caption uses "DOCKET NO." as the case number label
   *
   * @param {Object} affidavitData - The affidavit data
   * @returns {Object} Case caption with formatted text
   */
  generateCaseCaption(affidavitData) {
    let caption = '';

    // Court name — Pennsylvania Court of Common Pleas
    let courtName = affidavitData.court || affidavitData.courtName || '[COURT NAME]';
    courtName = courtName.toUpperCase();

    caption += `IN THE ${courtName}\n\n`;

    // Case number — Pennsylvania uses "DOCKET NO." or "No."
    const caseNumber = affidavitData.caseNumber || '[CASE NUMBER]';
    caption += `DOCKET NO. ${caseNumber.toUpperCase()}\n\n`;

    // Party names
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
   * Pennsylvania-specific validation
   *
   * @param {Object} affidavitData - The affidavit data to validate
   * @returns {Object} Validation result with errors and warnings
   */
  performStateSpecificValidation(affidavitData) {
    const errors = [];
    const warnings = [];

    // County is REQUIRED for Pennsylvania
    if (!affidavitData.county || affidavitData.county.trim().length === 0) {
      errors.push('County is required for Pennsylvania affidavits');
    }

    return { errors, warnings };
  }

  /**
   * Pennsylvania notary block
   * Compliant with 57 Pa.C.S. § 316 (Pennsylvania Notary Public Law)
   *
   * @param {Object} affidavitData - The affidavit data
   * @returns {string} Notary block text
   */
  generateNotaryBlock(affidavitData) {
    const county = affidavitData.county || '_______________';
    return `COMMONWEALTH OF PENNSYLVANIA
County of ${county}

Sworn to and subscribed before me this ___ day of _______________, 20___.


_________________________________
Notary Public

My commission expires: ___________`;
  }

  /**
   * Pennsylvania perjury statement
   * References 18 Pa.C.S. § 4902 (perjury — false sworn statements in a notarized affidavit)
   *
   * Per Pennsylvania practice, this verification statement is included in addition to the
   * sworn notary jurat, providing statutory notice of the perjury penalty under § 4902.
   * (§ 4904 covers unsworn falsification — not applicable to a notarized sworn affidavit.)
   *
   * @returns {string} Perjury statement text
   */
  generatePerjuryStatement() {
    return 'I verify that the statements made in this affidavit are true and correct. I understand that false statements made in this sworn affidavit are subject to the penalties of 18 Pa.C.S. § 4902, relating to perjury.';
  }

  /**
   * Pennsylvania exhibit rules
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
      instructions: 'Exhibits must be labeled with letters (A, B, C, etc.) and identified with a cover page attached to the front of each exhibit.'
    };
  }
}

module.exports = PennsylvaniaAffidavitTemplate;
