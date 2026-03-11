// templates/states/new_brunswick/AffidavitTemplate.js
// New Brunswick affidavit template — legally compliant with the Evidence Act, SNB 2016
// Governing Law: Evidence Act, SNB 2016, c. 19 (replaced SNB 1971, c. E-11);
//                Commissioners Taking Affidavits Act, RSNB 1973, c. C-6.1

'use strict';

const BaseAffidavitTemplate = require('../../core/BaseAffidavitTemplate');

/**
 * New Brunswick Affidavit Template
 *
 * Key compliance notes:
 * - Sworn before a Commissioner for Taking Affidavits (or Notary Public) in New Brunswick
 * - Uses "Province of New Brunswick" not "State of"
 * - New Brunswick is officially bilingual (English and French) but templates are in English
 * - Court of King's Bench of New Brunswick (rebranded from Court of Queen's Bench
 *   in September 2022 upon accession of King Charles III)
 * - Court File No. instead of Case No.
 * - No perjury statement required (oath provides the solemn affirmation)
 * - Divorce proceedings use "Petitioner" / "Respondent"
 *
 * @class NewBrunswickAffidavitTemplate
 * @extends BaseAffidavitTemplate
 */
class NewBrunswickAffidavitTemplate extends BaseAffidavitTemplate {
  constructor() {
    super();

    this.metadata = require('./metadata.json');
    this.state = this.metadata.stateCode;       // "NB"
    this.stateName = this.metadata.stateName;   // "New Brunswick"
    this.countryCode = 'CA';
    this.requiredFields = this.metadata.requiredFields;

    this.sections.perjuryStatement = false;
  }

  /**
   * New Brunswick header uses province designation.
   */
  generateHeader() {
    return 'PROVINCE OF NEW BRUNSWICK';
  }

  /**
   * New Brunswick venue — judicial district of filing.
   * NB Court of King's Bench is organized by judicial district (Saint John,
   * Fredericton, Moncton, Woodstock, etc.), not by county.
   */
  generateVenue(county) {
    const location = (county || '[JUDICIAL DISTRICT]').toUpperCase();
    return `JUDICIAL DISTRICT OF ${location}`;
  }

  /**
   * New Brunswick case caption.
   * Court of King's Bench of New Brunswick uses "Court File No."
   * Judicial districts: Saint John, Fredericton, Moncton, Woodstock, etc.
   */
  generateCaseCaption(affidavitData) {
    const court = affidavitData.court || affidavitData.courtName || 'COURT OF KING\'S BENCH OF NEW BRUNSWICK';
    const location = (affidavitData.county || affidavitData.city || '[JUDICIAL DISTRICT]').toUpperCase();
    const fileNo = affidavitData.caseNumber || '[FILE NUMBER]';
    const petitioner = affidavitData.plaintiff || affidavitData.petitionerName || '[PETITIONER NAME]';
    const respondent = affidavitData.defendant || affidavitData.respondentName || '[RESPONDENT NAME]';

    const formatted =
      `${court.toUpperCase()}\n` +
      `JUDICIAL DISTRICT OF ${location}\n\n` +
      `Court File No. ${fileNo}\n\n` +
      `${petitioner.toUpperCase()}\n` +
      `Petitioner\n\n` +
      `— and —\n\n` +
      `${respondent.toUpperCase()}\n` +
      `Respondent`;

    return {
      courtName: `Court of King's Bench of New Brunswick — Judicial District of ${location}`,
      caseNumber: affidavitData.caseNumber,
      plaintiff: petitioner,
      defendant: respondent,
      formatted
    };
  }

  /**
   * New Brunswick-specific validation:
   * - county or judicial district is required
   */
  performStateSpecificValidation(affidavitData) {
    const errors = [];
    const warnings = [];

    if (!affidavitData.county && !affidavitData.city) {
      errors.push('County or judicial district is required for New Brunswick Court of King\'s Bench filings.');
    }

    return { errors, warnings };
  }

  /**
   * New Brunswick jurat block — sworn before a Commissioner for Taking Affidavits.
   * Authority: Commissioners Taking Affidavits Act, RSNB 1973, c. C-6.1;
   *            Evidence Act, SNB 2016, c. 19
   */
  generateNotaryBlock(affidavitData) {
    const location = affidavitData.county || affidavitData.city || '_______________';
    return (
      `SWORN before me at ${location},\n` +
      `in the Province of New Brunswick,\n` +
      `this _____ day of _________________, _______.\n\n` +
      `________________________________\n` +
      `A Commissioner for Taking Affidavits\n` +
      `in and for the Province of New Brunswick`
    );
  }
}

module.exports = NewBrunswickAffidavitTemplate;
