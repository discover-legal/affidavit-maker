// services/supportDocs/ontarioAnswer.js
// Ontario Answer to Application for Divorce.
//
// Substantive reference: Family Law Rules, O. Reg. 114/99, Form 10 (Answer).
// Ontario parties are Applicant / Respondent (see
// templates/states/ontario/DivorcePetitionTemplate.js). Divorce ground:
// Divorce Act, RSC 1985, c. 3 (2nd Supp.), s. 8.
//
// Form 10 structural rule (Family Law Rules, r.10 + Form 10 instructions):
// an Answer sets out three distinct things —
//   PART A. the respondent's response to EACH claim in the Application
//           (agree / do not agree / no knowledge);
//   PART B. the important facts supporting those responses;
//   PART C. the claims (if any) the respondent makes against the applicant.
// The generic base builder only produces per-paragraph admit/deny lines and
// a free-standing counterclaim; the wrapper below re-slots those items into
// the three lettered sub-sections Form 10 actually requires, and passes a
// Canadian location label (city and province) to the signature block so
// the sign-off does not say "state/province".
//
// Attorney round-2 additions (Marcus, ON, 2026-08-30):
//   - PART A pre-populates ADMITS lines from divorce facts already in the
//     profile (marriage date, separation, one-year separation ground,
//     children, jurisdiction) instead of a page of blank checkboxes.
//   - PART C DEFAULTS to a claim template with placeholders (never "makes
//     no claim") so a bare Answer does not accidentally waive corollary
//     relief; contested parenting facts auto-populate a Divorce Act s.16
//     claim; the affirmative no-claim statement is emitted only when the
//     profile sets `respondentClaimsNothing === true`.
//   - PART A/B/C headings render as `form10_header` items OUT of the
//     numbered flow so the pleading no longer reads as "1. PART A / 2.
//     Respondent ADMITS / 14. PART B".

'use strict';

const { createAnswerBuilder, BLANK_SHORT, BLANK_LINE, canadianize } = require('./BaseAnswerTemplate');

const ONTARIO_AFFIRMATION =
  'I affirm that the information set out above is true, to the best of my ' +
  'knowledge and belief. (Family Law Rules, O. Reg. 114/99, Rule 14.)';

const baseBuilder = createAnswerBuilder({
  state: 'ON',
  // Ontario Form 10 has its own Part A pre-admission builder
  // (`preAdmittedFactLines` below), so opt out of the Base pre-admit map
  // added round-4 to avoid emitting the same admission twice.
  suppressPreAdmit: true,
  filerLabel: 'Respondent',
  opposingLabel: 'Applicant',
  petitionTerm: 'Application',
  answerTitle: 'ANSWER (Form 10)',
  answerWithCounterTitle: 'ANSWER AND CLAIM (Form 10)',
  counterTitle: 'RESPONDENT’S CLAIM',
  counterPetitionForm: 'Family Law Rules, O. Reg. 114/99, Form 10 — Respondent’s Claim section',
  counterPetitionExamples: [
    'a change of surname (Divorce Act, s. 15.2 and provincial equivalents)',
    'costs (Family Law Rules, Rule 24)',
    'equalization of net family property (Family Law Act, s. 5)',
    'spousal support (Divorce Act, s. 15.2; Family Law Act, s. 30)',
    'child support and a parenting order (Divorce Act, ss. 15.1, 16)',
  ],
  noFaultGroundsRecital:
    'The Applicant and Respondent have lived separate and apart for at least one year ' +
    'immediately preceding the determination of the divorce proceeding. ' +
    '(Divorce Act, s. 8(2)(a).)',
  header(data) {
    const location = String(data.county || data.courtLocation || '').trim() || BLANK_SHORT;
    const fileNo =
      String(
        data.caseNumber ||
          data.courtFileNo ||
          data.courtFileNumber ||
          data.court_file_no ||
          data.fileNo ||
          '',
      ).trim() || BLANK_SHORT;
    return (
      `ONTARIO SUPERIOR COURT OF JUSTICE — ${location.toUpperCase()}\n` +
      `Court File No.: ${fileNo}`
    );
  },
  residencyClause() {
    return (
      'Either the Applicant or the Respondent has been habitually resident in the Province of ' +
      'Ontario for at least one year immediately preceding the commencement of this proceeding. ' +
      '(Divorce Act, s. 3(1).)'
    );
  },
  certificateOfService(data) {
    return (
      'AFFIDAVIT OF SERVICE (Form 6B): the Respondent will serve this Answer on the Applicant ' +
      'or the Applicant’s lawyer of record in accordance with Rule 6 of the Family Law Rules, ' +
      `on ${BLANK_SHORT} (date), and file proof of service with the court.`
    );
  },
  verification: {
    unsworn: ONTARIO_AFFIRMATION,
    notaryHeader: ['PROVINCE OF ONTARIO', `MUNICIPALITY OF ${BLANK_SHORT}`],
    locationLabel: '(city and province)',
  },
});

// ─── Form 10 scaffold ───────────────────────────────────────────────────────

function coerceStringList(value) {
  if (!value) return [];
  const arr = Array.isArray(value) ? value : [value];
  return arr
    .map((v) => (v == null ? '' : String(v).trim()))
    .filter(Boolean)
    .slice(0, 30);
}

function supportingFacts(data) {
  return coerceStringList(
    data.answerSupportingFacts ||
      data.supportingFacts ||
      data.answerImportantFacts ||
      data.importantFacts,
  );
}

function trimStr(v) {
  return v == null ? '' : String(v).trim();
}

/**
 * Build pre-populated Part A ADMITS lines from divorce facts already in the
 * profile. Marcus (ON, round 2): admitted marriage date, separation, kids,
 * one-year separation ground, and consented to the divorce itself in chat —
 * but the Answer's scaffold rendered every checkbox blank. When a fact is
 * present we render the admission with the fact recited.
 *
 * Returns [{ topic, admission }]. Only fires when the caller did not supply
 * explicit `answerPositions`.
 */
function preAdmittedFactLines(data) {
  const lines = [];
  const jurisdictionOk =
    data.residencyOntario === true ||
    /(^|\W)ontario(\W|$)/i.test(trimStr(data.residencyProvince)) ||
    /(^|\W)on(\W|$)/i.test(trimStr(data.state));
  if (jurisdictionOk) {
    lines.push({
      topic: "the court's jurisdiction",
      admission:
        'The Respondent ADMITS the jurisdiction of this Court, at least one party having ' +
        'been habitually resident in Ontario for the one year immediately preceding the ' +
        'commencement of this proceeding (Divorce Act, s. 3(1)).',
    });
  }
  const marriageDate = trimStr(data.marriageDate);
  if (marriageDate) {
    const where = trimStr(data.marriageLocation) || trimStr(data.marriagePlace);
    lines.push({
      topic: 'the date and place of the marriage',
      admission:
        `The Respondent ADMITS the allegation that the parties were married on ${marriageDate}` +
        (where ? ` in ${where}.` : '.'),
    });
  }
  const separationDate = trimStr(data.separationDate);
  if (separationDate) {
    lines.push({
      topic: 'the date of separation',
      admission:
        `The Respondent ADMITS that the parties separated on or about ${separationDate} ` +
        'and have lived separate and apart since that date.',
    });
  }
  const ground = trimStr(data.groundsForDivorce);
  const oneYearSep =
    data.oneYearSeparation === true ||
    /one[- ]year|1[- ]year|breakdown|separat/i.test(ground);
  if (oneYearSep) {
    lines.push({
      topic: 'the ground stated for the divorce (one-year separation)',
      admission:
        'The Respondent ADMITS that the sole ground alleged — that the parties have lived ' +
        'separate and apart for at least one year immediately preceding the determination of ' +
        'the divorce proceeding — is made out (Divorce Act, s. 8(2)(a)) and CONSENTS to the ' +
        'divorce itself, reserving the corollary claims set out in Part C.',
    });
  }
  const children = Array.isArray(data.children)
    ? data.children.filter((c) => c && typeof c === 'object' && trimStr(c.name))
    : [];
  if (children.length > 0) {
    const list = children
      // Attorney round-3 (2026-08-30): Marcus ON transcript carried
      // only `birthYear`; render that rather than a blank.
      .map((c) => `${trimStr(c.name)} (born ${trimStr(c.birthDate) || trimStr(c.dob) || trimStr(c.birthYear) || trimStr(c.birth_year) || BLANK_SHORT})`)
      .join('; ');
    lines.push({
      topic: 'the allegations concerning any minor children of the marriage',
      admission:
        `The Respondent ADMITS the existence of the following minor children of the marriage: ${list}.`,
    });
  } else if (data.hasMinorChildren === false) {
    lines.push({
      topic: 'the allegations concerning any minor children of the marriage',
      admission:
        'The Respondent ADMITS that there are no minor children of this marriage.',
    });
  }
  return lines;
}

/**
 * Build Part C claim items. Attorney round-2 rule: default to a claim
 * template with placeholders so the Answer never accidentally waives
 * corollary relief. Only render "makes no claim" when the profile
 * affirmatively says the respondent seeks nothing (`respondentClaimsNothing`).
 * Contested-parenting facts (custody_dispute_position et al.) auto-populate.
 */
function buildOntarioClaims(data) {
  if (data.respondentClaimsNothing === true) {
    return [
      {
        content:
          'The Respondent affirmatively makes no claim against the Applicant in this Answer ' +
          'and understands that a bare Answer without claims may waive corollary relief.',
        type: 'form10_claim_waived',
      },
    ];
  }

  const claims = [];
  const parenting = trimStr(
    data.custody_dispute_position ||
      data.custodyDisputePosition ||
      data.parentingDisputePosition ||
      data.parenting_dispute_position ||
      data.contestedParentingPosition,
  );
  if (parenting) {
    claims.push({
      content:
        `The Respondent CLAIMS a parenting order under sections 16 and 16.1 of the Divorce ` +
        `Act, RSC 1985, c. 3, on the following basis: ${parenting} The specific parenting ` +
        `time schedule, decision-making responsibility, and communication protocol will be ` +
        `set out in a proposed parenting order to be filed with this Court.`,
      type: 'form10_claim',
    });
  }

  if (data.claimSpousalSupport === true) {
    claims.push({
      content:
        'The Respondent CLAIMS spousal support pursuant to s. 15.2 of the Divorce Act, RSC ' +
        '1985, c. 3, in an amount and duration to be determined by this Court on the evidence.',
      type: 'form10_claim',
    });
  }

  if (data.claimChildSupport === true) {
    claims.push({
      content:
        'The Respondent CLAIMS child support pursuant to s. 15.1 of the Divorce Act, RSC ' +
        '1985, c. 3, and the Federal Child Support Guidelines, SOR/97-175.',
      type: 'form10_claim',
    });
  }

  if (data.claimEqualization === true) {
    claims.push({
      content:
        'The Respondent CLAIMS an equalization of net family property pursuant to s. 5 of ' +
        'the Family Law Act, RSO 1990, c. F.3.',
      type: 'form10_claim',
    });
  }

  if (claims.length === 0) {
    // Default claim template — preserves corollary relief instead of waiving it.
    claims.push({
      content:
        `The Respondent RESERVES and CLAIMS the following corollary relief against the ` +
        `Applicant (complete before filing): ${BLANK_LINE}. Common claims include a ` +
        `parenting order (Divorce Act, ss. 16, 16.1), child support (s. 15.1) and the ` +
        `Federal Child Support Guidelines, spousal support (s. 15.2), equalization of net ` +
        `family property (Family Law Act, RSO 1990, c. F.3, s. 5), and costs (Family Law ` +
        `Rules, r. 24). ` +
        // Attorney round-3 (2026-08-30): removed a leaked developer
        // instruction ("set respondentClaimsNothing = true...") that
        // was rendering into the client-facing Form 10. Replaced with
        // plain-English drafter guidance.
        `If the Respondent seeks no corollary relief, delete this paragraph and ` +
        `substitute the plain no-claim recital before filing.`,
      type: 'form10_claim_scaffold',
    });
  }
  return claims;
}

function scaffoldForm10(doc, data) {
  if (!doc || !doc.sections || !doc.sections.facts) return doc;
  const originalItems = Array.isArray(doc.sections.facts.items)
    ? doc.sections.facts.items
    : [];

  // Bucket items by role:
  //   PART A — every response line (admit / deny / no knowledge / free-form)
  //            plus the drafter's own requests keep the numbered flow;
  //   PART C — anything the base tagged as counterclaim_* becomes a
  //            "Claim by the Respondent" line.
  const responseItems = [];
  const requestItems = [];
  const counterclaimItems = [];
  for (const it of originalItems) {
    if (!it || typeof it !== 'object') continue;
    const t = String(it.type || '');
    // Drop base-template heading rows — Form 10 supplies its own PART A/B/C.
    if (t === 'section_header') continue;
    if (t.startsWith('counterclaim')) counterclaimItems.push(it);
    else if (t === 'answer_request') requestItems.push(it);
    else responseItems.push(it);
  }

  const explicitPositions = Array.isArray(data.answerPositions) && data.answerPositions.length > 0;
  const preAdmitted = explicitPositions ? [] : preAdmittedFactLines(data);
  const admittedTopics = new Set(preAdmitted.map((entry) => entry.topic));

  const partA = { title: 'PART A — RESPONSES TO THE APPLICANT’S CLAIMS', items: [] };
  if (responseItems.length === 0 && preAdmitted.length === 0) {
    partA.items.push({
      content:
        `Respondent responds to the numbered paragraphs of the Application as follows: ` +
        `${BLANK_LINE}. ` +
        `(For each paragraph, state whether the Respondent AGREES, DOES NOT AGREE, or has ` +
        `NO KNOWLEDGE of the facts alleged. Family Law Rules, Rule 10.)`,
      type: 'answer_position',
    });
  } else {
    for (const entry of preAdmitted) {
      partA.items.push({
        content: entry.admission,
        type: 'answer_position',
        preAdmitted: true,
      });
    }
    for (const it of responseItems) {
      // Skip generic scaffold rows whose topic we already pre-admitted.
      const topic = it && typeof it.content === 'string' ? it.content : '';
      const dropped = [...admittedTopics].some((t) => topic.includes(t));
      if (dropped) continue;
      partA.items.push({ ...it });
    }
  }
  for (const it of requestItems) partA.items.push({ ...it });

  const partB = { title: 'PART B — IMPORTANT FACTS SUPPORTING THE RESPONSES', items: [] };
  const facts = supportingFacts(data);
  if (facts.length === 0) {
    partB.items.push({
      content:
        `Important facts supporting the Respondent’s responses: ${BLANK_LINE}. ` +
        `(Set out concisely the facts the Respondent relies on for each response above. ` +
        `Family Law Rules, Form 10.)`,
      type: 'form10_fact',
    });
  } else {
    facts.forEach((text) => partB.items.push({ content: text, type: 'form10_fact' }));
  }

  const partC = { title: 'PART C — CLAIMS BY THE RESPONDENT', items: [] };
  if (counterclaimItems.length > 0) {
    partC.items.push({
      content: 'RESPONDENT’S CLAIM',
      type: 'form10_claim_subheader',
    });
    counterclaimItems.forEach((it) => partC.items.push({ ...it }));
  } else {
    for (const claim of buildOntarioClaims(data)) partC.items.push(claim);
  }

  // Flatten A → B → C. PART A/B/C headers are `form10_header` items OUT of
  // the numbered flow (no `number`). Numbered content items retain a 1..N
  // sequence in the order they appear in the facts list.
  const flat = [];
  let n = 1;
  for (const part of [partA, partB, partC]) {
    flat.push({ content: part.title, type: 'form10_header' });
    for (const it of part.items) {
      if (it.type === 'form10_claim_subheader') {
        flat.push({ ...it });
      } else {
        flat.push({ ...it, number: n++ });
      }
    }
  }
  doc.sections.facts.items = flat;
  doc.sections.facts.form10 = { partA, partB, partC };

  // Re-canadianize the strings we just assembled: BaseAnswerTemplate.build()
  // already ran canadianize on the pre-scaffold structure, but this function
  // added new content afterwards. Belt and suspenders.
  for (const it of doc.sections.facts.items) {
    if (it && typeof it.content === 'string') it.content = canadianize(it.content);
  }
  return doc;
}

function answerToPetition(data = {}, opts = {}) {
  const doc = baseBuilder(data, opts);
  return scaffoldForm10(doc, data);
}

module.exports = { answerToPetition };
