// templates/states/queensland/AffidavitTemplate.js
// Queensland affidavit template — legally compliant with Oaths Act 1867 (Qld)
'use strict';

const BaseAffidavitTemplate = require('../../core/BaseAffidavitTemplate');

class QueenslandAffidavitTemplate extends BaseAffidavitTemplate {
  constructor() {
    super();
    this.metadata = require('./metadata.json');
    this.state = this.metadata.stateCode;
    this.stateName = this.metadata.stateName;
    this.countryCode = 'AU';
    this.requiredFields = this.metadata.requiredFields;
    this.sections.perjuryStatement = false;
    this.formatting = { fontSize: '12pt', fontFamily: 'Times New Roman', lineHeight: '1.5', margin: '2.54cm', paperSize: 'A4' };
  }

  generateHeader() { return 'STATE OF QUEENSLAND'; }

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

    const formatted = `${court.toUpperCase()}\nREGISTRY: ${location}\n\nFile Number: ${fileNo}\n\n${applicant.toUpperCase()}\nApplicant\n\n— and —\n\n${respondent.toUpperCase()}\nRespondent`;

    return { courtName: court, caseNumber: affidavitData.caseNumber, plaintiff: applicant, defendant: respondent, formatted };
  }

  performStateSpecificValidation(affidavitData) {
    const errors = [];
    const warnings = [];
    if (!affidavitData.county && !affidavitData.city) errors.push('City or locality is required for Queensland affidavits.');
    return { errors, warnings };
  }

  generateNotaryBlock(affidavitData) {
    const city = affidavitData.county || affidavitData.city || '_______________';
    return (
      `Sworn/Affirmed at ${city},\n` +
      `in the State of Queensland,\n` +
      `on the _____ day of _________________, _______.\n\n` +
      `Before me:\n\n` +
      `________________________________\n` +
      `[Name]\n` +
      `Justice of the Peace / Solicitor / Commissioner for Declarations`
    );
  }
}

module.exports = QueenslandAffidavitTemplate;
