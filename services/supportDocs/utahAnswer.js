// services/supportDocs/utahAnswer.js
// Utah Answer (and optional Counterclaim) to a Petition for Divorce — the
// respondent's side of the case, generated from the user's stored data plus
// the positions they explicitly chose on the /respond page.
//
// Same builder convention as services/supportDocs/utah.js:
// (data, opts) => documentStructure using the generic affidavit `sections`
// shape services/pdfService.js renders (header, caseCaption.formatted, title,
// introduction, facts.items[{number, content}], conclusion, perjuryStatement,
// signatureBlock, notaryBlock). documentType is pinned to 'affidavit' so
// detectDocumentType() never mis-routes to the petition/decree builders.
//
// UPL line: this builder TRANSCRIBES the user's own decisions. It never
// auto-admits or auto-denies a paragraph the user didn't classify, and it
// never synthesizes requests for relief — every position and every request
// comes verbatim (sanitized) from explicit user input.
//
// Signature style: Utah Code 78B-18a unsworn declaration by default;
// { signatureStyle: 'notary' } for the classic sworn block — same contract
// as every other Utah support-doc builder.

const crypto = require('node:crypto');
const { UTAH_UNSWORN_DECLARATION, normalizeCountyName, utahCaption, filerBlock } = require('./utah');

const BLANK_SHORT = '______________';
const BLANK_LINE = '________________________________';

// ─── shared helpers (mirrors utah.js, whose helpers are module-private) ─────

function str(value) {
  return value === undefined || value === null ? '' : String(value).trim();
}

/** The user's own identity fields (GENERAL profile fields). */
function resolveUserName(data) {
  return (
    str(data.affiantName) ||
    [str(data.firstName), str(data.lastName)].filter(Boolean).join(' ')
  );
}

/**
 * Caption parties for the Answer. The caption stays Petitioner v. Respondent,
 * but here the USER is the one who was served — the Respondent — so name
 * resolution flips relative to the petitioner-side builders:
 *
 *  - Explicit data.role === 'petitioner' is the only thing that opts out;
 *    otherwise the user is treated as the respondent (this IS the Answer doc).
 *  - Profiles created before `role` existed stored the user's name under
 *    petitionerName (interviews assumed the user files first). When the
 *    respondent slot is empty and petitionerName matches the user's own
 *    identity fields, the name moves to the respondent slot.
 *  - When the respondent slot is still empty, the user's own name fills it.
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
    petitioner: petitioner || '_________________________________',
    respondent: respondent || '_________________________________',
  };
}


/** Unsworn-declaration (default) or notary signature sections. */
function signatureSections(name, title, opts = {}) {
  const style = opts.signatureStyle === 'notary' ? 'notary' : 'unsworn';
  const signatureBlock = {
    line: BLANK_LINE,
    name,
    title,
    date: `Date: ${BLANK_SHORT}`,
  };

  if (style === 'notary') {
    return {
      perjuryStatement: null,
      signatureBlock,
      notaryBlock: [
        'STATE OF UTAH',
        `COUNTY OF ${BLANK_SHORT}`,
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

  return {
    perjuryStatement:
      `${UTAH_UNSWORN_DECLARATION}\n\n` +
      `Signed on ${BLANK_SHORT} (date) at ${BLANK_LINE} (city and state).`,
    signatureBlock,
    notaryBlock: null,
  };
}

function baseStructure(kind, sections, opts = {}) {
  return {
    id: crypto.randomUUID(),
    state: 'UT',
    documentType: 'affidavit', // pins pdfService.detectDocumentType to the generic path
    kind,
    timestamp: new Date(),
    metadata: {
      supportDoc: true,
      kind,
      state: 'UT',
      signatureStyle: opts.signatureStyle === 'notary' ? 'notary' : 'unsworn',
    },
    sections,
  };
}

// ─── answer-specific helpers ────────────────────────────────────────────────

/**
 * Group the user's explicit paragraph positions into admit / deny /
 * lack_knowledge lists. Anything malformed, unclassified, or with an unknown
 * position value is dropped — never reinterpreted. First classification of a
 * paragraph wins; each group sorts numerically where possible.
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

/** 'paragraph 2' / 'paragraphs 1 and 3' / 'paragraphs 1, 3, and 5'. */
function paragraphList(list) {
  if (list.length === 1) return `paragraph ${list[0]}`;
  if (list.length === 2) return `paragraphs ${list[0]} and ${list[1]}`;
  return `paragraphs ${list.slice(0, -1).join(', ')}, and ${list[list.length - 1]}`;
}

/** User-written relief requests: trimmed, whitespace-collapsed, capped. */
/**
 * Requests are composed into "Respondent asks the court to ${request}", but
 * users phrase them as full asks ("that the court divide the property
 * fairly"), which doubled the frame: "asks the court to that the court
 * divide…". Strip any leading framing so the request reads as a bare verb
 * phrase.
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

/** Ensure a sentence ends with terminal punctuation. */
function ensurePeriod(text) {
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

// ─── Answer (and Counterclaim) to a Petition for Divorce ────────────────────

/**
 * Answer to a Petition for Divorce — signed by the RESPONDENT.
 *
 * data fields read (all optional; blanks for unknowns, never throws):
 *  - role, affiantName/firstName/lastName, petitioner/respondent name fields
 *  - county, caseNumber, keyEvents
 *  - answerPositions: [{ paragraph, position: 'admit'|'deny'|'lack_knowledge' }]
 *  - answerRequests:  [string] — the user's own words, transcribed
 *  - includeCounterclaim: boolean
 *  - counterclaim recitals reuse the petition-template field names
 *    (marriageDate, marriageLocation/marriagePlace, separationDate,
 *    groundsForDivorce, children[{name, birthDate|dob}], hasMinorChildren)
 */
function answerToPetition(data = {}, opts = {}) {
  const parties = resolveParties(data);
  const { header, caseCaption } = utahCaption(data, parties);
  const includeCounterclaim = data.includeCounterclaim === true;
  const requests = sanitizeRequests(data.answerRequests);

  const items = [];
  let number = 1;

  // ── Positions on the petition's numbered paragraphs ──
  // Only paragraphs the USER classified appear. Unclassified paragraphs are
  // simply not mentioned — we never auto-deny (or auto-admit) anything.
  const groups = groupPositions(data.answerPositions);
  const hasPositions =
    groups.admit.length > 0 || groups.deny.length > 0 || groups.lack_knowledge.length > 0;

  if (groups.admit.length > 0) {
    items.push({
      number: number++,
      content: `Respondent ADMITS the allegations in ${paragraphList(groups.admit)}.`,
      type: 'answer_position',
    });
  }
  if (groups.deny.length > 0) {
    items.push({
      number: number++,
      content: `Respondent DENIES the allegations in ${paragraphList(groups.deny)}.`,
      type: 'answer_position',
    });
  }
  if (groups.lack_knowledge.length > 0) {
    items.push({
      number: number++,
      content:
        'Respondent LACKS KNOWLEDGE OR INFORMATION sufficient to form a belief as to the ' +
        `truth of the allegations in ${paragraphList(groups.lack_knowledge)}, and therefore ` +
        'denies them.',
      type: 'answer_position',
    });
  }
  if (!hasPositions) {
    // Sparse data: leave a fill-in line rather than inventing positions.
    items.push({
      number: number++,
      content:
        'Respondent responds to the numbered paragraphs of the Petition as follows: ' +
        `${BLANK_LINE}.`,
      type: 'answer_position',
    });
  }

  // ── The user's own requests to the court (transcribed, never synthesized) ──
  for (const request of requests) {
    items.push({
      number: number++,
      content: ensurePeriod(`Respondent asks the court to ${request}`),
      type: 'answer_request',
    });
  }

  // ── Counterclaim (only when the user turned it on) ──
  if (includeCounterclaim) {
    items.push({
      number: number++,
      content:
        'COUNTERCLAIM FOR DIVORCE\n\n' +
        `For a counterclaim against Petitioner, ${parties.petitioner}, Respondent alleges:`,
      type: 'counterclaim_intro',
    });

    const county = normalizeCountyName(str(data.county)) || BLANK_SHORT;
    items.push({
      number: number++,
      content:
        `Respondent has been a resident of ${county} County, State of Utah, for at least ` +
        'three months immediately before the filing of this Counterclaim.',
      type: 'counterclaim_allegation',
    });

    const marriageDate = str(data.marriageDate) || BLANK_SHORT;
    const marriageLocation = str(data.marriageLocation) || str(data.marriagePlace);
    items.push({
      number: number++,
      content:
        `Petitioner and Respondent were married on ${marriageDate}` +
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
        !grounds || /irreconcilable/i.test(grounds)
          ? 'Irreconcilable differences of the marriage have arisen, and there is no ' +
            'reasonable prospect of reconciliation.'
          : ensurePeriod(`The ground for divorce on this Counterclaim is: ${grounds}`),
      type: 'counterclaim_allegation',
    });

    const children = Array.isArray(data.children)
      ? data.children.filter((c) => c && typeof c === 'object' && str(c.name))
      : [];
    if (children.length > 0) {
      const childList = children
        .map((c) => `${str(c.name)} (born ${str(c.birthDate) || str(c.dob) || BLANK_SHORT})`)
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
      'grant a divorce dissolving the marriage between Petitioner and Respondent',
      ...requests,
      'grant such other and further relief as the court finds fair',
    ];
    const lettered = reliefParts
      .map((part, idx) => `(${String.fromCharCode(97 + idx)}) ${part}`)
      .join('; ');
    items.push({
      number: number++,
      content: `WHEREFORE, on this Counterclaim, Respondent asks the court to: ${lettered}.`,
      type: 'counterclaim_relief',
    });
  }

  const title = includeCounterclaim ? 'ANSWER AND COUNTERCLAIM' : 'ANSWER';

  const conclusion = [
    'CERTIFICATE OF SERVICE',
    '',
    `I certify that on ${BLANK_SHORT} (date) I mailed or hand-delivered a copy of this ` +
      `document to Petitioner or Petitioner's attorney at ${BLANK_LINE} (address).`,
  ].join('\n');

  return baseStructure(
    'answer',
    {
      filerBlock: filerBlock(data, parties.respondent, 'Respondent, Pro Se'),
      header,
      caseCaption,
      title,
      introduction:
        `I, ${parties.respondent}, am the Respondent in this case. I answer the Petition ` +
        `for Divorce filed by ${parties.petitioner} as follows:`,
      facts: { items },
      conclusion,
      ...signatureSections(parties.respondent, 'Respondent', opts),
    },
    opts,
  );
}

module.exports = {
  answerToPetition,
};
