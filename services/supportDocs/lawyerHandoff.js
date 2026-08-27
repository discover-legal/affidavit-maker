// services/supportDocs/lawyerHandoff.js
// Case summary for attorney review — STATE-AGNOSTIC (no jurisdiction cites).
//
// The app repeatedly tells users "this is a moment to at least consult a
// lawyer"; this document makes acting on that easy: a case summary a
// limited-scope attorney can absorb in ten minutes. It is NOT a court
// filing — no caption or court header (the same not-a-filing style as the
// finalization prep sheet), and no signature/perjury block because nothing
// in it is sworn.
//
// Builder convention matches services/supportDocs/utah.js:
// (data, opts) => documentStructure using the generic `sections` shape that
// services/pdfService.js renders on its affidavit path. documentType is
// pinned to 'affidavit' so detectDocumentType() never mis-routes it.
// Every section is data-driven and skips cleanly when its data is absent;
// the builder never throws on empty data.

const crypto = require('node:crypto');
const { totalOf } = require('../../utils/labeledAmounts');
const { resolvePartyIncomes } = require('./partyIncome');
const { normalizeCountyName, listText } = require('./utah');

const BLANK_SHORT = '______________';
const BLANK_LINE = '________________________________';
const QUOTE_MAX = 200;

// ─── helpers ─────────────────────────────────────────────────────────────────

function str(value) {
  return value === undefined || value === null ? '' : String(value).trim();
}

/** Parse '$3,200', '3200', 3200 → 3200. Anything unparseable → 0. */
function parseAmount(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const n = Number(String(value ?? '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

/** Format as '$X,XXX' (cents kept only when present). */
function formatMoney(amount) {
  const n = parseAmount(amount);
  return `$${n.toLocaleString('en-US', {
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

function cleanChildren(data) {
  return Array.isArray(data.children)
    ? data.children.filter((c) => c && typeof c === 'object' && str(c.name))
    : [];
}

/** Birth year from a child record ('2015-04-02' → '2015'; birthYear wins). */
function birthYearOf(child) {
  const explicit = str(child.birthYear);
  if (explicit) return explicit;
  const match = str(child.dob).match(/\b(19|20)\d{2}\b/);
  return match ? match[0] : '';
}

/** First keyEvents entry whose label matches the pattern; returns its date or ''. */
function findEventDate(data, pattern) {
  const events = Array.isArray(data.keyEvents) ? data.keyEvents : [];
  const hit = events.find((e) => e && typeof e === 'object' && pattern.test(str(e.label)));
  return hit ? str(hit.date) : '';
}

/**
 * keyEvents as dated lines. Sorted ascending when every date parses;
 * otherwise the original order is kept (a partial sort would scramble the
 * user's narrative order).
 */
function timelineLines(data) {
  const events = (Array.isArray(data.keyEvents) ? data.keyEvents : []).filter(
    (e) => e && typeof e === 'object' && (str(e.label) || str(e.date)),
  );
  if (events.length === 0) return [];
  const stamped = events.map((e) => ({
    label: str(e.label) || '(event)',
    date: str(e.date),
    time: Date.parse(str(e.date)),
  }));
  const allParseable = stamped.every((e) => Number.isFinite(e.time));
  if (allParseable) stamped.sort((a, b) => a.time - b.time);
  return stamped.map((e) => `${e.date || BLANK_SHORT} — ${e.label}`);
}

/** Truncate a source quote to QUOTE_MAX chars (ellipsis when cut). */
function truncateQuote(quote) {
  const q = str(quote);
  return q.length > QUOTE_MAX ? `${q.slice(0, QUOTE_MAX - 1)}…` : q;
}

/**
 * Itemized money lines from a breakdown ([{label, amount, person?}]),
 * indented under their section heading.
 */
function moneyLines(breakdown) {
  const rows = Array.isArray(breakdown)
    ? breakdown.filter((it) => it && typeof it === 'object' && (str(it.label) || it.amount !== undefined))
    : [];
  return rows.map((it) => {
    const person = str(it.person) ? ` (${str(it.person)})` : '';
    return `  - ${str(it.label) || 'Item'}${person}: ${formatMoney(it.amount)}`;
  });
}

// ─── section builders (each returns [] when its data is absent) ─────────────

function snapshotLines(data) {
  const lines = [];
  const petitioner = str(data.petitionerName) ||
    [str(data.petitionerFirstName), str(data.petitionerLastName)].filter(Boolean).join(' ');
  const respondent = str(data.respondentName) ||
    [str(data.respondentFirstName), str(data.respondentLastName)].filter(Boolean).join(' ');
  if (petitioner || respondent) {
    lines.push(
      `Parties: ${petitioner || BLANK_SHORT} (petitioner) and ${respondent || BLANK_SHORT} (respondent).`,
    );
  }
  const state = str(data.state);
  const county = normalizeCountyName(str(data.county));
  if (state || county) {
    lines.push(`Location: ${[county && `${county} County`, state].filter(Boolean).join(', ')}.`);
  }
  const matter = str(data.matterType) || str(data.matter);
  if (matter) lines.push(`Matter type: ${matter}.`);
  if (str(data.marriageDate)) lines.push(`Married: ${str(data.marriageDate)}.`);
  if (str(data.separationDate)) lines.push(`Separated: ${str(data.separationDate)}.`);
  const children = cleanChildren(data);
  if (children.length > 0) {
    const listed = children
      .map((c) => {
        const year = birthYearOf(c);
        return year ? `${str(c.name)} (born ${year})` : str(c.name);
      })
      .join('; ');
    lines.push(`Children: ${listed}.`);
    const withWhom =
      str(data.childrenLiveWith) || str(data.childrenCurrentlyWith) || str(data.custodyArrangement);
    if (withWhom) lines.push(`The children are currently with: ${withWhom}.`);
  }
  return lines;
}

function accountItems(data) {
  const facts = Array.isArray(data.profileFacts) ? data.profileFacts : [];
  return facts
    .filter((f) => f && typeof f === 'object' && str(f.content))
    .map((f) => {
      const parts = [str(f.content)];
      if (str(f.sourceQuote)) {
        parts.push(`    User's own words: "${truncateQuote(f.sourceQuote)}"`);
      }
      return parts.join('\n');
    });
}

function financeLines(data) {
  const lines = [];
  const incomeItems = moneyLines(data.incomeBreakdown);
  // Per-party derivation (services/supportDocs/partyIncome.js): a lawyer
  // reading "Total monthly income" must know whose income it is — a legacy
  // household scalar is never presented as one person's figure.
  const derived = resolvePartyIncomes(data);
  const p = derived.petitioner.amount;
  const r = derived.respondent.amount;
  if (p !== null && r !== null) {
    lines.push(
      `Monthly income — petitioner: ${formatMoney(p)}; respondent: ${formatMoney(r)}; ` +
        `combined: ${formatMoney(p + r)}.`,
      ...incomeItems,
    );
  } else if (r !== null) {
    lines.push(
      `Respondent's monthly income: ${formatMoney(r)} (petitioner's not on file).`,
      ...incomeItems,
    );
  } else if (p !== null) {
    lines.push(`Total monthly income: ${formatMoney(p)}.`, ...incomeItems);
  } else if (incomeItems.length > 0) {
    lines.push('Monthly income (itemized; person not identified):', ...incomeItems);
  }
  const expenseItems = moneyLines(data.expenseBreakdown);
  const expenseTotal = expenseItems.length
    ? totalOf(data.expenseBreakdown)
    : parseAmount(data.monthlyExpenses);
  if (expenseItems.length > 0 || expenseTotal > 0) {
    lines.push(`Total monthly expenses: ${formatMoney(expenseTotal)}.`, ...expenseItems);
  }
  if (str(data.assetsDescription)) lines.push(`Assets: ${str(data.assetsDescription)}.`);
  const debts = [];
  if (str(data.debtsDescription)) debts.push(str(data.debtsDescription));
  // listText: extraction stores debts as arrays; legacy saves as strings.
  if (listText(data.petitionerDebts)) debts.push(`petitioner: ${listText(data.petitionerDebts)}`);
  if (listText(data.respondentDebts)) debts.push(`respondent: ${listText(data.respondentDebts)}`);
  if (debts.length > 0) lines.push(`Debts: ${debts.join('; ')}.`);
  return lines;
}

function documentLines(data) {
  return (Array.isArray(data.generatedDocuments) ? data.generatedDocuments : [])
    .map((d) => str(d))
    .filter(Boolean)
    .map((d) => `  - ${d}`);
}

/**
 * Question scaffold drawn from what is TRUE in the data. Every entry is a
 * QUESTION the user might ask the lawyer — never an assessment of the case.
 */
function questionItems(data) {
  const questions = [];
  const children = cleanChildren(data);
  if (children.length > 0) {
    questions.push(
      'What parenting schedule (parent-time) options should I be thinking about for my children, and how do I ask the court for them?',
      'How would child support be calculated with our incomes, and what paperwork does the court need for that?',
    );
  }
  const hasProperty =
    str(data.assetsDescription) || str(data.propertyAgreement) || str(data.debtsDescription) ||
    listText(data.petitionerDebts) || listText(data.respondentDebts);
  if (hasProperty) {
    questions.push(
      'How are property and debts like ours usually divided, and is our division agreement (or my proposal) reasonable to ask for?',
    );
  }
  if (findEventDate(data, /serv/i)) {
    questions.push(
      'Given the date of service in my timeline, what deadlines am I facing right now, and what happens if I miss one?',
    );
  }
  const income = totalOf(data.incomeBreakdown) || parseAmount(data.monthlyIncome);
  const expenses = totalOf(data.expenseBreakdown) || parseAmount(data.monthlyExpenses);
  if (income > 0 || expenses > 0) {
    questions.push(
      'Based on my income and expenses, is spousal support (alimony) something I should ask for — or expect to be asked for?',
    );
  }
  // Always-relevant scaffold for a limited-scope consult.
  questions.push(
    'Can you review the documents I have prepared so far and tell me what is missing or wrong before I file?',
    'What could you handle for me on a limited-scope (unbundled) basis, and what would that cost?',
  );
  return questions;
}

// ─── the builder ─────────────────────────────────────────────────────────────

/**
 * Case summary for attorney review. State-agnostic; not a court filing;
 * nothing in it is sworn (no signature, perjury, or notary block).
 */
function lawyerHandoff(data = {}, opts = {}) {
  const items = [];
  const push = (content) => items.push({ number: items.length + 1, content, type: 'summary' });
  const pushSection = (heading, contents) => {
    contents.forEach((content, idx) => {
      push(idx === 0 ? `${heading}\n${content}` : content);
    });
  };

  const snapshot = snapshotLines(data);
  if (snapshot.length > 0) pushSection('SNAPSHOT', [snapshot.join('\n')]);

  const timeline = timelineLines(data);
  if (timeline.length > 0) pushSection('TIMELINE', [timeline.join('\n')]);

  const account = accountItems(data);
  if (account.length > 0) {
    pushSection(
      "THE USER'S ACCOUNT\nThe statements below are the user's account of events, in their words as recorded by the software:",
      account,
    );
  }

  const finances = financeLines(data);
  if (finances.length > 0) pushSection('FINANCES (monthly)', [finances.join('\n')]);

  const docs = documentLines(data);
  if (docs.length > 0) {
    pushSection('DOCUMENTS PREPARED SO FAR (with this software; none have been reviewed by a lawyer)', [
      docs.join('\n'),
    ]);
  }

  pushSection(
    'QUESTIONS THE USER MAY WANT TO ASK YOU\nThese are prompts for the consultation, not an assessment of the case:',
    questionItems(data).map((q) => `- ${q}`),
  );

  const introduction = [
    'IMPORTANT: This summary was prepared by the user with document-preparation software. ' +
      'It is NOT a court filing, and it is not legal advice.',
    '',
    'Purpose: give a consulting or limited-scope attorney a ten-minute picture of this case — ' +
      'the parties, the timeline, the user\'s own account, and their finances — so the ' +
      'consultation can start from facts instead of paperwork.',
  ].join('\n');

  const conclusion = [
    `Prepared on: ${BLANK_SHORT} (date — fill in when you print or send this)`,
    '',
    'A reminder for the user: many lawyers offer one-time consultations and limited-scope ' +
      '("unbundled") help — you can hire a lawyer for a single question or document without ' +
      'hiring one for the whole case. If cost is a barrier, LawHelp.org lists free and ' +
      `low-cost legal help by state. Notes from the consultation: ${BLANK_LINE}`,
  ].join('\n');

  const state = str(data.state).toUpperCase() || undefined;

  return {
    id: crypto.randomUUID(),
    state,
    documentType: 'affidavit', // pins pdfService.detectDocumentType to the generic path
    kind: 'lawyer_handoff',
    timestamp: new Date(),
    metadata: {
      supportDoc: true,
      kind: 'lawyer_handoff',
      state,
      signatureStyle: 'none', // nothing here is sworn
    },
    sections: {
      header: null,
      caseCaption: null,
      title: 'CASE SUMMARY FOR ATTORNEY REVIEW',
      introduction,
      facts: { items },
      conclusion,
      perjuryStatement: null,
      signatureBlock: null,
      notaryBlock: null,
    },
  };
}

module.exports = { lawyerHandoff };
