// templates/states/south_africa/AffidavitTemplate.js
// South Africa affidavit template — legally compliant with SA law
// Governing Law: Justices of the Peace and Commissioners of Oaths Act 16 of 1963

'use strict';

const BaseAffidavitTemplate = require('../../core/BaseAffidavitTemplate');

/**
 * South Africa Affidavit Template
 *
 * Key compliance notes:
 * - Sworn before a Commissioner of Oaths under the Justices of the Peace
 *   and Commissioners of Oaths Act 16 of 1963
 * - Uses "Republic of South Africa" header
 * - County field maps to the city/town where the affidavit is deposed
 * - Case No. label (not "Court File No." or "Cause No.")
 * - No perjury statement — the oath itself provides the solemn obligation
 * - Commissioner of Oaths must state full names, designation, and area
 * - A4 paper size
 * - Parties in divorce proceedings are "Plaintiff" and "Defendant"
 *
 * @class SouthAfricaAffidavitTemplate
 * @extends BaseAffidavitTemplate
 */
class SouthAfricaAffidavitTemplate extends BaseAffidavitTemplate {
  constructor() {
    super();

    this.metadata = require('./metadata.json');
    this.state = this.metadata.stateCode;       // "ZA"
    this.stateName = this.metadata.stateName;   // "South Africa"
    this.countryCode = 'ZA';
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
   * South Africa header uses republic designation.
   */
  generateHeader() {
    return 'IN THE HIGH COURT OF SOUTH AFRICA';
  }

  /**
   * South Africa venue — division of the High Court (e.g. Gauteng Division, Pretoria).
   */
  generateVenue(county) {
    const location = (county || '[DIVISION]').toUpperCase();
    return `(${location})`;
  }

  /**
   * South Africa case caption.
   * High Court uses "Case No." and the division location.
   * Parties are "Plaintiff" and "Defendant" in divorce actions.
   */
  generateCaseCaption(affidavitData) {
    const court = affidavitData.court || affidavitData.courtName || 'HIGH COURT OF SOUTH AFRICA';
    const division = (affidavitData.county || affidavitData.city || '[DIVISION]').toUpperCase();
    const caseNo = affidavitData.caseNumber || '[CASE NUMBER]';
    const plaintiff = affidavitData.plaintiff || affidavitData.petitionerName || '[PLAINTIFF NAME]';
    const defendant = affidavitData.defendant || affidavitData.respondentName || '[DEFENDANT NAME]';

    const formatted =
      `IN THE ${court.toUpperCase()}\n` +
      `(${division})\n\n` +
      `Case No. ${caseNo}\n\n` +
      `In the matter between:\n\n` +
      `${plaintiff.toUpperCase()}\n` +
      `Plaintiff\n\n` +
      `and\n\n` +
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
   * South Africa-specific validation:
   * - city/town is required (maps to county field for the Commissioner of Oaths location)
   */
  performStateSpecificValidation(affidavitData) {
    const errors = [];
    const warnings = [];

    if (!affidavitData.county && !affidavitData.city) {
      errors.push('City or town is required for South African affidavits (location where the affidavit is deposed).');
    }

    return { errors, warnings };
  }

  /**
   * South Africa jurat block — sworn before a Commissioner of Oaths.
   * Justices of the Peace and Commissioners of Oaths Act 16 of 1963.
   * The Commissioner must state full names, designation, and area.
   */
  generateNotaryBlock(affidavitData) {
    const location = affidavitData.county || affidavitData.city || '_______________';
    return (
      `I certify that the deponent has acknowledged that he/she knows and understands\n` +
      `the contents of this affidavit, that it is true and correct to the best of his/her\n` +
      `knowledge and belief, and that the deponent has no objection to taking the prescribed\n` +
      `oath and considers the oath to be binding on his/her conscience.\n\n` +
      `Sworn to and signed before me at ${location}\n` +
      `on this _____ day of _________________, _______.\n\n` +
      `________________________________\n` +
      `Commissioner of Oaths\n` +
      `Full Names: ____________________\n` +
      `Designation: ___________________\n` +
      `Area: _________________________`
    );
  }
}

module.exports = SouthAfricaAffidavitTemplate;
