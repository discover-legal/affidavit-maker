// templates/states/federal_capital_territory/AffidavitTemplate.js
// FCT (Abuja) affidavit template — legally compliant with Nigerian Oaths Act
// Governing Law: Oaths Act, Cap O1 LFN 2004; Evidence Act 2011

'use strict';

const BaseAffidavitTemplate = require('../../core/BaseAffidavitTemplate');

/**
 * Federal Capital Territory (Abuja) Affidavit Template
 *
 * @class FCTAffidavitTemplate
 * @extends BaseAffidavitTemplate
 */
class FCTAffidavitTemplate extends BaseAffidavitTemplate {
  constructor() {
    super();

    this.metadata = require('./metadata.json');
    this.state = this.metadata.stateCode;
    this.stateName = this.metadata.stateName;
    this.countryCode = 'NG';

    // Nigerian terminology (see templates/core/terminology.js): the caption is the
    // court-name line + suit number; parties are Petitioner/Respondent under the
    // Matrimonial Causes Act 1970; High Courts sit in judicial divisions, not
    // counties. No "STATE OF"/"COUNTY OF" caption lines, no "X County" body phrasing.
    this.terminology = {
      ...this.terminology,
      jurisdictionLabel: null,
      districtLabel: null,
      districtStyle: 'plain',
      jurisdictionTerm: 'Territory',
      districtTerm: 'Judicial division',
      districtPlaceholder: '[JUDICIAL DIVISION]',
      filerLabel: 'Petitioner',
      responderLabel: 'Respondent',
      selfRepresentedLabel: 'Self-Represented',
    };
    this.requiredFields = this.metadata.requiredFields;

    this.sections.perjuryStatement = false;
  }

  generateHeader() {
    return 'IN THE HIGH COURT OF THE FEDERAL CAPITAL TERRITORY';
  }

  generateVenue(county) {
    const location = (county || 'ABUJA').toUpperCase();
    return `${location} JUDICIAL DIVISION`;
  }

  generateCaseCaption(affidavitData) {
    const court = affidavitData.court || affidavitData.courtName || 'HIGH COURT OF THE FEDERAL CAPITAL TERRITORY';
    const location = (affidavitData.county || affidavitData.city || 'ABUJA').toUpperCase();
    const suitNo = affidavitData.caseNumber || '[SUIT NUMBER]';
    const petitioner = affidavitData.plaintiff || affidavitData.petitionerName || '[PETITIONER NAME]';
    const respondent = affidavitData.defendant || affidavitData.respondentName || '[RESPONDENT NAME]';

    const formatted =
      `IN THE ${court.toUpperCase()}\n` +
      `${location} JUDICIAL DIVISION\n\n` +
      `Suit No. ${suitNo}\n\n` +
      `${petitioner.toUpperCase()}\n` +
      `Petitioner\n\n` +
      `— AND —\n\n` +
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

  performStateSpecificValidation(affidavitData) {
    const errors = [];
    const warnings = [];

    if (!affidavitData.county && !affidavitData.city) {
      errors.push('Judicial division is required for FCT affidavits.');
    }

    return { errors, warnings };
  }

  generateNotaryBlock(affidavitData) {
    const location = affidavitData.county || affidavitData.city || 'Abuja';
    return (
      `Sworn to at the ${location} Registry\n` +
      `this _____ day of _________________, _______\n\n` +
      `Before me:\n` +
      `________________________________\n` +
      `Commissioner for Oaths`
    );
  }
}

module.exports = FCTAffidavitTemplate;
