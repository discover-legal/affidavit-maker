// templates/states/alberta/DivorceDecreeTemplate.js
// Alberta divorce judgment template
// Governing Law: Divorce Act (RSC 1985, c. 3); Alberta Rules of Court, Alta Reg 124/2010

'use strict';

const BaseDivorceDecreeTemplate = require('../../core/BaseDivorceDecreeTemplate');
const { resolveCustodyArrangement, resolvePrimaryResidenceName } = require('../../core/parenting');
const { asList } = require('../../core/dataShapes');
const { resolveSpousalSupportDecision } = require('../../core/spousalSupport');
const {
  custodyDisputePosition,
  incomeImputationPosition,
  normalizeCanadianDivorceData,
} = require('../../core/canadianHelpers');

/**
 * Alberta Divorce Judgment Template
 *
 * Alberta's Court of King's Bench issues a "Divorce Judgment" as the final order.
 * Uncontested divorces may proceed by way of desk application (without a hearing).
 *
 * Key Legal References:
 * - Divorce Act, RSC 1985, c. 3
 *   - s.10: Duty to consider children's arrangements
 *   - s.12: Effective date 31 days after judgment
 *   - s.12(7): Certificate of Divorce — issued by court registrar after effective date
 * - Family Property Act, RSA 2000, c. F-4.7 (equal division of family property)
 * - Family Law Act, SA 2003, c. F-4.5 (parenting, support)
 * - Alberta Rules of Court, Alta Reg 124/2010
 *
 * Note: The court title changed from "Court of Queen's Bench" to
 * "Court of King's Bench of Alberta" in September 2022 upon accession of King Charles III.
 *
 * @class AlbertaDivorceDecreeTemplate
 * @extends BaseDivorceDecreeTemplate
 */
class AlbertaDivorceDecreeTemplate extends BaseDivorceDecreeTemplate {
  constructor() {
    super();

    this.state = 'AB';
    this.stateName = 'Alberta';
    this.countryCode = 'CA';
    this.documentTitle = 'DIVORCE JUDGMENT';

    // Canadian civil-action terminology: parties are Plaintiff/Defendant;
    // self-represented filers are "Self-Represented" (not "Pro Se"); the
    // caption's court-name line carries the venue so the "STATE OF" /
    // "COUNTY OF" header/venue lines are suppressed. This is required so
    // the base class's `generateAppearancesSection` renders Plaintiff /
    // Defendant / Self-Represented instead of the US-default Petitioner /
    // Respondent / Pro Se.
    this.terminology = {
      ...this.terminology,
      jurisdictionLabel: null,
      jurisdictionTerm: 'Province',
      districtLabel: null,
      districtTerm: 'Judicial district',
      districtStyle: 'plain',
      districtPlaceholder: '[JUDICIAL DISTRICT]',
      filerLabel: 'Plaintiff',
      responderLabel: 'Defendant',
      selfRepresentedLabel: 'Self-Represented',
    };

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
      'caseNumber',
      'marriageDate'
    ];

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
   * Alberta document header uses "PROVINCE OF ALBERTA" (not "STATE OF").
   * @returns {string} Header text
   */
  generateHeader() {
    return 'PROVINCE OF ALBERTA';
  }

  /**
   * Alberta venue uses judicial district, not "COUNTY OF".
   * @param {string} county - Judicial district
   * @returns {string} Venue text
   */
  generateVenue(county) {
    const district = (county || '[JUDICIAL DISTRICT]').toUpperCase();
    return `JUDICIAL DISTRICT OF ${district}`;
  }

  /**
   * Alberta case caption uses Plaintiff/Defendant labels
   * (Alberta Rules of Court, Alta Reg 124/2010 — divorce actions are commenced by
   * Statement of Claim, hence Plaintiff/Defendant).
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Case caption
   */
  generateCaseCaption(divorceData) {
    const courtName = (divorceData.court || this.getDefaultCourt(divorceData.county)).toUpperCase();
    const caseLabel = this.getCaseNumberLabel();
    // Action Number is often unknown at draft time — render a visible
    // fill-in blank plus a Draft note rather than a `[CASE NUMBER]`
    // sentinel that the generate-route denylist catches as 422 (mirrors
    // the ON v8-D Divorce Order pattern).
    const hasCaseNumber = typeof divorceData.caseNumber === 'string'
      && divorceData.caseNumber.trim().length > 0;
    const caseNumber = hasCaseNumber ? divorceData.caseNumber : '______________________';
    const caseDraftNote = hasCaseNumber
      ? ''
      : '\n(Draft — insert case number before filing)';
    const plaintiff = (divorceData.petitionerName || '[PLAINTIFF NAME]').toUpperCase();
    const defendant = (divorceData.respondentName || '[DEFENDANT NAME]').toUpperCase();

    const formatted = (
      `IN THE ${courtName}\n\n` +
      `${caseLabel} ${caseNumber}${caseDraftNote}\n\n` +
      `IN THE MATTER OF THE DIVORCE ACT, RSC 1985, c. 3\n\n` +
      `BETWEEN:\n\n` +
      `${plaintiff}\n` +
      `Plaintiff\n\n` +
      `— and —\n\n` +
      `${defendant}\n` +
      `Defendant`
    );

    return {
      courtName,
      caseNumber: divorceData.caseNumber,
      petitioner: divorceData.petitionerName,
      respondent: divorceData.respondentName,
      formatted
    };
  }

  /**
   * Alberta property division under the Family Property Act, RSA 2000, c. F-4.7.
   * Family property is subject to equitable distribution (not strict 50/50).
   * "Community property" language must not appear.
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Property division section
   */
  generatePropertyDivisionSection(divorceData) {
    const items = [];

    // SAFETY GATE (attorney review, 2026-08): mirror the base — a nil
    // family-property finding waives distribution claims and may render
    // ONLY on an affirmative user-confirmed statement.
    const nilPropertyConfirmed =
      divorceData.hasProperty === false &&
      (divorceData.noPropertyConfirmed === true ||
        (typeof divorceData.propertyAgreement === 'string' &&
          divorceData.propertyAgreement.trim() !== ''));
    if (nilPropertyConfirmed) {
      items.push({
        content: 'The Court finds there is no family property to be distributed under the Family Property Act, RSA 2000, c. F-4.7.',
        type: 'finding'
      });
    } else if (divorceData.hasProperty === false) {
      items.push({
        content: '________________________________________\n(Draft — confirm whether you and your spouse have family property to distribute under the Family Property Act, RSA 2000, c. F-4.7, or a written agreement, before filing. Silence on this line may be treated as no property, waiving your claim.)',
        type: 'property_draft_note'
      });
    } else {
      items.push({
        content: 'The Court has considered the distribution of family property pursuant to the Family Property Act, RSA 2000, c. F-4.7. Family property is subject to equitable distribution having regard to the contributions and circumstances of each spouse.',
        type: 'finding'
      });

      if (asList(divorceData.petitionerProperty).length > 0) {
        items.push({
          content: `IT IS ORDERED that the following property is awarded to ${divorceData.petitionerName || 'Plaintiff'} as that party's separate property:`,
          type: 'order'
        });
        asList(divorceData.petitionerProperty).forEach(prop => {
          items.push({ content: `- ${prop}`, type: 'property_item' });
        });
      }

      if (asList(divorceData.respondentProperty).length > 0) {
        items.push({
          content: `IT IS ORDERED that the following property is awarded to ${divorceData.respondentName || 'Defendant'} as that party's separate property:`,
          type: 'order'
        });
        asList(divorceData.respondentProperty).forEach(prop => {
          items.push({ content: `- ${prop}`, type: 'property_item' });
        });
      }

      if (!divorceData.petitionerProperty && !divorceData.respondentProperty) {
        items.push({
          content: 'IT IS ORDERED that each party retains the personal property currently in that party\'s possession, subject to equitable distribution under the Family Property Act, RSA 2000, c. F-4.7.',
          type: 'order'
        });
      }
    }

    return { title: 'DIVISION OF FAMILY PROPERTY', items, type: 'property' };
  }

  /**
   * Alberta child parenting order uses 2021 Divorce Act terminology:
   * "decision-making responsibility" (s.16.1) replaces "custody";
   * "parenting time" (s.16.1) replaces "access".
   * @param {Object} divorceData - Divorce data
   * @returns {Object|null} Child parenting section or null if no children
   */
  generateChildCustodySection(divorceData) {
    if (divorceData.hasMinorChildren === false || !divorceData.children || divorceData.children.length === 0) {
      return null;
    }

    const items = [];

    items.push({
      content: 'The Court finds that the following parenting order is in the best interests of the child(ren) (Divorce Act, s.16):',
      type: 'finding'
    });

    items.push({ content: 'The child(ren) subject to this order:', type: 'order' });

    divorceData.children.forEach((child, index) => {
      // Child NAME stays as `[CHILD NAME]` (denylist catches it). Birth date
      // renders as a visible fill-in blank + Draft note rather than the
      // `[BIRTH DATE]` sentinel (mirrors ON v8-D / GA v18-C).
      let childInfo;
      if (typeof child === 'string') {
        childInfo = child;
      } else {
        const childDob = this.formatDate(child.birthDate ?? child.dob ?? child.dateOfBirth);
        const dobDisplay = childDob || '__________________';
        const draftNote = childDob ? '' : '\n(Draft — insert exact date of birth before filing)';
        childInfo = `${child.name || '[CHILD NAME]'}, born ${dobDisplay}${draftNote}`;
      }
      items.push({ content: `${index + 1}. ${childInfo}`, type: 'child_item' });
    });

    // Safety rule (mirrors the base class): only positively recognized
    // custody values render a joint or sole order. Legacy free text like
    // "joint decision making" maps to the joint branch; anything ambiguous
    // renders neutral as-agreed language with a placeholder — NEVER a sole
    // order (see templates/core/parenting.js).
    const custody = resolveCustodyArrangement(divorceData);
    const residenceName = resolvePrimaryResidenceName(divorceData);
    let soleCustodianName = null;
    if (custody.kind === 'joint') {
      items.push({
        content: `IT IS ORDERED that ${divorceData.petitionerName || 'Plaintiff'} and ${divorceData.respondentName || 'Defendant'} shall have shared decision-making responsibility for the child(ren) pursuant to the Divorce Act, RSC 1985, c. 3, s.16.1.`,
        type: 'order'
      });
      // Primary residence in the joint branch also comes from the explicit
      // primaryResidence fact — no defaulting to the Plaintiff.
      if (residenceName) {
        items.push({
          content: `IT IS ORDERED that the child(ren) shall primarily reside with ${residenceName}, who shall have primary parenting time.`,
          type: 'order'
        });
      } else {
        items.push({
          content:
            'IT IS ORDERED that the parties shall determine the child(ren)\'s primary residence ' +
            'by agreement, or, failing agreement, in accordance with a parenting schedule filed ' +
            'with this Court: [PRIMARY RESIDENCE — set out the parent with whom the child(ren) ' +
            'primarily reside].',
          type: 'order'
        });
      }
    } else if (custody.kind === 'sole_petitioner' || custody.kind === 'sole_respondent' || custody.kind === 'legacy_sole') {
      const custodianName =
        custody.kind === 'sole_petitioner'
          ? (divorceData.petitionerName || 'Plaintiff')
          : custody.kind === 'sole_respondent'
            ? (divorceData.respondentName || 'Defendant')
            : (resolvePrimaryResidenceName(divorceData) || divorceData.petitionerName || 'Plaintiff');
      const otherParentName =
        custody.kind === 'sole_respondent'
          ? (divorceData.petitionerName || 'Plaintiff')
          : (divorceData.respondentName || 'Defendant');
      soleCustodianName = custodianName;
      items.push({
        content: `IT IS ORDERED that ${custodianName} shall have sole decision-making responsibility for the child(ren) pursuant to the Divorce Act, RSC 1985, c. 3, s.16.1.`,
        type: 'order'
      });
      items.push({
        content: `IT IS ORDERED that ${otherParentName} shall have parenting time with the child(ren) as agreed by the parties or as set out in a parenting schedule attached to this Order.`,
        type: 'order'
      });
    } else {
      // Unrecognized/undecided arrangement — neutral order with an explicit
      // placeholder for the parties' actual agreement. Never default to sole.
      items.push({
        content: 'IT IS ORDERED that the parties shall exercise decision-making responsibility for the child(ren) as agreed by the parties: [ARRANGEMENT — set out the parties\' decision-making agreement] (Divorce Act, RSC 1985, c. 3, s.16.1).',
        type: 'order'
      });
    }

    // Primary residence: ordered whenever the case data says where the
    // child(ren) live, regardless of the custody branch. (The joint branch
    // keeps its historical wording and fallbacks unchanged.)
    if (custody.kind !== 'joint' && residenceName && residenceName !== soleCustodianName) {
      items.push({
        content: `IT IS ORDERED that the child(ren) shall primarily reside with ${residenceName}, who shall have primary parenting time.`,
        type: 'order'
      });
    }

    items.push({ content: this.getVisitationLanguage(divorceData), type: 'order' });

    return { title: 'PARENTING ORDER', items, type: 'custody' };
  }

  /**
   * Alberta parenting time language — uses Divorce Act 2021 terminology.
   * @param {Object} divorceData - Divorce data
   * @returns {string} Parenting time language
   */
  getVisitationLanguage(divorceData) {
    return 'IT IS ORDERED that each party shall have parenting time with the child(ren) as agreed in writing by the parties, or, failing agreement, as set out in a parenting schedule filed with this Court. Neither party shall do anything to alienate the child(ren)\'s affection for the other party (Divorce Act, s.16.3).';
  }

  /**
   * Alberta child support order pursuant to Divorce Act s.15.1 and the Federal
   * Child Support Guidelines, SOR/97-175.
   * @param {Object} divorceData - Divorce data
   * @returns {Object|null} Child support section or null if no children
   */
  generateChildSupportSection(divorceData) {
    if (divorceData.hasMinorChildren === false || !divorceData.children || divorceData.children.length === 0) {
      return null;
    }

    const items = [];

    if (divorceData.childSupportAmount) {
      items.push({
        content: `IT IS ORDERED pursuant to s.15.1 of the Divorce Act, RSC 1985, c. 3, and the Federal Child Support Guidelines, SOR/97-175, that ${divorceData.childSupportObligor || divorceData.respondentName || 'Defendant'} shall pay to ${divorceData.childSupportObligee || divorceData.petitionerName || 'Plaintiff'} child support in the amount of $${divorceData.childSupportAmount} per month.`,
        type: 'order'
      });
    } else {
      items.push({
        content: 'IT IS ORDERED pursuant to s.15.1 of the Divorce Act, RSC 1985, c. 3, that child support shall be paid in accordance with the Federal Child Support Guidelines, SOR/97-175.',
        type: 'order'
      });
    }

    items.push({
      content: `IT IS ORDERED that ${divorceData.healthInsuranceProvider || 'the support payor'} shall maintain health and dental coverage for the minor child(ren) where available at a reasonable cost through an employer or group plan.`,
      type: 'order'
    });

    return { title: 'CHILD SUPPORT', items, type: 'child_support' };
  }

  /**
   * Alberta spousal support order pursuant to Divorce Act s.15.2.
   * @param {Object} divorceData - Divorce data
   * @returns {Object|null} Spousal support section or null if not applicable
   */
  generateSpousalSupportSection(divorceData) {
    // Route through the shared safety-gated resolver so a false waiver
    // from silence can NEVER render — matches the ON override and the
    // 2026-08 attorney-review requirement.
    const decision = resolveSpousalSupportDecision(divorceData);
    if (decision.outcome === 'none') return null;

    const items = [];
    const payor = decision.payor || divorceData.respondentName || 'Defendant';
    const payee = decision.payee || divorceData.petitionerName || 'Plaintiff';

    if (decision.outcome === 'award') {
      items.push({
        content: `IT IS ORDERED pursuant to s.15.2 of the Divorce Act, RSC 1985, c. 3, that ${payor} shall pay spousal support to ${payee} in the amount of $${decision.amount || '[AMOUNT]'} per month for ${decision.duration || '[DURATION]'}.`,
        type: 'order'
      });
    } else if (decision.outcome === 'reserve') {
      items.push({
        content: `IT IS ORDERED that the Court reserves jurisdiction over spousal support under s.15.2 of the Divorce Act, RSC 1985, c. 3, ${payee} having claimed support with no specific amount yet on file; the amount and duration shall be set by the Court.`,
        type: 'order'
      });
    } else if (decision.outcome === 'waive') {
      items.push({
        content: 'IT IS ORDERED that each party waives and releases any claim for spousal support from the other party under s.15.2 of the Divorce Act, RSC 1985, c. 3, now and in the future.',
        type: 'order'
      });
    }

    return { title: 'SPOUSAL SUPPORT', items, type: 'spousal_support' };
  }

  /**
   * Alberta final orders section — avoids US "decree" and "final judgment" language.
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Final orders section
   */
  generateFinalOrdersSection(divorceData) {
    const items = [];

    items.push({
      content: 'IT IS ORDERED that all corollary relief requested in this proceeding and not expressly granted is dismissed.',
      type: 'order'
    });

    items.push({
      content: 'IT IS ORDERED that this Divorce Judgment constitutes the final order in this proceeding and disposes of all matters between the parties.',
      type: 'order'
    });

    items.push({
      content: 'IT IS ORDERED that each party shall execute and deliver such further documents and do such further acts as may be necessary to give effect to the terms of this Order.',
      type: 'order'
    });

    items.push({
      content: this.getEffectiveDateText(),
      type: 'order'
    });

    items.push({
      content: this.getCertificateNote(),
      type: 'order'
    });

    return { title: 'FINAL ORDERS', items, type: 'final_orders' };
  }

  getEffectiveDateText() {
    return 'This Divorce Judgment takes effect on the 31st day after it is made, unless appealed or the effective date is varied by order (Divorce Act, s.12(1)).';
  }

  getCertificateNote() {
    return 'A Certificate of Divorce may be obtained from the court office after the effective date, upon application by either party (Divorce Act, s.12(7)).';
  }

  /**
   * Alberta dissolution — Canadian "IT IS ORDERED" phrasing under Divorce Act
   * s.8; drops the base class's US "IT IS ORDERED AND DECREED" formulation
   * and cites the King's Bench Divorce Judgment framework.
   */
  generateDissolutionSection(divorceData) {
    const plaintiff = divorceData.petitionerName || '_________________________________';
    const defendant = divorceData.respondentName || '_________________________________';
    return {
      title: 'DIVORCE GRANTED',
      text:
        `IT IS ORDERED that the marriage between ${plaintiff} and ${defendant} is dissolved ` +
        'pursuant to section 8 of the Divorce Act, RSC 1985, c. 3, and that a Divorce Judgment ' +
        'shall issue, taking effect on the 31st day after it is made (Divorce Act, s.12(1)).',
      type: 'dissolution'
    };
  }

  /**
   * Alberta respondent-appearance recital in Canadian civil-action vocabulary.
   * The base class's "although duly cited … wholly made default" is US
   * criminal-writ language; Alberta divorce is a civil action under the
   * Rules of Court and defaults are noted as "duly served with the
   * Statement of Claim and did not file a Statement of Defence within the
   * time provided".
   */
  getRespondentAppearanceText(divorceData) {
    const uncontested = divorceData.appearanceType === 'agreed' || divorceData.isUncontested;
    if (divorceData.respondentAppeared) {
      return uncontested ? 'appeared and consented to the terms of this Judgment' : 'appeared';
    }
    const method = typeof divorceData.serviceMethod === 'string'
      ? divorceData.serviceMethod.trim().toLowerCase()
      : '';
    const defaulted =
      divorceData.respondentDefaulted === true ||
      divorceData.defaultJudgment === true ||
      divorceData.appearanceType === 'default';

    if (method === 'waiver') {
      return uncontested
        ? 'accepted service of the Statement of Claim and consents to the terms of this Judgment'
        : 'accepted service of the Statement of Claim';
    }
    if (method === 'publication') {
      return defaulted
        ? 'was served by substituted service or publication and did not file a Statement of Defence'
        : 'was served by substituted service or publication';
    }
    if (method === 'formal') {
      if (defaulted) {
        return 'was duly served with the Statement of Claim and did not file a Statement of Defence within the time provided';
      }
      return uncontested
        ? 'was duly served with the Statement of Claim and consents to the terms of this Judgment'
        : 'was duly served with the Statement of Claim';
    }
    if (defaulted) {
      return 'was duly served with the Statement of Claim and did not file a Statement of Defence within the time provided';
    }
    return uncontested
      ? 'was served with the Statement of Claim and does not oppose the relief sought'
      : 'was served with the Statement of Claim';
  }

  /**
   * generateDocument override: alias-normalize the incoming data (Action No.,
   * marriage year, separation date, children DOBs) and splice a
   * CONTESTED ISSUES section carrying the party's parenting-dispute /
   * s.19 imputation positions.
   */
  generateDocument(divorceData = {}) {
    const data = normalizeCanadianDivorceData(divorceData);
    const doc = super.generateDocument(data);
    appendContestedIssuesAlbertaDecree(doc, data);
    return doc;
  }
}

function appendContestedIssuesAlbertaDecree(doc, data) {
  const custody = custodyDisputePosition(data);
  const imputation = incomeImputationPosition(data);
  if (!custody && !imputation) return;
  const items = [];
  if (custody) {
    items.push({
      content:
        `The Court has considered the Plaintiff's contested parenting-time position: ${custody}. ` +
        `The Court makes a parenting order under section 16.5 of the Divorce Act on the basis of ` +
        `changed circumstances in the best interests of the child(ren) (Divorce Act, s.16(2)).`,
      type: 'contested_issue',
    });
  }
  if (imputation) {
    items.push({
      content:
        `IT IS ORDERED, pursuant to section 19 of the Federal Child Support Guidelines, ` +
        `SOR/97-175, that income is imputed to the child-support payor on the following basis: ` +
        `${imputation}.`,
      type: 'contested_issue',
    });
  }
  doc.sections = doc.sections || {};
  doc.sections.contestedIssues = { title: 'CONTESTED ISSUES', items };
  if (typeof doc.fullText === 'string') {
    let block = 'CONTESTED ISSUES\n\n';
    for (const item of items) block += `${item.content}\n\n`;
    doc.fullText += `\n${block}`;
  }
}

module.exports = AlbertaDivorceDecreeTemplate;
