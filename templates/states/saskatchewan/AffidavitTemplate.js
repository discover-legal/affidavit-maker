// templates/states/saskatchewan/AffidavitTemplate.js
// Saskatchewan affidavit template — legally compliant with The Evidence Act, 2006
// Governing Law: The Evidence Act, 2006, SS 2006, c. E-11.2;
//                The Commissioners for Oaths Act, 2012, SS 2012, c. C-16.001

'use strict';

const BaseAffidavitTemplate = require('../../core/BaseAffidavitTemplate');

/**
 * Saskatchewan Affidavit Template
 *
 * Key compliance notes:
 * - Sworn before a Commissioner for Oaths in Saskatchewan
 * - Uses "Province of Saskatchewan" not "State of"
 * - Court of King's Bench for Saskatchewan (note: "for Saskatchewan" not "of Saskatchewan";
 *   rebranded from Court of Queen's Bench in September 2022)
 * - Court File No. instead of Case No.
 * - No perjury statement required (oath provides the solemn affirmation)
 * - Divorce proceedings use "Petitioner" / "Respondent" (Saskatchewan practice)
 *
 * @class SaskatchewanAffidavitTemplate
 * @extends BaseAffidavitTemplate
 */
class SaskatchewanAffidavitTemplate extends BaseAffidavitTemplate {
  constructor() {
    super();

    this.metadata = require('./metadata.json');
    this.state = this.metadata.stateCode;       // "SK"
    this.stateName = this.metadata.stateName;   // "Saskatchewan"
    this.countryCode = 'CA';
    this.requiredFields = this.metadata.requiredFields;

    this.sections.perjuryStatement = false;
  }

  /**
   * Saskatchewan header uses province designation.
   */
  generateHeader() {
    return 'PROVINCE OF SASKATCHEWAN';
  }

  /**
   * Saskatchewan venue — judicial centre of filing.
   */
  generateVenue(county) {
    const location = (county || '[JUDICIAL CENTRE]').toUpperCase();
    return `AT ${location}`;
  }

  /**
   * Saskatchewan case caption.
   * Court of King's Bench for Saskatchewan uses judicial centres
   * (Regina, Saskatoon, Prince Albert, etc.) and "Court File No."
   */
  generateCaseCaption(affidavitData) {
    const centre = (affidavitData.county || affidavitData.city || '[JUDICIAL CENTRE]').toUpperCase();
    const fileNo = affidavitData.caseNumber || '[FILE NUMBER]';
    const petitioner = affidavitData.plaintiff || affidavitData.petitionerName || '[PETITIONER NAME]';
    const respondent = affidavitData.defendant || affidavitData.respondentName || '[RESPONDENT NAME]';

    const formatted =
      `COURT OF KING'S BENCH FOR SASKATCHEWAN\n` +
      `JUDICIAL CENTRE OF ${centre}\n\n` +
      `Court File No. ${fileNo}\n\n` +
      `${petitioner.toUpperCase()}\n` +
      `Petitioner\n\n` +
      `— and —\n\n` +
      `${respondent.toUpperCase()}\n` +
      `Respondent`;

    return {
      courtName: `Court of King's Bench for Saskatchewan — Judicial Centre of ${centre}`,
      caseNumber: affidavitData.caseNumber,
      plaintiff: petitioner,
      defendant: respondent,
      formatted
    };
  }

  /**
   * Saskatchewan-specific validation:
   * - judicial centre (city) is required
   */
  performStateSpecificValidation(affidavitData) {
    const errors = [];
    const warnings = [];

    if (!affidavitData.county && !affidavitData.city) {
      errors.push('Judicial centre (city) is required for Saskatchewan Court of King\'s Bench filings.');
    }

    return { errors, warnings };
  }

  /**
   * Saskatchewan jurat block — sworn before a Commissioner for Oaths.
   * Authority: The Commissioners for Oaths Act, 2012, SS 2012, c. C-16.001;
   *            The Evidence Act, 2006, SS 2006, c. E-11.2
   */
  generateNotaryBlock(affidavitData) {
    const city = affidavitData.county || affidavitData.city || '_______________';
    return (
      `SWORN before me at the City/Town of ${city},\n` +
      `in the Province of Saskatchewan,\n` +
      `this _____ day of _________________, _______.\n\n` +
      `________________________________\n` +
      `A Commissioner for Oaths\n` +
      `in and for the Province of Saskatchewan`
    );
  }
}

module.exports = SaskatchewanAffidavitTemplate;
