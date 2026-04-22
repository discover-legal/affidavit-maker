// templates/states/edo/AffidavitTemplate.js
'use strict';
const BaseAffidavitTemplate = require('../../core/BaseAffidavitTemplate');
class EdoAffidavitTemplate extends BaseAffidavitTemplate {
  constructor() { super(); this.metadata = require('./metadata.json'); this.state = this.metadata.stateCode; this.stateName = this.metadata.stateName; this.countryCode = 'NG'; this.requiredFields = this.metadata.requiredFields; this.sections.perjuryStatement = false; }
  generateHeader() { return 'IN THE HIGH COURT OF EDO STATE'; }
  generateVenue(county) { return `${(county || '[JUDICIAL DIVISION]').toUpperCase()} JUDICIAL DIVISION`; }
  generateCaseCaption(d) { const court = d.court || d.courtName || 'HIGH COURT OF EDO STATE'; const loc = (d.county || d.city || '[JUDICIAL DIVISION]').toUpperCase(); const sn = d.caseNumber || '[SUIT NUMBER]'; const p = d.plaintiff || d.petitionerName || '[PETITIONER NAME]'; const r = d.defendant || d.respondentName || '[RESPONDENT NAME]'; return { courtName: court, caseNumber: d.caseNumber, plaintiff: p, defendant: r, formatted: `IN THE ${court.toUpperCase()}\n${loc} JUDICIAL DIVISION\n\nSuit No. ${sn}\n\n${p.toUpperCase()}\nPetitioner\n\n— AND —\n\n${r.toUpperCase()}\nRespondent` }; }
  performStateSpecificValidation(d) { const errors = [], warnings = []; if (!d.county && !d.city) errors.push('Judicial division is required for Edo State affidavits.'); return { errors, warnings }; }
  generateNotaryBlock(d) { const loc = d.county || d.city || '_______________'; return `Sworn to at the ${loc} Registry\nthis _____ day of _________________, _______\n\nBefore me:\n________________________________\nCommissioner for Oaths`; }
}
module.exports = EdoAffidavitTemplate;
