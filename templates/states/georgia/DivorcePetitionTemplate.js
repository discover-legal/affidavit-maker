// templates/states/georgia/DivorcePetitionTemplate.js
// Georgia Complaint for Divorce (Petition) template
// Complies with O.C.G.A. § 19-5-1 et seq. (Divorce) and Georgia Superior Court rules

const BaseDivorcePetitionTemplate = require('../../core/BaseDivorcePetitionTemplate');
const { resolveGroundsForDivorce } = require('./groundsResolver');

// Leading soft-hedge words that make an already-hedged suspected-location
// phrase read as a double hedge ("may be in Possibly Alabama..."). The
// alternative-service clause itself already contains the "cannot swear"
// caveat, so a location that starts with any of these adds nothing but
// noise. Mirror of the TX pattern (templates/states/texas/DivorcePetitionTemplate.js).
const LEADING_HEDGE_PATTERN =
  /^\s*(?:possibly|maybe|perhaps|probably|apparently|allegedly|reportedly|supposedly)[,;:\s]+/i;

function stripLeadingHedge(text) {
  if (typeof text !== 'string') return '';
  let out = text;
  while (LEADING_HEDGE_PATTERN.test(out)) {
    out = out.replace(LEADING_HEDGE_PATTERN, '');
  }
  return out.trim();
}

// Attorney round-2 (2026-08): mirror of the TX helper — surface the
// factual substrate for a cruelty ground when the profile carries it.
// Never mutate the shared groundsResolver; this runs only after
// cruel_treatment has already resolved.
const CRUELTY_SUBCAT_PATTERN =
  /(cruelty|cruel[_\s]treatment|physical[_\s]abuse|domestic[_\s]violence|family[_\s]violence)/i;
const CRUELTY_KEYWORD_PATTERN =
  /\b(hospital|er\b|emergency[_\s-]?room|police|documented|documentation|witness(es|ed)?|medical\s+records|police\s+report(s)?|photograph(s|ed)?|photos)\b/i;

function normalizeSubstrateDescription(raw) {
  if (typeof raw !== 'string') return '';
  return raw.trim().replace(/\s+/g, ' ').replace(/[.;,\s]+$/, '');
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
    const desc = normalizeSubstrateDescription(content) || normalizeSubstrateDescription(sourceQuote);
    if (!desc) continue;
    if (category === 'grounds' || category === 'ground' || subcatHit) {
      return desc;
    }
    if (!fallback) fallback = desc;
  }
  return fallback;
}

// Attorney round-2 (2026-08): Amara prayer said "legal and physical
// custody of the minor child(ren) in their best interests" when the
// transcript was unambiguous: sole legal + sole physical, supervised
// visitation only. Trigger on the structured `custodyPreference`
// enum or on facts whose subcategory/content names a sole-custody +
// supervised-visitation request. Detection is intentionally narrow —
// generic "best interests" language stays the default whenever the
// profile hasn't stated a specific ask.
const SOLE_CUSTODY_PATTERN =
  /\b(sole\s+legal(\s+and\s+(sole\s+)?physical)?|sole\s+physical|sole\s+custody|full\s+custody|primary\s+sole)\b/i;
const SUPERVISED_VISIT_PATTERN =
  /\b(supervised\s+(visit(s|ation|ing)?|parenting[_\s-]?time|contact|access)|visitation\s+supervised|no[-\s]visitation|no\s+visits?)\b/i;

function detectSoleCustodyRequest(divorceData) {
  const d = divorceData || {};
  if (typeof d.custodyPreference === 'string') {
    const cp = d.custodyPreference.toLowerCase().trim();
    if (cp === 'sole_legal_sole_physical' || cp === 'sole') {
      return {
        sole: true,
        supervised: d.visitationPreference === 'supervised'
          || d.supervisedVisitation === true
          || SUPERVISED_VISIT_PATTERN.test(String(d.visitationPreference || '')),
      };
    }
  }
  const facts = Array.isArray(d.facts) ? d.facts : [];
  let sole = false;
  let supervised = false;
  for (const fact of facts) {
    if (!fact || typeof fact !== 'object') continue;
    const blob = [
      fact.subcategory || '',
      fact.content || fact.text || fact.value || '',
      fact.sourceQuote || '',
    ].join(' ');
    if (SOLE_CUSTODY_PATTERN.test(blob)) sole = true;
    if (SUPERVISED_VISIT_PATTERN.test(blob)) supervised = true;
    if (sole && supervised) break;
  }
  return { sole, supervised };
}

/**
 * Georgia Complaint for Divorce Template
 *
 * Legal References:
 * - O.C.G.A. § 19-5-1 et seq. — Divorce proceedings
 * - O.C.G.A. § 19-5-3 — Grounds for divorce (13 grounds total: grounds 1-5 are voidability grounds; 6-12 are fault grounds; 13 is irretrievably broken no-fault)
 * - O.C.G.A. § 19-5-2 — Residency requirements (6 months)
 * - O.C.G.A. § 19-5-8 — 30-day waiting period after service
 * - O.C.G.A. § 19-6-1 — Alimony
 * - O.C.G.A. § 19-7-1 — Child custody — best interests standard
 * - O.C.G.A. § 19-6-15 — Child support guidelines
 *
 * Georgia-Specific Notes:
 * - Filed in Superior Court of the county where respondent resides
 * - 6-month state residency required (no county residency requirement)
 * - 30-day waiting period after service before final judgment
 * - 13 fault grounds plus no-fault (irretrievably broken)
 * - Equitable distribution (NOT community property)
 * - "Alimony" (not maintenance or spousal support)
 * - "Legal Custody" / "Physical Custody" (not parenting responsibilities)
 * - Document titled "COMPLAINT FOR DIVORCE" (not petition in some courts)
 */
class GeorgiaDivorcePetitionTemplate extends BaseDivorcePetitionTemplate {
  constructor() {
    super();

    this.state = 'GA';
    this.stateName = 'Georgia';
    this.documentTitle = 'COMPLAINT FOR DIVORCE';

    try {
      this.metadata = require('./divorce-metadata.json');
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

    // Georgia residency — 6 months state, no county requirement
    this.residencyRequirements = {
      stateMonths: 6,
      countyDays: 0,
      description: 'Petitioner must have been a bona fide resident of Georgia for at least six months immediately preceding the filing of this Complaint. (O.C.G.A. § 19-5-2)'
    };

    // Georgia waiting period — 30 days from service (cannot be waived for no-fault)
    this.waitingPeriod = {
      days: 30,
      startsFrom: 'service_date',
      exceptions: ['May not apply to fault-based grounds other than irretrievably broken (O.C.G.A. § 19-5-3(13))'],
      description: 'Georgia requires a mandatory 30-day waiting period after service of process before the court may enter a final judgment for no-fault (irretrievably broken) divorces. This period cannot be waived by agreement. (O.C.G.A. § 19-5-3(13))'
    };
  }

  /**
   * Get Georgia case number label — "CIVIL ACTION FILE NO."
   * @returns {string} Case number label
   */
  getCaseNumberLabel() {
    return 'CIVIL ACTION FILE NO.';
  }

  /**
   * Get default court for Georgia county — Superior Court
   * @param {string} county - County name
   * @returns {string} Court name
   */
  getDefaultCourt(county) {
    const countyName = county || '[COUNTY]';
    return `Superior Court of ${countyName} County, Georgia`;
  }

  /**
   * Generate Georgia header
   * @returns {string} Header text
   */
  generateHeader() {
    return 'STATE OF GEORGIA';
  }

  /**
   * Generate Georgia venue
   * @param {string} county - County name
   * @returns {string} Venue text
   */
  generateVenue(county) {
    const countyUpper = (county || '[COUNTY]').toUpperCase();
    return `COUNTY OF ${countyUpper}`;
  }

  /**
   * Generate Georgia case caption — uses plaintiff/defendant style
   * Georgia divorce complaints use Plaintiff and Defendant designations
   * @param {Object} divorceData - The divorce data
   * @returns {Object} Case caption
   */
  generateCaseCaption(divorceData) {
    let caption = '';

    const courtName = (divorceData.court || this.getDefaultCourt(divorceData.county)).toUpperCase();
    caption += `IN THE ${courtName}\n\n`;

    const caseLabel = this.getCaseNumberLabel();
    // Georgia complaints are commonly assembled before the clerk has
    // assigned a Civil Action File No. — render a visible fill-in blank
    // plus a drafter note rather than the `[CASE NUMBER]` sentinel token
    // that the generate route's PLACEHOLDER_DENYLIST would (correctly)
    // refuse. Mirrors the ON v8-D pattern (see
    // templates/states/ontario/DivorceDecreeTemplate.js#generateCaseCaption).
    const hasCaseNumber = typeof divorceData.caseNumber === 'string'
      && divorceData.caseNumber.trim().length > 0;
    const caseNumber = hasCaseNumber ? divorceData.caseNumber : '______________________';
    caption += `${caseLabel} ${caseNumber}\n`;
    if (!hasCaseNumber) {
      caption += '(Draft — insert case number before filing)\n';
    }
    caption += '\n';

    const petitioner = (divorceData.petitionerName || '[PLAINTIFF NAME]').toUpperCase();
    const respondent = (divorceData.respondentName || '[DEFENDANT NAME]').toUpperCase();

    caption += `${petitioner},\n`;
    caption += `    Plaintiff,\n\n`;
    caption += `v.\n\n`;
    caption += `${respondent},\n`;
    caption += `    Defendant.`;

    return {
      courtName,
      caseNumber: divorceData.caseNumber,
      petitioner: divorceData.petitionerName,
      respondent: divorceData.respondentName,
      formatted: caption
    };
  }

  /**
   * Georgia override for the respondent residence clause.
   *
   * v19 replay: Amara's profile carried respondentAddressUnknown=true and
   * respondentSuspectedLocation="Alabama near Mobile", but the base clause
   * dropped the suspected-location caveat. Mirror the TX v7 override
   * (templates/states/texas/DivorcePetitionTemplate.js#getRespondentResidenceClause):
   * consume the sworn-truth fields first, refuse to render any hedged
   * free-text address, and append the non-sworn suspected location as a
   * bracketed follow-up sentence — never as an assertion of residence.
   *
   * @param {Object} divorceData
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
    const hedgePattern =
      /\b(possibly|maybe|perhaps|probably|somewhere|not\s+sure|unsure|i\s+think|i\s+don'?t\s+know|no\s+known|no\s+current\s+address|unknown|whereabouts\s+unknown|address\s+unknown|could\s+be|might\s+be)\b/i;
    if (hedgePattern.test(raw)) {
      return altService + suspectedNote;
    }
    return `is a resident of ${raw}`;
  }

  /**
   * Match the GA residence-clause triggers so the Draft alt-service note
   * appears on every branch that pleads alternative service.
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
   * Georgia alt-service Draft note: O.C.G.A. § 9-11-4(f)(1)(A) motion +
   * due-diligence affidavit. Service by publication is limited relief — no
   * personal money judgment against the absent spouse, and no child support
   * unless the long-arm requirements of O.C.G.A. § 19-9-64 are separately
   * satisfied.
   */
  getAltServiceNote(_divorceData) {
    return (
      'Alternative service in Georgia requires a court order under ' +
      'O.C.G.A. § 9-11-4(f)(1)(A), supported by a due-diligence affidavit ' +
      'describing the search for Respondent. Service by publication is ' +
      'limited relief: it will not support a personal money judgment ' +
      'against Respondent, and it will not support child support against ' +
      'an absent spouse unless the long-arm requirements of O.C.G.A. ' +
      '§ 19-9-64 are independently satisfied.'
    );
  }

  /**
   * Get Georgia jurisdiction statement
   * @param {Object} divorceData - Divorce data
   * @returns {string} Jurisdiction statement
   */
  getJurisdictionStatement(divorceData) {
    return `Plaintiff has been a bona fide resident of the State of Georgia for more than six (6) months immediately preceding the filing of this Complaint. (O.C.G.A. § 19-5-2)`;
  }

  /**
   * Get Georgia venue reason
   * @param {Object} divorceData - Divorce data
   * @returns {string} Venue reason
   */
  getVenueReason(divorceData) {
    const county = divorceData.county || '[COUNTY]';
    // Nonresident-defendant venue: when the petitioner has affirmed the
    // Defendant's whereabouts are unknown (or that Defendant has left
    // Georgia — Amara v-round-2 audit, 2026-08 — Defendant moved to
    // Alabama), the "Defendant resides in [county] County, Georgia"
    // clause is a fabrication. Plead the O.C.G.A. § 19-5-2
    // Plaintiff-residency venue basis instead.
    if (divorceData.respondentAddressUnknown === true) {
      return `Defendant is a nonresident of Georgia; venue is proper in ${county} County under O.C.G.A. § 19-5-2 because Plaintiff is a bona fide resident of ${county} County`;
    }
    return `Defendant resides in ${county} County, Georgia, or, in the alternative, Plaintiff resides in this county`;
  }

  /**
   * Generate Georgia grounds section — supports all 13+ Georgia grounds
   * @param {Object} divorceData - Divorce data
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

    // Attorney round-2 (2026-08): a cruelty petition should surface
    // Georgia's family-violence procedural options — the client may not
    // know about the Family Violence Protection Act TPO (O.C.G.A.
    // §19-13-1 et seq.) or the presumption against awarding custody to
    // a family-violence perpetrator (O.C.G.A. §19-9-3(a)(4)).
    if (grounds === 'cruel_treatment' || grounds === 'cruelty') {
      items.push({
        number: null,
        content:
          '(Draft — Family-violence procedural options in Georgia: ' +
          'Plaintiff may petition for a temporary protective order under ' +
          'the Family Violence Protection Act, O.C.G.A. §19-13-1 et seq., ' +
          'either in this action or as a separate proceeding. In any ' +
          'custody determination, the court must consider evidence of ' +
          'family violence under O.C.G.A. §19-9-3(a)(4), and there is a ' +
          'presumption against awarding sole or joint custody to a parent ' +
          'who has committed family violence.)',
        type: 'grounds_draft_note',
      });
    }

    return {
      title: 'IV. GROUNDS FOR DIVORCE',
      items,
      nextParagraphNumber: paragraphNum
    };
  }

  /**
   * Get Georgia-specific grounds statement
   * @param {string} grounds - Grounds code
   * @returns {string} Grounds text
   */
  getGroundsText(grounds, divorceData) {
    switch (grounds) {
      case 'irretrievably_broken':
      case 'irreconcilable_differences':
      case 'no_fault':
        return 'The marriage of the parties is irretrievably broken. (O.C.G.A. § 19-5-3(13))';
      case 'adultery':
        return 'Defendant has committed adultery after the marriage. (O.C.G.A. § 19-5-3(6))';
      case 'wilful_desertion':
      case 'desertion':
        return 'Defendant has wilfully and continuously deserted Plaintiff for a term of one (1) year. (O.C.G.A. § 19-5-3(7))';
      case 'cruel_treatment':
      case 'cruelty': {
        const base =
          'Defendant has engaged in cruel treatment toward Plaintiff, consisting of the willful infliction of pain, bodily or mental, upon Plaintiff, such as reasonably justifies apprehension of danger to life, limb, or health. (O.C.G.A. § 19-5-3(10))';
        const substrate = findCrueltySubstrate(divorceData || {});
        if (!substrate) return base;
        return `${base} Plaintiff further pleads that the cruel treatment includes ${substrate}, documentation of which Plaintiff will produce.`;
      }
      case 'habitual_intoxication':
        return 'Defendant is guilty of habitual intoxication. (O.C.G.A. § 19-5-3(9))';
      case 'habitual_drug_use':
        return 'Defendant is guilty of habitual addiction to controlled substances. (O.C.G.A. § 19-5-3(12))';
      case 'conviction_of_crime':
        return 'Defendant has been convicted of an offense involving moral turpitude and sentenced to imprisonment in a penal institution for a term of two (2) years or longer. (O.C.G.A. § 19-5-3(8))';
      case 'incurable_mental_illness':
        return 'Defendant suffers from an incurable mental illness, as established by the testimony of two (2) physicians. (O.C.G.A. § 19-5-3(11))';
      case 'fraud_duress':
      case 'force_menace_duress_fraud':
        return 'The marriage was obtained by force, menace, duress, or fraud. (O.C.G.A. § 19-5-3(4))';
      case 'pregnancy_by_another':
        return 'At the time of the marriage, the wife was pregnant by a man other than Defendant, unknown to Defendant. (O.C.G.A. § 19-5-3(5))';
      case 'intermarriage_prohibited_kinship':
      case 'prohibited_kinship':
        return 'The parties are related within the prohibited degrees of kinship, rendering the purported marriage void. (O.C.G.A. § 19-5-3(1))';
      case 'impotency':
        return 'Defendant was impotent at the time of the marriage. (O.C.G.A. § 19-5-3(3))';
      case 'mental_incapacity_at_marriage':
        return 'Defendant was mentally incapacitated at the time of the marriage. (O.C.G.A. § 19-5-3(2))';
      default:
        return 'The marriage of the parties is irretrievably broken. (O.C.G.A. § 19-5-3(13))';
    }
  }

  /**
   * Generate Georgia children section — uses "custody" not "parental responsibilities"
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Children section
   */
  generateChildrenSection(divorceData) {
    const items = [];
    let paragraphNum = divorceData._paragraphNum || 9;

    if (divorceData.hasMinorChildren === false || !divorceData.children || divorceData.children.length === 0) {
      items.push({
        number: paragraphNum++,
        content: 'There are no minor children born of or adopted during this marriage, and none are expected.',
        type: 'children_info'
      });
    } else {
      items.push({
        number: paragraphNum++,
        content: 'The following minor children were born of or adopted during this marriage:',
        type: 'children_info'
      });

      if (divorceData.children && divorceData.children.length > 0) {
        divorceData.children.forEach((child, index) => {
          // Child NAME stays as `[CHILD NAME]` — a petition with an unnamed
          // child is genuinely defective and must trip the denylist. Birth
          // date, by contrast, is frequently unknown at draft time (adoption
          // records pending, out-of-state certificate not on hand); render a
          // visible fill-in blank instead of a `[BIRTH DATE]` sentinel that
          // would 422 the whole petition. Mirrors the ON v8-D pattern.
          const childDob = this.formatDate(child.birthDate ?? child.dob ?? child.dateOfBirth);
          const dobDisplay = childDob || '__________________';
          const childInfo = typeof child === 'string'
            ? child
            : `${child.name || '[CHILD NAME]'}, born ${dobDisplay}`;
          items.push({
            number: paragraphNum++,
            content: `Child ${index + 1}: ${childInfo}`,
            type: 'child_detail'
          });
        });
      }

      items.push({
        number: paragraphNum++,
        content: 'No other children were born of or adopted by the parties during this marriage, and none are expected.',
        type: 'children_info'
      });
    }

    // Agreed child arrangements (custody enum, primary residence, agreed
    // support) — pleaded via the base hooks, never silently dropped.
    paragraphNum = this.appendAgreedChildArrangementPleadings(items, paragraphNum, divorceData);

    // UCCJEA / home-state declaration (O.C.G.A. § 19-9-40 et seq.) —
    // mandatory in every Georgia pleading that touches custody. Renders
    // only when minor children are present. Mirrors the v17-C NY pattern
    // (templates/states/newyork/DivorcePetitionTemplate.js).
    if (this.hasChildrenUnder18(divorceData)) {
      const uccjea = this.generateUccjeaItems(divorceData, paragraphNum);
      items.push({
        number: null,
        content: 'UCCJEA HOME-STATE DECLARATION (O.C.G.A. § 19-9-40 et seq.)',
        type: 'uccjea_header',
      });
      items.push(...uccjea.items);
      paragraphNum = uccjea.nextParagraphNumber;
    }

    return {
      title: 'V. MINOR CHILDREN',
      items,
      nextParagraphNumber: paragraphNum
    };
  }

  /**
   * Whether the case actually has minor children (under 18) — the trigger
   * for a UCCJEA / home-state declaration under O.C.G.A. § 19-9-40 et seq.
   * Mirror of the NY implementation.
   *
   * @param {Object} divorceData
   * @returns {boolean}
   */
  hasChildrenUnder18(divorceData) {
    const d = divorceData || {};
    if (d.hasMinorChildren === false) return false;
    const childArr = Array.isArray(d.children) ? d.children : [];
    if (d.hasMinorChildren === true || (typeof d.numberOfChildren === 'number' && d.numberOfChildren > 0)) {
      const dobs = childArr
        .map((c) => (typeof c === 'object' && c ? (c.birthDate ?? c.dob ?? c.dateOfBirth) : null))
        .filter(Boolean)
        .map((s) => Date.parse(s))
        .filter((t) => !Number.isNaN(t));
      if (dobs.length === 0) return true;
      const eighteenYearsMs = 18 * 365.25 * 24 * 60 * 60 * 1000;
      const now = Date.now();
      return dobs.some((t) => (now - t) < eighteenYearsMs);
    }
    if (childArr.length === 0) return false;
    const eighteenYearsMs = 18 * 365.25 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    let anyRenderable = false;
    for (const c of childArr) {
      if (typeof c !== 'object' || !c) continue;
      const raw = c.birthDate ?? c.dob ?? c.dateOfBirth;
      const t = raw ? Date.parse(raw) : NaN;
      if (!Number.isNaN(t)) {
        anyRenderable = true;
        if ((now - t) < eighteenYearsMs) return true;
      }
    }
    return !anyRenderable;
  }

  /**
   * UCCJEA / home-state declaration items for the children section.
   * Rendered whenever the case has children under 18. Georgia has adopted
   * the Uniform Child Custody Jurisdiction and Enforcement Act as
   * O.C.G.A. § 19-9-40 et seq.; every pleading touching custody must state
   * the child's home state, current and prior 5-year residences, and
   * disclose any pending custody actions elsewhere. See O.C.G.A. § 19-9-67.
   *
   * @param {Object} divorceData
   * @param {number} paragraphNum
   * @returns {{items: Array, nextParagraphNumber: number}}
   */
  generateUccjeaItems(divorceData, paragraphNum) {
    const items = [];
    const homeState = divorceData.childHomeState || 'Georgia';
    items.push({
      number: paragraphNum++,
      content: `Pursuant to the Uniform Child Custody Jurisdiction and Enforcement Act (O.C.G.A. § 19-9-40 et seq.), Plaintiff states that ${homeState} is the home state of the minor child(ren) named above, the child(ren) having lived in ${homeState} with a parent for at least six consecutive months immediately preceding the commencement of this action (or since birth for any child under six months of age).`,
      type: 'uccjea_home_state',
    });

    const childArr = Array.isArray(divorceData.children) ? divorceData.children : [];
    const minors = childArr.filter((c) => {
      if (typeof c !== 'object' || !c) return typeof c === 'string';
      const raw = c.birthDate ?? c.dob ?? c.dateOfBirth;
      const t = raw ? Date.parse(raw) : NaN;
      if (Number.isNaN(t)) return true;
      const eighteenYearsMs = 18 * 365.25 * 24 * 60 * 60 * 1000;
      return (Date.now() - t) < eighteenYearsMs;
    });

    minors.forEach((child, i) => {
      const name = typeof child === 'string' ? child : (child.name || `[CHILD ${i + 1} NAME]`);
      const dob = typeof child === 'object'
        ? this.formatDate(child.birthDate ?? child.dob ?? child.dateOfBirth)
        : null;
      const currentAddress = (typeof child === 'object' && (child.currentAddress || child.address))
        || divorceData.petitionerAddress
        || '[CURRENT ADDRESS]';
      items.push({
        number: paragraphNum++,
        content: `Child: ${name}${dob ? `, born ${dob}` : ''}. Present address: ${currentAddress}.`,
        type: 'uccjea_child_address',
      });

      const priorAddresses = (typeof child === 'object' && Array.isArray(child.priorAddresses))
        ? child.priorAddresses
        : [];
      if (priorAddresses.length > 0) {
        items.push({
          number: paragraphNum++,
          content: `Addresses within the last five (5) years for ${name}: ${priorAddresses.join('; ')}.`,
          type: 'uccjea_prior_addresses',
        });
      } else {
        items.push({
          number: paragraphNum++,
          content: `Addresses within the last five (5) years for ${name}: same as present address, except as follows: __________________________________________ (list any prior residences and the persons with whom the child lived).`,
          type: 'uccjea_prior_addresses',
        });
      }
    });

    const pendingActions = divorceData.pendingCustodyActions;
    if (Array.isArray(pendingActions) && pendingActions.length > 0) {
      items.push({
        number: paragraphNum++,
        content: `Plaintiff has participated, or has information concerning, the following custody proceeding(s) involving the minor child(ren): ${pendingActions.join('; ')}.`,
        type: 'uccjea_other_actions',
      });
    } else {
      items.push({
        number: paragraphNum++,
        content: 'Plaintiff has not participated as a party, witness, or in any other capacity in any other litigation or custody proceeding, in any jurisdiction, concerning custody of or visitation with any child subject to this action, and knows of no such pending proceeding in any court, and knows of no other person not a party to this action who has physical custody or claims to have custody or visitation rights with respect to the child(ren).',
        type: 'uccjea_other_actions',
      });
    }

    return { items, nextParagraphNumber: paragraphNum };
  }

  /**
   * Generate Georgia property section — equitable distribution language
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Property section
   */
  generatePropertySection(divorceData) {
    // An agreed division (or an explicit no-property case) pleads the
    // parties' actual agreement via the base hooks instead of the
    // generic boilerplate.
    if (divorceData.hasProperty === false || this.hasAgreedPropertyDivision(divorceData)) {
      return super.generatePropertySection(divorceData);
    }

    const items = [];
    let paragraphNum = divorceData._paragraphNum || 12;

    items.push({
      number: paragraphNum++,
      content: 'The parties have accumulated marital property during the marriage. Plaintiff requests that the Court equitably divide the marital property of the parties, having due regard for the contribution of each party to the acquisition of such property and the other relevant factors.',
      type: 'property_info'
    });

    items.push({
      number: paragraphNum++,
      content: 'The parties have accumulated marital debts. Plaintiff requests that the Court equitably allocate the marital debts of the parties.',
      type: 'debt_info'
    });

    return {
      title: 'VI. PROPERTY AND DEBTS',
      items,
      nextParagraphNumber: paragraphNum
    };
  }

  /**
   * Generate Georgia relief section — uses Georgia-specific terminology
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Relief section
   */
  generateReliefSection(divorceData) {
    const items = [];

    items.push({
      number: null,
      content: 'WHEREFORE, Plaintiff prays that this Court:',
      type: 'relief_intro'
    });

    const reliefItems = [
      'Grant a total divorce between the parties, dissolving the bonds of matrimony;',
      'Equitably divide the marital property of the parties;',
      'Equitably allocate the marital debts of the parties;'
    ];

    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      // Attorney round-2 (2026-08): mirror the profile's actual ask when
      // the client has stated one. A generic "best interests" prayer over
      // an unambiguous sole-legal + sole-physical + supervised-visitation
      // request understates the relief sought.
      const soleReq = detectSoleCustodyRequest(divorceData);
      const plaintiffName = divorceData.petitionerName || 'Plaintiff';
      if (soleReq.sole) {
        reliefItems.push(`Award ${plaintiffName} sole legal custody and sole physical custody of the minor child(ren);`);
        if (soleReq.supervised) {
          reliefItems.push('Order that Defendant\'s visitation with the minor child(ren), if any, be supervised;');
        } else {
          reliefItems.push('Establish a parenting time schedule that serves the best interests of the child(ren);');
        }
      } else {
        reliefItems.push('Award legal and physical custody of the minor child(ren) in their best interests;');
        reliefItems.push('Establish a parenting time schedule;');
      }
      reliefItems.push('Order child support in accordance with O.C.G.A. § 19-6-15 guidelines;');
    }

    if (divorceData.requestSpousalSupport) {
      reliefItems.push('Award alimony to Plaintiff pursuant to O.C.G.A. § 19-6-1;');
    }

    if (divorceData.requestNameChange && divorceData.previousName) {
      reliefItems.push(`Restore Plaintiff's former name to: ${divorceData.previousName};`);
    }

    reliefItems.push('Award attorney fees and costs as the Court deems appropriate;');
    reliefItems.push('Grant such other and further relief as the Court deems just and proper.');

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
      title: 'VII. PRAYER FOR RELIEF',
      items,
      nextParagraphNumber: null
    };
  }

  /**
   * Get Georgia verification text
   * @param {Object} divorceData - Divorce data
   * @returns {string} Verification text
   */
  getVerificationText(divorceData) {
    const name = divorceData.petitionerName || '[PLAINTIFF NAME]';
    return `I, ${name}, Plaintiff, being duly sworn, state that the allegations of the foregoing Complaint for Divorce are true and correct to the best of my knowledge and belief.

_________________________________
${name}
Plaintiff

Sworn to and subscribed before me this _____ day of _______________, 20___.

_________________________________
Notary Public, _______________ County, Georgia
My commission expires: ___________`;
  }

  /**
   * Perform Georgia-specific validation
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Validation result
   */
  performStateSpecificValidation(divorceData) {
    const errors = [];
    const warnings = [];

    if (!divorceData.county) {
      errors.push('County is required for Georgia divorce complaints — file in county where Defendant resides');
    }

    warnings.push('Georgia requires 6 months state residency before filing. (O.C.G.A. § 19-5-2)');
    warnings.push('Georgia requires a 30-day waiting period after service before final judgment. (O.C.G.A. § 19-5-8)');

    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      warnings.push('If minor children are involved, the court will require a parenting plan and child support calculation per O.C.G.A. § 19-6-15.');
    }

    return { errors, warnings };
  }
}

module.exports = GeorgiaDivorcePetitionTemplate;
