// templates/states/alberta/AffidavitTemplate.js
// Alberta affidavit template — legally compliant with Alberta Oaths Act
// Governing Law: Oaths Act, RSA 2000, c. O-1; Alberta Rules of Court, Alta Reg 124/2010

'use strict';

const BaseAffidavitTemplate = require('../../core/BaseAffidavitTemplate');

/**
 * Alberta Affidavit Template
 *
 * Key compliance notes:
 * - Sworn before a Commissioner for Oaths in Alberta
 * - Uses "Province of Alberta" not "State of"
 * - Court of King's Bench uses judicial district (Calgary, Edmonton, Red Deer, etc.)
 * - Court File No. for general filings; divorce actions use "Action No."
 * - Divorce proceedings use "Plaintiff" / "Defendant" (Statement of Claim for Divorce)
 * - Family Law Act proceedings (guardianship, parenting) use "Applicant" / "Respondent"
 * - Body opens: "I, [name], of [city], in the Province of Alberta, [occupation], make oath and say:"
 *
 * @class AlbertaAffidavitTemplate
 * @extends BaseAffidavitTemplate
 */
class AlbertaAffidavitTemplate extends BaseAffidavitTemplate {
  constructor() {
    super();

    this.metadata = require('./metadata.json');
    this.state = this.metadata.stateCode;       // "AB"
    this.stateName = this.metadata.stateName;   // "Alberta"
    this.countryCode = 'CA';
    this.requiredFields = this.metadata.requiredFields;

    this.sections.perjuryStatement = false;
  }

  /**
   * Alberta header uses province designation.
   */
  generateHeader() {
    return 'PROVINCE OF ALBERTA';
  }

  /**
   * Alberta venue — judicial district of filing.
   */
  generateVenue(county) {
    const district = (county || '[JUDICIAL DISTRICT]').toUpperCase();
    return `JUDICIAL DISTRICT OF ${district}`;
  }

  /**
   * Alberta case caption.
   * Court of King's Bench uses judicial district and "Court File No."
   */
  generateCaseCaption(affidavitData) {
    const district = (affidavitData.county || affidavitData.city || '[JUDICIAL DISTRICT]').toUpperCase();
    const fileNo = affidavitData.caseNumber || '[FILE NUMBER]';
    // Alberta divorce: Statement of Claim for Divorce uses Plaintiff / Defendant (Alberta Rules of Court, AR 124/2010)
    // Family Law Act proceedings use Applicant / Respondent
    const plaintiff = affidavitData.plaintiff || affidavitData.petitionerName || '[PLAINTIFF NAME]';
    const defendant = affidavitData.defendant || affidavitData.respondentName || '[DEFENDANT NAME]';

    const formatted =
      `COURT OF KING'S BENCH OF ALBERTA\n` +
      `JUDICIAL DISTRICT OF ${district}\n\n` +
      `Action No. ${fileNo}\n\n` +
      `BETWEEN:\n\n` +
      `${plaintiff.toUpperCase()}\n` +
      `Plaintiff\n\n` +
      `— and —\n\n` +
      `${defendant.toUpperCase()}\n` +
      `Defendant`;

    return {
      courtName: `Court of King's Bench of Alberta — Judicial District of ${district}`,
      caseNumber: affidavitData.caseNumber,
      plaintiff: plaintiff,
      defendant: defendant,
      formatted
    };
  }

  performStateSpecificValidation(affidavitData) {
    const errors = [];
    const warnings = [];

    if (!affidavitData.county && !affidavitData.city) {
      errors.push('Judicial district (city) is required for Alberta Court of King\'s Bench filings.');
    }

    return { errors, warnings };
  }

  /**
   * Alberta jurat — sworn before a Commissioner for Oaths.
   */
  generateNotaryBlock(affidavitData) {
    const city = affidavitData.county || affidavitData.city || '_______________';
    return (
      `SWORN before me at the City/Town of ${city},\n` +
      `in the Province of Alberta,\n` +
      `this _____ day of _________________, _______.\n\n` +
      `________________________________\n` +
      `A Commissioner for Oaths\n` +
      `in and for the Province of Alberta`
    );
  }
}

module.exports = AlbertaAffidavitTemplate;
