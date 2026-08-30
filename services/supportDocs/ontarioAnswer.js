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

'use strict';

const { createAnswerBuilder, BLANK_SHORT, BLANK_LINE } = require('./BaseAnswerTemplate');

const ONTARIO_AFFIRMATION =
  'I affirm that the information set out above is true, to the best of my ' +
  'knowledge and belief. (Family Law Rules, O. Reg. 114/99, Rule 14.)';

const baseBuilder = createAnswerBuilder({
  state: 'ON',
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
    // Court File No. is often stored under a legacy alias — accept them all.
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
    // Canadian sign-off says "city and province" — not "state/province".
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
  // Accept the several key names the interview / profile uses.
  return coerceStringList(
    data.answerSupportingFacts ||
      data.supportingFacts ||
      data.answerImportantFacts ||
      data.importantFacts,
  );
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
    if (t.startsWith('counterclaim')) counterclaimItems.push(it);
    else if (t === 'answer_request') requestItems.push(it);
    else responseItems.push(it);
  }

  // Response items keep their `answer_position` type so external filters
  // (jurisdictionAnswers.test.js, downstream analytics) continue to find
  // them. Only the items are re-ordered and header sentinels inserted.
  const partA = { title: 'PART A — RESPONSES TO THE APPLICANT’S CLAIMS', items: [] };
  if (responseItems.length === 0) {
    partA.items.push({
      content:
        `Respondent responds to the numbered paragraphs of the Application as follows: ` +
        `${BLANK_LINE}. ` +
        `(For each paragraph, state whether the Respondent AGREES, DOES NOT AGREE, or has ` +
        `NO KNOWLEDGE of the facts alleged. Family Law Rules, Rule 10.)`,
      type: 'answer_position',
    });
  } else {
    for (const it of responseItems) partA.items.push({ ...it });
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
  if (counterclaimItems.length === 0) {
    partC.items.push({
      content:
        `The Respondent makes no claim against the Applicant in this Answer. ` +
        `(If the Respondent wishes to make a claim — for example, parenting time, ` +
        `child support, spousal support, or equalization of net family property — set out ` +
        `the claim here.)`,
      type: 'form10_claim_none',
    });
  } else {
    counterclaimItems.forEach((it) => partC.items.push({ ...it }));
  }

  // Flatten A → B → C with a sequential number on every item, including
  // section headers. External invariants (jurisdictionAnswers.test.js line
  // 127) require `item.number === idx + 1` for every item in the facts
  // list — headers included, so we number them too.
  const flat = [];
  let n = 1;
  for (const part of [partA, partB, partC]) {
    flat.push({ number: n++, content: part.title, type: 'form10_header' });
    for (const it of part.items) flat.push({ ...it, number: n++ });
  }
  doc.sections.facts.items = flat;
  // Expose the true structure so tests (and any future structured
  // renderer) can inspect the parts directly.
  doc.sections.facts.form10 = { partA, partB, partC };
  return doc;
}

function answerToPetition(data = {}, opts = {}) {
  const doc = baseBuilder(data, opts);
  return scaffoldForm10(doc, data);
}

module.exports = { answerToPetition };
