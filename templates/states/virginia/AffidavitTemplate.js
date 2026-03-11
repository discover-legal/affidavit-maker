// templates/states/virginia/AffidavitTemplate.js
// Virginia Affidavit Template
// Governing Law: Va. Code § 8.01-390, Va. Code § 18.2-434, Va. Code § 47.1-12

const BaseAffidavitTemplate = require('../../core/BaseAffidavitTemplate');

/**
 * Virginia Affidavit Template - Legally Compliant v1.0
 *
 * COMPLIANCE NOTES:
 * - Virginia uses "COMMONWEALTH OF VIRGINIA" as header
 * - Perjury statement REQUIRED — references Va. Code § 18.2-434
 * - County is a REQUIRED field (Virginia also has independent cities; county
 *   is used generically here — users should enter "City of [Name]" when applicable)
 * - Case number label is "CASE NO." (Virginia Circuit Court standard)
 * - Notary block must conform to Va. Code § 47.1-12 and must include
 *   Registration Number as required by Virginia
 * - Exhibits labeled with letters; cover page required
 *
 * @class VirginiaAffidavitTemplate
 * @extends BaseAffidavitTemplate
 */
class VirginiaAffidavitTemplate extends BaseAffidavitTemplate {
  constructor() {
    super();

    // Load metadata
    this.metadata = require('./metadata.json');
    this.state = this.metadata.stateCode;
    this.stateName = this.metadata.stateName;
    this.requiredFields = this.metadata.requiredFields;

    // Virginia requires a perjury statement
    this.sections.perjuryStatement = true;
  }

  /**
   * Virginia header uses "COMMONWEALTH OF VIRGINIA" rather than "STATE OF"
   *
   * @returns {string} Header text
   */
  generateHeader() {
    return 'COMMONWEALTH OF VIRGINIA';
  }

  /**
   * Virginia venue format
   * Note: Virginia has independent cities that are not part of any county.
   * The county field should contain either "COUNTY OF [NAME]" or "CITY OF [NAME]".
   *
   * @param {string} county - County or independent city name
   * @returns {string} Formatted venue
   */
  generateVenue(county) {
    const countyUpper = (county || '[COUNTY]').toUpperCase();
    // If user entered "City of X" we preserve it; otherwise prefix COUNTY OF
    if (countyUpper.startsWith('CITY OF')) {
      return countyUpper;
    }
    return `COUNTY OF ${countyUpper}`;
  }

  /**
   * Virginia case caption uses "CASE NO." as the case number label
   *
   * @param {Object} affidavitData - The affidavit data
   * @returns {Object} Case caption with formatted text
   */
  generateCaseCaption(affidavitData) {
    let caption = '';

    // Court name — Virginia Circuit Court
    let courtName = affidavitData.court || affidavitData.courtName || '[COURT NAME]';
    courtName = courtName.toUpperCase();

    caption += `IN THE ${courtName}\n\n`;

    // Case number — Virginia uses "CASE NO."
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
   * Virginia-specific validation
   *
   * @param {Object} affidavitData - The affidavit data to validate
   * @returns {Object} Validation result with errors and warnings
   */
  performStateSpecificValidation(affidavitData) {
    const errors = [];
    const warnings = [];

    // County is REQUIRED for Virginia
    if (!affidavitData.county || affidavitData.county.trim().length === 0) {
      errors.push('County (or independent city) is required for Virginia affidavits');
    }

    // Remind users about independent cities
    if (affidavitData.county && !affidavitData.county.toUpperCase().startsWith('CITY OF')) {
      warnings.push('If the venue is an independent Virginia city (e.g., Richmond, Alexandria), enter "City of [Name]" in the county field rather than a county name.');
    }

    return { errors, warnings };
  }

  /**
   * Virginia notary block
   * Compliant with Va. Code § 47.1-12 (Virginia Notary Public Act)
   * Virginia notaries must include their Registration Number on the jurat
   *
   * @param {Object} affidavitData - The affidavit data
   * @returns {string} Notary block text
   */
  generateNotaryBlock(affidavitData) {
    const county = affidavitData.county || '_______________';
    return `COMMONWEALTH OF VIRGINIA
County/City of ${county}

Subscribed and sworn to before me this ___ day of _______________, 20___.


_________________________________
Notary Public

My commission expires: ___________
Registration No.: ___________`;
  }

  /**
   * Virginia perjury statement
   * References Va. Code § 18.2-434
   *
   * @returns {string} Perjury statement text
   */
  generatePerjuryStatement() {
    return 'I declare under penalty of perjury that the foregoing is true and correct to the best of my knowledge, information, and belief. I understand that making a false statement under oath is punishable as perjury under Va. Code § 18.2-434.';
  }

  /**
   * Virginia exhibit rules
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
      instructions: 'Exhibits must be labeled with letters (A, B, C, etc.) and identified with a cover page. Attach exhibits in order after the affidavit.'
    };
  }
}

module.exports = VirginiaAffidavitTemplate;
