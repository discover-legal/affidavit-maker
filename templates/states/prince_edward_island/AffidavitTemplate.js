// templates/states/prince_edward_island/AffidavitTemplate.js
// Prince Edward Island affidavit template — legally compliant with PEI Evidence Act
// Governing Law: Evidence Act, RSPEI 1988, c. E-11; Commissioners for Oaths Act, RSPEI 1988, c. C-8.1

'use strict';

const BaseAffidavitTemplate = require('../../core/BaseAffidavitTemplate');

/**
 * Prince Edward Island Affidavit Template
 *
 * Key compliance notes:
 * - Sworn before a Commissioner for Oaths in Prince Edward Island
 * - Uses "Province of Prince Edward Island" not "State of"
 * - Supreme Court of Prince Edward Island (Family Division) handles family matters
 * - Court File No. instead of Case No.
 * - Divorce proceedings use "Petitioner" / "Respondent"
 * - Support is termed "maintenance" in PEI (Maintenance Enforcement Act)
 * - PEI is the smallest Canadian province — court proceedings may be less formal
 *   but must still comply with the Evidence Act, RSPEI 1988, c. E-11
 * - Commissioners for Oaths Act, RSPEI 1988, c. C-8.1 governs who may administer oaths
 *
 * @class PEIAffidavitTemplate
 * @extends BaseAffidavitTemplate
 */
class PEIAffidavitTemplate extends BaseAffidavitTemplate {
  constructor() {
    super();

    this.metadata = require('./metadata.json');
    this.state = this.metadata.stateCode;       // "PE"
    this.stateName = this.metadata.stateName;   // "Prince Edward Island"
    this.countryCode = 'CA';
    this.requiredFields = this.metadata.requiredFields;

    // Solemn oath replaces perjury warning in PEI practice
    this.sections.perjuryStatement = false;
  }

  /**
   * Province-level header for PEI affidavits.
   * @returns {string} Header text
   */
  generateHeader() {
    return 'PROVINCE OF PRINCE EDWARD ISLAND';
  }

  /**
   * Venue block using city/location.
   * PEI Supreme Court proceedings are identified by city or location.
   * @param {string} county - City or location of filing
   * @returns {string} Venue text
   */
  generateVenue(county) {
    const city = (county || '[CITY/LOCATION]').toUpperCase();
    return `AT ${city}`;
  }

  /**
   * PEI case caption.
   * Supreme Court of Prince Edward Island (Family Division) uses "Court File No."
   * Family proceedings use Applicant / Respondent.
   * @param {Object} affidavitData - Affidavit data
   * @returns {Object} Case caption with formatted text
   */
  generateCaseCaption(affidavitData) {
    const court = affidavitData.court || affidavitData.courtName ||
      'SUPREME COURT OF PRINCE EDWARD ISLAND (TRIAL DIVISION)';
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
   * PEI-specific validation:
   * - City or location is required (maps to county field)
   * @param {Object} affidavitData - Affidavit data to validate
   * @returns {Object} Validation result with errors and warnings
   */
  performStateSpecificValidation(affidavitData) {
    const errors = [];
    const warnings = [];

    if (!affidavitData.county && !affidavitData.city) {
      errors.push('City or location is required for Prince Edward Island affidavits.');
    }

    return { errors, warnings };
  }

  /**
   * PEI jurat block — sworn before a Commissioner for Oaths.
   * Governed by the Commissioners for Oaths Act, RSPEI 1988, c. C-8.1.
   * @param {Object} affidavitData - Affidavit data
   * @returns {string} Jurat text
   */
  generateNotaryBlock(affidavitData) {
    const city = affidavitData.county || affidavitData.city || '_______________';
    return (
      `SWORN before me at the City/Town of ${city},\n` +
      `in the Province of Prince Edward Island,\n` +
      `this _____ day of _________________, _______.\n\n` +
      `________________________________\n` +
      `A Commissioner for Oaths\n` +
      `in and for the Province of Prince Edward Island`
    );
  }
}

module.exports = PEIAffidavitTemplate;
