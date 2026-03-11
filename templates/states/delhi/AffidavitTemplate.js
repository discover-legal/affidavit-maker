// templates/states/delhi/AffidavitTemplate.js
// Delhi affidavit template — legally compliant with Indian Evidence Act and Delhi stamp rules
// Governing Law: Indian Evidence Act 1872; Indian Stamp Act 1899; Oaths Act 1969

'use strict';

const BaseAffidavitTemplate = require('../../core/BaseAffidavitTemplate');

/**
 * Delhi Affidavit Template
 *
 * Key compliance notes:
 * - Affidavit must be on judicial stamp paper of INR 10 (Delhi)
 * - Sworn before a Notary Public or Oath Commissioner
 * - Uses "NCT of Delhi" (National Capital Territory)
 * - Verified at [City] with deponent signature
 * - No perjury statement required (oath provides the solemn affirmation)
 * - Family proceedings use "Petitioner" / "Respondent"
 *
 * @class DelhiAffidavitTemplate
 * @extends BaseAffidavitTemplate
 */
class DelhiAffidavitTemplate extends BaseAffidavitTemplate {
  constructor() {
    super();

    this.metadata = require('./metadata.json');
    this.state = this.metadata.stateCode;       // "IN_DL"
    this.stateName = this.metadata.stateName;   // "Delhi"
    this.countryCode = 'IN';
    this.requiredFields = this.metadata.requiredFields;

    this.sections.perjuryStatement = false;
  }

  /**
   * Delhi header uses NCT designation.
   */
  generateHeader() {
    return 'IN THE FAMILY COURT AT NEW DELHI';
  }

  /**
   * Delhi venue — district of filing.
   */
  generateVenue(county) {
    const location = (county || 'NEW DELHI').toUpperCase();
    return `AT ${location}`;
  }

  /**
   * Delhi case caption.
   */
  generateCaseCaption(affidavitData) {
    const court = affidavitData.court || affidavitData.courtName || 'FAMILY COURT, SAKET, NEW DELHI';
    const location = (affidavitData.county || affidavitData.city || 'New Delhi').toUpperCase();
    const caseNo = affidavitData.caseNumber || '[CASE NUMBER]';
    const petitioner = affidavitData.plaintiff || affidavitData.petitionerName || '[PETITIONER NAME]';
    const respondent = affidavitData.defendant || affidavitData.respondentName || '[RESPONDENT NAME]';

    const formatted =
      `${court.toUpperCase()}\n` +
      `${location}\n\n` +
      `Case No. ${caseNo}\n\n` +
      `${petitioner.toUpperCase()}\n` +
      `Petitioner\n\n` +
      `Versus\n\n` +
      `${respondent.toUpperCase()}\n` +
      `Respondent`;

    return {
      courtName: court,
      caseNumber: affidavitData.caseNumber,
      plaintiff: petitioner,
      defendant: respondent,
      formatted
    };
  }

  /**
   * Delhi-specific validation:
   * - District is required
   */
  performStateSpecificValidation(affidavitData) {
    const errors = [];
    const warnings = [];

    if (!affidavitData.county && !affidavitData.city) {
      errors.push('District or city is required for Delhi affidavits.');
    }

    warnings.push('Affidavit must be executed on judicial stamp paper of INR 10 (Delhi).');

    return { errors, warnings };
  }

  /**
   * Delhi jurat block — verified before Notary Public / Oath Commissioner.
   */
  generateNotaryBlock(affidavitData) {
    const city = affidavitData.county || affidavitData.city || 'New Delhi';
    return (
      `Verified at ${city} on this _____ day of _________________, _______.\n\n` +
      `Deponent\n\n` +
      `Sworn before me:\n` +
      `________________________________\n` +
      `Notary Public / Oath Commissioner\n` +
      `${city}, Delhi`
    );
  }
}

module.exports = DelhiAffidavitTemplate;
