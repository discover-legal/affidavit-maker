// templates/states/manitoba/DivorcePetitionTemplate.js
// Manitoba divorce application template
// Governing Law: Divorce Act (RSC 1985, c. 3 (2nd Supp.)); Court of King's Bench Act, CCSM c. C280

'use strict';

const BaseDivorcePetitionTemplate = require('../../core/BaseDivorcePetitionTemplate');

/**
 * Manitoba Divorce Application Template
 *
 * Manitoba uses the term "Petition" for divorce proceedings filed in the
 * Court of King's Bench of Manitoba (Family Division).
 *
 * Key Legal References:
 * - Divorce Act, RSC 1985, c. 3 (2nd Supp.) (federal — governs divorce nationwide)
 *   - s.3(1): Jurisdiction — either spouse habitually resident in province for 1 year
 *   - s.8(2)(a): Separation for 1 year is the primary ground
 *   - s.8(2)(b): Adultery or physical/mental cruelty
 *   - s.12: Effective date of divorce — 31 days after judgment unless varied
 *   - s.12(7): Certificate of Divorce
 * - Family Property Act, CCSM c. F25 (provincial — equalization of marital property)
 * - Family Law Act, CCSM c. F20 (provincial — support obligations)
 * - Court of King's Bench Act, CCSM c. C280 (procedure)
 * - Federal Child Support Guidelines, SOR/97-175
 *
 * Residency Requirement (Divorce Act, s.3(1)):
 * - Either spouse must have been habitually resident in Manitoba for at least 1 year
 *   immediately before the application.
 *
 * Manitoba-Specific:
 * - Parties are "Petitioner" and "Respondent" (Manitoba divorce practice terminology)
 * - Court is Court of King's Bench of Manitoba (Family Division) (renamed from "Court of Queen's Bench"
 *   upon accession of King Charles III in September 2022)
 * - The Court sits in Winnipeg (Brandon for western Manitoba)
 * - Court File No. instead of "CASE NO." or "CAUSE NO."
 * - Property division: equalization of net marital property (Family Property Act)
 * - Support: "maintenance" is the correct provincial term (Family Law Act, CCSM c. F20)
 * - 2021 amendments to the Divorce Act introduced "parenting time" and
 *   "decision-making responsibility" as preferred terms over "custody and access"
 *
 * @class ManitobaDivorcePetitionTemplate
 * @extends BaseDivorcePetitionTemplate
 */
class ManitobaDivorcePetitionTemplate extends BaseDivorcePetitionTemplate {
  constructor() {
    super();

    this.state = 'MB';
    this.stateName = 'Manitoba';
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

    // Manitoba residency: 1 year in province (Divorce Act s.3(1))
    this.residencyRequirements = {
      stateMonths: 12,
      countyDays: 0,
      description: 'Either spouse must have been habitually resident in Manitoba for at least one year immediately before the divorce application (Divorce Act, s.3(1)).'
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
    return `COURT OF KING'S BENCH OF MANITOBA (FAMILY DIVISION) — ${location}`;
  }

  /**
   * Manitoba jurisdiction statement — Divorce Act, s.3(1).
   * Either spouse must have been habitually resident in Manitoba for 1 year.
   * Manitoba uses "Petitioner" and "Respondent" (Manitoba divorce practice).
   * The court is the Court of King's Bench of Manitoba (renamed from Court of Queen's Bench
   * upon accession of King Charles III in September 2022; Court of King's Bench Act, CCSM c. C280).
   */
  getJurisdictionStatement(divorceData) {
    return `Either the Petitioner or the Respondent has been habitually resident in the Province of Manitoba for at least one year immediately preceding the filing of this Petition, as required by section 3(1) of the Divorce Act, RSC 1985, c. 3 (2nd Supp.).`;
  }

  /**
   * Manitoba venue reason — Petitioner or Respondent resides in this location.
   */
  getVenueReason(divorceData) {
    const location = divorceData.county || '[LOCATION]';
    return `the Petitioner or Respondent resides in ${location}`;
  }

  /**
   * Manitoba relief section — uses Canadian Divorce Act corollary relief terminology.
   * "Corollary relief" (not "ancillary relief") is the correct term under the Divorce Act.
   * Post-March 1, 2021 amendments (Bill C-78): "parenting time" and
   * "decision-making responsibility" replace "custody" and "access" (Divorce Act, ss.16.1-16.92).
   * Family Property Act, CCSM c. F25 governs equalization of marital property.
   * Spousal support is referred to as "maintenance" under the Family Law Act, CCSM c. F20.
   * Petitioner/Respondent labels per Manitoba divorce practice.
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
      'Equalization of net marital property pursuant to the Family Property Act, CCSM c. F25;',
      'An order allocating responsibility for debts in an equitable manner;'
    ];

    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      reliefItems.push('A parenting order specifying parenting time and decision-making responsibility pursuant to section 16.1 of the Divorce Act;');
      reliefItems.push('A child support order pursuant to section 15.1 of the Divorce Act and the Federal Child Support Guidelines, SOR/97-175;');
    }

    if (divorceData.spousalSupportRequested || divorceData.requestSpousalSupport) {
      reliefItems.push('A maintenance order pursuant to section 15.2 of the Divorce Act and the Family Law Act, CCSM c. F20, as corollary relief;');
    }

    if (divorceData.requestNameChange && divorceData.previousName) {
      reliefItems.push(`An order restoring the Petitioner's former name: ${divorceData.previousName};`);
    }

    reliefItems.push('Such further and other relief as this Court deems just and appropriate.');

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
   * Manitoba verification text.
   * Manitoba uses a sworn or affirmed affidavit before a commissioner for oaths under the
   * Manitoba Evidence Act, CCSM c. E150, and Court of King's Bench Act, CCSM c. C280.
   * "Penalty of perjury" is a US concept; perjury in Canada is an offence under
   * Criminal Code, RSC 1985, c. C-46, s.131.
   * Manitoba uses "Petitioner" and "Respondent".
   */
  getVerificationText(divorceData) {
    const name = divorceData.petitionerName || '[PETITIONER NAME]';
    return `I, ${name}, Petitioner, make oath and say (or solemnly affirm) that the facts stated in this Petition for Divorce are true, to the best of my knowledge, information, and belief.`;
  }

  /**
   * Manitoba grounds for divorce.
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

module.exports = ManitobaDivorcePetitionTemplate;
