// templates/states/ontario/DivorcePetitionTemplate.js
// Ontario divorce application template
// Governing Law: Divorce Act (RSC 1985, c. 3 (2nd Supp.)); Family Law Rules, O. Reg. 114/99

'use strict';

const BaseDivorcePetitionTemplate = require('../../core/BaseDivorcePetitionTemplate');

/**
 * Ontario Divorce Application Template
 *
 * Ontario uses the term "Application" rather than "Petition" for divorce proceedings.
 * The standard form is Form 8 (Application — General) under the Family Law Rules.
 *
 * Key Legal References:
 * - Divorce Act, RSC 1985, c. 3 (2nd Supp.) (federal — governs divorce nationwide)
 *   - s.8(2)(a): Separation for 1 year is the primary ground
 *   - s.8(2)(b)(i): Adultery (rare)
 *   - s.8(2)(b)(ii): Physical or mental cruelty (rare)
 * - Family Law Act, RSO 1990, c. F.3 (provincial — property, support)
 * - Family Law Rules, O. Reg. 114/99 (procedure — Form 8)
 * - Children's Law Reform Act, RSO 1990, c. C.12 (parentage, custody/access in non-divorce proceedings)
 * - Child Support Guidelines, SOR/97-175 (federal support calculation)
 * - 2021 Divorce Act amendments (in force March 1, 2021): "parenting time" and
 *   "decision-making responsibility" replace "custody" and "access" in divorce proceedings
 *
 * Residency Requirement (Divorce Act, s.3):
 * - Either spouse must have been habitually resident in Ontario for at least 1 year
 *   immediately before the divorce application.
 *
 * Ontario-Specific:
 * - Parties are "Applicant" and "Respondent" (not "Petitioner")
 * - Court is Superior Court of Justice (or Family Court branch where available)
 * - Filing fee: CAD $224 initial (Application) + $445 (Affidavit for Divorce / set-down) = $669 total; Certificate of Divorce $25 extra ($694 total). Waivable with Form 26B if impecunious.
 * - Uncontested divorce: typically handled on paper without a hearing
 * - Court File No. instead of "CAUSE NO." or "CASE NO."
 *
 * @class OntarioDivorcePetitionTemplate
 * @extends BaseDivorcePetitionTemplate
 */
class OntarioDivorcePetitionTemplate extends BaseDivorcePetitionTemplate {
  constructor() {
    super();

    this.state = 'ON';
    this.stateName = 'Ontario';
    this.countryCode = 'CA';
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

    // Ontario residency: 1 year in province (Divorce Act s.3)
    this.residencyRequirements = {
      stateMonths: 12,
      countyDays: 0,
      description: 'Either spouse must have been habitually resident in Ontario for at least one year immediately before the divorce application (Divorce Act, s.3(1)).'
    };

    // No mandatory waiting period after filing in Ontario beyond the separation ground itself
    this.waitingPeriod = {
      days: 0,
      description: 'No mandatory waiting period after filing — the 1-year separation must be completed before or by the time the application is granted.'
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
    const city = (county || '[CITY]').toUpperCase();
    return `SUPERIOR COURT OF JUSTICE — ${city}`;
  }

  /**
   * Ontario case caption uses "Applicant" and "Respondent" (not "Petitioner/Respondent").
   * Ontario Family Law Rules, O. Reg. 114/99 — Form 8 (Application — General).
   * Ontario uses an "Application" commenced by an "Applicant".
   * Court File No. assigned by the Superior Court of Justice.
   */
  generateCaseCaption(divorceData) {
    const courtName = (divorceData.court || this.getDefaultCourt(divorceData.county) || '[COURT NAME]').toUpperCase();
    const caseLabel = this.getCaseNumberLabel();
    const caseNumber = divorceData.caseNumber || '[COURT FILE NUMBER]';

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
   * Ontario jurisdiction statement — Divorce Act, s.3(1).
   * Either spouse must have been habitually resident in the province for 1 year.
   * There is no county-days requirement; Ontario has no sub-provincial residency condition.
   * Correct party label is "Applicant" (not "Petitioner" — Ontario Family Law Rules, O. Reg. 114/99).
   */
  getJurisdictionStatement(divorceData) {
    return `Either the Applicant or the Respondent has been habitually resident in the Province of Ontario for at least one year immediately preceding the filing of this Application, as required by section 3(1) of the Divorce Act, RSC 1985, c. 3 (2nd Supp.).`;
  }

  /**
   * Ontario venue reason — Applicant or Respondent resides in this court location.
   */
  getVenueReason(divorceData) {
    const location = divorceData.county || '[COURT LOCATION]';
    return `the Applicant or Respondent resides in ${location}`;
  }

  /**
   * Ontario relief section — uses Canadian Divorce Act corollary relief terminology.
   * "Corollary relief" (not "ancillary relief") is the correct term under the Divorce Act.
   * Post-March 1, 2021 amendments (Bill C-78): "parenting time" and
   * "decision-making responsibility" replace "custody" and "access" (Divorce Act, ss.16.1-16.92).
   * Child support: Divorce Act, s.15.1; Spousal support: Divorce Act, s.15.2.
   * Applicant/Respondent labels per Ontario Family Law Rules, O. Reg. 114/99.
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
      'Division of net family property pursuant to sections 5-9 of the Family Law Act, RSO 1990, c. F.3;',
      'An order for possession of the matrimonial home pursuant to section 24 of the Family Law Act;',
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
   * Ontario verification text.
   * Ontario uses a sworn affidavit (not a US-style "penalty of perjury" declaration).
   * Form 36 (Affidavit for Divorce) is the standard supporting affidavit in Ontario under
   * Family Law Rules, O. Reg. 114/99. The jurat is sworn before a commissioner of oaths
   * or notary public. Perjury is an offence under Criminal Code, RSC 1985, c. C-46, s.131.
   * Correct party label is "Applicant" (Family Law Rules, O. Reg. 114/99).
   */
  getVerificationText(divorceData) {
    const name = divorceData.petitionerName || '[APPLICANT NAME]';
    return `I, ${name}, Applicant, make oath and say (or solemnly affirm) that the contents of this Application are true, to the best of my knowledge, information, and belief.`;
  }

  /**
   * Ontario grounds for divorce.
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

module.exports = OntarioDivorcePetitionTemplate;
