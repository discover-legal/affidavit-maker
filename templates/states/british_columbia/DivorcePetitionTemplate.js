// templates/states/british_columbia/DivorcePetitionTemplate.js
// British Columbia divorce application template
// Governing Law: Divorce Act (RSC 1985, c. 3 (2nd Supp.)); BC Supreme Court Family Rules, BC Reg. 169/2009

'use strict';

const BaseDivorcePetitionTemplate = require('../../core/BaseDivorcePetitionTemplate');

/**
 * British Columbia Divorce Application Template
 *
 * BC uses "Notice of Family Claim" (Form F3) for an unilateral divorce claim,
 * or "Notice of Joint Family Claim" (Form F1) when both spouses agree.
 *
 * Key Legal References:
 * - Divorce Act, RSC 1985, c. 3 (2nd Supp.) (federal)
 *   - s.8(2)(a): 1-year separation (primary ground)
 *   - s.8(2)(b)(i): Adultery
 *   - s.8(2)(b)(ii): Physical or mental cruelty
 * - Family Law Act, SBC 2011, c. 25 (provincial — property, support, parenting)
 *   - Part 5: Division of family property
 *   - Part 7: Child and spousal support (supplements federal guidelines)
 * - BC Supreme Court Family Rules, BC Reg. 169/2009
 * - Federal Child Support Guidelines, SOR/97-175
 *
 * Residency Requirement (Divorce Act, s.3):
 * - Either spouse must have been habitually resident in BC for at least 1 year.
 *
 * BC-Specific:
 * - Parties are "Claimant" and "Respondent"
 * - Court is Supreme Court of BC (NOT Provincial Court — that court handles family but not divorce)
 * - Court File No. with registry location (e.g., "Vancouver Registry", "Victoria Registry")
 * - "Ordinary residence" standard (same as other provinces under federal Divorce Act)
 * - BC has no mandatory cooling-off period beyond the 1-year separation ground
 * - Joint divorce (Form F1 — Notice of Joint Family Claim) available if both spouses agree on all issues
 *
 * @class BCDivorcePetitionTemplate
 * @extends BaseDivorcePetitionTemplate
 */
class BCDivorcePetitionTemplate extends BaseDivorcePetitionTemplate {
  constructor() {
    super();

    this.state = 'BC';
    this.stateName = 'British Columbia';
    
    // Canadian terminology (see templates/core/terminology.js):
    // Notice of Family Claim (SCFR Form F3): filed at a Supreme Court registry; parties are Claimant/Respondent.
    // No "STATE OF"/"COUNTY OF" caption lines and no "X County" body
    // phrasing — the caption's court-name line carries the venue.
    this.terminology = {
      ...this.terminology,
      jurisdictionLabel: null,
      jurisdictionTerm: 'Province',
      districtLabel: null,
      districtTerm: 'Registry',
      districtStyle: 'plain',
      districtPlaceholder: '[REGISTRY]',
      filerLabel: 'Claimant',
      responderLabel: 'Respondent',
      selfRepresentedLabel: 'Self-Represented',
    };
    this.countryCode = 'CA';
    this.documentTitle = 'NOTICE OF FAMILY CLAIM';

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

    this.residencyRequirements = {
      stateMonths: 12,
      countyDays: 0,
      description: 'Either spouse must have been habitually resident in British Columbia for at least one year immediately before the application (Divorce Act, s.3(1)).'
    };

    this.waitingPeriod = {
      days: 0,
      description: 'No mandatory waiting period after filing. The 1-year separation period must be complete before or at the time of judgment.'
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
    const registry = (county || '[REGISTRY]').toUpperCase();
    return `SUPREME COURT OF BRITISH COLUMBIA — ${registry} REGISTRY`;
  }

  /**
   * BC case caption uses "Claimant" and "Respondent" (not "Petitioner/Respondent").
   * BC Supreme Court Family Rules, BC Reg. 169/2009 — Form F3 (Notice of Family Claim).
   * BC uses "Notice of Family Claim" initiated by a "Claimant".
   */
  generateCaseCaption(divorceData) {
    const courtName = (divorceData.court || this.getDefaultCourt(divorceData.county) || '[COURT NAME]').toUpperCase();
    const caseLabel = this.getCaseNumberLabel();
    const caseNumber = divorceData.caseNumber || '[CASE NUMBER]';

    const claimant = (divorceData.petitionerName || '[CLAIMANT NAME]').toUpperCase();
    const respondent = (divorceData.respondentName || '[RESPONDENT NAME]').toUpperCase();

    const caption = [
      `IN THE ${courtName}`,
      '',
      `${caseLabel} ${caseNumber}`,
      '',
      `BETWEEN:`,
      '',
      `${claimant}`,
      `Claimant`,
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
   * BC jurisdiction statement — Divorce Act, s.3(1).
   * Either spouse must have been habitually resident in BC for 1 year.
   * Correct party label is "Claimant" (not "Petitioner" — BC Supreme Court Family Rules,
   * BC Reg. 169/2009, Form F3 — Notice of Family Claim).
   */
  getJurisdictionStatement(divorceData) {
    return `Either the Claimant or the Respondent has been habitually resident in the Province of British Columbia for at least one year immediately preceding the filing of this Notice of Family Claim, as required by section 3(1) of the Divorce Act, RSC 1985, c. 3 (2nd Supp.).`;
  }

  /**
   * BC venue reason — Claimant or Respondent resides in this registry.
   */
  getVenueReason(divorceData) {
    const registry = divorceData.county || '[REGISTRY]';
    return `the Claimant or Respondent resides in the ${registry} registry district`;
  }

  getGroundsText(groundsForDivorce) {
    const g = (groundsForDivorce || 'separation').toLowerCase();
    if (g.includes('adultery')) {
      return 'The Respondent has committed adultery within the meaning of paragraph 8(2)(b)(i) of the Divorce Act.';
    }
    if (g.includes('cruelty') || g.includes('violence')) {
      return 'The Respondent has treated the Claimant with physical or mental cruelty of such a kind as to render intolerable the continued cohabitation of the spouses, within the meaning of paragraph 8(2)(b)(ii) of the Divorce Act.';
    }
    return 'The spouses have lived separate and apart for at least one year immediately preceding the determination of the divorce application, within the meaning of paragraph 8(2)(a) of the Divorce Act.';
  }

  /**
   * BC relief section — uses Canadian Divorce Act corollary relief terminology.
   * "Corollary relief" (not "ancillary relief") is the correct term under the Divorce Act.
   * Post-March 1, 2021 amendments (Bill C-78): "parenting time" and
   * "decision-making responsibility" replace "custody" and "access" (Divorce Act, ss.16.1-16.92).
   * BC Family Law Act, SBC 2011, c. 25, Part 5 governs property division.
   * Claimant/Respondent labels per BC Supreme Court Family Rules, BC Reg. 169/2009.
   */
  generateReliefSection(divorceData) {
    const items = [];
    let paragraphNum = divorceData._paragraphNum || 15;

    items.push({
      number: null,
      content: 'THE CLAIMANT CLAIMS:',
      type: 'relief_intro'
    });

    const reliefItems = [
      'A divorce order pursuant to section 8 of the Divorce Act, RSC 1985, c. 3 (2nd Supp.);',
      'Division of family property and debt pursuant to Part 5 of the Family Law Act, SBC 2011, c. 25;',
      'An order allocating responsibility for family debt in an equitable manner;'
    ];

    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      reliefItems.push('A parenting order specifying parenting time and parental responsibilities pursuant to section 16.1 of the Divorce Act;');
      reliefItems.push('A child support order pursuant to section 15.1 of the Divorce Act and the Federal Child Support Guidelines, SOR/97-175;');
    }

    if (divorceData.spousalSupportRequested || divorceData.requestSpousalSupport) {
      reliefItems.push('A spousal support order pursuant to section 15.2 of the Divorce Act, as corollary relief;');
    }

    if (divorceData.requestNameChange && divorceData.previousName) {
      reliefItems.push(`An order restoring the Claimant's former name: ${divorceData.previousName};`);
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
      title: 'RELIEF CLAIMED',
      items,
      nextParagraphNumber: paragraphNum
    };
  }

  /**
   * BC verification text.
   * BC Supreme Court Family Rules require affidavit evidence (not a US-style "penalty of
   * perjury" declaration). Affidavits are sworn or solemnly affirmed before a commissioner
   * for taking oaths under the Evidence Act, RSBC 1996, c. 124.
   * Correct party label is "Claimant" (BC Supreme Court Family Rules, BC Reg. 169/2009).
   */
  getVerificationText(divorceData) {
    const name = divorceData.petitionerName || '[CLAIMANT NAME]';
    return `I, ${name}, Claimant, make oath and say (or solemnly affirm) that the contents of this Notice of Family Claim are true, to the best of my knowledge, information, and belief.`;
  }
}

module.exports = BCDivorcePetitionTemplate;
