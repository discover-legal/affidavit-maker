// templates/states/newfoundland/AffidavitTemplate.js
// Newfoundland and Labrador affidavit template — legally compliant with NL Evidence Act
// Governing Law: Evidence Act, RSNL 1990, c. E-16; Commissioners for Oaths Act, RSNL 1990, c. C-22

'use strict';

const BaseAffidavitTemplate = require('../../core/BaseAffidavitTemplate');

/**
 * Newfoundland and Labrador Affidavit Template
 *
 * Key compliance notes:
 * - Sworn before a Commissioner for Oaths in Newfoundland and Labrador
 * - Uses "Province of Newfoundland and Labrador" not "State of"
 * - Supreme Court uses city/location identifiers (St. John's, Corner Brook, Grand Falls-Windsor, etc.)
 * - Court File No. instead of Case No.
 * - Divorce proceedings use "Petitioner" / "Respondent"
 * - Support is termed "maintenance" under the Family Law Act, RSNL 1990, c. F-2
 * - Affidavit body opens: "I, [name], of [city], in the Province of Newfoundland and Labrador,
 *   [occupation], make oath and say:" (Evidence Act, RSNL 1990, c. E-16)
 * - Commissioners for Oaths Act governs who may administer oaths (RSNL 1990, c. C-22)
 *
 * @class NewfoundlandAffidavitTemplate
 * @extends BaseAffidavitTemplate
 */
class NewfoundlandAffidavitTemplate extends BaseAffidavitTemplate {
  constructor() {
    super();

    this.metadata = require('./metadata.json');
    this.state = this.metadata.stateCode;       // "NL"
    this.stateName = this.metadata.stateName;   // "Newfoundland and Labrador"
    this.countryCode = 'CA';
    this.requiredFields = this.metadata.requiredFields;

    // Solemn oath replaces perjury warning in NL practice
    this.sections.perjuryStatement = false;
  }

  /**
   * Province-level header for Newfoundland and Labrador affidavits.
   * @returns {string} Header text
   */
  generateHeader() {
    return 'PROVINCE OF NEWFOUNDLAND AND LABRADOR';
  }

  /**
   * Venue block using city/location.
   * NL Supreme Court proceedings are identified by city, not county.
   * @param {string} county - City or location of filing
   * @returns {string} Venue text
   */
  generateVenue(county) {
    const city = (county || '[CITY/LOCATION]').toUpperCase();
    return `AT ${city}`;
  }

  /**
   * NL case caption.
   * Supreme Court of Newfoundland and Labrador uses "Court File No." and city location.
   * Family proceedings use Applicant / Respondent.
   * @param {Object} affidavitData - Affidavit data
   * @returns {Object} Case caption with formatted text
   */
  generateCaseCaption(affidavitData) {
    const court = affidavitData.court || affidavitData.courtName ||
      'SUPREME COURT OF NEWFOUNDLAND AND LABRADOR (TRIAL DIVISION)';
    const location = (affidavitData.county || affidavitData.city || '[LOCATION]').toUpperCase();
    const fileNo = affidavitData.caseNumber || '[FILE NUMBER]';
    const petitioner = affidavitData.plaintiff || affidavitData.petitionerName || '[PETITIONER NAME]';
    const respondent = affidavitData.defendant || affidavitData.respondentName || '[RESPONDENT NAME]';

    const formatted =
      `${court.toUpperCase()}\n` +
      `AT ${location}\n\n` +
      `Court File No. ${fileNo}\n\n` +
      `${petitioner.toUpperCase()}\n` +
      `Petitioner\n\n` +
      `— and —\n\n` +
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
   * NL-specific validation:
   * - City or location is required (maps to county field)
   * @param {Object} affidavitData - Affidavit data to validate
   * @returns {Object} Validation result with errors and warnings
   */
  performStateSpecificValidation(affidavitData) {
    const errors = [];
    const warnings = [];

    if (!affidavitData.county && !affidavitData.city) {
      errors.push('City or location is required for Newfoundland and Labrador affidavits.');
    }

    return { errors, warnings };
  }

  /**
   * NL jurat block — sworn before a Commissioner for Oaths.
   * Governed by the Commissioners for Oaths Act, RSNL 1990, c. C-22.
   * @param {Object} affidavitData - Affidavit data
   * @returns {string} Jurat text
   */
  generateNotaryBlock(affidavitData) {
    const city = affidavitData.county || affidavitData.city || '_______________';
    return (
      `SWORN before me at the City/Town of ${city},\n` +
      `in the Province of Newfoundland and Labrador,\n` +
      `this _____ day of _________________, _______.\n\n` +
      `________________________________\n` +
      `A Commissioner for Oaths\n` +
      `in and for the Province of Newfoundland and Labrador`
    );
  }
}

module.exports = NewfoundlandAffidavitTemplate;
