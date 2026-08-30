// templates/states/california/DivorcePetitionTemplate.js
// California-specific divorce petition template (FL-100)
// Complies with California Family Code and California Rules of Court

const BaseDivorcePetitionTemplate = require('../../core/BaseDivorcePetitionTemplate');
const { captionUpper } = require('../../core/nameCase');

/**
 * Shape-check for a date value. A date has deterministic syntax; freeform
 * narratives like "a few months ago", "unknown", or "sometime in 2024" must
 * NOT be rendered literally into the pleading (v11 CA replay, 2026-08 —
 * "The parties separated on or about a few months ago"). Accepts:
 *   - ISO YYYY-MM-DD (with optional T-time suffix)
 *   - Slash-separated M/D/YYYY or MM/DD/YYYY
 *   - "Month DD, YYYY" (long-form)
 * Anything else falls through to the visible-blank + Draft-note branch.
 */
function isRenderableDate(v) {
  if (typeof v !== 'string') return false;
  const s = v.trim();
  if (!s) return false;
  if (/^\d{4}-\d{2}-\d{2}(T.*)?$/.test(s)) return true;
  if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(s)) return true;
  if (/^[A-Za-z]+\s+\d{1,2},?\s+\d{4}$/.test(s)) return true;
  return false;
}

/**
 * California Petition for Dissolution of Marriage Template (FL-100)
 *
 * Legal References:
 * - California Family Code Division 6 (Nullity, Dissolution, and Legal Separation)
 * - California Family Code § 2310-2313 (Grounds)
 * - California Family Code § 2330-2334 (Procedure)
 * - California Code of Civil Procedure § 2015.5 (Declarations)
 * - California Rules of Court, Rule 5.12 (Format of papers)
 *
 * California-Specific Notes:
 * - 6-month residency requirement (state) + 3-month (county)
 * - 6-month mandatory waiting period (longest in US)
 * - Community property state
 * - Uses "Dissolution of Marriage" not "Divorce"
 */
class CaliforniaDivorcePetitionTemplate extends BaseDivorcePetitionTemplate {
  constructor() {
    super();

    this.state = 'CA';
    this.stateName = 'California';
    this.documentTitle = 'PETITION FOR DISSOLUTION OF MARRIAGE';
    this.formNumber = 'FL-100';

    // Load metadata if available
    try {
      this.metadata = require('./divorce-metadata.json');
    } catch (e) {
      this.metadata = null;
    }

    // California-specific required fields.
    // marriageDate and separationDate are legally required for a filed
    // FL-100, but drafts routinely originate before the interviewee can
    // pin down an exact date ("separated a few months ago"). The template
    // renders a visible fill-in blank + Draft note for those fields
    // (see generateMarriageInformationSection) rather than emitting a
    // `[DATE OF SEPARATION]` sentinel that the generate route's
    // PLACEHOLDER_DENYLIST would (correctly) refuse. Keeping them out of
    // requiredFields lets the draft render; the visible blank plus the
    // Draft note keeps the drafter on the hook to fill it in before
    // filing. (v10 replay, 2026-08.)
    this.requiredFields = [
      'petitionerName',
      'respondentName',
      'state',
      'county'
    ];

    // California residency requirements
    this.residencyRequirements = {
      stateMonths: 6,
      countyDays: 90, // 3 months
      description: 'You must be a California resident for 6 months AND a resident of the county where you file for 3 months before filing.'
    };

    // California waiting period (longest in US)
    this.waitingPeriod = {
      days: 180, // 6 months
      startsFrom: 'service_date',
      exceptions: [],
      description: 'A divorce cannot be finalized until at least 6 months after the respondent is served. No exceptions.'
    };

    // California formatting requirements
    this.formatting = {
      fontSize: '12pt',
      fontFamily: 'Times New Roman',
      lineHeight: '2',
      margin: '1in',
      paperSize: '8.5in x 11in'
    };
  }

  /**
   * Get California case number label
   * @returns {string} "Case Number:"
   */
  getCaseNumberLabel() {
    return 'Case Number:';
  }

  /**
   * California case caption. Overridden so party names route through
   * captionUpper (which preserves McPherson/DiCaprio/van der Berg internal
   * capitals — the base's plain `.toUpperCase()` corrupted "McPherson" to
   * "MCPHERSON" in the live California acceptance run, 2026-08). Missing
   * data renders as fill-in-by-hand blanks — never `[TOKENS]` — because a
   * filed document is completed by hand, not by placeholder.
   *
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Case caption
   */
  generateCaseCaption(divorceData) {
    const courtName = (divorceData.court || this.getDefaultCourt(divorceData.county) || '______________________ COURT').toUpperCase();
    const caseLabel = this.getCaseNumberLabel();
    const caseNumber = divorceData.caseNumber || '____________________';

    const petitioner = divorceData.petitionerName
      ? captionUpper(divorceData.petitionerName)
      : '_________________________________';
    const respondent = divorceData.respondentName
      ? captionUpper(divorceData.respondentName)
      : '_________________________________';

    const t = this.terminology;
    let caption = '';
    caption += `IN THE ${courtName}\n\n`;
    caption += `${caseLabel} ${caseNumber}\n\n`;
    caption += `IN THE MATTER OF THE MARRIAGE OF:\n\n`;
    caption += `${petitioner}, ${t.filerLabel}\n\n`;
    caption += `AND\n\n`;
    caption += `${respondent}, ${t.responderLabel}`;

    const partyLeft = divorceData.petitionerName
      ? `${petitioner},`
      : '_________________________________,';
    const partyRight = divorceData.respondentName
      ? `${respondent},`
      : '_________________________________,';
    const structured = {
      left: [
        'IN THE MATTER OF THE MARRIAGE OF:',
        '',
        partyLeft,
        `          ${t.filerLabel},`,
        '',
        'and',
        '',
        partyRight,
        `          ${t.responderLabel}.`,
      ],
      right: [
        `${caseLabel} ${caseNumber}`,
        '',
        'Judge _______________',
      ],
    };
    const courtHeaderLine =
      divorceData.court || this.getDefaultCourt(divorceData.county)
        ? `IN THE ${courtName}`
        : 'IN THE ______________________ COURT';

    return {
      courtName,
      courtHeaderLine,
      caseNumber: divorceData.caseNumber,
      petitioner: divorceData.petitionerName,
      respondent: divorceData.respondentName,
      formatted: caption,
      structured,
    };
  }

  /**
   * Get default court for California county
   * @param {string} county - County name
   * @returns {string} Court name
   */
  getDefaultCourt(county) {
    return `Superior Court of California, County of ${county || '[COUNTY]'}`;
  }

  /**
   * Generate California-style header
   * @returns {string} Header text
   */
  generateHeader() {
    return 'SUPERIOR COURT OF CALIFORNIA';
  }

  /**
   * Generate California-style venue
   * @param {string} county - County name
   * @returns {string} Venue text
   */
  generateVenue(county) {
    return `COUNTY OF ${(county || '[COUNTY]').toUpperCase()}`;
  }

  /**
   * Get California jurisdiction statement
   * @param {Object} divorceData - Divorce data
   * @returns {string} Jurisdiction statement
   */
  getJurisdictionStatement(divorceData) {
    return `Petitioner has been a resident of the State of California for at least six months and of ${divorceData.county || '[COUNTY]'} County for at least three months immediately preceding the filing of this Petition. (Family Code § 2320)`;
  }

  /**
   * Get California venue reason
   * @param {Object} divorceData - Divorce data
   * @returns {string} Venue reason
   */
  getVenueReason(divorceData) {
    return `Petitioner resides in this county`;
  }

  /**
   * Generate California marriage information section
   * Includes separation date (required in California)
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Marriage information section
   */
  generateMarriageInformationSection(divorceData) {
    const items = [];
    let paragraphNum = divorceData._paragraphNum || 5;

    // Render a visible fill-in-by-hand blank plus a drafter note when the
    // marriage date is missing rather than a `[DATE OF MARRIAGE]` sentinel
    // token (which the generate route's PLACEHOLDER_DENYLIST refuses).
    // Same pattern as the Ontario decree's case-number handling (v8-D).
    const marriageDateFormatted = isRenderableDate(divorceData.marriageDate)
      ? this.formatDate(divorceData.marriageDate)
      : null;
    const marriageLocationSuffix = divorceData.marriageLocation ? ` in ${divorceData.marriageLocation}` : '';
    if (marriageDateFormatted) {
      items.push({
        number: paragraphNum++,
        content: `Petitioner and Respondent were married on ${marriageDateFormatted}${marriageLocationSuffix}.`,
        type: 'marriage_info'
      });
    } else {
      items.push({
        number: paragraphNum++,
        content: `Petitioner and Respondent were married on __________________${marriageLocationSuffix}.\n(Draft — insert exact date of marriage before filing)`,
        type: 'marriage_info'
      });
    }

    // California requires date of separation. Same visible-blank + Draft
    // note pattern when the interviewee never gave an exact date
    // ("separated a few months ago" — v10 CA replay, 2026-08).
    const separationDateFormatted = isRenderableDate(divorceData.separationDate)
      ? this.formatDate(divorceData.separationDate)
      : null;
    if (separationDateFormatted) {
      items.push({
        number: paragraphNum++,
        content: `The parties separated on or about ${separationDateFormatted}.`,
        type: 'marriage_info'
      });
    } else {
      items.push({
        number: paragraphNum++,
        content: `The parties separated on or about __________________.\n(Draft — insert exact date of separation before filing)`,
        type: 'marriage_info'
      });
    }

    items.push({
      number: paragraphNum++,
      content: `The marriage has become irretrievably broken due to irreconcilable differences. (Family Code § 2310(a))`,
      type: 'marriage_info'
    });

    return {
      title: 'III. MARRIAGE INFORMATION',
      items,
      nextParagraphNumber: paragraphNum
    };
  }

  /**
   * Generate California grounds section
   * California only allows irreconcilable differences or incurable insanity
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Grounds section
   */
  generateGroundsSection(divorceData) {
    const items = [];
    let paragraphNum = divorceData._paragraphNum || 8;

    items.push({
      number: paragraphNum++,
      content: `Irreconcilable differences have caused the irremediable breakdown of the marriage. (Family Code § 2310(a))`,
      type: 'grounds'
    });

    return {
      title: 'IV. GROUNDS FOR DISSOLUTION',
      items,
      nextParagraphNumber: paragraphNum
    };
  }

  /**
   * Generate California children section with FL-105 reference
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Children section
   */
  generateChildrenSection(divorceData) {
    const items = [];
    let paragraphNum = divorceData._paragraphNum || 9;

    const d = divorceData || {};
    const rawChildArr = Array.isArray(d.children) ? d.children : [];

    // Dedupe defence: when the extractor emits nameless, dob-less
    // age-only entries ({age: 24}, {age: 21}, ...), the childrenMerge
    // identity check has nothing to match on and the same two kids
    // accumulate turn after turn up to MAX_CHILDREN=25 (Alison v8-B
    // replay, 2026-08: PDF read "There are 25 adult children of the
    // marriage" for a family with 2 kids ages 24 and 21). Collapse
    // fully anonymous duplicates by age here so the pleading count
    // never quotes the merge cap.
    const childArr = (() => {
      const seenAges = new Set();
      const kept = [];
      for (const c of rawChildArr) {
        if (!c || typeof c !== 'object') { kept.push(c); continue; }
        const hasName = typeof c.name === 'string' && c.name.trim() !== '';
        const dob = c.birthDate ?? c.dob ?? c.dateOfBirth;
        const hasDob = typeof dob === 'string' && dob.trim() !== '';
        if (hasName || hasDob) { kept.push(c); continue; }
        const ageKey = (c.age === undefined || c.age === null) ? '' : String(c.age);
        const key = `__anon__:${ageKey}`;
        if (seenAges.has(key)) continue;
        seenAges.add(key);
        kept.push(c);
      }
      return kept;
    })();

    // Resolve child count: explicit numberOfChildren wins; else infer from
    // the deduped children[] array. Guards against the Alison-class replay
    // where extraction captured numberOfChildren=2 with hasMinorChildren=false
    // but never populated children[] — the old branching collapsed that
    // into a flat "no children were born" denial (CA replay, 2026-08).
    let numChildren = 0;
    const rawNum = d.numberOfChildren;
    if (typeof rawNum === 'number' && Number.isFinite(rawNum)) {
      numChildren = rawNum;
    } else if (typeof rawNum === 'string' && /^\d+$/.test(rawNum.trim())) {
      numChildren = parseInt(rawNum.trim(), 10);
    } else {
      numChildren = childArr.length;
    }

    // If hasMinorChildren is unset but we have DOBs, infer from ages so we
    // never plead adult children as minors (or vice versa).
    let hasMinors = d.hasMinorChildren;
    if ((hasMinors === undefined || hasMinors === null) && childArr.length > 0) {
      const now = Date.now();
      const eighteenYearsMs = 18 * 365.25 * 24 * 3600 * 1000;
      const dobs = childArr
        .map((c) => (typeof c === 'object' && c
          ? (c.birthDate ?? c.dob ?? c.dateOfBirth)
          : null))
        .filter(Boolean)
        .map((s) => Date.parse(s))
        .filter((t) => !Number.isNaN(t));
      if (dobs.length > 0) {
        hasMinors = dobs.some((t) => (now - t) < eighteenYearsMs);
      }
    }

    if (hasMinors === true || (hasMinors === undefined && childArr.length > 0)) {
      // Minor-children path (or unknown-status with children on file).
      items.push({
        number: paragraphNum++,
        content: `The minor children of this marriage are as listed. A completed Declaration Under Uniform Child Custody Jurisdiction and Enforcement Act (UCCJEA) (Form FL-105) is attached.`,
        type: 'children_info'
      });
      childArr.forEach((child) => {
        const name = typeof child === 'string' ? child : (child && child.name) || '[CHILD NAME]';
        const rawDob = typeof child === 'object' && child
          ? (child.birthDate ?? child.dob ?? child.dateOfBirth)
          : null;
        const birthDate = rawDob ? this.formatDate(rawDob) : null;
        items.push({
          number: paragraphNum++,
          content: birthDate ? `${name}, born ${birthDate}` : `${name}`,
          type: 'child_detail'
        });
      });
    } else if (hasMinors === false && numChildren > 0) {
      // Adult-only path — plead as adults with a specific count. Names when
      // known, count-only when not (Alison-class replay).
      const names = childArr
        .map((c) => (typeof c === 'string' ? c : (c && c.name) || null))
        .filter(Boolean);
      const noun = numChildren === 1 ? 'child' : 'children';
      const verb = numChildren === 1 ? 'is' : 'are';
      let sentence = `There ${verb} ${numChildren} adult ${noun} of the marriage`;
      if (names.length > 0) {
        const list = names.length === 1
          ? names[0]
          : names.slice(0, -1).join(', ') + ', and ' + names[names.length - 1];
        sentence += ` (${list})`;
      }
      sentence += `; no orders regarding custody, visitation, or child support are requested.`;
      items.push({
        number: paragraphNum++,
        content: sentence,
        type: 'children_info'
      });
    } else if (hasMinors === false && this.factsMentionAdultChildren(d.facts)) {
      // Narrative-only adult-children path: extractor knows the parties
      // have adult children (hasMinorChildren=false) but never populated
      // a count or a child array. Better to plead the fact without a
      // number than to falsely deny children were born of the marriage
      // (Alison-class replay w/ pre-v10-A extraction, 2026-08).
      items.push({
        number: paragraphNum++,
        content: `There are adult children of the marriage; no orders regarding custody, visitation, or child support are requested.`,
        type: 'children_info'
      });
    } else {
      // True no-children case.
      items.push({
        number: paragraphNum++,
        content: `No children were born or adopted of this marriage, and none are expected.`,
        type: 'children_info'
      });
    }

    // Agreed child arrangements (custody enum, primary residence, agreed
    // support) — pleaded via the base hooks, never silently dropped.
    paragraphNum = this.appendAgreedChildArrangementPleadings(items, paragraphNum, divorceData);

    // Section header must be honest about the section's content: when the
    // parties have no minor children of the marriage, don't head the
    // section "MINOR CHILDREN" (live California acceptance run, 2026-08,
    // headed a purely-adult-children disclosure as "V. MINOR CHILDREN").
    // California FL-100 has no fixed § label here — "CHILDREN OF THE
    // MARRIAGE" mirrors the Family Code § 2337(b) phrasing used in
    // form-level disclosures. Keep "MINOR CHILDREN" only when the section
    // actually pleads minor children.
    const title = this.hasMinorChildrenForRelief(divorceData)
      ? 'V. MINOR CHILDREN'
      : 'V. CHILDREN OF THE MARRIAGE';

    return {
      title,
      items,
      nextParagraphNumber: paragraphNum
    };
  }

  /**
   * Scan facts[] for a narrative mention of adult children. Used as a
   * last-resort fallback in generateChildrenSection when the extractor
   * set hasMinorChildren=false but never populated a count or array —
   * we would otherwise falsely plead "no children were born or adopted".
   * @param {Array<Object|string>} facts
   * @returns {boolean}
   */
  factsMentionAdultChildren(facts) {
    if (!Array.isArray(facts)) return false;
    const re = /\badult\s+child(?:ren)?\b/i;
    for (const f of facts) {
      if (!f) continue;
      const text = typeof f === 'string'
        ? f
        : (typeof f.content === 'string' ? f.content
          : typeof f.text === 'string' ? f.text
            : '');
      if (text && re.test(text)) return true;
    }
    return false;
  }

  /**
   * Generate California property section (community property state)
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
    let paragraphNum = divorceData._paragraphNum || 14;

    items.push({
      number: paragraphNum++,
      content: `Petitioner and Respondent will agree to a division of community property and debts, or alternatively, Petitioner requests the Court to determine rights to community and quasi-community assets and debts.`,
      type: 'property_info'
    });

    items.push({
      number: paragraphNum++,
      content: `There exists community property owned by the parties, the nature and extent of which will be proven at trial or set forth in a Property Declaration (Form FL-160).`,
      type: 'property_info'
    });

    if (divorceData.hasSeparateProperty !== false) {
      items.push({
        number: paragraphNum++,
        content: `Petitioner requests the Court to confirm separate property to each party as their sole and separate property.`,
        type: 'property_request'
      });
    }

    return {
      title: 'VI. PROPERTY',
      items,
      nextParagraphNumber: paragraphNum
    };
  }

  /**
   * Generate California relief section
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Relief section
   */
  generateReliefSection(divorceData) {
    const items = [];

    items.push({
      number: null,
      content: 'Petitioner prays that the Court:',
      type: 'relief_intro'
    });

    const reliefItems = [];

    reliefItems.push('Grant a dissolution of the marriage and all other relief requested in this petition;');
    reliefItems.push('Divide the community property equally between the parties (Family Code § 2550);');
    reliefItems.push('Confirm each party\'s separate property to that party;');

    // Add child-related relief only when the case has MINOR children —
    // hasMinorChildren === false suppresses these items even when adult
    // children are named in children[] (live California audit, 2026-08).
    if (this.hasMinorChildrenForRelief(divorceData)) {
      reliefItems.push('Determine custody and visitation of the minor child(ren) in their best interests;');
      reliefItems.push('Order child support per the California Statewide Uniform Guideline (Family Code § 4050-4076);');
    }

    if (divorceData.requestSpousalSupport) {
      reliefItems.push('Order spousal support from Respondent to Petitioner (Family Code § 4320);');
    }

    if (divorceData.requestNameChange && divorceData.previousName) {
      reliefItems.push(`Restore Petitioner's former name to: ${divorceData.previousName};`);
    }

    reliefItems.push('Each party to pay their own attorney fees and costs, unless the Court determines otherwise (Family Code § 2030);');
    reliefItems.push('Grant such other and further relief as the Court deems just and proper.');

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
   * Get California verification text (Declaration under penalty of perjury per CCP § 2015.5)
   * @param {Object} divorceData - Divorce data
   * @returns {string} Verification text
   */
  getVerificationText(divorceData) {
    const name = divorceData.petitionerName || '[PETITIONER NAME]';

    return `I declare under penalty of perjury under the laws of the State of California that the foregoing is true and correct.

Date: ___________________

_________________________________
${name}
(SIGNATURE OF PETITIONER)`;
  }

  /**
   * Perform California-specific validation
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Validation result
   */
  performStateSpecificValidation(divorceData) {
    const errors = [];
    const warnings = [];

    // California requires county
    if (!divorceData.county) {
      errors.push('County is required for California dissolution petitions');
    }

    // California requires date of separation for a filed petition, but
    // drafts routinely originate before the interviewee can pin down an
    // exact date. Demote to a warning; the template renders a visible
    // fill-in blank + Draft note in that case (see
    // generateMarriageInformationSection). (v10 CA replay, 2026-08.)
    if (!divorceData.separationDate) {
      warnings.push('Date of separation is required before filing a California dissolution petition; the draft renders a fill-in blank until you supply the exact date.');
    }

    if (!divorceData.marriageDate) {
      warnings.push('Date of marriage is required before filing a California dissolution petition; the draft renders a fill-in blank until you supply the exact date.');
    }

    // Warning about 6-month waiting period
    warnings.push('California has a mandatory 6-month waiting period. Your divorce cannot be finalized until at least 6 months after Respondent is served.');

    // Warning about financial disclosure
    warnings.push('California requires mandatory financial disclosure (FL-140, FL-142, FL-150). You must serve these on the other party.');

    // Children warning
    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      warnings.push('You must complete and attach Declaration Under UCCJEA (Form FL-105) when minor children are involved.');
    }

    return { errors, warnings };
  }
}

module.exports = CaliforniaDivorcePetitionTemplate;
