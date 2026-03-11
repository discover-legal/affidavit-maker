// templates/states/nunavut/AffidavitTemplate.js
// Nunavut affidavit template — legally compliant with Nunavut Evidence Act
// Governing Law: Nunavut Evidence Act; Canada Evidence Act, RSC 1985, c. C-5

'use strict';

const BaseAffidavitTemplate = require('../../core/BaseAffidavitTemplate');

/**
 * Nunavut Affidavit Template
 *
 * Key compliance notes:
 * - Sworn before a Notary Public, Commissioner for Oaths, or Justice of the Peace in Nunavut
 * - Uses "NUNAVUT" header (territory — not "Province of")
 * - Nunavut does not have counties — communities are the geographic units
 * - Nunavut Court of Justice — unique single-level trial court (the only one in Canada),
 *   combining superior court and territorial court jurisdiction
 * - FILE NO. instead of Case No.
 * - No perjury statement required (oath provides the solemn affirmation)
 * - Perjury is an offence under Criminal Code, RSC 1985, c. C-46, s.131
 * - Divorce proceedings use "Applicant" / "Respondent"
 * - Justices of the Peace play a significant role in Nunavut communities
 *
 * @class NunavutAffidavitTemplate
 * @extends BaseAffidavitTemplate
 */
class NunavutAffidavitTemplate extends BaseAffidavitTemplate {
  constructor() {
    super();

    this.metadata = require('./metadata.json');
    this.state = this.metadata.stateCode;       // "NU"
    this.stateName = this.metadata.stateName;   // "Nunavut"
    this.countryCode = 'CA';
    this.requiredFields = this.metadata.requiredFields;

    this.sections.perjuryStatement = false;
  }

  /**
   * Nunavut header — territory designation.
   */
  generateHeader() {
    return 'NUNAVUT';
  }

  /**
   * Nunavut venue — no counties. The Nunavut Court of Justice circuit sits in
   * various communities. The county field may contain a community name.
   */
  generateVenue(county) {
    if (county) {
      return `AT ${county.toUpperCase()}`;
    }
    return 'AT IQALUIT';
  }

  /**
   * Nunavut case caption.
   * Nunavut Court of Justice uses "FILE NO." and the
   * Applicant/Respondent party labels.
   */
  generateCaseCaption(affidavitData) {
    const court = affidavitData.court || affidavitData.courtName || 'NUNAVUT COURT OF JUSTICE';
    const fileNo = affidavitData.caseNumber || '[FILE NUMBER]';
    const applicant = affidavitData.plaintiff || affidavitData.petitionerName || '[APPLICANT NAME]';
    const respondent = affidavitData.defendant || affidavitData.respondentName || '[RESPONDENT NAME]';

    const formatted =
      `${court.toUpperCase()}\n\n` +
      `FILE NO. ${fileNo}\n\n` +
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
   * Nunavut-specific validation:
   * - No county requirement (Nunavut has no counties — only communities)
   */
  performStateSpecificValidation(affidavitData) {
    const errors = [];
    const warnings = [];

    // Nunavut has no counties — no county validation needed
    if (!affidavitData.county && !affidavitData.city) {
      warnings.push('No community specified. Defaulting to Iqaluit for the Nunavut Court of Justice.');
    }

    return { errors, warnings };
  }

  /**
   * Nunavut jurat block — sworn before a Notary Public, Commissioner for Oaths,
   * or Justice of the Peace.
   * Authority: Nunavut Evidence Act; Justices of the Peace Act (Nunavut)
   */
  generateNotaryBlock(affidavitData) {
    const community = affidavitData.county || affidavitData.city || '_______________';
    return (
      `SWORN before me at ${community},\n` +
      `in Nunavut,\n` +
      `this _____ day of _________________, _______.\n\n` +
      `________________________________\n` +
      `A Notary Public / Commissioner for Oaths /\n` +
      `Justice of the Peace in and for Nunavut`
    );
  }
}

module.exports = NunavutAffidavitTemplate;
