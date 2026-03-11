// templates/states/northwest_territories/AffidavitTemplate.js
// Northwest Territories affidavit template — legally compliant with NWT Evidence Act
// Governing Law: NWT Evidence Act, RSNWT 1988, c. E-8; Canada Evidence Act, RSC 1985, c. C-5

'use strict';

const BaseAffidavitTemplate = require('../../core/BaseAffidavitTemplate');

/**
 * Northwest Territories Affidavit Template
 *
 * Key compliance notes:
 * - Sworn before a Notary Public or Commissioner for Oaths in the Northwest Territories
 * - Uses "NORTHWEST TERRITORIES" header (not "Province of" — NWT is a territory)
 * - NWT does not have counties — venue is territory-wide
 * - Supreme Court of the Northwest Territories (seated in Yellowknife)
 * - FILE NO. instead of Case No.
 * - No perjury statement required (oath provides the solemn affirmation)
 * - Perjury is an offence under Criminal Code, RSC 1985, c. C-46, s.131
 * - Divorce proceedings use "Applicant" / "Respondent"
 *
 * @class NorthwestTerritoriesAffidavitTemplate
 * @extends BaseAffidavitTemplate
 */
class NorthwestTerritoriesAffidavitTemplate extends BaseAffidavitTemplate {
  constructor() {
    super();

    this.metadata = require('./metadata.json');
    this.state = this.metadata.stateCode;       // "NT"
    this.stateName = this.metadata.stateName;   // "Northwest Territories"
    this.countryCode = 'CA';
    this.requiredFields = this.metadata.requiredFields;

    this.sections.perjuryStatement = false;
  }

  /**
   * NWT header — territory designation.
   */
  generateHeader() {
    return 'NORTHWEST TERRITORIES';
  }

  /**
   * NWT venue — no counties. The Supreme Court sits in Yellowknife.
   * The county field may contain a community name but is not required.
   */
  generateVenue(county) {
    if (county) {
      return `AT ${county.toUpperCase()}`;
    }
    return 'AT YELLOWKNIFE';
  }

  /**
   * NWT case caption.
   * Supreme Court of the Northwest Territories uses "FILE NO." and
   * the Applicant/Respondent party labels.
   */
  generateCaseCaption(affidavitData) {
    const court = affidavitData.court || affidavitData.courtName || 'SUPREME COURT OF THE NORTHWEST TERRITORIES';
    const fileNo = affidavitData.caseNumber || '[FILE NUMBER]';
    const applicant = affidavitData.plaintiff || affidavitData.petitionerName || '[APPLICANT NAME]';
    const respondent = affidavitData.defendant || affidavitData.respondentName || '[RESPONDENT NAME]';

    const formatted =
      `${court.toUpperCase()}\n\n` +
      `FILE NO. ${fileNo}\n\n` +
      `${applicant.toUpperCase()}\n` +
      `Applicant\n\n` +
      `— and —\n\n` +
      `${respondent.toUpperCase()}\n` +
      `Respondent`;

    return {
      courtName: court,
      caseNumber: affidavitData.caseNumber,
      plaintiff: applicant,
      defendant: respondent,
      formatted
    };
  }

  /**
   * NWT-specific validation:
   * - No county requirement (NWT has no counties)
   */
  performStateSpecificValidation(affidavitData) {
    const errors = [];
    const warnings = [];

    // NWT has no counties — no county validation needed
    // Optionally warn if no community is provided
    if (!affidavitData.county && !affidavitData.city) {
      warnings.push('No community specified. Defaulting to Yellowknife for the Supreme Court of the Northwest Territories.');
    }

    return { errors, warnings };
  }

  /**
   * NWT jurat block — sworn before a Notary Public or Commissioner for Oaths.
   * Authority: NWT Evidence Act, RSNWT 1988, c. E-8
   */
  generateNotaryBlock(affidavitData) {
    const community = affidavitData.county || affidavitData.city || '_______________';
    return (
      `SWORN before me at ${community},\n` +
      `in the Northwest Territories,\n` +
      `this _____ day of _________________, _______.\n\n` +
      `________________________________\n` +
      `A Notary Public / Commissioner for Oaths\n` +
      `in and for the Northwest Territories`
    );
  }
}

module.exports = NorthwestTerritoriesAffidavitTemplate;
