// templates/states/ireland/AffidavitTemplate.js
// Ireland affidavit template — legally compliant with Irish sworn affidavit requirements
// Governing Law: various — affidavits sworn before Commissioner for Oaths or Practising Solicitor

'use strict';

const BaseAffidavitTemplate = require('../../core/BaseAffidavitTemplate');

/**
 * Ireland Affidavit Template
 *
 * Key compliance notes:
 * - Sworn before a Commissioner for Oaths or Practising Solicitor
 * - Ireland uses sworn affidavits (not Statements of Truth)
 * - A4 paper size, EUR currency
 * - County/City of filing location
 * - Record No. instead of Case No.
 * - No perjury statement required (oath provides solemn affirmation)
 * - Family proceedings use "Applicant" / "Respondent"
 * - Court is the Circuit Family Court (standard) or High Court (complex)
 *
 * @class IrelandAffidavitTemplate
 * @extends BaseAffidavitTemplate
 */
class IrelandAffidavitTemplate extends BaseAffidavitTemplate {
  constructor() {
    super();

    this.metadata = require('./metadata.json');
    this.state = this.metadata.stateCode;       // "IRL"
    this.stateName = this.metadata.stateName;   // "Ireland"
    this.countryCode = 'IE';
    this.requiredFields = this.metadata.requiredFields;

    this.sections.perjuryStatement = false;
  }

  /**
   * Ireland header uses country designation.
   */
  generateHeader() {
    return 'IRELAND';
  }

  /**
   * Ireland venue — county or city of filing.
   */
  generateVenue(county) {
    const location = (county || '[COUNTY/CITY]').toUpperCase();
    return `COUNTY/CITY OF ${location}`;
  }

  /**
   * Ireland case caption.
   * Circuit Family Court uses "Record No." and the county/city location.
   */
  generateCaseCaption(affidavitData) {
    const court = affidavitData.court || affidavitData.courtName || 'CIRCUIT FAMILY COURT';
    const location = (affidavitData.county || affidavitData.city || '[LOCATION]').toUpperCase();
    const recordNo = affidavitData.caseNumber || '[RECORD NUMBER]';
    const applicant = affidavitData.plaintiff || affidavitData.petitionerName || '[APPLICANT NAME]';
    const respondent = affidavitData.defendant || affidavitData.respondentName || '[RESPONDENT NAME]';

    const formatted =
      `${court.toUpperCase()}\n` +
      `${location}\n\n` +
      `Record No. ${recordNo}\n\n` +
      `${applicant.toUpperCase()}\n` +
      `Applicant\n\n` +
      `\u2014 and \u2014\n\n` +
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
   * Ireland-specific validation:
   * - county/city is required for the jurat
   */
  performStateSpecificValidation(affidavitData) {
    const errors = [];
    const warnings = [];

    if (!affidavitData.county && !affidavitData.city) {
      errors.push('County or city is required for Irish affidavits.');
    }

    return { errors, warnings };
  }

  /**
   * Ireland jurat block — sworn before a Commissioner for Oaths or Practising Solicitor.
   */
  generateNotaryBlock(affidavitData) {
    const location = affidavitData.county || affidavitData.city || '_______________';
    return (
      `Sworn before me, a Commissioner for Oaths /\n` +
      `Practising Solicitor,\n` +
      `at ${location} in the County/City of ${location},\n` +
      `this _____ day of _________________, _______.\n\n` +
      `________________________________\n` +
      `A Commissioner for Oaths /\n` +
      `Practising Solicitor`
    );
  }
}

module.exports = IrelandAffidavitTemplate;
