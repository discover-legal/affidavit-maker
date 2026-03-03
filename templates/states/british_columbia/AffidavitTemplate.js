// templates/states/british_columbia/AffidavitTemplate.js
// British Columbia affidavit template — legally compliant with BC Evidence Act
// Governing Law: Evidence Act, RSBC 1996, c. 124; BC Supreme Court Family Rules, BC Reg. 169/2009

'use strict';

const BaseAffidavitTemplate = require('../../core/BaseAffidavitTemplate');

/**
 * British Columbia Affidavit Template
 *
 * Key compliance notes:
 * - Sworn before a Commissioner for Taking Oaths or Notary Public in BC
 * - Uses "Province of British Columbia" not "State of"
 * - Supreme Court uses registry names (Vancouver, Victoria, Kelowna, etc.)
 * - Court File No. instead of Case No.
 * - Family proceedings use "Claimant" / "Respondent" (BC Supreme Court Family Rules)
 * - BC Form F30 is the standard Affidavit — body starts with "I, [name], of [address], [occupation]"
 *
 * @class BCAfidavitTemplate
 * @extends BaseAffidavitTemplate
 */
class BCAffidavitTemplate extends BaseAffidavitTemplate {
  constructor() {
    super();

    this.metadata = require('./metadata.json');
    this.state = this.metadata.stateCode;       // "BC"
    this.stateName = this.metadata.stateName;   // "British Columbia"
    this.countryCode = 'CA';
    this.requiredFields = this.metadata.requiredFields;

    this.sections.perjuryStatement = false;
  }

  /**
   * BC case caption.
   * Supreme Court of BC uses registry location and "Court File No."
   */
  generateCaseCaption(affidavitData) {
    const registry = (affidavitData.county || affidavitData.city || '[REGISTRY]').toUpperCase();
    const fileNo = affidavitData.caseNumber || '[FILE NUMBER]';
    const claimant = affidavitData.plaintiff || affidavitData.petitionerName || '[CLAIMANT NAME]';
    const respondent = affidavitData.defendant || affidavitData.respondentName || '[RESPONDENT NAME]';

    const formatted =
      `SUPREME COURT OF BRITISH COLUMBIA\n` +
      `${registry} REGISTRY\n\n` +
      `Court File No. ${fileNo}\n\n` +
      `BETWEEN:\n\n` +
      `${claimant.toUpperCase()}\n` +
      `Claimant\n\n` +
      `AND:\n\n` +
      `${respondent.toUpperCase()}\n` +
      `Respondent`;

    return {
      courtName: `Supreme Court of British Columbia — ${registry} Registry`,
      caseNumber: affidavitData.caseNumber,
      plaintiff: claimant,
      defendant: respondent,
      formatted
    };
  }

  performStateSpecificValidation(affidavitData) {
    const errors = [];
    const warnings = [];

    if (!affidavitData.county && !affidavitData.city) {
      errors.push('Registry location (city) is required for BC Supreme Court filings.');
    }

    return { errors, warnings };
  }

  /**
   * BC jurat — sworn before Commissioner for Taking Oaths or Notary Public.
   */
  generateNotaryBlock(affidavitData) {
    const city = affidavitData.county || affidavitData.city || '_______________';
    return (
      `SWORN (or AFFIRMED) before me at the City/Town of ${city},\n` +
      `in the Province of British Columbia,\n` +
      `this _____ day of _________________, _______.\n\n` +
      `________________________________\n` +
      `A Commissioner for Taking Oaths\n` +
      `in and for British Columbia`
    );
  }
}

module.exports = BCAffidavitTemplate;
