// templates/states/texas/DivorceDecreeTemplate.js
// Texas-specific final decree of divorce template
// Complies with Texas Family Code and Texas Rules of Civil Procedure

const BaseDivorceDecreeTemplate = require('../../core/BaseDivorceDecreeTemplate');
const { resolveCustodyArrangement, resolvePrimaryResidenceName } = require('../../core/parenting');
const { asList, partitionByCharacter } = require('../../core/dataShapes');
const { resolveSpousalSupportDecision } = require('../../core/spousalSupport');
const { resolveGroundsForDivorce } = require('./groundsResolver');

/**
 * Normalize service-method signals from a divorceData object into the
 * template's four-value enum ('waiver' | 'formal' | 'publication' |
 * 'undecided' | ''). Reads the canonical serviceMethod key first, then
 * falls back to snake_case (service_method), a legacy serviceType key,
 * an alternativeService flag, and finally infers 'publication' from
 * unknown-whereabouts phrasing in respondentAddress — the persona shape
 * that once still fell through to the bare-default fallback despite the
 * TRCP 109 branch existing (v5 audit, 2026-08-28 Mari case).
 *
 * @param {Object} data - divorceData blob passed to the appearances section
 * @returns {string} lowercase enum value ('' when nothing recognizable)
 */
function normalizeServiceMethod(data) {
  const norm = (v) => (typeof v === 'string' ? v.trim().toLowerCase() : '');

  // Direct enum keys, in precedence order.
  const raw =
    norm(data.serviceMethod) ||
    norm(data.service_method) ||
    norm(data.serviceType) ||
    norm(data.service_type);
  if (raw === 'waiver' || raw === 'formal' || raw === 'publication' || raw === 'undecided') {
    return raw;
  }

  // Textual synonyms — the extraction layer emits the enum code, but a
  // saved doc from an older path or a hand-edited affidavit blob may carry
  // free text. Preserve intent rather than falling through.
  if (raw) {
    if (/\bwaiv|\baccept|acknowledg|consent/.test(raw)) return 'waiver';
    if (/\bpublicat|\bpublish|newspaper|substituted|by\s+notice/.test(raw)) return 'publication';
    if (/\bformal|personal|process\s*server|sheriff|hand[\s-]*deliver|certified\s*mail/.test(raw)) {
      return 'formal';
    }
    if (/undecid|not\s+yet|unknown/.test(raw)) return 'undecided';
  }

  // Boolean/flag shapes that other paths sometimes set.
  if (data.alternativeService === true || data.serviceByPublication === true) return 'publication';
  if (data.waiverOfService === true || data.acceptedService === true) return 'waiver';

  // Whereabouts-unknown inference: when the address itself says the
  // respondent cannot be located AND no other service signal exists, TRCP
  // 109 publication is the mechanism a Texas litigant would use to move
  // forward. This is a defensive last resort — never fires when serviceMethod
  // is already set (handled above).
  const addr = norm(data.respondentAddress);
  const whereaboutsUnknown =
    data.respondentAddressUnknown === true ||
    data.respondentWhereaboutsUnknown === true ||
    (addr &&
      /^unknown\b|whereabouts\s+unknown|address\s+unknown|no\s+(known|current)\s+address|cannot\s+be\s+located/.test(
        addr,
      ));
  if (whereaboutsUnknown) return 'publication';

  return '';
}

/**
 * Texas Final Decree of Divorce Template
 *
 * Legal References:
 * - Texas Family Code Chapter 6 (Suit for Dissolution of Marriage)
 * - Texas Family Code § 6.702 (Waiting Period - 60 days)
 * - Texas Family Code § 7.001 (Property Division)
 * - Texas Family Code Chapter 153 (Conservatorship, Possession, Access)
 * - Texas Family Code Chapter 154 (Child Support)
 *
 * Formatting Requirements:
 * - 8.5" x 11" paper
 * - 1" margins on all sides
 * - 12-point font minimum
 * - Double-spaced text
 *
 * Texas-Specific Terms:
 * - "CAUSE NO." instead of "CASE NO."
 * - "Conservatorship" instead of "Custody"
 * - "Joint Managing Conservator" / "Sole Managing Conservator"
 * - "Possessory Conservator"
 * - Standard Possession Order (SPO)
 */
class TexasDivorceDecreeTemplate extends BaseDivorceDecreeTemplate {
  constructor() {
    super();

    this.state = 'TX';
    this.stateName = 'Texas';
    this.documentTitle = 'FINAL DECREE OF DIVORCE';

    // Load metadata if available
    try {
      this.metadata = require('./divorce-metadata.json');
    } catch (e) {
      this.metadata = null;
    }

    // Texas-specific required fields
    this.requiredFields = [
      'petitionerName',
      'respondentName',
      'state',
      'county',
      'caseNumber',
      'marriageDate'
    ];

    // Texas formatting requirements
    this.formatting = {
      fontSize: '12pt',
      fontFamily: 'Times New Roman',
      lineHeight: '2',
      margin: '1in',
      paperSize: '8.5in x 11in'
    };
  }

  /**
   * Get Texas case number label
   * @returns {string} "CAUSE NO."
   */
  getCaseNumberLabel() {
    return 'CAUSE NO.';
  }

  /**
   * Get default court for Texas county
   * @param {string} county - County name
   * @returns {string} Court name
   */
  getDefaultCourt(county) {
    const countyUpper = (county || '[COUNTY]').toUpperCase();
    return `DISTRICT COURT OF ${countyUpper} COUNTY, TEXAS`;
  }

  /**
   * Generate Texas-style header
   * @returns {string} Header text
   */
  generateHeader() {
    return 'THE STATE OF TEXAS';
  }

  /**
   * Generate Texas-style venue
   * @param {string} county - County name
   * @returns {string} Venue text
   */
  generateVenue(county) {
    const countyUpper = (county || '[COUNTY]').toUpperCase();
    return `COUNTY OF ${countyUpper}`;
  }

  /**
   * Generate Texas case caption
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Case caption
   */
  generateCaseCaption(divorceData) {
    let caption = '';

    const courtName = divorceData.court || this.getDefaultCourt(divorceData.county);
    caption += `IN THE ${courtName.toUpperCase()}\n\n`;

    const causeNumber = divorceData.caseNumber || '[CAUSE NUMBER]';
    caption += `CAUSE NO. ${causeNumber}\n\n`;

    caption += `IN THE MATTER OF\n`;
    caption += `THE MARRIAGE OF\n\n`;

    const petitioner = (divorceData.petitionerName || '[PETITIONER NAME]').toUpperCase();
    caption += `${petitioner}\n`;
    caption += `Petitioner,\n\n`;

    caption += `AND\n\n`;

    const respondent = (divorceData.respondentName || '[RESPONDENT NAME]').toUpperCase();
    caption += `${respondent}\n`;
    caption += `Respondent`;

    if (divorceData.hasMinorChildren === true && divorceData.children && divorceData.children.length > 0) {
      caption += `\n\nAND IN THE INTEREST OF\n`;
      divorceData.children.forEach((child, index) => {
        const childName = typeof child === 'string' ? child : (child.name || '[CHILD NAME]');
        caption += `${childName.toUpperCase()}${index < divorceData.children.length - 1 ? ',' : ''}\n`;
      });
      caption += `MINOR CHILD${divorceData.children.length > 1 ? 'REN' : ''}`;
    }

    return {
      courtName,
      caseNumber: divorceData.caseNumber,
      petitioner: divorceData.petitionerName,
      respondent: divorceData.respondentName,
      formatted: caption
    };
  }

  /**
   * Generate Texas appearances section
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Appearances section
   */
  generateAppearancesSection(divorceData) {
    let text = '';

    text += `On ${this.formatDate(divorceData.hearingDate) || '___________________'}, this case was called for trial.\n\n`;

    const petitioner = divorceData.petitionerName || 'Petitioner';
    const respondent = divorceData.respondentName || 'Respondent';
    const petitionerAppearance =
      divorceData.petitionerRepresentation === 'attorney' ? ' and through attorney of record' : ', pro se';

    // Truthful respondent appearance. serviceMethod 'publication' (TRCP 109
    // citation-by-publication) is NOT a default in itself — an attorney ad
    // litem is appointed for the respondent (TRCP 244). Default is recited
    // ONLY when the data affirmatively says so (live Texas audit, 2026-08).
    //
    // DEFENSIVE KEY NORMALIZATION (v5 audit, 2026-08-28): the live Mari
    // decree still fell through to "although duly cited, did not appear"
    // even though the persona said "his whereabouts are unknown, I'll need
    // publication". A signal recorded under a variant key (service_method
    // snake_case, serviceType, alternativeService), or a signal only
    // surfaced through respondentAddress (unknown-whereabouts), or a raw
    // enum stored with an alternate value ("publish", "citation by
    // publication", "newspaper") must still route to the publication
    // branch — never the bare-default fallback that misrecites a
    // publication case as a defaulted appearance.
    const method = normalizeServiceMethod(divorceData);
    const defaulted =
      divorceData.respondentDefaulted === true ||
      divorceData.defaultJudgment === true ||
      divorceData.appearanceType === 'default';

    let respondentLine;
    if (divorceData.respondentAppeared) {
      respondentLine = `${respondent} appeared in person and announced ready.`;
    } else if (method === 'waiver') {
      respondentLine = `${respondent} accepted service and waived further service of process, and has agreed to the terms of this decree.`;
    } else if (method === 'publication') {
      respondentLine = defaulted
        ? `${respondent}, having been served by publication pursuant to Tex. R. Civ. P. 109 and having failed to appear or answer, made default; an attorney ad litem was appointed pursuant to Tex. R. Civ. P. 244 to represent the interests of ${respondent}.`
        : `${respondent} was served by citation by publication pursuant to Tex. R. Civ. P. 109; an attorney ad litem was appointed pursuant to Tex. R. Civ. P. 244 to represent the interests of ${respondent}.`;
    } else if (defaulted) {
      respondentLine = `${respondent}, although duly cited, did not appear, and the Court proceeds to hear evidence and render judgment by default.`;
    } else if (divorceData.isUncontested || divorceData.appearanceType === 'agreed') {
      respondentLine = method === 'formal'
        ? `${respondent} was duly served and has agreed to the terms of this decree.`
        : `${respondent}, having been duly served, did not appear but signed a Waiver of Citation and Agreement.`;
    } else {
      respondentLine = `${respondent}, although duly cited, did not appear.`;
    }

    text += `${petitioner} appeared in person${petitionerAppearance}.\n\n`;
    text += `${respondentLine}\n\n`;
    text += `A jury was waived. All matters in controversy were submitted to the Court.`;

    return {
      title: 'APPEARANCES',
      text,
      type: 'appearances'
    };
  }

  /**
   * Generate Texas jurisdiction section
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Jurisdiction section
   */
  generateJurisdictionSection(divorceData) {
    return {
      title: 'JURISDICTION AND DOMICILE',
      text: `The Court finds that the pleadings of the parties are in due form and contain all the allegations, information, and prerequisites required by law. The Court finds that it has jurisdiction of this case and of all the parties and that at least sixty days have elapsed since the date the suit was filed. The Court further finds that, at the time this suit was filed, Petitioner had been a domiciliary of Texas for the preceding six-month period and a resident of ${divorceData.county || '[COUNTY]'} County for the preceding ninety-day period.`,
      type: 'jurisdiction'
    };
  }

  /**
   * Generate Texas dissolution section
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Dissolution section
   */
  generateDissolutionSection(divorceData) {
    // Render the ground the parties PLEADED — a fault-ground petition
    // (cruelty, adultery, felony conviction, abandonment, confinement,
    // 3-year living apart) must never be silently downgraded to
    // "insupportability" (§6.001) in the decree. The live Texas audit
    // caught a §6.002 cruelty petition emerging as an insupportability
    // decree — a defective final order.
    const ground = this.getDecreeGroundClause(divorceData);
    return {
      title: 'DIVORCE GRANTED',
      text: `IT IS ORDERED AND DECREED that ${divorceData.petitionerName || 'Petitioner'} and ${divorceData.respondentName || 'Respondent'} are divorced and that the marriage between them is dissolved ${ground}.`,
      type: 'dissolution'
    };
  }

  /**
   * Texas statutory ground fragment for the dissolution decretal clause.
   * Falls back to §6.001 insupportability ONLY when the data does not
   * name a recognized fault ground (or names insupportability/no-fault
   * explicitly).
   *
   * @param {Object} divorceData - Divorce data
   * @returns {string} Ground fragment beginning "on the ground of …"
   */
  getDecreeGroundClause(divorceData) {
    // Resolve from the structured field first, then from any `facts[]`
    // entry the extractor tagged as `category: 'grounds'` — the
    // Mari-acceptance replay showed a cruelty petition losing its
    // §6.002 grounds because the structured field was empty and the
    // fact never got promoted upstream. groundsResolver.js is the
    // single source of truth shared with the petition template.
    const raw = resolveGroundsForDivorce(divorceData);
    switch (raw) {
      case 'cruelty':
        return 'on the ground of cruelty (Tex. Fam. Code § 6.002)';
      case 'adultery':
        return 'on the ground of adultery (Tex. Fam. Code § 6.003)';
      case 'conviction':
      case 'felony':
      case 'felony_conviction':
        return 'on the ground of conviction of a felony (Tex. Fam. Code § 6.004)';
      case 'abandonment':
        return 'on the ground of abandonment (Tex. Fam. Code § 6.005)';
      case 'living_apart':
        return 'on the ground of living apart for at least three years (Tex. Fam. Code § 6.006)';
      case 'confinement':
        return 'on the ground of confinement in a mental hospital (Tex. Fam. Code § 6.007)';
      case 'insupportability':
      case 'irreconcilable_differences':
      case 'no_fault':
      case '':
      default:
        return 'on the ground of insupportability (Tex. Fam. Code § 6.001)';
    }
  }

  /**
   * Generate Texas property division with community property language
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Property division section
   */
  generatePropertyDivisionSection(divorceData) {
    const items = [];

    items.push({
      content: 'The Court finds that the following is a just and right division of the parties\' community estate, having due regard for the rights of each party and any children of the marriage.',
      type: 'finding'
    });

    const petitionerName = divorceData.petitionerName || 'Petitioner';
    const respondentName = divorceData.respondentName || 'Respondent';

    // Split each party's list into community vs pre-existing separate property
    // by the "Separate property: " prefix (see services/agents/extractionQuality.js).
    // Under Texas Fam. Code § 3.001 separate property is not divisible by the
    // court — it is confirmed to the owning spouse in its own decretal
    // paragraph, never awarded as part of the just-and-right community division.
    const petParts = partitionByCharacter(divorceData.petitionerProperty, 'property');
    const respParts = partitionByCharacter(divorceData.respondentProperty, 'property');

    // Property to Petitioner — community estate awarded to Petitioner as
    // Petitioner's sole property (Tex. Fam. Code § 7.001).
    items.push({
      content: `IT IS ORDERED AND DECREED that ${petitionerName} is awarded the following as ${petitionerName}'s sole and separate property, and ${respondentName} is divested of all right, title, interest, and claim in and to that property:`,
      type: 'order'
    });

    if (petParts.community.length > 0) {
      petParts.community.forEach(prop => {
        items.push({ content: `• ${prop}`, type: 'property_item' });
      });
    } else {
      items.push({
        content: `• All personal property currently in ${petitionerName}'s possession or subject to ${petitionerName}'s sole control, including but not limited to clothing, jewelry, and personal effects`,
        type: 'property_item'
      });
      items.push({
        content: `• All funds in accounts in ${petitionerName}'s sole name`,
        type: 'property_item'
      });
    }

    // Property to Respondent
    items.push({
      content: `IT IS ORDERED AND DECREED that ${respondentName} is awarded the following as ${respondentName}'s sole and separate property, and ${petitionerName} is divested of all right, title, interest, and claim in and to that property:`,
      type: 'order'
    });

    if (respParts.community.length > 0) {
      respParts.community.forEach(prop => {
        items.push({ content: `• ${prop}`, type: 'property_item' });
      });
    } else {
      items.push({
        content: `• All personal property currently in ${respondentName}'s possession or subject to ${respondentName}'s sole control, including but not limited to clothing, jewelry, and personal effects`,
        type: 'property_item'
      });
      items.push({
        content: `• All funds in accounts in ${respondentName}'s sole name`,
        type: 'property_item'
      });
    }

    // Confirmation of pre-existing separate property (Tex. Fam. Code § 3.001).
    if (petParts.separate.length + respParts.separate.length > 0) {
      items.push({
        content: 'IT IS ORDERED AND DECREED that the following property is confirmed as the separate property of the owning party pursuant to Tex. Fam. Code § 3.001, and is not subject to division:',
        type: 'order'
      });
      petParts.separate.forEach(prop => {
        items.push({ content: `• ${petitionerName}'s separate property: ${prop}`, type: 'property_item' });
      });
      respParts.separate.forEach(prop => {
        items.push({ content: `• ${respondentName}'s separate property: ${prop}`, type: 'property_item' });
      });
    }

    return {
      title: 'DIVISION OF MARITAL ESTATE',
      items,
      type: 'property'
    };
  }

  /**
   * Generate Texas child custody section with conservatorship language
   * @param {Object} divorceData - Divorce data
   * @returns {Object|null} Custody section
   */
  generateChildCustodySection(divorceData) {
    if (divorceData.hasMinorChildren === false || !divorceData.children || divorceData.children.length === 0) {
      return null;
    }

    const items = [];

    // Children subject to order
    items.push({
      content: 'The Court finds that the following orders are in the best interest of the child(ren):',
      type: 'finding'
    });

    items.push({
      content: 'The child(ren) who are the subject of this suit are:',
      type: 'order'
    });

    divorceData.children.forEach((child, index) => {
      const childName = typeof child === 'string' ? child : (child.name || '[CHILD NAME]');
      const birthDate = typeof child === 'object' ? this.formatDate(child.birthDate ?? child.dob ?? child.dateOfBirth) : null;
      items.push({
        content: birthDate ? `${index + 1}. ${childName}, born ${birthDate}` : `${index + 1}. ${childName}`,
        type: 'child_item'
      });
    });

    // Conservatorship appointment
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
        content: `IT IS ORDERED AND DECREED that ${divorceData.petitionerName || 'Petitioner'} and ${divorceData.respondentName || 'Respondent'} are appointed Joint Managing Conservators of the child(ren).`,
        type: 'order'
      });

      // Primary residence
      items.push({
        content: `IT IS ORDERED AND DECREED that ${resolvePrimaryResidenceName(divorceData) || divorceData.petitionerName || 'Petitioner'} shall have the exclusive right to designate the primary residence of the child(ren) within ${divorceData.residenceRestriction || divorceData.county || '[COUNTY]'} County, Texas, and contiguous counties.`,
        type: 'order'
      });
    } else if (custody.kind === 'sole_petitioner' || custody.kind === 'sole_respondent' || custody.kind === 'legacy_sole') {
      const custodianName =
        custody.kind === 'sole_petitioner'
          ? (divorceData.petitionerName || 'Petitioner')
          : custody.kind === 'sole_respondent'
            ? (divorceData.respondentName || 'Respondent')
            : (resolvePrimaryResidenceName(divorceData) || divorceData.petitionerName || 'Petitioner');
      const otherParentName =
        custody.kind === 'sole_respondent'
          ? (divorceData.petitionerName || 'Petitioner')
          : (divorceData.respondentName || 'Respondent');
      soleCustodianName = custodianName;
      items.push({
        content: `IT IS ORDERED AND DECREED that ${custodianName} is appointed Sole Managing Conservator of the child(ren).`,
        type: 'order'
      });

      items.push({
        content: `IT IS ORDERED AND DECREED that ${otherParentName} is appointed Possessory Conservator of the child(ren).`,
        type: 'order'
      });
    } else {
      // Unrecognized/undecided arrangement — neutral order with an explicit
      // placeholder for the parties' actual agreement. Never default to sole.
      items.push({
        content: 'IT IS ORDERED that the parties shall exercise legal custody and decision-making responsibility for the minor child(ren) as agreed by the parties: [ARRANGEMENT — set out the parties\' decision-making agreement].',
        type: 'order'
      });
    }

    // Primary residence: ordered whenever the case data says where the
    // child(ren) live, regardless of the custody branch. (The joint branch
    // keeps its historical wording and fallbacks unchanged.)
    if (custody.kind !== 'joint' && residenceName && residenceName !== soleCustodianName) {
      items.push({
        content: `IT IS ORDERED that the child(ren) shall primarily reside with ${residenceName}.`,
        type: 'order'
      });
    }

    // Standard Possession Order
    items.push({
      content: 'IT IS ORDERED AND DECREED that the parties shall have possession of and access to the child(ren) in accordance with the Standard Possession Order as set forth in sections 153.311 through 153.317 of the Texas Family Code.',
      type: 'order'
    });

    return {
      title: 'CONSERVATORSHIP',
      items,
      type: 'custody'
    };
  }

  /**
   * Get Texas visitation language (Standard Possession Order reference)
   * @param {Object} divorceData - Divorce data
   * @returns {string} Visitation language
   */
  getVisitationLanguage(divorceData) {
    return 'IT IS ORDERED that the parties shall have possession of and access to the child(ren) in accordance with the Standard Possession Order as set forth in sections 153.311 through 153.317 of the Texas Family Code.';
  }

  /**
   * Generate Texas child support section
   * @param {Object} divorceData - Divorce data
   * @returns {Object|null} Child support section
   */
  generateChildSupportSection(divorceData) {
    if (divorceData.hasMinorChildren === false || !divorceData.children || divorceData.children.length === 0) {
      return null;
    }

    const items = [];

    const obligor = divorceData.childSupportObligor || divorceData.respondentName || 'Respondent';
    const obligee = divorceData.childSupportObligee || divorceData.petitionerName || 'Petitioner';

    if (divorceData.childSupportAmount) {
      items.push({
        content: `IT IS ORDERED AND DECREED that ${obligor} is obligated to pay and shall pay to ${obligee} child support of $${divorceData.childSupportAmount} per month, with the first payment being due and payable on the 1st day of ${divorceData.childSupportStartMonth || '[MONTH]'}, ${divorceData.childSupportStartYear || '[YEAR]'}, and a like payment being due and payable on the 1st day of each month thereafter until the first month following the date of the earliest occurrence of one of the events described below.`,
        type: 'order'
      });
    } else {
      items.push({
        content: `IT IS ORDERED AND DECREED that ${obligor} shall pay child support in accordance with the Texas Family Code child support guidelines.`,
        type: 'order'
      });
    }

    // Withholding
    items.push({
      content: `IT IS ORDERED that income withholding for child support shall be implemented immediately, in accordance with section 158.001 et seq. of the Texas Family Code.`,
      type: 'order'
    });

    // Health insurance
    items.push({
      content: `IT IS ORDERED AND DECREED that ${divorceData.healthInsuranceProvider || obligor} shall maintain health insurance for the child(ren) as long as such insurance is available at a reasonable cost through the obligor's employer or membership in a union, trade association, or other organization.`,
      type: 'order'
    });

    // Dental insurance
    items.push({
      content: `IT IS ORDERED AND DECREED that ${divorceData.dentalInsuranceProvider || obligor} shall maintain dental insurance for the child(ren) as long as such insurance is available at a reasonable cost through the obligor's employer or membership in a union, trade association, or other organization.`,
      type: 'order'
    });

    return {
      title: 'CHILD SUPPORT',
      items,
      type: 'child_support'
    };
  }

  /**
   * Generate Texas spousal support section
   * @param {Object} divorceData - Divorce data
   * @returns {Object|null} Spousal support section
   */
  generateSpousalSupportSection(divorceData) {
    // Precedence (templates/core/spousalSupport.js): request-plus-amount
    // renders the AWARD even absent an explicit awarded flag; a bare
    // request with no amount pleads a reservation, never a false waiver.
    const decision = resolveSpousalSupportDecision(divorceData);
    if (decision.outcome === 'none') return null;

    const items = [];
    const payor = decision.payor || 'Respondent';
    const payee = decision.payee || 'Petitioner';

    if (decision.outcome === 'award') {
      items.push({
        content: `The Court finds that ${payee} lacks sufficient property to provide for ${payee}'s minimum reasonable needs and meets the eligibility requirements for spousal maintenance under Chapter 8 of the Texas Family Code.`,
        type: 'finding'
      });
      items.push({
        content: `IT IS ORDERED AND DECREED that ${payor} shall pay spousal maintenance to ${payee} in the amount of $${decision.amount || '[AMOUNT]'} per month, beginning on ${this.formatDate(decision.startDate) || '[DATE]'} and continuing for a period of ${decision.duration || '[DURATION]'}.`,
        type: 'order'
      });
    } else if (decision.outcome === 'reserve') {
      items.push({
        content: `IT IS ORDERED AND DECREED that the Court reserves jurisdiction over spousal maintenance under Chapter 8 of the Texas Family Code, ${payee} having requested maintenance with no specific amount yet on file; the amount and duration shall be set by the Court.`,
        type: 'order'
      });
    } else if (decision.outcome === 'waive') {
      items.push({
        content: 'IT IS ORDERED AND DECREED that each party waives any right to spousal maintenance, now and in the future, from the other party.',
        type: 'order'
      });
    }

    return {
      title: 'SPOUSAL MAINTENANCE',
      items,
      type: 'spousal_support'
    };
  }

  /**
   * Generate Texas name change section
   * @param {Object} divorceData - Divorce data
   * @returns {Object|null} Name change section
   */
  generateNameChangeSection(divorceData) {
    if (!divorceData.requestNameChange || !divorceData.previousName) {
      return null;
    }

    const person = divorceData.nameChangeParty || divorceData.petitionerName || 'Petitioner';

    return {
      title: 'CHANGE OF NAME',
      text: `IT IS ORDERED AND DECREED that the name of ${person} is changed to ${divorceData.previousName}.`,
      type: 'name_change'
    };
  }

  /**
   * Generate Texas final orders section
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Final orders section
   */
  generateFinalOrdersSection(divorceData) {
    const items = [];

    items.push({
      content: 'IT IS ORDERED AND DECREED that each party shall execute any and all instruments necessary to effectuate the provisions of this decree.',
      type: 'order'
    });

    items.push({
      content: 'IT IS ORDERED AND DECREED that all relief requested in this case and not expressly granted in this decree is denied.',
      type: 'order'
    });

    items.push({
      content: 'IT IS ORDERED AND DECREED that this decree is a final decree.',
      type: 'order'
    });

    // Costs
    items.push({
      content: 'IT IS ORDERED AND DECREED that costs of court are to be borne by the party who incurred them.',
      type: 'order'
    });

    return {
      title: 'MISCELLANEOUS',
      items,
      type: 'final_orders'
    };
  }

  /**
   * Generate Texas judgment block
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Judgment block
   */
  generateJudgmentBlock(divorceData) {
    return {
      text: `SIGNED on _____________________, 20___.


_________________________________
JUDGE PRESIDING

${divorceData.judgeName ? divorceData.judgeName.toUpperCase() : ''}
${divorceData.courtNumber ? `${divorceData.courtNumber} JUDICIAL DISTRICT COURT` : ''}
${divorceData.county ? `${divorceData.county.toUpperCase()} COUNTY, TEXAS` : ''}`,
      type: 'judgment'
    };
  }

  /**
   * Perform Texas-specific validation
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Validation result
   */
  performStateSpecificValidation(divorceData) {
    const errors = [];
    const warnings = [];

    // Texas requires county
    if (!divorceData.county) {
      errors.push('County is required for Texas divorce decrees');
    }

    // Texas requires case/cause number for final decree
    if (!divorceData.caseNumber) {
      errors.push('Cause number is required for Texas final decree of divorce');
    }

    // Warning about children
    if (divorceData.hasMinorChildren === true && (!divorceData.children || divorceData.children.length === 0)) {
      warnings.push('You indicated there are minor children but did not provide child information.');
    }

    // Warning about child support
    if (divorceData.hasMinorChildren === true && !divorceData.childSupportAmount) {
      warnings.push('Child support amount not specified. The court will determine support per Texas Family Code guidelines.');
    }

    return { errors, warnings };
  }
}

module.exports = TexasDivorceDecreeTemplate;
