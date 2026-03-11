// templates/states/south_australia/AffidavitTemplate.js
// Oaths Act 1936 (SA)
'use strict';

const BaseAffidavitTemplate = require('../../core/BaseAffidavitTemplate');

class SouthAustraliaAffidavitTemplate extends BaseAffidavitTemplate {
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

  generateHeader() { return 'STATE OF SOUTH AUSTRALIA'; }
  generateVenue(county) { return `AT ${(county || '[CITY/LOCALITY]').toUpperCase()}`; }

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
    const errors = []; const warnings = [];
    if (!affidavitData.county && !affidavitData.city) errors.push('City or locality is required for South Australia affidavits.');
    return { errors, warnings };
  }

  generateNotaryBlock(affidavitData) {
    const city = affidavitData.county || affidavitData.city || '_______________';
    return `Sworn/Affirmed at ${city},\nin the State of South Australia,\non the _____ day of _________________, _______.\n\nBefore me:\n\n________________________________\n[Name]\nJustice of the Peace / Solicitor / Commissioner for Oaths`;
  }
}

module.exports = SouthAustraliaAffidavitTemplate;
