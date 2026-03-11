// templates/states/ohio/AffidavitTemplate.js
// Ohio Affidavit Template
// Governing Law: R.C. § 2921.11 (perjury), R.C. § 2319.03 (affidavits),
//                R.C. § 147.03 (notary public authority)

const BaseAffidavitTemplate = require('../../core/BaseAffidavitTemplate');

/**
 * Ohio Affidavit Template - Legally Compliant v1.0
 *
 * COMPLIANCE NOTES:
 * - Ohio uses "STATE OF OHIO" as header
 * - Perjury statement REQUIRED — references R.C. § 2921.11
 * - County is a REQUIRED field
 * - Case number label is "CASE NO."
 * - Notary block must conform to R.C. § 147.03
 * - Notary includes commission expiration date; title is "Notary Public, State of Ohio"
 * - Exhibits labeled with letters; cover page required
 *
 * @class OhioAffidavitTemplate
 * @extends BaseAffidavitTemplate
 */
class OhioAffidavitTemplate extends BaseAffidavitTemplate {
  constructor() {
    super();

    // Load metadata
    this.metadata = require('./metadata.json');
    this.state = this.metadata.stateCode;
    this.stateName = this.metadata.stateName;
    this.requiredFields = this.metadata.requiredFields;

    // Ohio requires a perjury statement in sworn affidavits
    this.sections.perjuryStatement = true;
  }

  /**
   * Ohio header — "STATE OF OHIO"
   *
   * @returns {string} Header text
   */
  generateHeader() {
    return 'STATE OF OHIO';
  }

  /**
   * Ohio venue format
   *
   * @param {string} county - County name
   * @returns {string} Formatted venue
   */
  generateVenue(county) {
    const countyUpper = (county || '[COUNTY]').toUpperCase();
    return `COUNTY OF ${countyUpper}`;
  }

  /**
   * Ohio case caption uses "CASE NO." as the case number label
   *
   * @param {Object} affidavitData - The affidavit data
   * @returns {Object} Case caption with formatted text
   */
  generateCaseCaption(affidavitData) {
    let caption = '';

    // Court name — Ohio Court of Common Pleas
    let courtName = affidavitData.court || affidavitData.courtName || '[COURT NAME]';
    courtName = courtName.toUpperCase();

    caption += `IN THE ${courtName}\n\n`;

    // Case number — Ohio uses "CASE NO."
    const caseNumber = affidavitData.caseNumber || '[CASE NUMBER]';
    caption += `CASE NO. ${caseNumber.toUpperCase()}\n\n`;

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
   * Ohio-specific validation
   *
   * @param {Object} affidavitData - The affidavit data to validate
   * @returns {Object} Validation result with errors and warnings
   */
  performStateSpecificValidation(affidavitData) {
    const errors = [];
    const warnings = [];

    // County is REQUIRED for Ohio
    if (!affidavitData.county || affidavitData.county.trim().length === 0) {
      errors.push('County is required for Ohio affidavits');
    }

    return { errors, warnings };
  }

  /**
   * Ohio notary block
   * Compliant with R.C. § 147.03 (Ohio Notary Public Act)
   * Notary title includes "State of Ohio" and commission expiration
   *
   * @param {Object} affidavitData - The affidavit data
   * @returns {string} Notary block text
   */
  generateNotaryBlock(affidavitData) {
    const county = affidavitData.county || '_______________';
    return `STATE OF OHIO
County of ${county}

Sworn to and subscribed before me this ___ day of _______________, 20___.


_________________________________
Notary Public, State of Ohio

My commission expires: ___________`;
  }

  /**
   * Ohio perjury statement
   * References R.C. § 2921.11 (perjury)
   *
   * @returns {string} Perjury statement text
   */
  generatePerjuryStatement() {
    return 'I declare under penalty of perjury under the laws of the State of Ohio that the foregoing is true and correct. I understand that making a false statement under oath is punishable as perjury under R.C. § 2921.11.';
  }

  /**
   * Ohio exhibit rules
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
      instructions: 'Each exhibit must have a cover page identifying the exhibit letter and a brief description. Attach exhibits after the signature and notary block in sequential order.'
    };
  }
}

module.exports = OhioAffidavitTemplate;
