// templates/states/northern_ireland/DivorcePetitionTemplate.js
// Northern Ireland divorce petition template
// Governing Law: Matrimonial Causes (Northern Ireland) Order 1978

'use strict';

const BaseDivorcePetitionTemplate = require('../../core/BaseDivorcePetitionTemplate');

/**
 * Northern Ireland Divorce Petition Template
 *
 * Northern Ireland has NOT adopted no-fault divorce. The sole ground is
 * "irretrievable breakdown" but it must be proved by one of FIVE facts:
 *   (a) Adultery — Art.3(2)(a)
 *   (b) Unreasonable behaviour — Art.3(2)(b)
 *   (c) Desertion for 2 years — Art.3(2)(c)
 *   (d) 2-year separation with consent — Art.3(2)(d)
 *   (e) 5-year separation without consent — Art.3(2)(e)
 *
 * Key Legal References:
 * - Matrimonial Causes (Northern Ireland) Order 1978 (SI 1978/1045)
 * - Children (Northern Ireland) Order 1995
 * - Family Proceedings Rules (NI) 1996
 *
 * NI retains old terminology:
 * - "Petitioner" and "Respondent" (not Applicant)
 * - "Decree Nisi" and "Decree Absolute" (not Conditional Order / Final Order)
 * - "Ancillary relief" (not "financial remedy")
 *
 * Residency (MC(NI)O 1978, Art.49):
 * - Either party domiciled in NI, OR
 * - Either party habitually resident in NI for 1 year before petition
 *
 * Filing fee: approx. GBP £310 (per nidirect.gov.uk), plus £117 for Decree Absolute (Family Proceedings Fees Schedule, from 1 October 2024).
 * Paper size: A4
 *
 * @class NorthernIrelandDivorcePetitionTemplate
 * @extends BaseDivorcePetitionTemplate
 */
class NorthernIrelandDivorcePetitionTemplate extends BaseDivorcePetitionTemplate {
  constructor() {
    super();

    this.state = 'NIR';
    this.stateName = 'Northern Ireland';
    this.countryCode = 'UK';

    // Northern Ireland terminology (see templates/core/terminology.js): the caption
    // is the court-name line; parties remain Petitioner/Respondent (Matrimonial
    // Causes (NI) Order 1978 — NI did not adopt the 2022 E&W reforms);
    // self-represented parties are "Litigants in Person". No US caption furniture.
    this.terminology = {
      ...this.terminology,
      jurisdictionLabel: null,
      districtLabel: null,
      districtStyle: 'plain',
      jurisdictionTerm: 'Jurisdiction',
      districtTerm: 'Court location',
      districtPlaceholder: '[COURT LOCATION]',
      filerLabel: 'Petitioner',
      responderLabel: 'Respondent',
      selfRepresentedLabel: 'Litigant in Person',
    };
    this.documentTitle = 'PETITION FOR DIVORCE';

    try {
      this.metadata = require('./metadata.json');
    } catch (e) {
      this.metadata = null;
    }

    this.requiredFields = [
      'petitionerName',
      'respondentName',
      'state',
      'county',
      'marriageDate',
      'groundsForDivorce'
    ];

    // NI residency: domicile or 1-year habitual residence
    this.residencyRequirements = {
      stateMonths: 12,
      countyDays: 0,
      description: 'Either party must be domiciled in Northern Ireland, or have been habitually resident in Northern Ireland for at least one year immediately before the petition (Matrimonial Causes (NI) Order 1978, Art.49).'
    };

    // 6 weeks from Decree Nisi to Decree Absolute
    this.waitingPeriod = {
      days: 42,
      description: 'After the Decree Nisi is granted, there is a minimum 6-week (42-day) waiting period before the Petitioner may apply for the Decree Absolute.'
    };

    this.formatting = {
      fontSize: '12pt',
      fontFamily: 'Times New Roman',
      lineHeight: '1.5',
      margin: '2.54cm',
      paperSize: 'A4'
    };
  }

  getCaseNumberLabel() {
    return 'Ref. No.';
  }

  getDefaultCourt(county) {
    return 'HIGH COURT OF JUSTICE IN NORTHERN IRELAND (FAMILY DIVISION)';
  }

  /**
   * NI case caption uses "Petitioner" and "Respondent".
   */
  generateCaseCaption(divorceData) {
    const courtName = (divorceData.court || this.getDefaultCourt(divorceData.county) || '[COURT NAME]').toUpperCase();
    const caseLabel = this.getCaseNumberLabel();
    const caseNumber = divorceData.caseNumber || '[REFERENCE NUMBER]';

    const petitioner = (divorceData.petitionerName || '[PETITIONER NAME]').toUpperCase();
    const respondent = (divorceData.respondentName || '[RESPONDENT NAME]').toUpperCase();

    const caption = [
      `IN THE ${courtName}`,
      '',
      `${caseLabel} ${caseNumber}`,
      '',
      `IN THE MATTER OF A PETITION FOR DIVORCE`,
      `Matrimonial Causes (Northern Ireland) Order 1978`,
      '',
      `BETWEEN:`,
      '',
      `${petitioner}`,
      `Petitioner`,
      '',
      `AND`,
      '',
      `${respondent}`,
      `Respondent`
    ].join('\n');

    return {
      courtName,
      caseNumber: divorceData.caseNumber,
      petitioner: divorceData.petitionerName,
      respondent: divorceData.respondentName,
      formatted: caption
    };
  }

  /**
   * NI jurisdiction statement.
   */
  getJurisdictionStatement(divorceData) {
    return 'The Petitioner states that either the Petitioner or the Respondent is domiciled in Northern Ireland, or has been habitually resident in Northern Ireland for at least one year immediately preceding the date of this Petition, in accordance with Article 49 of the Matrimonial Causes (Northern Ireland) Order 1978.';
  }

  /**
   * NI venue reason.
   */
  getVenueReason(divorceData) {
    const location = divorceData.county || '[COURT LOCATION]';
    return `the Petitioner or Respondent resides within the jurisdiction of the court at ${location}`;
  }

  /**
   * NI relief section — "ancillary relief" under the 1978 Order.
   */
  generateReliefSection(divorceData) {
    const items = [];
    let paragraphNum = divorceData._paragraphNum || 15;

    items.push({
      number: null,
      content: 'THE PETITIONER PRAYS:',
      type: 'relief_intro'
    });

    const reliefItems = [
      'That the marriage be dissolved by decree of divorce pursuant to the Matrimonial Causes (Northern Ireland) Order 1978;'
    ];

    if (divorceData.requestAncillaryRelief !== false) {
      reliefItems.push('That the court make such order for ancillary relief as it considers just, including orders for periodical payments and/or lump sum (Article 25), property adjustment (Article 26), and/or pension sharing (Article 26A) under the Matrimonial Causes (Northern Ireland) Order 1978, having regard to the matters set out in Article 27;');
    }

    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      reliefItems.push('That the court make such orders as it considers appropriate for the welfare of the children of the family, including residence and contact orders pursuant to Article 8 of the Children (Northern Ireland) Order 1995;');
      reliefItems.push('That the court make such orders for child maintenance as are just, in accordance with the Child Maintenance Service guidelines;');
    }

    if (divorceData.spousalSupportRequested || divorceData.requestSpousalSupport) {
      reliefItems.push('That the court make an order for periodical payments (maintenance) in favour of the Petitioner pursuant to Article 25 of the Matrimonial Causes (Northern Ireland) Order 1978;');
    }

    reliefItems.push('That the Respondent pay the costs of this suit;');
    reliefItems.push('Such further or other relief as the court considers just.');

    reliefItems.forEach((relief, index) => {
      const number = index + 1;
      items.push({
        number: null,
        content: relief,
        type: 'relief_item',
        style: 'number',
        letter: String(number)
      });
    });

    return {
      title: 'PRAYER',
      items,
      nextParagraphNumber: paragraphNum
    };
  }

  /**
   * NI verification — sworn affidavit supporting the petition.
   */
  getVerificationText(divorceData) {
    const name = divorceData.petitionerName || '[PETITIONER NAME]';
    return `I, ${name}, the Petitioner, make oath and say that the facts stated in this Petition are true, to the best of my knowledge, information, and belief.`;
  }

  /**
   * NI grounds for divorce — five facts.
   * NI still requires proof of one of five facts under the 1978 Order.
   */
  getGroundsText(groundsForDivorce) {
    const g = (groundsForDivorce || 'separation_2yr_consent').toLowerCase();
    if (g.includes('adultery')) {
      return 'The marriage has broken down irretrievably in that, since the date of the marriage, the Respondent has committed adultery, within the meaning of Article 3(2)(a) of the Matrimonial Causes (Northern Ireland) Order 1978.';
    }
    if (g.includes('behaviour') || g.includes('unreasonable')) {
      return 'The marriage has broken down irretrievably in that the Respondent has behaved in such a way that the Petitioner cannot reasonably be expected to live with the Respondent, within the meaning of Article 3(2)(b) of the Matrimonial Causes (Northern Ireland) Order 1978.';
    }
    if (g.includes('desertion')) {
      return 'The marriage has broken down irretrievably in that the Respondent has deserted the Petitioner for a continuous period of at least two years immediately preceding the presentation of this Petition, within the meaning of Article 3(2)(c) of the Matrimonial Causes (Northern Ireland) Order 1978.';
    }
    if (g.includes('5') || g.includes('five') || g.includes('without_consent') || g.includes('no_consent')) {
      return 'The marriage has broken down irretrievably in that the parties to the marriage have lived apart for a continuous period of at least five years immediately preceding the presentation of this Petition, within the meaning of Article 3(2)(e) of the Matrimonial Causes (Northern Ireland) Order 1978.';
    }
    // Default: 2-year separation with consent
    return 'The marriage has broken down irretrievably in that the parties to the marriage have lived apart for a continuous period of at least two years immediately preceding the presentation of this Petition and the Respondent consents to a decree being granted, within the meaning of Article 3(2)(d) of the Matrimonial Causes (Northern Ireland) Order 1978.';
  }
}

module.exports = NorthernIrelandDivorcePetitionTemplate;
