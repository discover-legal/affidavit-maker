// templates/states/new_south_wales/AffidavitTemplate.js
// New South Wales affidavit template — legally compliant with Oaths Act 1900 (NSW)
// Governing Law: Family Law Act 1975 (Cth); Oaths Act 1900 (NSW)

'use strict';

const BaseAffidavitTemplate = require('../../core/BaseAffidavitTemplate');

/**
 * New South Wales Affidavit Template
 *
 * Key compliance notes:
 * - Sworn before a Justice of the Peace, Solicitor, or Commissioner for Oaths
 * - Uses "State of New South Wales" (Australia uses "State" for its states)
 * - Court is Federal Circuit and Family Court of Australia (FCFCOA)
 * - A4 paper size
 * - No perjury statement — the oath/affirmation provides the solemn undertaking
 * - Parties are "Applicant" and "Respondent"
 *
 * @class NewSouthWalesAffidavitTemplate
 * @extends BaseAffidavitTemplate
 */
class NewSouthWalesAffidavitTemplate extends BaseAffidavitTemplate {
  constructor() {
    super();

    this.metadata = require('./metadata.json');
    this.state = this.metadata.stateCode;       // "NSW"
    this.stateName = this.metadata.stateName;   // "New South Wales"
    this.countryCode = 'AU';
    this.requiredFields = this.metadata.requiredFields;

    this.sections.perjuryStatement = false;

    this.formatting = {
      fontSize: '12pt',
      fontFamily: 'Times New Roman',
      lineHeight: '1.5',
      margin: '2.54cm',
      paperSize: 'A4'
    };
  }

  /**
   * NSW header uses state designation.
   */
  generateHeader() {
    return 'STATE OF NEW SOUTH WALES';
  }

  /**
   * NSW venue — city or registry location.
   */
  generateVenue(county) {
    const location = (county || '[CITY/LOCALITY]').toUpperCase();
    return `AT ${location}`;
  }

  /**
   * NSW case caption for FCFCOA proceedings.
   */
  generateCaseCaption(affidavitData) {
    const court = affidavitData.court || affidavitData.courtName || 'FEDERAL CIRCUIT AND FAMILY COURT OF AUSTRALIA';
    const location = (affidavitData.county || affidavitData.city || '[LOCATION]').toUpperCase();
    const fileNo = affidavitData.caseNumber || '[FILE NUMBER]';
    const applicant = affidavitData.plaintiff || affidavitData.petitionerName || '[APPLICANT NAME]';
    const respondent = affidavitData.defendant || affidavitData.respondentName || '[RESPONDENT NAME]';

    const formatted =
      `${court.toUpperCase()}\n` +
      `REGISTRY: ${location}\n\n` +
      `File Number: ${fileNo}\n\n` +
      `${applicant.toUpperCase()}\n` +
      `Applicant\n\n` +
      `— and —\n\n` +
      `${respondent.toUpperCase()}\n` +
      `Respondent`;

    return {
      courtName: court,
      caseNumber: affidavitData.caseNumber,
      plaintiff: applicant,
      defendant: respondent,
      formatted
    };
  }

  /**
   * NSW-specific validation:
   * - City/locality is required
   */
  performStateSpecificValidation(affidavitData) {
    const errors = [];
    const warnings = [];

    if (!affidavitData.county && !affidavitData.city) {
      errors.push('City or locality is required for New South Wales affidavits.');
    }

    return { errors, warnings };
  }

  /**
   * NSW jurat block — sworn before a JP, solicitor, or commissioner for oaths.
   * Compliant with Oaths Act 1900 (NSW).
   */
  generateNotaryBlock(affidavitData) {
    const city = affidavitData.county || affidavitData.city || '_______________';
    return (
      `Sworn/Affirmed at ${city},\n` +
      `in the State of New South Wales,\n` +
      `on the _____ day of _________________, _______.\n\n` +
      `Before me:\n\n` +
      `________________________________\n` +
      `[Name]\n` +
      `Justice of the Peace / Solicitor / Commissioner for Oaths`
    );
  }
}

module.exports = NewSouthWalesAffidavitTemplate;
