// templates/states/northwest_territories/DivorcePetitionTemplate.js
// Northwest Territories divorce application template
// Governing Law: Divorce Act (RSC 1985, c. 3 (2nd Supp.)); Family Law Act (SNWT 1997, c. 18)

'use strict';

const BaseDivorcePetitionTemplate = require('../../core/BaseDivorcePetitionTemplate');

/**
 * Northwest Territories Divorce Application Template
 *
 * The NWT uses the term "Application for Divorce" as the initiating document,
 * filed in the Supreme Court of the Northwest Territories (Yellowknife).
 *
 * Key Legal References:
 * - Divorce Act, RSC 1985, c. 3 (2nd Supp.) (federal — governs divorce nationwide)
 *   - s.3(1): Jurisdiction — either spouse habitually resident in territory for 1 year
 *   - s.8(2)(a): Separation for 1 year is the primary ground
 *   - s.8(2)(b): Adultery or physical/mental cruelty
 *   - s.12: Effective date of divorce — 31 days after judgment unless varied
 * - Family Law Act, SNWT 1997, c. 18 (territorial — division of family property)
 * - Federal Child Support Guidelines, SOR/97-175
 * - 2021 Divorce Act amendments: "parenting time" and "decision-making responsibility"
 *   replace "custody" and "access" in divorce proceedings
 *
 * Residency Requirement (Divorce Act, s.3(1)):
 * - Either spouse must have been habitually resident in the NWT for at least 1 year
 *   immediately before the divorce application.
 *
 * NWT-Specific:
 * - Parties are "Applicant" and "Respondent"
 * - Court is the Supreme Court of the Northwest Territories
 * - NWT has no counties — the territory is a single judicial district
 * - FILE NO. is the case number label
 * - Property division under the Family Law Act (SNWT 1997, c. 18) — equal division default
 *
 * @class NorthwestTerritoriesDivorcePetitionTemplate
 * @extends BaseDivorcePetitionTemplate
 */
class NorthwestTerritoriesDivorcePetitionTemplate extends BaseDivorcePetitionTemplate {
  constructor() {
    super();

    this.state = 'NT';
    this.stateName = 'Northwest Territories';
    this.countryCode = 'CA';
    this.documentTitle = 'PETITION FOR DIVORCE';

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

    // NWT residency: 1 year ordinary resident (Divorce Act s.3(1))
    this.residencyRequirements = {
      stateMonths: 12,
      countyDays: 0,
      description: 'Either spouse must have been habitually resident in the Northwest Territories for at least one year immediately before the divorce application (Divorce Act, s.3(1)).'
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
    return 'FILE NO.';
  }

  getDefaultCourt() {
    return 'SUPREME COURT OF THE NORTHWEST TERRITORIES';
  }

  generateHeader() {
    return 'NORTHWEST TERRITORIES';
  }

  /**
   * NWT venue — no counties. The Supreme Court sits in Yellowknife.
   */
  generateVenue(county) {
    if (county) {
      return `AT ${county.toUpperCase()}`;
    }
    return 'AT YELLOWKNIFE';
  }

  /**
   * NWT case caption uses Applicant/Respondent labels.
   */
  generateCaseCaption(divorceData) {
    const courtName = (divorceData.court || this.getDefaultCourt()).toUpperCase();
    const caseLabel = this.getCaseNumberLabel();
    const caseNumber = divorceData.caseNumber || '[FILE NUMBER]';

    const applicant = (divorceData.petitionerName || '[APPLICANT NAME]').toUpperCase();
    const respondent = (divorceData.respondentName || '[RESPONDENT NAME]').toUpperCase();

    const caption = [
      `IN THE ${courtName}`,
      '',
      `${caseLabel} ${caseNumber}`,
      '',
      `IN THE MATTER OF AN APPLICATION FOR DIVORCE`,
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
   * NWT jurisdiction statement — Divorce Act, s.3(1).
   * Either spouse must have been habitually resident in the territory for 1 year.
   */
  getJurisdictionStatement(divorceData) {
    return `Either the Applicant or the Respondent has been habitually resident in the Northwest Territories for at least one year immediately preceding the filing of this Application, as required by section 3(1) of the Divorce Act, RSC 1985, c. 3 (2nd Supp.).`;
  }

  /**
   * NWT venue reason — no counties; Applicant or Respondent resides in the territory.
   */
  getVenueReason(divorceData) {
    return 'the Applicant or Respondent resides in the Northwest Territories';
  }

  /**
   * NWT relief section — uses Canadian Divorce Act corollary relief terminology.
   * Post-2021 amendments: "parenting time" and "decision-making responsibility".
   * Property division: Family Law Act (SNWT 1997, c. 18) — equal division.
   * "Spousal Support" per Divorce Act s.15.2.
   */
  generateReliefSection(divorceData) {
    const items = [];
    let paragraphNum = divorceData._paragraphNum || 15;

    items.push({
      number: null,
      content: 'THE APPLICANT REQUESTS that the Court grant the following relief:',
      type: 'relief_intro'
    });

    const reliefItems = [
      'A divorce order pursuant to section 8 of the Divorce Act, RSC 1985, c. 3 (2nd Supp.);',
      'Division of family property pursuant to the Family Law Act, SNWT 1997, c. 18;',
      'An order allocating responsibility for debts in an equitable manner;'
    ];

    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      reliefItems.push('A parenting order specifying parenting time and decision-making responsibility pursuant to section 16.1 of the Divorce Act;');
      reliefItems.push('A child support order pursuant to section 15.1 of the Divorce Act and the Federal Child Support Guidelines, SOR/97-175;');
    }

    if (divorceData.spousalSupportRequested || divorceData.requestSpousalSupport) {
      reliefItems.push('A spousal support order pursuant to section 15.2 of the Divorce Act, as corollary relief;');
    }

    if (divorceData.requestNameChange && divorceData.previousName) {
      reliefItems.push(`An order restoring the Applicant's former name: ${divorceData.previousName};`);
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
   * NWT verification text.
   * Uses a sworn affidavit before a commissioner for oaths or notary public.
   * Perjury is an offence under Criminal Code, RSC 1985, c. C-46, s.131.
   */
  getVerificationText(divorceData) {
    const name = divorceData.petitionerName || '[APPLICANT NAME]';
    return `I, ${name}, Applicant, make oath and say (or solemnly affirm) that the contents of this Application are true, to the best of my knowledge, information, and belief.`;
  }

  /**
   * NWT grounds for divorce.
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
      return 'The Respondent has treated the Applicant with physical or mental cruelty of such a kind as to render intolerable the continued cohabitation of the spouses, within the meaning of paragraph 8(2)(b)(ii) of the Divorce Act.';
    }
    // Default: 1-year separation
    return 'The spouses have lived separate and apart for at least one year immediately preceding the determination of the divorce application, within the meaning of paragraph 8(2)(a) of the Divorce Act.';
  }
}

module.exports = NorthwestTerritoriesDivorcePetitionTemplate;
