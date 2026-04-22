// templates/states/karnataka/AffidavitTemplate.js
'use strict';
const BaseAffidavitTemplate = require('../../core/BaseAffidavitTemplate');

class KarnatakaAffidavitTemplate extends BaseAffidavitTemplate {
  constructor() {
    super();
    this.metadata = require('./metadata.json');
    this.state = this.metadata.stateCode;
    this.stateName = this.metadata.stateName;
    this.countryCode = 'IN';
    this.requiredFields = this.metadata.requiredFields;
    this.sections.perjuryStatement = false;
  }

  generateHeader() { return 'IN THE FAMILY COURT AT BENGALURU'; }
  generateVenue(county) { return `AT ${(county || 'BENGALURU').toUpperCase()}`; }

  generateCaseCaption(affidavitData) {
    const court = affidavitData.court || affidavitData.courtName || 'FAMILY COURT, BENGALURU';
    const location = (affidavitData.county || affidavitData.city || 'Bengaluru').toUpperCase();
    const caseNo = affidavitData.caseNumber || '[CASE NUMBER]';
    const petitioner = affidavitData.plaintiff || affidavitData.petitionerName || '[PETITIONER NAME]';
    const respondent = affidavitData.defendant || affidavitData.respondentName || '[RESPONDENT NAME]';
    const formatted = `${court.toUpperCase()}\n${location}\n\nCase No. ${caseNo}\n\n${petitioner.toUpperCase()}\nPetitioner\n\nVersus\n\n${respondent.toUpperCase()}\nRespondent`;
    return { courtName: court, caseNumber: affidavitData.caseNumber, plaintiff: petitioner, defendant: respondent, formatted };
  }

  performStateSpecificValidation(affidavitData) {
    const errors = [];
    const warnings = [];
    if (!affidavitData.county && !affidavitData.city) errors.push('District or city is required for Karnataka affidavits.');
    warnings.push('Affidavit must be executed on judicial stamp paper of INR 20 (Karnataka).');
    return { errors, warnings };
  }

  generateNotaryBlock(affidavitData) {
    const city = affidavitData.county || affidavitData.city || 'Bengaluru';
    return `Verified at ${city} on this _____ day of _________________, _______.\n\nDeponent\n\nSworn before me:\n________________________________\nNotary Public / Oath Commissioner\n${city}, Karnataka`;
  }
}

module.exports = KarnatakaAffidavitTemplate;
