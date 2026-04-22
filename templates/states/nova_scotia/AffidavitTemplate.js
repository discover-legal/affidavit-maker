// templates/states/nova_scotia/AffidavitTemplate.js
// Nova Scotia affidavit template — legally compliant with the Evidence Act, RSNS 1989
// Governing Law: Evidence Act, RSNS 1989, c. 154;
//                Notaries and Commissioners Act, RSNS 1989, c. 312

'use strict';

const BaseAffidavitTemplate = require('../../core/BaseAffidavitTemplate');

/**
 * Nova Scotia Affidavit Template
 *
 * Key compliance notes:
 * - Sworn before a Commissioner for Taking Oaths (or Notary Public) in Nova Scotia
 * - Uses "Province of Nova Scotia" not "State of"
 * - Supreme Court of Nova Scotia (Family Division handles divorce matters)
 * - Court File No. instead of Case No.
 * - No perjury statement required (oath provides the solemn affirmation)
 * - Divorce proceedings use "Petitioner" / "Respondent"
 *
 * @class NovaScotiaAffidavitTemplate
 * @extends BaseAffidavitTemplate
 */
class NovaScotiaAffidavitTemplate extends BaseAffidavitTemplate {
  constructor() {
    super();

    this.metadata = require('./metadata.json');
    this.state = this.metadata.stateCode;       // "NS"
    this.stateName = this.metadata.stateName;   // "Nova Scotia"
    this.countryCode = 'CA';
    this.requiredFields = this.metadata.requiredFields;

    this.sections.perjuryStatement = false;
  }

  /**
   * Nova Scotia header uses province designation.
   */
  generateHeader() {
    return 'PROVINCE OF NOVA SCOTIA';
  }

  /**
   * Nova Scotia venue — court location (city) of filing.
   * Nova Scotia Supreme Court is identified by court location/sitting place
   * (Halifax, Kentville, Truro, Sydney, Bridgewater, Amherst, etc.),
   * not by "County of" — see Nova Scotia Civil Procedure Rules, Rule 4.
   */
  generateVenue(county) {
    const location = (county || '[COURT LOCATION]').toUpperCase();
    return `AT ${location}`;
  }

  /**
   * Nova Scotia case caption.
   * Supreme Court of Nova Scotia uses "Court File No."
   * The Family Division sits in Halifax, Kentville, Truro, Sydney, Bridgewater, Amherst, etc.
   */
  generateCaseCaption(affidavitData) {
    const court = affidavitData.court || affidavitData.courtName || 'SUPREME COURT OF NOVA SCOTIA';
    const location = (affidavitData.county || affidavitData.city || '[LOCATION]').toUpperCase();
    const fileNo = affidavitData.caseNumber || '[FILE NUMBER]';
    const petitioner = affidavitData.plaintiff || affidavitData.petitionerName || '[PETITIONER NAME]';
    const respondent = affidavitData.defendant || affidavitData.respondentName || '[RESPONDENT NAME]';

    const formatted =
      `${court.toUpperCase()}\n` +
      `${location}\n\n` +
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
   * Nova Scotia-specific validation:
   * - location/county is required
   */
  performStateSpecificValidation(affidavitData) {
    const errors = [];
    const warnings = [];

    if (!affidavitData.county && !affidavitData.city) {
      errors.push('Court location (city) is required for Nova Scotia Supreme Court affidavits.');
    }

    return { errors, warnings };
  }

  /**
   * Nova Scotia jurat block — sworn before a Commissioner for Taking Oaths.
   * Authority: Notaries and Commissioners Act, RSNS 1989, c. 312;
   *            Evidence Act, RSNS 1989, c. 154
   */
  generateNotaryBlock(affidavitData) {
    const location = affidavitData.county || affidavitData.city || '_______________';
    return (
      `SWORN before me at ${location},\n` +
      `in the Province of Nova Scotia,\n` +
      `this _____ day of _________________, _______.\n\n` +
      `________________________________\n` +
      `A Commissioner for Taking Oaths\n` +
      `in and for the Province of Nova Scotia`
    );
  }
}

module.exports = NovaScotiaAffidavitTemplate;
