// templates/states/ontario/AffidavitTemplate.js
// Ontario affidavit template — legally compliant with Ontario Evidence Act
// Governing Law: Evidence Act, RSO 1990, c. E.23; Family Law Rules, O. Reg. 114/99

'use strict';

const BaseAffidavitTemplate = require('../../core/BaseAffidavitTemplate');

/**
 * Ontario Affidavit Template
 *
 * Key compliance notes:
 * - Sworn before a Commissioner for Taking Oaths (or Notary Public) in Ontario
 * - Uses "Province of Ontario" not "State of"
 * - County field maps to city/regional municipality of filing
 * - Court File No. instead of Case No.
 * - No perjury statement required (oath provides the solemn affirmation)
 * - Family proceedings use "Applicant" / "Respondent" (Family Law Rules)
 *
 * @class OntarioAffidavitTemplate
 * @extends BaseAffidavitTemplate
 */
class OntarioAffidavitTemplate extends BaseAffidavitTemplate {
  constructor() {
    super();

    this.metadata = require('./metadata.json');
    this.state = this.metadata.stateCode;       // "ON"
    this.stateName = this.metadata.stateName;   // "Ontario"
    this.countryCode = 'CA';
    this.requiredFields = this.metadata.requiredFields;

    this.sections.perjuryStatement = false;
  }

  /**
   * Ontario case caption.
   * Superior Court of Justice uses "Court File No." and the courthouse location.
   */
  generateCaseCaption(affidavitData) {
    const court = affidavitData.court || affidavitData.courtName || 'SUPERIOR COURT OF JUSTICE';
    const location = (affidavitData.county || affidavitData.city || '[LOCATION]').toUpperCase();
    const fileNo = affidavitData.caseNumber || '[FILE NUMBER]';
    const applicant = affidavitData.plaintiff || affidavitData.petitionerName || '[APPLICANT NAME]';
    const respondent = affidavitData.defendant || affidavitData.respondentName || '[RESPONDENT NAME]';

    const formatted =
      `${court.toUpperCase()}\n` +
      `${location}\n\n` +
      `Court File No. ${fileNo}\n\n` +
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
   * Ontario-specific validation:
   * - city/municipality is required (maps to county field)
   */
  performStateSpecificValidation(affidavitData) {
    const errors = [];
    const warnings = [];

    if (!affidavitData.county && !affidavitData.city) {
      errors.push('City or municipality is required for Ontario affidavits.');
    }

    return { errors, warnings };
  }

  /**
   * Ontario jurat block — sworn before a Commissioner for Taking Oaths.
   */
  generateNotaryBlock(affidavitData) {
    const city = affidavitData.county || affidavitData.city || '_______________';
    return (
      `SWORN before me at the City/Town of ${city},\n` +
      `in the Province of Ontario,\n` +
      `this _____ day of _________________, _______.\n\n` +
      `________________________________\n` +
      `A Commissioner for Taking Oaths\n` +
      `in and for the Province of Ontario`
    );
  }
}

module.exports = OntarioAffidavitTemplate;
