// templates/states/ghana/AffidavitTemplate.js
// Ghana affidavit template — legally compliant with Oaths Act 1972 (NRCD 6)
// Governing Law: Oaths Act 1972 (NRCD 6); Courts Act 1993 (Act 459)

'use strict';

const BaseAffidavitTemplate = require('../../core/BaseAffidavitTemplate');

/**
 * Ghana Affidavit Template
 *
 * Key compliance notes:
 * - Sworn before a Commissioner for Oaths under the Oaths Act 1972 (NRCD 6)
 * - Uses "Republic of Ghana" as the header
 * - County field maps to the city/district of filing
 * - Suit No. instead of Case No.
 * - No perjury statement required (oath provides the solemn affirmation)
 * - Court is the High Court of Justice
 * - A4 paper size
 *
 * @class GhanaAffidavitTemplate
 * @extends BaseAffidavitTemplate
 */
class GhanaAffidavitTemplate extends BaseAffidavitTemplate {
  constructor() {
    super();

    this.metadata = require('./metadata.json');
    this.state = this.metadata.stateCode;       // "GH"
    this.stateName = this.metadata.stateName;   // "Ghana"
    this.countryCode = 'GH';
    this.requiredFields = this.metadata.requiredFields;

    this.sections.perjuryStatement = false;
  }

  /**
   * Ghana header uses republic designation.
   */
  generateHeader() {
    return 'REPUBLIC OF GHANA';
  }

  /**
   * Ghana venue — city or district of filing.
   */
  generateVenue(county) {
    const location = (county || '[CITY/DISTRICT]').toUpperCase();
    return `IN THE HIGH COURT OF JUSTICE, ${location}`;
  }

  /**
   * Ghana case caption.
   * The High Court uses "Suit No." and the courthouse location.
   */
  generateCaseCaption(affidavitData) {
    const court = affidavitData.court || affidavitData.courtName || 'HIGH COURT OF JUSTICE';
    const location = (affidavitData.county || affidavitData.city || '[LOCATION]').toUpperCase();
    const suitNo = affidavitData.caseNumber || '[SUIT NUMBER]';
    const petitioner = affidavitData.plaintiff || affidavitData.petitionerName || '[PETITIONER NAME]';
    const respondent = affidavitData.defendant || affidavitData.respondentName || '[RESPONDENT NAME]';

    const formatted =
      `${court.toUpperCase()}\n` +
      `${location}\n\n` +
      `Suit No. ${suitNo}\n\n` +
      `${petitioner.toUpperCase()}\n` +
      `Petitioner\n\n` +
      `— versus —\n\n` +
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
   * Ghana-specific validation:
   * - city/district is required (maps to county field)
   */
  performStateSpecificValidation(affidavitData) {
    const errors = [];
    const warnings = [];

    if (!affidavitData.county && !affidavitData.city) {
      errors.push('City or district is required for Ghana affidavits.');
    }

    return { errors, warnings };
  }

  /**
   * Ghana jurat block — sworn before a Commissioner for Oaths
   * under the Oaths Act 1972 (NRCD 6).
   */
  generateNotaryBlock(affidavitData) {
    const city = affidavitData.county || affidavitData.city || '_______________';
    return (
      `SWORN at ${city} this _____ day of\n` +
      `_________________, _______.\n\n` +
      `Before me:\n\n` +
      `________________________________\n` +
      `Commissioner for Oaths`
    );
  }
}

module.exports = GhanaAffidavitTemplate;
