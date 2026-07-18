// templates/states/utah/AffidavitTemplate.js
// LEGAL COMPLIANCE VERSION 2.0 - Updated to conform with UT statutory requirements
// Governing Law: Utah Code § 46-1-6.5 (PRESCRIPTIVE STATUTORY FORM)

const BaseAffidavitTemplate = require('../../core/BaseAffidavitTemplate');

/**
 * Utah Affidavit Template - LEGALLY COMPLIANT v2.0
 *
 * CRITICAL COMPLIANCE NOTES:
 * - Header MUST be "State of Utah" (sentence case per § 46-1-6.5)
 * - Notary block follows prescriptive statutory form (§ 46-1-6.5(2)(b))
 * - Mandatory oath instruction (§ 46-1-6.5(2)(a))
 * - NO perjury statement (oath provides warning)
 * - Enhanced competency statement for URCP Rule 56 compliance
 *
 * @class UtahAffidavitTemplate
 * @extends BaseAffidavitTemplate
 */
class UtahAffidavitTemplate extends BaseAffidavitTemplate {
  constructor() {
    super();

    // Load metadata
    this.metadata = require('./metadata.json');
    this.state = this.metadata.stateCode;
    this.stateName = this.metadata.stateName;
    this.requiredFields = this.metadata.requiredFields;

    // Utah does NOT include perjury statement in sworn affidavits
    this.sections.perjuryStatement = false;
  }

  /**
   * Utah-specific case caption with "CASE NO." terminology
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

    // Case number - Utah uses "CASE NO."
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
   * Utah Code § 46-1-6.5 requires "State of Utah" (sentence case)
   * NOT "STATE OF UTAH" (all caps)
   *
   * @returns {string} Header text
   */
  generateHeader() {
    return 'State of Utah'; // CRITICAL FIX: Sentence case per statute
  }

  /**
   * Utah Code § 46-1-6.5 format for venue
   *
   * @param {string} county - County name
   * @returns {string} Venue text
   */
  generateVenue(county) {
    // Properly capitalize county name (title case for each word)
    const normalizedCounty = county ? county.replace(/\s+county$/i, '').trim() : '';
    const countyName = normalizedCounty
      ? normalizedCounty.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ')
      : '____________';
    return `County of ${countyName}`; // Matches statutory form
  }

  /**
   * Utah-specific validation
   *
   * @param {Object} affidavitData - The affidavit data to validate
   * @returns {Object} Validation result with errors and warnings
   */
  performStateSpecificValidation(affidavitData) {
    const errors = [];
    const warnings = [];

    // County is REQUIRED for Utah
    if (!affidavitData.county || affidavitData.county.trim().length === 0) {
      errors.push('County is required for Utah affidavits per Utah Code § 46-1-6.5');
    }

    // Check for incorrect header format
    if (affidavitData._generatedHeader === 'STATE OF UTAH') {
      errors.push('Utah header must be "State of Utah" (sentence case) per § 46-1-6.5, not "STATE OF UTAH"');
    }

    return { errors, warnings };
  }

  /**
   * Enhanced competency statement for URCP Rule 56(c)(4) compliance
   * Explicitly addresses "competent to testify" requirement
   *
   * @param {string} affiantName - Name of affiant
   * @returns {Object} Competency statement fact object
   */
  generateCompetencyStatement(affiantName) {
    return {
      number: 1,
      content: 'I am over the age of eighteen (18) years, of sound mind, and otherwise competent to make this affidavit. The facts stated herein are within my personal knowledge and are true and correct. If called as a witness, I could testify competently to the matters stated herein.',
      type: 'competency'
    };
  }

  /**
   * Utah notary block per Utah Code § 46-1-6.5(2)(b)
   * STATUTORY REQUIREMENTS:
   * - Must include notary's name
   * - Must use specific date format: (date) day of (month), in the year (year)
   * - Must include document signer's name
   * - Must include commission expiration (§ 46-1-16)
   *
   * @param {Object} affidavitData - The affidavit data
   * @returns {string} Notary block text
   */
  generateNotaryBlock(affidavitData) {
    return `Subscribed and sworn to before me, ________________________________,
                                    (notary public name)

on this _______ day of _________________, in the year _______,
        (date)          (month)                      (year)

by ________________________________.
    (name of document signer)


(SEAL)                              _________________________________
                                    Notary Public, State of ${this.stateName}

My commission expires: ___________`;
  }

  /**
   * Mandatory oath instruction per Utah Code § 46-1-6.5(2)(a)
   * The notary MUST administer this specific oath
   *
   * @returns {string} Notary instruction text
   */
  generateNotaryInstruction() {
    return `INSTRUCTION FOR NOTARY PUBLIC:
Before completing the jurat below, you MUST administer the following oath to the affiant as required by Utah Code § 46-1-6.5(2)(a):
"Do you swear or affirm under penalty of perjury that the statements in your document are true?"
Only after administering this oath may you complete the certificate below.`;
  }

  /**
   * Utah exhibit rules
   * Letters (A, B, C), cover pages recommended
   *
   * @returns {Object} Exhibit formatting rules
   */
  getExhibitRules() {
    return {
      labelStyle: 'letters', // A, B, C...
      requireCoverPage: true, // Recommended by Utah courts for clarity
      coverPageFormat: {
        title: 'EXHIBIT [LABEL]',
        centered: true,
        description: true
      },
      allowedFormats: ['PDF', 'JPG', 'PNG'],
      maxFileSize: 25 * 1024 * 1024, // 25MB
      maxTotalSize: 100 * 1024 * 1024, // 100MB
      instructions: 'Exhibits should be labeled with letters (A, B, C, etc.). Cover pages are recommended for clarity.'
    };
  }

  /**
   * No perjury statement for Utah sworn affidavits
   * Perjury warning is provided through the MANDATORY oath (§ 46-1-6.5(2)(a))
   *
   * @returns {null} No perjury statement
   */
  generatePerjuryStatement() {
    return null;
  }

  /**
   * Override document generation to include notary instruction
   *
   * @param {Object} affidavitData - The affidavit data
   * @returns {Object} Complete document with notary instruction
   */
  generateDocument(affidavitData = {}) {
    const doc = super.generateDocument(affidavitData);

    // Add notary instruction to sections
    doc.sections.notaryInstruction = this.generateNotaryInstruction();

    // Update full text to include instruction
    const instructionText = '\n\n' + this.generateNotaryInstruction() + '\n\n';
    const notaryBlockIndex = doc.fullText.indexOf(doc.sections.notaryBlock);
    if (notaryBlockIndex > -1) {
      doc.fullText = doc.fullText.slice(0, notaryBlockIndex) +
                     instructionText +
                     doc.fullText.slice(notaryBlockIndex);
    }

    return doc;
  }
}

module.exports = UtahAffidavitTemplate;
