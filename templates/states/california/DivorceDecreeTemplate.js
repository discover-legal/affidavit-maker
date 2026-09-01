// templates/states/california/DivorceDecreeTemplate.js
// California-specific Judgment of Dissolution of Marriage template
// Complies with California Family Code and California Rules of Court

const BaseDivorceDecreeTemplate = require('../../core/BaseDivorceDecreeTemplate');
const { resolveCustodyArrangement, resolvePrimaryResidenceName } = require('../../core/parenting');
const { asList, partitionByCharacter } = require('../../core/dataShapes');
const { resolveSpousalSupportDecision } = require('../../core/spousalSupport');
const { captionUpper } = require('../../core/nameCase');

/**
 * Shape-check for a date value. Mirrors the CA petition template's helper —
 * see DivorcePetitionTemplate.js for the rationale (v11 CA replay). A
 * freeform narrative like "a few months ago" must not slip through as a
 * literal date; only ISO YYYY-MM-DD, M/D/YYYY, or "Month DD, YYYY" render.
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
 * California Judgment of Dissolution Template
 *
 * Legal References:
 * - California Family Code Division 6 (Nullity, Dissolution, and Legal Separation)
 * - Family Code § 2310 (Grounds for dissolution)
 * - Family Code § 2330-2334 (Procedure for dissolution)
 * - Family Code § 2550 (Community property division)
 * - Family Code § 4320 (Spousal support factors)
 * - California Code of Civil Procedure § 2015.5 (Declaration under penalty of perjury)
 * - California Rules of Court, Rule 5.12 (Format of family law papers)
 *
 * Formatting Requirements:
 * - 8.5" x 11" paper
 * - 1.5" left margin, 0.5" right margin
 * - 1" top margin, 0.5" bottom margin
 * - 12-point proportionally spaced font
 * - Double-spaced text
 *
 * California-Specific Terms:
 * - "Dissolution of Marriage" instead of "Divorce"
 * - "Judgment" instead of "Decree"
 * - "Case Number:" label
 * - "Spousal Support" instead of "Alimony"
 * - Community Property state (equal division presumption)
 * - 6-month waiting period from service
 * - Official form FL-180
 */
class CaliforniaDivorceDecreeTemplate extends BaseDivorceDecreeTemplate {
  constructor() {
    super();

    this.state = 'CA';
    this.stateName = 'California';
    this.documentTitle = 'JUDGMENT OF DISSOLUTION OF MARRIAGE';

    // Load metadata if available
    try {
      this.metadata = require('./divorce-metadata.json');
    } catch (e) {
      this.metadata = null;
    }

    // California-specific required fields
    // marriageDate and separationDate are legally required for a signed
    // judgment, but drafts routinely originate before the drafter has
    // pinned down exact dates. The template renders a visible fill-in
    // blank + Draft note in that case (see generateJurisdictionSection)
    // rather than emitting a `[DATE]` sentinel. caseNumber stays required
    // for judgments — an unsigned decree without a case number is a
    // draft-quality problem the interviewer should surface. (v10 CA
    // replay, 2026-08.)
    this.requiredFields = [
      'petitionerName',
      'respondentName',
      'state',
      'county',
      'caseNumber'
    ];

    // California formatting requirements (per Rules of Court)
    this.formatting = {
      fontSize: '12pt',
      fontFamily: 'Times New Roman',
      lineHeight: '2',
      marginLeft: '1.5in',
      marginRight: '0.5in',
      marginTop: '1in',
      marginBottom: '0.5in',
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
   * Get default court for California county
   * @param {string} county - County name
   * @returns {string} Court name
   */
  getDefaultCourt(county) {
    const countyUpper = (county || '[COUNTY]').toUpperCase();
    return `SUPERIOR COURT OF CALIFORNIA, COUNTY OF ${countyUpper}`;
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
    const countyUpper = (county || '[COUNTY]').toUpperCase();
    return `COUNTY OF ${countyUpper}`;
  }

  /**
   * Generate California case caption
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Case caption
   */
  generateCaseCaption(divorceData) {
    let caption = '';

    const courtName = divorceData.court || this.getDefaultCourt(divorceData.county);
    caption += `${courtName.toUpperCase()}\n\n`;

    caption += `In re the Marriage of:\n\n`;

    // captionUpper preserves internal-capital surnames the extraction layer
    // deliberately keeps (McPherson, DiCaprio, van der Berg, O'Brien-Hatch)
    // instead of destroying them with `.toUpperCase()` — live California
    // audit surfaced "McPHERSON" corrupted to "MCPHERSON".
    const petitioner = divorceData.petitionerName ? captionUpper(divorceData.petitionerName) : '[PETITIONER NAME]';
    caption += `Petitioner: ${petitioner}\n\n`;

    caption += `and\n\n`;

    const respondent = divorceData.respondentName ? captionUpper(divorceData.respondentName) : '[RESPONDENT NAME]';
    caption += `Respondent: ${respondent}`;

    const caseNumber = divorceData.caseNumber || '[CASE NUMBER]';
    caption += `\n\nCase Number: ${caseNumber}`;

    return {
      courtName,
      caseNumber: divorceData.caseNumber,
      petitioner: divorceData.petitionerName,
      respondent: divorceData.respondentName,
      formatted: caption
    };
  }

  /**
   * Generate California title
   * @returns {string} Title text
   */
  generateTitle() {
    return 'JUDGMENT OF DISSOLUTION OF MARRIAGE\n[  ] Status Only  [  ] Reserving Jurisdiction  [  ] Judgment on Reserved Issues';
  }

  /**
   * Generate California appearances section
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Appearances section
   */
  generateAppearancesSection(divorceData) {
    let text = '';

    text += `This proceeding came on for hearing on ${this.formatDate(divorceData.hearingDate) || '___________________'} in Department ____.\n\n`;

    if (divorceData.isUncontested || divorceData.appearanceType === 'agreed') {
      text += `Petitioner ${divorceData.petitionerName || '[PETITIONER NAME]'} appeared ${divorceData.petitionerRepresentation === 'attorney' ? 'with counsel' : 'in pro per (self-represented)'}.\n\n`;

      if (divorceData.respondentAppeared) {
        text += `Respondent ${divorceData.respondentName || '[RESPONDENT NAME]'} appeared and submitted to the judgment.\n\n`;
      } else {
        text += `Respondent ${divorceData.respondentName || '[RESPONDENT NAME]'} having been properly served, did not appear, and default was entered.\n\n`;
      }
    } else {
      text += `Petitioner appeared ${divorceData.petitionerRepresentation === 'attorney' ? 'with counsel' : 'in pro per'}.\n\n`;
      text += `Respondent ${divorceData.respondentAppeared ? 'appeared' : 'did not appear'}.`;
    }

    text += `\n\nThe Court, having reviewed the file and evidence, makes the following findings and orders:`;

    return {
      title: 'APPEARANCES',
      text,
      type: 'appearances'
    };
  }

  /**
   * Generate California jurisdiction section
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Jurisdiction section
   */
  generateJurisdictionSection(divorceData) {
    const waitingPeriodMet = divorceData.serviceDate
      ? `More than six months have elapsed since service of the Summons and Petition.`
      : `At least six months have elapsed since service of the Summons and Petition or the date Respondent filed a Response.`;

    // Render visible fill-in-by-hand blanks for missing marriage/separation
    // dates, plus a Draft note, rather than a `[DATE]` sentinel. Same
    // pattern as the Ontario decree's case-number handling (v8-D). The
    // packet path already sanitizes tokens to blanks in pdfService; this
    // brings the per-document path in line. (v10 CA replay, 2026-08.)
    const marriageDateFormatted = isRenderableDate(divorceData.marriageDate)
      ? this.formatDate(divorceData.marriageDate)
      : null;
    const separationDateFormatted = isRenderableDate(divorceData.separationDate)
      ? this.formatDate(divorceData.separationDate)
      : null;
    const marriageDisplay = marriageDateFormatted || '__________________';
    const separationDisplay = separationDateFormatted || '__________________';
    const dateNotes = [];
    if (!marriageDateFormatted) {
      dateNotes.push('date of marriage');
    }
    if (!separationDateFormatted) {
      dateNotes.push('date of separation');
    }
    const dateDraftNote = dateNotes.length > 0
      ? `\n(Draft — insert exact ${dateNotes.join(' and ')} before filing)`
      : '';

    let text = `The Court finds:\n\n1. This Court has jurisdiction over this proceeding.\n\n2. The residency requirements of Family Code § 2320 have been met. Petitioner has been a resident of California for at least six months and of ${divorceData.county || '[COUNTY]'} County for at least three months immediately preceding the filing of this Petition.\n\n3. ${waitingPeriodMet}\n\n4. The parties were married on ${marriageDisplay} and separated on ${separationDisplay}.${dateDraftNote}\n\n5. Irreconcilable differences have caused the irremediable breakdown of the marriage.`;

    // Adult-children statement: when the case data records children but
    // none are minors, name them here rather than erase them (live
    // California audit, 2026-08). This never treats adult children as
    // minors — that stays a null childCustody section.
    const adultStatement = this.getAdultChildrenStatement(divorceData);
    if (adultStatement) {
      text += `\n\n6. ${adultStatement}`;
    }

    // Prenup preamble finding — placed in the JURISDICTION findings so it
    // reads as a court finding underlying the property orders below.
    if (this.hasPrenupAgreement(divorceData)) {
      const prenupIndex = adultStatement ? 7 : 6;
      text += `\n\n${prenupIndex}. ${this.getPrenupFindingText(divorceData)}`;
    }

    return {
      title: 'JURISDICTION',
      text,
      type: 'jurisdiction'
    };
  }

  /**
   * When the case data lists children but none are minors, produce a
   * statement naming them so they are not erased. Returns null when the
   * data has minors (or none at all — the caller decides what to say).
   */
  getAdultChildrenStatement(divorceData) {
    const d = divorceData || {};
    if (d.hasMinorChildren === true) return null;

    const childArr = Array.isArray(d.children) ? d.children : [];
    const names = childArr
      .map((c) => (typeof c === 'string' ? c : (c && c.name) || null))
      .filter(Boolean);

    // Resolve count the same way the petition does — explicit
    // numberOfChildren wins, else fall back to the array length.
    let numChildren = 0;
    const rawNum = d.numberOfChildren;
    if (typeof rawNum === 'number' && Number.isFinite(rawNum)) {
      numChildren = rawNum;
    } else if (typeof rawNum === 'string' && /^\d+$/.test(rawNum.trim())) {
      numChildren = parseInt(rawNum.trim(), 10);
    } else {
      numChildren = childArr.length;
    }

    if (names.length > 0) {
      const list = names.length === 1
        ? names[0]
        : names.slice(0, -1).join(', ') + ', and ' + names[names.length - 1];
      return `The parties have the following children of the marriage, all of whom are adults: ${list}. No custody, visitation, or child support orders are entered as to any adult child.`;
    }

    if (d.hasMinorChildren === false && numChildren > 0) {
      const noun = numChildren === 1 ? 'child' : 'children';
      const verb = numChildren === 1 ? 'is' : 'are';
      return `There ${verb} ${numChildren} adult ${noun} of the marriage. No custody, visitation, or child support orders are entered as to any adult child.`;
    }

    if (d.hasMinorChildren === false && this.factsMentionAdultChildren(d.facts)) {
      return `There are adult children of the marriage. No custody, visitation, or child support orders are entered as to any adult child.`;
    }

    return null;
  }

  /**
   * Scan facts[] for a narrative mention of adult children — mirrors the
   * petition template's helper so the decree does not fall back to
   * silence when the extractor knows there are adult children but never
   * populated a count or an array.
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
   * Generate California dissolution section
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Dissolution section
   */
  generateDissolutionSection(divorceData) {
    return {
      title: 'DISSOLUTION',
      text: `IT IS ORDERED that the marriage of Petitioner ${divorceData.petitionerName || '[PETITIONER NAME]'} and Respondent ${divorceData.respondentName || '[RESPONDENT NAME]'} is dissolved, and the parties are restored to the status of single persons, effective ${this.formatDate(divorceData.divorceDate) || 'the date this Judgment is entered'}.`,
      type: 'dissolution'
    };
  }

  /**
   * Generate California property division with community property language
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Property division section
   */
  generatePropertyDivisionSection(divorceData) {
    const items = [];

    items.push({
      content: 'The Court orders division of the community estate as follows (Family Code § 2550 — equal division), subject to confirmation of separate property to each party (Family Code § 2581 et seq.):',
      type: 'finding'
    });

    // A premarital agreement that both parties agree still governs gets a
    // finding paragraph in the property section so the awards below are
    // read against it (live California audit, 2026-08 — the prenup only
    // appeared inline in property bullets, never as its own recital).
    if (this.hasPrenupAgreement(divorceData)) {
      items.push({
        content: this.getPrenupFindingText(divorceData),
        type: 'finding'
      });
    }

    // Property AWARDED to Petitioner. Community property confirmed to one
    // spouse is that spouse's SOLE PROPERTY — never call it "separate
    // property" (which has a specific §770 meaning about pre-marital /
    // gifted / inherited property). Live California audit, 2026-08.
    const petitionerName = divorceData.petitionerName || '[PETITIONER NAME]';
    const respondentName = divorceData.respondentName || '[RESPONDENT NAME]';
    const prenupTail = this.hasPrenupAgreement(divorceData)
      ? ', subject to any confirmation of separate character under the parties\' premarital agreement'
      : '';

    // Split each party's list into community vs separate property by the
    // "Separate property: " prefix the extraction layer emits (see
    // services/agents/extractionQuality.js). Community items go under the
    // §2550 equal-division awards; separate items go under the §2581 et seq.
    // confirmation clause below — never lumped together (a $45k inherited CD
    // must not be re-cast as community property awarded as "sole property").
    const petParts = partitionByCharacter(divorceData.petitionerProperty, 'property');
    const respParts = partitionByCharacter(divorceData.respondentProperty, 'property');

    items.push({
      content: `IT IS ORDERED that the following community property is awarded to Petitioner ${petitionerName} as that party's sole property${prenupTail}:`,
      type: 'order'
    });

    if (petParts.community.length > 0) {
      petParts.community.forEach(prop => {
        items.push({ content: `• ${prop}`, type: 'property_item' });
      });
    } else {
      items.push({
        content: '• All personal property currently in Petitioner\'s possession',
        type: 'property_item'
      });
    }

    items.push({
      content: `IT IS ORDERED that the following community property is awarded to Respondent ${respondentName} as that party's sole property${prenupTail}:`,
      type: 'order'
    });

    if (respParts.community.length > 0) {
      respParts.community.forEach(prop => {
        items.push({ content: `• ${prop}`, type: 'property_item' });
      });
    } else {
      items.push({
        content: '• All personal property currently in Respondent\'s possession',
        type: 'property_item'
      });
    }

    // Separate property confirmation (Family Code § 2581 et seq.). When the
    // extraction layer identified specific separate items, name them here so
    // the tracing is on the record; otherwise fall back to the general
    // confirmation.
    const hasSeparate = petParts.separate.length + respParts.separate.length > 0;
    if (hasSeparate) {
      items.push({
        content: 'IT IS ORDERED that the following property is confirmed as the separate property of each party (Family Code §§ 770-771, 2581 et seq.), and no order of division is made as to it:',
        type: 'order'
      });
      petParts.separate.forEach(prop => {
        items.push({ content: `• ${petitionerName}'s separate property: ${prop}`, type: 'property_item' });
      });
      respParts.separate.forEach(prop => {
        items.push({ content: `• ${respondentName}'s separate property: ${prop}`, type: 'property_item' });
      });
    } else {
      items.push({
        content: 'Each party\'s separate property (as defined by Family Code §§ 770-771) is confirmed to that party.',
        type: 'order'
      });
    }

    // Equalization payment — its own ordered clause under DIVISION OF
    // PROPERTY, never buried under ALLOCATION OF DEBTS (live California
    // audit, 2026-08). Reads equalizationAmount/equalizationPayment,
    // equalizationSchedule, equalizationPayor/equalizationPayee.
    const eq = this.getEqualizationOrder(divorceData);
    if (eq) items.push({ content: eq, type: 'order' });

    return {
      title: 'DIVISION OF PROPERTY',
      items,
      type: 'property'
    };
  }

  /**
   * Whether the case data records a premarital ("prenuptial") agreement
   * that both parties agree still governs. Fields checked (waiting on
   * extraction schema to formalize prenupSignedDate/prenupGoverns):
   *   prenuptialAgreement (truthy or string), hasPrenup, prenupSignedDate,
   *   prenupGoverns.
   */
  hasPrenupAgreement(divorceData) {
    const d = divorceData || {};
    return Boolean(
      d.hasPrenup ||
      d.prenupGoverns ||
      d.prenupSignedDate ||
      // Interview extraction schema (services/agents/BaseDivorceOrchestrator):
      // prenup_signed / prenup_governs_after_divorce / prenup_signed_year map
      // to these camelCase fields.
      d.prenupSigned ||
      d.prenupGovernsAfterDivorce ||
      d.prenupSignedYear ||
      (typeof d.prenuptialAgreement === 'string' && d.prenuptialAgreement.trim() !== '') ||
      d.prenuptialAgreement === true
    );
  }

  /**
   * Recital paragraph describing the parties' premarital agreement. Uses
   * the signed date/year when the extraction layer has it (fields
   * prenupSignedDate or prenupYear), else a neutral phrasing.
   */
  getPrenupFindingText(divorceData) {
    const d = divorceData || {};
    let dateFragment = '';
    if (d.prenupSignedDate) {
      const formatted = this.formatDate(d.prenupSignedDate);
      dateFragment = formatted ? ` dated ${formatted}` : '';
    } else if (d.prenupYear) {
      dateFragment = ` dated ${d.prenupYear}`;
    } else if (d.prenupSignedYear) {
      // Interview extraction stores the signed year here (see
      // services/agents/BaseDivorceOrchestrator prenup_signed_year field).
      dateFragment = ` dated ${d.prenupSignedYear}`;
    }
    return `The Court finds that the parties entered a premarital agreement${dateFragment} which continues to govern the characterization and disposition of separate property confirmed herein.`;
  }

  /**
   * Composed equalization order clause, or null when no equalization data
   * exists. Fields (source of truth: interview extraction — a dedicated
   * schema field is being added):
   *   equalizationAmount / equalizationPayment — the $ figure
   *   equalizationSchedule — human-readable schedule ("over 36 months")
   *   equalizationPayor / equalizationPayee — parties (fall back to
   *     respondent → petitioner if unspecified)
   */
  getEqualizationOrder(divorceData) {
    const d = divorceData || {};
    const amountRaw = d.equalizationAmount != null ? d.equalizationAmount : d.equalizationPayment;
    const amount = amountRaw != null && String(amountRaw).trim() !== '' ? String(amountRaw) : null;
    if (!amount) return null;
    const payor = (d.equalizationPayor && String(d.equalizationPayor).trim()) || d.respondentName || 'Respondent';
    const payee = (d.equalizationPayee && String(d.equalizationPayee).trim()) || d.petitionerName || 'Petitioner';
    const schedule = d.equalizationSchedule && String(d.equalizationSchedule).trim()
      ? String(d.equalizationSchedule).trim()
      : null;
    const scheduleClause = schedule ? `, payable ${schedule}` : ', payable on terms to be set by the Court';
    return `IT IS ORDERED that ${payor} shall pay to ${payee} an equalization payment of $${amount}${scheduleClause}, pursuant to Family Code § 2550, to equalize the division of the community estate.`;
  }

  /**
   * Generate California child custody section
   * @param {Object} divorceData - Divorce data
   * @returns {Object|null} Custody section
   */
  generateChildCustodySection(divorceData) {
    if (divorceData.hasMinorChildren === false || !divorceData.children || divorceData.children.length === 0) {
      return null;
    }

    const items = [];

    items.push({
      content: 'The Court makes the following orders regarding custody and visitation in the best interests of the minor child(ren):',
      type: 'finding'
    });

    items.push({
      content: 'The minor child(ren) of this marriage are:',
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

    // Custody arrangement
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
        content: `Legal custody of the minor child(ren) is awarded to: [  ] Petitioner [  ] Respondent [X] Joint`,
        type: 'order'
      });

      items.push({
        content: `Physical custody of the minor child(ren) is awarded to: [X] ${resolvePrimaryResidenceName(divorceData) || divorceData.petitionerName || 'Petitioner'} as primary parent [  ] Joint`,
        type: 'order'
      });
    } else if (custody.kind === 'sole_petitioner' || custody.kind === 'sole_respondent' || custody.kind === 'legacy_sole') {
      const custodianName =
        custody.kind === 'sole_petitioner'
          ? (divorceData.petitionerName || 'Petitioner')
          : custody.kind === 'sole_respondent'
            ? (divorceData.respondentName || 'Respondent')
            : (resolvePrimaryResidenceName(divorceData) || divorceData.petitionerName || 'Petitioner');
      soleCustodianName = custodianName;
      items.push({
        content: `Sole legal and physical custody is awarded to ${custodianName}.`,
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

    // Visitation
    items.push({
      content: this.getVisitationLanguage(divorceData),
      type: 'order'
    });

    return {
      title: 'CHILD CUSTODY AND VISITATION',
      items,
      type: 'custody'
    };
  }

  /**
   * Get California visitation language
   * @param {Object} divorceData - Divorce data
   * @returns {string} Visitation language
   */
  getVisitationLanguage(divorceData) {
    return `Visitation shall be as set forth in the attached parenting plan, or if none, as follows: reasonable visitation upon reasonable notice.`;
  }

  /**
   * Generate California child support section
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
        content: `IT IS ORDERED that ${obligor} shall pay guideline child support to ${obligee} in the amount of $${divorceData.childSupportAmount} per month, payable on the 1st of each month, as calculated under the California Statewide Uniform Guideline (Family Code § 4050-4076).`,
        type: 'order'
      });
    } else {
      items.push({
        content: `IT IS ORDERED that child support shall be paid in accordance with the California Statewide Uniform Guideline (Family Code § 4050-4076).`,
        type: 'order'
      });
    }

    // Income withholding
    items.push({
      content: 'An Earnings Assignment Order for Support is issued.',
      type: 'order'
    });

    // Health insurance
    items.push({
      content: `IT IS ORDERED that ${divorceData.healthInsuranceProvider || obligor} shall maintain health insurance for the minor child(ren) through employer or other group plan if available at no cost or reasonable cost.`,
      type: 'order'
    });

    // Unreimbursed expenses
    items.push({
      content: 'Unreimbursed health care costs for the minor child(ren) shall be divided equally between the parties unless otherwise ordered.',
      type: 'order'
    });

    return {
      title: 'CHILD SUPPORT',
      items,
      type: 'child_support'
    };
  }

  /**
   * Generate California spousal support section
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
        content: `The Court, having considered the factors set forth in Family Code § 4320, orders as follows:`,
        type: 'finding'
      });
      items.push({
        content: `IT IS ORDERED that ${payor} shall pay spousal support to ${payee} in the amount of $${decision.amount || '[AMOUNT]'} per month, beginning ${this.formatDate(decision.startDate) || '[DATE]'}.`,
        type: 'order'
      });
      const marriageLength = divorceData.marriageLengthYears || '[LENGTH]';
      if (marriageLength >= 10 || divorceData.longTermMarriage) {
        items.push({
          content: 'This is a marriage of long duration (10+ years). The Court retains jurisdiction over spousal support indefinitely.',
          type: 'order'
        });
      } else {
        items.push({
          content: `Spousal support shall continue for ${decision.duration || 'one-half the length of the marriage'} unless modified or terminated.`,
          type: 'order'
        });
      }
    } else if (decision.outcome === 'reserve') {
      items.push({
        content: `IT IS ORDERED that the Court reserves jurisdiction over spousal support pursuant to Family Code § 4320, ${payee} having requested support with no specific amount yet on file; the amount and duration shall be set by the Court.`,
        type: 'order'
      });
    } else if (decision.outcome === 'waive') {
      items.push({
        content: 'The Court terminates jurisdiction to award spousal support to either party.',
        type: 'order'
      });
    }

    return {
      title: 'SPOUSAL SUPPORT',
      items,
      type: 'spousal_support'
    };
  }

  /**
   * Generate California name change section
   * @param {Object} divorceData - Divorce data
   * @returns {Object|null} Name change section
   */
  generateNameChangeSection(divorceData) {
    if (!divorceData.requestNameChange || !divorceData.previousName) {
      return null;
    }

    const person = divorceData.nameChangeParty || divorceData.petitionerName || 'Petitioner';

    return {
      title: 'RESTORATION OF FORMER NAME',
      text: `IT IS ORDERED that ${person}'s former name is restored to: ${divorceData.previousName}.`,
      type: 'name_change'
    };
  }

  /**
   * Generate California final orders section
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Final orders section
   */
  generateFinalOrdersSection(divorceData) {
    const items = [];

    items.push({
      content: 'All other relief requested in this case is denied.',
      type: 'order'
    });

    items.push({
      content: 'This Judgment is final and binding on the parties.',
      type: 'order'
    });

    items.push({
      content: 'Each party shall execute any documents necessary to effectuate this Judgment.',
      type: 'order'
    });

    items.push({
      content: 'Unless otherwise ordered, each party shall bear their own attorney fees and costs.',
      type: 'order'
    });

    return {
      title: 'OTHER ORDERS',
      items,
      type: 'final_orders'
    };
  }

  /**
   * Generate California judgment block
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Judgment block
   */
  generateJudgmentBlock(divorceData) {
    return {
      text: `Date: ___________________

_________________________________
JUDICIAL OFFICER

${divorceData.judgeName ? divorceData.judgeName.toUpperCase() : ''}
${divorceData.county ? `SUPERIOR COURT OF CALIFORNIA` : ''}
${divorceData.county ? `COUNTY OF ${divorceData.county.toUpperCase()}` : ''}`,
      type: 'judgment'
    };
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
      errors.push('County is required for California dissolution judgments');
    }

    // California requires case number for judgment
    if (!divorceData.caseNumber) {
      errors.push('Case number is required for California Judgment');
    }

    // California requires date of separation for community property division
    if (!divorceData.separationDate) {
      warnings.push('Date of separation is important for California community property division (Family Code § 70).');
    }

    // Warning about 6-month waiting period
    if (divorceData.serviceDate) {
      const serviceDate = new Date(divorceData.serviceDate);
      const today = new Date();
      const sixMonthsMs = 180 * 24 * 60 * 60 * 1000;
      if (today - serviceDate < sixMonthsMs) {
        warnings.push('California requires a 6-month waiting period from service before judgment can be entered.');
      }
    } else {
      warnings.push('Ensure the 6-month waiting period from service has elapsed before entering judgment.');
    }

    // Warning about children
    if (divorceData.hasMinorChildren === true && (!divorceData.children || divorceData.children.length === 0)) {
      warnings.push('You indicated there are minor children but did not provide child information.');
    }

    return { errors, warnings };
  }
}

module.exports = CaliforniaDivorceDecreeTemplate;
