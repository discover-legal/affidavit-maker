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

    // Indian terminology (see templates/core/terminology.js): the caption is the
    // court-name line (Family Court / District Court) + district; parties are
    // Petitioner/Respondent (HMA 1955 / SMA 1954). No "STATE OF"/"COUNTY OF"
    // caption lines and no "X County" body phrasing.
    this.terminology = {
      ...this.terminology,
      jurisdictionLabel: null,
      districtLabel: null,
      districtStyle: 'plain',
      jurisdictionTerm: 'State',
      districtTerm: 'District',
      districtPlaceholder: '[DISTRICT]',
      filerLabel: 'Petitioner',
      responderLabel: 'Respondent',
      selfRepresentedLabel: 'Self-Represented',
    };
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
    warnings.push('Stamp paper: affidavits sworn for immediate filing in court are exempt from stamp duty (Maharashtra Stamp Act, Sch. I, Art. 4, exemption); standalone affidavits use non-judicial stamp paper (Art. 4 duty INR 500 since the October 2024 amendment).');
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
