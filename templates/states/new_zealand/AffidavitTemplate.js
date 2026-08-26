// templates/states/new_zealand/AffidavitTemplate.js
// New Zealand affidavit template — legally compliant with Oaths and Declarations Act 1957
// Governing Law: Oaths and Declarations Act 1957; Family Proceedings Act 1980

'use strict';

const BaseAffidavitTemplate = require('../../core/BaseAffidavitTemplate');

/**
 * New Zealand Affidavit Template
 *
 * Key compliance notes:
 * - Sworn before a Solicitor, Justice of the Peace, or Registrar (Oaths and Declarations Act 1957)
 * - Uses A4 paper size
 * - Currency is NZD
 * - No perjury statement required (oath/affirmation provides the solemn undertaking)
 * - Family proceedings use "Applicant" / "Respondent"
 * - Formal terminology is "dissolution of marriage" not "divorce"
 *
 * @class NewZealandAffidavitTemplate
 * @extends BaseAffidavitTemplate
 */
class NewZealandAffidavitTemplate extends BaseAffidavitTemplate {
  constructor() {
    super();

    this.metadata = require('./metadata.json');
    this.state = this.metadata.stateCode;       // "NZ"
    this.stateName = this.metadata.stateName;   // "New Zealand"
    this.countryCode = 'NZ';

    // New Zealand terminology (see templates/core/terminology.js): the caption is
    // the court-name line (Family Court at X); parties are Applicant/Respondent
    // (Family Proceedings Act 1980). No "STATE OF"/"COUNTY OF" caption lines and
    // no "X County" body phrasing.
    this.terminology = {
      ...this.terminology,
      jurisdictionLabel: null,
      districtLabel: null,
      districtStyle: 'plain',
      jurisdictionTerm: 'Jurisdiction',
      districtTerm: 'Court district',
      districtPlaceholder: '[COURT DISTRICT]',
      filerLabel: 'Applicant',
      responderLabel: 'Respondent',
      selfRepresentedLabel: 'Self-Represented',
    };
    this.requiredFields = this.metadata.requiredFields;

    this.sections.perjuryStatement = false;

    this.formatting = {
      fontSize: '12pt',
      fontFamily: 'Times New Roman',
      lineHeight: '1.5',
      margin: '2.54cm',
      paperSize: 'A4'
    };
  }

  /**
   * New Zealand header — no state/province designation.
   */
  generateHeader() {
    return 'IN THE FAMILY COURT OF NEW ZEALAND';
  }

  /**
   * New Zealand venue — city or district of filing.
   */
  generateVenue(county) {
    const location = (county || '[CITY/DISTRICT]').toUpperCase();
    return `AT ${location}`;
  }

  /**
   * New Zealand case caption.
   * Family Court uses "FAM No." for case references.
   */
  generateCaseCaption(affidavitData) {
    const court = affidavitData.court || affidavitData.courtName || 'FAMILY COURT OF NEW ZEALAND';
    const location = (affidavitData.county || affidavitData.city || '[LOCATION]').toUpperCase();
    const fileNo = affidavitData.caseNumber || '[FAM NUMBER]';
    const applicant = affidavitData.plaintiff || affidavitData.petitionerName || '[APPLICANT NAME]';
    const respondent = affidavitData.defendant || affidavitData.respondentName || '[RESPONDENT NAME]';

    const formatted =
      `${court.toUpperCase()}\n` +
      `${location}\n\n` +
      `FAM No. ${fileNo}\n\n` +
      `${applicant.toUpperCase()}\n` +
      `Applicant\n\n` +
      `and\n\n` +
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
   * New Zealand-specific validation:
   * - city/district is required
   */
  performStateSpecificValidation(affidavitData) {
    const errors = [];
    const warnings = [];

    if (!affidavitData.county && !affidavitData.city) {
      errors.push('City or district is required for New Zealand affidavits.');
    }

    return { errors, warnings };
  }

  /**
   * New Zealand jurat block — sworn/affirmed before a Solicitor, JP, or Registrar.
   * Oaths and Declarations Act 1957.
   */
  generateNotaryBlock(affidavitData) {
    const city = affidavitData.county || affidavitData.city || '_______________';
    return (
      `Sworn/Affirmed at ${city}\n` +
      `this _____ day of _________________, _______.\n\n` +
      `Before me:\n\n` +
      `________________________________\n` +
      `[Name]\n` +
      `Solicitor / Justice of the Peace / Registrar`
    );
  }
}

module.exports = NewZealandAffidavitTemplate;
