// templates/states/newyork/DivorcePetitionTemplate.js
// New York-specific divorce petition (Verified Complaint) template
// Complies with New York Domestic Relations Law and CPLR

const BaseDivorcePetitionTemplate = require('../../core/BaseDivorcePetitionTemplate');
const { resolveGroundsForDivorce } = require('./groundsResolver');

/**
 * New York Summons with Notice and Verified Complaint for Divorce
 *
 * Legal References:
 * - New York Domestic Relations Law (DRL)
 * - Civil Practice Law and Rules (CPLR)
 * - DRL § 170 (Grounds for divorce)
 * - DRL § 230 (Residence requirements)
 *
 * Official Forms (UD Series - Uncontested Divorce):
 * - UD-1/UD-1a: Summons with Notice
 * - UD-2: Verified Complaint
 * - UD-3: Affidavit of Service
 * - UD-4: Sworn Statement (Barriers to Remarriage)
 * - UD-5: Affirmation of Regularity
 * - UD-6: Affidavit of Plaintiff
 * - UD-7: Affidavit of Defendant
 * - UD-8 series: Support worksheets
 * - UD-10: Findings of Fact/Conclusions of Law
 * - UD-11: Judgment of Divorce
 *
 * Formatting Requirements (CPLR 2101):
 * - 8.5" x 11" paper
 * - 1" margins minimum
 * - 12-point font minimum
 * - Double-spaced
 *
 * New York-Specific Notes:
 * - Complex residency requirements (1-2 years depending on circumstances)
 * - Uses "Plaintiff" and "Defendant" not "Petitioner" and "Respondent"
 * - "Irretrievable breakdown" for 6+ months is no-fault ground
 * - Joint filing available as of January 2025
 */
class NewYorkDivorcePetitionTemplate extends BaseDivorcePetitionTemplate {
  constructor() {
    super();

    this.state = 'NY';
    this.stateName = 'New York';
    this.documentTitle = 'VERIFIED COMPLAINT FOR DIVORCE';

    // Load metadata if available
    try {
      this.metadata = require('./divorce-metadata.json');
    } catch (e) {
      this.metadata = null;
    }

    // New York uses different terminology
    this.petitionerLabel = 'Plaintiff';
    this.respondentLabel = 'Defendant';

    // Body paragraphs, signature block, and filer block route through
    // this.terminology (defaults to Petitioner/Respondent). NY divorce
    // captions AND body use Plaintiff/Defendant throughout — leaving the
    // terminology defaults produced "Petitioner"-labeled parties in the
    // body while the caption said "Plaintiff", a clerk-bounce risk flagged
    // in the 2026-08 attorney review.
    this.terminology = {
      ...this.terminology,
      filerLabel: 'Plaintiff',
      responderLabel: 'Defendant',
    };

    // New York-specific required fields
    this.requiredFields = [
      'petitionerName', // Called Plaintiff in NY
      'respondentName', // Called Defendant in NY
      'state',
      'county',
      'marriageDate'
    ];

    // New York residency requirements (complex)
    this.residencyRequirements = {
      options: [
        {
          yearsRequired: 2,
          description: 'Either spouse lived in New York for 2 continuous years before filing'
        },
        {
          yearsRequired: 1,
          additionalRequirement: 'married_in_ny',
          description: 'Either spouse lived in NY for 1 year AND were married in NY'
        },
        {
          yearsRequired: 1,
          additionalRequirement: 'lived_as_married_in_ny',
          description: 'Either spouse lived in NY for 1 year AND once lived as married couple in NY'
        },
        {
          yearsRequired: 1,
          additionalRequirement: 'cause_in_ny',
          description: 'Either spouse lived in NY for 1 year AND grounds arose in NY'
        },
        {
          yearsRequired: 0,
          additionalRequirement: 'cause_in_ny_both_live',
          description: 'Grounds arose in NY AND both currently live in state'
        }
      ],
      description: 'New York has complex residency requirements. One of the above conditions must be met.'
    };

    // New York waiting period
    this.waitingPeriod = {
      days: 0,
      irretrievablyBrokenPeriod: 6, // months
      description: 'No mandatory waiting period, but for no-fault divorce, marriage must be irretrievably broken for at least 6 months.'
    };

    // New York formatting requirements (CPLR 2101)
    this.formatting = {
      fontSize: '12pt',
      fontFamily: 'Times New Roman',
      lineHeight: '2',
      margin: '1in',
      paperSize: '8.5in x 11in'
    };

    // New York form numbers (UD series)
    this.formNumbers = {
      summons: 'UD-1',
      complaint: 'UD-2',
      affidavitOfService: 'UD-3',
      barriersStatement: 'UD-4',
      affirmationOfRegularity: 'UD-5',
      affidavitOfPlaintiff: 'UD-6',
      affidavitOfDefendant: 'UD-7',
      incomeWorksheet: 'UD-8(1)',
      maintenanceWorksheet: 'UD-8(2)',
      childSupportWorksheet: 'UD-8(3)',
      findingsOfFact: 'UD-10',
      judgment: 'UD-11'
    };
  }

  /**
   * Get New York case number label
   * @returns {string} "Index No.:"
   */
  getCaseNumberLabel() {
    return 'Index No.:';
  }

  /**
   * Draft note pointing to the NY Uncontested Divorce (UD) packet.
   * Analogous to the CA FL-100 draft note (attorney round-2, 2026-08-30).
   */
  getOfficialFormNote() {
    return '(Draft — New York Uncontested Divorce Packet forms (UD-1 through UD-13) ' +
      'are available at https://ww2.nycourts.gov/divorce/forms.shtml. This Verified ' +
      'Complaint corresponds to UD-2; transcribe or attach it when assembling the ' +
      'packet for filing.)';
  }

  /**
   * Prepend the UD-packet draft note to Section I so every rendering path
   * surfaces it above the numbered pleading paragraphs.
   */
  generatePartiesSection(divorceData) {
    const base = super.generatePartiesSection(divorceData);
    const note = this.getOfficialFormNote();
    if (note) {
      base.items.unshift({
        number: null,
        content: note,
        type: 'official_form_note',
      });
    }
    return base;
  }

  /**
   * 22 NYCRR 202.16(e) no-prior-action disclosure. Every NY matrimonial
   * complaint must state whether a prior action for divorce, separation,
   * or annulment has been brought. Attorney round-2 (2026-08-30) flagged
   * the omission. When priorMatrimonialActions is populated, list them;
   * otherwise emit the standard denial.
   */
  getNoPriorActionDisclosure(divorceData) {
    const d = divorceData || {};
    const prior = Array.isArray(d.priorMatrimonialActions)
      ? d.priorMatrimonialActions.filter(Boolean)
      : [];
    if (prior.length > 0) {
      return `Plaintiff has previously brought the following action(s) for divorce, separation, or annulment: ${prior.join('; ')}. (22 NYCRR 202.16(e).)`;
    }
    return 'No prior action for divorce, separation, or annulment has been brought by either party against the other. (22 NYCRR 202.16(e).)';
  }

  /**
   * Get default court for New York county
   * @param {string} county - County name
   * @returns {string} Court name
   */
  getDefaultCourt(county) {
    return `Supreme Court of the State of New York, County of ${county || '[COUNTY]'}`;
  }

  /**
   * Generate New York-style header
   * @returns {string} Header text
   */
  generateHeader() {
    return 'SUPREME COURT OF THE STATE OF NEW YORK';
  }

  /**
   * Generate New York case caption
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Case caption
   */
  generateCaseCaption(divorceData) {
    let caption = '';

    // Court
    caption += `SUPREME COURT OF THE STATE OF NEW YORK\n`;
    caption += `COUNTY OF ${(divorceData.county || '[COUNTY]').toUpperCase()}\n`;
    caption += `- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -x\n\n`;

    // Parties (NY uses Plaintiff/Defendant)
    const plaintiff = divorceData.petitionerName || '[PLAINTIFF NAME]';
    const defendant = divorceData.respondentName || '[DEFENDANT NAME]';

    caption += `${plaintiff.toUpperCase()},\n`;
    caption += `                                              Plaintiff,\n\n`;
    caption += `        -against-\n\n`;
    caption += `${defendant.toUpperCase()},\n`;
    caption += `                                              Defendant.\n\n`;

    caption += `- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -x\n\n`;

    // Index number
    caption += `Index No.: ${divorceData.caseNumber || '____________________'}\n\n`;

    // Document title
    caption += this.documentTitle;

    return {
      courtName: this.getDefaultCourt(divorceData.county),
      caseNumber: divorceData.caseNumber,
      petitioner: divorceData.petitionerName,
      respondent: divorceData.respondentName,
      formatted: caption
    };
  }

  /**
   * Compute months of continuous NY residence when the case data carries
   * enough to derive it. Attempts, in order:
   *   1. divorceData.residencyStateMonths — trust an explicit count
   *   2. divorceData.residencySinceDate / stateResidencySince / nyResidenceStartDate —
   *      months between that date and now
   * Returns an integer month count or null when the data does not support it.
   */
  getResidencyMonths(divorceData) {
    const raw = divorceData && divorceData.residencyStateMonths;
    if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 0) {
      return Math.floor(raw);
    }
    if (typeof raw === 'string' && /^\d+$/.test(raw.trim())) {
      return parseInt(raw.trim(), 10);
    }
    const dateStr = (divorceData && (
      divorceData.residencySinceDate ||
      divorceData.stateResidencySince ||
      divorceData.nyResidenceStartDate
    )) || null;
    if (typeof dateStr === 'string' && dateStr.trim()) {
      const t = Date.parse(dateStr.trim());
      if (!Number.isNaN(t)) {
        const days = (Date.now() - t) / (24 * 60 * 60 * 1000);
        const months = Math.floor(days / 30.4375);
        if (months >= 0) return months;
      }
    }
    return null;
  }

  /**
   * NY DRL § 230 residency clause. The old default emitted the bare
   * conclusion "The parties meet the residency requirements set forth in
   * Domestic Relations Law § 230." — a legal conclusion the clerk cannot
   * verify. Every § 230 sub-basis requires FACTS: continuous months of
   * residence AND the qualifying reason (married in NY / resided as
   * spouses in NY / grounds arose in NY / etc.). This method pleads the
   * sub-basis with those facts whenever the case data supplies them, and
   * otherwise renders a visible fill-in blank plus a Draft note that
   * names the § 230 options — never a bare conclusion.
   *
   * @param {Object} divorceData - Divorce data
   * @returns {string} Jurisdiction statement
   */
  /**
   * New York alt-service Draft note. CPLR § 308(5) authorizes service
   * "in such manner as the court, upon motion without notice, directs"
   * when the methods in § 308(1)–(4) prove impracticable — a showing of
   * due diligence is required.
   */
  getAltServiceNote(_divorceData) {
    return (
      'Alternative service in New York requires a court order under ' +
      'CPLR § 308(5), granted on an ex parte motion after a showing that ' +
      'service under CPLR § 308(1)–(4) is impracticable. Support the ' +
      'motion with a due-diligence affidavit describing the search for ' +
      'Defendant. Matrimonial actions have additional service rules — see ' +
      'DRL § 232 and 22 NYCRR 202.16 — that may govern the order the ' +
      'court directs.'
    );
  }

  getJurisdictionStatement(divorceData) {
    const plaintiff = divorceData.petitionerName || 'Plaintiff';
    const months = this.getResidencyMonths(divorceData);
    const monthsPhrase = (m, floor) => {
      if (typeof m === 'number' && m >= floor) {
        return `for a continuous period of ${m} months (at least ${floor === 12 ? 'one year' : `${floor} months`}) immediately preceding the commencement of this action`;
      }
      return `for a continuous period of at least ${floor === 12 ? 'one year' : `${floor} months`} immediately preceding the commencement of this action`;
    };

    // Determine which residency basis applies.
    // Values match what nyDivorce orchestrator collects (DRL § 230 bases).
    if (divorceData.residencyBasis === '2yr_residence' || divorceData.residencyBasis === 'two_years' || divorceData.residencyBasis === 'two_years_domiciled') {
      return `${plaintiff} has resided in the State of New York ${monthsPhrase(months, 24)}. (Domestic Relations Law § 230(5))`;
    }
    if (divorceData.residencyBasis === 'married_in_ny_1yr' || divorceData.residencyBasis === 'one_year_married_in_ny') {
      return `${plaintiff} has resided in the State of New York ${monthsPhrase(months, 12)}, and the parties were married in New York. (Domestic Relations Law § 230(2))`;
    }
    if (divorceData.residencyBasis === 'last_lived_together_1yr' || divorceData.residencyBasis === 'one_year_lived_in_ny') {
      return `${plaintiff} has resided in the State of New York ${monthsPhrase(months, 12)}, and the parties resided as spouses in New York. (Domestic Relations Law § 230(3))`;
    }
    if (divorceData.residencyBasis === 'grounds_arose_1yr' || divorceData.residencyBasis === 'one_year_cause_in_ny') {
      return `${plaintiff} has resided in the State of New York ${monthsPhrase(months, 12)}, and the cause of action arose in New York. (Domestic Relations Law § 230(4))`;
    }
    if (divorceData.residencyBasis === 'both_residents') {
      return `Both parties are residents of the State of New York when this action is commenced. (Domestic Relations Law § 230(1))`;
    }

    // Fact-driven fallback: derive a sub-basis from ancillary flags when
    // no explicit residencyBasis was set. Prefer the most-specific
    // one-year basis (§ 230(2) married in NY, then § 230(3) resided as
    // spouses in NY) over the two-year residence-only § 230(5) — the
    // one-year sub-basis pleads the qualifying reason and is the
    // stronger showing whenever the underlying fact is present.
    // Round-3 attorney review (David NY, 2026-08-30): the picker missed
    // marriagePlace='Manhattan' — a known NYC borough — because it only
    // scanned marriageState[Name] and marriageLocation for "New York".
    // Widen to include marriagePlace and a small closed set of NY-known
    // county/borough tokens. Deterministic token intersection; no free-
    // text parsing.
    const NY_PLACE_TOKENS = [
      'new york', ' ny', ',ny', 'ny,',
      'manhattan', 'brooklyn', 'bronx', 'queens', 'staten island',
      'kings county', 'new york county', 'bronx county', 'queens county', 'richmond county',
      'nassau', 'suffolk', 'westchester', 'rockland', 'putnam',
      'buffalo', 'rochester', 'syracuse', 'albany', 'yonkers',
    ];
    const nyBlob = [
      divorceData.marriageStateName,
      divorceData.marriageState,
      divorceData.marriageLocation,
      divorceData.marriagePlace,
      divorceData.marriageCity,
    ].map((v) => String(v || '')).join(' | ').toLowerCase();
    const marriedInNy = divorceData.marriedInNy === true ||
      String(divorceData.marriageStateName || '').trim().toUpperCase() === 'NY' ||
      String(divorceData.marriageState || '').trim().toUpperCase() === 'NY' ||
      NY_PLACE_TOKENS.some((tok) => nyBlob.includes(tok));
    const livedAsSpousesInNy = divorceData.livedAsSpousesInNy === true ||
      divorceData.livedAsMarriedInNy === true;
    // Round-3 attorney review (David NY): residencyStateMonths was unset
    // but facts[] carried a residence category fact ("residents of New
    // York and have lived in Brooklyn for several years"). Treat any
    // residence-category fact as a NY-residence signal so §230(2)/(3)
    // auto-selects with the "at least one year" phrasing when the
    // qualifying reason (married in NY / resided as spouses) holds.
    const factsResidenceSignal = Array.isArray(divorceData.facts) &&
      divorceData.facts.some((f) => {
        if (!f || typeof f !== 'object') return false;
        const cat = String(f.category || '').toLowerCase();
        const sub = String(f.subcategory || '').toLowerCase();
        return cat === 'residence' || cat === 'residency' ||
          sub.includes('residence') || sub.includes('residency');
      });
    const nyResidenceSignal = (typeof months === 'number' && months >= 12) || factsResidenceSignal;
    if (nyResidenceSignal && marriedInNy) {
      return `${plaintiff} has resided in the State of New York ${monthsPhrase(months, 12)}, and the parties were married in New York. (Domestic Relations Law § 230(2))`;
    }
    if (nyResidenceSignal && livedAsSpousesInNy) {
      return `${plaintiff} has resided in the State of New York ${monthsPhrase(months, 12)}, and the parties resided as spouses in New York. (Domestic Relations Law § 230(3))`;
    }
    if (typeof months === 'number' && months >= 24) {
      return `${plaintiff} has resided in the State of New York ${monthsPhrase(months, 24)}. (Domestic Relations Law § 230(5))`;
    }

    // No usable basis on file — render a visible blank + Draft note that
    // names the § 230 options rather than the bare conclusion the reviewer
    // flagged as clerk-bounce risk.
    const monthsLine = typeof months === 'number'
      ? `${plaintiff} has resided in the State of New York for a continuous period of ${months} months immediately preceding the commencement of this action`
      : `${plaintiff} has resided in the State of New York for a continuous period of __________ months immediately preceding the commencement of this action`;
    return `${monthsLine}, and (choose one) __ the parties were married in New York (DRL § 230(2)); __ the parties resided as spouses in New York (DRL § 230(3)); __ the cause of action arose in New York (DRL § 230(4)); or __ Plaintiff has been a resident for at least two years (DRL § 230(5)).\n(Draft — select and complete the applicable § 230 sub-basis before filing.)`;
  }

  /**
   * Get New York grounds text
   * @param {string} grounds - Grounds type
   * @param {Object} divorceData - Divorce data
   * @returns {string} Grounds text
   */
  getGroundsText(grounds, divorceData) {
    switch (grounds) {
      case 'irretrievable_breakdown':
      case 'no_fault':
      case 'irreconcilable_differences':
        return 'The relationship between husband and wife has broken down irretrievably for a period of at least six months, within the meaning of Domestic Relations Law § 170(7).';

      case 'cruel_treatment':
      case 'cruel_inhuman_treatment':
      case 'cruelty':
        return 'The Defendant\'s conduct so endangers the physical or mental well being of the Plaintiff as renders it unsafe or improper for the Plaintiff to cohabit with the Defendant, within the meaning of Domestic Relations Law § 170(1) (cruel and inhuman treatment).';

      case 'abandonment':
        return 'The Defendant has abandoned the Plaintiff for a period of one or more years, within the meaning of Domestic Relations Law § 170(2).';

      case 'imprisonment':
      case 'confinement':
        return 'The Defendant has been confined in prison for a period of three or more consecutive years after the marriage, within the meaning of Domestic Relations Law § 170(3).';

      case 'adultery':
        return 'The Defendant has committed adultery, within the meaning of Domestic Relations Law § 170(4).';

      case 'separation_judgment':
        return 'The husband and wife have lived apart pursuant to a decree or judgment of separation for a period of one or more years, within the meaning of Domestic Relations Law § 170(5).';

      case 'separation_agreement':
        return 'The husband and wife have lived separate and apart pursuant to a written agreement of separation for a period of one or more years, within the meaning of Domestic Relations Law § 170(6).';

      default:
        return 'The relationship between husband and wife has broken down irretrievably for a period of at least six months, within the meaning of Domestic Relations Law § 170(7).';
    }
  }

  /**
   * Override the base grounds section so a sub-ground captured only in
   * `facts[]` (category:'grounds', or an evidence fact whose subcategory
   * names the ground) is still pleaded with the correct DRL §170 pinpoint
   * citation. Without this override the base template reads
   * `divorceData.groundsForDivorce || 'irreconcilable_differences'` and
   * every fault-based petition emerges as no-fault §170(7) boilerplate.
   * See ./groundsResolver.js.
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
      type: 'grounds',
    });

    // No-prior-action disclosure (22 NYCRR 202.16(e)) — attorney
    // round-2 (2026-08-30) flagged the omission.
    items.push({
      number: paragraphNum++,
      content: this.getNoPriorActionDisclosure(divorceData),
      type: 'no_prior_action',
    });

    // Uncontested-posture recital — attorney review flagged that the
    // profile's mediated CSSA agreement + maintenance waiver never
    // surfaced in the complaint. When the profile carries a Settlement
    // Agreement / mediated support / support waiver, append a recital
    // reciting the agreement's coverage. See getUncontestedRecital.
    if (this.hasUncontestedPosture(divorceData)) {
      items.push({
        number: paragraphNum++,
        content: this.getUncontestedRecital(divorceData),
        type: 'uncontested_recital',
      });
    }

    return {
      title: 'IV. GROUNDS FOR DIVORCE',
      items,
      nextParagraphNumber: paragraphNum,
    };
  }

  /**
   * Whether the case actually has minor children (under 18) — the trigger
   * for a UCCJEA / home-state declaration. NY separately tracks children
   * under 21 for support purposes (see generateChildrenSection), but the
   * UCCJEA home-state rules apply only to minors under 18.
   *
   * @param {Object} divorceData
   * @returns {boolean}
   */
  hasChildrenUnder18(divorceData) {
    const d = divorceData || {};
    if (d.hasMinorChildren === false) return false;
    const childArr = Array.isArray(d.children) ? d.children : [];
    // If the case data explicitly says numberOfChildren > 0 or
    // hasMinorChildren === true, treat that as authoritative.
    if (d.hasMinorChildren === true || (typeof d.numberOfChildren === 'number' && d.numberOfChildren > 0)) {
      // Still try to filter by dob when available; otherwise trust the flag.
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
    // Only children[] array present — treat any child under 18 as minor.
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
    // No dobs on file — assume the array names minors (the interviewer
    // asked "children under 21", and NY treats any listed child as a
    // support-eligible child of the marriage until proven adult). This
    // is safer than dropping the UCCJEA declaration on ambiguous data.
    return !anyRenderable;
  }

  /**
   * UCCJEA / home-state declaration items for the children section.
   * Rendered whenever the case has children under 18. NY has adopted the
   * Uniform Child Custody Jurisdiction and Enforcement Act as DRL §75-a
   * et seq.; every pleading touching custody must state the child's home
   * state, current and prior 5-year residences, and disclose any pending
   * custody actions elsewhere. See DRL §76-h.
   *
   * @param {Object} divorceData
   * @param {number} paragraphNum
   * @returns {{items: Array, nextParagraphNumber: number}}
   */
  generateUccjeaItems(divorceData, paragraphNum) {
    const items = [];
    const homeState = divorceData.childHomeState || 'New York';
    items.push({
      number: paragraphNum++,
      content: `Pursuant to the Uniform Child Custody Jurisdiction and Enforcement Act (Domestic Relations Law § 75-a et seq.), Plaintiff states that ${homeState} is the home state of the minor child(ren) named above, the child(ren) having lived in ${homeState} with a parent for at least six consecutive months immediately preceding the commencement of this action (or since birth for any child under six months of age).`,
      type: 'uccjea_home_state',
    });

    const childArr = Array.isArray(divorceData.children) ? divorceData.children : [];
    const minors = childArr.filter((c) => {
      if (typeof c !== 'object' || !c) return typeof c === 'string';
      const raw = c.birthDate ?? c.dob ?? c.dateOfBirth;
      const t = raw ? Date.parse(raw) : NaN;
      if (Number.isNaN(t)) return true; // unknown dob — treat as minor
      const eighteenYearsMs = 18 * 365.25 * 24 * 60 * 60 * 1000;
      return (Date.now() - t) < eighteenYearsMs;
    });

    minors.forEach((child, i) => {
      const name = typeof child === 'string' ? child : (child.name || `[CHILD ${i + 1} NAME]`);
      const dob = typeof child === 'object'
        ? this.formatDate(child.birthDate ?? child.dob ?? child.dateOfBirth)
        : null;
      // Attorney round-4 (David NY, 2026-08-30): mirror the GA pattern —
      // when the child's `livesWith` names the Plaintiff (or both parties)
      // and the profile carries no explicit street address for the child,
      // fall back to any Plaintiff-address synonym and, ultimately, to the
      // county+state on the profile (which is what NY UCCJEA § 76-h ¶(a)
      // requires to establish home state at minimum).
      const plaintiffAddress =
        divorceData.petitionerAddress ||
        divorceData.plaintiffAddress ||
        divorceData.filerAddress ||
        divorceData.address ||
        divorceData.mailingAddress ||
        '';
      const livesWithRaw =
        typeof child === 'object' && child ? String(child.livesWith || '') : '';
      const livesWithBoth = /\bboth\b/i.test(livesWithRaw);
      const livesWithDefendantOnly =
        !livesWithBoth && /(defendant|respondent)/i.test(livesWithRaw);
      const livesWithPlaintiff =
        !livesWithDefendantOnly &&
        (
          livesWithBoth ||
          /(plaintiff|petitioner|with me|myself|self|mother|father)/i.test(livesWithRaw) ||
          /^(sole|primary|petitioner|plaintiff|joint|shared)/i.test(
            String(divorceData.custodyPreference || divorceData.custodyArrangement || '').toLowerCase(),
          )
        );
      const countyStateFallback = (() => {
        const county = typeof divorceData.county === 'string' ? divorceData.county.trim() : '';
        const state = typeof divorceData.state === 'string' ? divorceData.state.trim() : '';
        if (!county && !state) return '';
        // NY Kings County → "Brooklyn, New York" per DRL § 76-a home-state
        // frame; the county name is the concise place identifier the drafter
        // completes to a street address before filing.
        const stateLabel = state && state.length <= 3 ? 'New York' : state;
        return county && stateLabel
          ? `${county} County, ${stateLabel}`
          : county || stateLabel;
      })();
      const currentAddress =
        (typeof child === 'object' && (child.currentAddress || child.address)) ||
        (livesWithPlaintiff && plaintiffAddress) ||
        plaintiffAddress ||
        (livesWithPlaintiff && countyStateFallback) ||
        countyStateFallback ||
        '[CURRENT ADDRESS]';
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
   * Generate New York children section
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Children section
   */
  generateChildrenSection(divorceData) {
    const items = [];
    let paragraphNum = divorceData._paragraphNum || 9;

    // New York considers children under 21 for support purposes
    if (divorceData.hasMinorChildren === false || !divorceData.children || divorceData.children.length === 0) {
      items.push({
        number: paragraphNum++,
        content: 'There are no children of the marriage under the age of 21 years.',
        type: 'children_info'
      });
    } else {
      // Combine the child(ren) into well-formed clauses. The old shape
      // opened a header paragraph and then numbered each child on its
      // own line — for a one-child family with no DOB that produced
      // "8. The following are the children ... 9. Emma." (attorney
      // review, 2026-08). Each entry now names DOB + residence in a
      // single sentence, with visible fill-in blanks when a value is
      // missing so the drafter finishes them by hand before filing.
      const childrenArr = divorceData.children;
      const formatChildClause = (child) => {
        const name = typeof child === 'string'
          ? child
          : (child && child.name) || '__________________';
        // Attorney round-3 (2026-08-30): delegate to the shared
        // formatChildDob helper (base) so year-only DOBs (`birthYear`
        // field or a bare "2020" string) render as "born 2020" in
        // every jurisdiction.
        const dobStr = typeof child === 'object' && child ? this.formatChildDob(child) : null;
        const address = (typeof child === 'object' && child
          && (child.currentAddress || child.address || child.residence)) || null;
        const dobPhrase = dobStr ? `born ${dobStr}` : 'born __________________';
        const residencePhrase = address
          ? `residing at ${address}`
          : `residing at __________________`;
        return `${name}, ${dobPhrase}, ${residencePhrase}`;
      };
      if (childrenArr.length === 1) {
        items.push({
          number: paragraphNum++,
          content: `The child of the marriage under the age of 21 years is ${formatChildClause(childrenArr[0])}.`,
          type: 'children_info',
        });
      } else {
        const listed = childrenArr.map(formatChildClause).join('; ');
        items.push({
          number: paragraphNum++,
          content: `The children of the marriage under the age of 21 years are: ${listed}.`,
          type: 'children_info',
        });
      }

      // Custody request. Attorney round-4 (David NY, 2026-08-30): when the
      // case carries an uncontested/settled posture (recited above), the
      // request must ASK THE COURT TO APPROVE the parties' agreement, not
      // to "determine custody" or "order child support" de novo — those
      // clauses are internally inconsistent with the Settlement Agreement
      // paragraph. If a specific custodian name is available (agreed
      // primaryCustodian OR structured custody arrangement), name them; the
      // fallback approves whatever the Settlement Agreement provides.
      if (this.hasUncontestedPosture(divorceData)) {
        const agreedCustodian = this.resolveAgreedCustodianName(divorceData);
        const custodyContent = agreedCustodian
          ? `Plaintiff requests that the Court approve and incorporate the custody arrangement set forth in the parties' Settlement Agreement, awarding custody to ${agreedCustodian} on the terms therein.`
          : "Plaintiff requests that the Court approve and incorporate the custody arrangement as set forth in the parties' Settlement Agreement.";
        items.push({
          number: paragraphNum++,
          content: custodyContent,
          type: 'custody_request',
        });
        items.push({
          number: paragraphNum++,
          content: "Plaintiff requests that the Court approve and incorporate the parties' agreed child support arrangement, calculated pursuant to the Child Support Standards Act (Domestic Relations Law § 240 (1-b)).",
          type: 'support_request',
        });
      } else {
        items.push({
          number: paragraphNum++,
          content: 'Plaintiff requests that the Court determine custody of the child(ren) and establish an appropriate parenting schedule.',
          type: 'custody_request'
        });

        items.push({
          number: paragraphNum++,
          content: 'Plaintiff requests that the Court order child support in accordance with the Child Support Standards Act.',
          type: 'support_request'
        });
      }
    }

    // Agreed child arrangements (custody enum, primary residence, agreed
    // support) — pleaded via the base hooks, never silently dropped.
    paragraphNum = this.appendAgreedChildArrangementPleadings(items, paragraphNum, divorceData);

    // UCCJEA / home-state declaration (DRL §75-a et seq.) — mandatory in
    // every NY pleading that touches custody. Renders only when minor
    // children are present.
    if (this.hasChildrenUnder18(divorceData)) {
      const uccjea = this.generateUccjeaItems(divorceData, paragraphNum);
      items.push({
        number: null,
        content: 'UCCJEA HOME-STATE DECLARATION (Domestic Relations Law § 75-a et seq.)',
        type: 'uccjea_header',
      });
      items.push(...uccjea.items);
      paragraphNum = uccjea.nextParagraphNumber;
    }

    return {
      // Round-6 (David NY, 2026-08-30 v29): sections skipped from IV to
      // VI because CHILDREN had no roman numeral. Restore the V. prefix so
      // the pleading's outline is contiguous.
      title: 'V. CHILDREN',
      items,
      nextParagraphNumber: paragraphNum
    };
  }

  /**
   * NY is an equitable-distribution state (DRL § 236-B) — never
   * "community property" (LA/CA/TX). The base template pleads
   * "community/marital property"; override to plead marital property only.
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Property section
   */
  generatePropertySection(divorceData) {
    // Round-3 attorney review (David NY, 2026-08-30): a silent transcript
    // was fabricating "real property, personal property, and financial
    // accounts" allegations. Delegate to super's silence-aware gate
    // whenever `hasProperty` is not an affirmative true; only render the
    // NY marital-property boilerplate on an explicit user "yes".
    if (
      divorceData.hasProperty !== true ||
      this.hasAgreedPropertyDivision(divorceData) ||
      this.factsIndicateNoProperty(divorceData)
    ) {
      // Fall through to the base agreed/no-property paths, then scrub the
      // "community/marital" phrasing so NY reads as marital-only.
      const section = super.generatePropertySection(divorceData);
      section.items = section.items.map((item) => ({
        ...item,
        content: typeof item.content === 'string'
          ? item.content
            .replace(/community or marital property/gi, 'marital property')
            .replace(/marital or community property/gi, 'marital property')
            .replace(/community\/marital property/gi, 'marital property')
            .replace(/marital\/community property/gi, 'marital property')
            .replace(/community\s+and\s+marital\s+property/gi, 'marital property')
            .replace(/marital\s+and\s+community\s+property/gi, 'marital property')
            // Any remaining bare "community property" mention: NY is
            // equitable-distribution only, so scrub it.
            .replace(/community property/gi, 'marital property')
          : item.content,
      }));
      return section;
    }

    const items = [];
    let paragraphNum = divorceData._paragraphNum || 14;
    const t = this.terminology;

    items.push({
      number: paragraphNum++,
      content: 'The parties have acquired marital property during the marriage, including but not limited to real property, personal property, and financial accounts, subject to equitable distribution pursuant to Domestic Relations Law § 236-B.',
      type: 'property_info',
    });

    items.push({
      number: paragraphNum++,
      content: `${t.filerLabel} requests that the Court equitably distribute the marital property of the parties pursuant to Domestic Relations Law § 236-B.`,
      type: 'property_request',
    });

    // Round-3 attorney review (David NY): silent debts boilerplate. Only
    // emit on an affirmative signal; silence AND facts-derived "no debts"
    // suppress the paragraph.
    if (
      divorceData.hasDebts === true ||
      (Array.isArray(divorceData.petitionerDebts) && divorceData.petitionerDebts.length > 0) ||
      (Array.isArray(divorceData.respondentDebts) && divorceData.respondentDebts.length > 0)
    ) {
      if (!this.factsIndicateNoDebts(divorceData)) {
        items.push({
          number: paragraphNum++,
          content: `The parties have accumulated debts during the marriage. ${t.filerLabel} requests that the Court allocate responsibility for such debts equitably.`,
          type: 'debt_info',
        });
      }
    }

    return {
      title: 'VI. MARITAL PROPERTY',
      items,
      nextParagraphNumber: paragraphNum,
    };
  }

  /**
   * Attorney round-4 (David NY, 2026-08-30). Return a printable custodian
   * name when the profile has an explicit agreed custodian (primaryCustodian
   * with a real name, or custodyArrangement mentioning a party by name).
   * Returns '' when nothing certain is on file — the caller falls back to
   * "as set forth in the Settlement Agreement".
   */
  resolveAgreedCustodianName(divorceData) {
    const d = divorceData || {};
    const val = (x) => (typeof x === 'string' ? x.trim() : '');
    const primary = val(d.primaryCustodian);
    if (primary && !/^(undecided|tbd|tba|both|joint|jointly|shared|unknown|n\/?a)$/i.test(primary)) {
      return primary;
    }
    const arrangement = val(d.custodyArrangement);
    if (/joint|shared/i.test(arrangement)) return 'the parties jointly';
    const petitioner = val(d.petitionerName);
    const respondent = val(d.respondentName);
    if (arrangement && petitioner && arrangement.toLowerCase().includes(petitioner.toLowerCase())) {
      return petitioner;
    }
    if (arrangement && respondent && arrangement.toLowerCase().includes(respondent.toLowerCase())) {
      return respondent;
    }
    return '';
  }

  /**
   * Whether the case carries an uncontested / settled posture the
   * pleading should recite. Attorney review (2026-08) flagged that a
   * mediated CSSA agreement + maintenance waiver captured in the profile
   * never surfaced in the complaint. When present, the grounds section
   * appends a preamble reciting the Settlement Agreement and the agreed
   * items (custody, parenting time, CSSA child support, equitable
   * distribution, and any mutual maintenance waiver).
   * @param {Object} divorceData
   */
  hasUncontestedPosture(divorceData) {
    const d = divorceData || {};
    if (
      d.settlementAgreementDate ||
      d.settlementAgreement ||
      d.mediatedChildSupport === true ||
      d.spousalSupportWaived === true ||
      (d.spousalSupportRequested === false && this.hasAgreedPropertyDivision(d))
    ) {
      return true;
    }
    // Round-3 attorney review (David NY, 2026-08-30): structured fields
    // were absent but facts[] carried subcategory tokens the extractor
    // did classify — 'uncontested_agreement', 'mutual_waiver' (spousal
    // support), 'child_support' + content mentioning CSSA/mediated,
    // 'parenting_schedule' + mediated. Any of those establishes an
    // uncontested/settled posture the complaint should recite.
    const facts = Array.isArray(d.facts) ? d.facts : [];
    for (const f of facts) {
      if (!f || typeof f !== 'object') continue;
      const sub = String(f.subcategory || '').toLowerCase();
      const cat = String(f.category || '').toLowerCase();
      const content = String(f.content || f.text || '').toLowerCase();
      if (sub === 'uncontested_agreement' || sub === 'settlement_agreement') return true;
      if (sub === 'mutual_waiver' && (cat === 'spousal_support' || cat === 'support')) return true;
      if (cat === 'spousal_support' && /waiv/.test(content)) return true;
      if ((sub === 'child_support' || cat === 'children' || sub === 'parenting_schedule')
          && /mediat|cssa|settle/.test(content)) return true;
      if (sub === 'settlement' || sub === 'mediation') return true;
    }
    return false;
  }

  /**
   * Recite the parties' Settlement Agreement (mediated CSSA amount and/or
   * mutual maintenance waiver) as an uncontested-posture paragraph. Called
   * from the grounds section so the recital sits with the substantive
   * pleadings rather than as a stray note.
   */
  getUncontestedRecital(divorceData) {
    const d = divorceData || {};
    const facts = Array.isArray(d.facts) ? d.facts : [];
    const factHit = (pred) => facts.some((f) => {
      if (!f || typeof f !== 'object') return false;
      return pred(String(f.subcategory || '').toLowerCase(),
                  String(f.category || '').toLowerCase(),
                  String(f.content || f.text || '').toLowerCase());
    });
    const rawDate = d.settlementAgreementDate;
    const dateStr = rawDate && this.formatDate(rawDate);
    const dateClause = dateStr ? ` dated ${dateStr}` : ' dated __________________';
    const covered = [];
    if (d.hasMinorChildren === true || (Array.isArray(d.children) && d.children.length > 0)) {
      covered.push('custody', 'parenting time');
    }
    const mediatedChildSupport = d.mediatedChildSupport === true || d.childSupportAmount ||
      factHit((sub, cat, content) =>
        (sub === 'child_support' || cat === 'children') &&
        /mediat|cssa|child support standards act/.test(content));
    if (mediatedChildSupport) {
      covered.push('child support (calculated pursuant to the Child Support Standards Act)');
    }
    covered.push('equitable distribution');
    const list = covered.join(', ');
    let text = `The parties have entered a Settlement Agreement${dateClause}, which addresses ${list}.`;
    const spousalWaived = d.spousalSupportWaived === true || d.spousalSupportRequested === false ||
      factHit((sub, cat, content) =>
        (sub === 'mutual_waiver' && (cat === 'spousal_support' || cat === 'support')) ||
        (cat === 'spousal_support' && /waiv/.test(content)));
    if (spousalWaived) {
      text += ' The Agreement includes a mutual waiver of spousal maintenance.';
    }
    return text;
  }

  // (The uncontested-posture recital is appended inline within
  // generateGroundsSection above; see hasUncontestedPosture and
  // getUncontestedRecital below.)

  /**
   * Generate New York relief section
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Relief section
   */
  generateReliefSection(divorceData) {
    const items = [];

    items.push({
      number: null,
      content: 'WHEREFORE, Plaintiff demands judgment against Defendant as follows:',
      type: 'relief_intro'
    });

    const reliefItems = [];

    reliefItems.push('Dissolving the marriage between the parties;');
    reliefItems.push('Equitably distributing the marital property;');

    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      // Attorney round-4 (David NY, 2026-08-30): in an uncontested posture,
      // prayer (c) must not ask the Court to "award custody to the
      // appropriate party" — the parties have already agreed. Approve
      // the agreed arrangement (naming the agreed custodian when known).
      if (this.hasUncontestedPosture(divorceData)) {
        const agreedCustodian = this.resolveAgreedCustodianName(divorceData);
        reliefItems.push(
          agreedCustodian
            ? `Approving the custody arrangement as set forth in the parties' Settlement Agreement, with custody awarded to ${agreedCustodian};`
            : "Approving the custody arrangement as set forth in the parties' Settlement Agreement;"
        );
        reliefItems.push("Approving the parties' agreed child support arrangement, calculated pursuant to the Child Support Standards Act;");
      } else {
        reliefItems.push('Awarding custody of the child(ren) to the appropriate party;');
        reliefItems.push('Ordering child support in accordance with the Child Support Standards Act;');
      }
      reliefItems.push('Ordering maintenance of health insurance for the child(ren);');
    }

    if (divorceData.requestSpousalSupport) {
      reliefItems.push('Awarding maintenance (spousal support) to Plaintiff;');
    }

    if (divorceData.requestNameChange && divorceData.previousName) {
      reliefItems.push(`Authorizing Plaintiff to resume use of the prior surname: ${divorceData.previousName};`);
    }

    // Uncontested-posture prayer: incorporate the Settlement Agreement
    // but do NOT merge it into the Judgment of Divorce (NY convention
    // when the parties resolve all ancillary issues by stipulation).
    // Attorney round-2 (NY, 2026-08-30) flagged the omission.
    if (this.hasUncontestedPosture(divorceData)) {
      reliefItems.push(
        "Incorporating, but not merging, the parties' Settlement Agreement into the Judgment of Divorce;",
      );
    }

    reliefItems.push('Granting such other and further relief as to this Court seems just and proper.');

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
      title: 'PRAYER FOR RELIEF',
      items,
      nextParagraphNumber: null
    };
  }

  /**
   * Get New York verification text
   * @param {Object} divorceData - Divorce data
   * @returns {string} Verification text
   */
  getVerificationText(divorceData) {
    const name = divorceData.petitionerName || '[PLAINTIFF NAME]';
    const county = divorceData.county || '[COUNTY]';

    return `STATE OF NEW YORK      )
                       ) ss.:
COUNTY OF ${county.toUpperCase()}   )

${name}, being duly sworn, deposes and says:

I am the Plaintiff in the above entitled action. I have read the foregoing Verified Complaint and know the contents thereof. The same is true to my own knowledge, except as to the matters therein stated to be alleged on information and belief, and as to those matters I believe them to be true.

_________________________________
${name}

Sworn to before me this
_____ day of _____________, 20___.

_________________________________
Notary Public`;
  }

  /**
   * Perform New York-specific validation
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Validation result
   */
  performStateSpecificValidation(divorceData) {
    const errors = [];
    const warnings = [];

    // New York requires county
    if (!divorceData.county) {
      errors.push('County is required for New York divorce actions');
    }

    // Complex residency requirement warning
    warnings.push('New York has complex residency requirements. Verify that one of the DRL § 230 residency conditions is met.');

    // Barriers to remarriage (UD-4)
    warnings.push('If the parties were married in a religious ceremony, the Sworn Statement of Removal of Barriers to Remarriage (UD-4) must be served.');

    // Children under 21
    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      warnings.push('In New York, child support obligations generally continue until the child reaches age 21.');
    }

    // Index number warning
    warnings.push('You must purchase an Index Number before filing. The current fee is approximately $210 plus an additional fee for Request for Judicial Intervention.');

    return { errors, warnings };
  }
}

module.exports = NewYorkDivorcePetitionTemplate;
