// templates/states/hong_kong/AffidavitTemplate.js
// Hong Kong affidavit template — legally compliant with Evidence Ordinance (Cap 8)
// and Oaths and Declarations Ordinance (Cap 11)

'use strict';

const BaseAffidavitTemplate = require('../../core/BaseAffidavitTemplate');

/**
 * Hong Kong Affidavit Template
 *
 * Key compliance notes:
 * - Sworn before a Commissioner for Oaths, Solicitor, or Notary Public
 * - Uses A4 paper size (210mm x 297mm)
 * - Court designation is "Family Court" (District Court level) or "Court of First Instance"
 * - Parties in divorce are "Petitioner" and "Respondent" (HK retains traditional terminology)
 * - Affidavits governed by Evidence Ordinance (Cap 8) and Oaths and Declarations Ordinance (Cap 11)
 * - No perjury statement required — the oath/affirmation provides the solemn obligation
 * - Currency is HKD
 *
 * @class HongKongAffidavitTemplate
 * @extends BaseAffidavitTemplate
 */
class HongKongAffidavitTemplate extends BaseAffidavitTemplate {
  constructor() {
    super();

    this.metadata = require('./metadata.json');
    this.state = this.metadata.stateCode;       // "HK"
    this.stateName = this.metadata.stateName;   // "Hong Kong"
    this.countryCode = 'HK';
    this.requiredFields = this.metadata.requiredFields;

    this.sections.perjuryStatement = false;

    this.formatting = {
      fontSize: '12pt',
      fontFamily: 'Times New Roman',
      lineHeight: '1.5',
      margin: '1in',
      paperSize: 'A4'
    };
  }

  /**
   * Hong Kong header — uses jurisdiction designation.
   */
  generateHeader() {
    return 'IN THE FAMILY COURT OF THE\nHONG KONG SPECIAL ADMINISTRATIVE REGION';
  }

  /**
   * Hong Kong venue — district of filing.
   */
  generateVenue(county) {
    const location = (county || 'HONG KONG').toUpperCase();
    return `AT ${location}`;
  }

  /**
   * Hong Kong case caption.
   * Family Court uses "Case No." and the Petitioner/Respondent designation.
   */
  generateCaseCaption(affidavitData) {
    const court = affidavitData.court || affidavitData.courtName || 'FAMILY COURT';
    const location = (affidavitData.county || affidavitData.city || 'HONG KONG').toUpperCase();
    const caseNo = affidavitData.caseNumber || '[CASE NUMBER]';
    const petitioner = affidavitData.plaintiff || affidavitData.petitionerName || '[PETITIONER NAME]';
    const respondent = affidavitData.defendant || affidavitData.respondentName || '[RESPONDENT NAME]';

    const formatted =
      `IN THE ${court.toUpperCase()}\n` +
      `OF THE HONG KONG SPECIAL ADMINISTRATIVE REGION\n` +
      `${location}\n\n` +
      `Case No. ${caseNo}\n\n` +
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
   * Hong Kong-specific validation:
   * - District or location is recommended for filing purposes.
   */
  performStateSpecificValidation(affidavitData) {
    const errors = [];
    const warnings = [];

    if (!affidavitData.county && !affidavitData.city) {
      warnings.push('District or location is recommended for Hong Kong affidavits.');
    }

    return { errors, warnings };
  }

  /**
   * Hong Kong jurat block — sworn before a Commissioner for Oaths, Solicitor,
   * or Notary Public under the Oaths and Declarations Ordinance (Cap 11).
   */
  generateNotaryBlock(affidavitData) {
    const location = affidavitData.county || affidavitData.city || 'Hong Kong';
    return (
      `Sworn at ${location} this _____ day of _________________, _______.\n\n` +
      `Before me:\n\n` +
      `________________________________\n` +
      `A Commissioner for Oaths / Solicitor / Notary Public`
    );
  }
}

module.exports = HongKongAffidavitTemplate;
