// templates/states/florida/DivorcePetitionTemplate.js
// Florida-specific divorce petition template
// Complies with Florida Statutes Chapter 61 and Florida Family Law Rules of Procedure

const BaseDivorcePetitionTemplate = require('../../core/BaseDivorcePetitionTemplate');

/**
 * Attorney round-5 (Tavita FL, 2026-08-30): LLM extraction occasionally
 * lands the literal string "null" / "undefined" / "N/A" where the slot
 * was meant to be empty. Rendering "Case No.: null" is worse than a
 * blank fill-in line.
 */
function _sanitizeCaseNumber(value) {
  if (value == null) return '';
  const s = String(value).trim();
  if (!s) return '';
  const lower = s.toLowerCase();
  if (lower === 'null' || lower === 'undefined' || lower === 'n/a' || lower === 'none') return '';
  // Round-6: strip punctuation-only sentinels (".", "..") that LLM
  // extraction lands when the case number is unknown.
  if (!/[A-Za-z0-9]/.test(s)) return '';
  return s;
}

/**
 * Florida Petition for Dissolution of Marriage Template
 *
 * Legal References:
 * - Florida Statutes Chapter 61 (Dissolution of Marriage; Support; Time-Sharing)
 * - Florida Family Law Rules of Procedure
 * - Florida Supreme Court Approved Family Law Forms
 *
 * Official Forms:
 * - Form 12.901(a): Joint Petition for Simplified Dissolution
 * - Form 12.901(b)(1): Petition for Dissolution with Minor Children
 * - Form 12.901(b)(2): Petition for Dissolution with Property, No Minor Children
 * - Form 12.901(b)(3): Petition for Dissolution No Property, No Minor Children
 * - Form 12.902(b): Family Law Financial Affidavit (Short Form)
 * - Form 12.902(c): Family Law Financial Affidavit (Long Form)
 *
 * Formatting Requirements:
 * - 8.5" x 11" paper
 * - 1" margins
 * - 12-point font
 * - Double-spaced
 *
 * Florida-Specific Notes:
 * - 6-month residency requirement
 * - 20-day mandatory waiting period from filing before final judgment (Fla. Stat. § 61.19)
 * - Court may waive waiting period upon finding of injustice
 * - Permanent alimony abolished effective July 1, 2023 (SB 1416)
 * - Available alimony types: bridge-the-gap, rehabilitative, durational, lump sum
 */
class FloridaDivorcePetitionTemplate extends BaseDivorcePetitionTemplate {
  constructor() {
    super();

    this.state = 'FL';
    this.stateName = 'Florida';
    this.documentTitle = 'PETITION FOR DISSOLUTION OF MARRIAGE';

    // Load metadata if available
    try {
      this.metadata = require('./divorce-metadata.json');
    } catch (e) {
      this.metadata = null;
    }

    // Florida-specific required fields
    this.requiredFields = [
      'petitionerName',
      'respondentName',
      'state',
      'county',
      'marriageDate'
    ];

    // Florida residency requirements
    this.residencyRequirements = {
      stateMonths: 6,
      countyDays: 0,
      description: 'At least one spouse must have been a Florida resident for at least 6 months before filing.'
    };

    // Florida waiting period — Fla. Stat. § 61.19
    this.waitingPeriod = {
      days: 20,
      startsFrom: 'filing_date',
      exceptions: ['Court may waive upon finding earlier judgment necessary to avoid injustice'],
      description: 'Florida requires a mandatory 20-day waiting period from filing before the court may enter a final judgment of dissolution. (Fla. Stat. § 61.19)'
    };

    // Florida formatting requirements
    this.formatting = {
      fontSize: '12pt',
      fontFamily: 'Times New Roman',
      lineHeight: '2',
      margin: '1in',
      paperSize: '8.5in x 11in'
    };

    // Florida form numbers
    this.formNumbers = {
      simplified: '12.901(a)',
      withChildren: '12.901(b)(1)',
      withPropertyNoChildren: '12.901(b)(2)',
      noPropertyNoChildren: '12.901(b)(3)'
    };
  }

  /**
   * Get appropriate Florida form number based on case type
   * @param {Object} divorceData - Divorce data
   * @returns {string} Form number
   */
  getFormNumber(divorceData) {
    if (divorceData.simplified) {
      return this.formNumbers.simplified;
    }
    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      return this.formNumbers.withChildren;
    }
    if (divorceData.hasProperty === true) {
      return this.formNumbers.withPropertyNoChildren;
    }
    return this.formNumbers.noPropertyNoChildren;
  }

  /**
   * Get Florida case number label
   * @returns {string} "Case No.:"
   */
  getCaseNumberLabel() {
    return 'Case No.:';
  }

  /**
   * Get default court for Florida county
   * @param {string} county - County name
   * @returns {string} Court name
   */
  getDefaultCourt(county) {
    return `Circuit Court of the ${this.getJudicialCircuit(county)} Judicial Circuit, in and for ${county || '[COUNTY]'} County, Florida`;
  }

  /**
   * Get judicial circuit number for Florida county
   * @param {string} county - County name
   * @returns {string} Circuit number
   */
  getJudicialCircuit(county) {
    // Florida has 20 judicial circuits
    // This would need to be expanded with a full county-to-circuit mapping
    const circuitMap = {
      'Miami-Dade': '11th',
      'Broward': '17th',
      'Palm Beach': '15th',
      'Hillsborough': '13th',
      'Orange': '9th',
      'Duval': '4th',
      'Pinellas': '6th'
    };
    return circuitMap[county] || '[CIRCUIT]';
  }

  /**
   * Generate Florida-style header
   * @returns {string} Header text
   */
  generateHeader() {
    return 'IN THE CIRCUIT COURT OF THE STATE OF FLORIDA';
  }

  /**
   * Generate Florida case caption
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Case caption
   */
  generateCaseCaption(divorceData) {
    let caption = '';

    // Court
    const courtName = divorceData.court || this.getDefaultCourt(divorceData.county);
    caption += `IN THE ${courtName.toUpperCase()}\n\n`;

    // Case number — reject literal "null"/"undefined" strings that
    // slip in when the LLM extracts a missing case number as a string
    // sentinel (Tavita FL, round-5).
    const caseNumberSafe = _sanitizeCaseNumber(divorceData.caseNumber);
    caption += `Case No.: ${caseNumberSafe || '____________________'}\n`;
    caption += `Division: ${divorceData.division || 'Family'}\n\n`;

    // Parties
    const petitioner = divorceData.petitionerName || '[PETITIONER NAME]';
    const respondent = divorceData.respondentName || '[RESPONDENT NAME]';

    caption += `In re: The Marriage of\n\n`;
    caption += `${petitioner.toUpperCase()},\n`;
    caption += `     Petitioner,\n\n`;
    caption += `and\n\n`;
    caption += `${respondent.toUpperCase()},\n`;
    caption += `     Respondent.\n`;
    caption += `_________________________________/`;

    // Round-7 attorney review (Tavita FL, 2026-08-30): the caption used to
    // append `${this.documentTitle}\n Florida Supreme Court Approved Family
    // Law Form ${formNumber}` — but the base template's buildDocument also
    // renders `sections.title` from generateTitle() right after the caption,
    // so the "PETITION FOR DISSOLUTION OF MARRIAGE" heading appeared twice
    // (once as the closing line of the caption, once as the standalone
    // title section). Strip the title from the caption; the form-number
    // citation moves into generateTitle() below so we never lose it.

    return {
      courtName,
      caseNumber: divorceData.caseNumber,
      petitioner: divorceData.petitionerName,
      respondent: divorceData.respondentName,
      formatted: caption
    };
  }

  /**
   * Round-7 attorney review (Tavita FL, 2026-08-30): the title section now
   * carries the Florida Supreme Court Approved Family Law Form number that
   * previously lived at the end of the caption. Rendering the title once
   * here (instead of duplicating it inside the caption) means the "PETITION
   * FOR DISSOLUTION OF MARRIAGE" heading appears exactly one time.
   *
   * @returns {string} Title text with FL form citation
   */
  generateTitle(divorceData) {
    // Base template invokes generateTitle() without args (see
    // BaseDivorcePetitionTemplate.buildDocument), so we can't consult
    // divorceData here for the form-selection branches. Emit the title
    // with the base form citation — the specific form number for the
    // matter type is set on the packet cover.
    return this.documentTitle;
  }

  /**
   * Generate Florida jurisdiction statement
   * @param {Object} divorceData - Divorce data
   * @returns {string} Jurisdiction statement
   */
  getJurisdictionStatement(divorceData) {
    // Round-7 attorney review (Tavita FL, 2026-08-30): the body prose used
    // the parties' proper names ("Marco Rossi has been a resident..."),
    // but FL convention is to use the role label ("Petitioner", "Respondent")
    // in body text; parties are named once in the caption's "In re: The
    // Marriage of ..." block. Use role labels here; the caption still
    // carries the parties' names.
    if (divorceData.bothResidents) {
      return 'Petitioner and Respondent have both been residents of Florida for more than 6 months before the filing of this Petition for Dissolution of Marriage.';
    }
    return 'Petitioner has been a resident of the State of Florida for more than 6 months before the filing of this Petition for Dissolution of Marriage.';
  }

  /**
   * Round-7 attorney review (Tavita FL, 2026-08-30): the transcript said
   * "3 months ago" and the orchestrator computed a specific separation
   * date ("May 29, 2026"). A specific day pleaded under oath is a
   * fabrication when the source was a relative expression — the filer
   * cannot swear to that day. When the profile flags the separation date
   * as approximate/derived from a relative expression, render the Draft
   * blank so the filer must confirm the actual date before filing.
   *
   * Triggers:
   *   1. divorceData.separationDateApproximate === true
   *   2. divorceData.separationDateEstimated === true
   *   3. a `separation` / `separation_duration` fact whose sourceQuote
   *      contains a relative expression ("ago", "approximately", "about")
   *
   * @returns {boolean}
   */
  _isApproximateSeparationDate(divorceData) {
    if (!divorceData) return false;
    if (divorceData.separationDateApproximate === true) return true;
    if (divorceData.separationDateEstimated === true) return true;
    const facts = Array.isArray(divorceData.facts) ? divorceData.facts : [];
    for (const f of facts) {
      if (!f || typeof f !== 'object') continue;
      const sub = String(f.subcategory || '').toLowerCase();
      if (!/separation/.test(sub)) continue;
      const src = String(f.sourceQuote || '').toLowerCase();
      if (/\b(ago|approximately|about|around|roughly|sometime|months? ago|weeks? ago|years? ago)\b/.test(src)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Override marriage information section to guard against a fabricated
   * separation date derived from a relative transcript expression
   * ("3 months ago" → "May 29, 2026"). When the date is flagged
   * approximate, render the Draft blank instead of the specific day.
   */
  generateMarriageInformationSection(divorceData) {
    if (this._isApproximateSeparationDate(divorceData)) {
      // Feed the base a shallow clone with separationDate wiped so it
      // renders the Draft blank branch (see BaseDivorcePetitionTemplate's
      // isRenderableDate guard).
      const cloned = { ...divorceData, separationDate: '' };
      // Preserve the base's "insert exact date of separation" Draft note
      // by providing a truthy-but-non-renderable value so the else-if
      // branch fires (rather than skipping the paragraph entirely).
      cloned.separationDate = 'approximate — please confirm';
      return super.generateMarriageInformationSection(cloned);
    }
    return super.generateMarriageInformationSection(divorceData);
  }

  /**
   * Get Florida grounds text
   * Florida is a pure no-fault state
   * @param {string} grounds - Grounds type
   * @param {Object} divorceData - Divorce data
   * @returns {string} Grounds text
   */
  getGroundsText(grounds, divorceData) {
    if (grounds === 'mental_incapacity') {
      return 'Respondent has been adjudged mentally incapacitated for a period of 3 years prior to the filing of this petition. (Florida Statutes § 61.052(1)(b))';
    }
    return 'The marriage between the parties is irretrievably broken. (Florida Statutes § 61.052(1)(a))';
  }

  /**
   * Generate Florida children section
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Children section
   */
  generateChildrenSection(divorceData) {
    const items = [];
    let paragraphNum = divorceData._paragraphNum || 9;

    if (divorceData.hasMinorChildren === false || !divorceData.children || divorceData.children.length === 0) {
      items.push({
        number: paragraphNum++,
        content: 'There are no minor children common to the parties.',
        type: 'children_info'
      });

      if (divorceData.wifePregnant === false) {
        items.push({
          number: paragraphNum++,
          content: 'The wife is not pregnant.',
          type: 'children_info'
        });
      }
    } else {
      items.push({
        number: paragraphNum++,
        content: 'The minor child(ren) common to the parties are:',
        type: 'children_info'
      });

      divorceData.children.forEach((child, index) => {
        const childName = typeof child === 'string' ? child : (child.name || '[CHILD NAME]');
        const birthDate = typeof child === 'object' ? this.formatDate(child.birthDate ?? child.dob ?? child.dateOfBirth) : null;
        items.push({
          number: paragraphNum++,
          content: birthDate ? `${childName}, born ${birthDate}` : childName,
          type: 'child_detail'
        });
      });

      // UCCJEA
      items.push({
        number: paragraphNum++,
        content: 'A completed Uniform Child Custody Jurisdiction and Enforcement Act (UCCJEA) Affidavit, Florida Supreme Court Approved Family Law Form 12.902(d), is filed with this petition.',
        type: 'uccjea'
      });

      // Parenting Plan
      items.push({
        number: paragraphNum++,
        content: 'Petitioner requests that the Court establish or approve a Parenting Plan for the minor child(ren) that includes provisions for time-sharing and parental responsibility.',
        type: 'custody_request'
      });
    }

    // Agreed child arrangements (custody enum, primary residence, agreed
    // support) — pleaded via the base hooks, never silently dropped.
    paragraphNum = this.appendAgreedChildArrangementPleadings(items, paragraphNum, divorceData);

    return {
      // Attorney round-5 (Tavita, FL, 2026-08-30): title had dropped the
      // roman numeral, producing "…IV. GROUNDS FOR DIVORCE / CHILDREN /
      // VI. PROPERTY AND DEBTS" — a visible V-skip. Section titles must
      // stay sequential with the base template's I…VII scheme.
      title: 'V. CHILDREN',
      items,
      nextParagraphNumber: paragraphNum
    };
  }

  /**
   * Florida-specific property section: when the parties signed a
   * prenuptial (or premarital) agreement, plead it as controlling and
   * ask the court to incorporate it into the final Judgment of
   * Dissolution. Bug 1 (Tavita, FL, 2026-08-29): the base template's
   * generic "divide marital property in a just and right manner" pleading
   * dropped Tavita's explicit statement that her 2018 prenup governs.
   *
   * We DETECT the prenup two ways so no upstream extractor change is
   * required:
   *   1. `divorceData.prenupSigned === true` (canonical flag from
   *      BaseDivorceOrchestrator's structured extraction — see
   *      services/agents/BaseDivorceOrchestrator.js prenup_signed).
   *   2. `divorceData.facts` array contains a fact whose SUBCATEGORY
   *      mentions a prenup. Subcategory is model-assigned, so we're
   *      trusting the LLM's classification rather than regex-scanning
   *      raw free text (LLM-first policy).
   *
   * The prenup pleading is inserted as the FIRST paragraph of the
   * property section (before the base section's generic pleadings) so
   * the incorporation request is prominent and the section header still
   * reflects "PROPERTY AND DEBTS".
   *
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Property section
   */
  generatePropertySection(divorceData) {
    const base = super.generatePropertySection(divorceData);

    const prenupYear = this._detectPrenupYear(divorceData);
    const hasPrenup = divorceData.prenupSigned === true || this._factsMentionPrenup(divorceData);
    if (!hasPrenup) return base;

    let paragraphNum = divorceData._paragraphNum || 12;
    const dateClause = prenupYear ? ` dated ${prenupYear}` : '';
    const prenupParas = [
      {
        number: paragraphNum++,
        content:
          `The parties entered into a valid prenuptial agreement${dateClause}, ` +
          'which governs the disposition of property and debts.',
        type: 'prenup_recital'
      },
      {
        number: paragraphNum++,
        content:
          'Petitioner requests that the property provisions of said prenuptial agreement ' +
          'be incorporated into the final Judgment of Dissolution.',
        type: 'prenup_incorporation_request'
      }
    ];

    // Renumber the base items so paragraph numbers stay sequential after
    // the two inserted prenup paragraphs.
    const rebasedBaseItems = (base.items || []).map((item) => {
      if (typeof item.number !== 'number') return item;
      return { ...item, number: paragraphNum++ };
    });

    return {
      title: base.title,
      items: [...prenupParas, ...rebasedBaseItems],
      nextParagraphNumber: paragraphNum
    };
  }

  /**
   * Read the prenup year from the canonical flag if present, otherwise
   * scan the facts array for a 4-digit year adjacent to a prenup mention.
   * @param {Object} divorceData
   * @returns {number|string|null}
   */
  _detectPrenupYear(divorceData) {
    return divorceData.prenupSignedYear || null;
  }

  /**
   * True when any fact's LLM-assigned subcategory names a prenup / premarital
   * / prenuptial agreement. Subcategory is a model-produced label, so the
   * match is against a small set of expected classifier outputs (LLM-first
   * policy — see MEMORY.md, LLM-first-not-regex).
   * @param {Object} divorceData
   * @returns {boolean}
   */
  _factsMentionPrenup(divorceData) {
    const facts = Array.isArray(divorceData.facts) ? divorceData.facts : [];
    const HITS = new Set(['prenup', 'prenuptial', 'prenuptial_agreement', 'premarital_agreement']);
    for (const fact of facts) {
      if (!fact || typeof fact !== 'object') continue;
      const sub = String(fact.subcategory || fact.subCategory || '').toLowerCase().trim();
      if (!sub) continue;
      if (HITS.has(sub)) return true;
      if (sub.includes('prenup') || sub.includes('premarital') || sub.includes('prenuptial')) {
        return true;
      }
    }
    return false;
  }

  /**
   * Generate Florida relief section
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Relief section
   */
  generateReliefSection(divorceData) {
    const items = [];

    items.push({
      number: null,
      content: 'WHEREFORE, Petitioner requests that the Court:',
      type: 'relief_intro'
    });

    const reliefItems = [];

    reliefItems.push('Grant a dissolution of the marriage between Petitioner and Respondent;');
    reliefItems.push('Equitably distribute the marital assets and liabilities between the parties;');

    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      reliefItems.push('Establish or approve a Parenting Plan that includes time-sharing and parental responsibility for the minor child(ren);');
      reliefItems.push('Order child support pursuant to the child support guidelines in Florida Statutes § 61.30;');
      reliefItems.push('Order each party to maintain health insurance for the minor child(ren);');
    }

    if (divorceData.requestSpousalSupport) {
      // Permanent alimony abolished effective July 1, 2023 (SB 1416).
      // Only bridge-the-gap, rehabilitative, durational, or lump sum alimony is available.
      reliefItems.push('Award alimony to Petitioner (bridge-the-gap, rehabilitative, durational, or lump sum) as provided by Florida Statutes § 61.08 (as amended by SB 1416, effective July 1, 2023);');
    }

    if (divorceData.requestNameChange && divorceData.previousName) {
      reliefItems.push(`Restore Petitioner's former name to: ${divorceData.previousName};`);
    }

    // Round-7 attorney review (Tavita FL, 2026-08-30): when the petition
    // pleads a prenuptial agreement in ¶¶9-10, the prayer must expressly
    // ask the court to enforce it — a generic "such other relief" prayer
    // does not preserve the request. Emit the §61.079 enforcement item
    // whenever the same prenup signal fires that we use for the property
    // section's prenup recital.
    const hasPrenup =
      divorceData.prenupSigned === true || this._factsMentionPrenup(divorceData);
    if (hasPrenup) {
      reliefItems.push(
        "Enforce the parties' prenuptial agreement under Florida Statutes § 61.079 (Florida Uniform Premarital Agreement Act) and incorporate its property and support provisions into the final Judgment of Dissolution;",
      );
    }

    reliefItems.push('Grant such other relief as the Court deems just and proper.');

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
      // Attorney round-5 (Tavita, FL, 2026-08-30): sync roman numeral with base I..VII sequence.
      title: 'VII. PRAYER FOR RELIEF',
      items,
      nextParagraphNumber: null
    };
  }

  /**
   * Get Florida verification text
   * @param {Object} divorceData - Divorce data
   * @returns {string} Verification text
   */
  getVerificationText(divorceData) {
    const name = divorceData.petitionerName || '[PETITIONER NAME]';

    return `I understand that I am swearing or affirming under oath to the truthfulness of the claims made in this petition and that the punishment for knowingly making a false statement includes fines and/or imprisonment.

Dated: ___________________

_________________________________
Signature of Petitioner
${name}
Printed Name

STATE OF FLORIDA
COUNTY OF ____________________

Sworn to or affirmed and signed before me on _____________ by ______________________.

_________________________________
NOTARY PUBLIC or DEPUTY CLERK

[Print, type, or stamp commissioned name of notary or deputy clerk.]

___ Personally known
___ Produced identification
Type of identification produced: ___________________`;
  }

  /**
   * Perform Florida-specific validation
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Validation result
   */
  performStateSpecificValidation(divorceData) {
    const errors = [];
    const warnings = [];

    // Florida requires county
    if (!divorceData.county) {
      errors.push('County is required for Florida dissolution petitions');
    }

    // Check simplified dissolution eligibility
    if (divorceData.simplified) {
      if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
        errors.push('Simplified dissolution is not available when there are minor children');
      }
      if (divorceData.wifePregnant === true) {
        errors.push('Simplified dissolution is not available if the wife is pregnant');
      }
      if (divorceData.requestSpousalSupport) {
        errors.push('Simplified dissolution is not available when alimony is requested');
      }
    }

    // Financial affidavit reminder
    if (divorceData.hasMinorChildren === true || divorceData.requestSpousalSupport || divorceData.hasProperty) {
      warnings.push('Florida requires a Family Law Financial Affidavit (Form 12.902(b) for income under $50,000 or Form 12.902(c) for income $50,000 or more).');
    }

    // Children warning
    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      warnings.push('You must complete and file a UCCJEA Affidavit (Form 12.902(d)) when minor children are involved.');
      warnings.push('Florida requires a Parenting Plan (Form 12.995(a)) when minor children are involved.');
    }

    return { errors, warnings };
  }
}

module.exports = FloridaDivorcePetitionTemplate;
