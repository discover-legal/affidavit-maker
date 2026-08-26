// templates/states/tasmania/AffidavitTemplate.js
// Evidence Act 2001 (Tas)
'use strict';
const BaseAffidavitTemplate = require('../../core/BaseAffidavitTemplate');

class TasmaniaAffidavitTemplate extends BaseAffidavitTemplate {
  // Australian terminology (see templates/core/terminology.js): divorce is
  // federal (FCFCOA) — the caption is the court-name line + registry; parties
  // are Applicant/Respondent (Family Law Act 1975 (Cth)). No "STATE OF"/
  // "COUNTY OF" caption lines and no "X County" body phrasing.
  constructor() {
    super();
    this.metadata = require('./metadata.json');
    this.state = this.metadata.stateCode; this.stateName = this.metadata.stateName; this.countryCode = 'AU'; this.terminology = { ...this.terminology, jurisdictionLabel: null, districtLabel: null, districtStyle: 'plain', jurisdictionTerm: 'State', districtTerm: 'Registry', districtPlaceholder: '[REGISTRY]', filerLabel: 'Applicant', responderLabel: 'Respondent', selfRepresentedLabel: 'Self-Represented' };
    this.requiredFields = this.metadata.requiredFields; this.sections.perjuryStatement = false;
    this.formatting = { fontSize: '12pt', fontFamily: 'Times New Roman', lineHeight: '1.5', margin: '2.54cm', paperSize: 'A4' };
  }
  generateHeader() { return 'TASMANIA'; }
  generateVenue(county) { return `AT ${(county || '[CITY/LOCALITY]').toUpperCase()}`; }
  generateCaseCaption(affidavitData) {
    const court = affidavitData.court || affidavitData.courtName || 'FEDERAL CIRCUIT AND FAMILY COURT OF AUSTRALIA';
    const location = (affidavitData.county || affidavitData.city || '[LOCATION]').toUpperCase();
    const fileNo = affidavitData.caseNumber || '[FILE NUMBER]';
    const applicant = affidavitData.plaintiff || affidavitData.petitionerName || '[APPLICANT NAME]';
    const respondent = affidavitData.defendant || affidavitData.respondentName || '[RESPONDENT NAME]';
    return { courtName: court, caseNumber: affidavitData.caseNumber, plaintiff: applicant, defendant: respondent, formatted: `${court.toUpperCase()}\nREGISTRY: ${location}\n\nFile Number: ${fileNo}\n\n${applicant.toUpperCase()}\nApplicant\n\n— and —\n\n${respondent.toUpperCase()}\nRespondent` };
  }
  performStateSpecificValidation(affidavitData) {
    const errors = []; const warnings = [];
    if (!affidavitData.county && !affidavitData.city) errors.push('City or locality is required for Tasmania affidavits.');
    return { errors, warnings };
  }
  generateNotaryBlock(affidavitData) {
    const city = affidavitData.county || affidavitData.city || '_______________';
    return `Sworn/Affirmed at ${city},\nin Tasmania,\non the _____ day of _________________, _______.\n\nBefore me:\n\n________________________________\n[Name]\nJustice of the Peace / Solicitor / Commissioner for Oaths`;
  }
}
module.exports = TasmaniaAffidavitTemplate;
