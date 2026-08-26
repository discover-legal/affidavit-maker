'use strict';
const BaseAffidavitTemplate = require('../../core/BaseAffidavitTemplate');
class AbiaAffidavitTemplate extends BaseAffidavitTemplate {
  // Nigerian terminology (see templates/core/terminology.js): the caption is the
  // court-name line + suit number; parties are Petitioner/Respondent under the
  // Matrimonial Causes Act 1970; High Courts sit in judicial divisions, not
  // counties. No "STATE OF"/"COUNTY OF" caption lines, no "X County" body phrasing.
  constructor() { super(); this.metadata = require('./metadata.json'); this.state = this.metadata.stateCode; this.stateName = this.metadata.stateName; this.countryCode = 'NG'; this.terminology = { ...this.terminology, jurisdictionLabel: null, districtLabel: null, districtStyle: 'plain', jurisdictionTerm: 'State', districtTerm: 'Judicial division', districtPlaceholder: '[JUDICIAL DIVISION]', filerLabel: 'Petitioner', responderLabel: 'Respondent', selfRepresentedLabel: 'Self-Represented' }; this.requiredFields = this.metadata.requiredFields; this.sections.perjuryStatement = false; }
  generateHeader() { return 'IN THE HIGH COURT OF ABIA STATE'; }
  generateVenue(county) { return `${(county || '[JUDICIAL DIVISION]').toUpperCase()} JUDICIAL DIVISION`; }
  generateCaseCaption(d) { const court = d.court || d.courtName || 'HIGH COURT OF ABIA STATE'; const p = d.plaintiff || d.petitionerName || '[PETITIONER NAME]'; const r = d.defendant || d.respondentName || '[RESPONDENT NAME]'; return { courtName: court, caseNumber: d.caseNumber, plaintiff: p, defendant: r, formatted: `IN THE ${court.toUpperCase()}\n${(d.county || d.city || '[JUDICIAL DIVISION]').toUpperCase()} JUDICIAL DIVISION\n\nSuit No. ${d.caseNumber || '[SUIT NUMBER]'}\n\n${p.toUpperCase()}\nPetitioner\n\n— AND —\n\n${r.toUpperCase()}\nRespondent` }; }
  performStateSpecificValidation(d) { const errors = [], warnings = []; if (!d.county && !d.city) errors.push('Judicial division required for Abia State affidavits.'); return { errors, warnings }; }
  generateNotaryBlock(d) { return `Sworn to at the ${d.county || d.city || '_______________'} Registry\nthis _____ day of _________________, _______\n\nBefore me:\n________________________________\nCommissioner for Oaths`; }
}
module.exports = AbiaAffidavitTemplate;
