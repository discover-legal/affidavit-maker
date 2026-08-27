// templates/states/nova_scotia/DivorcePetitionTemplate.js
// Nova Scotia divorce petition template
// Governing Law: Divorce Act (RSC 1985, c. 3 (2nd Supp.)); Matrimonial Property Act, RSNS 1989, c. 275

'use strict';

const BaseDivorcePetitionTemplate = require('../../core/BaseDivorcePetitionTemplate');

/**
 * Nova Scotia Divorce Petition Template
 *
 * Nova Scotia uses the term "Petition" for divorce proceedings filed in the
 * Supreme Court of Nova Scotia (Family Division).
 *
 * Key Legal References:
 * - Divorce Act, RSC 1985, c. 3 (2nd Supp.) (federal — governs divorce nationwide)
 *   - s.3(1): Jurisdiction — either spouse habitually resident in province for 1 year
 *   - s.8(2)(a): Separation for 1 year is the primary ground
 *   - s.8(2)(b): Adultery or physical/mental cruelty
 *   - s.12: Effective date of divorce — 31 days after judgment unless varied
 *   - s.12(7): Certificate of Divorce
 * - Matrimonial Property Act, RSNS 1989, c. 275 (provincial — equal division of
 *   matrimonial assets; s.12 creates a presumption of equal sharing)
 * - Parenting and Support Act, RSNS 1989, c. 160 (provincial — parenting arrangements and support; formerly the Maintenance and Custody Act, renamed in 2017)
 * - Evidence Act, RSNS 1989, c. 154 (affidavit requirements)
 * - Nova Scotia Civil Procedure Rules (procedure)
 * - Federal Child Support Guidelines, SOR/97-175
 *
 * Residency Requirement (Divorce Act, s.3(1)):
 * - Either spouse must have been habitually resident in Nova Scotia for at least 1 year
 *   immediately before the application.
 *
 * Nova Scotia-Specific:
 * - Parties are "Petitioner" and "Respondent"
 * - Court is Supreme Court of Nova Scotia (Family Division)
 * - Family Division sits in Halifax, Kentville, Truro, Sydney, Bridgewater, Amherst,
 *   Antigonish, Pictou, and Yarmouth
 * - Court File No. instead of "CASE NO." or "CAUSE NO."
 * - Property division: equal division of matrimonial assets (Matrimonial Property Act, s.12)
 *   — includes the matrimonial home and other matrimonial assets; matrimonial debts
 *   are also shared equally
 * - Filing fee: approximately CAD $291.55
 * - 2021 Divorce Act amendments: "parenting time" and "decision-making responsibility"
 *   are preferred terms over "custody and access"
 *
 * @class NovaScotiaDivorcePetitionTemplate
 * @extends BaseDivorcePetitionTemplate
 */
class NovaScotiaDivorcePetitionTemplate extends BaseDivorcePetitionTemplate {
  constructor() {
    super();

    this.state = 'NS';
    this.stateName = 'Nova Scotia';
    
    // Canadian terminology (see templates/core/terminology.js):
    // Supreme Court (Family Division) petition for divorce; Civil Procedure Rules keep Petitioner/Respondent; filed at a court location, not a county.
    // No "STATE OF"/"COUNTY OF" caption lines and no "X County" body
    // phrasing — the caption's court-name line carries the venue.
    this.terminology = {
      ...this.terminology,
      jurisdictionLabel: null,
      jurisdictionTerm: 'Province',
      districtLabel: null,
      districtTerm: 'Court location',
      districtStyle: 'plain',
      districtPlaceholder: '[LOCATION]',
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

    // Nova Scotia residency: 1 year in province (Divorce Act s.3(1))
    this.residencyRequirements = {
      stateMonths: 12,
      countyDays: 0,
      description: 'Either spouse must have been habitually resident in Nova Scotia for at least one year immediately before the divorce application (Divorce Act, s.3(1)).'
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
    const location = (county || '[LOCATION]').toUpperCase();
    return `SUPREME COURT OF NOVA SCOTIA (FAMILY DIVISION) — ${location}`;
  }

  /**
   * Nova Scotia jurisdiction statement — Divorce Act, s.3(1).
   * Either spouse must have been habitually resident in NS for 1 year.
   * NS uses "Petitioner" and "Respondent".
   * Court is the Supreme Court of Nova Scotia (Family Division).
   * Judicature Act, RSNS 1989, c. 240; Nova Scotia Civil Procedure Rules.
   */
  getJurisdictionStatement(divorceData) {
    return `Either the Petitioner or the Respondent has been habitually resident in the Province of Nova Scotia for at least one year immediately preceding the filing of this Petition, as required by section 3(1) of the Divorce Act, RSC 1985, c. 3 (2nd Supp.).`;
  }

  /**
   * Nova Scotia venue reason — Petitioner or Respondent resides in this location.
   */
  getVenueReason(divorceData) {
    const location = divorceData.county || '[LOCATION]';
    return `the Petitioner or Respondent resides in ${location}`;
  }

  /**
   * Nova Scotia relief section — uses Canadian Divorce Act corollary relief terminology.
   * "Corollary relief" (not "ancillary relief") is the correct term under the Divorce Act.
   * Post-March 1, 2021 amendments (Bill C-78): "parenting time" and
   * "decision-making responsibility" replace "custody" and "access" (Divorce Act, ss.16.1-16.92).
   * Matrimonial Property Act, RSNS 1989, c. 275, s.12 creates a presumption of equal sharing
   * of matrimonial assets.
   * Spousal support is termed "support" under the Parenting and Support Act, RSNS 1989, c. 160 (formerly the Maintenance and Custody Act).
   * Petitioner/Respondent labels per NS divorce practice.
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
      'Division of matrimonial assets pursuant to section 12 of the Matrimonial Property Act, RSNS 1989, c. 275;',
      'An order allocating responsibility for debts in an equitable manner;'
    ];

    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      reliefItems.push('A parenting order specifying parenting time and decision-making responsibility pursuant to section 16.1 of the Divorce Act;');
      reliefItems.push('A child support order pursuant to section 15.1 of the Divorce Act and the Federal Child Support Guidelines, SOR/97-175;');
    }

    if (divorceData.spousalSupportRequested || divorceData.requestSpousalSupport) {
      reliefItems.push('A support order pursuant to section 15.2 of the Divorce Act and the Parenting and Support Act, RSNS 1989, c. 160, as corollary relief;');
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
   * Nova Scotia verification text.
   * NS uses sworn or affirmed affidavits before a commissioner for oaths under the
   * Evidence Act, RSNS 1989, c. 154, and Nova Scotia Civil Procedure Rules.
   * "Penalty of perjury" is a US concept; perjury in Canada is an offence under
   * Criminal Code, RSC 1985, c. C-46, s.131.
   * NS uses "Petitioner" and "Respondent".
   */
  getVerificationText(divorceData) {
    const name = divorceData.petitionerName || '[PETITIONER NAME]';
    return `I, ${name}, Petitioner, make oath and say (or solemnly affirm) that the facts stated in this Petition for Divorce are true, to the best of my knowledge, information, and belief.`;
  }

  /**
   * Nova Scotia grounds for divorce.
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

module.exports = NovaScotiaDivorcePetitionTemplate;
