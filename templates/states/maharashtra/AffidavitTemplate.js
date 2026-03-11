// templates/states/maharashtra/AffidavitTemplate.js
// Maharashtra affidavit template
// Governing Law: Indian Evidence Act 1872; Maharashtra Stamp Act; Oaths Act 1969

'use strict';

const BaseAffidavitTemplate = require('../../core/BaseAffidavitTemplate');

class MaharashtraAffidavitTemplate extends BaseAffidavitTemplate {
  constructor() {
    super();
    this.metadata = require('./metadata.json');
    this.state = this.metadata.stateCode;
    this.stateName = this.metadata.stateName;
    this.countryCode = 'IN';
    this.requiredFields = this.metadata.requiredFields;
    this.sections.perjuryStatement = false;
  }

  generateHeader() {
    return 'IN THE FAMILY COURT AT MUMBAI';
  }

  generateVenue(county) {
    const location = (county || 'MUMBAI').toUpperCase();
    return `AT ${location}`;
  }

  generateCaseCaption(affidavitData) {
    const court = affidavitData.court || affidavitData.courtName || 'FAMILY COURT, BANDRA, MUMBAI';
    const location = (affidavitData.county || affidavitData.city || 'Mumbai').toUpperCase();
    const caseNo = affidavitData.caseNumber || '[CASE NUMBER]';
    const petitioner = affidavitData.plaintiff || affidavitData.petitionerName || '[PETITIONER NAME]';
    const respondent = affidavitData.defendant || affidavitData.respondentName || '[RESPONDENT NAME]';

    const formatted =
      `${court.toUpperCase()}\n${location}\n\nCase No. ${caseNo}\n\n` +
      `${petitioner.toUpperCase()}\nPetitioner\n\nVersus\n\n${respondent.toUpperCase()}\nRespondent`;

    return { courtName: court, caseNumber: affidavitData.caseNumber, plaintiff: petitioner, defendant: respondent, formatted };
  }

  performStateSpecificValidation(affidavitData) {
    const errors = [];
    const warnings = [];
    if (!affidavitData.county && !affidavitData.city) {
      errors.push('District or city is required for Maharashtra affidavits.');
    }
    warnings.push('Affidavit must be executed on judicial stamp paper of INR 100 (Maharashtra).');
    return { errors, warnings };
  }

  generateNotaryBlock(affidavitData) {
    const city = affidavitData.county || affidavitData.city || 'Mumbai';
    return (
      `Verified at ${city} on this _____ day of _________________, _______.\n\n` +
      `Deponent\n\nSworn before me:\n________________________________\n` +
      `Notary Public / Oath Commissioner\n${city}, Maharashtra`
    );
  }
}

module.exports = MaharashtraAffidavitTemplate;
