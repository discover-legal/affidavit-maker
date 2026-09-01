// templates/core/BaseDivorceDecreeTemplate.js
// Base template class for final divorce decree/judgment generation
// Provides common functionality across all states

// Use Node's built-in crypto.randomUUID (v4 UUID) instead of the `uuid`
// npm package — see BaseDivorcePetitionTemplate.js for the full rationale.
// In short: these templates load via createRequire against on-disk
// node_modules, but the Next.js standalone tracer never ships
// node_modules/uuid, so `require('uuid')` threw at load and silently
// dropped every divorce decree from the registry. `node:crypto` is a
// built-in and always resolvable.
const { randomUUID: uuidv4 } = require('node:crypto');
const { normalizeCountyName } = require('./countyName');
const { asList, partitionByCharacter } = require('./dataShapes');
const { DEFAULT_TERMS } = require('./terminology');
const {
  resolveCustodyArrangement,
  resolvePrimaryResidenceName,
  resolveNonResidentialParentName,
} = require('./parenting');
const { captionNamesCourt, lineDuplicatesCaption, stripCourtLineFromFormatted } = require('./captionDedupe');
const { resolveSpousalSupportDecision } = require('./spousalSupport');
const { isRenderableDate, formatDate: sharedFormatDate } = require('./dateUtils');

/**
 * Title-case an all-caps document title ("FINAL DECREE OF DIVORCE" →
 * "Final Decree of Divorce") for cover sheets / packet metadata.
 */
const titleCaseDocumentTitle = (title) =>
  String(title || '')
    .toLowerCase()
    .replace(/(^|[\s(—–-])([a-z])/g, (m, pre, ch) => pre + ch.toUpperCase())
    .replace(/\b(Of|For|And|The|To|In)\b/g, (w) => w.toLowerCase())
    .replace(/^([a-z])/, (ch) => ch.toUpperCase());

/**
 * Escape HTML special characters to prevent XSS/injection
 * @param {string} str - String to escape
 * @returns {string} Escaped string safe for HTML
 */
const escapeHtml = (str) => {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

/**
 * Base template class for final divorce decree/judgment generation
 * Provides common functionality across all states
 *
 * @class BaseDivorceDecreeTemplate
 * @description Abstract base class that defines the common interface and functionality
 * for all state-specific divorce decree templates. State templates should extend this class
 * and override state-specific methods as needed.
 *
 * A Final Decree of Divorce (also called Judgment of Dissolution or Divorce Judgment)
 * is the court order that officially ends the marriage. It includes:
 * - Declaration that the marriage is dissolved
 * - Property division orders
 * - Custody and parenting orders (if children)
 * - Support orders (child and/or spousal)
 * - Name change orders (if requested)
 */
class BaseDivorceDecreeTemplate {
  constructor() {
    this.state = null;
    this.stateName = null;
    this.documentType = 'decree';
    this.documentTitle = 'FINAL DECREE OF DIVORCE';

    // Jurisdiction-aware terminology. Defaults reproduce the historical US
    // wording byte-for-byte; non-US templates opt in by merging overrides
    // (see templates/core/terminology.js for the field reference).
    this.terminology = { ...DEFAULT_TERMS };

    // Required fields for a valid decree
    this.requiredFields = [
      'petitionerName',
      'respondentName',
      'state',
      'county',
      'caseNumber',
      'marriageDate',
      'divorceDate'
    ];

    // Sections that make up a divorce decree
    this.sections = {
      header: true,
      venue: true,
      caseCaption: true,
      title: true,
      appearances: true,
      jurisdiction: true,
      marriageDissolution: true,
      propertyDivision: true,
      debtAllocation: true,
      childCustody: true,
      childSupport: true,
      spousalSupport: true,
      nameChange: true,
      waivers: true,
      finalOrders: true,
      judgmentBlock: true,
      signatureBlock: true
    };

    // Standard formatting for court documents
    this.formatting = {
      fontSize: '12pt',
      fontFamily: 'Times New Roman',
      lineHeight: '2',
      margin: '1in'
    };
  }

  /**
   * Get template requirements
   * @returns {Object} Template requirements including fields, sections, and formatting
   */
  getRequirements() {
    return {
      documentType: this.documentType,
      requiredFields: this.requiredFields,
      sections: this.sections,
      formatting: this.formatting
    };
  }

  /**
   * Get formatting rules for this template
   * @returns {Object} Formatting rules (font, size, margins, line height)
   */
  getFormattingRules() {
    return this.formatting;
  }

  /**
   * Validate decree data against template requirements
   *
   * @param {Object} divorceData - The divorce decree data to validate
   * @returns {Object} Validation result with isValid, errors, and warnings
   */
  validateData(divorceData) {
    const errors = [];
    const warnings = [];

    // Check required fields
    if (!divorceData.petitionerName || divorceData.petitionerName.trim().length < 2) {
      errors.push(`${this.terminology.filerLabel} name is required`);
    }

    if (!divorceData.respondentName || divorceData.respondentName.trim().length < 2) {
      errors.push(`${this.terminology.responderLabel} name is required`);
    }

    if (!divorceData.state) {
      errors.push('State is required');
    }

    if (!divorceData.county) {
      errors.push(`${this.terminology.districtTerm} is required`);
    }

    if (!divorceData.caseNumber) {
      errors.push('Case number is required for final decree');
    }

    if (!divorceData.marriageDate) {
      errors.push('Date of marriage is required');
    }

    // Warnings
    if (!divorceData.divorceDate) {
      warnings.push('Divorce date will be left blank for judge to complete');
    }

    // Unrecognized custody arrangement: the parenting order will render
    // neutral as-agreed language with a placeholder rather than guessing at
    // a sole or joint order.
    if (Array.isArray(divorceData.children) && divorceData.children.length > 0) {
      const custody = resolveCustodyArrangement(divorceData);
      if (custody.explicit && custody.kind === 'unspecified') {
        warnings.push(
          `Custody arrangement "${custody.raw}" was not recognized; the parenting order uses neutral as-agreed language with a placeholder — review and complete it before filing`
        );
      }
    }

    // State-specific validation
    const stateValidation = this.performStateSpecificValidation(divorceData);
    errors.push(...stateValidation.errors);
    warnings.push(...stateValidation.warnings);

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Generate complete divorce decree document
   *
   * @param {Object} divorceData - The divorce data
   * @returns {Object} Complete document with sections, validation, and metadata
   */
  generateDocument(divorceData = {}) {
    divorceData = { ...divorceData, county: normalizeCountyName(divorceData.county) };
    const validation = this.validateData(divorceData);
    const id = uuidv4();

    // Generate all sections. generateHeader receives the divorce data so
    // jurisdiction templates can name the filer's actual court; base and
    // legacy overrides declare no parameters and simply ignore it.
    //
    // Exactly ONE court identification: when the case caption names the
    // court (it always does in the base and every known override), the
    // generateHeader/generateVenue block is suppressed — that venue opener
    // belongs to a jurat, not the top of a decree, and rendering both
    // doubled the court line (templates/core/captionDedupe.js).
    // Top-of-document prep-tool disclaimer (attorney-review requirement,
    // 2026-08). This is a DRAFT organized by an AI intake tool; every
    // paragraph must be reviewed by the filer before filing, and any
    // "(Draft — ...)" blank in the body requires confirmation.
    const draftBanner = 'DRAFT — This document was prepared with an AI intake tool to help organize your facts. Review every paragraph before filing. Blanks marked with "(Draft — ...)" require your confirmation. This is not legal advice.';
    const caseCaption = this.generateCaseCaption(divorceData);
    const captionCarriesCourt = captionNamesCourt(caseCaption);
    const headerCandidate = caseCaption.structured || captionCarriesCourt
      ? null
      : this.generateHeader(divorceData);
    const venueCandidate = caseCaption.structured || captionCarriesCourt
      ? null
      : this.generateVenue(divorceData.county);
    // Some captions phrase the court differently from caseCaption.courtName
    // (e.g. "IN THE SUPERIOR COURT OF THE STATE OF ARIZONA" over a
    // courtName of "Superior Court of Arizona in X County") — suppress a
    // header/venue line the caption text already contains, too.
    const header = caseCaption.structured
      ? caseCaption.courtHeaderLine
      : lineDuplicatesCaption(headerCandidate, caseCaption)
        ? null
        : headerCandidate;
    const venue = lineDuplicatesCaption(venueCandidate, caseCaption) ? null : venueCandidate;
    // With a structured caption, sections.header carries the court line —
    // strip it from the caption's formatted text so consumers that render
    // header AND formatted (on-screen preview, docx) show the court once
    // (templates/core/captionDedupe.js).
    const caption = caseCaption.structured && header
      ? stripCourtLineFromFormatted(caseCaption, header)
      : caseCaption;
    const title = this.generateTitle();
    const appearances = this.generateAppearancesSection(divorceData);
    const jurisdiction = this.generateJurisdictionSection(divorceData);
    const dissolution = this.generateDissolutionSection(divorceData);
    const propertyDivision = this.generatePropertyDivisionSection(divorceData);
    const debtAllocation = this.generateDebtAllocationSection(divorceData);
    const childCustody = this.generateChildCustodySection(divorceData);
    const childSupport = this.generateChildSupportSection(divorceData);
    const spousalSupport = this.generateSpousalSupportSection(divorceData);
    const nameChange = this.generateNameChangeSection(divorceData);
    const finalOrders = this.generateFinalOrdersSection(divorceData);
    const judgmentBlock = this.generateJudgmentBlock(divorceData);
    const signatureBlock = this.generateSignatureBlock(divorceData);
    const footer = this.generateFooter();

    return {
      id,
      state: this.state,
      documentType: this.documentType,
      timestamp: new Date(),
      // Real display title (used by the filing-packet cover/TOC and file
      // names): document type + jurisdiction, never a generic fallback.
      metadata: {
        documentTitle: `${titleCaseDocumentTitle(this.documentTitle)} — ${this.stateName}`
      },
      sections: {
        draftBanner,
        header,
        venue,
        caseCaption: caption,
        title,
        appearances,
        jurisdiction,
        dissolution,
        propertyDivision,
        debtAllocation,
        childCustody,
        childSupport,
        spousalSupport,
        nameChange,
        finalOrders,
        judgmentBlock,
        signatureBlock,
        footer
      },
      fullText: this.generateFullText({
        draftBanner, header, venue, caseCaption: caption, title, appearances, jurisdiction,
        dissolution, propertyDivision, debtAllocation, childCustody,
        childSupport, spousalSupport, nameChange, finalOrders,
        judgmentBlock, signatureBlock
      }),
      htmlContent: this.generateHTMLContent({
        draftBanner, header, venue, caseCaption: caption, title, appearances, jurisdiction,
        dissolution, propertyDivision, debtAllocation, childCustody,
        childSupport, spousalSupport, nameChange, finalOrders,
        judgmentBlock, signatureBlock
      }),
      validation,
      formatting: this.formatting
    };
  }

  /**
   * Generate document header
   * @returns {string} Header text
   */
  generateHeader() {
    const label = this.terminology.jurisdictionLabel;
    if (!label) return null;
    return `${label} ${this.stateName.toUpperCase()}`;
  }

  /**
   * Generate venue section
   * @param {string} county - County name
   * @returns {string} Venue text
   */
  generateVenue(county) {
    const t = this.terminology;
    if (!t.districtLabel) return null;
    const countyUpper = (county || t.districtPlaceholder).toUpperCase();
    return `${t.districtLabel} ${countyUpper}`;
  }

  /**
   * Generate case caption
   * @param {Object} divorceData - The divorce data
   * @returns {Object} Case caption
   */
  generateCaseCaption(divorceData) {
    let caption = '';

    const courtName = (divorceData.court || this.getDefaultCourt(divorceData.county)).toUpperCase();
    caption += `IN THE ${courtName}\n\n`;

    const caseLabel = this.getCaseNumberLabel();
    const caseNumber = divorceData.caseNumber || '____________________';
    caption += `${caseLabel} ${caseNumber}\n\n`;

    const petitioner = (divorceData.petitionerName || '_________________________________').toUpperCase();
    const respondent = (divorceData.respondentName || '_________________________________').toUpperCase();

    caption += `IN THE MATTER OF THE MARRIAGE OF:\n\n`;
    caption += `${petitioner}, ${this.terminology.filerLabel}\n\n`;
    caption += `AND\n\n`;
    caption += `${respondent}, ${this.terminology.responderLabel}`;

    return {
      courtName,
      caseNumber: divorceData.caseNumber,
      petitioner: divorceData.petitionerName,
      respondent: divorceData.respondentName,
      formatted: caption
    };
  }

  /**
   * Get the case number label for this state
   * @returns {string} Case number label
   */
  getCaseNumberLabel() {
    return 'CASE NO.';
  }

  /**
   * Get the default court name for a county
   * Override in state-specific templates — each state uses its own court name convention
   * (e.g., Texas: District Court; California: Superior Court; New York: Supreme Court)
   * @param {string} county - County name
   * @returns {string} Default court name
   */
  getDefaultCourt(county) {
    return `COURT OF ${(county || '[COUNTY]').toUpperCase()} COUNTY`;
  }

  /**
   * Generate document title
   * @returns {string} Title text
   */
  generateTitle() {
    return this.documentTitle;
  }

  /**
   * Generate appearances section
   * @param {Object} divorceData - The divorce data
   * @returns {Object} Appearances section
   */
  generateAppearancesSection(divorceData) {
    let text = '';

    text += `On this date, the Court considered the above-entitled and numbered cause.\n\n`;

    const selfRepPhrase = this.terminology.selfRepresentedLabel.toLowerCase();
    text += `${this.terminology.filerLabel}, ${divorceData.petitionerName || '_________________________________'}, appeared ${divorceData.petitionerRepresentation === 'attorney' ? 'by and through counsel' : selfRepPhrase}.\n\n`;
    text += `${this.terminology.responderLabel}, ${divorceData.respondentName || '_________________________________'}, ${this.getRespondentAppearanceText(divorceData)}.`;

    return {
      title: 'APPEARANCES',
      text,
      type: 'appearances'
    };
  }

  /**
   * Truthful recital of the respondent's service/appearance status.
   *
   * The stored serviceMethod enum is 'waiver' | 'formal' | 'publication' |
   * 'undecided' ("spouse will accept the papers" maps to 'waiver'). Default
   * is recited ONLY when the data affirmatively says default — never as a
   * fallback for missing data: a decree that falsely recites "wholly made
   * default" against a respondent who acknowledged service and agreed is a
   * defective order.
   *
   * @param {Object} divorceData - The divorce data
   * @returns {string} Recital fragment following "Respondent, <name>, …"
   */
  getRespondentAppearanceText(divorceData) {
    const uncontested = divorceData.appearanceType === 'agreed' || divorceData.isUncontested;
    if (divorceData.respondentAppeared) {
      return uncontested ? 'appeared and announced agreement' : 'appeared';
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
        ? 'accepted service and waived further service of process, and has agreed to the terms of this decree'
        : 'accepted service and waived further service of process';
    }
    if (method === 'publication') {
      return defaulted
        ? 'was served by publication and, having failed to appear or answer, made default'
        : 'was served by publication';
    }
    if (method === 'formal') {
      if (defaulted) {
        return 'although duly cited, did not appear and wholly made default';
      }
      return uncontested
        ? 'was duly served and has agreed to the terms of this decree'
        : 'was duly served';
    }

    // No recognized service data. Recite default only when the data says so;
    // otherwise fall back to the least-assertive historical language.
    if (defaulted) {
      return 'although duly cited, did not appear and wholly made default';
    }
    return uncontested
      ? 'having been duly served, did not appear but signed a Waiver of Citation and Agreement'
      : 'although duly cited, did not appear';
  }

  /**
   * Generate jurisdiction section
   * @param {Object} divorceData - The divorce data
   * @returns {Object} Jurisdiction section
   */
  generateJurisdictionSection(divorceData) {
    // Visible fill-in blank when the date value is missing or not a
    // renderable shape ("a few months ago"). Earlier this template
    // interpolated formatDate's raw-input fallback, which reproduced the
    // freeform narrative verbatim in the decree (v12-B follow-up).
    const marriage = this.formatDate(divorceData.marriageDate) || '__________________';
    const separation = this.formatDate(divorceData.separationDate) || '__________________';
    return {
      title: 'JURISDICTION',
      text: `The Court finds that it has jurisdiction over this case and the parties, and that the jurisdictional prerequisites for this divorce have been satisfied. The parties were married on ${marriage} and ceased to live together as spouses on or about ${separation}.`,
      type: 'jurisdiction'
    };
  }

  /**
   * Format a date for display
   * @param {string} dateStr - Date string
   * @returns {string} Formatted date
   */
  formatDate(dateStr) {
    // See BaseDivorcePetitionTemplate.formatDate — returns null on empty
    // / non-date shapes / NaN so callers can render a visible blank
    // instead of the raw narrative text.
    return sharedFormatDate(dateStr);
  }

  /**
   * Generate dissolution section
   * @param {Object} divorceData - The divorce data
   * @returns {Object} Dissolution section
   */
  generateDissolutionSection(divorceData) {
    return {
      title: 'DIVORCE GRANTED',
      text: `IT IS ORDERED AND DECREED that the marriage between ${divorceData.petitionerName || '_________________________________'} and ${divorceData.respondentName || '_________________________________'} is dissolved, and the parties are divorced.`,
      type: 'dissolution'
    };
  }

  /**
   * Generate property division section
   * @param {Object} divorceData - The divorce data
   * @returns {Object} Property division section
   */
  generatePropertyDivisionSection(divorceData) {
    const items = [];

    // SAFETY GATE (attorney review, 2026-08): "the Court finds there is
    // no ... property" is a DISPOSITIVE nil-finding that extinguishes
    // property claims. Emit ONLY on an affirmative user-confirmed
    // statement — `hasProperty === false` together with a corroborating
    // signal (`noPropertyConfirmed === true` OR a described
    // `propertyAgreement`). Otherwise leave a visible blank + Draft
    // note; a self-rep filer who never discussed property with the
    // intake tool must NOT get a decree that silently waives it.
    const nilPropertyConfirmed =
      divorceData.hasProperty === false &&
      (divorceData.noPropertyConfirmed === true ||
        (typeof divorceData.propertyAgreement === 'string' &&
          divorceData.propertyAgreement.trim() !== ''));
    if (nilPropertyConfirmed) {
      items.push({
        content: 'The Court finds there is no community or marital property to be divided.',
        type: 'finding'
      });
    } else if (divorceData.hasProperty === false) {
      items.push({
        content: '________________________________________\n(Draft — confirm whether you and your spouse have any marital/community property to divide, or a written agreement dividing it, before filing. Silence on this line may be treated as no property, waiving your claim.)',
        type: 'property_draft_note'
      });
    } else {
      items.push({
        content: 'The Court has made a just and right division of the parties\' community/marital property, having due regard for the rights of each party.',
        type: 'finding'
      });

      // Property awarded to Petitioner
      const petitionerPropertyList = asList(divorceData.petitionerProperty);
      if (petitionerPropertyList.length > 0) {
        items.push({
          content: `IT IS ORDERED that the following property is confirmed and awarded to ${divorceData.petitionerName || this.terminology.filerLabel} as that party's sole and separate property:`,
          type: 'order'
        });
        petitionerPropertyList.forEach(prop => {
          items.push({
            content: `- ${prop}`,
            type: 'property_item'
          });
        });
      }

      // Property awarded to Respondent
      const respondentPropertyList = asList(divorceData.respondentProperty);
      if (respondentPropertyList.length > 0) {
        items.push({
          content: `IT IS ORDERED that the following property is confirmed and awarded to ${divorceData.respondentName || this.terminology.responderLabel} as that party's sole and separate property:`,
          type: 'order'
        });
        respondentPropertyList.forEach(prop => {
          items.push({
            content: `- ${prop}`,
            type: 'property_item'
          });
        });
      }

      // Default language if no specific property listed
      if (!divorceData.petitionerProperty && !divorceData.respondentProperty) {
        items.push({
          content: 'IT IS ORDERED that each party is awarded the personal property currently in that party\'s possession as that party\'s sole and separate property.',
          type: 'order'
        });
      }
    }

    return {
      title: 'DIVISION OF PROPERTY',
      items,
      type: 'property'
    };
  }

  /**
   * Generate debt allocation section
   * @param {Object} divorceData - The divorce data
   * @returns {Object} Debt allocation section
   */
  generateDebtAllocationSection(divorceData) {
    const items = [];

    // SAFETY GATE (attorney review, 2026-08): "no community debts" is a
    // dispositive nil-finding — a debt not allocated in a final decree
    // may become the exclusive obligation of the party who signed for
    // it, WITHOUT the indemnity protection the debt-allocation clause
    // provides. Emit ONLY on an affirmative user-confirmed statement.
    const nilDebtsConfirmed =
      divorceData.hasDebts === false &&
      (divorceData.noDebtsConfirmed === true ||
        (typeof divorceData.debtAgreement === 'string' &&
          divorceData.debtAgreement.trim() !== ''));
    if (nilDebtsConfirmed) {
      items.push({
        content: 'The Court finds there are no community debts to be allocated.',
        type: 'finding'
      });
    } else if (divorceData.hasDebts === false) {
      items.push({
        content: '________________________________________\n(Draft — confirm whether you and your spouse have any marital/community debts to allocate, or a written agreement dividing them, before filing. Silence on this line may leave you solely responsible for any unallocated debt.)',
        type: 'debts_draft_note'
      });
    } else {
      items.push({
        content: 'IT IS ORDERED that each party shall be responsible for any debts incurred solely by that party.',
        type: 'order'
      });

      // "Separate debt: " prefixed items are pre-marital or otherwise
      // non-marital debts the extraction layer flagged (see
      // services/agents/extractionQuality.js). They are confirmed to the
      // party who holds them, never allocated as community debt.
      const petParts = partitionByCharacter(divorceData.petitionerDebts, 'debt');
      const respParts = partitionByCharacter(divorceData.respondentDebts, 'debt');
      const petitionerName = divorceData.petitionerName || this.terminology.filerLabel;
      const respondentName = divorceData.respondentName || this.terminology.responderLabel;

      if (petParts.community.length > 0) {
        items.push({
          content: `IT IS ORDERED that ${petitionerName} shall pay and be responsible for the following debts:`,
          type: 'order'
        });
        petParts.community.forEach(debt => {
          items.push({
            content: `- ${debt}`,
            type: 'debt_item'
          });
        });
      }

      if (respParts.community.length > 0) {
        items.push({
          content: `IT IS ORDERED that ${respondentName} shall pay and be responsible for the following debts:`,
          type: 'order'
        });
        respParts.community.forEach(debt => {
          items.push({
            content: `- ${debt}`,
            type: 'debt_item'
          });
        });
      }

      const hasSeparateDebt = petParts.separate.length + respParts.separate.length > 0;
      if (hasSeparateDebt) {
        items.push({
          content: 'IT IS ORDERED that the following debts are confirmed as the separate obligations of the party who incurred them, and no order of allocation is made as to them:',
          type: 'order'
        });
        petParts.separate.forEach(debt => {
          items.push({
            content: `- ${petitionerName}'s separate debt: ${debt}`,
            type: 'debt_item'
          });
        });
        respParts.separate.forEach(debt => {
          items.push({
            content: `- ${respondentName}'s separate debt: ${debt}`,
            type: 'debt_item'
          });
        });
      }

      items.push({
        content: 'IT IS ORDERED that each party shall indemnify and hold the other party harmless from any failure to pay the debts ordered to be paid by that party.',
        type: 'order'
      });
    }

    return {
      title: 'ALLOCATION OF DEBTS',
      items,
      type: 'debts'
    };
  }

  /**
   * Generate child custody section
   * @param {Object} divorceData - The divorce data
   * @returns {Object|null} Child custody section or null if no children
   */
  generateChildCustodySection(divorceData) {
    if (divorceData.hasMinorChildren === false || !divorceData.children || divorceData.children.length === 0) {
      return null;
    }

    const items = [];

    items.push({
      content: 'The Court finds that the following orders are in the best interest of the child(ren):',
      type: 'finding'
    });

    // List children
    items.push({
      content: 'The child(ren) subject to this order:',
      type: 'order'
    });

    divorceData.children.forEach((child, index) => {
      const childInfo = typeof child === 'string'
        ? child
        : `${child.name || '______________________'}, born ${this.formatDate(child.birthDate ?? child.dob ?? child.dateOfBirth) || '______________'}`;
      items.push({
        content: `${index + 1}. ${childInfo}`,
        type: 'child_item'
      });
    });

    // Custody arrangement
    // Generic language applicable across jurisdictions.
    // State subclasses should override this method to use jurisdiction-specific
    // terminology (e.g., Texas uses "Joint Managing Conservator"/"Possessory Conservator";
    // Arizona uses "legal decision-making authority"; Illinois uses "parental responsibilities").
    //
    // Safety rule: only positively recognized custody values render a joint
    // or sole order. Anything ambiguous ("joint decision making" maps to
    // joint; unrecognized free text does NOT map to sole) renders neutral
    // as-agreed language — a wrong-but-plausible sole order is worse than a
    // placeholder (see templates/core/parenting.js).
    const custody = resolveCustodyArrangement(divorceData);
    const residenceName = resolvePrimaryResidenceName(divorceData);
    const t = this.terminology;
    let soleCustodianName = null;

    if (custody.kind === 'joint') {
      items.push({
        content: `IT IS ORDERED that ${divorceData.petitionerName || t.filerLabel} and ${divorceData.respondentName || t.responderLabel} are awarded joint legal custody of the minor child(ren).`,
        type: 'order'
      });
    } else if (custody.kind === 'sole_petitioner' || custody.kind === 'sole_respondent' || custody.kind === 'legacy_sole') {
      const custodianName =
        custody.kind === 'sole_petitioner'
          ? (divorceData.petitionerName || t.filerLabel)
          : custody.kind === 'sole_respondent'
            ? (divorceData.respondentName || t.responderLabel)
            : (resolvePrimaryResidenceName(divorceData) || divorceData.petitionerName || t.filerLabel);
      // Parent-time belongs to the NON-residential parent. For the explicit
      // enums that is the other party by definition; for legacy 'sole' the
      // custodian came from primaryCustodian, so derive the other parent
      // from the residence role rather than assuming the respondent.
      const otherParentName =
        custody.kind === 'sole_respondent'
          ? (divorceData.petitionerName || t.filerLabel)
          : custody.kind === 'sole_petitioner'
            ? (divorceData.respondentName || t.responderLabel)
            : (resolveNonResidentialParentName(divorceData) ||
               divorceData.respondentName || t.responderLabel);
      soleCustodianName = custodianName;

      items.push({
        content: `IT IS ORDERED that ${custodianName} is awarded sole legal and physical custody of the minor child(ren).`,
        type: 'order'
      });

      items.push({
        content: `IT IS ORDERED that ${otherParentName} shall have reasonable visitation/parenting time with the minor child(ren) as agreed by the parties or as ordered by the Court.`,
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
    // child(ren) live, regardless of the decision-making branch. The joint
    // branch keeps its historical filer fallback for byte-compatibility.
    if (custody.kind === 'joint') {
      items.push({
        content: `IT IS ORDERED that ${residenceName || divorceData.petitionerName || t.filerLabel} shall have primary physical custody and the right to designate the primary residence of the child(ren).`,
        type: 'order'
      });
    } else if (residenceName && residenceName !== soleCustodianName) {
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
   * Get visitation language
   * Override in state-specific templates
   * @param {Object} divorceData - The divorce data
   * @returns {string} Visitation language
   */
  getVisitationLanguage(divorceData) {
    // A substantive parentTimeDetails string from extraction (alt weekends,
    // holiday rotations, mid-week dinners) belongs in the order verbatim —
    // the boilerplate "as mutually agreed" clause dropped it entirely
    // (live Ontario audit, 2026-08). Extraction already phrases the value
    // in neutral third-person court language; render it as-is with a
    // fallback clause so an unenforceable agreement never leaves the
    // parties without a default.
    const details = typeof divorceData.parentTimeDetails === 'string'
      ? divorceData.parentTimeDetails.trim()
      : '';
    if (details.length > 50) {
      return `IT IS ORDERED that the parties shall have parenting time with the child(ren) on the following schedule: ${details} In the absence of agreement to vary the schedule, the terms above control.`;
    }
    return `IT IS ORDERED that the parties shall have possession of and access to the child(ren) at times mutually agreed to by the parties. In the absence of agreement, the standard possession order of this state shall apply.`;
  }

  /**
   * Generate child support section
   * @param {Object} divorceData - The divorce data
   * @returns {Object|null} Child support section or null if no children
   */
  generateChildSupportSection(divorceData) {
    if (divorceData.hasMinorChildren === false || !divorceData.children || divorceData.children.length === 0) {
      return null;
    }

    const items = [];

    if (divorceData.childSupportAmount) {
      items.push({
        content: `IT IS ORDERED that ${divorceData.childSupportObligor || divorceData.respondentName || this.terminology.responderLabel} shall pay child support to ${divorceData.childSupportObligee || divorceData.petitionerName || this.terminology.filerLabel} in the amount of $${divorceData.childSupportAmount} per month.`,
        type: 'order'
      });

      items.push({
        content: 'IT IS ORDERED that child support shall be paid through income withholding as provided by law.',
        type: 'order'
      });
    } else {
      items.push({
        content: 'IT IS ORDERED that child support shall be paid in accordance with the child support guidelines of this state.',
        type: 'order'
      });
    }

    // Health insurance
    items.push({
      content: `IT IS ORDERED that ${divorceData.healthInsuranceProvider || 'the obligor'} shall maintain health insurance for the minor child(ren) if such insurance is available at a reasonable cost.`,
      type: 'order'
    });

    return {
      title: 'CHILD SUPPORT',
      items,
      type: 'child_support'
    };
  }

  /**
   * Generate spousal support section
   * @param {Object} divorceData - The divorce data
   * @returns {Object|null} Spousal support section or null if not applicable
   */
  generateSpousalSupportSection(divorceData) {
    // Precedence (see templates/core/spousalSupport.js): a request-and-amount
    // pair renders the AWARD even when spousalSupportAwarded is not set —
    // a contested $1,800/mo request must NEVER render as a mutual waiver
    // (live Ontario audit, 2026-08). A bare request with no amount pleads
    // an honest reservation of jurisdiction rather than a false waiver.
    const decision = resolveSpousalSupportDecision(divorceData);
    if (decision.outcome === 'none') return null;

    const items = [];
    const t = this.terminology;
    const payor = decision.payor || t.responderLabel;
    const payee = decision.payee || t.filerLabel;

    if (decision.outcome === 'award') {
      items.push({
        content: `IT IS ORDERED that ${payor} shall pay spousal maintenance to ${payee} in the amount of $${decision.amount || '[AMOUNT]'} per month for a period of ${decision.duration || '[DURATION]'}.`,
        type: 'order'
      });
    } else if (decision.outcome === 'reserve') {
      items.push({
        content: `IT IS ORDERED that the Court reserves jurisdiction over spousal maintenance/alimony, ${payee} having requested support with no specific amount yet on file; the amount and duration shall be set by the Court.`,
        type: 'order'
      });
    } else if (decision.outcome === 'waive') {
      items.push({
        content: 'IT IS ORDERED that each party waives and relinquishes any claim for spousal maintenance/alimony from the other party, now and forever.',
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
   * Generate name change section
   * @param {Object} divorceData - The divorce data
   * @returns {Object|null} Name change section or null if not requested
   */
  generateNameChangeSection(divorceData) {
    if (!divorceData.requestNameChange || !divorceData.previousName) {
      return null;
    }

    return {
      title: 'NAME CHANGE',
      text: `IT IS ORDERED that the name of ${divorceData.nameChangeParty || divorceData.petitionerName || this.terminology.filerLabel} is changed to ${divorceData.previousName}.`,
      type: 'name_change'
    };
  }

  /**
   * Generate final orders section
   * @param {Object} divorceData - The divorce data
   * @returns {Object} Final orders section
   */
  generateFinalOrdersSection(divorceData) {
    const items = [];

    items.push({
      content: 'IT IS ORDERED that all relief requested in this case and not expressly granted is denied.',
      type: 'order'
    });

    items.push({
      content: 'IT IS ORDERED that this decree is a final judgment and disposes of all parties and all claims in this case.',
      type: 'order'
    });

    items.push({
      content: 'IT IS ORDERED that each party shall execute and deliver any documents necessary to effectuate the terms of this decree.',
      type: 'order'
    });

    return {
      title: 'FINAL ORDERS',
      items,
      type: 'final_orders'
    };
  }

  /**
   * Generate judgment block (for judge signature)
   * @param {Object} divorceData - The divorce data
   * @returns {Object} Judgment block
   */
  generateJudgmentBlock(divorceData) {
    return {
      text: `SIGNED on _____________________, 20___.\n\n\n_________________________________\nJUDGE PRESIDING`,
      type: 'judgment'
    };
  }

  /**
   * Generate signature block (for parties if agreed)
   * @param {Object} divorceData - The divorce data
   * @returns {Object} Signature block
   */
  generateSignatureBlock(divorceData) {
    if (divorceData.isUncontested || divorceData.appearanceType === 'agreed') {
      return {
        title: 'APPROVED AS TO FORM AND SUBSTANCE:',
        blocks: [
          {
            line: '_________________________________',
            name: divorceData.petitionerName || '_________________________________',
            title: this.terminology.filerLabel
          },
          {
            line: '_________________________________',
            name: divorceData.respondentName || '_________________________________',
            title: this.terminology.responderLabel
          }
        ],
        type: 'party_signatures'
      };
    }

    return null;
  }

  /**
   * Generate footer
   * @returns {Object} Footer
   */
  generateFooter() {
    return {
      disclaimer: 'This document was generated for informational purposes only and does not constitute legal advice.',
      timestamp: new Date().toISOString(),
      version: '1.0',
      documentType: this.documentType
    };
  }

  /**
   * Generate full text representation
   * @param {Object} sections - All document sections
   * @returns {string} Complete document as plain text
   */
  generateFullText(sections) {
    let text = '';

    // Prep-tool disclaimer above every other section.
    if (sections.draftBanner) {
      text += sections.draftBanner + '\n\n';
    }

    // With a structured caption, sections.header keeps the court line for
    // the PDF layer's caption layout — skip it here when the caption's
    // formatted text already carries it, so the court renders once.
    const headerDupe = lineDuplicatesCaption(sections.header, sections.caseCaption);
    const venueDupe = lineDuplicatesCaption(sections.venue, sections.caseCaption);
    if (sections.header && !headerDupe) text += sections.header + '\n';
    if (sections.venue && !venueDupe) text += sections.venue + '\n\n';
    if (sections.caseCaption?.formatted) text += sections.caseCaption.formatted + '\n\n';
    if (sections.title) text += sections.title + '\n\n';

    // Render text sections
    const textSections = ['appearances', 'jurisdiction', 'dissolution'];
    textSections.forEach(key => {
      const section = sections[key];
      if (section?.title) {
        text += `${section.title}\n\n`;
        text += `${section.text}\n\n`;
      }
    });

    // Render item sections
    const itemSections = ['propertyDivision', 'debtAllocation', 'childCustody', 'childSupport', 'spousalSupport', 'finalOrders'];
    itemSections.forEach(key => {
      const section = sections[key];
      if (section?.title) {
        text += `${section.title}\n\n`;
        if (section.items) {
          section.items.forEach(item => {
            text += `${item.content}\n\n`;
          });
        }
      }
    });

    // Name change
    if (sections.nameChange?.title) {
      text += `${sections.nameChange.title}\n\n`;
      text += `${sections.nameChange.text}\n\n`;
    }

    // Judgment block
    if (sections.judgmentBlock?.text) {
      text += `\n${sections.judgmentBlock.text}\n\n`;
    }

    // Party signatures
    if (sections.signatureBlock?.title) {
      text += `\n${sections.signatureBlock.title}\n\n`;
      sections.signatureBlock.blocks.forEach(block => {
        text += `${block.line}\n${block.name}\n${block.title}\n\n`;
      });
    }

    return text;
  }

  /**
   * Generate HTML representation
   * @param {Object} sections - All document sections
   * @returns {string} Complete document as HTML
   */
  generateHTMLContent(sections) {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Final Decree of Divorce - ${escapeHtml(this.stateName)}</title>
  <style>
    body {
      font-family: 'Times New Roman', serif;
      font-size: 12pt;
      line-height: 2;
      margin: 1in;
      color: #000;
      background: white;
    }
    .header { text-align: center; font-weight: bold; margin-bottom: 10px; }
    .venue { text-align: center; font-weight: bold; margin-bottom: 20px; }
    .case-caption { text-align: center; margin-bottom: 20px; white-space: pre-line; }
    .title { text-align: center; font-weight: bold; text-decoration: underline; margin: 20px 0; }
    .section-title { font-weight: bold; text-decoration: underline; margin: 20px 0 10px 0; }
    .paragraph { margin-bottom: 15px; text-align: justify; }
    .order { margin-bottom: 15px; text-align: justify; text-indent: 0.5in; }
    .item { margin-left: 0.5in; margin-bottom: 5px; }
    .signature-block { margin-top: 40px; white-space: pre-line; }
    .judge-block { margin-top: 40px; text-align: center; }
    @media print { body { margin: 0; padding: 1in; } }
  </style>
</head>
<body>
  ${sections.draftBanner ? `<div class="draft-banner" style="border:1px solid #b45309;background:#fff7ed;padding:10px 14px;margin:0 0 20px 0;font-size:10pt;line-height:1.4;color:#7c2d12;"><strong>DRAFT</strong> — ${escapeHtml(sections.draftBanner.replace(/^DRAFT — /, ''))}</div>` : ''}
  ${sections.header && !lineDuplicatesCaption(sections.header, sections.caseCaption) ? `<div class="header">${escapeHtml(sections.header)}</div>` : ''}
  ${sections.venue && !lineDuplicatesCaption(sections.venue, sections.caseCaption) ? `<div class="venue">${escapeHtml(sections.venue)}</div>` : ''}
  ${sections.caseCaption?.formatted ? `<div class="case-caption">${escapeHtml(sections.caseCaption.formatted)}</div>` : ''}
  ${sections.title ? `<div class="title">${escapeHtml(sections.title)}</div>` : ''}

  ${this.renderTextSectionHTML(sections.appearances)}
  ${this.renderTextSectionHTML(sections.jurisdiction)}
  ${this.renderTextSectionHTML(sections.dissolution)}
  ${this.renderItemSectionHTML(sections.propertyDivision)}
  ${this.renderItemSectionHTML(sections.debtAllocation)}
  ${this.renderItemSectionHTML(sections.childCustody)}
  ${this.renderItemSectionHTML(sections.childSupport)}
  ${this.renderItemSectionHTML(sections.spousalSupport)}
  ${this.renderTextSectionHTML(sections.nameChange)}
  ${this.renderItemSectionHTML(sections.finalOrders)}

  ${sections.judgmentBlock?.text ? `<div class="judge-block"><pre>${escapeHtml(sections.judgmentBlock.text)}</pre></div>` : ''}

  ${sections.signatureBlock ? this.renderPartySignaturesHTML(sections.signatureBlock) : ''}
</body>
</html>`;
  }

  /**
   * Render text section as HTML
   * @param {Object} section - Section to render
   * @returns {string} HTML string
   */
  renderTextSectionHTML(section) {
    if (!section) return '';
    return `
      <div class="section-title">${escapeHtml(section.title)}</div>
      <p class="paragraph">${escapeHtml(section.text)}</p>
    `;
  }

  /**
   * Render item section as HTML
   * @param {Object} section - Section to render
   * @returns {string} HTML string
   */
  renderItemSectionHTML(section) {
    if (!section) return '';
    let html = `<div class="section-title">${escapeHtml(section.title)}</div>`;
    section.items.forEach(item => {
      const className = item.type.includes('item') ? 'item' : 'order';
      html += `<p class="${className}">${escapeHtml(item.content)}</p>`;
    });
    return html;
  }

  /**
   * Render party signatures as HTML
   * @param {Object} section - Signature section
   * @returns {string} HTML string
   */
  renderPartySignaturesHTML(section) {
    let html = `<div class="signature-block"><p><strong>${escapeHtml(section.title)}</strong></p>`;
    section.blocks.forEach(block => {
      html += `<p>${escapeHtml(block.line)}<br>${escapeHtml(block.name)}<br>${escapeHtml(block.title)}</p>`;
    });
    html += '</div>';
    return html;
  }

  /**
   * Perform state-specific validation
   * @param {Object} divorceData - The divorce data
   * @returns {Object} Validation result
   */
  performStateSpecificValidation(divorceData) {
    return { errors: [], warnings: [] };
  }
}

module.exports = BaseDivorceDecreeTemplate;
