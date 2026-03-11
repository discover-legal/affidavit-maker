// templates/states/north_carolina/AffidavitTemplate.js
// North Carolina Affidavit Template
// Governing Law: N.C.G.S. § 11-7, N.C.G.S. § 14-209, N.C.G.S. § 10B-20, N.C.G.S. § 10B-40

const BaseAffidavitTemplate = require('../../core/BaseAffidavitTemplate');

/**
 * North Carolina Affidavit Template - Legally Compliant v1.0
 *
 * COMPLIANCE NOTES:
 * - North Carolina uses "STATE OF NORTH CAROLINA" as header
 * - Perjury statement REQUIRED — references N.C.G.S. § 14-209
 * - County is a REQUIRED field
 * - Case number label is "FILE NO." (North Carolina General Court of Justice standard)
 * - Notary block must conform to N.C.G.S. § 10B-20 and § 10B-40
 * - Notary block includes county and "North Carolina" after notary title
 *
 * @class NorthCarolinaAffidavitTemplate
 * @extends BaseAffidavitTemplate
 */
class NorthCarolinaAffidavitTemplate extends BaseAffidavitTemplate {
  constructor() {
    super();

    // Load metadata
    this.metadata = require('./metadata.json');
    this.state = this.metadata.stateCode;
    this.stateName = this.metadata.stateName;
    this.requiredFields = this.metadata.requiredFields;

    // North Carolina requires a perjury statement
    this.sections.perjuryStatement = true;
  }

  /**
   * North Carolina header — "STATE OF NORTH CAROLINA"
   *
   * @returns {string} Header text
   */
  generateHeader() {
    return 'STATE OF NORTH CAROLINA';
  }

  /**
   * North Carolina venue format
   *
   * @param {string} county - County name
   * @returns {string} Formatted venue
   */
  generateVenue(county) {
    const countyUpper = (county || '[COUNTY]').toUpperCase();
    return `COUNTY OF ${countyUpper}`;
  }

  /**
   * North Carolina case caption uses "FILE NO." as the case number label
   *
   * @param {Object} affidavitData - The affidavit data
   * @returns {Object} Case caption with formatted text
   */
  generateCaseCaption(affidavitData) {
    let caption = '';

    // Court name — North Carolina General Court of Justice
    let courtName = affidavitData.court || affidavitData.courtName || '[COURT NAME]';
    courtName = courtName.toUpperCase();

    caption += `IN THE ${courtName}\n\n`;

    // Case number — North Carolina uses "FILE NO."
    const caseNumber = affidavitData.caseNumber || '[CASE NUMBER]';
    caption += `FILE NO. ${caseNumber.toUpperCase()}\n\n`;

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
   * North Carolina-specific validation
   *
   * @param {Object} affidavitData - The affidavit data to validate
   * @returns {Object} Validation result with errors and warnings
   */
  performStateSpecificValidation(affidavitData) {
    const errors = [];
    const warnings = [];

    // County is REQUIRED for North Carolina
    if (!affidavitData.county || affidavitData.county.trim().length === 0) {
      errors.push('County is required for North Carolina affidavits');
    }

    return { errors, warnings };
  }

  /**
   * North Carolina notary block
   * Compliant with N.C.G.S. § 10B-20 and § 10B-40 (North Carolina Notary Public Act)
   * Notary designation includes county and state per NC requirements
   *
   * @param {Object} affidavitData - The affidavit data
   * @returns {string} Notary block text
   */
  generateNotaryBlock(affidavitData) {
    const county = affidavitData.county || '_______________';
    return `STATE OF NORTH CAROLINA
County of ${county}

Sworn to and subscribed before me this ___ day of _______________, 20___.


_________________________________
Notary Public, ${county} County, North Carolina

My commission expires: ___________`;
  }

  /**
   * North Carolina perjury statement
   * References N.C.G.S. § 14-209
   *
   * @returns {string} Perjury statement text
   */
  generatePerjuryStatement() {
    return 'I declare under penalty of perjury that the foregoing is true and correct. I understand that making a false statement under oath is punishable as perjury under N.C.G.S. § 14-209.';
  }

  /**
   * North Carolina exhibit rules
   *
   * @returns {Object} Exhibit formatting rules
   */
  getExhibitRules() {
    return {
      labelStyle: 'letters', // A, B, C...
      requireCoverPage: false,
      coverPageFormat: {
        title: 'EXHIBIT [LABEL]',
        centered: true,
        description: true
      },
      allowedFormats: ['PDF', 'JPG', 'PNG'],
      maxFileSize: 25 * 1024 * 1024, // 25MB
      maxTotalSize: 100 * 1024 * 1024, // 100MB
      instructions: 'Exhibits may be labeled with letters (A, B, C, etc.) or numbers. Attach exhibits after the affidavit in the order they are referenced.'
    };
  }
}

module.exports = NorthCarolinaAffidavitTemplate;
