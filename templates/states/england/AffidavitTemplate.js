// templates/states/england/AffidavitTemplate.js
// England & Wales statement of truth template
// Governing Law: Civil Procedure Rules, Part 22; Family Procedure Rules 2010

'use strict';

const BaseAffidavitTemplate = require('../../core/BaseAffidavitTemplate');

/**
 * England & Wales Affidavit Template
 *
 * Key compliance notes:
 * - England & Wales primarily uses "Statements of Truth" (CPR Part 22)
 *   rather than sworn affidavits in most civil and family proceedings
 * - A4 paper size
 * - Uses "England & Wales" not "State of"
 * - County field maps to court location / local authority area
 * - Case No. instead of Case No.
 * - Family Court is the default for most family proceedings
 * - Parties are "Applicant" / "Respondent" (since April 2022)
 *
 * @class EnglandAffidavitTemplate
 * @extends BaseAffidavitTemplate
 */
class EnglandAffidavitTemplate extends BaseAffidavitTemplate {
  constructor() {
    super();

    this.metadata = require('./metadata.json');
    this.state = this.metadata.stateCode;       // "ENG"
    this.stateName = this.metadata.stateName;   // "England & Wales"
    this.countryCode = 'UK';

    // England & Wales terminology (see templates/core/terminology.js): the caption
    // is the court-name line ("In the Family Court at X"); parties are
    // Applicant/Respondent (post-April 2022, DDSA 2020); self-represented parties
    // are "Litigants in Person". No "STATE OF"/"COUNTY OF" lines, no "X County".
    this.terminology = {
      ...this.terminology,
      jurisdictionLabel: null,
      districtLabel: null,
      districtStyle: 'plain',
      jurisdictionTerm: 'Jurisdiction',
      districtTerm: 'Court location',
      districtPlaceholder: '[COURT LOCATION]',
      filerLabel: 'Applicant',
      responderLabel: 'Respondent',
      selfRepresentedLabel: 'Litigant in Person',
    };
    this.requiredFields = this.metadata.requiredFields;

    // England uses Statement of Truth, not sworn affidavits
    this.sections.perjuryStatement = false;
  }

  /**
   * England header uses jurisdiction designation.
   */
  generateHeader() {
    return 'IN ENGLAND AND WALES';
  }

  /**
   * England venue — court location.
   */
  generateVenue(county) {
    const location = (county || '[COURT LOCATION]').toUpperCase();
    return `IN THE FAMILY COURT AT ${location}`;
  }

  /**
   * England case caption.
   * Family Court uses "Case No." and the sitting location.
   */
  generateCaseCaption(affidavitData) {
    const court = affidavitData.court || affidavitData.courtName || 'FAMILY COURT';
    const location = (affidavitData.county || affidavitData.city || '[LOCATION]').toUpperCase();
    const caseNo = affidavitData.caseNumber || '[CASE NUMBER]';
    const applicant = affidavitData.plaintiff || affidavitData.petitionerName || '[APPLICANT NAME]';
    const respondent = affidavitData.defendant || affidavitData.respondentName || '[RESPONDENT NAME]';

    const formatted =
      `IN THE ${court.toUpperCase()} AT ${location}\n\n` +
      `Case No. ${caseNo}\n\n` +
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
   * England-specific validation:
   * - Court location is required
   */
  performStateSpecificValidation(affidavitData) {
    const errors = [];
    const warnings = [];

    if (!affidavitData.county && !affidavitData.city) {
      errors.push('Court location is required for England & Wales statements.');
    }

    return { errors, warnings };
  }

  /**
   * England uses a Statement of Truth (CPR Part 22) instead of a sworn jurat.
   * Making a false statement in a document verified by a statement of truth
   * may result in proceedings for contempt of court.
   */
  generateNotaryBlock(affidavitData) {
    const name = affidavitData.affiantName || affidavitData.petitionerName || '_______________';
    return (
      'STATEMENT OF TRUTH\n\n' +
      'I believe that the facts stated in this document are true.\n' +
      'I understand that proceedings for contempt of court may be brought\n' +
      'against anyone who makes, or causes to be made, a false statement\n' +
      'in a document verified by a statement of truth without an honest\n' +
      'belief in its truth.\n\n' +
      `Signed: ________________________________\n` +
      `Full name: ${name}\n` +
      `Dated: _______________`
    );
  }
}

module.exports = EnglandAffidavitTemplate;
