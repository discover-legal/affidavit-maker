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
// This base is a NEW, shared implementation — utahAnswer.js keeps its own
// specialized wording (unsworn declaration under Utah Code 78B-18a) and is
// left untouched by design.
//
// UPL line: builders TRANSCRIBE the user's own decisions. They never
// auto-admit or auto-deny an unclassified paragraph, and they never
// synthesize requests for relief. Positions and requests always come
// verbatim (sanitized) from explicit user input.

'use strict';

const crypto = require('node:crypto');

const BLANK_SHORT = '______________';
const BLANK_LINE = '________________________________';

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
  return {
    perjuryStatement:
      `${unsworn}\n\nSigned on ${BLANK_SHORT} (date) at ${BLANK_LINE} (city and state/province).`,
    signatureBlock,
    notaryBlock: null,
  };
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
      `I, ${parties.respondent}, am the ${filerLabel} in this case. I answer the ${petitionTerm} ` +
      `for Divorce filed by ${parties.petitioner} as follows:`);

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

    // ── Positions on the petition's numbered paragraphs ──
    const groups = groupPositions(data.answerPositions);
    const hasPositions =
      groups.admit.length > 0 || groups.deny.length > 0 || groups.lack_knowledge.length > 0;

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
    if (!hasPositions) {
      items.push({
        number: number++,
        content:
          `${filerLabel} responds to the numbered paragraphs of the ${petitionTerm} as follows: ` +
          `${BLANK_LINE}.`,
        type: 'answer_position',
      });
    }

    // ── User's own requests to the court (transcribed, never synthesized) ──
    for (const request of requests) {
      items.push({
        number: number++,
        content: ensurePeriod(`${filerLabel} asks the court to ${request}`),
        type: 'answer_request',
      });
    }

    // ── Counterclaim (only when the user turned it on) ──
    if (includeCounterclaim) {
      items.push({
        number: number++,
        content:
          `${counterTitle}\n\nFor a counterclaim against ${opposingLabel}, ` +
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

    return baseStructure(
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
  }

  return build;
}

module.exports = {
  createAnswerBuilder,
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
};
