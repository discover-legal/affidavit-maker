// templates/states/rivers/AffidavitTemplate.js
// Rivers State affidavit template
// Governing Law: Oaths Act, Cap O1 LFN 2004; Evidence Act 2011

'use strict';

const BaseAffidavitTemplate = require('../../core/BaseAffidavitTemplate');

class RiversAffidavitTemplate extends BaseAffidavitTemplate {
  constructor() {
    super();
    this.metadata = require('./metadata.json');
    this.state = this.metadata.stateCode;
    this.stateName = this.metadata.stateName;
    this.countryCode = 'NG';
    this.requiredFields = this.metadata.requiredFields;
    this.sections.perjuryStatement = false;
  }

  generateHeader() { return 'IN THE HIGH COURT OF RIVERS STATE'; }

  generateVenue(county) {
    const location = (county || '[JUDICIAL DIVISION]').toUpperCase();
    return `${location} JUDICIAL DIVISION`;
  }

  generateCaseCaption(affidavitData) {
    const court = affidavitData.court || affidavitData.courtName || 'HIGH COURT OF RIVERS STATE';
    const location = (affidavitData.county || affidavitData.city || '[JUDICIAL DIVISION]').toUpperCase();
    const suitNo = affidavitData.caseNumber || '[SUIT NUMBER]';
    const petitioner = affidavitData.plaintiff || affidavitData.petitionerName || '[PETITIONER NAME]';
    const respondent = affidavitData.defendant || affidavitData.respondentName || '[RESPONDENT NAME]';

    const formatted =
      `IN THE ${court.toUpperCase()}\n` +
      `${location} JUDICIAL DIVISION\n\n` +
      `Suit No. ${suitNo}\n\n` +
      `${petitioner.toUpperCase()}\nPetitioner\n\n— AND —\n\n${respondent.toUpperCase()}\nRespondent`;

    return { courtName: court, caseNumber: affidavitData.caseNumber, plaintiff: petitioner, defendant: respondent, formatted };
  }

  performStateSpecificValidation(affidavitData) {
    const errors = [];
    const warnings = [];
    if (!affidavitData.county && !affidavitData.city) {
      errors.push('Judicial division or local government area is required for Rivers State affidavits.');
    }
    return { errors, warnings };
  }

  generateNotaryBlock(affidavitData) {
    const location = affidavitData.county || affidavitData.city || '_______________';
    return (
      `Sworn to at the ${location} Registry\n` +
      `this _____ day of _________________, _______\n\n` +
      `Before me:\n________________________________\nCommissioner for Oaths`
    );
  }
}

module.exports = RiversAffidavitTemplate;
