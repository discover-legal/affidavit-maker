// templates/states/alberta/DivorcePetitionTemplate.js
// Alberta divorce petition template
// Governing Law: Divorce Act (RSC 1985, c. 3 (2nd Supp.)); Alberta Rules of Court, Alta Reg 124/2010

'use strict';

const BaseDivorcePetitionTemplate = require('../../core/BaseDivorcePetitionTemplate');
const { resolveCustodyArrangement, resolvePrimaryResidenceName } = require('../../core/parenting');

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

  /**
   * Alberta children section — Statement of Claim for Divorce, Court of King's
   * Bench of Alberta (Alberta Rules of Court, Alta Reg 124/2010).
   *
   * Divorce Act, s.16 requires the court to consider only the best interests
   * of the child in making a parenting order. Post-Bill C-78 (2021), the
   * Divorce Act uses "decision-making responsibility" (s.16.1) and "parenting
   * time" (s.16) — never "custody"/"access" — in a divorce proceeding.
   *
   * This override mirrors the Alberta Divorce Judgment template's children
   * handling: it plays through even when children[] is empty but the parties
   * have minor children (extraction gap), listing each child with a name/DOB
   * placeholder rather than flatly denying the existence of the children.
   *
   * Data-shape rules:
   *  - hasMinorChildren === true → plead minor children exist; enumerate the
   *    children[] array (with [CHILD NAME]/[BIRTH DATE] placeholders when
   *    missing) and pad up to numberOfChildren when set.
   *  - children[] non-empty and hasMinorChildren !== false → same as above.
   *  - hasMinorChildren === false and any adult-child signal
   *    (numberOfChildren > 0 or children[] entries) → plead adult children
   *    of the marriage; no parenting/support relief.
   *  - Otherwise → "There are no children of the marriage."
   */
  generateChildrenSection(divorceData) {
    const items = [];
    let paragraphNum = divorceData._paragraphNum || 9;

    const rawChildren = Array.isArray(divorceData.children) ? divorceData.children : [];
    const numberOfChildren = Number.isFinite(divorceData.numberOfChildren)
      ? divorceData.numberOfChildren
      : null;
    const hasMinorFlag = divorceData.hasMinorChildren;

    const hasMinorChildren = hasMinorFlag === true
      || (hasMinorFlag !== false && rawChildren.length > 0);

    if (hasMinorChildren) {
      items.push({
        number: paragraphNum++,
        content: 'There are minor children of the marriage. The Plaintiff pleads the following in respect of the child(ren), and requests parenting and support orders in the best interests of the child(ren) pursuant to section 16 of the Divorce Act, RSC 1985, c. 3 (2nd Supp.):',
        type: 'children_info'
      });

      const listed = rawChildren.length > 0
        ? rawChildren
        : Array.from({ length: Math.max(numberOfChildren || 0, 1) }, () => ({}));

      listed.forEach((child, index) => {
        // Child NAME stays as `[CHILD NAME]` — an unnamed child is genuinely
        // defective and must trip the denylist. Birth date, by contrast, is
        // frequently unknown at draft time; render a visible fill-in blank
        // instead of a `[BIRTH DATE]` sentinel that would 422 the whole
        // petition (mirrors the ON v8-D / GA v18-C pattern). Append a Draft
        // note so the drafter knows to fill in the DOB before filing.
        let childInfo;
        if (typeof child === 'string') {
          childInfo = child;
        } else {
          const childDob = this.formatDate(child.birthDate ?? child.dob ?? child.dateOfBirth);
          const dobDisplay = childDob || '__________________';
          const draftNote = childDob ? '' : '\n(Draft — insert exact date of birth before filing)';
          childInfo = `${child.name || '[CHILD NAME]'}, born ${dobDisplay}${draftNote}`;
        }
        items.push({
          number: paragraphNum++,
          content: `Child ${index + 1}: ${childInfo}`,
          type: 'child_detail'
        });
      });

      items.push({
        number: paragraphNum++,
        content: 'No other children were born to or adopted by the Plaintiff and the Defendant during the marriage, and none are expected.',
        type: 'children_info'
      });

      // Current parenting arrangement — Divorce Act s.16.1 (decision-making
      // responsibility) and s.16 (parenting time), never "custody"/"access".
      // resolveCustodyArrangement / resolvePrimaryResidenceName come from
      // templates/core/parenting.js and only recognize explicit signals; an
      // undecided case falls through to neutral placeholder language.
      const custody = resolveCustodyArrangement(divorceData);
      const residenceName = resolvePrimaryResidenceName(divorceData);

      if (custody.kind === 'joint') {
        items.push({
          number: paragraphNum++,
          content: `The Plaintiff and the Defendant currently share decision-making responsibility for the child(ren), and the Plaintiff requests a parenting order to that effect pursuant to section 16.1 of the Divorce Act.`,
          type: 'custody_request'
        });
      } else if (custody.kind === 'sole_petitioner') {
        items.push({
          number: paragraphNum++,
          content: `The Plaintiff currently has decision-making responsibility for the child(ren) and requests a parenting order granting sole decision-making responsibility pursuant to section 16.1 of the Divorce Act.`,
          type: 'custody_request'
        });
      } else if (custody.kind === 'sole_respondent') {
        items.push({
          number: paragraphNum++,
          content: `The ${divorceData.respondentName || 'Defendant'} currently has decision-making responsibility for the child(ren), and the Plaintiff requests a parenting order confirming that arrangement pursuant to section 16.1 of the Divorce Act.`,
          type: 'custody_request'
        });
      } else if (custody.kind === 'legacy_sole') {
        const sole = resolvePrimaryResidenceName(divorceData) || divorceData.petitionerName || 'the Plaintiff';
        items.push({
          number: paragraphNum++,
          content: `${sole} currently has decision-making responsibility for the child(ren), and the Plaintiff requests a parenting order to that effect pursuant to section 16.1 of the Divorce Act.`,
          type: 'custody_request'
        });
      } else {
        items.push({
          number: paragraphNum++,
          content: 'The parties will exercise decision-making responsibility for the child(ren) as agreed or as ordered by the Court pursuant to section 16.1 of the Divorce Act.',
          type: 'custody_request'
        });
      }

      if (residenceName) {
        items.push({
          number: paragraphNum++,
          content: `The child(ren) primarily reside with ${residenceName}, who has the majority of parenting time within the meaning of section 16 of the Divorce Act.`,
          type: 'residence_request'
        });
      } else {
        items.push({
          number: paragraphNum++,
          content: 'The parties will exercise parenting time with the child(ren) as agreed or as set out in a parenting schedule filed with this Court (Divorce Act, s.16).',
          type: 'residence_request'
        });
      }

      if (divorceData.childSupportAmount) {
        const payor = divorceData.childSupportObligor || divorceData.respondentName || 'the Defendant';
        const payee = divorceData.childSupportObligee || divorceData.petitionerName || 'the Plaintiff';
        items.push({
          number: paragraphNum++,
          content: `The parties have agreed that ${payor} shall pay child support to ${payee} in the amount of $${divorceData.childSupportAmount} per month, consistent with section 15.1 of the Divorce Act and the Federal Child Support Guidelines, SOR/97-175.`,
          type: 'child_support_request'
        });
      }
    } else if (hasMinorFlag === false
        && (rawChildren.length > 0 || (numberOfChildren && numberOfChildren > 0))) {
      // Adult children of the marriage — no parenting/support relief.
      const count = rawChildren.length || numberOfChildren;
      items.push({
        number: paragraphNum++,
        content: `There are ${count} adult child(ren) of the marriage. No orders regarding decision-making responsibility, parenting time, or child support are requested.`,
        type: 'children_info'
      });
      rawChildren.forEach((child, index) => {
        if (!child || typeof child !== 'object') return;
        if (!child.name) return;
        const childInfo = child.birthDate || child.dob || child.dateOfBirth
          ? `${child.name}, born ${this.formatDate(child.birthDate ?? child.dob ?? child.dateOfBirth)}`
          : child.name;
        items.push({
          number: paragraphNum++,
          content: `Adult child ${index + 1}: ${childInfo}`,
          type: 'child_detail'
        });
      });
    } else {
      items.push({
        number: paragraphNum++,
        content: 'There are no children of the marriage.',
        type: 'children_info'
      });
    }

    return {
      title: 'V. CHILDREN',
      items,
      nextParagraphNumber: paragraphNum
    };
  }

  /**
   * Alberta custody pleading — Divorce Act 2021 terminology (s.16.1
   * decision-making responsibility). Never "custody"/"access".
   */
  getCustodyPleading(custody, divorceData) {
    if (custody.kind === 'joint') {
      return 'The parties have agreed to share decision-making responsibility for the child(ren), and the Plaintiff requests a parenting order to that effect pursuant to section 16.1 of the Divorce Act.';
    }
    if (custody.kind === 'sole_petitioner') {
      return 'The Plaintiff requests sole decision-making responsibility for the child(ren) pursuant to section 16.1 of the Divorce Act.';
    }
    if (custody.kind === 'sole_respondent') {
      return `The Plaintiff requests that ${divorceData.respondentName || 'the Defendant'} have sole decision-making responsibility for the child(ren) pursuant to section 16.1 of the Divorce Act.`;
    }
    if (custody.kind === 'legacy_sole') {
      const name = resolvePrimaryResidenceName(divorceData) || divorceData.petitionerName || 'the Plaintiff';
      return `The Plaintiff requests that ${name} have sole decision-making responsibility for the child(ren) pursuant to section 16.1 of the Divorce Act.`;
    }
    return null;
  }

  /**
   * Alberta residence pleading — Divorce Act s.16 "parenting time".
   */
  getResidencePleading(residenceName) {
    return `The Plaintiff requests that the child(ren) primarily reside with ${residenceName}, who shall have the majority of parenting time within the meaning of section 16 of the Divorce Act.`;
  }

  /**
   * Alberta child-support pleading — Federal Child Support Guidelines,
   * SOR/97-175 (Divorce Act, s.15.1).
   */
  getChildSupportPleading(divorceData) {
    const payor = divorceData.childSupportObligor || divorceData.respondentName || 'the Defendant';
    const payee = divorceData.childSupportObligee || divorceData.petitionerName || 'the Plaintiff';
    return `The parties have agreed that ${payor} shall pay child support to ${payee} in the amount of $${divorceData.childSupportAmount} per month, consistent with the Federal Child Support Guidelines, SOR/97-175.`;
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
