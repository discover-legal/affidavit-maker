// templates/states/ontario/DivorceDecreeTemplate.js
// Ontario divorce judgment template
// Governing Law: Divorce Act (RSC 1985, c. 3); Family Law Rules, O. Reg. 114/99

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
 * Ontario Divorce Judgment Template
 *
 * In Ontario, the final divorce order is called a "Divorce Order" (not "Decree").
 * It is issued by the Superior Court of Justice. In uncontested cases, it is typically
 * granted on the papers without a hearing (using a Divorce Order Endorsement form).
 *
 * The Divorce Order becomes effective 31 days after it is made (Divorce Act, s.12(1))
 * unless both spouses waive that period or the court reduces it.
 *
 * Key Legal References:
 * - Divorce Act, RSC 1985, c. 3
 *   - s.10: Duty of court — consider possibility of reconciliation, ensure reasonable
 *     arrangements for children
 *   - s.12: Effective date of divorce — 31 days after judgment unless varied
 *   - s.12(7): Certificate of divorce — issued by registrar after effective date
 * - Family Law Act, RSO 1990, c. F.3 (property and spousal support)
 * - Family Law Rules, O. Reg. 114/99 (Form 25A — Divorce Order)
 *
 * @class OntarioDivorceDecreeTemplate
 * @extends BaseDivorceDecreeTemplate
 */
class OntarioDivorceDecreeTemplate extends BaseDivorceDecreeTemplate {
  constructor() {
    super();

    this.state = 'ON';
    this.stateName = 'Ontario';
    this.countryCode = 'CA';
    this.documentTitle = 'DIVORCE ORDER';

    // Canadian terminology (see templates/core/terminology.js): parties are
    // Applicant/Respondent (Family Law Rules, O. Reg. 114/99), venue is a
    // court location rather than a county, filers are "Self-Represented".
    this.terminology = {
      ...this.terminology,
      jurisdictionTerm: 'Province',
      districtTerm: 'Court location',
      districtStyle: 'plain',
      districtPlaceholder: '[COURT LOCATION]',
      filerLabel: 'Applicant',
      responderLabel: 'Respondent',
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
    return 'Court File No.:';
  }

  getDefaultCourt(county) {
    const city = (county || '[CITY]').toUpperCase();
    return `SUPERIOR COURT OF JUSTICE — ${city}`;
  }

  /**
   * Ontario document header uses "PROVINCE OF ONTARIO" (not "STATE OF").
   * @returns {string} Header text
   */
  generateHeader() {
    return 'PROVINCE OF ONTARIO';
  }

  /**
   * Ontario venue uses judicial district/city, not "COUNTY OF".
   * @param {string} county - City or judicial district
   * @returns {string} Venue text
   */
  generateVenue(county) {
    const location = (county || '[JUDICIAL DISTRICT]').toUpperCase();
    return `${location}`;
  }

  /**
   * Ontario case caption uses Applicant/Respondent labels (Family Law Rules, O. Reg. 114/99).
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Case caption
   */
  generateCaseCaption(divorceData) {
    const courtName = (divorceData.court || this.getDefaultCourt(divorceData.county)).toUpperCase();
    const caseLabel = this.getCaseNumberLabel();
    // Ontario decrees are commonly assembled before the court has assigned a
    // Court File No. — render a visible fill-in-by-hand blank plus a drafter
    // note rather than the `[CASE NUMBER]` sentinel token, which the
    // generate route's PLACEHOLDER_DENYLIST would (correctly) refuse. The
    // packet path already sanitizes tokens to blanks in pdfService; this
    // brings the per-document path in line for the case-number field.
    const hasCaseNumber = typeof divorceData.caseNumber === 'string'
      && divorceData.caseNumber.trim().length > 0;
    const caseNumber = hasCaseNumber ? divorceData.caseNumber : '______________________';
    const draftNote = hasCaseNumber
      ? ''
      : '(Draft — insert case number before filing)\n';
    const applicant = (divorceData.petitionerName || '[APPLICANT NAME]').toUpperCase();
    const respondent = (divorceData.respondentName || '[RESPONDENT NAME]').toUpperCase();

    const formatted = (
      `IN THE ${courtName}\n\n` +
      `${caseLabel} ${caseNumber}\n` +
      `${draftNote}` +
      `\nIN THE MATTER OF THE DIVORCE ACT, RSC 1985, c. 3\n\n` +
      `BETWEEN:\n\n` +
      `${applicant}\n` +
      `Applicant\n\n` +
      `— and —\n\n` +
      `${respondent}\n` +
      `Respondent`
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
   * Ontario property division under the Family Law Act, RSO 1990, c. F.3.
   * Equalization of net family property (NFP): the spouse with the higher NFP
   * pays an equalization payment equal to half the difference (s.5).
   * "Community property" language must not appear — Ontario uses equalization, not community property.
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Property division section
   */
  generatePropertyDivisionSection(divorceData) {
    const items = [];

    // SAFETY GATE (attorney review, 2026-08): mirror the base — a nil
    // equalization finding waives NFP claims and may render ONLY on an
    // affirmative user-confirmed statement (`hasProperty === false` PLUS
    // `noPropertyConfirmed === true` or a described propertyAgreement).
    const nilPropertyConfirmed =
      divorceData.hasProperty === false &&
      (divorceData.noPropertyConfirmed === true ||
        (typeof divorceData.propertyAgreement === 'string' &&
          divorceData.propertyAgreement.trim() !== ''));
    if (nilPropertyConfirmed) {
      items.push({
        content: 'The Court finds there is no net family property to be equalized under the Family Law Act, RSO 1990, c. F.3.',
        type: 'finding'
      });
    } else if (divorceData.hasProperty === false) {
      items.push({
        content: '________________________________________\n(Draft — confirm whether you and your spouse have net family property to equalize under the Family Law Act, RSO 1990, c. F.3, or a written agreement, before filing. Silence on this line may be treated as no equalization owing, waiving your claim.)',
        type: 'property_draft_note'
      });
    } else {
      items.push({
        content: 'The Court has considered the equalization of the parties\' net family property pursuant to the Family Law Act, RSO 1990, c. F.3, s.5.',
        type: 'finding'
      });

      if (divorceData.equalizationPayment) {
        items.push({
          content: `IT IS ORDERED that ${divorceData.equalizationPayor || divorceData.respondentName || 'Respondent'} shall pay to ${divorceData.equalizationPayee || divorceData.petitionerName || 'Applicant'} an equalization payment of $${divorceData.equalizationPayment} pursuant to s.5 of the Family Law Act, RSO 1990, c. F.3.`,
          type: 'order'
        });
      }

      if (asList(divorceData.petitionerProperty).length > 0) {
        items.push({
          content: `IT IS ORDERED that the following property is awarded to ${divorceData.petitionerName || 'Applicant'} as that party's exclusive property:`,
          type: 'order'
        });
        asList(divorceData.petitionerProperty).forEach(prop => {
          items.push({ content: `- ${prop}`, type: 'property_item' });
        });
      }

      if (asList(divorceData.respondentProperty).length > 0) {
        items.push({
          content: `IT IS ORDERED that the following property is awarded to ${divorceData.respondentName || 'Respondent'} as that party's exclusive property:`,
          type: 'order'
        });
        asList(divorceData.respondentProperty).forEach(prop => {
          items.push({ content: `- ${prop}`, type: 'property_item' });
        });
      }

      if (!divorceData.petitionerProperty && !divorceData.respondentProperty && !divorceData.equalizationPayment) {
        items.push({
          content: 'IT IS ORDERED that each party retains the personal property currently in that party\'s possession, subject to any equalization payment required under the Family Law Act, RSO 1990, c. F.3.',
          type: 'order'
        });
      }
    }

    return { title: 'DIVISION OF PROPERTY', items, type: 'property' };
  }

  /**
   * Ontario child custody section uses 2021 Divorce Act terminology:
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
      // Child NAME stays as `[CHILD NAME]` — a decree with an unnamed child
      // is genuinely defective and must trip the denylist. Birth date, by
      // contrast, is frequently unknown at draft time (adoption records
      // pending, foreign birth certificate not translated); render a visible
      // blank instead of a `[BIRTH DATE]` sentinel that would 422 the whole
      // decree — matches the packet path's sanitizer behaviour.
      const childDob = this.formatDate(child.birthDate ?? child.dob ?? child.dateOfBirth);
      const dobDisplay = childDob || '__________________';
      const childInfo = typeof child === 'string'
        ? child
        : `${child.name || '[CHILD NAME]'}, born ${dobDisplay}`;
      items.push({ content: `${index + 1}. ${childInfo}`, type: 'child_item' });
    });

    // Safety rule (mirrors the base class): only positively recognized
    // custody values render a shared or sole decision-making order. Legacy
    // free text like "joint decision making" maps to the shared branch;
    // anything ambiguous renders neutral as-agreed language with a
    // placeholder — NEVER a sole order (see templates/core/parenting.js).
    const custody = resolveCustodyArrangement(divorceData);
    const residenceName = resolvePrimaryResidenceName(divorceData);
    let soleCustodianName = null;

    if (custody.kind === 'joint') {
      items.push({
        content: `IT IS ORDERED that ${divorceData.petitionerName || 'Applicant'} and ${divorceData.respondentName || 'Respondent'} shall have shared decision-making responsibility for the child(ren) pursuant to the Divorce Act, RSC 1985, c. 3, s.16.1.`,
        type: 'order'
      });
    } else if (custody.kind === 'sole_petitioner' || custody.kind === 'sole_respondent' || custody.kind === 'legacy_sole') {
      const custodianName =
        custody.kind === 'sole_petitioner'
          ? (divorceData.petitionerName || 'Applicant')
          : custody.kind === 'sole_respondent'
            ? (divorceData.respondentName || 'Respondent')
            : (resolvePrimaryResidenceName(divorceData) || divorceData.petitionerName || 'Applicant');
      const otherParentName =
        custody.kind === 'sole_respondent'
          ? (divorceData.petitionerName || 'Applicant')
          : (divorceData.respondentName || 'Respondent');
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

    // Primary residence: ALWAYS derived from the explicit
    // primaryResidence / primaryCustodian fact (resolvePrimaryResidenceName),
    // never auto-derived from the custody-kind enum. The Marcus/Priya audit
    // (2026-08) surfaced the ON decree naming Marcus (respondent) as primary
    // parent whenever custody.kind resolved to 'sole_respondent' — even
    // though the transcript said the children lived mostly with Priya
    // (applicant). If the parties' own arrangement conflicts with the sole-
    // custody enum, the arrangement wins and no primary residence line is
    // rendered without it: a placeholder is truthful; a wrong parent's name
    // is not.
    if (residenceName) {
      items.push({
        content: `IT IS ORDERED that the child(ren) shall primarily reside with ${residenceName}, who shall have primary parenting time.`,
        type: 'order'
      });
    } else if (custody.kind === 'joint') {
      items.push({
        content:
          'IT IS ORDERED that the parties shall determine the child(ren)\'s primary residence ' +
          'by agreement, or, failing agreement, in accordance with a parenting schedule filed ' +
          'with this Court: [PRIMARY RESIDENCE — set out the parent with whom the child(ren) ' +
          'primarily reside].',
        type: 'order'
      });
    }

    items.push({ content: this.getVisitationLanguage(divorceData), type: 'order' });

    return { title: 'PARENTING ORDER', items, type: 'custody' };
  }

  /**
   * Ontario recital of the Respondent's service/appearance status, in
   * Application/Answer vocabulary (Family Law Rules, O. Reg. 114/99).
   * serviceMethod enum: 'waiver' | 'formal' | 'publication' | 'undecided'
   * ("spouse will accept the papers" is stored as 'waiver'). Non-response
   * is recited only when the data affirmatively says so — never as a
   * fallback for missing data.
   * @param {Object} divorceData - Divorce data
   * @returns {string} Recital fragment following "Respondent, <name>, …"
   */
  getRespondentAppearanceText(divorceData) {
    const uncontested = divorceData.appearanceType === 'agreed' || divorceData.isUncontested;
    if (divorceData.respondentAppeared) {
      return uncontested ? 'appeared and consented to the terms of this Order' : 'appeared';
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
        ? 'accepted service of the Application and consents to the terms of this Order'
        : 'accepted service of the Application';
    }
    if (method === 'publication') {
      return defaulted
        ? 'was served by substituted service or publication and did not file an Answer'
        : 'was served by substituted service or publication';
    }
    if (method === 'formal') {
      if (defaulted) {
        return 'was duly served with the Application and did not file an Answer within the time provided';
      }
      return uncontested
        ? 'was duly served with the Application and consents to the terms of this Order'
        : 'was duly served with the Application';
    }

    if (defaulted) {
      return 'was duly served with the Application and did not file an Answer within the time provided';
    }
    return uncontested
      ? 'was served with the Application and does not oppose the relief sought'
      : 'was served with the Application';
  }

  /**
   * Ontario parenting time language — uses Divorce Act 2021 "parenting time", not "access".
   * @param {Object} divorceData - Divorce data
   * @returns {string} Parenting time language
   */
  getVisitationLanguage(divorceData) {
    // A substantive parentTimeDetails string (alt Fri–Sun + Wed dinners,
    // holiday rotations) belongs verbatim in the order — the boilerplate
    // "as agreed in writing" clause dropped it entirely (live Ontario audit,
    // 2026-08). Extraction phrases the value in neutral third-person court
    // language, so it renders as-is.
    const details = typeof divorceData.parentTimeDetails === 'string'
      ? divorceData.parentTimeDetails.trim()
      : '';
    const nonAlienation = " Neither party shall do anything to alienate the child(ren)'s affection for the other party (Divorce Act, s.16.3).";
    if (details.length > 50) {
      return `IT IS ORDERED pursuant to s.16.1 of the Divorce Act that each party shall have parenting time with the child(ren) on the following schedule: ${details} In the absence of written agreement to vary the schedule, the terms above control.${nonAlienation}`;
    }
    return 'IT IS ORDERED that each party shall have parenting time with the child(ren) as agreed in writing by the parties, or, failing agreement, in accordance with a parenting schedule to be filed with this Court.' + nonAlienation;
  }

  /**
   * Ontario child support order pursuant to Divorce Act s.15.1 and the Federal
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
        content: `IT IS ORDERED pursuant to s.15.1 of the Divorce Act, RSC 1985, c. 3, and the Federal Child Support Guidelines, SOR/97-175, that ${divorceData.childSupportObligor || divorceData.respondentName || 'Respondent'} shall pay to ${divorceData.childSupportObligee || divorceData.petitionerName || 'Applicant'} child support in the amount of $${divorceData.childSupportAmount} per month.`,
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
   * Ontario spousal support order pursuant to Divorce Act s.15.2 and
   * Spousal Support Advisory Guidelines.
   * @param {Object} divorceData - Divorce data
   * @returns {Object|null} Spousal support section or null if not applicable
   */
  generateSpousalSupportSection(divorceData) {
    // Precedence (see templates/core/spousalSupport.js): a contested
    // request-plus-amount renders the AWARD, even absent an explicit
    // spousalSupportAwarded flag — the live Ontario audit surfaced a
    // $1,800/mo request being rendered as a mutual waiver.
    const decision = resolveSpousalSupportDecision(divorceData);
    if (decision.outcome === 'none') return null;

    const items = [];
    const payor = decision.payor || 'Respondent';
    const payee = decision.payee || 'Applicant';

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
   * Ontario final orders section — avoids US "decree" and "final judgment" language.
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
      content: 'IT IS ORDERED that this Divorce Order constitutes the final order in this proceeding and disposes of all matters between the parties.',
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

  /**
   * Ontario divorce effective date: 31 days after judgment (Divorce Act s.12(1)).
   * Parties may waive this period by written agreement (s.12(2)).
   */
  getEffectiveDateText() {
    return 'This Divorce Order takes effect on the 31st day after it is made, unless appealed or the effective date is varied by order (Divorce Act, s.12(1)).';
  }

  /**
   * Ontario uses "Certificate of Divorce" issued by the court registrar
   * after the effective date (Divorce Act, s.12(7)).
   */
  getCertificateNote() {
    return 'A Certificate of Divorce may be obtained from the court office after the effective date of this Order, upon application by either party (Divorce Act, s.12(7)).';
  }

  /**
   * Ontario dissolution section — Canadian "IT IS ORDERED" phrasing.
   * The base class emits "IT IS ORDERED AND DECREED that … is dissolved,
   * and the parties are divorced" — a US ("decree") formulation. Ontario
   * grants a Divorce Order under Divorce Act s.8, not a "decree", and the
   * order-granting language is bare "IT IS ORDERED".
   */
  generateDissolutionSection(divorceData) {
    const applicant = divorceData.petitionerName || '_________________________________';
    const respondent = divorceData.respondentName || '_________________________________';
    return {
      title: 'DIVORCE GRANTED',
      text:
        `IT IS ORDERED that the marriage between ${applicant} and ${respondent} is dissolved ` +
        'pursuant to section 8 of the Divorce Act, RSC 1985, c. 3, and that a Divorce Order shall ' +
        'issue, taking effect on the 31st day after it is made (Divorce Act, s.12(1)).',
      type: 'dissolution'
    };
  }

  /**
   * generateDocument override: alias-normalize the incoming case data so
   * Court File No., marriage year, separation date, and children DOBs stored
   * under legacy field names reach the template's rendering methods; then
   * splice a "CONTESTED ISSUES" section carrying the party's custody-dispute
   * and/or Federal Child Support Guidelines s.19 imputation positions.
   */
  generateDocument(divorceData = {}) {
    const data = normalizeCanadianDivorceData(divorceData);
    const doc = super.generateDocument(data);
    appendContestedIssuesOntarioDecree(doc, data);
    return doc;
  }
}

/**
 * "Wants X" scrubber (attorney round-2, Marcus, ON, 2026-08-30). The
 * contested-issue recital used to inline the raw profile string, which meant
 * an "IT IS ORDERED" clause could read as "The Respondent wants more
 * mid-week parenting time; the specific schedule remains to be proposed" —
 * a wish, not an order. Rewrite any leading "the X wants Y" phrasing into a
 * neutral "seeks Y" preamble and cut the "remains to be proposed" clause
 * (which is not something a court orders). Preserves the underlying
 * substance so the decree still records what the party is asking for.
 */
function neutralizePartyWish(text) {
  if (typeof text !== 'string') return '';
  let out = text.trim();
  out = out.replace(
    /\bthe\s+(applicant|respondent|petitioner)\s+wants\s+/i,
    'the $1 seeks ',
  );
  out = out.replace(/\bwants\b/gi, 'seeks');
  out = out.replace(
    /;?\s*the\s+specific\s+(?:schedule|arrangement|amount)\s+remains\s+to\s+be\s+(?:proposed|determined|filed|set)\.?\s*$/i,
    '',
  );
  return out.trim();
}

function appendContestedIssuesOntarioDecree(doc, data) {
  const custody = custodyDisputePosition(data);
  const imputation = incomeImputationPosition(data);
  if (!custody && !imputation) return;
  const items = [];
  if (custody) {
    // Attribute the position to whichever party actually holds it — the
    // template used to hard-code "Applicant's contested parenting-time
    // position", which lied when the respondent is the disputing party
    // (Marcus, ON). Fall back to a neutral "a party's" phrasing rather
    // than mis-attributing.
    const role = String(data.role || '').trim().toLowerCase();
    const attributedParty =
      role === 'respondent'
        ? "the Respondent's"
        : role === 'applicant' || role === 'petitioner'
          ? "the Applicant's"
          : "a party's";
    const cleaned = neutralizePartyWish(custody);
    items.push({
      // PREAMBLE / RECITAL — a court finding under s.16(2), not an
      // operative "IT IS ORDERED" clause. The decree's operative parenting
      // order still lives in generateChildCustodySection().
      content:
        `The Court has considered ${attributedParty} contested parenting-time ` +
        `position: ${cleaned}. The Court makes a parenting order under section ` +
        `16.5 of the Divorce Act on the basis of changed circumstances in the ` +
        `best interests of the child(ren) (Divorce Act, s.16(2)).`,
      type: 'contested_issue_preamble',
    });
  }
  if (imputation) {
    items.push({
      content:
        `IT IS ORDERED, pursuant to section 19 of the Federal Child Support Guidelines, ` +
        `SOR/97-175, that income is imputed to the child-support payor on the following basis: ` +
        `${neutralizePartyWish(imputation)}.`,
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

module.exports = OntarioDivorceDecreeTemplate;
