// templates/states/manitoba/AffidavitTemplate.js
// Manitoba affidavit template — legally compliant with The Manitoba Evidence Act
// Governing Law: The Manitoba Evidence Act, CCSM c. E150; Commissioners for Oaths Act, CCSM c. C155

'use strict';

const BaseAffidavitTemplate = require('../../core/BaseAffidavitTemplate');

/**
 * Manitoba Affidavit Template
 *
 * Key compliance notes:
 * - Sworn before a Commissioner for Oaths in Manitoba
 * - Uses "Province of Manitoba" not "State of"
 * - Court of King's Bench of Manitoba (rebranded from Court of Queen's Bench in September 2022
 *   upon accession of King Charles III)
 * - Court File No. instead of Case No.
 * - No perjury statement required (oath provides the solemn affirmation)
 * - Divorce proceedings use "Petitioner" / "Respondent" (Manitoba practice)
 * - Support is termed "maintenance" in Manitoba (Family Law Act, CCSM c. F20)
 *
 * @class ManitobaAffidavitTemplate
 * @extends BaseAffidavitTemplate
 */
class ManitobaAffidavitTemplate extends BaseAffidavitTemplate {
  constructor() {
    super();

    this.metadata = require('./metadata.json');
    this.state = this.metadata.stateCode;       // "MB"
    this.stateName = this.metadata.stateName;   // "Manitoba"
    this.countryCode = 'CA';
    this.requiredFields = this.metadata.requiredFields;

    this.sections.perjuryStatement = false;
  }

  /**
   * Manitoba header uses province designation.
   */
  generateHeader() {
    return 'PROVINCE OF MANITOBA';
  }

  /**
   * Manitoba venue — city or location of filing.
   */
  generateVenue(county) {
    const location = (county || '[CITY/LOCATION]').toUpperCase();
    return `AT ${location}`;
  }

  /**
   * Manitoba case caption.
   * Court of King's Bench uses "Court File No." and the courthouse city.
   */
  generateCaseCaption(affidavitData) {
    const court = affidavitData.court || affidavitData.courtName || 'COURT OF KING\'S BENCH OF MANITOBA';
    const location = (affidavitData.county || affidavitData.city || '[LOCATION]').toUpperCase();
    const fileNo = affidavitData.caseNumber || '[FILE NUMBER]';
    const petitioner = affidavitData.plaintiff || affidavitData.petitionerName || '[PETITIONER NAME]';
    const respondent = affidavitData.defendant || affidavitData.respondentName || '[RESPONDENT NAME]';

    const formatted =
      `${court.toUpperCase()}\n` +
      `AT ${location}\n\n` +
      `Court File No. ${fileNo}\n\n` +
      `${petitioner.toUpperCase()}\n` +
      `Petitioner\n\n` +
      `— and —\n\n` +
      `${respondent.toUpperCase()}\n` +
      `Respondent`;

    return {
      courtName: court,
      caseNumber: affidavitData.caseNumber,
      plaintiff: petitioner,
      defendant: respondent,
      formatted
    };
  }

  /**
   * Manitoba-specific validation:
   * - city or location is required (maps to county field)
   */
  performStateSpecificValidation(affidavitData) {
    const errors = [];
    const warnings = [];

    if (!affidavitData.county && !affidavitData.city) {
      errors.push('City or location is required for Manitoba affidavits.');
    }

    return { errors, warnings };
  }

  /**
   * Manitoba jurat block — sworn before a Commissioner for Oaths.
   * Authority: Commissioners for Oaths Act, CCSM c. C155;
   *            The Manitoba Evidence Act, CCSM c. E150
   */
  generateNotaryBlock(affidavitData) {
    const city = affidavitData.county || affidavitData.city || '_______________';
    return (
      `SWORN before me at the City/Town of ${city},\n` +
      `in the Province of Manitoba,\n` +
      `this _____ day of _________________, _______.\n\n` +
      `________________________________\n` +
      `A Commissioner for Oaths\n` +
      `in and for the Province of Manitoba`
    );
  }
}

module.exports = ManitobaAffidavitTemplate;
