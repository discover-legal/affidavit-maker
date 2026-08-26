// templates/states/alberta/DivorcePetitionTemplate.js
// Alberta divorce petition template
// Governing Law: Divorce Act (RSC 1985, c. 3 (2nd Supp.)); Alberta Rules of Court, Alta Reg 124/2010

'use strict';

const BaseDivorcePetitionTemplate = require('../../core/BaseDivorcePetitionTemplate');

/**
 * Alberta Divorce Template — Statement of Claim for Divorce
 *
 * Alberta uses a "Statement of Claim for Divorce" (not "Petition") in the Court of King's Bench.
 * Divorce is commenced as a civil action; parties are Plaintiff and Defendant.
 *
 * Key Legal References:
 * - Divorce Act, RSC 1985, c. 3 (2nd Supp.) (federal)
 *   - s.8(2)(a): 1-year separation (primary ground)
 *   - s.8(2)(b)(i): Adultery
 *   - s.8(2)(b)(ii): Physical or mental cruelty
 * - Family Property Act, RSA 2000, c. F-4.7 (provincial — equal division of family property)
 * - Family Law Act, SA 2003, c. F-4.5 (provincial — guardianship, parenting, support)
 * - Alberta Rules of Court, Alta Reg 124/2010 (procedure)
 * - Federal Child Support Guidelines, SOR/97-175
 *
 * Residency Requirement (Divorce Act, s.3):
 * - Either spouse must have been habitually resident in Alberta for at least 1 year.
 *
 * Alberta-Specific:
 * - Parties are "Plaintiff" and "Defendant" (Alberta Court of King's Bench civil proceedings;
 *   divorce is commenced as a civil action — NOT "Petitioner/Respondent")
 * - Court is Court of King's Bench of Alberta (note: changed from "Court of Queen's Bench" upon
 *   accession of King Charles III in September 2022)
 * - Judicial districts: Calgary, Edmonton, Red Deer, Lethbridge, Medicine Hat, Grande Prairie, etc.
 * - Joint Statement of Claim for Divorce available for uncontested divorces
 * - Alberta Family Property Act, RSA 2000, c. F-4.7, mandates equal division of family
 *   property unless the court orders otherwise based on the factors in s.8
 *
 * @class AlbertaDivorcePetitionTemplate
 * @extends BaseDivorcePetitionTemplate
 */
class AlbertaDivorcePetitionTemplate extends BaseDivorcePetitionTemplate {
  constructor() {
    super();

    this.state = 'AB';
    this.stateName = 'Alberta';
    
    // Canadian terminology (see templates/core/terminology.js):
    // Divorce is a Court of King's Bench civil action commenced at a judicial centre; parties are Plaintiff/Defendant.
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
      filerLabel: 'Plaintiff',
      responderLabel: 'Defendant',
      selfRepresentedLabel: 'Self-Represented',
    };
    this.countryCode = 'CA';
    this.documentTitle = 'STATEMENT OF CLAIM FOR DIVORCE';

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
      description: 'Either spouse must have been habitually resident in Alberta for at least one year immediately before the divorce application (Divorce Act, s.3(1)).'
    };

    this.waitingPeriod = {
      days: 0,
      description: 'No mandatory waiting period after filing. The 1-year separation must be complete before or at the time of judgment.'
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
    // Alberta Court of King's Bench uses "Action No." for civil actions including divorce
    return 'Action No.';
  }

  getDefaultCourt(county) {
    const district = (county || '[JUDICIAL DISTRICT]').toUpperCase();
    return `COURT OF KING'S BENCH OF ALBERTA — JUDICIAL DISTRICT OF ${district}`;
  }

  /**
   * Alberta case caption uses "Plaintiff" and "Defendant" (not "Petitioner/Respondent").
   * Alberta divorce is commenced as a civil action under the Alberta Rules of Court,
   * Alta Reg 124/2010. The initiating document is a Statement of Claim for Divorce.
   */
  generateCaseCaption(divorceData) {
    const courtName = (divorceData.court || this.getDefaultCourt(divorceData.county) || '[COURT NAME]').toUpperCase();
    const caseLabel = this.getCaseNumberLabel();
    const caseNumber = divorceData.caseNumber || '[ACTION NUMBER]';

    const plaintiff = (divorceData.petitionerName || '[PLAINTIFF NAME]').toUpperCase();
    const defendant = (divorceData.respondentName || '[DEFENDANT NAME]').toUpperCase();

    const caption = [
      `IN THE ${courtName}`,
      '',
      `${caseLabel} ${caseNumber}`,
      '',
      `BETWEEN:`,
      '',
      `${plaintiff}`,
      `Plaintiff`,
      '',
      `AND`,
      '',
      `${defendant}`,
      `Defendant`
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
   * Alberta jurisdiction statement — Divorce Act, s.3(1).
   * Either spouse must have been habitually resident in Alberta for 1 year.
   * Divorce in Alberta is a civil action; parties are "Plaintiff" and "Defendant"
   * (Alberta Rules of Court, Alta Reg 124/2010; not "Petitioner/Respondent").
   */
  getJurisdictionStatement(divorceData) {
    return `Either the Plaintiff or the Defendant has been habitually resident in the Province of Alberta for at least one year immediately preceding the filing of this Statement of Claim, as required by section 3(1) of the Divorce Act, RSC 1985, c. 3 (2nd Supp.).`;
  }

  /**
   * Alberta venue reason — Plaintiff or Defendant resides in this judicial district.
   */
  getVenueReason(divorceData) {
    const district = divorceData.county || '[JUDICIAL DISTRICT]';
    return `the Plaintiff or Defendant resides in the Judicial Centre of ${district}`;
  }

  getGroundsText(groundsForDivorce) {
    const g = (groundsForDivorce || 'separation').toLowerCase();
    if (g.includes('adultery')) {
      return 'The Defendant has committed adultery within the meaning of paragraph 8(2)(b)(i) of the Divorce Act.';
    }
    if (g.includes('cruelty') || g.includes('violence')) {
      return 'The Defendant has treated the Plaintiff with physical or mental cruelty of such a kind as to render intolerable the continued cohabitation of the spouses, within the meaning of paragraph 8(2)(b)(ii) of the Divorce Act.';
    }
    return 'The spouses have lived separate and apart for at least one year immediately preceding the determination of the divorce action, within the meaning of paragraph 8(2)(a) of the Divorce Act.';
  }

  /**
   * Alberta relief section — uses Canadian Divorce Act corollary relief terminology.
   * "Corollary relief" (not "ancillary relief") is the correct term under the Divorce Act.
   * Post-March 1, 2021 amendments (Bill C-78): "parenting time" and
   * "decision-making responsibility" replace "custody" and "access" (Divorce Act, ss.16.1-16.92).
   * Family Property Act, RSA 2000, c. F-4.7 governs equal division of family property.
   * Plaintiff/Defendant labels per Alberta Rules of Court, Alta Reg 124/2010.
   */
  generateReliefSection(divorceData) {
    const items = [];
    let paragraphNum = divorceData._paragraphNum || 15;

    items.push({
      number: null,
      content: 'THE PLAINTIFF CLAIMS:',
      type: 'relief_intro'
    });

    const reliefItems = [
      'A divorce order pursuant to section 8 of the Divorce Act, RSC 1985, c. 3 (2nd Supp.);',
      'Division of family property pursuant to the Family Property Act, RSA 2000, c. F-4.7;',
      'An order allocating responsibility for family debt in an equitable manner;'
    ];

    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      reliefItems.push('A parenting order specifying parenting time and decision-making responsibility pursuant to section 16.1 of the Divorce Act;');
      reliefItems.push('A child support order pursuant to section 15.1 of the Divorce Act and the Federal Child Support Guidelines, SOR/97-175;');
    }

    if (divorceData.spousalSupportRequested || divorceData.requestSpousalSupport) {
      reliefItems.push('A spousal support order pursuant to section 15.2 of the Divorce Act, as corollary relief;');
    }

    if (divorceData.requestNameChange && divorceData.previousName) {
      reliefItems.push(`An order restoring the Plaintiff's former name: ${divorceData.previousName};`);
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
   * Alberta verification text.
   * Alberta uses an affidavit sworn or affirmed before a commissioner for oaths
   * under the Oaths of Office Act, RSA 2000, c. O-1, and Alberta Rules of Court,
   * Alta Reg 124/2010, Part 13 (Affidavits). "Penalty of perjury" is a US concept;
   * perjury in Canada is an offence under Criminal Code, RSC 1985, c. C-46, s.131.
   * Correct party label is "Plaintiff" (Alberta civil action terminology).
   */
  getVerificationText(divorceData) {
    const name = divorceData.petitionerName || '[PLAINTIFF NAME]';
    return `I, ${name}, Plaintiff, make oath and say (or solemnly affirm) that the facts stated in this Statement of Claim are true, to the best of my knowledge, information, and belief.`;
  }
}

module.exports = AlbertaDivorcePetitionTemplate;
