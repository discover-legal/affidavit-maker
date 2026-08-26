// templates/states/england/DivorcePetitionTemplate.js
// England & Wales divorce application template
// Governing Law: Divorce, Dissolution and Separation Act 2020; Matrimonial Causes Act 1973

'use strict';

const BaseDivorcePetitionTemplate = require('../../core/BaseDivorcePetitionTemplate');

/**
 * England & Wales Divorce Application Template
 *
 * Since 6 April 2022, the Divorce, Dissolution and Separation Act 2020 (DDSA 2020)
 * introduced no-fault divorce. The sole ground is "irretrievable breakdown" — the
 * applicant simply states that the marriage has irretrievably broken down.
 *
 * Key Legal References:
 * - MCA 1973, s.1(1) (as substituted by DDSA 2020, s.1): Sole ground — irretrievable breakdown
 * - MCA 1973, s.1(5) (as substituted): 20-week reflection period; s.1(4)(b): 6-week gap to Final Order
 * - Matrimonial Causes Act 1973, s.23-25A: Financial remedy orders
 * - Children Act 1989: Welfare of children, s.8 orders
 * - Family Procedure Rules 2010 (SI 2010/2955)
 *
 * Terminology (post-April 2022):
 * - "Applicant" (not "Petitioner") and "Respondent"
 * - "Conditional Order" (not "Decree Nisi")
 * - "Final Order" (not "Decree Absolute")
 * - Joint applications are available
 *
 * Residency Requirement (Domicile and Matrimonial Proceedings Act 1973, s.5(2)):
 * - Either party domiciled in England/Wales, OR
 * - Either party habitually resident for at least 1 year
 *
 * Filing fee: approx. GBP £628 (Help with Fees / HWF remission available; increased from £612 in July 2026)
 * Paper size: A4
 *
 * @class EnglandDivorcePetitionTemplate
 * @extends BaseDivorcePetitionTemplate
 */
class EnglandDivorcePetitionTemplate extends BaseDivorcePetitionTemplate {
  constructor() {
    super();

    this.state = 'ENG';
    this.stateName = 'England & Wales';
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
    this.documentTitle = 'APPLICATION FOR DIVORCE';

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

    // England residency: domicile or 1-year habitual residence
    this.residencyRequirements = {
      stateMonths: 12,
      countyDays: 0,
      description: 'Either party must be domiciled in England and Wales, or have been habitually resident for at least one year immediately before the application.'
    };

    // 20-week reflection period from application to Conditional Order
    this.waitingPeriod = {
      days: 140,
      description: '20-week reflection period from the date the application is issued to the Conditional Order. After the Conditional Order, a further 6-week gap before the Final Order.'
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
    return 'Case No.';
  }

  getDefaultCourt(county) {
    const location = (county || '[LOCATION]').toUpperCase();
    return `FAMILY COURT AT ${location}`;
  }

  /**
   * England case caption uses "Applicant" and "Respondent" (post-April 2022).
   * The online divorce portal is the primary filing mechanism; Form D8 is the
   * paper alternative.
   */
  generateCaseCaption(divorceData) {
    const courtName = (divorceData.court || this.getDefaultCourt(divorceData.county) || '[COURT NAME]').toUpperCase();
    const caseLabel = this.getCaseNumberLabel();
    const caseNumber = divorceData.caseNumber || '[CASE NUMBER]';

    const applicant = (divorceData.petitionerName || '[APPLICANT NAME]').toUpperCase();
    const respondent = (divorceData.respondentName || '[RESPONDENT NAME]').toUpperCase();

    const caption = [
      `IN THE ${courtName}`,
      '',
      `${caseLabel} ${caseNumber}`,
      '',
      `IN THE MATTER OF AN APPLICATION FOR DIVORCE`,
      `Divorce, Dissolution and Separation Act 2020`,
      '',
      `BETWEEN:`,
      '',
      `${applicant}`,
      `Applicant`,
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
   * England jurisdiction statement — domicile or habitual residence.
   */
  getJurisdictionStatement(divorceData) {
    return 'The Applicant confirms that either the Applicant or the Respondent is domiciled in England and Wales, or has been habitually resident in England and Wales for at least one year immediately preceding the date of this application, in accordance with section 5(2) of the Domicile and Matrimonial Proceedings Act 1973.';
  }

  /**
   * England venue reason.
   */
  getVenueReason(divorceData) {
    const location = divorceData.county || '[COURT LOCATION]';
    return `the Applicant or Respondent resides within the jurisdiction of the Family Court at ${location}`;
  }

  /**
   * England relief section — financial remedy under MCA 1973.
   */
  generateReliefSection(divorceData) {
    const items = [];
    let paragraphNum = divorceData._paragraphNum || 15;

    items.push({
      number: null,
      content: 'THE APPLICANT REQUESTS that the Court make the following orders:',
      type: 'relief_intro'
    });

    const reliefItems = [
      'A Final Order of divorce dissolving the marriage pursuant to section 1 of the Matrimonial Causes Act 1973 (as substituted by the Divorce, Dissolution and Separation Act 2020);'
    ];

    if (divorceData.requestFinancialRemedy !== false) {
      reliefItems.push('A financial remedy order pursuant to sections 23-25A of the Matrimonial Causes Act 1973, including such lump sum, property adjustment, and/or periodical payments orders as the Court considers just;');
      reliefItems.push('A pension sharing order or pension attachment order pursuant to section 24B of the Matrimonial Causes Act 1973, if applicable;');
    }

    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      reliefItems.push('A child arrangements order pursuant to section 8 of the Children Act 1989, specifying with whom the child(ren) shall live and the contact arrangements;');
      reliefItems.push('A child maintenance order or confirmation of a child maintenance agreement, to be calculated in accordance with Child Maintenance Service guidelines;');
    }

    if (divorceData.spousalSupportRequested || divorceData.requestSpousalSupport) {
      reliefItems.push('Periodical payments (spousal maintenance) pursuant to section 23(1)(a) of the Matrimonial Causes Act 1973;');
    }

    reliefItems.push('Such further or other order as the Court considers just.');

    reliefItems.forEach((relief, index) => {
      const letter = String.fromCharCode(97 + index);
      items.push({
        number: null,
        content: relief,
        type: 'relief_item',
        style: 'letter',
        letter
      });
    });

    return {
      title: 'RELIEF REQUESTED',
      items,
      nextParagraphNumber: paragraphNum
    };
  }

  /**
   * England verification uses Statement of Truth (Family Procedure Rules 2010, Part 17).
   */
  getVerificationText(divorceData) {
    const name = divorceData.petitionerName || '[APPLICANT NAME]';
    return `I, ${name}, the Applicant, believe that the facts stated in this application are true. I understand that proceedings for contempt of court may be brought against anyone who makes, or causes to be made, a false statement in a document verified by a statement of truth without an honest belief in its truth.`;
  }

  /**
   * England grounds for divorce — since April 2022 there is only one ground.
   * Under the DDSA 2020, the applicant simply states that the marriage has
   * irretrievably broken down. No evidence of adultery, behaviour, or
   * separation is required.
   */
  getGroundsText(groundsForDivorce) {
    return 'The marriage has irretrievably broken down, within the meaning of section 1(1) of the Matrimonial Causes Act 1973 (as substituted by the Divorce, Dissolution and Separation Act 2020). This is the sole ground for divorce and no further particulars are required.';
  }
}

module.exports = EnglandDivorcePetitionTemplate;
