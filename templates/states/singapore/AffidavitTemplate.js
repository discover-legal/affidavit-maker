// templates/states/singapore/AffidavitTemplate.js
// Singapore affidavit template — legally compliant with Oaths and Declarations Act 2000
// Governing Law: Oaths and Declarations Act 2000; Family Justice (General) Rules 2024

'use strict';

const BaseAffidavitTemplate = require('../../core/BaseAffidavitTemplate');

/**
 * Singapore Affidavit Template
 *
 * Key compliance notes:
 * - Sworn or affirmed before a Commissioner for Oaths under the Oaths and Declarations Act 2000
 * - Uses "Republic of Singapore" in the header
 * - A4 paper size (international standard)
 * - "No. FC/OA [number]/[year]" case numbering (originating applications, post-15-Oct-2024)
 * - No perjury statement required (the oath/affirmation provides the solemn undertaking)
 * - Parties are "Applicant" and "Respondent" (filings from 15 October 2024 under the
 *   Women's Charter; "Plaintiff/Defendant" only for pre-15-Oct-2024 writ filings)
 * - NOTE: Muslim marriages are handled by the Syariah Court under AMLA 1966
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
   * Family Justice Courts number originating applications "No. FC/OA [number]/[year]".
   */
  generateCaseCaption(affidavitData) {
    const court = affidavitData.court || affidavitData.courtName || 'FAMILY JUSTICE COURTS';
    const suitNo = affidavitData.caseNumber || '[NUMBER]/[YEAR]';
    const plaintiff = affidavitData.plaintiff || affidavitData.petitionerName || '[APPLICANT NAME]';
    const defendant = affidavitData.defendant || affidavitData.respondentName || '[RESPONDENT NAME]';

    const formatted =
      `${court.toUpperCase()}\n\n` +
      `No. FC/OA ${suitNo}\n\n` +
      `${plaintiff.toUpperCase()}\n` +
      `Applicant\n\n` +
      `— and —\n\n` +
      `${defendant.toUpperCase()}\n` +
      `Respondent`;

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
   * under the Oaths and Declarations Act 2000.
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
