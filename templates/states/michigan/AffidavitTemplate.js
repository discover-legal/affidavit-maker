// templates/states/michigan/AffidavitTemplate.js
// Michigan Affidavit Template
// Governing Law: MCL § 600.2102 (affidavits), MCL § 55.285 (notary public — oath authority),
//                MCL § 750.422 (perjury — judicial proceedings)

const BaseAffidavitTemplate = require('../../core/BaseAffidavitTemplate');

/**
 * Michigan Affidavit Template - Legally Compliant v1.0
 *
 * COMPLIANCE NOTES:
 * - Michigan uses "STATE OF MICHIGAN" as header
 * - Perjury statement: NOT REQUIRED in the affidavit text.
 *   Michigan perjury (MCL § 750.422) requires a false statement in a judicial proceeding.
 *   For Michigan affidavits, the notary oath administered to the affiant provides the
 *   sworn affirmation. No additional perjury recitation in the body is required or standard.
 * - County is a REQUIRED field
 * - Case number label is "CASE NO."
 * - Notary block must conform to MCL § 55.285 (Michigan Notary Public Act — oath authority)
 * - Notary block includes county of commission, "State of Michigan," and commission expiration
 * - Notary must note "Acting in [County] County" if acting outside county of commission
 * - Exhibits labeled with letters; cover page required
 *
 * @class MichiganAffidavitTemplate
 * @extends BaseAffidavitTemplate
 */
class MichiganAffidavitTemplate extends BaseAffidavitTemplate {
  constructor() {
    super();

    // Load metadata
    this.metadata = require('./metadata.json');
    this.state = this.metadata.stateCode;
    this.stateName = this.metadata.stateName;
    this.requiredFields = this.metadata.requiredFields;

    // Michigan does NOT require a separate perjury statement in the affidavit text
    // The notary oath is sufficient under MCL § 600.2102
    this.sections.perjuryStatement = false;
  }

  /**
   * Michigan header — "STATE OF MICHIGAN"
   *
   * @returns {string} Header text
   */
  generateHeader() {
    return 'STATE OF MICHIGAN';
  }

  /**
   * Michigan venue format — "County of [County]" per Michigan court practice
   *
   * @param {string} county - County name
   * @returns {string} Formatted venue
   */
  generateVenue(county) {
    const countyName = county || '[COUNTY]';
    const countyFormatted = countyName.charAt(0).toUpperCase() + countyName.slice(1);
    return `County of ${countyFormatted}`;
  }

  /**
   * Michigan case caption uses "CASE NO." as the case number label
   *
   * @param {Object} affidavitData - The affidavit data
   * @returns {Object} Case caption with formatted text
   */
  generateCaseCaption(affidavitData) {
    let caption = '';

    // Court name — Michigan Circuit Court
    let courtName = affidavitData.court || affidavitData.courtName || '[COURT NAME]';
    courtName = courtName.toUpperCase();

    caption += `IN THE ${courtName}\n\n`;

    // Case number — Michigan uses "CASE NO."
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
   * Michigan-specific validation
   *
   * @param {Object} affidavitData - The affidavit data to validate
   * @returns {Object} Validation result with errors and warnings
   */
  performStateSpecificValidation(affidavitData) {
    const errors = [];
    const warnings = [];

    // County is REQUIRED for Michigan
    if (!affidavitData.county || affidavitData.county.trim().length === 0) {
      errors.push('County is required for Michigan affidavits');
    }

    return { errors, warnings };
  }

  /**
   * Michigan notary block
   * Compliant with MCL § 55.285 (Michigan Notary Public Act — oath authority)
   * Notary block includes county of commission, State of Michigan, and expiration date
   * "Acting in [County] County" notation required if notarizing outside county of commission
   *
   * @param {Object} affidavitData - The affidavit data
   * @returns {string} Notary block text
   */
  generateNotaryBlock(affidavitData) {
    const county = affidavitData.county || '_______________';
    return `STATE OF MICHIGAN
${county} County

Subscribed and sworn to before me this ___ day of _______________, 20___.


_________________________________
[Notary Name], Notary Public
_______________ County, State of Michigan

My commission expires: ___________

Acting in ${county} County`;
  }

  /**
   * Michigan perjury statement — NOT USED
   * Michigan does not require a perjury recitation in the affidavit text.
   * The sworn notary oath per MCL § 600.2102 is sufficient.
   * This method returns an empty string to comply with the base class interface.
   *
   * @returns {string} Empty string (no perjury statement required)
   */
  generatePerjuryStatement() {
    return '';
  }

  /**
   * Michigan exhibit rules
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
      instructions: 'Exhibits must be labeled with letters (A, B, C, etc.) and identified with a cover page. Reference each exhibit in the body of the affidavit and attach at the end of the document.'
    };
  }
}

module.exports = MichiganAffidavitTemplate;
