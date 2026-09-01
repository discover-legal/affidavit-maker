// templates/core/BaseDivorcePetitionTemplate.js
// Base template class for divorce petition/complaint generation
// Provides common functionality across all states

// Use Node's built-in crypto.randomUUID (v4 UUID) instead of the `uuid`
// npm package. These templates are loaded at runtime via Node's
// createRequire (see templates/core/TemplateLoader.js), which resolves
// against the on-disk node_modules. Webpack inlines `uuid` into its own
// bundle, so the standalone tracer never copies node_modules/uuid into
// .next/standalone, and `require('uuid')` here throws "Cannot find module"
// in the production container — which silently dropped every divorce
// template from the registry. `node:crypto` is a built-in and always
// resolvable, so the divorce templates load and register reliably.
const { randomUUID: uuidv4 } = require('node:crypto');
const { DEFAULT_TERMS, districtPhrase } = require('./terminology');
const { resolveCustodyArrangement, resolvePrimaryResidenceName } = require('./parenting');
const { asList, propertyAgreementProse, PROPERTY_AGREEMENT_STATUS_TOKENS } = require('./dataShapes');
const { yearOnlyOf } = require('./canadianHelpers');

// Round-3 attorney review (2026-08-30): live personas (Mari TX, David NY)
// arrived with `hasProperty`/`hasDebts` UNSET but a facts[] array that
// explicitly said "no property, no house, no retirement" / "no debts".
// The petition still fabricated a community-property allegation.
// Fix: extend the property/debt guards to promote from facts[] via a
// deterministic keyword intersection over model-classified metadata. No
// free-text prose parsing beyond a small closed keyword list — same
// LLM-first discipline as the whereabouts/grounds promotions in
// lib/api/profile.ts.
const NO_PROPERTY_KEYWORDS = [
  'no property', 'no house', 'no assets', 'no real estate',
  'no retirement', 'no home', 'no marital property',
  'no community property', 'no family property',
];
const NO_DEBTS_KEYWORDS = [
  'no debts', 'no debt', 'no liabilities', 'no marital debt',
  'no community debt', 'no family debt',
];
const PROPERTY_CATEGORY_TOKENS = ['property', 'assets', 'finances', 'financial'];
const DEBT_CATEGORY_TOKENS = ['debt', 'debts', 'liabilities'];

function _factSearchBlob(fact) {
  if (!fact || typeof fact !== 'object') return '';
  const parts = [
    fact.content, fact.text, fact.value,
    fact.sourceQuote, fact.source_quote,
    fact.subcategory, fact.category,
  ];
  return parts.filter(Boolean).map(String).join(' ').toLowerCase();
}
function _factsIndicateNo(divorceData, keywordList, categoryTokens) {
  const facts = Array.isArray(divorceData && divorceData.facts) ? divorceData.facts : [];
  for (const f of facts) {
    if (!f || typeof f !== 'object') continue;
    const blob = _factSearchBlob(f);
    if (!blob) continue;
    // A property/debt-adjacent fact whose content OR sourceQuote hits any
    // negation keyword counts; OR any fact whose category/subcategory names
    // property/debt topic AND the negation keyword appears.
    const hitsKeyword = keywordList.some((k) => blob.includes(k));
    if (!hitsKeyword) continue;
    const cat = String(f.category || '').toLowerCase();
    const sub = String(f.subcategory || '').toLowerCase();
    const categoryHit = categoryTokens.some((t) => cat.includes(t) || sub.includes(t));
    // Direct phrase like "no property" is dispositive even in a marriage-tagged
    // fact — the user said it. Category match confirms the phrase is about
    // the property/debt topic and not e.g. "no property was destroyed".
    if (hitsKeyword && (categoryHit || keywordList.some((k) => blob.includes(k)))) {
      return true;
    }
  }
  return false;
}
const { captionNamesCourt, lineDuplicatesCaption, stripCourtLineFromFormatted } = require('./captionDedupe');
const { isRenderableDate, formatDate: sharedFormatDate, formatBirthDisplay } = require('./dateUtils');

/**
 * Title-case an all-caps document title ("PETITION FOR DIVORCE" →
 * "Petition for Divorce") for cover sheets / packet metadata.
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
 * Keep county labels stable whether callers provide "Salt Lake" or
 * "Salt Lake County". Catalogs and conversational extraction use both
 * shapes, while the legal templates add the jurisdictional "County" label.
 */
const normalizeCountyName = (county, fallback = '[COUNTY]') =>
  String(county || fallback).replace(/\s+county$/i, '').trim();

/**
 * Round-5 attorney review (Tavita FL, 2026-08-30): the LLM extraction
 * layer occasionally lands the literal string "null" / "undefined" /
 * "N/A" in a slot the caller expected to be empty (see Tavita profile:
 * `county: "null"`). Rendering "Case No.: null" is worse than an
 * unfilled blank — treat these sentinels as absent.
 */
function _sanitizeCaseNumber(value) {
  if (value == null) return '';
  const s = String(value).trim();
  if (!s) return '';
  const lower = s.toLowerCase();
  if (lower === 'null' || lower === 'undefined' || lower === 'n/a' || lower === 'none') return '';
  // Round-6 attorney review (Tavita FL, 2026-08-30 v29): tolerate stray
  // punctuation-only values ("." or "..") that LLM extraction leaves when
  // the case number is absent — rendering "Case No. ." is worse than a
  // fill-in blank. Any value that contains no alphanumeric character is
  // treated as absent.
  if (!/[A-Za-z0-9]/.test(s)) return '';
  return s;
}

/**
 * Base template class for divorce petition generation
 * Provides common functionality across all states
 *
 * @class BaseDivorcePetitionTemplate
 * @description Abstract base class that defines the common interface and functionality
 * for all state-specific divorce petition templates. State templates should extend this class
 * and override state-specific methods as needed.
 *
 * A Divorce Petition (also called Complaint in some states) is the document that
 * initiates divorce proceedings. It includes:
 * - Identification of parties
 * - Grounds for divorce
 * - Requests for relief (property division, custody, support, etc.)
 * - Jurisdictional statements
 */
class BaseDivorcePetitionTemplate {
  constructor() {
    this.state = null;
    this.stateName = null;
    this.documentType = 'petition';
    this.documentTitle = 'PETITION FOR DIVORCE';

    // Jurisdiction-aware terminology. Defaults reproduce the historical US
    // wording byte-for-byte; non-US templates opt in by merging overrides
    // (see templates/core/terminology.js for the field reference).
    this.terminology = { ...DEFAULT_TERMS };

    // Required fields for a valid petition
    this.requiredFields = [
      'petitionerName',
      'respondentName',
      'state',
      'county',
      'marriageDate',
      'groundsForDivorce'
    ];

    // Sections that make up a divorce petition
    this.sections = {
      header: true,
      venue: true,
      caseCaption: true,
      title: true,
      parties: true,
      jurisdiction: true,
      marriageInformation: true,
      groundsForDivorce: true,
      childrenInformation: true,
      propertyInformation: true,
      reliefRequested: true,
      verification: true,
      signatureBlock: true,
      certificateOfService: false
    };

    // Standard formatting for court documents
    this.formatting = {
      fontSize: '12pt',
      fontFamily: 'Times New Roman',
      lineHeight: '2',
      margin: '1in'
    };

    // Residency requirements (override in state-specific)
    this.residencyRequirements = {
      stateMonths: 6,
      countyDays: 90,
      description: ''
    };

    // Waiting period after filing (override in state-specific)
    this.waitingPeriod = {
      days: 60,
      exceptions: [],
      description: ''
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
      formatting: this.formatting,
      residencyRequirements: this.residencyRequirements,
      waitingPeriod: this.waitingPeriod
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
   * Validate petition data against template requirements
   *
   * @param {Object} divorceData - The divorce petition data to validate
   * @returns {Object} Validation result with isValid, errors, and warnings
   */
  validateData(divorceData) {
    const errors = [];
    const warnings = [];

    const t = this.terminology;

    // Check required fields
    if (!divorceData.petitionerName || divorceData.petitionerName.trim().length < 2) {
      errors.push(`${t.filerLabel} name is required and must be at least 2 characters`);
    }

    if (!divorceData.respondentName || divorceData.respondentName.trim().length < 2) {
      errors.push(`${t.responderLabel} name is required and must be at least 2 characters`);
    }

    if (!divorceData.state) {
      errors.push('State is required');
    }

    if (!divorceData.county || divorceData.county.trim().length === 0) {
      errors.push(`${t.districtTerm} is required for ${this.stateName} divorce petitions`);
    }

    if (!divorceData.marriageDate) {
      errors.push('Date of marriage is required');
    }

    if (!divorceData.groundsForDivorce) {
      errors.push('Grounds for divorce must be specified');
    }

    // Validate date format if provided
    if (divorceData.marriageDate && !this.isValidDate(divorceData.marriageDate)) {
      errors.push('Invalid marriage date format');
    }

    if (divorceData.separationDate && !this.isValidDate(divorceData.separationDate)) {
      errors.push('Invalid separation date format');
    }

    // Check children information if applicable
    if (divorceData.hasMinorChildren === true) {
      if (!divorceData.children || divorceData.children.length === 0) {
        errors.push('Children information is required when there are minor children');
      }
    }

    // Warnings for recommended but not required fields
    if (!divorceData.separationDate) {
      warnings.push('Date of separation is recommended');
    }

    if (!divorceData.petitionerAddress) {
      warnings.push(`${t.filerLabel} address is recommended for service of process`);
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
   * Check if a date string is valid
   * @param {string} dateStr - Date string to validate
   * @returns {boolean} Whether the date is valid
   */
  isValidDate(dateStr) {
    if (!dateStr) return false;
    const date = new Date(dateStr);
    return date instanceof Date && !isNaN(date);
  }

  /**
   * Generate complete divorce petition document
   *
   * @param {Object} divorceData - The divorce data
   * @returns {Object} Complete document with sections, validation, and metadata
   */
  generateDocument(divorceData = {}) {
    // Normalize once at entry so no downstream "${county} County" composition
    // can double the word. Preserve absence — the '[COUNTY]' default here
    // would leak a token into validation and captions.
    if (divorceData.county) {
      divorceData = { ...divorceData, county: normalizeCountyName(divorceData.county, '') };
    }
    const validation = this.validateData(divorceData);
    const id = uuidv4();

    // Generate all sections, threading paragraph numbers between them.
    // With a structured caption, the page opens with the filer block and the
    // court-name line; the old STATE OF X / COUNTY OF Y venue opener belongs
    // to the verification jurat, not the top of a petition.
    // Top-of-document prep-tool disclaimer (attorney-review requirement,
    // 2026-08). This is a DRAFT organized by an AI intake tool; every
    // paragraph must be reviewed by the filer before filing, and any
    // "(Draft — ...)" blank in the body requires confirmation.
    const draftBanner = 'DRAFT — This document was prepared with an AI intake tool to help organize your facts. Review every paragraph before filing. Blanks marked with "(Draft — ...)" require your confirmation. This is not legal advice.';
    const caseCaption = this.generateCaseCaption(divorceData);
    const filerBlock = this.generateFilerBlock(divorceData);
    // Exactly ONE court identification: subclasses whose captions are not
    // structured still name the court in the caption's formatted text, so
    // the header/venue block would double the court line — suppress it
    // whenever the caption carries the court (templates/core/captionDedupe.js).
    const captionCarriesCourt = captionNamesCourt(caseCaption);
    const headerCandidate = caseCaption.structured || captionCarriesCourt
      ? null
      : this.generateHeader();
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
    const parties = this.generatePartiesSection(divorceData);
    divorceData._paragraphNum = parties.nextParagraphNumber;
    const jurisdiction = this.generateJurisdictionSection(divorceData);
    divorceData._paragraphNum = jurisdiction.nextParagraphNumber;
    const marriageInfo = this.generateMarriageInformationSection(divorceData);
    divorceData._paragraphNum = marriageInfo.nextParagraphNumber;
    const grounds = this.generateGroundsSection(divorceData);
    divorceData._paragraphNum = grounds.nextParagraphNumber;
    const childrenInfo = this.generateChildrenSection(divorceData);
    divorceData._paragraphNum = childrenInfo.nextParagraphNumber;
    const propertyInfo = this.generatePropertySection(divorceData);
    divorceData._paragraphNum = propertyInfo.nextParagraphNumber;
    const reliefRequested = this.generateReliefSection(divorceData);
    const verification = this.generateVerificationSection(divorceData);
    const signatureBlock = this.generateSignatureBlock(divorceData.petitionerName);
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
        filerBlock,
        header,
        venue,
        caseCaption: caption,
        title,
        parties,
        jurisdiction,
        marriageInfo,
        grounds,
        childrenInfo,
        propertyInfo,
        reliefRequested,
        verification,
        signatureBlock,
        footer
      },
      fullText: this.generateFullText({
        draftBanner, header, venue, caseCaption: caption, title, parties, jurisdiction,
        marriageInfo, grounds, childrenInfo, propertyInfo,
        reliefRequested, verification, signatureBlock
      }),
      htmlContent: this.generateHTMLContent({
        draftBanner, header, venue, caseCaption: caption, title, parties, jurisdiction,
        marriageInfo, grounds, childrenInfo, propertyInfo,
        reliefRequested, verification, signatureBlock
      }),
      validation,
      formatting: this.formatting
    };
  }

  /**
   * Generate document header
   * Override in state-specific templates for custom formatting.
   * Returns null (line omitted) when terminology.jurisdictionLabel is null —
   * e.g. Canadian jurisdictions, whose caption is the court-name line.
   *
   * @returns {string|null} Header text
   */
  generateHeader() {
    const label = this.terminology.jurisdictionLabel;
    if (!label) return null;
    return `${label} ${this.stateName.toUpperCase()}`;
  }

  /**
   * Generate venue section
   * Override in state-specific templates for custom formatting.
   * Returns null (line omitted) when terminology.districtLabel is null.
   *
   * @param {string} county - County name
   * @returns {string|null} Venue text
   */
  generateVenue(county) {
    const t = this.terminology;
    if (!t.districtLabel) return null;
    const countyUpper = (county || t.districtPlaceholder).toUpperCase();
    return `${t.districtLabel} ${countyUpper}`;
  }

  /**
   * Phrase body text uses to name the sub-jurisdiction, per
   * terminology.districtStyle: "Travis County" (US default),
   * "the Judicial District of Montreal", or plain "Toronto".
   *
   * @param {string} county - District name from the case data
   * @returns {string} District phrase (placeholder when county missing)
   */
  districtPhrase(county) {
    return districtPhrase(this.terminology, normalizeCountyName(county, ''));
  }

  /**
   * Generate case caption for divorce petition
   * Override in state-specific templates if needed
   *
   * @param {Object} divorceData - The divorce data
   * @returns {Object} Case caption with formatted text
   */
  generateCaseCaption(divorceData) {
    let caption = '';

    // Court name
    const courtName = (divorceData.court || this.getDefaultCourt(divorceData.county) || '______________________ COURT').toUpperCase();
    caption += `IN THE ${courtName}\n\n`;

    // Case number — reject literal "null"/"undefined" sentinels.
    const caseLabel = this.getCaseNumberLabel();
    const caseNumberClean = _sanitizeCaseNumber(divorceData.caseNumber);
    const caseNumber = caseNumberClean || '____________________';
    caption += `${caseLabel} ${caseNumber}\n\n`;

    // Party names in family law format
    const petitioner = (divorceData.petitionerName || '_________________________________').toUpperCase();
    const respondent = (divorceData.respondentName || '_________________________________').toUpperCase();

    const t = this.terminology;
    caption += `IN THE MATTER OF THE MARRIAGE OF:\n\n`;
    caption += `${petitioner}, ${t.filerLabel}\n\n`;
    caption += `AND\n\n`;
    caption += `${respondent}, ${t.responderLabel}`;

    // Structured caption: the PDF layer lays this out as the conventional
    // two-column caption block (parties left; case number and judge right)
    // with the court name as the page header. Blanks, never [TOKENS] — a
    // filed document is completed by hand, not by placeholder.
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
        `${caseLabel} ${caseNumberClean || '_______________'}`,
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
      structured
    };
  }

  /**
   * Pro se filer info block — top-left of page one, the contact details
   * court clerks require of a self-represented filer. Values render when
   * the case data has them; otherwise blanks to complete by hand.
   *
   * @param {Object} divorceData - The divorce data
   * @returns {Object} Filer block with lines[]
   */
  generateFilerBlock(divorceData) {
    const name = divorceData.petitionerName || '_________________________________';
    const address =
      divorceData.petitionerAddress || divorceData.address || divorceData.mailingAddress || '';
    const phone =
      divorceData.petitionerPhone || divorceData.phone || divorceData.phoneNumber || '';
    const email = divorceData.petitionerEmail || divorceData.email || '';
    const t = this.terminology;
    return {
      lines: [
        name,
        `Address: ${address || '_________________________________'}`,
        `Phone: ${phone || '____________________'}`,
        `Email: ${email || '____________________'}`,
        `${t.filerLabel}, ${t.selfRepresentedLabel}`,
      ],
    };
  }

  /**
   * Get the case number label for this state
   * Override in state-specific templates (e.g., Texas uses "CAUSE NO.")
   *
   * @returns {string} Case number label
   */
  getCaseNumberLabel() {
    return 'CASE NO.';
  }

  /**
   * Get the default court name for a county
   * Override in state-specific templates — each state uses its own court name convention
   * (e.g., Texas: District Court; California: Superior Court; New York: Supreme Court)
   *
   * @param {string} county - County name
   * @returns {string} Default court name
   */
  getDefaultCourt(county) {
    return `COURT OF ${(county || '[COUNTY]').toUpperCase()} COUNTY`;
  }

  /**
   * Generate document title
   *
   * @returns {string} Title text
   */
  generateTitle() {
    return this.documentTitle;
  }

  /**
   * Generate parties identification section
   *
   * @param {Object} divorceData - The divorce data
   * @returns {Object} Parties section
   */
  generatePartiesSection(divorceData) {
    const items = [];
    let paragraphNum = 1;
    const t = this.terminology;

    items.push({
      number: paragraphNum++,
      content: `${t.filerLabel}, ${divorceData.petitionerName || '[PETITIONER NAME]'}, is a resident of ${this.districtPhrase(divorceData.county)}, ${this.stateName}.`,
      type: 'party_identification'
    });

    // Respondent residence. The extraction layer sometimes stores free
    // text like "Unknown; possibly Louisiana with brother, no address" —
    // dumping that into a "resident of …" clause is a defective pleading
    // (live Texas audit, 2026-08). When the address is missing or
    // signals "unknown/no address", plead residence-unknown and note that
    // alternative service will be requested; otherwise use the stored
    // address as-is.
    const respondentResidenceClause = this.getRespondentResidenceClause(divorceData);
    let respondentContent = `${t.responderLabel}, ${divorceData.respondentName || '[RESPONDENT NAME]'}, ${respondentResidenceClause}.`;
    // When the residence clause pleaded alternative service, append the
    // jurisdiction-specific Draft note explaining the procedural next step
    // (e.g., TX TRCP 106/109 due-diligence affidavit; GA §9-11-4(f)(1)(A)
    // motion + limited-relief warning). Templates that don't override
    // getAltServiceNote() get no note; those that do get their statute-
    // specific reminder.
    if (this.isAltServiceCase(divorceData)) {
      const note = this.getAltServiceNote(divorceData);
      if (note) respondentContent += `\n(Draft — ${note})`;
    } else if (this.isMissingAddressCase(divorceData)) {
      respondentContent += `\n(Draft — insert ${t.responderLabel}'s current address before filing, or affirm the address is unknown for alternative-service treatment)`;
    }
    items.push({
      number: paragraphNum++,
      content: respondentContent,
      type: 'party_identification'
    });

    return {
      title: 'I. PARTIES',
      items,
      nextParagraphNumber: paragraphNum
    };
  }

  /**
   * Honest residence clause for the Respondent. Values like "Unknown;
   * possibly in Louisiana with his brother, no address available"
   * (a real live-Texas extraction, 2026-08) must NOT dump into a
   * "resident of …" clause. Rules:
   *   - No address on file → residence unknown; alternative-service note.
   *   - Address contains "unknown" or "no address" (case-insensitive) →
   *     same residence-unknown clause; the free-text detail is preserved
   *     as a follow-up sentence so the record still reflects what is
   *     known ("possibly in Louisiana with his brother").
   *   - Otherwise render "is a resident of <address>" as before.
   *
   * @param {Object} divorceData - Divorce data
   * @returns {string} Sentence fragment that follows "Respondent, <name>,"
   */
  getRespondentResidenceClause(divorceData) {
    const t = this.terminology;
    const raw = typeof divorceData.respondentAddress === 'string'
      ? divorceData.respondentAddress.trim()
      : '';
    const suspected = typeof divorceData.respondentSuspectedLocation === 'string'
      ? divorceData.respondentSuspectedLocation.trim()
      : '';
    const unknownPattern = /(^|\b)(unknown|no address|whereabouts unknown|address unknown)\b/i;
    // Sworn-truth flag: petitioner has affirmed the whereabouts are unknown.
    if (divorceData.respondentAddressUnknown === true) {
      const suspectedNote = suspected
        ? ` (${t.filerLabel} has heard, but cannot swear, that ${t.responderLabel} may be in ${suspected})`
        : '';
      return `resides at an address unknown to ${t.filerLabel}${suspectedNote}; ${t.filerLabel} will request alternative service under the applicable rules`;
    }
    // Well-formed, non-hedged address — plead residence as given.
    if (raw && !unknownPattern.test(raw)) {
      return `is a resident of ${raw}`;
    }
    // Raw carries an "unknown/no address" hedge — treat as alt-service.
    if (raw && unknownPattern.test(raw)) {
      return `resides at an address unknown to ${t.filerLabel} (${raw}); ${t.filerLabel} will request alternative service under the applicable rules`;
    }
    // Empty raw + suspected location — alt-service with bracketed caveat.
    if (!raw && suspected) {
      return `resides at an address unknown to ${t.filerLabel} (${t.filerLabel} has heard, but cannot swear, that ${t.responderLabel} may be in ${suspected}); ${t.filerLabel} will request alternative service under the applicable rules`;
    }
    // SAFETY GATE (attorney review, 2026-08): silence-derived missing
    // address. Refuse to fabricate a "resides here / or unknown" hedge —
    // emit a visible fill-in blank; generatePartiesSection appends a
    // Draft note asking the filer to confirm or mark unknown before filing.
    return 'resides at __________________________________________';
  }

  /**
   * Whether this data payload will render an alternative-service residence
   * clause (i.e., the "resides at an address unknown … will request
   * alternative service" branch, not the classic "is a resident of ..."
   * sentence). Mirrors the base getRespondentResidenceClause() logic; state
   * templates that add hedge detection (TX, GA) override this so the Draft
   * note appears on the same triggers that produce the alt-service clause.
   *
   * @param {Object} divorceData
   * @returns {boolean}
   */
  isAltServiceCase(divorceData) {
    if (divorceData.respondentAddressUnknown === true) return true;
    const raw = typeof divorceData.respondentAddress === 'string'
      ? divorceData.respondentAddress.trim()
      : '';
    const suspected = typeof divorceData.respondentSuspectedLocation === 'string'
      ? divorceData.respondentSuspectedLocation.trim()
      : '';
    if (raw) {
      const unknownPattern = /(^|\b)(unknown|no address|whereabouts unknown|address unknown)\b/i;
      return unknownPattern.test(raw);
    }
    // Empty raw only counts as alt-service when we have a suspected
    // location the petitioner can't swear to. Silence alone is treated
    // as a missing-address Draft note by generatePartiesSection, not as
    // a sworn "resides at an address unknown" allegation.
    return Boolean(suspected);
  }

  /**
   * Whether the data payload has no address information at all — no
   * sworn-truth flag, no raw address, no suspected location. Distinct
   * from isAltServiceCase: this triggers a "fill in the address before
   * filing" Draft note rather than pleading alternative service.
   *
   * @param {Object} divorceData
   * @returns {boolean}
   */
  isMissingAddressCase(divorceData) {
    if (divorceData.respondentAddressUnknown === true) return false;
    const raw = typeof divorceData.respondentAddress === 'string'
      ? divorceData.respondentAddress.trim()
      : '';
    const suspected = typeof divorceData.respondentSuspectedLocation === 'string'
      ? divorceData.respondentSuspectedLocation.trim()
      : '';
    return !raw && !suspected;
  }

  /**
   * Jurisdiction-specific "next steps" note appended to the respondent's
   * residence paragraph when isAltServiceCase() is true. State templates
   * override this to point users at the applicable statute/rule and its
   * due-diligence requirement (e.g., TX TRCP 106/109, GA §9-11-4(f)(1)(A),
   * CA CCP §415.50, NY CPLR §308(5), ON FLR 6(20)). Returning null (the
   * base default) suppresses the note.
   *
   * @param {Object} divorceData
   * @returns {?string}
   */
  getAltServiceNote(_divorceData) {
    return null;
  }

  /**
   * Generate jurisdiction and venue section
   *
   * @param {Object} divorceData - The divorce data
   * @returns {Object} Jurisdiction section
   */
  generateJurisdictionSection(divorceData) {
    const items = [];
    let paragraphNum = divorceData._paragraphNum || 3;

    items.push({
      number: paragraphNum++,
      content: this.getJurisdictionStatement(divorceData),
      type: 'jurisdiction'
    });

    items.push({
      number: paragraphNum++,
      content: `Venue is proper in ${this.districtPhrase(divorceData.county)} because ${this.getVenueReason(divorceData)}.`,
      type: 'venue'
    });

    return {
      title: 'II. JURISDICTION AND VENUE',
      items,
      nextParagraphNumber: paragraphNum
    };
  }

  /**
   * Get jurisdiction statement for this state
   * Override in state-specific templates
   *
   * @param {Object} divorceData - The divorce data
   * @returns {string} Jurisdiction statement
   */
  getJurisdictionStatement(divorceData) {
    const t = this.terminology;
    return `${t.filerLabel} has been a resident of the ${t.jurisdictionTerm} of ${this.stateName} for at least ${this.residencyRequirements.stateMonths} months and of ${this.districtPhrase(divorceData.county)} for at least ${this.residencyRequirements.countyDays} days immediately preceding the filing of this petition.`;
  }

  /**
   * Get venue reason for this state
   * Override in state-specific templates
   *
   * @param {Object} divorceData - The divorce data
   * @returns {string} Venue reason
   */
  getVenueReason(divorceData) {
    const t = this.terminology;
    return `${t.filerLabel} resides in this ${t.districtTerm.toLowerCase()}`;
  }

  /**
   * Where the parties were married, as "City, State".
   *
   * The extraction layer derives marriageLocation from marriageCity +
   * marriageStateName — but when only the city was extracted, the
   * paragraph read "married … in Provo." with no state (live Utah QA,
   * 2026-08). Consult the state fields, and when the marriage state is
   * unknown fall back to this document's own jurisdiction name (the user
   * is filing where they married far more often than not, and the
   * paragraph is theirs to correct); a truly unknown place stays blank.
   *
   * @param {Object} divorceData - The divorce data
   * @returns {string} Formatted place, or '' when unknown
   */
  formatMarriagePlace(divorceData) {
    const clean = (v) => (typeof v === 'string' ? v.trim() : '');
    const location = clean(divorceData.marriageLocation) || clean(divorceData.marriagePlace);
    const city = clean(divorceData.marriageCity);
    const stateName =
      clean(divorceData.marriageStateName) ||
      // marriageState only when it's a full name, never a bare code
      (clean(divorceData.marriageState).length > 2 ? clean(divorceData.marriageState) : '');

    // A location that already contains a comma is treated as fully
    // qualified ("Provo, Utah", "Paris, France"). A bare "Atlanta" — no
    // comma, no state — falls through to the city+state fallback so the
    // paragraph reads "in Atlanta, Georgia" rather than a bare city.
    if (location && location.includes(',')) {
      return location;
    }
    const effectiveCity = city || location;
    if (!effectiveCity) return stateName;
    const state = stateName || this.stateName || '';
    return state ? `${effectiveCity}, ${state}` : effectiveCity;
  }

  /**
   * Generate marriage information section
   *
   * @param {Object} divorceData - The divorce data
   * @returns {Object} Marriage information section
   */
  generateMarriageInformationSection(divorceData) {
    const items = [];
    let paragraphNum = divorceData._paragraphNum || 5;

    const marriagePlace = this.formatMarriagePlace(divorceData);
    const marriagePlaceSuffix = marriagePlace ? ` in ${marriagePlace}` : '';
    const marriageDateFormatted = this.formatDate(divorceData.marriageDate);
    if (marriageDateFormatted) {
      items.push({
        number: paragraphNum++,
        content: `${this.terminology.filerLabel} and ${this.terminology.responderLabel} were married on ${marriageDateFormatted}${marriagePlaceSuffix}.`,
        type: 'marriage_info'
      });
    } else {
      // Visible fill-in blank + Draft note (mirrors v11-B CA pattern) when
      // the interviewee never gave a renderable date shape ("married a
      // while ago"). Avoids the [DATE OF MARRIAGE] denylist sentinel that
      // would 422 the generate route AND avoids emitting freeform text as
      // if it were sworn.
      items.push({
        number: paragraphNum++,
        content: `${this.terminology.filerLabel} and ${this.terminology.responderLabel} were married on __________________${marriagePlaceSuffix}.\n(Draft — insert exact date of marriage before filing)`,
        type: 'marriage_info'
      });
    }

    // Only emit the separation clause when the underlying value looks
    // like a date shape. A freeform "a few months ago" earlier reached
    // formatDate, which returned it raw and interpolated it into the
    // pleading (v12-B); now formatDate returns null and we render the
    // blank-plus-note pattern instead of "separated on or about null".
    if (isRenderableDate(divorceData.separationDate)) {
      items.push({
        number: paragraphNum++,
        content: `The parties separated on or about ${this.formatDate(divorceData.separationDate)}.`,
        type: 'marriage_info'
      });
    } else if (divorceData.separationDate) {
      items.push({
        number: paragraphNum++,
        content: `The parties separated on or about __________________.\n(Draft — insert exact date of separation before filing)`,
        type: 'marriage_info'
      });
    }

    return {
      title: 'III. MARRIAGE INFORMATION',
      items,
      nextParagraphNumber: paragraphNum
    };
  }

  /**
   * Format a date string for display
   *
   * @param {string} dateStr - Date string to format
   * @returns {string} Formatted date
   */
  formatDate(dateStr) {
    // Delegates to the shared helper. Returns null on empty / non-date
    // shapes / NaN — earlier this returned the raw input string, which
    // let freeform narratives ("a few months ago") reach the pleading
    // verbatim. Callers must guard the null with a visible-blank +
    // Draft-note branch or a denylist sentinel; never interpolate null.
    return sharedFormatDate(dateStr);
  }

  /**
   * Generate grounds for divorce section
   *
   * @param {Object} divorceData - The divorce data
   * @returns {Object} Grounds section
   */
  generateGroundsSection(divorceData) {
    const items = [];
    let paragraphNum = divorceData._paragraphNum || 8;

    const grounds = divorceData.groundsForDivorce || 'irreconcilable_differences';
    const groundsText = this.getGroundsText(grounds, divorceData);

    items.push({
      number: paragraphNum++,
      content: groundsText,
      type: 'grounds'
    });

    return {
      title: 'IV. GROUNDS FOR DIVORCE',
      items,
      nextParagraphNumber: paragraphNum
    };
  }

  /**
   * Get grounds text for the specified grounds type
   * Override in state-specific templates for state-specific language
   *
   * @param {string} grounds - Type of grounds
   * @param {Object} divorceData - The divorce data
   * @returns {string} Grounds text
   */
  getGroundsText(grounds, divorceData) {
    const t = this.terminology;
    switch (grounds) {
      case 'irreconcilable_differences':
        // Generic no-fault language suitable for most dissolution states.
        // Texas-specific "insupportability" phrasing must be handled in the TX state subclass.
        return 'The marriage has suffered an irreconcilable breakdown, and there is no reasonable prospect of reconciliation.';
      case 'insupportability':
        // Texas Family Code § 6.001 language — only use in TX subclass override.
        // Retained here so callers who explicitly pass this grounds value receive
        // the correct TX statutory language, but state subclasses should override
        // this method rather than relying on this default.
        return 'The marriage has become insupportable because of discord or conflict of personalities that destroys the legitimate ends of the marriage relationship and prevents any reasonable expectation of reconciliation.';
      case 'separation':
        return `The parties have lived separate and apart without cohabitation for a period of at least ${divorceData.separationPeriod || '[PERIOD]'}.`;
      case 'abandonment':
        return `${t.responderLabel} voluntarily left ${t.filerLabel} with intention of abandonment and remained away for at least ${divorceData.abandonmentPeriod || 'one year'}.`;
      case 'cruelty':
        return `${t.responderLabel} has been guilty of cruel treatment toward ${t.filerLabel} of a nature that renders further cohabitation insupportable.`;
      case 'adultery':
        return `${t.responderLabel} has committed adultery.`;
      default:
        // Generic fallback — does not use Texas-specific "insupportability" language.
        return 'The marriage has suffered an irreconcilable breakdown, and there is no reasonable prospect of reconciliation.';
    }
  }

  /**
   * Generate children information section
   *
   * @param {Object} divorceData - The divorce data
   * @returns {Object} Children section
   */
  generateChildrenSection(divorceData) {
    const items = [];
    let paragraphNum = divorceData._paragraphNum || 9;

    if (divorceData.hasMinorChildren === false || !divorceData.children || divorceData.children.length === 0) {
      items.push({
        number: paragraphNum++,
        content: 'There are no minor children of this marriage.',
        type: 'children_info'
      });
    } else {
      items.push({
        number: paragraphNum++,
        content: 'The following children were born of or adopted during this marriage:',
        type: 'children_info'
      });

      if (divorceData.children && divorceData.children.length > 0) {
        divorceData.children.forEach((child, index) => {
          const dobText = typeof child === 'object' ? this.formatChildDob(child) : null;
          const childInfo = typeof child === 'string'
            ? child
            : `${child.name || '______________________'}, born ${dobText || '______________'}`;
          items.push({
            number: paragraphNum++,
            content: `Child ${index + 1}: ${childInfo}`,
            type: 'child_detail'
          });
        });
      }

      // Add statement about no other children
      items.push({
        number: paragraphNum++,
        content: `No other children were born to or adopted by ${this.terminology.filerLabel} and ${this.terminology.responderLabel} during the marriage, and none are expected.`,
        type: 'children_info'
      });

      // Plead the arrangements the parties actually reached (custody enum,
      // primary residence, agreed child support). Unknown data keeps the
      // generic pleading language unchanged.
      paragraphNum = this.appendAgreedChildArrangementPleadings(items, paragraphNum, divorceData);
    }

    return {
      title: 'V. CHILDREN',
      items,
      nextParagraphNumber: paragraphNum
    };
  }

  /**
   * Append the agreed-child-arrangement pleadings (custody enum, primary
   * residence, agreed child support) to a children-section items array.
   * The base children section calls this; jurisdiction overrides of
   * generateChildrenSection call it before their final return so agreed
   * relief is pleaded instead of silently dropped. Idempotent per item
   * type: an override that already pushed a custody_request /
   * residence_request / child_support_request item keeps its own wording.
   *
   * @param {Array} items - The section's items array (mutated)
   * @param {number} paragraphNum - Next paragraph number
   * @param {Object} divorceData - The divorce data
   * @returns {number} The next paragraph number after the appended items
   */
  appendAgreedChildArrangementPleadings(items, paragraphNum, divorceData) {
    if (divorceData.hasMinorChildren === false || !divorceData.children || divorceData.children.length === 0) {
      return paragraphNum;
    }
    const hasType = (type) => items.some((item) => item && item.type === type);

    const custody = resolveCustodyArrangement(divorceData);
    if (custody.explicit && !hasType('custody_request')) {
      const custodyPleading = this.getCustodyPleading(custody, divorceData);
      if (custodyPleading) {
        items.push({
          number: paragraphNum++,
          content: custodyPleading,
          type: 'custody_request'
        });
      }
    }

    const residenceName = resolvePrimaryResidenceName(divorceData);
    if (residenceName && !hasType('residence_request')) {
      items.push({
        number: paragraphNum++,
        content: this.getResidencePleading(residenceName, divorceData),
        type: 'residence_request'
      });
    }

    if (divorceData.childSupportAmount && !hasType('child_support_request')) {
      items.push({
        number: paragraphNum++,
        content: this.getChildSupportPleading(divorceData),
        type: 'child_support_request'
      });
    }
    return paragraphNum;
  }

  /**
   * Pleading text for a recognized custody arrangement. Jurisdiction
   * subclasses override for local terminology (e.g., Ontario pleads
   * "decision-making responsibility" under the Divorce Act).
   *
   * @param {{kind: string}} custody - Resolved arrangement (templates/core/parenting.js)
   * @param {Object} divorceData - The divorce data
   * @returns {string|null} Pleading sentence, or null to keep generic language
   */
  getCustodyPleading(custody, divorceData) {
    const t = this.terminology;
    if (custody.kind === 'joint') {
      return `The parties have agreed to joint legal custody of the minor child(ren), and ${t.filerLabel} requests that the Court order that arrangement.`;
    }
    if (custody.kind === 'sole_petitioner') {
      return `${t.filerLabel} requests sole legal and physical custody of the minor child(ren).`;
    }
    if (custody.kind === 'sole_respondent') {
      return `${t.filerLabel} requests that ${divorceData.respondentName || t.responderLabel} be awarded sole legal and physical custody of the minor child(ren).`;
    }
    if (custody.kind === 'legacy_sole') {
      return `${t.filerLabel} requests that ${resolvePrimaryResidenceName(divorceData) || divorceData.petitionerName || t.filerLabel} be awarded sole legal and physical custody of the minor child(ren).`;
    }
    return null;
  }

  /**
   * Pleading text for the child(ren)'s primary residence.
   * @param {string} residenceName - Who the children primarily live with
   * @param {Object} divorceData - The divorce data
   * @returns {string} Pleading sentence
   */
  getResidencePleading(residenceName, divorceData) {
    return `${this.terminology.filerLabel} requests that the child(ren) primarily reside with ${residenceName}.`;
  }

  /**
   * Pleading text for an agreed child-support amount.
   * @param {Object} divorceData - The divorce data
   * @returns {string} Pleading sentence
   */
  getChildSupportPleading(divorceData) {
    const t = this.terminology;
    const payor = divorceData.childSupportObligor || divorceData.respondentName || t.responderLabel;
    const payee = divorceData.childSupportObligee || divorceData.petitionerName || t.filerLabel;
    return `The parties have agreed that ${payor} shall pay child support to ${payee} in the amount of $${divorceData.childSupportAmount} per month, subject to the Court's approval under the applicable child support guidelines.`;
  }

  /**
   * Generate property information section
   *
   * @param {Object} divorceData - The divorce data
   * @returns {Object} Property section
   */
  generatePropertySection(divorceData) {
    const items = [];
    let paragraphNum = divorceData._paragraphNum || 12;

    // SAFETY GATE (attorney review, 2026-08): "there is no property to be
    // divided" is a dispositive nil-finding that waives a party's claim to
    // marital property. It may render ONLY when the profile carries an
    // AFFIRMATIVE, user-confirmed statement — `hasProperty === false`
    // together with a corroborating signal (`noPropertyConfirmed === true`
    // OR a described `propertyAgreement`). Otherwise emit a visible
    // Draft-note blank so the self-rep filer must confirm before filing.
    // Nil finding fires on either:
    //   (a) hasProperty === false + a corroborating signal
    //       (noPropertyConfirmed === true OR a described propertyAgreement),
    //   (b) noPropertyConfirmed === true on its own — an affirmative
    //       user-confirmed "no property" from the intake that shouldn't
    //       fall through into the boilerplate community-property allegation
    //       even when hasProperty was never explicitly set to false
    //       (Mari's TX petition, live audit 2026-08).
    const factsSayNoProperty = this.factsIndicateNoProperty(divorceData);
    const nilPropertyConfirmed =
      divorceData.noPropertyConfirmed === true ||
      (divorceData.hasProperty === false &&
        (typeof divorceData.propertyAgreement === 'string' &&
          divorceData.propertyAgreement.trim() !== '')) ||
      // Round-3 attorney review (Mari TX): facts[] explicitly said
      // "no property, no house, no retirement" but the structured
      // hasProperty flag never landed. Treat the fact as authoritative.
      factsSayNoProperty;
    if (nilPropertyConfirmed) {
      items.push({
        number: paragraphNum++,
        content: 'The parties own no community or marital property to be divided.',
        type: 'property_info'
      });
    } else if (divorceData.hasProperty === false) {
      // Silence-derived "no property" — refuse to fabricate. Draft note.
      items.push({
        number: paragraphNum++,
        content: '________________________________________\n(Draft — confirm whether you and your spouse have any marital/community property to divide, or a written agreement dividing it, before filing. Silence on this line may be treated as no property, waiving your claim.)',
        type: 'property_draft_note'
      });
    } else if (this.hasAgreedPropertyDivision(divorceData)) {
      // The parties described an agreed division — plead it instead of the
      // generic "divide in a just and right manner" boilerplate.
      for (const content of this.getPropertyAgreementPleadings(divorceData)) {
        items.push({
          number: paragraphNum++,
          content,
          type: 'property_agreement'
        });
      }
    } else if (divorceData.hasProperty === true) {
      items.push({
        number: paragraphNum++,
        content: 'The parties have accumulated community/marital property during the marriage, including but not limited to real property, personal property, and financial accounts.',
        type: 'property_info'
      });

      items.push({
        number: paragraphNum++,
        content: `${this.terminology.filerLabel} requests that the Court divide the community/marital property in a just and right manner.`,
        type: 'property_request'
      });
    } else {
      // SAFETY GATE: neither an affirmative "we have property" flag nor a
      // confirmed no-property finding — refuse to fabricate a
      // community-property allegation. Emit a Draft-note blank so the
      // self-rep filer must confirm whether marital property exists
      // before filing.
      items.push({
        number: paragraphNum++,
        content: '________________________________________\n(Draft — confirm whether you and your spouse have any marital/community property to divide, or a written agreement dividing it, before filing.)',
        type: 'property_draft_note'
      });
    }

    // Round-3 attorney review (David NY): a debts boilerplate paragraph
    // rendered against a silent transcript. Only emit when we have an
    // affirmative signal (hasDebts === true, an itemized list on either
    // side, or an explicit facts-derived "we have debts" cue); silence
    // OR a facts-derived "no debts" statement suppress the paragraph.
    const factsSayNoDebts = this.factsIndicateNoDebts(divorceData);
    const affirmativeDebtSignal =
      divorceData.hasDebts === true ||
      asList(divorceData.petitionerDebts).length > 0 ||
      asList(divorceData.respondentDebts).length > 0;
    if (affirmativeDebtSignal && !factsSayNoDebts) {
      items.push({
        number: paragraphNum++,
        content: `The parties have accumulated debts during the marriage. ${this.terminology.filerLabel} requests that the Court allocate responsibility for such debts in a just and equitable manner.`,
        type: 'debt_info'
      });
    } else if (divorceData.hasDebts === false || factsSayNoDebts) {
      items.push({
        number: paragraphNum++,
        content: 'The parties have no marital debts to be divided.',
        type: 'debt_info'
      });
    }

    return {
      title: 'VI. PROPERTY AND DEBTS',
      items,
      nextParagraphNumber: paragraphNum
    };
  }

  /**
   * Whether the case data describes an agreed property division (a
   * propertyAgreement flag/description, or itemized property lists).
   * @param {Object} divorceData - The divorce data
   * @returns {boolean}
   */
  hasAgreedPropertyDivision(divorceData) {
    // Round-3 attorney review (Sarah AB): profile carried
    // propertyAgreement="pending" and the base predicate treated the raw
    // truthy string as an affirmative agreement — the petition then
    // pleaded a fabricated "the parties have reached an agreement…" and
    // relief (f) invited the court to approve it. A status token
    // ("pending"/"unknown"/"undecided"/…) is NOT an agreement.
    const raw = typeof divorceData.propertyAgreement === 'string'
      ? divorceData.propertyAgreement.trim()
      : divorceData.propertyAgreement;
    const rawNorm = typeof raw === 'string'
      ? raw.toLowerCase().replace(/[.!]+$/, '').replace(/\s+/g, ' ')
      : '';
    // Split PROPERTY_AGREEMENT_STATUS_TOKENS by polarity: "agreed"/"yes"/
    // "true"/"y" are AFFIRMATIVE and count as an agreement even without a
    // description; "pending"/"unknown"/"undecided"/"tbd"/"no"/"false"/
    // "contested"/"disputed"/"n/a"/"none" are NON-affirmative and never
    // count on their own (Sarah AB round-3: propertyAgreement="pending").
    const AFFIRMATIVE_STATUS = new Set(['agreed', 'agree', 'agreement', 'yes', 'true', 'y']);
    const isStatusToken = rawNorm && PROPERTY_AGREEMENT_STATUS_TOKENS.has(rawNorm);
    const isAffirmativeStatus = rawNorm && AFFIRMATIVE_STATUS.has(rawNorm);
    const affirmativeAgreement =
      raw === true ||
      divorceData.propertyAgreementConfirmed === true ||
      isAffirmativeStatus ||
      (typeof raw === 'string' && raw.length > 0 && !isStatusToken);
    return Boolean(
      affirmativeAgreement ||
      asList(divorceData.petitionerProperty).length > 0 ||
      asList(divorceData.respondentProperty).length > 0
    );
  }

  /**
   * Round-3 attorney review (Mari TX / David NY): fact-derived signal
   * that the parties have no property to divide. Deterministic keyword
   * intersection over model-classified metadata — no free-text prose
   * parsing beyond the closed keyword list above.
   */
  factsIndicateNoProperty(divorceData) {
    return _factsIndicateNo(divorceData, NO_PROPERTY_KEYWORDS, PROPERTY_CATEGORY_TOKENS);
  }

  /**
   * Fact-derived signal that the parties have no debts to divide.
   */
  factsIndicateNoDebts(divorceData) {
    return _factsIndicateNo(divorceData, NO_DEBTS_KEYWORDS, DEBT_CATEGORY_TOKENS);
  }

  /**
   * Universal year-only DOB helper. Round-3 attorney review (Marcus,
   * Sarah's kids): transcripts said "born 2020" / "born 2011" and the
   * base formatDate returned null for bare years, so pleadings read
   * "born __________________" even when the year was clearly stated.
   * The Alberta template already did this via yearOnlyOf; hoist to the
   * base so every jurisdiction inherits it.
   */
  formatChildDob(child) {
    if (!child || typeof child !== 'object') return null;
    const raw = child.birthDate ?? child.dob ?? child.dateOfBirth;
    const full = this.formatDate(raw);
    if (full) return full;
    const year = child.birthYear ?? yearOnlyOf(raw);
    if (year && /^\d{4}$/.test(String(year).trim())) return String(year).trim();
    return null;
  }

  /**
   * Pleading paragraphs for the parties' agreed property division.
   * Jurisdiction subclasses override for local property regimes (e.g.,
   * Ontario's Family Law Act equalization — no "community property").
   *
   * @param {Object} divorceData - The divorce data
   * @returns {string[]} Pleading paragraphs
   */
  getPropertyAgreementPleadings(divorceData) {
    const t = this.terminology;
    const pleadings = [];

    let intro = 'The parties have reached an agreement regarding the division of their community/marital property.';
    // Only append when the value is an actual description — a status token
    // like "agreed" would concatenate raw into the sentence
    // (templates/core/dataShapes.js propertyAgreementProse).
    const agreementProse = propertyAgreementProse(divorceData.propertyAgreement);
    if (agreementProse) {
      intro += ` ${agreementProse}`;
    }
    pleadings.push(intro);

    if (asList(divorceData.petitionerProperty).length > 0) {
      pleadings.push(
        `Under the parties' agreement, ${divorceData.petitionerName || t.filerLabel} is to receive: ${asList(divorceData.petitionerProperty).join('; ')}.`
      );
    }
    if (asList(divorceData.respondentProperty).length > 0) {
      pleadings.push(
        `Under the parties' agreement, ${divorceData.respondentName || t.responderLabel} is to receive: ${asList(divorceData.respondentProperty).join('; ')}.`
      );
    }

    pleadings.push(
      `${t.filerLabel} requests that the Court approve the parties' agreement and divide the property accordingly.`
    );
    return pleadings;
  }

  /**
   * Append the agreed corollary relief (agreed child-support amount,
   * explicit spousal-support waiver, agreed property division) to a relief
   * items string array. Jurisdiction overrides of generateReliefSection
   * call this just before lettering their items so agreed relief — the
   * waiver especially — is never silently omitted. Items are spliced in
   * BEFORE the final element, keeping the customary "such other and
   * further relief" prayer last. Skips anything the override already
   * pleads (matched on the support amount / waiver phrasing / agreement
   * approval keywords).
   *
   * @param {string[]} reliefItems - The relief item strings (mutated)
   * @param {Object} divorceData - The divorce data
   * @returns {string[]} The same array, for chaining
   */
  appendAgreedReliefItems(reliefItems, divorceData) {
    const t = this.terminology;
    const all = () => reliefItems.join(' ');
    const additions = [];

    const hasChildren = this.hasMinorChildrenForRelief(divorceData);
    if (hasChildren && divorceData.childSupportAmount &&
        !all().includes(`$${divorceData.childSupportAmount}`)) {
      const payor = divorceData.childSupportObligor || divorceData.respondentName || t.responderLabel;
      additions.push(
        `Order that ${payor} pay child support of $${divorceData.childSupportAmount} per month, in accordance with the applicable child support guidelines;`
      );
    }

    // SAFETY GATE (attorney review, 2026-08): a spousal-support waiver
    // relinquishes a legal right — plead it ONLY on an affirmative,
    // user-confirmed waiver (`spousalSupportWaived === true` OR the newer
    // `spousalSupportAgreed === true`). A bare `spousalSupportRequested
    // === false` (an LLM default when the topic was never discussed) is
    // NOT sufficient — that is the fabrication the Marcus/Sarah audits
    // caught.
    const supportWaived =
      (divorceData.spousalSupportWaived === true ||
        divorceData.spousalSupportAgreed === true) &&
      !divorceData.requestSpousalSupport &&
      !divorceData.spousalSupportRequested;
    if (supportWaived && !/waiv/i.test(all())) {
      additions.push(
        'Confirm the parties\' agreement that neither party shall pay spousal maintenance/alimony to the other, each party having waived such support;'
      );
    }

    if (this.hasAgreedPropertyDivision(divorceData) && !/agreement regarding the division/i.test(all())) {
      additions.push(
        'Approve the parties\' agreement regarding the division of their property and debts and divide the property accordingly;'
      );
    }

    if (additions.length > 0) {
      const insertAt = Math.max(reliefItems.length - 1, 0);
      reliefItems.splice(insertAt, 0, ...additions);
    }
    return reliefItems;
  }

  /**
   * Whether the case has MINOR children on file — the trigger for
   * custody/child-support prayer items and agreed-child-arrangement
   * relief. hasMinorChildren === false overrides any children[] entries
   * (they are then treated as adult children of the marriage, named
   * elsewhere but never as minors — live audits, 2026-08).
   *
   * @param {Object} divorceData
   * @returns {boolean}
   */
  hasMinorChildrenForRelief(divorceData) {
    const d = divorceData || {};
    if (d.hasMinorChildren === false) return false;
    if (d.hasMinorChildren === true) return true;
    return Array.isArray(d.children) && d.children.length > 0;
  }

  /**
   * Generate relief requested section
   *
   * @param {Object} divorceData - The divorce data
   * @returns {Object} Relief section
   */
  generateReliefSection(divorceData) {
    const items = [];
    let paragraphNum = divorceData._paragraphNum || 15;
    const t = this.terminology;

    items.push({
      number: null,
      content: `WHEREFORE, ${t.filerLabel} requests that the Court:`,
      type: 'relief_intro'
    });

    // Standard relief requests
    const reliefItems = [
      `Grant a divorce dissolving the marriage between ${t.filerLabel} and ${t.responderLabel};`,
      'Divide the community/marital property in a just and right manner;',
      'Allocate responsibility for debts in an equitable manner;'
    ];

    // Add child-related relief only when the case has minor children on
    // file. hasMinorChildren === false suppresses custody/support prayer
    // items even when the children[] array holds ADULT children (live
    // Texas + California audits, 2026-08 — the prayer asked the court to
    // "determine custody" in cases where the parties have no minor
    // children).
    if (this.hasMinorChildrenForRelief(divorceData)) {
      reliefItems.push('Determine custody and parenting time/visitation arrangements for the minor child(ren);');
      reliefItems.push('Order appropriate parenting time/visitation for the non-custodial parent;');
      if (divorceData.childSupportAmount) {
        const payor = divorceData.childSupportObligor || divorceData.respondentName || t.responderLabel;
        reliefItems.push(`Order that ${payor} pay child support of $${divorceData.childSupportAmount} per month, in accordance with state guidelines;`);
      } else {
        reliefItems.push('Order child support in accordance with state guidelines;');
      }
    }

    // Spousal support: request it when requested, plead the parties' waiver
    // when the data explicitly says support is not sought.
    if (divorceData.requestSpousalSupport || divorceData.spousalSupportRequested) {
      reliefItems.push(`Award spousal maintenance/alimony to ${t.filerLabel};`);
    } else if (
      // SAFETY GATE (attorney review, 2026-08): a spousal-support waiver
      // relinquishes a legal right. Emit ONLY on an affirmative,
      // user-confirmed waiver. A bare `spousalSupportRequested === false`
      // (LLM default when the topic was never discussed) is not enough.
      divorceData.spousalSupportWaived === true ||
      divorceData.spousalSupportAgreed === true
    ) {
      reliefItems.push('Confirm the parties\' agreement that neither party shall pay spousal maintenance/alimony to the other, each party having waived such support;');
    } else if (divorceData.spousalSupportRequested === false) {
      // Silence-derived: leave the ask open with a Draft note the filer
      // must confirm — never a fabricated release.
      reliefItems.push('________________________________________ (Draft — confirm whether you have agreed on spousal support before filing; silence on this line may be treated as no agreement.);');
    }

    // Add name change if requested
    if (divorceData.requestNameChange && divorceData.previousName) {
      reliefItems.push(`Restore ${t.filerLabel}'s former name: ${divorceData.previousName};`);
    }

    // Add general relief
    reliefItems.push(`Grant such other and further relief to which ${t.filerLabel} may be entitled.`);

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
      title: 'VII. PRAYER FOR RELIEF',
      items,
      nextParagraphNumber: paragraphNum
    };
  }

  /**
   * Generate verification section
   *
   * @param {Object} divorceData - The divorce data
   * @returns {Object} Verification section
   */
  generateVerificationSection(divorceData) {
    const verificationText = this.getVerificationText(divorceData);

    return {
      title: 'VERIFICATION',
      text: verificationText,
      type: 'verification'
    };
  }

  /**
   * Get verification text for this state
   * Override in state-specific templates
   *
   * @param {Object} divorceData - The divorce data
   * @returns {string} Verification text
   */
  getVerificationText(divorceData) {
    const name = divorceData.petitionerName || '_________________________________';
    return `I, ${name}, ${this.terminology.filerLabel}, declare under penalty of perjury that the facts stated in this Petition are true and correct to the best of my knowledge and belief.`;
  }

  /**
   * Generate signature block
   *
   * @param {string} petitionerName - Name of petitioner
   * @returns {Object} Signature block
   */
  generateSignatureBlock(petitionerName) {
    const name = petitionerName || '_________________________________';
    const title = `${this.terminology.filerLabel}, ${this.terminology.selfRepresentedLabel}`;
    return {
      line: '_________________________________',
      name,
      title,
      date: 'Date: _____________________',
      formatted: `_________________________________\n${name}\n${title}\n\nDate: _____________________`
    };
  }

  /**
   * Generate footer with metadata
   *
   * @returns {Object} Footer
   */
  generateFooter() {
    return {
      disclaimer: 'This document was generated for informational purposes only and does not constitute legal advice. Consult with a licensed attorney for legal advice.',
      timestamp: new Date().toISOString(),
      version: '1.0',
      documentType: this.documentType
    };
  }

  /**
   * Generate full text representation of document
   *
   * @param {Object} sections - All document sections
   * @returns {string} Complete document as plain text
   */
  generateFullText(sections) {
    let text = '';

    // Prep-tool disclaimer sits above every other section so the filer
    // (and any downstream reviewer) sees it before reading the pleading.
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

    // Generate numbered paragraphs from each section
    const sectionOrder = ['parties', 'jurisdiction', 'marriageInfo', 'grounds', 'childrenInfo', 'propertyInfo'];

    sectionOrder.forEach(sectionKey => {
      const section = sections[sectionKey];
      if (section?.title) {
        text += `\n${section.title}\n\n`;
      }
      if (section?.items) {
        section.items.forEach(item => {
          if (item.number !== null) {
            text += `${item.number}. ${item.content}\n\n`;
          } else {
            text += `${item.content}\n\n`;
          }
        });
      }
    });

    // Relief section
    if (sections.reliefRequested?.title) {
      text += `\n${sections.reliefRequested.title}\n\n`;
      sections.reliefRequested.items.forEach((item, index) => {
        if (item.type === 'relief_intro') {
          text += `${item.content}\n\n`;
        } else {
          const letter = String.fromCharCode(97 + index - 1); // a, b, c...
          text += `  ${letter}. ${item.content}\n`;
        }
      });
      text += '\n';
    }

    // Verification
    if (sections.verification?.title) {
      text += `\n${sections.verification.title}\n\n`;
      text += sections.verification.text + '\n\n';
    }

    // Signature block
    if (sections.signatureBlock?.formatted) {
      text += '\n' + sections.signatureBlock.formatted + '\n';
    }

    return text;
  }

  /**
   * Generate HTML representation of document
   *
   * @param {Object} sections - All document sections
   * @returns {string} Complete document as HTML
   */
  generateHTMLContent(sections) {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Petition for Divorce - ${escapeHtml(this.stateName)}</title>
  <style>
    body {
      font-family: 'Times New Roman', serif;
      font-size: 12pt;
      line-height: 2;
      margin: 1in;
      color: #000;
      background: white;
    }
    .header {
      text-align: center;
      font-weight: bold;
      margin-bottom: 10px;
    }
    .venue {
      text-align: center;
      font-weight: bold;
      margin-bottom: 20px;
    }
    .case-caption {
      text-align: center;
      margin-bottom: 20px;
      white-space: pre-line;
    }
    .title {
      text-align: center;
      font-weight: bold;
      text-decoration: underline;
      margin: 20px 0;
    }
    .section-title {
      font-weight: bold;
      text-decoration: underline;
      margin: 20px 0 10px 0;
    }
    .paragraph {
      margin-bottom: 15px;
      text-align: justify;
      text-indent: 0.5in;
    }
    .relief-item {
      margin-left: 0.5in;
      margin-bottom: 5px;
    }
    .verification {
      margin-top: 30px;
    }
    .signature-block {
      margin-top: 40px;
      margin-bottom: 30px;
      white-space: pre-line;
    }
    @media print {
      body {
        margin: 0;
        padding: 1in;
      }
    }
  </style>
</head>
<body>
  ${sections.draftBanner ? `<div class="draft-banner" style="border:1px solid #b45309;background:#fff7ed;padding:10px 14px;margin:0 0 20px 0;font-size:10pt;line-height:1.4;color:#7c2d12;"><strong>DRAFT</strong> — ${escapeHtml(sections.draftBanner.replace(/^DRAFT — /, ''))}</div>` : ''}
  ${sections.header && !lineDuplicatesCaption(sections.header, sections.caseCaption) ? `<div class="header">${escapeHtml(sections.header)}</div>` : ''}
  ${sections.venue && !lineDuplicatesCaption(sections.venue, sections.caseCaption) ? `<div class="venue">${escapeHtml(sections.venue)}</div>` : ''}
  ${sections.caseCaption?.formatted ? `<div class="case-caption">${escapeHtml(sections.caseCaption.formatted)}</div>` : ''}
  ${sections.title ? `<div class="title">${escapeHtml(sections.title)}</div>` : ''}

  ${this.renderSectionHTML(sections.parties)}
  ${this.renderSectionHTML(sections.jurisdiction)}
  ${this.renderSectionHTML(sections.marriageInfo)}
  ${this.renderSectionHTML(sections.grounds)}
  ${this.renderSectionHTML(sections.childrenInfo)}
  ${this.renderSectionHTML(sections.propertyInfo)}
  ${this.renderReliefSectionHTML(sections.reliefRequested)}
  ${this.renderVerificationHTML(sections.verification)}

  ${sections.signatureBlock?.formatted ? `<div class="signature-block"><pre>${escapeHtml(sections.signatureBlock.formatted)}</pre></div>` : ''}
</body>
</html>`;
  }

  /**
   * Render a section as HTML
   * @param {Object} section - Section to render
   * @returns {string} HTML string
   */
  renderSectionHTML(section) {
    if (!section) return '';

    let html = '';
    if (section.title) {
      html += `<div class="section-title">${escapeHtml(section.title)}</div>`;
    }
    if (section.items) {
      section.items.forEach(item => {
        if (item.number !== null) {
          html += `<p class="paragraph">${item.number}. ${escapeHtml(item.content)}</p>`;
        } else {
          html += `<p class="paragraph">${escapeHtml(item.content)}</p>`;
        }
      });
    }
    return html;
  }

  /**
   * Render relief section as HTML
   * @param {Object} section - Relief section to render
   * @returns {string} HTML string
   */
  renderReliefSectionHTML(section) {
    if (!section) return '';

    let html = `<div class="section-title">${escapeHtml(section.title)}</div>`;

    section.items.forEach((item, index) => {
      if (item.type === 'relief_intro') {
        html += `<p class="paragraph">${escapeHtml(item.content)}</p>`;
      } else {
        const letter = String.fromCharCode(97 + index - 1);
        html += `<p class="relief-item">${letter}. ${escapeHtml(item.content)}</p>`;
      }
    });

    return html;
  }

  /**
   * Render verification section as HTML
   * @param {Object} section - Verification section to render
   * @returns {string} HTML string
   */
  renderVerificationHTML(section) {
    if (!section) return '';

    return `
      <div class="verification">
        <div class="section-title">${escapeHtml(section.title)}</div>
        <p class="paragraph">${escapeHtml(section.text)}</p>
      </div>
    `;
  }

  /**
   * Perform state-specific validation
   * Override in state-specific templates
   *
   * @param {Object} divorceData - The divorce data to validate
   * @returns {Object} Validation result with errors and warnings arrays
   */
  performStateSpecificValidation(divorceData) {
    return { errors: [], warnings: [] };
  }
}

module.exports = BaseDivorcePetitionTemplate;
