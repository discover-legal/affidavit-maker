// templates/states/illinois/AffidavitTemplate.js
// LEGAL COMPLIANCE VERSION 2.0 - Updated to conform with IL statutory requirements
// Governing Law: 735 ILCS 5/1-109, 735 ILCS 5/2-1005, 5 ILCS 312/ (Illinois Notary Public Act)

const BaseAffidavitTemplate = require('../../core/BaseAffidavitTemplate');

/**
 * Illinois Affidavit Template - LEGALLY COMPLIANT v2.0
 *
 * CRITICAL COMPLIANCE NOTES:
 * - Traditional notarized affidavit format
 * - Perjury statement REQUIRED
 * - County is required field
 * - Uses "CASE NO." terminology (Illinois standard)
 * - NOTE: 735 ILCS 5/1-109 allows certifications under penalty of perjury
 *   as alternative to notarized affidavits (future enhancement)
 *
 * @class IllinoisAffidavitTemplate
 * @extends BaseAffidavitTemplate
 */
class IllinoisAffidavitTemplate extends BaseAffidavitTemplate {
  constructor() {
    super();

    // Load metadata
    this.metadata = require('./metadata.json');
    this.state = this.metadata.stateCode;
    this.stateName = this.metadata.stateName;
    this.requiredFields = this.metadata.requiredFields;

    // Illinois includes perjury statement in sworn affidavits
    this.sections.perjuryStatement = true;
  }

  /**
   * Illinois-specific case caption with "CASE NO." terminology
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

    // Case number - Illinois uses "CASE NO."
    const caseNumber = affidavitData.caseNumber || '[CASE NUMBER]';
    caption += `CASE NO. ${caseNumber.toUpperCase()}\n\n`;

    // Add party names
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
   * Illinois-specific validation
   *
   * @param {Object} affidavitData - The affidavit data to validate
   * @returns {Object} Validation result with errors and warnings
   */
  performStateSpecificValidation(affidavitData) {
    const errors = [];
    const warnings = [];

    // County is REQUIRED for Illinois
    if (!affidavitData.county || affidavitData.county.trim().length === 0) {
      errors.push('County is required for Illinois affidavits');
    }

    // Verify perjury statement is present
    const factsText = (affidavitData.facts || []).join(' ').toLowerCase();
    if (!factsText.includes('penalty of perjury') && !factsText.includes('under perjury')) {
      warnings.push('Consider adding language about penalty of perjury for Illinois sworn affidavits');
    }

    return { errors, warnings };
  }

  /**
   * Illinois notary block - Standard jurat format
   * COMPLIANT WITH: 5 ILCS 255/1 (Oaths and Affirmations Act) and
   *                 5 ILCS 312/ (Illinois Notary Public Act)
   *
   * NOTE: This implements the traditional notarized affidavit format.
   * 735 ILCS 5/1-109 allows certifications under penalty of perjury
   * as an alternative with same force and effect.
   * Perjury for false sworn statements governed by 720 ILCS 5/32-2.
   *
   * @param {Object} affidavitData - The affidavit data
   * @returns {string} Notary block text
   */
  generateNotaryBlock(affidavitData) {
    return `State of ${this.stateName}
County of _______________

Signed and sworn (or affirmed) to before me on _____________ (date)
by __________________ (name of person making statement).


_________________________________
Notary Public

[Notary Seal]

My commission expires: ___________`;
  }

  /**
   * Illinois exhibit rules
   * Letters or numbers acceptable, cover pages recommended but not required
   *
   * @returns {Object} Exhibit formatting rules
   */
  getExhibitRules() {
    return {
      labelStyle: 'letters', // A, B, C... (numbers also acceptable)
      requireCoverPage: false,
      coverPageFormat: {
        title: 'EXHIBIT [LABEL]',
        centered: true,
        description: true
      },
      allowedFormats: ['PDF', 'JPG', 'PNG'],
      maxFileSize: 25 * 1024 * 1024, // 25MB
      maxTotalSize: 100 * 1024 * 1024, // 100MB
      instructions: 'Exhibits may be labeled with letters (A, B, C, etc.) or numbers. Cover pages are recommended but not required.'
    };
  }

  /**
   * Illinois perjury statement
   * Required for traditional sworn affidavits
   *
   * NOTE: 735 ILCS 5/1-109 allows certifications under penalty of perjury
   * as an alternative, but this template implements the traditional
   * notarized affidavit format.
   *
   * @returns {string} Perjury statement text
   */
  generatePerjuryStatement() {
    return 'Under penalties as provided by law pursuant to Section 1-109 of the Code of Civil Procedure, the undersigned certifies that the statements set forth in this instrument are true and correct.';
  }

  /**
   * Illinois-specific venue format (uppercase)
   *
   * @param {string} county - County name
   * @returns {string} Formatted venue
   */
  generateVenue(county) {
    const countyName = county || '[COUNTY NAME]';
    return `STATE OF ILLINOIS\nCOUNTY OF ${countyName.toUpperCase()}`;
  }
}

module.exports = IllinoisAffidavitTemplate;
