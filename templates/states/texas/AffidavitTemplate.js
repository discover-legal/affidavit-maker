// templates/states/texas/AffidavitTemplate.js
// LEGAL COMPLIANCE VERSION 2.0 - Updated to conform with TX statutory requirements
// Governing Law: Tex. Gov't Code § 312.011, Tex. Civ. Prac. & Rem. Code § 18.002

const BaseAffidavitTemplate = require('../../core/BaseAffidavitTemplate');

/**
 * Texas Affidavit Template - LEGALLY COMPLIANT v2.0
 *
 * CRITICAL COMPLIANCE NOTES:
 * - NO perjury statement required (oath provides warning per § 312.011)
 * - Notary block matches statutory form (§ 18.002)
 * - County is required field
 * - Uses "CAUSE NO." terminology (Texas convention)
 *
 * @class TexasAffidavitTemplate
 * @extends BaseAffidavitTemplate
 */
class TexasAffidavitTemplate extends BaseAffidavitTemplate {
  constructor() {
    super();

    // Load metadata
    this.metadata = require('./metadata.json');
    this.state = this.metadata.stateCode;
    this.stateName = this.metadata.stateName;
    this.requiredFields = this.metadata.requiredFields;

    // Texas does NOT include perjury statement in sworn affidavits
    this.sections.perjuryStatement = false;
  }

  /**
   * Texas-specific case caption with "CAUSE NO." terminology
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

    // Case number - Texas uses "CAUSE NO."
    const caseNumber = affidavitData.caseNumber || '[CASE NUMBER]';
    caption += `CAUSE NO. ${caseNumber.toUpperCase()}\n\n`;

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
   * Texas-specific validation
   *
   * @param {Object} affidavitData - The affidavit data to validate
   * @returns {Object} Validation result with errors and warnings
   */
  performStateSpecificValidation(affidavitData) {
    const errors = [];
    const warnings = [];

    // County is REQUIRED for Texas
    if (!affidavitData.county || affidavitData.county.trim().length === 0) {
      errors.push('County is required for Texas affidavits');
    }

    // Warn if perjury statement is somehow present (shouldn't be)
    const factsText = (affidavitData.facts || []).join(' ').toLowerCase();
    if (factsText.includes('penalty of perjury') || factsText.includes('under perjury')) {
      warnings.push('Texas sworn affidavits do not require perjury statement in document text - oath provides warning');
    }

    return { errors, warnings };
  }

  /**
   * Texas notary block per Tex. Civ. Prac. & Rem. Code § 18.002
   * COMPLIANT WITH: Statutory jurat format
   *
   * @param {Object} affidavitData - The affidavit data
   * @returns {string} Notary block text
   */
  generateNotaryBlock(affidavitData) {
    return `SWORN TO AND SUBSCRIBED before me on this _____ day of _____________, 20___.


_________________________________
Notary Public, State of Texas

Notary's printed name: _______________________

My commission expires: ___________`;
  }

  /**
   * Texas exhibit rules
   * Letters (A, B, C), cover pages required per local rules
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
   * No perjury statement for Texas sworn affidavits
   * The oath administered by the notary provides the perjury warning per § 312.011
   *
   * @returns {null} No perjury statement
   */
  generatePerjuryStatement() {
    return null;
  }
}

module.exports = TexasAffidavitTemplate;
