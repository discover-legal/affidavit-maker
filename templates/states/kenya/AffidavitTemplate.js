// templates/states/kenya/AffidavitTemplate.js
// Kenya affidavit template — legally compliant with Oaths and Statutory Declarations Act (Cap 15)
// Governing Law: Oaths and Statutory Declarations Act (Cap 15); Evidence Act (Cap 80)

'use strict';

const BaseAffidavitTemplate = require('../../core/BaseAffidavitTemplate');

/**
 * Kenya Affidavit Template
 *
 * Key compliance notes:
 * - Sworn before a Commissioner for Oaths or Magistrate under Cap 15
 * - Uses "Republic of Kenya" header
 * - County field maps to the county of filing (Kenya has 47 counties)
 * - Case No. label (not "Cause No." or "Court File No.")
 * - No perjury statement required (the oath provides the solemn affirmation)
 * - A4 paper size, KES currency
 * - personalLawSystem: true — Islamic matters may go to Kadhi's Court
 *
 * @class KenyaAffidavitTemplate
 * @extends BaseAffidavitTemplate
 */
class KenyaAffidavitTemplate extends BaseAffidavitTemplate {
  constructor() {
    super();

    this.metadata = require('./metadata.json');
    this.state = this.metadata.stateCode;       // "KE"
    this.stateName = this.metadata.stateName;   // "Kenya"
    this.countryCode = 'KE';

    // Kenyan terminology (see templates/core/terminology.js): the caption is the
    // court-name line; parties are Petitioner/Respondent (Marriage Act, 2014);
    // venue is the court station. No "STATE OF"/"COUNTY OF" caption lines and no
    // "X County" body phrasing.
    this.terminology = {
      ...this.terminology,
      jurisdictionLabel: null,
      districtLabel: null,
      districtStyle: 'plain',
      jurisdictionTerm: 'Jurisdiction',
      districtTerm: 'Court station',
      districtPlaceholder: '[COURT STATION]',
      filerLabel: 'Petitioner',
      responderLabel: 'Respondent',
      selfRepresentedLabel: 'Self-Represented',
    };
    this.requiredFields = this.metadata.requiredFields;

    this.sections.perjuryStatement = false;
  }

  /**
   * Kenya header uses republic designation.
   */
  generateHeader() {
    return 'REPUBLIC OF KENYA';
  }

  /**
   * Kenya venue — county of filing.
   */
  generateVenue(county) {
    const location = (county || '[COUNTY]').toUpperCase();
    return `AT ${location}`;
  }

  /**
   * Kenya case caption.
   * High Court uses "Case No." and the court station.
   */
  generateCaseCaption(affidavitData) {
    const court = affidavitData.court || affidavitData.courtName || 'HIGH COURT OF KENYA';
    const location = (affidavitData.county || affidavitData.city || '[LOCATION]').toUpperCase();
    const caseNo = affidavitData.caseNumber || '[CASE NUMBER]';
    const petitioner = affidavitData.plaintiff || affidavitData.petitionerName || '[PETITIONER NAME]';
    const respondent = affidavitData.defendant || affidavitData.respondentName || '[RESPONDENT NAME]';

    const formatted =
      `${court.toUpperCase()}\n` +
      `AT ${location}\n\n` +
      `Case No. ${caseNo}\n\n` +
      `${petitioner.toUpperCase()}\n` +
      `Petitioner\n\n` +
      `— versus —\n\n` +
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
   * Kenya-specific validation:
   * - County is required (maps to one of Kenya's 47 counties)
   */
  performStateSpecificValidation(affidavitData) {
    const errors = [];
    const warnings = [];

    if (!affidavitData.county && !affidavitData.city) {
      errors.push('County is required for Kenyan affidavits.');
    }

    return { errors, warnings };
  }

  /**
   * Kenya jurat block — sworn before a Commissioner for Oaths.
   * Oaths and Statutory Declarations Act (Cap 15).
   */
  generateNotaryBlock(affidavitData) {
    const location = affidavitData.county || affidavitData.city || '_______________';
    return (
      `Sworn/Affirmed at ${location},\n` +
      `this _____ day of _________________, _______.\n\n` +
      `________________________________\n` +
      `Deponent\n\n` +
      `Before me:\n\n` +
      `________________________________\n` +
      `Commissioner for Oaths`
    );
  }
}

module.exports = KenyaAffidavitTemplate;
