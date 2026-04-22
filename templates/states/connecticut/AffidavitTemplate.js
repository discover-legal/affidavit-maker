// templates/states/connecticut/AffidavitTemplate.js
// Connecticut Affidavit Template — LEGALLY COMPLIANT v1.0
// Governing Law: Conn. Gen. Stat. §1-24 (oaths and affirmations),
//                Conn. Gen. Stat. §53a-156 (perjury)

const BaseAffidavitTemplate = require('../../core/BaseAffidavitTemplate');

/**
 * Connecticut Affidavit Template — LEGALLY COMPLIANT v1.0
 *
 * COMPLIANCE NOTES:
 * - Perjury statement REQUIRED — oath authority per Conn. Gen. Stat. §1-24;
 *   criminal perjury penalty under Conn. Gen. Stat. §53a-156
 * - County is REQUIRED for Connecticut affidavits
 * - Case number label: "DOCKET NO."
 * - Header: "STATE OF CONNECTICUT"
 * - Venue: "Judicial District of [District]" (Connecticut uses judicial districts)
 * - Notary block per Conn. Gen. Stat. §1-24; notary designated as
 *   "Notary Public / Commissioner of the Superior Court, State of Connecticut"
 * - Connecticut commissioners of the superior court may also administer oaths
 * - Notary may administer oath or affirmation (subscribed and sworn/affirmed)
 * - Exhibits labeled with letters (A, B, C)
 *
 * @class ConnecticutAffidavitTemplate
 * @extends BaseAffidavitTemplate
 */
class ConnecticutAffidavitTemplate extends BaseAffidavitTemplate {
  constructor() {
    super();

    this.metadata = require('./metadata.json');
    this.state = this.metadata.stateCode;
    this.stateName = this.metadata.stateName;
    this.requiredFields = this.metadata.requiredFields;

    // Connecticut requires perjury statement — oath authority per Conn. Gen. Stat. §1-24;
    // criminal perjury penalty per Conn. Gen. Stat. §53a-156
    this.sections.perjuryStatement = true;
  }

  /**
   * Connecticut-specific case caption using "DOCKET NO." terminology
   *
   * @param {Object} affidavitData - The affidavit data
   * @returns {Object} Case caption with formatted text
   */
  generateCaseCaption(affidavitData) {
    let caption = '';

    let courtName = affidavitData.court || affidavitData.courtName || '[COURT NAME]';
    courtName = courtName.toUpperCase();

    caption += `${courtName}\n\n`;

    const caseNumber = affidavitData.caseNumber || '[DOCKET NUMBER]';
    caption += `DOCKET NO. ${caseNumber.toUpperCase()}\n\n`;

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
   * Connecticut header — "STATE OF CONNECTICUT"
   *
   * @returns {string} Header text
   */
  generateHeader() {
    return 'STATE OF CONNECTICUT';
  }

  /**
   * Connecticut venue — "Judicial District of [District]"
   * Connecticut uses judicial districts rather than counties for court venue
   *
   * @param {string} county - County or judicial district name
   * @returns {string} Venue text
   */
  generateVenue(county) {
    const districtName = county || '[JUDICIAL DISTRICT]';
    const districtFormatted = districtName.charAt(0).toUpperCase() + districtName.slice(1).toLowerCase();
    return `Judicial District of ${districtFormatted}`;
  }

  /**
   * Connecticut-specific validation
   *
   * @param {Object} affidavitData - The affidavit data to validate
   * @returns {Object} Validation result with errors and warnings
   */
  performStateSpecificValidation(affidavitData) {
    const errors = [];
    const warnings = [];

    // County / judicial district is REQUIRED for Connecticut affidavits
    if (!affidavitData.county || affidavitData.county.trim().length === 0) {
      errors.push('Judicial district (county) is required for Connecticut affidavits');
    }

    return { errors, warnings };
  }

  /**
   * Connecticut notary block per Conn. Gen. Stat. §1-24
   * Supports both oath and affirmation; Connecticut also recognizes
   * commissioners of the superior court as authorized to administer oaths
   *
   * @param {Object} affidavitData - The affidavit data
   * @returns {string} Notary block text
   */
  generateNotaryBlock(affidavitData) {
    return `Subscribed and sworn to (or affirmed) before me this _____ day of _______________, 20___.


_________________________________
Notary Public / Commissioner of the Superior Court
State of Connecticut

My commission expires: ___________

[NOTARY SEAL]`;
  }

  /**
   * Connecticut perjury statement
   * Oath authority: Conn. Gen. Stat. §1-24; perjury penalty: Conn. Gen. Stat. §53a-156
   *
   * @returns {string} Perjury statement text
   */
  generatePerjuryStatement() {
    return `I declare under penalty of perjury under the laws of the State of Connecticut that the foregoing is true and correct.`;
  }

  /**
   * Connecticut exhibit rules — letters, cover page required
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

module.exports = ConnecticutAffidavitTemplate;
