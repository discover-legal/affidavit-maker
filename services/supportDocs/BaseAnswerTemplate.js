// services/supportDocs/BaseAnswerTemplate.js
// Jurisdiction-agnostic factory for a divorce Answer (Response / Answer and
// Counterclaim) builder. Each jurisdiction file (floridaAnswer.js,
// georgiaAnswer.js, texasAnswer.js, californiaAnswer.js, newyorkAnswer.js,
// ontarioAnswer.js, albertaAnswer.js) supplies a small config and gets back
// a (data, opts) => documentStructure function matching the same generic
// affidavit shape that services/pdfService.js renders (header,
// caseCaption.formatted, title, introduction, facts.items[{number, content}],
// conclusion, perjuryStatement, signatureBlock, notaryBlock). documentType
// is pinned to 'affidavit' so detectDocumentType() never mis-routes into
// the petition/decree paths.
//
// Substantive structure of an Answer (per Fla. Fam. L.R.P. 12.110 / Fla. R.
// Civ. P. 1.110(c), NY CPLR 3018, Tex. R. Civ. P. 92, and the equivalent
// rules in the other supported jurisdictions):
//
//   1. GENERAL DENIAL — everything not expressly admitted is denied. Without
//      this, every unanswered allegation is deemed admitted (Fla. R. Civ. P.
//      1.110(e)).
//   2. PER-PARAGRAPH RESPONSES — admit / deny / without knowledge, one per
//      numbered petition paragraph. When the user has already classified
//      paragraphs via `data.answerPositions`, we render those groupings.
//      Otherwise we emit a scaffold covering the standard divorce-petition
//      paragraphs (jurisdiction, residency, marriage, breakdown, children,
//      property, debts, alimony, attorney fees), each with "ADMITS / DENIES
//      / WITHOUT KNOWLEDGE (mark one)" for the user to complete against the
//      served petition. Substantively necessary because at Answer-drafting
//      time we do NOT have the served petition's text.
//   3. AFFIRMATIVE DEFENSES — auto-seeded from profile facts (currently
//      `prenupSigned` → prenup enforcement defense; extensible by
//      jurisdiction). Fla. R. Civ. P. 1.140(b)/(h) waives affirmative
//      defenses not raised in the responsive pleading.
//   4. COUNTER-PETITION OFFER — an informational item pointing the user to
//      the counter-petition form (Fla. Fam. L.R.P. Form 12.903(b) in FL,
//      etc.) so they can preserve affirmative relief without filing a bare
//      Answer that waives it.
//   5. USER REQUESTS — anything the user explicitly asked for, transcribed.
//   6. COUNTERCLAIM — full pleading (only when `includeCounterclaim`).
//   7. CERTIFICATE OF SERVICE + VERIFICATION.
//
// UPL line: builders TRANSCRIBE the user's own decisions. The scaffold is a
// fill-in with the classifications explicit ("ADMITS / DENIES / WITHOUT
// KNOWLEDGE — mark one"); we never auto-admit or auto-deny an unclassified
// paragraph, and we never synthesize requests for relief. Positions and
// requests always come verbatim (sanitized) from explicit user input.

'use strict';

const crypto = require('node:crypto');

const BLANK_SHORT = '______________';
const BLANK_LINE = '________________________________';

// Two-letter jurisdiction codes for Canadian provinces / territories. When the
// answer is being built for one of these, the US-idiom filter rewrites tokens
// that would read wrong in a Canadian court file (alimony → spousal support,
// attorney's fees → costs, Case No. → Court File No., v. → AND BETWEEN, etc.).
const CANADIAN_STATES = new Set(['ON', 'AB', 'BC', 'QC', 'MB', 'SK', 'NS', 'NB', 'PE', 'NL', 'YT', 'NT', 'NU']);

function isCanadianState(state) {
  return CANADIAN_STATES.has(String(state || '').trim().toUpperCase());
}

/**
 * Rewrite US-legal-vernacular tokens to Canadian equivalents. Applied to every
 * emitted string in the final structure when the builder's configured state is
 * Canadian. Strict token filter, word-boundary regex.
 *
 *   alimony              → spousal support
 *   attorney's fees      → costs
 *   attorneys' fees      → costs
 *   attorney fees        → costs
 *   Case No.             → Court File No.
 *   ' v. ' (in caption)  → ' AND BETWEEN '
 */
function canadianize(text) {
  if (typeof text !== 'string' || text.length === 0) return text;
  return text
    .replace(/\bspousal support or alimony\b/gi, 'spousal support')
    .replace(/\balimony\b/gi, 'spousal support')
    .replace(/\battorney(?:'s|s'|s)?\s+fees\s+and\s+costs\b/gi, 'costs')
    .replace(/\battorney(?:'s|s'|s)?\s+fees\b/gi, 'costs')
    .replace(/\battorney\s+fees\b/gi, 'costs')
    .replace(/\bCase No\./g, 'Court File No.')
    .replace(/(\n|^)\s*v\.\s*(\n|$)/g, '$1AND$2')
    .replace(/(\S)\s+v\.\s+(\S)/g, '$1 AND BETWEEN $2');
}

/** Recursively canadianize every human-facing string in the given structure. */
function canadianizeStructure(node) {
  if (node == null) return node;
  if (typeof node === 'string') return canadianize(node);
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i += 1) node[i] = canadianizeStructure(node[i]);
    return node;
  }
  if (typeof node === 'object') {
    for (const key of Object.keys(node)) {
      if (key === 'id' || key === 'state' || key === 'documentType' || key === 'kind' || key === 'type' || key === 'scaffoldKey' || key === 'timestamp') continue;
      node[key] = canadianizeStructure(node[key]);
    }
    return node;
  }
  return node;
}

// ─── generic helpers ────────────────────────────────────────────────────────

function str(value) {
  return value === undefined || value === null ? '' : String(value).trim();
}

function upper(value) {
  return str(value).toUpperCase();
}

function ensurePeriod(text) {
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

/** The user's own identity fields (GENERAL profile fields). */
function resolveUserName(data) {
  return (
    str(data.affiantName) ||
    [str(data.firstName), str(data.lastName)].filter(Boolean).join(' ')
  );
}

/**
 * Same party resolution logic as utahAnswer.js: the user is treated as the
 * respondent (this IS the Answer doc) unless data.role === 'petitioner';
 * legacy profiles that stored the user's name under petitionerName get
 * flipped into the respondent slot.
 */
function resolveParties(data) {
  const userIsRespondent = str(data.role).toLowerCase() !== 'petitioner';
  const userName = resolveUserName(data);

  let petitioner =
    str(data.petitionerName) ||
    [str(data.petitionerFirstName), str(data.petitionerLastName)].filter(Boolean).join(' ');
  let respondent =
    str(data.respondentName) ||
    [str(data.respondentFirstName), str(data.respondentLastName)].filter(Boolean).join(' ');

  if (userIsRespondent) {
    if (
      !respondent &&
      userName &&
      petitioner &&
      petitioner.toLowerCase() === userName.toLowerCase()
    ) {
      respondent = petitioner;
      petitioner = '';
    }
    if (!respondent) respondent = userName;
  }

  return {
    petitioner: petitioner || BLANK_LINE,
    respondent: respondent || BLANK_LINE,
  };
}

/** 'paragraph 2' / 'paragraphs 1 and 3' / 'paragraphs 1, 3, and 5'. */
function paragraphList(list) {
  if (list.length === 1) return `paragraph ${list[0]}`;
  if (list.length === 2) return `paragraphs ${list[0]} and ${list[1]}`;
  return `paragraphs ${list.slice(0, -1).join(', ')}, and ${list[list.length - 1]}`;
}

/**
 * Group the user's explicit paragraph positions into admit / deny /
 * lack_knowledge lists. Anything malformed, unclassified, or with an unknown
 * position value is dropped — never reinterpreted.
 */
function groupPositions(raw) {
  const groups = { admit: [], deny: [], lack_knowledge: [] };
  if (!Array.isArray(raw)) return groups;
  const seen = new Set();
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const paragraph = str(entry.paragraph).slice(0, 12);
    const position = str(entry.position).toLowerCase();
    if (!paragraph || !(position in groups)) continue;
    if (seen.has(paragraph)) continue;
    seen.add(paragraph);
    groups[position].push(paragraph);
  }
  for (const key of Object.keys(groups)) {
    groups[key].sort((a, b) => {
      const na = Number(a);
      const nb = Number(b);
      if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
      return String(a).localeCompare(String(b));
    });
  }
  return groups;
}

/**
 * Requests are composed into "${responderLabel} asks the court to ${request}",
 * but users phrase them as full asks ("that the court divide the property
 * fairly"), which doubles the frame. Strip leading framing so the request
 * reads as a bare verb phrase.
 */
function normalizeRequestPhrase(text) {
  let out = text;
  const LEADING_FRAMES =
    /^(please\s+|i\s+(?:respectfully\s+)?(?:ask|request)\s+(?:that\s+)?|that\s+|the\s+court\s+(?:should\s+|to\s+)?|to\s+)/i;
  for (let i = 0; i < 5 && LEADING_FRAMES.test(out); i += 1) {
    out = out.replace(LEADING_FRAMES, '');
  }
  return out.charAt(0).toLowerCase() + out.slice(1);
}

function sanitizeRequests(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((r) => normalizeRequestPhrase(str(r).replace(/\s+/g, ' ')).slice(0, 500))
    .filter(Boolean)
    .slice(0, 20);
}

function sanitizeStrings(raw, cap = 20, maxLen = 800) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((r) => str(r).replace(/\s+/g, ' ').slice(0, maxLen))
    .filter(Boolean)
    .slice(0, cap);
}

/**
 * Pro se filer contact block for the top-left of page one. Values render
 * when the case data has them; blanks otherwise.
 */
function defaultFilerBlock(data, name, roleLine) {
  return {
    lines: [
      name || BLANK_LINE,
      `Address: ${str(data.address) || str(data.mailingAddress) || BLANK_LINE}`,
      `Phone: ${str(data.phone) || str(data.phoneNumber) || BLANK_SHORT}`,
      `Email: ${str(data.email) || BLANK_SHORT}`,
      roleLine,
    ],
  };
}

/**
 * Verification signature options. Any jurisdiction can pass:
 *   config.verification: {
 *     unsworn: 'text of unsworn declaration under X law',
 *     notaryHeader: ['STATE OF …', 'COUNTY OF …'] // for the sworn variant
 *   }
 * We default to a generic 28 U.S.C. §1746-style unsworn declaration when
 * the jurisdiction doesn't override it.
 */
const GENERIC_UNSWORN =
  'I declare under penalty of perjury that the foregoing is true and correct.';

function defaultSignatureSections(config, name, title, opts = {}) {
  const style = opts.signatureStyle === 'notary' ? 'notary' : 'unsworn';
  const signatureBlock = {
    line: BLANK_LINE,
    name,
    title,
    date: `Date: ${BLANK_SHORT}`,
  };

  if (style === 'notary') {
    const header = (config.verification && config.verification.notaryHeader) || [
      `STATE / PROVINCE OF ${BLANK_SHORT}`,
      `COUNTY OF ${BLANK_SHORT}`,
    ];
    return {
      perjuryStatement: null,
      signatureBlock,
      notaryBlock: [
        ...header,
        '',
        `Subscribed and sworn to before me on this _____ day of ${BLANK_SHORT}, 20____, ` +
          `by ${BLANK_LINE} (name of document signer).`,
        '',
        BLANK_LINE,
        'Notary Public',
        `My commission expires: ${BLANK_SHORT}`,
        '(SEAL)',
      ].join('\n'),
    };
  }

  const unsworn = (config.verification && config.verification.unsworn) || GENERIC_UNSWORN;
  // Canadian jurisdictions (ON, AB) pass locationLabel: '(city and province)'
  // so the sign-block line does not say "state/province" in a country where
  // the concept is only "province". Default keeps the historical
  // US-and-Canada omnibus phrasing for jurisdictions that have not opted in.
  const locationLabel =
    (config.verification && config.verification.locationLabel) || '(city and state/province)';
  return {
    perjuryStatement:
      `${unsworn}\n\nSigned on ${BLANK_SHORT} (date) at ${BLANK_LINE} ${locationLabel}.`,
    signatureBlock,
    notaryBlock: null,
  };
}

// ─── Standard divorce-petition scaffold ──────────────────────────────────────
//
// Topics covering the paragraphs a typical U.S. or Canadian divorce petition
// pleads. Each entry gets a numbered response item; the paragraph number the
// scaffold references is the ordinal in this list, which the user aligns with
// the actual served petition when filing. Jurisdictions can override the list
// via config.scaffoldParagraphs.
const STANDARD_DIVORCE_SCAFFOLD = Object.freeze([
  Object.freeze({
    key: 'jurisdiction',
    topic: "the court's jurisdiction over the parties and this action",
  }),
  Object.freeze({
    key: 'residency',
    topic: 'the residency and venue allegations',
  }),
  Object.freeze({
    key: 'marriage',
    topic: 'the date and place of the marriage',
  }),
  Object.freeze({
    key: 'separation',
    topic: 'the date of separation',
  }),
  Object.freeze({
    key: 'breakdown',
    topic: 'the ground stated for the divorce (irretrievable breakdown or the equivalent)',
  }),
  Object.freeze({
    key: 'children',
    topic: 'the allegations concerning any minor children of the marriage',
  }),
  Object.freeze({
    key: 'property',
    topic: 'the allegations concerning marital assets and property division',
  }),
  Object.freeze({
    key: 'debts',
    topic: 'the allegations concerning marital debts and liabilities',
  }),
  Object.freeze({
    key: 'alimony',
    topic: 'the allegations concerning spousal support or alimony',
  }),
  Object.freeze({
    key: 'fees',
    topic: "the allegations concerning attorney's fees and costs",
  }),
]);

function scaffoldResponseLine(filerLabel, topic) {
  return (
    `Regarding ${topic}: ${filerLabel} ADMITS / DENIES / IS WITHOUT KNOWLEDGE OR ` +
    `INFORMATION SUFFICIENT TO FORM A BELIEF AND THEREFORE DENIES (mark one). ` +
    `Petition paragraph number(s): ${BLANK_SHORT}. Explanation, if any: ${BLANK_LINE}.`
  );
}

// ─── Affirmative defenses ────────────────────────────────────────────────────
//
// Auto-seeds from profile facts. The registry pattern is deliberately open —
// jurisdictions can pass extra defenses via config.affirmativeDefenses(data),
// and the user can pass verbatim strings via data.affirmativeDefenses.

function buildAffirmativeDefenses(data, config) {
  const defenses = [];

  // Prenup — Fla. R. Civ. P. 1.140(b)/(h): unpleaded, waived. Jurisdictions
  // can override the boilerplate via config.prenupDefense(data, meta) — for
  // example, FL's config cites §§ 61.079 / 61.075 explicitly (attorney
  // round-2, Tavita, 2026-08-30).
  if (data.prenupSigned === true) {
    const year =
      str(data.prenupYear) || str(data.prenupDate) || str(data.prenupSignedYear);
    const dateFragment = year ? ` dated ${year}` : ` dated ${BLANK_SHORT}`;
    // Attorney round-3 (Tavita, FL): prenupDefense may now return either a
    // single string (legacy) OR an array of strings so a jurisdiction can
    // split the defense into multiple numbered items (execution, counsel
    // recital, bar-on-inconsistent-claims each as its own defense).
    const override =
      typeof config.prenupDefense === 'function'
        ? config.prenupDefense(data, { year, dateFragment })
        : '';
    if (Array.isArray(override)) {
      for (const line of override) {
        const s = str(line);
        if (s) defenses.push(ensurePeriod(s));
      }
    } else {
      defenses.push(
        str(override) ||
          `PRENUPTIAL AGREEMENT. The parties entered into a valid prenuptial agreement${dateFragment}, ` +
            'which governs the disposition of property and debts between the parties. Any claim ' +
            'inconsistent with the prenuptial agreement is barred, and the agreement is pleaded ' +
            'as an affirmative defense and, where applicable, as a bar to relief.',
      );
    }
  }

  // Postnup — same waiver rule.
  if (data.postnupSigned === true) {
    const year = str(data.postnupYear) || str(data.postnupDate);
    const dateFragment = year ? ` dated ${year}` : ` dated ${BLANK_SHORT}`;
    defenses.push(
      `POSTNUPTIAL AGREEMENT. The parties entered into a valid postnuptial agreement${dateFragment}, ` +
        'which governs the disposition of property and debts between the parties. Any claim ' +
        'inconsistent with the postnuptial agreement is barred.',
    );
  }

  // User-supplied verbatim defenses (sanitized, capped).
  for (const line of sanitizeStrings(data.affirmativeDefenses)) {
    defenses.push(ensurePeriod(line));
  }

  // Jurisdiction-supplied extras.
  if (typeof config.affirmativeDefenses === 'function') {
    for (const line of sanitizeStrings(config.affirmativeDefenses(data) || [])) {
      defenses.push(ensurePeriod(line));
    }
  }

  return defenses;
}

// ─── Counter-petition offer ──────────────────────────────────────────────────
//
// Informational paragraph pointing the user to the counter-petition form when
// they may want affirmative relief but did NOT set includeCounterclaim. The
// jurisdiction supplies the form citation via config.counterPetitionForm.

function buildCounterPetitionOffer(config, filerLabel, opposingLabel) {
  const form = str(config.counterPetitionForm);
  const examples = Array.isArray(config.counterPetitionExamples)
    ? config.counterPetitionExamples.filter(Boolean).join(', ')
    : '';
  const suffix = form ? ` (see ${form})` : '';
  const relief = examples
    ? ` Common examples of affirmative relief include: ${examples}.`
    : '';
  return (
    `NOTE — COUNTER-PETITION AVAILABLE. ${filerLabel} reserves the right to file a ` +
    `Counter-Petition${suffix} seeking affirmative relief in addition to responding to ` +
    `${opposingLabel}'s pleading. A bare Answer without a Counter-Petition may waive ` +
    `affirmative relief.${relief}`
  );
}

/**
 * Factory. `config` fields (all optional except `state` and either `header`
 * or `caption`):
 *
 *   state                two-letter jurisdiction code, e.g. 'FL', 'ON'
 *   filerLabel           default 'Respondent' — 'Defendant' for AB/NY etc
 *   opposingLabel        default 'Petitioner' — 'Plaintiff'/'Applicant' etc
 *   petitionTerm         default 'Petition' — 'Complaint'/'Application' etc
 *   answerTitle          default 'ANSWER'
 *   answerWithCounterTitle
 *                        default 'ANSWER AND COUNTERCLAIM'
 *   counterTitle         default 'COUNTERCLAIM FOR DIVORCE'
 *   caption(data,parties) required (or supply `header` and default caption
 *                        block is generated: Petitioner v. Respondent)
 *   header(data)         short-form: only needed when using default caption
 *   residencyClause(data, parties)
 *                        counterclaim residency recital text
 *   verification         { unsworn, notaryHeader } (see above)
 *   filerBlock(data, name, roleLine)
 *                        default: name / address / phone / email / role
 *   introduction(data, parties)
 *                        default: "I, X, am the [filer]…"
 *   certificateOfService(data, parties)
 *                        default: certificate-of-service line
 *   noteFooter(data)     optional extra text appended after conclusion
 *   scaffoldParagraphs   default STANDARD_DIVORCE_SCAFFOLD — override to
 *                        include (e.g.) jurisdiction-specific waiver
 *                        allegations
 *   includeStandardScaffold
 *                        default true — set false only if the jurisdiction's
 *                        practice is a bare general denial (Texas practice
 *                        historically works that way but even there the
 *                        scaffold is useful once the user has the petition)
 *   affirmativeDefenses(data)
 *                        optional function returning extra defenses to append
 *   counterPetitionForm  citation for the counter-petition form (e.g.
 *                        'Fla. Fam. L.R.P. Form 12.903(b)')
 *   counterPetitionExamples
 *                        array of example affirmative-relief items to list
 *                        in the counter-petition offer
 */
function createAnswerBuilder(config) {
  if (!config || !config.state) {
    throw new Error('createAnswerBuilder: config.state is required');
  }
  const {
    state,
    filerLabel = 'Respondent',
    opposingLabel = 'Petitioner',
    petitionTerm = 'Petition',
    answerTitle = 'ANSWER',
    answerWithCounterTitle = 'ANSWER AND COUNTERCLAIM',
    counterTitle = 'COUNTERCLAIM FOR DIVORCE',
    scaffoldParagraphs = STANDARD_DIVORCE_SCAFFOLD,
    includeStandardScaffold = true,
  } = config;

  const filerBlock = config.filerBlock || defaultFilerBlock;

  const caption =
    config.caption ||
    ((data, parties) => {
      const header =
        typeof config.header === 'function' ? config.header(data) : String(config.header || '');
      const caseNumber = str(data.caseNumber) || BLANK_SHORT;
      const petitioner = upper(parties.petitioner);
      const respondent = upper(parties.respondent);
      const formatted = [
        `${petitioner},`,
        `${opposingLabel},`,
        '',
        'v.',
        '',
        `${respondent},`,
        `${filerLabel}.`,
        '',
        `Case No. ${caseNumber}`,
      ].join('\n');
      return {
        header,
        caseCaption: {
          formatted,
          structured: {
            left: [
              `${petitioner},`,
              `          ${opposingLabel},`,
              '',
              'v.',
              '',
              `${respondent},`,
              `          ${filerLabel}.`,
            ],
            right: [`Case No. ${caseNumber}`],
          },
        },
      };
    });

  const introduction =
    config.introduction ||
    ((data, parties) =>
      // Attorney round-3 (Tavita, FL, 2026-08-30): default intro used to
      // append a hardcoded " for Divorce" after ${petitionTerm}, which
      // duplicated the fragment for every jurisdiction whose petitionTerm
      // already carried "for Divorce" (FL "Petition for Dissolution of
      // Marriage for Divorce", GA "Complaint for Divorce for Divorce",
      // etc.). petitionTerm now stands on its own; jurisdictions whose
      // petitionTerm reads incomplete without the suffix carry it
      // themselves (see e.g. NY 'Verified Complaint').
      `I, ${parties.respondent}, am the ${filerLabel} in this case. I answer the ${petitionTerm} ` +
      `filed by ${parties.petitioner} as follows:`);

  const certificateOfService =
    config.certificateOfService ||
    ((data, parties) =>
      [
        'CERTIFICATE OF SERVICE',
        '',
        `I certify that on ${BLANK_SHORT} (date) I mailed or hand-delivered a copy of this ` +
          `document to ${opposingLabel} or ${opposingLabel}'s attorney at ${BLANK_LINE} (address).`,
      ].join('\n'));

  function baseStructure(sections, opts) {
    return {
      id: crypto.randomUUID(),
      state,
      documentType: 'affidavit',
      kind: 'answer',
      timestamp: new Date(),
      metadata: {
        supportDoc: true,
        kind: 'answer',
        state,
        signatureStyle: opts.signatureStyle === 'notary' ? 'notary' : 'unsworn',
      },
      sections,
    };
  }

  function build(data = {}, opts = {}) {
    const parties = resolveParties(data);
    const { header, caseCaption } = caption(data, parties);
    const includeCounterclaim = data.includeCounterclaim === true;
    const requests = sanitizeRequests(data.answerRequests);

    const items = [];
    let number = 1;
    const pushHeader = (content) => {
      // Attorney round-2 (Marcus, ON): section headings live in their own
      // `section_header` items with NO number so the numbered paragraph flow
      // no longer reads as "1. GENERAL DENIAL / 2. Except..." interleaved.
      items.push({ content, type: 'section_header' });
    };

    // ── (1) General denial — anchor the pleading so unclassified allegations
    //         are NOT deemed admitted (Fla. R. Civ. P. 1.110(e) and the
    //         equivalent rules in every other supported jurisdiction).
    pushHeader('GENERAL DENIAL');
    items.push({
      number: number++,
      content:
        `Except as expressly admitted below, ${filerLabel} denies each and ` +
        `every allegation of the ${petitionTerm}.`,
      type: 'general_denial',
    });

    // ── (2) Per-paragraph responses ──
    const groups = groupPositions(data.answerPositions);
    const hasPositions =
      groups.admit.length > 0 || groups.deny.length > 0 || groups.lack_knowledge.length > 0;

    if (hasPositions) {
      if (groups.admit.length > 0) {
        items.push({
          number: number++,
          content: `${filerLabel} ADMITS the allegations in ${paragraphList(groups.admit)}.`,
          type: 'answer_position',
        });
      }
      if (groups.deny.length > 0) {
        items.push({
          number: number++,
          content: `${filerLabel} DENIES the allegations in ${paragraphList(groups.deny)}.`,
          type: 'answer_position',
        });
      }
      if (groups.lack_knowledge.length > 0) {
        items.push({
          number: number++,
          content:
            `${filerLabel} LACKS KNOWLEDGE OR INFORMATION sufficient to form a belief as to the ` +
            `truth of the allegations in ${paragraphList(groups.lack_knowledge)}, and therefore ` +
            'denies them.',
          type: 'answer_position',
        });
      }
    } else if (includeStandardScaffold) {
      // Emit the standard divorce-petition scaffold. This is the substantive
      // pleading structure a respondent needs when the petition text was not
      // ingested into the tool at Answer-drafting time.
      for (const paragraph of scaffoldParagraphs) {
        items.push({
          number: number++,
          content: scaffoldResponseLine(filerLabel, paragraph.topic),
          type: 'answer_position',
          scaffoldKey: paragraph.key,
        });
      }
    } else {
      items.push({
        number: number++,
        content:
          `${filerLabel} responds to the numbered paragraphs of the ${petitionTerm} as follows: ` +
          `${BLANK_LINE}.`,
        type: 'answer_position',
      });
    }

    // ── (3) Affirmative defenses ──
    const defenses = buildAffirmativeDefenses(data, config);
    if (defenses.length > 0) {
      pushHeader('AFFIRMATIVE DEFENSES');
      items.push({
        number: number++,
        content:
          'The following affirmative defenses are pleaded and, to the ' +
          'extent required by the applicable rules of procedure, are raised now to avoid waiver:',
        type: 'affirmative_defenses_intro',
      });
      for (const line of defenses) {
        items.push({
          number: number++,
          content: line,
          type: 'affirmative_defense',
        });
      }
    }

    // ── (4) Counter-petition offer (only when the user did NOT elect to file
    //         a counterclaim alongside — otherwise the counterclaim itself
    //         supplies the affirmative relief).
    if (!includeCounterclaim) {
      pushHeader('COUNTER-PETITION OFFER');
      items.push({
        number: number++,
        content: buildCounterPetitionOffer(config, filerLabel, opposingLabel),
        type: 'counter_petition_offer',
      });
    }

    // ── (5) User's own requests to the court (transcribed, never synthesized) ──
    for (const request of requests) {
      items.push({
        number: number++,
        content: ensurePeriod(`${filerLabel} asks the court to ${request}`),
        type: 'answer_request',
      });
    }

    // ── (5b) Optional WHEREFORE closing — jurisdictions supply
    //         config.answerWherefore(data, parties). Attorney round-2 (Tavita,
    //         FL): FL Answer must carry a WHEREFORE preserving defenses.
    if (typeof config.answerWherefore === 'function') {
      const wherefore = str(config.answerWherefore(data, parties));
      if (wherefore) {
        items.push({
          number: number++,
          content: wherefore,
          type: 'answer_wherefore',
        });
      }
    }

    // ── (6) Counterclaim (only when the user turned it on) ──
    if (includeCounterclaim) {
      pushHeader(counterTitle);
      items.push({
        number: number++,
        content:
          `For a counterclaim against ${opposingLabel}, ` +
          `${parties.petitioner}, ${filerLabel} alleges:`,
        type: 'counterclaim_intro',
      });

      if (typeof config.residencyClause === 'function') {
        const residency = config.residencyClause(data, parties);
        if (residency) {
          items.push({
            number: number++,
            content: residency,
            type: 'counterclaim_allegation',
          });
        }
      }

      const marriageDate = str(data.marriageDate) || BLANK_SHORT;
      const marriageLocation = str(data.marriageLocation) || str(data.marriagePlace);
      items.push({
        number: number++,
        content:
          `${opposingLabel} and ${filerLabel} were married on ${marriageDate}` +
          (marriageLocation ? ` in ${marriageLocation}.` : '.'),
        type: 'counterclaim_allegation',
      });

      if (str(data.separationDate)) {
        items.push({
          number: number++,
          content: `The parties separated on or about ${str(data.separationDate)}.`,
          type: 'counterclaim_allegation',
        });
      }

      const grounds = str(data.groundsForDivorce);
      items.push({
        number: number++,
        content:
          !grounds || /irreconcilable|irretrievabl|insupportabil|breakdown/i.test(grounds)
            ? (config.noFaultGroundsRecital ||
                'The marriage is irretrievably broken and there is no reasonable prospect of reconciliation.')
            : ensurePeriod(`The ground for divorce on this Counterclaim is: ${grounds}`),
        type: 'counterclaim_allegation',
      });

      const children = Array.isArray(data.children)
        ? data.children.filter((c) => c && typeof c === 'object' && str(c.name))
        : [];
      if (children.length > 0) {
        const childList = children
          // Attorney round-3 (2026-08-30): fall back to year-only when
          // the profile only carries `birthYear` (Marcus ON) or a bare
          // 4-digit year in birthDate.
          .map((c) => `${str(c.name)} (born ${str(c.birthDate) || str(c.dob) || str(c.birthYear) || str(c.birth_year) || BLANK_SHORT})`)
          .join('; ');
        items.push({
          number: number++,
          content: `The following minor children were born to or adopted by the parties: ${childList}.`,
          type: 'counterclaim_allegation',
        });
      } else if (data.hasMinorChildren === false) {
        items.push({
          number: number++,
          content: 'There are no minor children of this marriage.',
          type: 'counterclaim_allegation',
        });
      } else {
        items.push({
          number: number++,
          content: `Minor children of the marriage (names and birth dates), if any: ${BLANK_LINE}.`,
          type: 'counterclaim_allegation',
        });
      }

      const reliefParts = [
        `grant a divorce dissolving the marriage between ${opposingLabel} and ${filerLabel}`,
        ...requests,
        'grant such other and further relief as the court finds fair',
      ];
      const lettered = reliefParts
        .map((part, idx) => `(${String.fromCharCode(97 + idx)}) ${part}`)
        .join('; ');
      items.push({
        number: number++,
        content: `WHEREFORE, on this Counterclaim, ${filerLabel} asks the court to: ${lettered}.`,
        type: 'counterclaim_relief',
      });
    }

    const title = includeCounterclaim ? answerWithCounterTitle : answerTitle;

    const conclusion = certificateOfService(data, parties);

    const signatureRoleLine = `${filerLabel}, Pro Se`;
    const sig = (config.signatureSections || defaultSignatureSections.bind(null, config))(
      parties.respondent,
      filerLabel,
      opts,
    );

    const structure = baseStructure(
      {
        filerBlock: filerBlock(data, parties.respondent, signatureRoleLine),
        header,
        caseCaption,
        title,
        introduction: introduction(data, parties),
        facts: { items },
        conclusion,
        ...sig,
      },
      opts,
    );

    // Canadian jurisdictions: rewrite US-idiom tokens leaking from the shared
    // scaffold and the default caption. Round-2 attorney review (Marcus, ON).
    if (isCanadianState(state)) canadianizeStructure(structure);
    return structure;
  }

  return build;
}

module.exports = {
  createAnswerBuilder,
  isCanadianState,
  canadianize,
  canadianizeStructure,
  // exported for jurisdiction files that want to reuse the same primitives
  BLANK_SHORT,
  BLANK_LINE,
  str,
  upper,
  ensurePeriod,
  resolveParties,
  defaultFilerBlock,
  defaultSignatureSections,
  GENERIC_UNSWORN,
  STANDARD_DIVORCE_SCAFFOLD,
};
