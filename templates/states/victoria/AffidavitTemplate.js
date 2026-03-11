// templates/states/victoria/AffidavitTemplate.js
// Victoria affidavit template — legally compliant with Evidence (Miscellaneous Provisions) Act 1958 (Vic)
// Governing Law: Family Law Act 1975 (Cth); Evidence (Miscellaneous Provisions) Act 1958 (Vic)

'use strict';

const BaseAffidavitTemplate = require('../../core/BaseAffidavitTemplate');

/**
 * Victoria Affidavit Template
 *
 * @class VictoriaAffidavitTemplate
 * @extends BaseAffidavitTemplate
 */
class VictoriaAffidavitTemplate extends BaseAffidavitTemplate {
  constructor() {
    super();

    this.metadata = require('./metadata.json');
    this.state = this.metadata.stateCode;
    this.stateName = this.metadata.stateName;
    this.countryCode = 'AU';
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

  generateHeader() {
    return 'STATE OF VICTORIA';
  }

  generateVenue(county) {
    const location = (county || '[CITY/LOCALITY]').toUpperCase();
    return `AT ${location}`;
  }

  generateCaseCaption(affidavitData) {
    const court = affidavitData.court || affidavitData.courtName || 'FEDERAL CIRCUIT AND FAMILY COURT OF AUSTRALIA';
    const location = (affidavitData.county || affidavitData.city || '[LOCATION]').toUpperCase();
    const fileNo = affidavitData.caseNumber || '[FILE NUMBER]';
    const applicant = affidavitData.plaintiff || affidavitData.petitionerName || '[APPLICANT NAME]';
    const respondent = affidavitData.defendant || affidavitData.respondentName || '[RESPONDENT NAME]';

    const formatted =
      `${court.toUpperCase()}\n` +
      `REGISTRY: ${location}\n\n` +
      `File Number: ${fileNo}\n\n` +
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

  performStateSpecificValidation(affidavitData) {
    const errors = [];
    const warnings = [];
    if (!affidavitData.county && !affidavitData.city) {
      errors.push('City or locality is required for Victoria affidavits.');
    }
    return { errors, warnings };
  }

  generateNotaryBlock(affidavitData) {
    const city = affidavitData.county || affidavitData.city || '_______________';
    return (
      `Sworn/Affirmed at ${city},\n` +
      `in the State of Victoria,\n` +
      `on the _____ day of _________________, _______.\n\n` +
      `Before me:\n\n` +
      `________________________________\n` +
      `[Name]\n` +
      `Justice of the Peace / Solicitor / Commissioner for Oaths`
    );
  }
}

module.exports = VictoriaAffidavitTemplate;
