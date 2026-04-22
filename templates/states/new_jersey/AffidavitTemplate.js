// templates/states/new_jersey/AffidavitTemplate.js
// New Jersey Affidavit Template
// Governing Law: N.J.S.A. 2B:3-1 (affidavits), N.J.S.A. 2C:28-1 (perjury),
//                N.J. Court Rule 1:4-4(b) (certification), N.J.S.A. 52:7-10 et seq. (notary)

const BaseAffidavitTemplate = require('../../core/BaseAffidavitTemplate');

/**
 * New Jersey Affidavit Template - Legally Compliant v1.0
 *
 * COMPLIANCE NOTES:
 * - New Jersey uses "STATE OF NEW JERSEY" as header
 * - Perjury statement REQUIRED — N.J. Court Rule 1:4-4(b) certification language used;
 *   criminal perjury penalty under N.J.S.A. 2C:28-1; traditional notarized oath per N.J.S.A. 2B:3-1
 * - County is a REQUIRED field
 * - Case number label is "DOCKET NO." (New Jersey Superior Court standard)
 * - Notary block must conform to N.J.S.A. 52:7-10 et seq.
 * - Notary title is "Notary Public of New Jersey"; commission includes county of appointment
 * - Exhibits labeled with letters; cover page required
 *
 * NOTE: New Jersey courts commonly accept a "certification" (N.J. Court Rule 1:4-4(b))
 * in lieu of a sworn affidavit for many court submissions. This template generates
 * the traditional sworn affidavit with notary block.
 *
 * @class NewJerseyAffidavitTemplate
 * @extends BaseAffidavitTemplate
 */
class NewJerseyAffidavitTemplate extends BaseAffidavitTemplate {
  constructor() {
    super();

    // Load metadata
    this.metadata = require('./metadata.json');
    this.state = this.metadata.stateCode;
    this.stateName = this.metadata.stateName;
    this.requiredFields = this.metadata.requiredFields;

    // New Jersey requires a perjury statement in sworn affidavits
    this.sections.perjuryStatement = true;
  }

  /**
   * New Jersey header — "STATE OF NEW JERSEY"
   *
   * @returns {string} Header text
   */
  generateHeader() {
    return 'STATE OF NEW JERSEY';
  }

  /**
   * New Jersey venue format
   *
   * @param {string} county - County name
   * @returns {string} Formatted venue
   */
  generateVenue(county) {
    const countyUpper = (county || '[COUNTY]').toUpperCase();
    return `COUNTY OF ${countyUpper}`;
  }

  /**
   * New Jersey case caption uses "DOCKET NO." as the case number label
   *
   * @param {Object} affidavitData - The affidavit data
   * @returns {Object} Case caption with formatted text
   */
  generateCaseCaption(affidavitData) {
    let caption = '';

    // Court name — New Jersey Superior Court
    let courtName = affidavitData.court || affidavitData.courtName || '[COURT NAME]';
    courtName = courtName.toUpperCase();

    caption += `${courtName}\n\n`;

    // Case number — New Jersey uses "DOCKET NO."
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
   * New Jersey-specific validation
   *
   * @param {Object} affidavitData - The affidavit data to validate
   * @returns {Object} Validation result with errors and warnings
   */
  performStateSpecificValidation(affidavitData) {
    const errors = [];
    const warnings = [];

    // County is REQUIRED for New Jersey
    if (!affidavitData.county || affidavitData.county.trim().length === 0) {
      errors.push('County is required for New Jersey affidavits');
    }

    // Remind about NJ certification option
    warnings.push('In New Jersey, court submissions may use a Certification (N.J. Court Rule 1:4-4(b)) in lieu of a notarized affidavit for many purposes.');

    return { errors, warnings };
  }

  /**
   * New Jersey notary block
   * Compliant with N.J.S.A. 52:7-10 et seq.
   * Notary title includes "of New Jersey"; commission includes county
   *
   * @param {Object} affidavitData - The affidavit data
   * @returns {string} Notary block text
   */
  generateNotaryBlock(affidavitData) {
    const county = affidavitData.county || '_______________';
    return `STATE OF NEW JERSEY
County of ${county}

Subscribed and sworn to before me this ___ day of _______________, 20___.


_________________________________
Notary Public of New Jersey

My commission expires: ___________`;
  }

  /**
   * New Jersey perjury statement
   * Uses N.J. Court Rule 1:4-4(b) certification language as the perjury notice,
   * in addition to the sworn notary jurat above.
   *
   * @returns {string} Perjury statement text
   */
  generatePerjuryStatement() {
    return 'I certify that the foregoing statements made by me are true. I am aware that if any of the foregoing statements made by me are willfully false, I am subject to punishment.';
  }

  /**
   * New Jersey exhibit rules
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
      instructions: 'Exhibits must be labeled with letters (A, B, C, etc.), identified with a cover page, and referenced in the body of the affidavit or certification. Attach exhibits at the end of the document.'
    };
  }
}

module.exports = NewJerseyAffidavitTemplate;
