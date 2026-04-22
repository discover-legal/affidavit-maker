// templates/states/northern_ireland/AffidavitTemplate.js
// Northern Ireland affidavit template
// Governing Law: Matrimonial Causes (NI) Order 1978; Oaths Act (Northern Ireland)

'use strict';

const BaseAffidavitTemplate = require('../../core/BaseAffidavitTemplate');

/**
 * Northern Ireland Affidavit Template
 *
 * Key compliance notes:
 * - Northern Ireland still uses sworn affidavits (like Scotland, unlike England)
 * - Sworn before a Commissioner for Oaths or practising solicitor
 * - A4 paper size
 * - Parties in divorce are "Petitioner" and "Respondent" (NI retains old terminology)
 * - Ref. No. for case reference
 * - Court is the High Court (Family Division) for most divorce cases
 * - NI has NOT adopted no-fault divorce — still requires fault or long separation
 *
 * @class NorthernIrelandAffidavitTemplate
 * @extends BaseAffidavitTemplate
 */
class NorthernIrelandAffidavitTemplate extends BaseAffidavitTemplate {
  constructor() {
    super();

    this.metadata = require('./metadata.json');
    this.state = this.metadata.stateCode;       // "NIR"
    this.stateName = this.metadata.stateName;   // "Northern Ireland"
    this.countryCode = 'UK';
    this.requiredFields = this.metadata.requiredFields;

    // Northern Ireland uses sworn affidavits
    this.sections.perjuryStatement = false;
  }

  /**
   * Northern Ireland header.
   */
  generateHeader() {
    return 'IN NORTHERN IRELAND';
  }

  /**
   * Northern Ireland venue — court location.
   */
  generateVenue(county) {
    const location = (county || '[COURT LOCATION]').toUpperCase();
    return `AT ${location}`;
  }

  /**
   * Northern Ireland case caption.
   * High Court (Family Division) uses "Ref. No."
   * Parties are "Petitioner" and "Respondent".
   */
  generateCaseCaption(affidavitData) {
    const court = affidavitData.court || affidavitData.courtName || 'HIGH COURT OF JUSTICE IN NORTHERN IRELAND (FAMILY DIVISION)';
    const location = (affidavitData.county || affidavitData.city || '[LOCATION]').toUpperCase();
    const refNo = affidavitData.caseNumber || '[REFERENCE NUMBER]';
    const petitioner = affidavitData.plaintiff || affidavitData.petitionerName || '[PETITIONER NAME]';
    const respondent = affidavitData.defendant || affidavitData.respondentName || '[RESPONDENT NAME]';

    const formatted =
      `${court.toUpperCase()}\n` +
      `${location}\n\n` +
      `Ref. No. ${refNo}\n\n` +
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
   * Northern Ireland-specific validation:
   * - Court location is required
   */
  performStateSpecificValidation(affidavitData) {
    const errors = [];
    const warnings = [];

    if (!affidavitData.county && !affidavitData.city) {
      errors.push('Court location is required for Northern Ireland affidavits.');
    }

    return { errors, warnings };
  }

  /**
   * Northern Ireland jurat block — sworn before a Commissioner for Oaths.
   */
  generateNotaryBlock(affidavitData) {
    const location = affidavitData.county || affidavitData.city || '_______________';
    return (
      `SWORN at ${location}, Northern Ireland,\n` +
      `this _____ day of _________________, _______.\n\n` +
      `Before me:\n\n` +
      `________________________________\n` +
      `A Commissioner for Oaths /\n` +
      `Practising Solicitor`
    );
  }
}

module.exports = NorthernIrelandAffidavitTemplate;
