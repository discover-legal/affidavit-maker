// templates/states/saskatchewan/DivorcePetitionTemplate.js
// Saskatchewan divorce petition template
// Governing Law: Divorce Act (RSC 1985, c. 3 (2nd Supp.)); The Family Property Act, SS 1997, c. F-6.3

'use strict';

const BaseDivorcePetitionTemplate = require('../../core/BaseDivorcePetitionTemplate');

/**
 * Saskatchewan Divorce Petition Template
 *
 * Saskatchewan retains the term "Petition" for divorce proceedings filed in the
 * Court of King's Bench for Saskatchewan.
 *
 * Key Legal References:
 * - Divorce Act, RSC 1985, c. 3 (2nd Supp.) (federal — governs divorce nationwide)
 *   - s.3(1): Jurisdiction — either spouse habitually resident in province for 1 year
 *   - s.8(2)(a): Separation for 1 year is the primary ground
 *   - s.8(2)(b): Adultery or physical/mental cruelty
 *   - s.12: Effective date of divorce — 31 days after judgment unless varied
 *   - s.12(7): Certificate of Divorce
 * - The Family Property Act, SS 1997, c. F-6.3 (provincial — deferred community of property;
 *   equal division of family property on marriage breakdown)
 * - The Family Maintenance Act, 1997, SS 1997, c. F-6.2 (provincial — support obligations)
 * - The Evidence Act, 2006, SS 2006, c. E-11.2 (affidavit requirements)
 * - Federal Child Support Guidelines, SOR/97-175
 *
 * Residency Requirement (Divorce Act, s.3(1)):
 * - Either spouse must have been habitually resident in Saskatchewan for at least 1 year
 *   immediately before the application.
 *
 * Saskatchewan-Specific:
 * - Parties are "Petitioner" and "Respondent"
 * - Court is Court of King's Bench for Saskatchewan (note: "for Saskatchewan" not
 *   "of Saskatchewan"; changed from "Court of Queen's Bench" in September 2022)
 * - Judicial centres: Regina, Saskatoon, Prince Albert, Moose Jaw, Swift Current,
 *   Yorkton, North Battleford, Meadow Lake
 * - Court File No. instead of "CASE NO." or "CAUSE NO."
 * - Property division: deferred community of property — equal division of family property
 *   unless unfair (Family Property Act)
 * - 2021 Divorce Act amendments: "parenting time" and "decision-making responsibility"
 *   are preferred terms over "custody and access"
 *
 * @class SaskatchewanDivorcePetitionTemplate
 * @extends BaseDivorcePetitionTemplate
 */
class SaskatchewanDivorcePetitionTemplate extends BaseDivorcePetitionTemplate {
  constructor() {
    super();

    this.state = 'SK';
    this.stateName = 'Saskatchewan';
    
    // Canadian terminology (see templates/core/terminology.js):
    // Court of King's Bench petition issued at a judicial centre; KB Rules keep Petitioner/Respondent.
    // No "STATE OF"/"COUNTY OF" caption lines and no "X County" body
    // phrasing — the caption's court-name line carries the venue.
    this.terminology = {
      ...this.terminology,
      jurisdictionLabel: null,
      jurisdictionTerm: 'Province',
      districtLabel: null,
      districtTerm: 'Judicial centre',
      districtStyle: 'plain',
      districtPlaceholder: '[JUDICIAL CENTRE]',
      filerLabel: 'Petitioner',
      responderLabel: 'Respondent',
      selfRepresentedLabel: 'Self-Represented',
    };
    this.countryCode = 'CA';
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

    // Saskatchewan residency: 1 year in province (Divorce Act s.3(1))
    this.residencyRequirements = {
      stateMonths: 12,
      countyDays: 0,
      description: 'Either spouse must have been habitually resident in Saskatchewan for at least one year immediately before the divorce application (Divorce Act, s.3(1)).'
    };

    // No mandatory waiting period after filing beyond the separation ground itself
    this.waitingPeriod = {
      days: 0,
      description: 'No mandatory waiting period after filing. The one-year separation must be complete before or at the time the application is granted.'
    };

    this.formatting = {
      fontSize: '12pt',
      fontFamily: 'Times New Roman',
      lineHeight: '1.5',
      margin: '1in',
      paperSize: '8.5in x 11in'
    };
  }

  getCaseNumberLabel() {
    return 'Court File No.';
  }

  getDefaultCourt(county) {
    const centre = (county || '[JUDICIAL CENTRE]').toUpperCase();
    return `COURT OF KING'S BENCH FOR SASKATCHEWAN — JUDICIAL CENTRE OF ${centre}`;
  }

  /**
   * Saskatchewan jurisdiction statement — Divorce Act, s.3(1).
   * Either spouse must have been habitually resident in Saskatchewan for 1 year.
   * Saskatchewan uses "Petitioner" and "Respondent".
   * The court is Court of King's Bench for Saskatchewan (note: "for Saskatchewan" not
   * "of Saskatchewan"; renamed from Court of Queen's Bench in September 2022).
   */
  getJurisdictionStatement(divorceData) {
    return `Either the Petitioner or the Respondent has been habitually resident in the Province of Saskatchewan for at least one year immediately preceding the filing of this Petition, as required by section 3(1) of the Divorce Act, RSC 1985, c. 3 (2nd Supp.).`;
  }

  /**
   * Saskatchewan venue reason — Petitioner or Respondent resides in this judicial centre.
   */
  getVenueReason(divorceData) {
    const centre = divorceData.county || '[JUDICIAL CENTRE]';
    return `the Petitioner or Respondent resides in the Judicial Centre of ${centre}`;
  }

  /**
   * Saskatchewan relief section — uses Canadian Divorce Act corollary relief terminology.
   * "Corollary relief" (not "ancillary relief") is the correct term under the Divorce Act.
   * Post-March 1, 2021 amendments (Bill C-78): "parenting time" and
   * "decision-making responsibility" replace "custody" and "access" (Divorce Act, ss.16.1-16.92).
   * The Family Property Act, SS 1997, c. F-6.3 governs division of family property
   * (deferred community of property — equal division unless unfair).
   * Spousal support may also be "maintenance" under The Family Maintenance Act, 1997.
   * Petitioner/Respondent labels per Saskatchewan divorce practice.
   */
  generateReliefSection(divorceData) {
    const items = [];
    let paragraphNum = divorceData._paragraphNum || 15;

    items.push({
      number: null,
      content: 'WHEREFORE, the Petitioner requests that the Court grant the following relief:',
      type: 'relief_intro'
    });

    const reliefItems = [
      'A divorce order pursuant to section 8 of the Divorce Act, RSC 1985, c. 3 (2nd Supp.);',
      'Division of family property pursuant to The Family Property Act, SS 1997, c. F-6.3;',
      'An order allocating responsibility for debts in an equitable manner;'
    ];

    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      reliefItems.push('A parenting order specifying parenting time and decision-making responsibility pursuant to section 16.1 of the Divorce Act;');
      reliefItems.push('A child support order pursuant to section 15.1 of the Divorce Act and the Federal Child Support Guidelines, SOR/97-175;');
    }

    if (divorceData.spousalSupportRequested || divorceData.requestSpousalSupport) {
      reliefItems.push('A spousal support order pursuant to section 15.2 of the Divorce Act and The Family Maintenance Act, 1997, SS 1997, c. F-6.2, as corollary relief;');
    }

    if (divorceData.requestNameChange && divorceData.previousName) {
      reliefItems.push(`An order restoring the Petitioner's former name: ${divorceData.previousName};`);
    }

    reliefItems.push('Such further and other relief as this Court deems just and appropriate.');

    // Agreed corollary relief (agreed support amount, spousal-support

    // waiver, property agreement) — spliced before the final general prayer.

    this.appendAgreedReliefItems(reliefItems, divorceData);


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
   * Saskatchewan verification text.
   * Saskatchewan uses a sworn or affirmed affidavit before a commissioner for oaths under
   * The Evidence Act, 2006, SS 2006, c. E-11.2, and Court of King's Bench Rules.
   * "Penalty of perjury" is a US concept; perjury in Canada is an offence under
   * Criminal Code, RSC 1985, c. C-46, s.131.
   * Saskatchewan uses "Petitioner" and "Respondent".
   */
  getVerificationText(divorceData) {
    const name = divorceData.petitionerName || '[PETITIONER NAME]';
    return `I, ${name}, Petitioner, make oath and say (or solemnly affirm) that the facts stated in this Petition for Divorce are true, to the best of my knowledge, information, and belief.`;
  }

  /**
   * Saskatchewan grounds for divorce.
   * Divorce Act, s.8 provides three grounds:
   *   (a) 1-year separation
   *   (b)(i) adultery
   *   (b)(ii) physical or mental cruelty
   */
  getGroundsText(groundsForDivorce) {
    const g = (groundsForDivorce || 'separation').toLowerCase();
    if (g.includes('adultery')) {
      return 'The Respondent has committed adultery within the meaning of paragraph 8(2)(b)(i) of the Divorce Act.';
    }
    if (g.includes('cruelty') || g.includes('violence')) {
      return 'The Respondent has treated the Petitioner with physical or mental cruelty of such a kind as to render intolerable the continued cohabitation of the spouses, within the meaning of paragraph 8(2)(b)(ii) of the Divorce Act.';
    }
    // Default: 1-year separation
    return 'The spouses have lived separate and apart for at least one year immediately preceding the determination of the divorce application, within the meaning of paragraph 8(2)(a) of the Divorce Act.';
  }
}

module.exports = SaskatchewanDivorcePetitionTemplate;
