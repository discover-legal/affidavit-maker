// templates/states/delta/AffidavitTemplate.js
'use strict';
const BaseAffidavitTemplate = require('../../core/BaseAffidavitTemplate');
class DeltaAffidavitTemplate extends BaseAffidavitTemplate {
  constructor() { super(); this.metadata = require('./metadata.json'); this.state = this.metadata.stateCode; this.stateName = this.metadata.stateName; this.countryCode = 'NG'; this.requiredFields = this.metadata.requiredFields; this.sections.perjuryStatement = false; }
  generateHeader() { return 'IN THE HIGH COURT OF DELTA STATE'; }
  generateVenue(county) { return `${(county || '[JUDICIAL DIVISION]').toUpperCase()} JUDICIAL DIVISION`; }
  generateCaseCaption(d) { const court = d.court || d.courtName || 'HIGH COURT OF DELTA STATE'; const loc = (d.county || d.city || '[JUDICIAL DIVISION]').toUpperCase(); const p = d.plaintiff || d.petitionerName || '[PETITIONER NAME]'; const r = d.defendant || d.respondentName || '[RESPONDENT NAME]'; return { courtName: court, caseNumber: d.caseNumber, plaintiff: p, defendant: r, formatted: `IN THE ${court.toUpperCase()}\n${loc} JUDICIAL DIVISION\n\nSuit No. ${d.caseNumber || '[SUIT NUMBER]'}\n\n${p.toUpperCase()}\nPetitioner\n\n— AND —\n\n${r.toUpperCase()}\nRespondent` }; }
  performStateSpecificValidation(d) { const errors = [], warnings = []; if (!d.county && !d.city) errors.push('Judicial division required for Delta State affidavits.'); return { errors, warnings }; }
  generateNotaryBlock(d) { return `Sworn to at the ${d.county || d.city || '_______________'} Registry\nthis _____ day of _________________, _______\n\nBefore me:\n________________________________\nCommissioner for Oaths`; }
}
module.exports = DeltaAffidavitTemplate;
