// templates/states/tamil_nadu/AffidavitTemplate.js
'use strict';
const BaseAffidavitTemplate = require('../../core/BaseAffidavitTemplate');

class TamilNaduAffidavitTemplate extends BaseAffidavitTemplate {
  constructor() {
    super();
    this.metadata = require('./metadata.json');
    this.state = this.metadata.stateCode; this.stateName = this.metadata.stateName; this.countryCode = 'IN';
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
