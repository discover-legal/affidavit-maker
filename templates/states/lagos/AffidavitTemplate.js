// templates/states/lagos/AffidavitTemplate.js
// Lagos State affidavit template — legally compliant with Nigerian Oaths Act
// Governing Law: Oaths Act, Cap O1 LFN 2004; Evidence Act 2011

'use strict';

const BaseAffidavitTemplate = require('../../core/BaseAffidavitTemplate');

/**
 * Lagos State Affidavit Template
 *
 * Key compliance notes:
 * - Sworn before a Commissioner for Oaths (Oaths Act, Cap O1 LFN 2004)
 * - Uses "Lagos State" header
 * - County field maps to local government area or judicial division
 * - Suit No. instead of Case No.
 * - No perjury statement — the oath provides the solemn affirmation
 * - A4 paper size
 *
 * @class LagosAffidavitTemplate
 * @extends BaseAffidavitTemplate
 */
class LagosAffidavitTemplate extends BaseAffidavitTemplate {
  constructor() {
    super();

    this.metadata = require('./metadata.json');
    this.state = this.metadata.stateCode;       // "LA_NG"
    this.stateName = this.metadata.stateName;   // "Lagos"
    this.countryCode = 'NG';
    this.requiredFields = this.metadata.requiredFields;

    this.sections.perjuryStatement = false;
  }

  /**
   * Lagos header uses state designation.
   */
  generateHeader() {
    return 'IN THE HIGH COURT OF LAGOS STATE';
  }

  /**
   * Lagos venue — judicial division of filing.
   */
  generateVenue(county) {
    const location = (county || '[JUDICIAL DIVISION]').toUpperCase();
    return `${location} JUDICIAL DIVISION`;
  }

  /**
   * Lagos case caption.
   * High Court of Lagos State uses "Suit No." and the judicial division.
   */
  generateCaseCaption(affidavitData) {
    const court = affidavitData.court || affidavitData.courtName || 'HIGH COURT OF LAGOS STATE';
    const location = (affidavitData.county || affidavitData.city || '[JUDICIAL DIVISION]').toUpperCase();
    const suitNo = affidavitData.caseNumber || '[SUIT NUMBER]';
    const petitioner = affidavitData.plaintiff || affidavitData.petitionerName || '[PETITIONER NAME]';
    const respondent = affidavitData.defendant || affidavitData.respondentName || '[RESPONDENT NAME]';

    const formatted =
      `IN THE ${court.toUpperCase()}\n` +
      `${location} JUDICIAL DIVISION\n\n` +
      `Suit No. ${suitNo}\n\n` +
      `${petitioner.toUpperCase()}\n` +
      `Petitioner\n\n` +
      `— AND —\n\n` +
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
   * Lagos-specific validation:
   * - judicial division or LGA is required
   */
  performStateSpecificValidation(affidavitData) {
    const errors = [];
    const warnings = [];

    if (!affidavitData.county && !affidavitData.city) {
      errors.push('Judicial division or local government area is required for Lagos affidavits.');
    }

    return { errors, warnings };
  }

  /**
   * Lagos jurat block — sworn before a Commissioner for Oaths.
   */
  generateNotaryBlock(affidavitData) {
    const location = affidavitData.county || affidavitData.city || '_______________';
    return (
      `Sworn to at the ${location} Registry\n` +
      `this _____ day of _________________, _______\n\n` +
      `Before me:\n` +
      `________________________________\n` +
      `Commissioner for Oaths`
    );
  }
}

module.exports = LagosAffidavitTemplate;
