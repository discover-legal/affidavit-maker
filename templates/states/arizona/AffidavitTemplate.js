// templates/states/arizona/AffidavitTemplate.js
// LEGAL COMPLIANCE VERSION 2.0 - Updated to conform with AZ statutory requirements
// Governing Law: A.R.S. § 13-2702 (Perjury), A.R.S. § 41-311 (Notary — forms of notarial acts)

const BaseAffidavitTemplate = require('../../core/BaseAffidavitTemplate');

/**
 * Arizona Affidavit Template - LEGALLY COMPLIANT v2.0
 *
 * CRITICAL COMPLIANCE NOTES:
 * - Arizona-specific perjury statement (best practice per A.R.S. § 13-2702)
 * - Commission expiration line (best practice per A.R.S. § 41-311)
 * - County is required field
 * - Enhanced competency statement with explicit "competent to testify" language
 *
 * @class ArizonaAffidavitTemplate
 * @extends BaseAffidavitTemplate
 */
class ArizonaAffidavitTemplate extends BaseAffidavitTemplate {
  constructor() {
    super();

    // Load metadata
    this.metadata = require('./metadata.json');
    this.state = this.metadata.stateCode;
    this.stateName = this.metadata.stateName;
    this.requiredFields = this.metadata.requiredFields;

    // Arizona DOES include perjury statement (best practice)
    this.sections.perjuryStatement = true;
  }

  /**
   * Arizona-specific case caption with "CASE NO." terminology
   *
   * @param {Object} affidavitData - The affidavit data
   * @returns {Object} Case caption with formatted text
   */
  generateCaseCaption(affidavitData) {
    let caption = '';

    // Court name - use 'court' field (matches schema), fallback to courtName for backwards compatibility
    let courtName = affidavitData.court || affidavitData.courtName || '[COURT NAME]';
    courtName = courtName.toUpperCase();

    caption += `IN THE ${courtName}\n\n`;

    // Case number - Arizona uses "CASE NO."
    const caseNumber = affidavitData.caseNumber || '[CASE NUMBER]';
    caption += `CASE NO. ${caseNumber.toUpperCase()}\n\n`;

    // Add party names
    const plaintiff = affidavitData.plaintiff || '[PLAINTIFF NAME]';
    const defendant = affidavitData.defendant || '[DEFENDANT NAME]';

    caption += `${plaintiff.toUpperCase()}\n\n`;
    caption += `V.\n\n`;
    caption += `${defendant.toUpperCase()}`;

    return {
      courtName,
      caseNumber: affidavitData.caseNumber,
      plaintiff: affidavitData.plaintiff,
      defendant: affidavitData.defendant,
      formatted: caption
    };
  }

  /**
   * Arizona venue with proper county name capitalization
   *
   * @param {string} county - County name
   * @returns {string} Venue text
   */
  generateVenue(county) {
    // Properly capitalize county name (title case for each word)
    const countyName = county
      ? county.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ')
      : '[COUNTY]';
    return `County of ${countyName}`;
  }

  /**
   * Arizona-specific validation
   *
   * @param {Object} affidavitData - The affidavit data to validate
   * @returns {Object} Validation result with errors and warnings
   */
  performStateSpecificValidation(affidavitData) {
    const errors = [];
    const warnings = [];

    // County is REQUIRED for Arizona
    if (!affidavitData.county || affidavitData.county.trim().length === 0) {
      errors.push('County is required for Arizona affidavits (universal practice and A.R.S. § 41-311 notarial act requirements)');
    }

    return { errors, warnings };
  }

  /**
   * Enhanced competency statement
   * Explicitly address Rule 56 competency requirement
   * Per Elerick v. Rocklin, 103 Ariz. 76
   *
   * @param {string} affiantName - Name of affiant
   * @returns {Object} Competency statement fact object
   */
  generateCompetencyStatement(affiantName) {
    const name = affiantName || 'I';
    return {
      number: 1,
      content: `${name} am over the age of eighteen (18) years, of sound mind, and otherwise competent to make this affidavit. The facts stated herein are within my personal knowledge and are true and correct. I am competent to testify to the matters stated in this affidavit.`,
      type: 'competency'
    };
  }

  /**
   * Arizona exhibit rules
   * Letters (A, B, C), cover pages required with specific format
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
        description: true,
        specificFormat: 'Arizona courts require each exhibit to have a cover page with the exhibit letter centered at the top and a brief description of the document.'
      },
      allowedFormats: ['PDF', 'JPG', 'PNG'],
      maxFileSize: 25 * 1024 * 1024, // 25MB
      maxTotalSize: 100 * 1024 * 1024, // 100MB
      instructions: 'Each exhibit must have a cover page with the exhibit letter (A, B, C, etc.) centered at the top. Include a brief description of the exhibit on the cover page.'
    };
  }

  /**
   * Arizona-specific perjury statement
   * Includes state-specific reference per A.R.S. § 13-2702
   *
   * @returns {string} Perjury statement text
   */
  generatePerjuryStatement() {
    return `I declare under penalty of perjury under the laws of the State of ${this.stateName} that the foregoing is true and correct.`;
  }

  /**
   * Arizona notary block
   * - Added "or affirmed" option
   * - Added commission expiration line (best practice per A.R.S. § 41-311)
   * - Clarified seal placement
   *
   * @param {Object} affidavitData - The affidavit data
   * @returns {string} Notary block text
   */
  generateNotaryBlock(affidavitData) {
    return `Subscribed and sworn to (or affirmed) before me this _____ day of
_____________, 20___.


(SEAL)                              _________________________________
                                    Notary Public

My commission expires: ___________`;
  }
}

module.exports = ArizonaAffidavitTemplate;
