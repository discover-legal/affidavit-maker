// templates/states/louisiana/AffidavitTemplate.js
// Louisiana Affidavit Template — LEGALLY COMPLIANT v1.0
// Governing Law: La. R.S. 35:1 et seq. (Louisiana Notarial Act — oath authority and authentic acts),
//                La. R.S. 14:123 (false swearing / perjury)

const BaseAffidavitTemplate = require('../../core/BaseAffidavitTemplate');

/**
 * Louisiana Affidavit Template — LEGALLY COMPLIANT v1.0
 *
 * COMPLIANCE NOTES:
 * - Louisiana is the only U.S. civil law jurisdiction (Napoleonic Code tradition)
 * - Perjury statement REQUIRED — notary oath authority per La. R.S. 35:1 et seq.;
 *   criminal false swearing penalty under La. R.S. 14:123
 * - Parish is REQUIRED for Louisiana affidavits (Louisiana uses PARISHES, not counties)
 * - Case number label: "DOCKET NO."
 * - Header: "STATE OF LOUISIANA"
 * - Venue: "Parish of [Parish]" (title case per Louisiana practice)
 * - Louisiana notaries are QUASI-JUDICIAL OFFICERS with unique powers under civil law;
 *   notarial acts have special evidentiary status (authentic acts under La. C.C. Art. 1833)
 * - Notary block per La. R.S. 35:1 et seq.; notary designated as "Notary Public, State of Louisiana"
 * - Louisiana notary must include parish and Bar Roll / Notary ID number
 * - Notary may administer oath or affirmation (subscribed and sworn/affirmed)
 * - Exhibits labeled with letters (A, B, C)
 *
 * @class LouisianaAffidavitTemplate
 * @extends BaseAffidavitTemplate
 */
class LouisianaAffidavitTemplate extends BaseAffidavitTemplate {
  constructor() {
    super();

    this.metadata = require('./metadata.json');
    this.state = this.metadata.stateCode;
    this.stateName = this.metadata.stateName;
    this.requiredFields = this.metadata.requiredFields;

    // Louisiana requires perjury statement — notary oath authority per La. R.S. 35:1 et seq.;
    // criminal false swearing penalty per La. R.S. 14:123
    this.sections.perjuryStatement = true;
  }

  /**
   * Louisiana-specific case caption using "DOCKET NO." terminology
   *
   * @param {Object} affidavitData - The affidavit data
   * @returns {Object} Case caption with formatted text
   */
  generateCaseCaption(affidavitData) {
    let caption = '';

    let courtName = affidavitData.court || affidavitData.courtName || '[COURT NAME]';
    courtName = courtName.toUpperCase();

    caption += `IN THE ${courtName}\n\n`;

    const caseNumber = affidavitData.caseNumber || '[CASE NUMBER]';
    caption += `DOCKET NO. ${caseNumber.toUpperCase()}\n\n`;

    const plaintiff = affidavitData.plaintiff || '[PLAINTIFF NAME]';
    const defendant = affidavitData.defendant || '[DEFENDANT NAME]';

    caption += `${plaintiff.toUpperCase()},\n`;
    caption += `    Petitioner,\n\n`;
    caption += `VERSUS\n\n`;
    caption += `${defendant.toUpperCase()},\n`;
    caption += `    Respondent.`;

    return {
      courtName,
      caseNumber: affidavitData.caseNumber,
      plaintiff: affidavitData.plaintiff,
      defendant: affidavitData.defendant,
      formatted: caption
    };
  }

  /**
   * Louisiana header — "STATE OF LOUISIANA"
   *
   * @returns {string} Header text
   */
  generateHeader() {
    return 'STATE OF LOUISIANA';
  }

  /**
   * Louisiana venue — "Parish of [Parish]" (title case per Louisiana practice)
   * Louisiana uses PARISHES, not counties.
   *
   * @param {string} county - Parish name (parameter named county for interface compatibility)
   * @returns {string} Venue text
   */
  generateVenue(county) {
    // Accept either parish or county parameter for compatibility
    const parishName = county || '[PARISH]';
    const parishFormatted = parishName.charAt(0).toUpperCase() + parishName.slice(1).toLowerCase();
    return `Parish of ${parishFormatted}`;
  }

  /**
   * Louisiana-specific validation
   * Accepts either "parish" or "county" field for compatibility
   *
   * @param {Object} affidavitData - The affidavit data to validate
   * @returns {Object} Validation result with errors and warnings
   */
  performStateSpecificValidation(affidavitData) {
    const errors = [];
    const warnings = [];

    // Accept either parish or county field
    const parish = affidavitData.parish || affidavitData.county;
    if (!parish || parish.trim().length === 0) {
      errors.push('Parish is required for Louisiana affidavits (Louisiana uses parishes, not counties)');
    }

    warnings.push('Louisiana is a civil law jurisdiction. Notarial acts carry special evidentiary weight as authentic acts under La. C.C. Art. 1833.');

    return { errors, warnings };
  }

  /**
   * Louisiana notary block per La. R.S. 35:1 et seq. (Louisiana Notarial Act)
   * Louisiana notaries are quasi-judicial officers with unique powers under civil law.
   * Supports both oath and affirmation; notary must include parish and Notary ID.
   *
   * @param {Object} affidavitData - The affidavit data
   * @returns {string} Notary block text
   */
  generateNotaryBlock(affidavitData) {
    return `Subscribed and sworn to (or affirmed) before me this _____ day of _______________, 20___.


_________________________________
Notary Public, State of Louisiana

My commission expires: ___________
Parish of: _______________________
Bar Roll / Notary ID: ____________

[NOTARY SEAL]`;
  }

  /**
   * Louisiana perjury statement
   * Notary oath authority: La. R.S. 35:1 et seq.; false swearing penalty: La. R.S. 14:123
   *
   * @returns {string} Perjury statement text
   */
  generatePerjuryStatement() {
    return `I declare under penalty of perjury under the laws of the State of Louisiana that the foregoing is true and correct.`;
  }

  /**
   * Louisiana exhibit rules — letters, cover page required
   *
   * @returns {Object} Exhibit formatting rules
   */
  getExhibitRules() {
    return {
      labelStyle: 'letters',
      requireCoverPage: true,
      coverPageFormat: {
        title: 'EXHIBIT [LABEL]',
        centered: true,
        description: true
      },
      allowedFormats: ['PDF', 'JPG', 'PNG'],
      maxFileSize: 25 * 1024 * 1024,
      maxTotalSize: 100 * 1024 * 1024,
      instructions: 'Label exhibits sequentially (Exhibit A, Exhibit B, etc.) and reference each in the body of the affidavit. Attach exhibits at the end of the document.'
    };
  }
}

module.exports = LouisianaAffidavitTemplate;
