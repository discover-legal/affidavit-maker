// templates/states/texas/DivorcePetitionTemplate.js
// Texas-specific divorce petition template
// Complies with Texas Family Code and Texas Rules of Civil Procedure

const BaseDivorcePetitionTemplate = require('../../core/BaseDivorcePetitionTemplate');
const { resolveGroundsForDivorce } = require('./groundsResolver');

// Leading soft-hedge words that make an already-hedged suspected-location
// phrase read as a double hedge ("may be in Possibly Louisiana..."). The
// alternative-service clause itself already contains the "cannot swear"
// caveat, so a location that starts with any of these adds nothing but
// noise.
const LEADING_HEDGE_PATTERN =
  /^\s*(?:possibly|maybe|perhaps|probably|apparently|allegedly|reportedly|supposedly)[,;:\s]+/i;

function stripLeadingHedge(text) {
  if (typeof text !== 'string') return '';
  let out = text;
  // Strip repeatedly — "Possibly, maybe Louisiana" -> "Louisiana".
  while (LEADING_HEDGE_PATTERN.test(out)) {
    out = out.replace(LEADING_HEDGE_PATTERN, '');
  }
  return out.trim();
}

// Attorney round-2 (2026-08): cruelty petitions were rendering bare
// statutory language even when the transcript contained a documented
// substrate (ER records, police reports). Locate the first fact whose
// subcategory names a cruelty/abuse ground OR whose content mentions
// documentary support, and return a description we can splice into the
// pleaded ground. Explicit grounds-category facts are preferred over
// evidence-tagged facts. Never touch the shared groundsResolver — this
// runs only after cruelty has already resolved.
const CRUELTY_SUBCAT_PATTERN =
  /(cruelty|cruel[_\s]treatment|physical[_\s]abuse|domestic[_\s]violence|family[_\s]violence)/i;
const CRUELTY_KEYWORD_PATTERN =
  /\b(hospital|er\b|emergency[_\s-]?room|police|documented|documentation|witness(es|ed)?|medical\s+records|police\s+report(s)?|photograph(s|ed)?|photos)\b/i;

function normalizeSubstrateDescription(raw) {
  if (typeof raw !== 'string') return '';
  return raw.trim().replace(/\s+/g, ' ').replace(/[.;,\s]+$/, '');
}

// Attorney round-3 (2026-08-30): reject LLM planning/meta-commentary
// like "seeks dissolution on the Georgia ground of cruel treatment
// rather than irreconcilable differences" from ever reaching a
// pleaded factual paragraph. These phrases signal that the "fact" is
// really the model's own reasoning about which ground to plead.
const META_ROUTING_PATTERN =
  /(?:\brather\s+than\b|\binstead\s+of\b|\bseeks\s+dissolution\b|\bthe\s+appropriate\s+ground\b|\bon\s+the\s+ground\s+of\b.*\brather\s+than\b|\bproper\s+ground\s+for\b|\bwe\s+should\s+plead\b|\brecommends?\s+pleading\b)/i;

// Attorney round-3 (2026-08-30): the substrate grammar was broken
// ("...the cruel treatment includes Petitioner Mari Vasquez-McPherson
// alleges that Respondent Ray Delacroix physically harmed Petitioner
// Mari Vasquez-McPherson..."). Collapse role+name duplicates and
// strip leading "<Filer> alleges that " preambles so the splice reads
// as one clean sentence.
function collapseRoleNameDuplicates(text, divorceData) {
  if (typeof text !== 'string' || !text) return text || '';
  let s = text;
  const roles = ['Petitioner', 'Respondent', 'Plaintiff', 'Defendant', 'Applicant'];
  const knownNames = [];
  if (divorceData) {
    for (const k of ['petitionerName', 'respondentName', 'plaintiffName', 'defendantName', 'applicantName']) {
      const v = divorceData[k];
      if (typeof v === 'string' && v.trim()) knownNames.push(v.trim());
    }
  }
  for (const role of roles) {
    for (const nm of knownNames) {
      const escaped = nm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      s = s.replace(new RegExp(`\\b${role}\\s+${escaped}\\b`, 'gi'), role);
    }
    // Generic collapse: "Petitioner <Proper Noun Name>" (1-3 capitalized tokens,
    // allows hyphens/apostrophes). Skip common non-name follow words.
    s = s.replace(
      new RegExp(
        `\\b${role}\\s+([A-Z][A-Za-z\\u00C0-\\u017F.'’-]+(?:[-\\s][A-Z][A-Za-z\\u00C0-\\u017F.'’-]+){0,3})\\b`,
        'g'
      ),
      (m, name) => {
        const firstWord = name.split(/[\s-]/)[0];
        if (/^(Court|County|District|Circuit|State|Family|Superior|Alleges|States|Claims|Avers|Contends|Reports|Further|Also|And|Or|But|Was|Is|Has|Had|Will|Shall|Does|Did|Seeks|Prays|Pleads)$/i.test(firstWord)) {
          return m;
        }
        return role;
      }
    );
  }
  return s;
}

function sanitizeSubstrate(desc, divorceData) {
  if (typeof desc !== 'string') return '';
  let s = desc.trim();
  if (!s) return '';
  if (META_ROUTING_PATTERN.test(s)) return '';
  // Strip leading "<Filer> [Name] alleges/states/avers/claims that "
  s = s.replace(
    /^(?:the\s+)?(petitioner|plaintiff|applicant)(?:\s+[A-Z][\w.'’-]+(?:[-\s][A-Z][\w.'’-]+){0,3})?\s+(?:alleges|states|avers|claims|contends|reports|says|swears)\s+that\s+/i,
    ''
  );
  s = collapseRoleNameDuplicates(s, divorceData);
  s = s.trim().replace(/\s+/g, ' ').replace(/[,;:\s]+$/, '');
  if (!s) return '';
  // Ensure the sanitized substrate ends as an independent sentence.
  if (!/[.!?]$/.test(s)) s += '.';
  // Capitalize first letter for clean splice after "Specifically, ".
  s = s.charAt(0).toUpperCase() + s.slice(1);
  return s;
}

function findCrueltySubstrate(divorceData) {
  const facts = Array.isArray(divorceData && divorceData.facts) ? divorceData.facts : [];
  let fallback = null;
  for (const fact of facts) {
    if (!fact || typeof fact !== 'object') continue;
    const category = String(fact.category || '').toLowerCase();
    const subcat = String(fact.subcategory || '');
    const content = String(fact.content || fact.text || fact.value || '');
    const sourceQuote = String(fact.sourceQuote || '');
    const searchBlob = `${subcat} ${content} ${sourceQuote}`;
    const subcatHit = CRUELTY_SUBCAT_PATTERN.test(subcat);
    const keywordHit = CRUELTY_KEYWORD_PATTERN.test(searchBlob);
    if (!subcatHit && !keywordHit) continue;
    // Meta-commentary filter: reject facts that carry LLM routing/planning
    // language even if they otherwise look cruelty-adjacent.
    if (META_ROUTING_PATTERN.test(content) && META_ROUTING_PATTERN.test(sourceQuote || content)) continue;
    const rawDesc = normalizeSubstrateDescription(content) || normalizeSubstrateDescription(sourceQuote);
    if (!rawDesc) continue;
    const desc = sanitizeSubstrate(rawDesc, divorceData);
    if (!desc) continue;
    if (category === 'grounds' || category === 'ground' || subcatHit) {
      return desc; // grounds-category (or subcat-cruelty) fact wins immediately
    }
    if (!fallback) fallback = desc;
  }
  return fallback;
}

/**
 * Texas Divorce Petition Template
 *
 * Legal References:
 * - Texas Family Code Chapter 6 (Suit for Dissolution of Marriage)
 * - Texas Family Code § 6.301 (General Residency Rule)
 * - Texas Family Code § 6.401 (Waiver of Service)
 * - Texas Rules of Civil Procedure Rule 45, 47
 *
 * Formatting Requirements (Texas Rules of Civil Procedure):
 * - 8.5" x 11" paper
 * - 1" margins on all sides
 * - 12-point font minimum (Times New Roman preferred)
 * - Double-spaced text
 * - Black ink
 *
 * Texas-Specific Terminology:
 * - Uses "CAUSE NO." instead of "CASE NO."
 * - "Insupportability" as no-fault grounds
 * - "Conservatorship" instead of "Custody"
 * - "Managing Conservator" and "Possessory Conservator"
 */
class TexasDivorcePetitionTemplate extends BaseDivorcePetitionTemplate {
  constructor() {
    super();

    this.state = 'TX';
    this.stateName = 'Texas';
    this.documentTitle = 'ORIGINAL PETITION FOR DIVORCE';

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
      'marriageDate',
      'groundsForDivorce'
    ];

    // Texas residency requirements
    this.residencyRequirements = {
      stateMonths: 6,
      countyDays: 90,
      description: 'At least one spouse must have been a domiciliary of Texas for the preceding six-month period and a resident of the county for the preceding 90-day period.'
    };

    // Texas waiting period
    this.waitingPeriod = {
      days: 60,
      exceptions: ['family_violence_conviction', 'protective_order'],
      description: 'The court may not grant a divorce before the 60th day after the date the suit was filed. Exceptions apply for family violence.'
    };

    // Texas formatting requirements
    this.formatting = {
      fontSize: '12pt',
      fontFamily: 'Times New Roman',
      lineHeight: '2', // Double-spaced
      margin: '1in',
      paperSize: '8.5in x 11in'
    };

    // Texas-specific sections
    this.sections.standingOrders = true; // Some counties require standing orders
    this.sections.civilCaseInformation = true; // Civil Case Information Sheet
    this.sections.vitalStatistics = true; // Bureau of Vital Statistics form
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
    return `${this.getCourtType(county)} COURT OF ${countyUpper} COUNTY, TEXAS`;
  }

  /**
   * Determine court type based on county population
   * Most family law cases in Texas go to District Court
   * @param {string} county - County name
   * @returns {string} Court type
   */
  getCourtType(county) {
    // In Texas, family law cases typically go to District Court
    // Some counties have specific family district courts
    return 'DISTRICT';
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
   * Generate Texas case caption with proper formatting
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Case caption
   */
  generateCaseCaption(divorceData) {
    let caption = '';

    // Court name
    const courtName = divorceData.court || this.getDefaultCourt(divorceData.county);
    caption += `IN THE ${courtName.toUpperCase()}\n\n`;

    // Texas uses "CAUSE NO." - leave blank for clerk to assign
    const causeNumber = divorceData.caseNumber || '____________________';
    caption += `CAUSE NO. ${causeNumber}\n\n`;

    // Texas style of cause for divorce
    caption += `IN THE MATTER OF\n`;
    caption += `THE MARRIAGE OF\n\n`;

    const petitioner = (divorceData.petitionerName || '[PETITIONER NAME]').toUpperCase();
    caption += `${petitioner}\n`;
    caption += `Petitioner,\n\n`;

    caption += `AND\n\n`;

    const respondent = (divorceData.respondentName || '[RESPONDENT NAME]').toUpperCase();
    caption += `${respondent}\n`;
    caption += `Respondent`;

    // Add children section to caption if applicable
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
   * Texas override for the respondent residence clause.
   *
   * The base class handles a well-formed address and detects a narrow set of
   * "unknown"/"no address" phrases; a live Texas persona (Mari, acceptance v6)
   * still slipped through with `respondentAddress = "No current address known;
   * possibly in Louisiana with his brother"` — the sworn petition then read
   * "Respondent, [NAME], is a resident of No current address known; possibly
   * in Louisiana with his brother." Mari specifically said she "won't swear
   * to" the Louisiana guess.
   *
   * Fix (LLM-first): the extraction layer now stores the guess as
   * `respondentAddressUnknown: true` + `respondentSuspectedLocation` and
   * leaves `respondentAddress` empty. This override reads those sworn-truth
   * fields FIRST and refuses to render any address free text that carries a
   * hedge ("possibly", "maybe", "unknown", "I think", "not sure", "somewhere",
   * "no current address"), so an old saved document that predates the
   * extraction fix still can't emit a hedged residence clause. In every
   * whereabouts-unknown case, the petition pleads the alternative-service
   * clause and — when a NON-sworn suspected location is on file — appends it
   * as a bracketed follow-up sentence, never as an assertion of residence.
   *
   * @param {Object} divorceData - Divorce data
   * @returns {string} Sentence fragment that follows "Respondent, <name>,"
   */
  getRespondentResidenceClause(divorceData) {
    const t = this.terminology;
    const raw =
      typeof divorceData.respondentAddress === 'string'
        ? divorceData.respondentAddress.trim()
        : '';
    const suspected = stripLeadingHedge(
      typeof divorceData.respondentSuspectedLocation === 'string'
        ? divorceData.respondentSuspectedLocation
        : ''
    );
    const altService = `resides at an address unknown to ${t.filerLabel}; ${t.filerLabel} will request alternative service under the applicable rules`;
    const suspectedNote = suspected
      ? ` (${t.filerLabel} has heard, but cannot swear, that Respondent may be in ${suspected})`
      : '';

    if (divorceData.respondentAddressUnknown === true || !raw) {
      return altService + suspectedNote;
    }
    // Any hedge in the free-text address disqualifies it from a sworn
    // "resident of ..." sentence. The list below intentionally covers the
    // phrasings that appeared in the Mari acceptance run plus common
    // neighbours ("I think", "not sure", "somewhere in", "could be").
    const hedgePattern =
      /\b(possibly|maybe|perhaps|probably|somewhere|not\s+sure|unsure|i\s+think|i\s+don'?t\s+know|no\s+known|no\s+current\s+address|unknown|whereabouts\s+unknown|address\s+unknown|could\s+be|might\s+be)\b/i;
    if (hedgePattern.test(raw)) {
      return altService + suspectedNote;
    }
    return `is a resident of ${raw}`;
  }

  /**
   * Match the TX residence-clause triggers exactly so the Draft alt-service
   * note appears on every branch that pleads alternative service — the
   * sworn-truth flag, an empty address, and any hedged free-text address.
   */
  isAltServiceCase(divorceData) {
    if (divorceData.respondentAddressUnknown === true) return true;
    const raw =
      typeof divorceData.respondentAddress === 'string'
        ? divorceData.respondentAddress.trim()
        : '';
    if (!raw) return true;
    const hedgePattern =
      /\b(possibly|maybe|perhaps|probably|somewhere|not\s+sure|unsure|i\s+think|i\s+don'?t\s+know|no\s+known|no\s+current\s+address|unknown|whereabouts\s+unknown|address\s+unknown|could\s+be|might\s+be)\b/i;
    return hedgePattern.test(raw);
  }

  /**
   * Texas alt-service Draft note: TRCP 106 (substituted service) or TRCP 109
   * (service by publication) require a due-diligence affidavit describing
   * the search for Respondent.
   */
  getAltServiceNote(_divorceData) {
    return (
      'Alternative service in Texas requires a court order. Move under ' +
      'TRCP 106 for substituted service (leaving with someone at Respondent\'s ' +
      'usual place of abode, or by other means the court deems reasonably ' +
      'effective — including social media) after filing a sworn ' +
      'due-diligence affidavit describing the search for Respondent, or ' +
      'under TRCP 109 for citation by publication when even TRCP 106 methods ' +
      'are unavailable. A citation-by-publication case appoints an attorney ' +
      'ad litem for the absent party (TRCP 244) and cannot support a ' +
      'personal money judgment.'
    );
  }

  /**
   * Generate Texas jurisdiction statement
   * @param {Object} divorceData - Divorce data
   * @returns {string} Jurisdiction statement
   */
  getJurisdictionStatement(divorceData) {
    return `Petitioner has been a domiciliary of the State of Texas for at least six months and a resident of ${divorceData.county || '[COUNTY]'} County, Texas, for at least ninety days immediately preceding the filing of this suit.`;
  }

  /**
   * Generate Texas venue reason
   * @param {Object} divorceData - Divorce data
   * @returns {string} Venue reason
   */
  getVenueReason(divorceData) {
    return `Petitioner is a resident of this county`;
  }

  /**
   * Override the base grounds section so a fault ground captured only in
   * `facts[]` (category: 'grounds') is still pleaded correctly. Without
   * this override the base template reads `divorceData.groundsForDivorce
   * || 'irreconcilable_differences'` — a cruelty petition would then
   * emerge as §6.001 insupportability boilerplate. See groundsResolver.js.
   *
   * @param {Object} divorceData
   * @returns {Object} Grounds section
   */
  generateGroundsSection(divorceData) {
    const items = [];
    let paragraphNum = divorceData._paragraphNum || 8;

    const grounds = resolveGroundsForDivorce(divorceData);
    const groundsText = this.getGroundsText(grounds, divorceData);

    items.push({
      number: paragraphNum++,
      content: groundsText,
      type: 'grounds'
    });

    // Attorney round-2 (2026-08): a cruelty petition pleaded under
    // TFC §6.002 should surface the family-violence procedural options
    // the client may not know she has: (a) TFC §6.504 authorises a
    // protective order in a suit for dissolution; (b) TFC §6.501
    // authorises temporary restraining orders in a suit for
    // dissolution, and Harris County (plus every other Texas county
    // with local rules) issues standing family-law orders on the day of
    // filing that already carry many of these protections.
    if (grounds === 'cruelty') {
      items.push({
        number: null,
        content:
          '(Draft — Family-violence procedural options in a Texas divorce: ' +
          'Petitioner may apply for a protective order in this suit for ' +
          'dissolution under Texas Family Code §6.504, and for a temporary ' +
          'restraining order under Texas Family Code §6.501. Many Texas ' +
          'counties (including Harris County) issue standing family-law ' +
          'orders on the day the petition is filed that already carry many ' +
          'of these protections; confirm the local standing order for the ' +
          'court in which this petition is filed.)',
        type: 'grounds_draft_note',
      });
    }

    // v23-A safety subitem (attorney review, 2026-08): when a fault
    // ground (cruelty, adultery, felony conviction, abandonment,
    // confinement, living-apart) is pleaded as the primary ground under
    // Texas Family Code §6.002 et seq., ALWAYS plead §6.001
    // insupportability in the alternative. If the fault ground fails at
    // proof, the alternative no-fault plea preserves the divorce. Skip
    // when the parties have expressly opted out (`skipInsupportabilityAlt
    // === true`) or when the primary ground is already no-fault.
    const faultGrounds = new Set([
      'cruelty', 'adultery',
      'conviction', 'felony', 'felony_conviction',
      'abandonment', 'confinement', 'living_apart'
    ]);
    if (
      faultGrounds.has(grounds) &&
      divorceData.skipInsupportabilityAlt !== true
    ) {
      items.push({
        number: paragraphNum++,
        content: 'In the alternative, and without waiving the foregoing fault ground, Petitioner pleads under Texas Family Code §6.001 that the marriage has become insupportable because of discord or conflict of personalities between Petitioner and Respondent that destroys the legitimate ends of the marital relationship and prevents any reasonable expectation of reconciliation.',
        type: 'grounds_alternative'
      });
    }

    return {
      title: 'IV. GROUNDS FOR DIVORCE',
      items,
      nextParagraphNumber: paragraphNum
    };
  }

  /**
   * Get Texas grounds text
   * Texas uses "insupportability" as the no-fault ground
   * @param {string} grounds - Grounds type
   * @param {Object} divorceData - Divorce data
   * @returns {string} Grounds text
   */
  getGroundsText(grounds, divorceData) {
    switch (grounds) {
      case 'insupportability':
      case 'irreconcilable_differences':
      case 'no_fault':
        return 'The marriage of Petitioner and Respondent has become insupportable because of discord or conflict of personalities that destroys the legitimate ends of the marital relationship and prevents any reasonable expectation of reconciliation.';

      case 'cruelty': {
        const base =
          'Respondent was guilty of cruel treatment toward Petitioner of such a nature as to render further living together insupportable.';
        const substrate = findCrueltySubstrate(divorceData || {});
        if (!substrate) return base;
        // Attorney round-3 (2026-08-30): substrate is now a sanitized,
        // period-terminated independent sentence. Splice with
        // "Specifically, X." rather than "includes X" so the pleading
        // stays grammatical when X is a full clause. Documentation-
        // production commitment follows as its own sentence.
        return `${base} Specifically, ${substrate} Petitioner will produce documentation of the same.`;
      }

      case 'adultery':
        return 'Respondent committed adultery.';

      case 'conviction':
      case 'felony':
      case 'felony_conviction':
        return `Respondent has been convicted of a felony during the marriage, has been imprisoned for at least one year in the Texas Department of Criminal Justice, a federal penitentiary, or the penitentiary of another state, and has not been pardoned.`;

      case 'abandonment':
        return `Respondent left Petitioner with the intention of abandonment, and Respondent remained away for at least one year.`;

      case 'living_apart':
        return `Petitioner and Respondent have lived apart without cohabitation for at least three years.`;

      case 'confinement':
        return `Respondent has been confined in a state mental hospital or private mental hospital for at least three years and it appears that the mental disorder is of such a degree and nature that adjustment is unlikely or that, if adjustment occurs, relapse is probable.`;

      default:
        return 'The marriage of Petitioner and Respondent has become insupportable because of discord or conflict of personalities that destroys the legitimate ends of the marital relationship and prevents any reasonable expectation of reconciliation.';
    }
  }

  /**
   * Generate Texas children section with conservatorship language
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Children section
   */
  generateChildrenSection(divorceData) {
    const items = [];
    let paragraphNum = divorceData._paragraphNum || 9;

    if (divorceData.hasMinorChildren === false || !divorceData.children || divorceData.children.length === 0) {
      items.push({
        number: paragraphNum++,
        content: 'No children were born or adopted of this marriage, and none are expected.',
        type: 'children_info'
      });
    } else {
      items.push({
        number: paragraphNum++,
        content: 'The following children were born or adopted of this marriage:',
        type: 'children_info'
      });

      if (divorceData.children && divorceData.children.length > 0) {
        divorceData.children.forEach((child, index) => {
          const childName = typeof child === 'string' ? child : (child.name || '[CHILD NAME]');
          // Attorney round-3 (2026-08-30): use shared year-only fallback
          // so `birthYear`-only and bare-year DOBs render.
          const birthDate = typeof child === 'object' ? this.formatChildDob(child) : null;
          const childInfo = birthDate ? `${childName}, born ${birthDate}` : childName;

          items.push({
            number: paragraphNum++,
            content: `Child ${index + 1}: ${childInfo}`,
            type: 'child_detail'
          });
        });
      }

      items.push({
        number: paragraphNum++,
        content: 'No other children were born to or adopted by Petitioner and Respondent during the marriage, the wife is not pregnant, and none are expected.',
        type: 'children_info'
      });

      // Texas conservatorship language
      items.push({
        number: paragraphNum++,
        content: 'It is in the best interest of the child(ren) that Petitioner and Respondent be appointed Joint Managing Conservators of the child(ren).',
        type: 'conservatorship_request'
      });

      items.push({
        number: paragraphNum++,
        content: 'Petitioner requests the Court to determine the rights and duties of each parent and periods of possession and access that are in the best interest of the child(ren).',
        type: 'conservatorship_request'
      });
    }

    // Agreed child arrangements (custody enum, primary residence, agreed
    // support) — pleaded via the base hooks, never silently dropped.
    paragraphNum = this.appendAgreedChildArrangementPleadings(items, paragraphNum, divorceData);

    return {
      title: 'V. CHILDREN',
      items,
      nextParagraphNumber: paragraphNum
    };
  }

  /**
   * Generate Texas property section with community property language
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Property section
   */
  generatePropertySection(divorceData) {
    // An agreed division (or an explicit no-property case) pleads the
    // parties' actual agreement via the base hooks instead of the
    // generic boilerplate.
    // Delegate to super for any confirmed no-property or agreed-division
    // case. `noPropertyConfirmed === true` is treated as an affirmative
    // no-property finding even when `hasProperty` was never explicitly
    // set to false — otherwise the "There exists community property..."
    // presumption below fabricates a community estate against a filer
    // who told the intake there was none (Mari's TX petition, live
    // audit 2026-08).
    if (
      divorceData.hasProperty === false ||
      divorceData.noPropertyConfirmed === true ||
      this.hasAgreedPropertyDivision(divorceData) ||
      // Round-3 attorney review (Mari TX, 2026-08-30): the structured
      // hasProperty/noPropertyConfirmed flags were both absent, but facts[]
      // carried an explicit "no property, no house, no retirement"
      // statement from the transcript. Delegating to super's silence-
      // aware gate lets the fact-driven promotion below fire the correct
      // nil-property clause instead of the community-property boilerplate.
      this.factsIndicateNoProperty(divorceData)
    ) {
      return super.generatePropertySection(divorceData);
    }

    const items = [];
    let paragraphNum = divorceData._paragraphNum || 14;

    if (divorceData.hasProperty === false && divorceData.hasDebts === false) {
      items.push({
        number: paragraphNum++,
        content: 'There is no community property or community debt to be divided.',
        type: 'property_info'
      });
    } else {
      items.push({
        number: paragraphNum++,
        content: 'Petitioner and Respondent will agree to a division of their estate, or alternatively, Petitioner requests the Court to order a division of the estate of the parties in a manner that the Court deems just and right, as provided by law.',
        type: 'property_request'
      });

      // Texas community property presumption
      items.push({
        number: paragraphNum++,
        content: 'There exists community property owned by the parties, the nature and extent of which will be proven at trial or set forth in an agreement of the parties.',
        type: 'property_info'
      });
    }

    return {
      title: 'VI. PROPERTY',
      items,
      nextParagraphNumber: paragraphNum
    };
  }

  /**
   * Generate Texas relief section
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Relief section
   */
  generateReliefSection(divorceData) {
    const items = [];

    items.push({
      number: null,
      content: 'Petitioner prays that citation and notice issue as required by law and that the Court grant a divorce and all other relief requested in this petition.',
      type: 'relief_intro'
    });

    items.push({
      number: null,
      content: 'Petitioner prays that the Court grant the following relief:',
      type: 'relief_intro'
    });

    const reliefItems = [];

    // Divorce
    reliefItems.push('Divorce and a dissolution of the marriage of Petitioner and Respondent;');

    // Property division
    reliefItems.push('Division of the community estate in a manner that the Court deems just and right, with due regard for the rights of each party;');

    // Children — omit conservatorship / support prayer items when
    // hasMinorChildren === false (live Texas audit, 2026-08).
    if (this.hasMinorChildrenForRelief(divorceData)) {
      reliefItems.push('Appointment of conservators and determination of the rights and duties of each conservator;');
      reliefItems.push('Determination of periods of possession and access to the child(ren);');
      reliefItems.push('Child support as provided by law;');
      reliefItems.push('Medical support and dental support for the child(ren);');
    }

    // Spousal support
    if (divorceData.requestSpousalSupport) {
      reliefItems.push('Spousal maintenance as provided by law;');
    }

    // Name change
    if (divorceData.requestNameChange && divorceData.previousName) {
      reliefItems.push(`Change of name of ${divorceData.nameChangeParty || 'Petitioner'} to ${divorceData.previousName};`);
    }

    // General relief
    reliefItems.push('Attorney\'s fees, expenses, interest, and costs of court;');
    reliefItems.push('Such other and further relief, general and special, to which Petitioner may be justly entitled.');

    // Agreed corollary relief (agreed support amount, spousal-support

    // waiver, property agreement) — spliced before the final general prayer.

    this.appendAgreedReliefItems(reliefItems, divorceData);


    reliefItems.forEach((relief, index) => {
      const letter = String.fromCharCode(97 + index); // a, b, c format
      items.push({
        number: null,
        content: relief,
        type: 'relief_item',
        style: 'letter',
        letter: letter
      });
    });

    return {
      title: 'PRAYER',
      items,
      nextParagraphNumber: null
    };
  }

  /**
   * Get Texas verification text
   * @param {Object} divorceData - Divorce data
   * @returns {string} Verification text
   */
  getVerificationText(divorceData) {
    const name = divorceData.petitionerName || '[PETITIONER NAME]';
    const county = divorceData.county || '[COUNTY]';

    return `STATE OF TEXAS
COUNTY OF ${county.toUpperCase()}

BEFORE ME, the undersigned authority, on this day personally appeared ${name}, known to me to be the Petitioner in the above-entitled and numbered cause, who being duly sworn, stated on oath that the facts set forth in the foregoing Original Petition for Divorce are within the personal knowledge of Petitioner and are true and correct.

_________________________________
${name}, Petitioner

SWORN TO AND SUBSCRIBED before me on _____________________, 20___.

_________________________________
Notary Public, State of Texas

My commission expires: _______________`;
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
    if (!divorceData.county || divorceData.county.trim().length === 0) {
      errors.push('County is required for Texas divorce petitions');
    }

    // Texas-specific grounds validation
    const validGrounds = [
      'insupportability', 'irreconcilable_differences', 'no_fault',
      'cruelty', 'adultery', 'conviction', 'abandonment',
      'living_apart', 'confinement'
    ];

    if (divorceData.groundsForDivorce && !validGrounds.includes(divorceData.groundsForDivorce)) {
      warnings.push(`"${divorceData.groundsForDivorce}" may not be a recognized ground in Texas. Consider using "insupportability" for no-fault divorce.`);
    }

    // Warning about children
    if (divorceData.hasMinorChildren === true && (!divorceData.children || divorceData.children.length === 0)) {
      warnings.push('You indicated there are minor children but did not provide child information.');
    }

    // Warning about property
    if (!divorceData.hasProperty && divorceData.hasProperty !== false) {
      warnings.push('Property information not specified. Please indicate whether there is community property to divide.');
    }

    return { errors, warnings };
  }
}

module.exports = TexasDivorcePetitionTemplate;
