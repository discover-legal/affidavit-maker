// services/supportDocs/utahFeeWaiver.js
// Utah Motion to Waive Fees + Statement Supporting Motion to Waive Fees,
// generated from the user's stored data. Utah lets a party ask the court to
// waive fees for inability to pay (impecuniosity/indigency); the court forms
// pair a short motion with a sworn financial statement, and this builder
// mirrors that two-part structure in ONE document.
//
// Builder convention matches services/supportDocs/utah.js:
// (data, opts) => documentStructure using the generic `sections` shape that
// services/pdfService.js renders on its affidavit path. documentType is
// pinned to 'affidavit'. Never throws on sparse data — unknowns render as
// blanks for the user to fill in.
//
// Signature style: Utah Code 78B-18a (Uniform Unsworn Declarations Act)
// lets a declaration substitute for a notarized affidavit, so 'unsworn' is
// the default; pass { signatureStyle: 'notary' } for the classic
// "Subscribed and sworn to before me" block.
//
// STATUTES (checked against le.utah.gov / justia section titles, 2026-07-11;
// le.utah.gov full text was unreachable from this environment, so wording
// was not re-read line-by-line):
//   - Utah Code § 78A-2-302 — Waiver of fees, costs, and security — Indigent
//     litigants — Affidavit (pre-2022 title: "Impecunious litigants —
//     Affidavit"; retitled by S.B. 87, Court Fee Waiver Amendments, 2022).
//     A party may proceed without prepaying fees by submitting an affidavit
//     of indigency covering income, assets, debts, and monthly expenses.
//   - Utah Code § 78A-2-303 — False affidavit — Penalty.
//   - Utah Code § 78A-2-304 — Effect of filing affidavit — Nonprisoner: the
//     court reviews the affidavit and independently decides whether to waive
//     fees in whole or in part.
//   - Utah Code § 78A-2-305 — prisoner trust-account disclosure (not used
//     here; this builder targets nonprisoner family-law litigants).
// LEGAL REVIEW:
//   - Last reviewed: [Date] — le.utah.gov publishes a Part 3 version
//     superseded/amended effective 1/1/2027; re-verify cites and wording
//     against the current text before that date.
//   - Reviewed by: [Name/Role]
//   - Status: cites verified by section title only; full-text verification
//     pending.
//
// UPL note: the court decides whether fees are waived; this document only
// transcribes the user's finances. The FPG comparison line below is neutral
// information, never a conclusion about whether the court should grant it.

const crypto = require('node:crypto');
const { totalOf } = require('../../utils/labeledAmounts');
const { UTAH_UNSWORN_DECLARATION, normalizeCountyName } = require('./utah');

const BLANK_SHORT = '______________';
const BLANK_LINE = '________________________________';

// 2025 HHS federal poverty guidelines (48 contiguous states + DC).
// KEEP IN SYNC with components/app/lifeStory.ts (FPG_2025_BASE,
// FPG_2025_PER_PERSON, FEE_WAIVER_PCT) — services must not import from
// components/, so the constants are re-declared here.
const FPG_2025_BASE = 15650;
const FPG_2025_PER_PERSON = 5500;
const FEE_WAIVER_PCT = 1.5; // the app's eligibility HINT threshold (150%), not a legal test

// ─── helpers (same conventions as ./utah.js) ─────────────────────────────────

function str(value) {
  return value === undefined || value === null ? '' : String(value).trim();
}

function resolvePetitioner(data) {
  return (
    str(data.petitionerName) ||
    [str(data.petitionerFirstName), str(data.petitionerLastName)].filter(Boolean).join(' ') ||
    '[PETITIONER NAME]'
  );
}

function resolveRespondent(data) {
  return (
    str(data.respondentName) ||
    [str(data.respondentFirstName), str(data.respondentLastName)].filter(Boolean).join(' ') ||
    '[RESPONDENT NAME]'
  );
}

function utahCaption(data) {
  const county = (normalizeCountyName(str(data.county)) || BLANK_SHORT).toUpperCase();
  const header = `IN THE DISTRICT COURT OF ${county} COUNTY, STATE OF UTAH`;
  const caseNumber = str(data.caseNumber) || BLANK_SHORT;
  const formatted = [
    `${resolvePetitioner(data).toUpperCase()},`,
    'Petitioner,',
    '',
    'v.',
    '',
    `${resolveRespondent(data).toUpperCase()},`,
    'Respondent.',
    '',
    `Case No. ${caseNumber}`,
    `Judge ${BLANK_SHORT}`,
  ].join('\n');
  return { header, caseCaption: { formatted } };
}

function parseAmount(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const n = Number(String(value ?? '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function formatMoney(amount) {
  const n = parseAmount(amount);
  return `$${n.toLocaleString('en-US', {
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Itemized money table from a breakdown ([{label, amount, person?}]).
 * Returns { lines, total }. Itemized totals win over a stale fallback.
 */
function moneyTable(breakdown, fallbackTotal) {
  const rows = Array.isArray(breakdown)
    ? breakdown.filter((it) => it && typeof it === 'object' && (str(it.label) || it.amount !== undefined))
    : [];
  const lines = rows.map((it) => {
    const person = str(it.person) ? ` (${str(it.person)})` : '';
    const label = `${str(it.label) || 'Item'}${person}`;
    const dots = '.'.repeat(Math.max(3, 44 - label.length));
    return `${label} ${dots} ${formatMoney(it.amount)}`;
  });
  const total = rows.length ? totalOf(breakdown) : parseAmount(fallbackTotal);
  return { lines, total };
}

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

// ─── the builder ─────────────────────────────────────────────────────────────

/**
 * Motion to Waive Fees + Statement Supporting Motion to Waive Fees (Utah).
 * One document, two parts: the short motion, then the sworn financial
 * statement the court reviews under Utah Code § 78A-2-304.
 */
function feeWaiverMotion(data = {}, opts = {}) {
  const movant = resolvePetitioner(data);
  const { header, caseCaption } = utahCaption(data);

  const income = moneyTable(data.incomeBreakdown, data.monthlyIncome);
  const expenses = moneyTable(data.expenseBreakdown, data.monthlyExpenses);

  const children = Array.isArray(data.children)
    ? data.children.filter((c) => c && typeof c === 'object')
    : [];
  const householdSize = 1 + children.length;

  const items = [];
  const push = (content) => items.push({ number: items.length + 1, content, type: 'fact' });

  // ── Part 1: the motion ──
  push(
    'I ask the court to waive the fees and costs of this case, including the filing fee, ' +
      'because I do not have enough money to pay them. Utah Code § 78A-2-302 allows a party ' +
      'who cannot pay to ask the court to waive fees by filing a sworn statement of their ' +
      'finances.',
  );
  push(
    'My sworn statement of finances follows below as the Statement Supporting Motion to ' +
      'Waive Fees. I ask the court to review it and decide whether to waive the fees in ' +
      'whole or in part, as Utah Code § 78A-2-304 provides.',
  );

  // ── Part 2: the supporting statement ──
  push(
    'STATEMENT SUPPORTING MOTION TO WAIVE FEES\n' +
      'I am the movant. The following information about my finances is complete and accurate ' +
      'to the best of my knowledge. I understand that a false statement is punishable under ' +
      'Utah Code § 78A-2-303.',
  );

  push(
    [
      'MONTHLY GROSS INCOME (itemized):',
      ...(income.lines.length ? income.lines : [`(no itemized income on file) ${BLANK_LINE}`]),
      `TOTAL MONTHLY GROSS INCOME: ${income.total > 0 ? formatMoney(income.total) : BLANK_SHORT}`,
    ].join('\n'),
  );

  push(
    [
      'MONTHLY EXPENSES (itemized):',
      ...(expenses.lines.length ? expenses.lines : [`(no itemized expenses on file) ${BLANK_LINE}`]),
      `TOTAL MONTHLY EXPENSES: ${expenses.total > 0 ? formatMoney(expenses.total) : BLANK_SHORT}`,
    ].join('\n'),
  );

  push(
    `HOUSEHOLD SIZE: ${householdSize} (myself` +
      (children.length > 0
        ? ` plus ${children.length} ${children.length === 1 ? 'child' : 'children'}`
        : '') +
      '). This number is an assumption based on the information I have provided so far — ' +
      'correct it if other people live in and depend on my household.',
  );

  push(
    [
      'PUBLIC BENEFITS — check any that you currently receive (this information was not ' +
        'collected by the software; fill it in yourself):',
      '[ ] SNAP (food stamps)',
      '[ ] Medicaid',
      '[ ] SSI (Supplemental Security Income)',
      '[ ] TANF / Family Employment Program',
      `[ ] Other: ${BLANK_LINE}`,
      '[ ] I do not receive public benefits',
    ].join('\n'),
  );

  push(`ASSETS (what I own, including real and personal property, accounts, and business interests): ${str(data.assetsDescription) || BLANK_LINE}`);

  const debts = [];
  if (str(data.debtsDescription)) debts.push(str(data.debtsDescription));
  if (str(data.petitionerDebts)) debts.push(str(data.petitionerDebts));
  push(`DEBTS (what I owe): ${debts.join('; ') || BLANK_LINE}`);

  // Neutral FPG information line — only when we actually have income data.
  if (income.total > 0) {
    const annualIncome = income.total * 12;
    const guideline = FPG_2025_BASE + FPG_2025_PER_PERSON * (householdSize - 1);
    const pct = Math.round((annualIncome / guideline) * 100);
    push(
      `For the court's information: based on the numbers above, movant's household income is ` +
        `approximately ${pct}% of the 2025 federal poverty guideline for a household of ` +
        `${householdSize} (${formatMoney(guideline)} per year). Whether to waive fees is ` +
        'entirely the court\'s decision.',
    );
  }

  return {
    id: crypto.randomUUID(),
    state: 'UT',
    documentType: 'affidavit', // pins pdfService.detectDocumentType to the generic path
    kind: 'fee_waiver_motion',
    timestamp: new Date(),
    metadata: {
      supportDoc: true,
      kind: 'fee_waiver_motion',
      state: 'UT',
      signatureStyle: opts.signatureStyle === 'notary' ? 'notary' : 'unsworn',
    },
    sections: {
      header,
      caseCaption,
      title: 'MOTION TO WAIVE FEES',
      introduction:
        `I, ${movant}, the moving party, ask the court to waive the fees in this case ` +
        'because I cannot pay them (Utah Code §§ 78A-2-302 through 78A-2-304), and state as ' +
        'follows:',
      facts: { items },
      conclusion:
        'I ask the court to grant this motion and waive the fees and costs of this case. I ' +
        'understand the court will make its own decision based on the finances I have stated ' +
        'above, and that the court may ask me for supporting documents such as pay stubs or ' +
        'benefit statements.',
      ...signatureSections(movant, 'Movant', opts),
    },
  };
}

module.exports = { feeWaiverMotion };
