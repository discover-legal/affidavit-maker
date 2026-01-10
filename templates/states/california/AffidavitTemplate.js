// templates/states/california/AffidavitTemplate.js
// LEGAL COMPLIANCE VERSION 2.0 - Updated to conform with CA statutory requirements
// Governing Law: Cal. Gov't Code § 8202, Cal. Civ. Proc. Code § 2015.5, Cal. Civ. Code § 1189

const BaseAffidavitTemplate = require('../../core/BaseAffidavitTemplate');

/**
 * California Affidavit Template - LEGALLY COMPLIANT v2.0
 *
 * CRITICAL COMPLIANCE NOTES:
 * - Perjury statement REQUIRED in traditional sworn affidavits
 * - Notary block must follow Gov't Code § 8202 format with identity verification notice
 * - County is required field
 * - Uses "CASE NO." terminology (California standard)
 * - Alternative: CCP § 2015.5 allows unsworn declarations (future enhancement)
 *
 * @class CaliforniaAffidavitTemplate
 * @extends BaseAffidavitTemplate
 */
class CaliforniaAffidavitTemplate extends BaseAffidavitTemplate {
  constructor() {
    super();

    // Load metadata
    this.metadata = require('./metadata.json');
    this.state = this.metadata.stateCode;
    this.stateName = this.metadata.stateName;
    this.requiredFields = this.metadata.requiredFields;

    // California includes perjury statement in sworn affidavits
    this.sections.perjuryStatement = true;
  }

  /**
   * California-specific case caption with "CASE NO." terminology
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

    // Case number - California uses "CASE NO."
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
   * California-specific validation
   *
   * @param {Object} affidavitData - The affidavit data to validate
   * @returns {Object} Validation result with errors and warnings
   */
  performStateSpecificValidation(affidavitData) {
    const errors = [];
    const warnings = [];

    // County is REQUIRED for California
    if (!affidavitData.county || affidavitData.county.trim().length === 0) {
      errors.push('County is required for California affidavits');
    }

    // Verify perjury statement is present
    const factsText = (affidavitData.facts || []).join(' ').toLowerCase();
    if (!factsText.includes('penalty of perjury') && !factsText.includes('under perjury')) {
      warnings.push('Consider adding language about penalty of perjury for California sworn affidavits');
    }

    return { errors, warnings };
  }

  /**
   * California notary block per Cal. Gov't Code § 8202
   * COMPLIANT WITH: Statutory jurat format with identity verification notice
   *
   * NOTE: This format includes the required boxed notice at top per § 8202(c)
   *
   * @param {Object} affidavitData - The affidavit data
   * @returns {string} Notary block text
   */
  generateNotaryBlock(affidavitData) {
    return `┌────────────────────────────────────────────────────────────────────┐
│ A notary public or other officer completing this certificate      │
│ verifies only the identity of the individual who signed the       │
│ document to which this certificate is attached, and not the       │
│ truthfulness, accuracy, or validity of that document.             │
└────────────────────────────────────────────────────────────────────┘

State of ${this.stateName}
County of _______________

Subscribed and sworn to (or affirmed) before me on this _____ day of
_______, 20__, by _________________________, proved to me on the
basis of satisfactory evidence to be the person(s) who appeared before me.


_________________________________
Notary Public Signature

[Notary Seal]`;
  }

  /**
   * California exhibit rules
   * Letters (A, B, C), cover pages required per California practice
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
      instructions: 'Each exhibit must have a cover page with the exhibit letter (A, B, C, etc.) centered at the top. The cover page should include a brief description of the exhibit.'
    };
  }

  /**
   * California perjury statement
   * Required for traditional sworn affidavits
   *
   * NOTE: CCP § 2015.5 allows unsworn declarations as an alternative,
   * but this template implements the traditional notarized affidavit format.
   *
   * @returns {string} Perjury statement text
   */
  generatePerjuryStatement() {
    return `I declare under penalty of perjury under the laws of the State of ${this.stateName} that the foregoing is true and correct.`;
  }

  /**
   * California-specific venue format (sentence case per local practice)
   *
   * @param {string} county - County name
   * @returns {string} Formatted venue
   */
  generateVenue(county) {
    const countyName = county || '[COUNTY NAME]';
    return `State of ${this.stateName}\nCounty of ${countyName}`;
  }
}

module.exports = CaliforniaAffidavitTemplate;
