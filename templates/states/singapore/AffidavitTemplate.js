// templates/states/singapore/AffidavitTemplate.js
// Singapore affidavit template — legally compliant with Oaths and Declarations Act (Cap 211)
// Governing Law: Oaths and Declarations Act (Cap 211); Family Justice Rules 2024

'use strict';

const BaseAffidavitTemplate = require('../../core/BaseAffidavitTemplate');

/**
 * Singapore Affidavit Template
 *
 * Key compliance notes:
 * - Sworn or affirmed before a Commissioner for Oaths under the Oaths and Declarations Act (Cap 211)
 * - Uses "Republic of Singapore" in the header
 * - A4 paper size (international standard)
 * - Divorce Suit No. instead of Case No.
 * - No perjury statement required (the oath/affirmation provides the solemn undertaking)
 * - Parties are "Plaintiff" and "Defendant" (for divorce writs under Women's Charter)
 * - NOTE: Muslim marriages are handled by the Syariah Court under AMLA (Cap 3)
 *
 * @class SingaporeAffidavitTemplate
 * @extends BaseAffidavitTemplate
 */
class SingaporeAffidavitTemplate extends BaseAffidavitTemplate {
  constructor() {
    super();

    this.metadata = require('./metadata.json');
    this.state = this.metadata.stateCode;       // "SG"
    this.stateName = this.metadata.stateName;   // "Singapore"
    this.countryCode = 'SG';
    this.requiredFields = this.metadata.requiredFields;

    this.sections.perjuryStatement = false;
  }

  /**
   * Singapore header uses "Republic of Singapore".
   */
  generateHeader() {
    return 'REPUBLIC OF SINGAPORE';
  }

  /**
   * Singapore venue — "IN THE FAMILY JUSTICE COURTS".
   * Singapore does not use county/province subdivisions.
   */
  generateVenue(county) {
    return 'IN THE FAMILY JUSTICE COURTS';
  }

  /**
   * Singapore case caption.
   * Family Justice Courts use "Divorce Suit No." for divorce proceedings.
   */
  generateCaseCaption(affidavitData) {
    const court = affidavitData.court || affidavitData.courtName || 'FAMILY JUSTICE COURTS';
    const suitNo = affidavitData.caseNumber || '[SUIT NUMBER]';
    const plaintiff = affidavitData.plaintiff || affidavitData.petitionerName || '[PLAINTIFF NAME]';
    const defendant = affidavitData.defendant || affidavitData.respondentName || '[DEFENDANT NAME]';

    const formatted =
      `${court.toUpperCase()}\n\n` +
      `Divorce Suit No. ${suitNo}\n\n` +
      `${plaintiff.toUpperCase()}\n` +
      `Plaintiff\n\n` +
      `— and —\n\n` +
      `${defendant.toUpperCase()}\n` +
      `Defendant`;

    return {
      courtName: court,
      caseNumber: affidavitData.caseNumber,
      plaintiff,
      defendant,
      formatted
    };
  }

  /**
   * Singapore-specific validation:
   * - No county/province subdivision required (Singapore is a city-state)
   */
  performStateSpecificValidation(affidavitData) {
    const errors = [];
    const warnings = [];

    // Singapore is a city-state; no sub-jurisdiction required
    // But affiantName is still required
    if (!affidavitData.affiantName) {
      errors.push('Deponent name is required for Singapore affidavits.');
    }

    return { errors, warnings };
  }

  /**
   * Singapore jurat block — sworn/affirmed before a Commissioner for Oaths
   * under the Oaths and Declarations Act (Cap 211).
   */
  generateNotaryBlock(affidavitData) {
    return (
      `Sworn/Affirmed at Singapore\n` +
      `this _____ day of _________________, _______.\n\n` +
      `Before me:\n\n` +
      `________________________________\n` +
      `[Name]\n` +
      `Commissioner for Oaths`
    );
  }
}

module.exports = SingaporeAffidavitTemplate;
