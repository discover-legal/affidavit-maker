// templates/states/tamil_nadu/AffidavitTemplate.js
'use strict';
const BaseAffidavitTemplate = require('../../core/BaseAffidavitTemplate');

class TamilNaduAffidavitTemplate extends BaseAffidavitTemplate {
  // Indian terminology (see templates/core/terminology.js): the caption is the
  // court-name line (Family Court / District Court) + district; parties are
  // Petitioner/Respondent (HMA 1955 / SMA 1954). No "STATE OF"/"COUNTY OF"
  // caption lines and no "X County" body phrasing.
  constructor() {
    super();
    this.metadata = require('./metadata.json');
    this.state = this.metadata.stateCode; this.stateName = this.metadata.stateName; this.countryCode = 'IN'; this.terminology = { ...this.terminology, jurisdictionLabel: null, districtLabel: null, districtStyle: 'plain', jurisdictionTerm: 'State', districtTerm: 'District', districtPlaceholder: '[DISTRICT]', filerLabel: 'Petitioner', responderLabel: 'Respondent', selfRepresentedLabel: 'Self-Represented' };
    this.requiredFields = this.metadata.requiredFields; this.sections.perjuryStatement = false;
  }
  generateHeader() { return 'IN THE FAMILY COURT AT CHENNAI'; }
  generateVenue(county) { return `AT ${(county || 'CHENNAI').toUpperCase()}`; }
  generateCaseCaption(d) {
    const court = d.court || d.courtName || 'FAMILY COURT, CHENNAI';
    const loc = (d.county || d.city || 'Chennai').toUpperCase();
    const p = d.plaintiff || d.petitionerName || '[PETITIONER NAME]';
    const r = d.defendant || d.respondentName || '[RESPONDENT NAME]';
    return { courtName: court, caseNumber: d.caseNumber, plaintiff: p, defendant: r, formatted: `${court.toUpperCase()}\n${loc}\n\nCase No. ${d.caseNumber || '[CASE NUMBER]'}\n\n${p.toUpperCase()}\nPetitioner\n\nVersus\n\n${r.toUpperCase()}\nRespondent` };
  }
  performStateSpecificValidation(d) {
    const errors = [], warnings = [];
    if (!d.county && !d.city) errors.push('District or city is required for Tamil Nadu affidavits.');
    warnings.push('Affidavit must be on judicial stamp paper of INR 200 (Tamil Nadu).');
    return { errors, warnings };
  }
  generateNotaryBlock(d) {
    const city = d.county || d.city || 'Chennai';
    return `Verified at ${city} on this _____ day of _________________, _______.\n\nDeponent\n\nSworn before me:\n________________________________\nNotary Public / Oath Commissioner\n${city}, Tamil Nadu`;
  }
}
module.exports = TamilNaduAffidavitTemplate;
