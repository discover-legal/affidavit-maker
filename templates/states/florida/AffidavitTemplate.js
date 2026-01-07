// templates/states/florida/AffidavitTemplate.js
// LEGAL COMPLIANCE VERSION 2.0 - Updated to conform with FL statutory requirements
// Governing Law: Fla. Stat. § 92.50, Fla. Stat. § 117.05, Fla. Stat. § 92.525

const BaseAffidavitTemplate = require('../../core/BaseAffidavitTemplate');

/**
 * Florida Affidavit Template - LEGALLY COMPLIANT v2.0
 *
 * CRITICAL COMPLIANCE NOTES:
 * - NO perjury statement in document text (oath administered by notary provides warning)
 * - Notary block must follow Fla. Stat. § 117.05 format
 * - Must specify physical presence OR online notarization
 * - County is required field
 * - Uses "CASE NO." terminology (Florida standard)
 *
 * @class FloridaAffidavitTemplate
 * @extends BaseAffidavitTemplate
 */
class FloridaAffidavitTemplate extends BaseAffidavitTemplate {
  constructor() {
    super();

    // Load metadata
    this.metadata = require('./metadata.json');
    this.state = this.metadata.stateCode;
    this.stateName = this.metadata.stateName;
    this.requiredFields = this.metadata.requiredFields;

    // Florida does NOT include perjury statement in sworn affidavits
    this.sections.perjuryStatement = false;
  }

  /**
   * Florida-specific case caption with "CASE NO." terminology
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

    // Case number - Florida uses "CASE NO."
    const caseNumber = affidavitData.caseNumber || '[CASE NUMBER]';
    caption += `CASE NO. ${caseNumber.toUpperCase()}\n\n`;

    // Add party names
    const plaintiff = affidavitData.plaintiff || '[PLAINTIFF NAME]';
    const defendant = affidavitData.defendant || '[DEFENDANT NAME]';

    caption += `${plaintiff.toUpperCase()},\n`;
    caption += `    Plaintiff,\n\n`;
    caption += `vs.\n\n`;
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
   * Florida-specific validation
   *
   * @param {Object} affidavitData - The affidavit data to validate
   * @returns {Object} Validation result with errors and warnings
   */
  performStateSpecificValidation(affidavitData) {
    const errors = [];
    const warnings = [];

    // County is REQUIRED for Florida
    if (!affidavitData.county || affidavitData.county.trim().length === 0) {
      errors.push('County is required for Florida affidavits');
    }

    // Warn if perjury statement is somehow present (shouldn't be for Florida)
    const factsText = (affidavitData.facts || []).join(' ').toLowerCase();
    if (factsText.includes('penalty of perjury') || factsText.includes('under perjury')) {
      warnings.push('Florida sworn affidavits do not require perjury statement in document text - oath provides warning');
    }

    return { errors, warnings };
  }

  /**
   * Florida notary block per Fla. Stat. § 117.05
   * COMPLIANT WITH: Statutory jurat format with physical/online presence specification
   *
   * NOTE: Florida requires specification of physical presence OR online notarization
   * as of recent updates to § 117.05
   *
   * @param {Object} affidavitData - The affidavit data
   * @returns {string} Notary block text
   */
  generateNotaryBlock(affidavitData) {
    return `State of Florida
County of _______________

Sworn to (or affirmed) and subscribed before me by means of
☐ physical presence or ☐ online notarization,
this _____ day of _______, 20__, by _______________________
(name of person making statement).


_________________________________
Notary Public - State of Florida

[Print, Type, or Stamp Commissioned Name]

Personally Known ______ OR Produced Identification ______
Type of Identification Produced: _______________________`;
  }

  /**
   * Florida exhibit rules
   * Letters (A, B, C), cover pages required per Florida practice
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
   * No perjury statement for Florida sworn affidavits
   * The oath administered by the notary provides the perjury warning per § 92.50
   *
   * @returns {null} No perjury statement
   */
  generatePerjuryStatement() {
    return null;
  }

  /**
   * Florida-specific venue format (sentence case)
   *
   * @param {Object} affidavitData - The affidavit data
   * @returns {string} Formatted venue
   */
  generateVenue(affidavitData) {
    const county = affidavitData.county || '[COUNTY NAME]';
    return `State of Florida\nCounty of ${county}`;
  }
}

module.exports = FloridaAffidavitTemplate;
