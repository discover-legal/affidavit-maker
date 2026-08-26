// templates/states/scotland/AffidavitTemplate.js
// Scotland affidavit template — legally compliant with Scots law
// Governing Law: Requirements of Writing (Scotland) Act 1995; Ordinary Cause Rules, Chapter 33

'use strict';

const BaseAffidavitTemplate = require('../../core/BaseAffidavitTemplate');

/**
 * Scotland Affidavit Template
 *
 * Key compliance notes:
 * - Scotland still uses sworn affidavits (unlike England which uses Statements of Truth)
 * - Sworn before a Notary Public or Commissioner for Oaths
 * - A4 paper size
 * - Parties in divorce are "Pursuer" and "Defender" (NOT applicant/respondent)
 * - Court Ref. No. instead of Case No.
 * - Court is Sheriff Court for most cases, Court of Session for complex ones
 * - Exhibits are called "productions" and are numbered (not lettered)
 *
 * @class ScotlandAffidavitTemplate
 * @extends BaseAffidavitTemplate
 */
class ScotlandAffidavitTemplate extends BaseAffidavitTemplate {
  constructor() {
    super();

    this.metadata = require('./metadata.json');
    this.state = this.metadata.stateCode;       // "SCO"
    this.stateName = this.metadata.stateName;   // "Scotland"
    this.countryCode = 'UK';

    // Scottish terminology (see templates/core/terminology.js): the caption is the
    // court-name line (Sheriff Court / Court of Session); parties are
    // Pursuer/Defender (Divorce (Scotland) Act 1976); venue is the sheriffdom;
    // self-represented parties are "Party Litigants". No US caption furniture.
    this.terminology = {
      ...this.terminology,
      jurisdictionLabel: null,
      districtLabel: null,
      districtStyle: 'plain',
      jurisdictionTerm: 'Jurisdiction',
      districtTerm: 'Sheriffdom',
      districtPlaceholder: '[SHERIFFDOM]',
      filerLabel: 'Pursuer',
      responderLabel: 'Defender',
      selfRepresentedLabel: 'Party Litigant',
    };
    this.requiredFields = this.metadata.requiredFields;

    this.sections.perjuryStatement = false;
  }

  /**
   * Scotland header.
   */
  generateHeader() {
    return 'IN SCOTLAND';
  }

  /**
   * Scotland venue — Sheriff Court district.
   */
  generateVenue(county) {
    const location = (county || '[SHERIFFDOM/COURT LOCATION]').toUpperCase();
    return `AT ${location} SHERIFF COURT`;
  }

  /**
   * Scotland case caption.
   * Sheriff Court uses "Court Ref. No." and the sheriffdom.
   * Parties are "Pursuer" and "Defender".
   */
  generateCaseCaption(affidavitData) {
    const court = affidavitData.court || affidavitData.courtName || 'SHERIFF COURT';
    const location = (affidavitData.county || affidavitData.city || '[LOCATION]').toUpperCase();
    const refNo = affidavitData.caseNumber || '[COURT REF. NUMBER]';
    const pursuer = affidavitData.plaintiff || affidavitData.petitionerName || '[PURSUER NAME]';
    const defender = affidavitData.defendant || affidavitData.respondentName || '[DEFENDER NAME]';

    const formatted =
      `${court.toUpperCase()}\n` +
      `${location}\n\n` +
      `Court Ref. No. ${refNo}\n\n` +
      `${pursuer.toUpperCase()}\n` +
      `Pursuer\n\n` +
      `— against —\n\n` +
      `${defender.toUpperCase()}\n` +
      `Defender`;

    return {
      courtName: court,
      caseNumber: affidavitData.caseNumber,
      plaintiff: pursuer,
      defendant: defender,
      formatted
    };
  }

  /**
   * Scotland-specific validation:
   * - Court location / sheriffdom is required
   */
  performStateSpecificValidation(affidavitData) {
    const errors = [];
    const warnings = [];

    if (!affidavitData.county && !affidavitData.city) {
      errors.push('Court location (sheriffdom) is required for Scottish affidavits.');
    }

    return { errors, warnings };
  }

  /**
   * Scotland jurat block — sworn before a Notary Public.
   * Scotland still uses sworn oaths, not Statements of Truth.
   */
  generateNotaryBlock(affidavitData) {
    const location = affidavitData.county || affidavitData.city || '_______________';
    return (
      `SWORN at ${location}, Scotland,\n` +
      `this _____ day of _________________, _______.\n\n` +
      `Before me:\n\n` +
      `________________________________\n` +
      `Notary Public / Commissioner for Oaths\n` +
      `________________________________\n` +
      `[Name and designation]`
    );
  }
}

module.exports = ScotlandAffidavitTemplate;
