// templates/states/yukon/DivorcePetitionTemplate.js
// Yukon divorce petition template
// Governing Law: Divorce Act (RSC 1985, c. 3 (2nd Supp.)); Family Property and Support Act (RSY 2002, c. 83)

'use strict';

const BaseDivorcePetitionTemplate = require('../../core/BaseDivorcePetitionTemplate');

/**
 * Yukon Divorce Petition Template
 *
 * Yukon uses the term "Petition for Divorce" as the initiating document
 * under Yukon Supreme Court Rule 63, filed in the Supreme Court of Yukon (Whitehorse).
 *
 * Key Legal References:
 * - Divorce Act, RSC 1985, c. 3 (2nd Supp.) (federal — governs divorce nationwide)
 *   - s.3(1): Jurisdiction — either spouse habitually resident in territory for 1 year
 *   - s.8(2)(a): Separation for 1 year is the primary ground
 *   - s.8(2)(b): Adultery or physical/mental cruelty
 *   - s.12: Effective date of divorce — 31 days after judgment unless varied
 * - Family Property and Support Act, RSY 2002, c. 83 (territorial — division of family
 *   assets with 50/50 equal division default, spousal support)
 * - Children's Law Act, RSY 2002, c. 31 (custody/access in non-divorce proceedings)
 * - Federal Child Support Guidelines, SOR/97-175
 * - 2021 Divorce Act amendments: "parenting time" and "decision-making responsibility"
 *   replace "custody" and "access" in divorce proceedings
 *
 * Residency Requirement (Divorce Act, s.3(1)):
 * - Either spouse must have been habitually resident in Yukon for at least 1 year
 *   immediately before the divorce petition.
 *
 * Yukon-Specific:
 * - Parties are "Petitioner" and "Respondent"
 * - Court is the Supreme Court of Yukon (Whitehorse — only court location)
 * - Yukon has no counties — the territory is a single judicial district
 * - S.C. NO. (Supreme Court Number) is the case number label
 * - Property division under the Family Property and Support Act (RSY 2002, c. 83) —
 *   equal division (50/50) of family assets as the default
 *
 * @class YukonDivorcePetitionTemplate
 * @extends BaseDivorcePetitionTemplate
 */
class YukonDivorcePetitionTemplate extends BaseDivorcePetitionTemplate {
  constructor() {
    super();

    this.state = 'YT';
    this.stateName = 'Yukon';
    this.countryCode = 'CA';
    this.documentTitle = 'STATEMENT OF CLAIM (DIVORCE)';

    try {
      this.metadata = require('./divorce-metadata.json');
    } catch (e) {
      this.metadata = null;
    }

    this.requiredFields = [
      'petitionerName',
      'respondentName',
      'state',
      'marriageDate',
      'groundsForDivorce'
    ];

    // Yukon residency: 1 year ordinary resident (Divorce Act s.3(1))
    this.residencyRequirements = {
      stateMonths: 12,
      countyDays: 0,
      description: 'Either spouse must have been habitually resident in Yukon for at least one year immediately before the divorce petition (Divorce Act, s.3(1)).'
    };

    // No mandatory waiting period after filing beyond the separation ground itself
    this.waitingPeriod = {
      days: 0,
      description: 'No mandatory waiting period after filing. The one-year separation must be complete before or at the time the petition is granted.'
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
    return 'S.C. NO.';
  }

  getDefaultCourt() {
    return 'SUPREME COURT OF YUKON';
  }

  generateHeader() {
    return 'YUKON';
  }

  /**
   * Yukon venue — no counties. The Supreme Court sits in Whitehorse.
   */
  generateVenue(county) {
    if (county) {
      return `AT ${county.toUpperCase()}`;
    }
    return 'AT WHITEHORSE';
  }

  /**
   * Yukon case caption uses Petitioner/Respondent labels (Rule 63).
   */
  generateCaseCaption(divorceData) {
    const courtName = (divorceData.court || this.getDefaultCourt()).toUpperCase();
    const caseLabel = this.getCaseNumberLabel();
    const caseNumber = divorceData.caseNumber || '[FILE NUMBER]';

    const petitioner = (divorceData.petitionerName || '[PETITIONER NAME]').toUpperCase();
    const respondent = (divorceData.respondentName || '[RESPONDENT NAME]').toUpperCase();

    const caption = [
      `IN THE ${courtName}`,
      '',
      `${caseLabel} ${caseNumber}`,
      '',
      `IN THE MATTER OF A PETITION FOR DIVORCE`,
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
   * Yukon jurisdiction statement — Divorce Act, s.3(1).
   * Either spouse must have been habitually resident in Yukon for 1 year.
   */
  getJurisdictionStatement(divorceData) {
    return `Either the Petitioner or the Respondent has been habitually resident in Yukon for at least one year immediately preceding the filing of this Petition, as required by section 3(1) of the Divorce Act, RSC 1985, c. 3 (2nd Supp.).`;
  }

  /**
   * Yukon venue reason — no counties; Petitioner or Respondent resides in the territory.
   */
  getVenueReason(divorceData) {
    return 'the Petitioner or Respondent resides in Yukon';
  }

  /**
   * Yukon relief section — uses Canadian Divorce Act corollary relief terminology.
   * Post-2021 amendments: "parenting time" and "decision-making responsibility".
   * Property division: Family Property and Support Act (RSY 2002, c. 83) — equal division.
   * Spousal support: Divorce Act s.15.2 and Family Property and Support Act Part 3.
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
      'Division of family assets pursuant to the Family Property and Support Act, RSY 2002, c. 83;',
      'An order allocating responsibility for debts in an equitable manner;'
    ];

    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      reliefItems.push('A parenting order specifying parenting time and decision-making responsibility pursuant to section 16.1 of the Divorce Act;');
      reliefItems.push('A child support order pursuant to section 15.1 of the Divorce Act and the Federal Child Support Guidelines, SOR/97-175;');
    }

    if (divorceData.spousalSupportRequested || divorceData.requestSpousalSupport) {
      reliefItems.push('A spousal support order pursuant to section 15.2 of the Divorce Act and Part 3 of the Family Property and Support Act, RSY 2002, c. 83, as corollary relief;');
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
   * Yukon verification text.
   * Uses a sworn affidavit before a commissioner for oaths or notary public.
   * Perjury is an offence under Criminal Code, RSC 1985, c. C-46, s.131.
   */
  getVerificationText(divorceData) {
    const name = divorceData.petitionerName || '[PETITIONER NAME]';
    return `I, ${name}, Petitioner, make oath and say (or solemnly affirm) that the facts stated in this Petition for Divorce are true, to the best of my knowledge, information, and belief.`;
  }

  /**
   * Yukon grounds for divorce.
   * Divorce Act, s.8(2) provides three grounds:
   *   (a) 1-year separation [s.8(2)(a)]
   *   (b)(i) adultery [s.8(2)(b)(i)]
   *   (b)(ii) physical or mental cruelty [s.8(2)(b)(ii)]
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
    return 'The spouses have lived separate and apart for at least one year immediately preceding the determination of the divorce petition, within the meaning of paragraph 8(2)(a) of the Divorce Act.';
  }
}

module.exports = YukonDivorcePetitionTemplate;
