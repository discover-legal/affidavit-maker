// templates/states/cross_river/AffidavitTemplate.js
'use strict';
const BaseAffidavitTemplate = require('../../core/BaseAffidavitTemplate');

class CrossRiverAffidavitTemplate extends BaseAffidavitTemplate {
  constructor() {
    super();
    this.metadata = require('./metadata.json');
    this.state = this.metadata.stateCode;
    this.stateName = this.metadata.stateName;
    this.countryCode = 'NG';
    this.requiredFields = this.metadata.requiredFields;
    this.sections.perjuryStatement = false;
  }
  generateHeader() { return 'IN THE HIGH COURT OF CROSS RIVER STATE'; }
  generateVenue(county) { return `${(county || '[JUDICIAL DIVISION]').toUpperCase()} JUDICIAL DIVISION`; }
  generateCaseCaption(affidavitData) {
    const court = affidavitData.court || affidavitData.courtName || 'HIGH COURT OF CROSS RIVER STATE';
    const location = (affidavitData.county || affidavitData.city || '[JUDICIAL DIVISION]').toUpperCase();
    const suitNo = affidavitData.caseNumber || '[SUIT NUMBER]';
    const petitioner = affidavitData.plaintiff || affidavitData.petitionerName || '[PETITIONER NAME]';
    const respondent = affidavitData.defendant || affidavitData.respondentName || '[RESPONDENT NAME]';
    const formatted = `IN THE ${court.toUpperCase()}\n${location} JUDICIAL DIVISION\n\nSuit No. ${suitNo}\n\n${petitioner.toUpperCase()}\nPetitioner\n\n— AND —\n\n${respondent.toUpperCase()}\nRespondent`;
    return { courtName: court, caseNumber: affidavitData.caseNumber, plaintiff: petitioner, defendant: respondent, formatted };
  }
  performStateSpecificValidation(affidavitData) {
    const errors = [], warnings = [];
    if (!affidavitData.county && !affidavitData.city) errors.push('Judicial division is required for Cross River State affidavits.');
    return { errors, warnings };
  }
  generateNotaryBlock(affidavitData) {
    const location = affidavitData.county || affidavitData.city || '_______________';
    return `Sworn to at the ${location} Registry\nthis _____ day of _________________, _______\n\nBefore me:\n________________________________\nCommissioner for Oaths`;
  }
}
module.exports = CrossRiverAffidavitTemplate;
