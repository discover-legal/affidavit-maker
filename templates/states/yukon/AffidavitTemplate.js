// templates/states/yukon/AffidavitTemplate.js
// Yukon affidavit template — legally compliant with Yukon Evidence Act
// Governing Law: Yukon Evidence Act, RSY 2002, c. 78; Canada Evidence Act, RSC 1985, c. C-5

'use strict';

const BaseAffidavitTemplate = require('../../core/BaseAffidavitTemplate');

/**
 * Yukon Affidavit Template
 *
 * Key compliance notes:
 * - Sworn before a Notary Public or Commissioner for Oaths in Yukon
 * - Uses "YUKON" header (territory — not "Province of")
 * - Yukon does not have counties — venue is territory-wide
 * - Supreme Court of Yukon (seated in Whitehorse — only location)
 * - S.C. NO. (Supreme Court Number) instead of Case No.
 * - No perjury statement required (oath provides the solemn affirmation)
 * - Perjury is an offence under Criminal Code, RSC 1985, c. C-46, s.131
 * - Yukon Supreme Court Rule 63 governs divorce proceedings
 * - Divorce proceedings use "Petitioner" / "Respondent"
 *
 * @class YukonAffidavitTemplate
 * @extends BaseAffidavitTemplate
 */
class YukonAffidavitTemplate extends BaseAffidavitTemplate {
  constructor() {
    super();

    this.metadata = require('./metadata.json');
    this.state = this.metadata.stateCode;       // "YT"
    this.stateName = this.metadata.stateName;   // "Yukon"
    this.countryCode = 'CA';
    this.requiredFields = this.metadata.requiredFields;

    this.sections.perjuryStatement = false;
  }

  /**
   * Yukon header — territory designation.
   */
  generateHeader() {
    return 'YUKON';
  }

  /**
   * Yukon venue — no counties. The Supreme Court sits in Whitehorse.
   * The county field may contain a community name but is not required.
   */
  generateVenue(county) {
    if (county) {
      return `AT ${county.toUpperCase()}`;
    }
    return 'AT WHITEHORSE';
  }

  /**
   * Yukon case caption.
   * Supreme Court of Yukon uses "S.C. NO." and the
   * Petitioner/Respondent party labels.
   */
  generateCaseCaption(affidavitData) {
    const court = affidavitData.court || affidavitData.courtName || 'SUPREME COURT OF YUKON';
    const fileNo = affidavitData.caseNumber || '[FILE NUMBER]';
    const petitioner = affidavitData.plaintiff || affidavitData.petitionerName || '[PETITIONER NAME]';
    const respondent = affidavitData.defendant || affidavitData.respondentName || '[RESPONDENT NAME]';

    const formatted =
      `${court.toUpperCase()}\n\n` +
      `S.C. NO. ${fileNo}\n\n` +
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
   * Yukon-specific validation:
   * - No county requirement (Yukon has no counties)
   */
  performStateSpecificValidation(affidavitData) {
    const errors = [];
    const warnings = [];

    // Yukon has no counties — no county validation needed
    if (!affidavitData.county && !affidavitData.city) {
      warnings.push('No community specified. Defaulting to Whitehorse for the Supreme Court of Yukon.');
    }

    return { errors, warnings };
  }

  /**
   * Yukon jurat block — sworn before a Notary Public or Commissioner for Oaths.
   * Authority: Yukon Evidence Act, RSY 2002, c. 78
   */
  generateNotaryBlock(affidavitData) {
    const community = affidavitData.county || affidavitData.city || '_______________';
    return (
      `SWORN before me at ${community},\n` +
      `in the Yukon Territory,\n` +
      `this _____ day of _________________, _______.\n\n` +
      `________________________________\n` +
      `A Notary Public / Commissioner for Oaths\n` +
      `in and for the Yukon Territory`
    );
  }
}

module.exports = YukonAffidavitTemplate;
