// services/supportDocs/texas.js
// Texas supporting court documents, generated from the user's stored data
// (life-story profile and/or a saved document's content blob).
//
// Every builder is (data, opts) => documentStructure, where the structure
// uses the same generic `sections` shape services/pdfService.js renders on
// its affidavit path (header, caseCaption.formatted, title, introduction,
// facts.items[{number, content}], conclusion, perjuryStatement,
// signatureBlock, notaryBlock). documentType is pinned to 'affidavit' so
// detectDocumentType() never mis-routes these to the petition/decree
// builders.
//
// Signature style: Tex. Civ. Prac. & Rem. Code § 132.001 lets an unsworn
// declaration substitute for a notarized affidavit, so 'unsworn' is the
// default; pass { signatureStyle: 'notary' } for the classic "Subscribed
// and sworn to before me" block instead. Tex. R. Civ. P. 145 (Statement
// of Inability) expressly permits — and prefers — the unsworn form.

const crypto = require('node:crypto');
const {
  resolvePetitioner,
  resolveRespondent,
  normalizeCountyName,
  listText,
} = require('./utah');
const { resolvePartyIncomes, resolveDeclarantExpenses, INCOME_PLACEHOLDER } = require('./partyIncome');
const { captionUpper } = require('../../templates/core/nameCase');

const BLANK_SHORT = '______________';
const BLANK_LINE = '________________________________';

const TEXAS_UNSWORN_DECLARATION =
  'I declare under penalty of perjury that the foregoing is true and correct ' +
  '(Tex. Civ. Prac. & Rem. Code § 132.001).';

// ─── shared helpers ─────────────────────────────────────────────────────────

function str(value) {
  return value === undefined || value === null ? '' : String(value).trim();
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

function moneyTable(breakdown, fallbackTotal) {
  const rows = Array.isArray(breakdown)
    ? breakdown.filter(
        (it) => it && typeof it === 'object' && (str(it.label) || it.amount !== undefined),
      )
    : [];
  const lines = rows.map((it) => {
    const person = str(it.person) ? ` (${str(it.person)})` : '';
    const label = `${str(it.label) || 'Item'}${person}`;
    const dots = '.'.repeat(Math.max(3, 44 - label.length));
    return `${label} ${dots} ${formatMoney(it.amount)}`;
  });
  const total = rows.length
    ? rows.reduce((sum, it) => sum + parseAmount(it.amount), 0)
    : parseAmount(fallbackTotal);
  const hasData =
    rows.length > 0 ||
    (fallbackTotal !== undefined && fallbackTotal !== null && str(fallbackTotal) !== '');
  return { lines, total, hasData };
}

/**
 * Render the "MONTHLY EXPENSES" block from either an itemized breakdown
 * (declarant's own tagged entries + untagged, mirroring the income helper's
 * side attribution) or a scalar `monthlyExpenses` fallback. When only the
 * scalar is on file it becomes ONE line — "Monthly expenses: $X" — rather
 * than the "(no itemized expenses on file)" placeholder that would drop the
 * total. Missing-both keeps the placeholder + warning.
 */
function renderExpenseBlock(data, declarantSide) {
  const derived = resolveDeclarantExpenses(data, declarantSide);
  let bodyLines;
  let totalText;
  if (derived.hasBreakdown) {
    const table = moneyTable(derived.items, undefined);
    bodyLines = table.lines;
    totalText = formatMoney(table.total);
  } else if (derived.hasScalar) {
    bodyLines = [`Monthly expenses: ${formatMoney(derived.scalarAmount)}`];
    totalText = formatMoney(derived.scalarAmount);
  } else {
    bodyLines = [`(no itemized expenses on file) ${BLANK_LINE}`];
    totalText = '[MONTHLY EXPENSES]';
  }
  return {
    hasData: derived.hasData,
    content: [
      'MONTHLY EXPENSES (itemized):',
      ...bodyLines,
      `TOTAL MONTHLY EXPENSES: ${totalText}`,
    ].join('\n'),
  };
}

/**
 * Texas caption block:
 *   IN THE DISTRICT COURT OF [COUNTY] COUNTY, TEXAS
 *   CAUSE NO. ____
 *   IN THE MATTER OF THE MARRIAGE OF [PETITIONER] AND [RESPONDENT]
 *
 * Matches the petition/decree templates' court-line style
 * (templates/states/texas — getDefaultCourt: "DISTRICT COURT OF [COUNTY]
 * COUNTY, TEXAS"), so a case packet's supporting papers caption the same
 * court the same way as its main documents.
 */
function texasCaption(data) {
  const county = (normalizeCountyName(str(data.county)) || BLANK_SHORT).toUpperCase();
  const header = `IN THE DISTRICT COURT OF ${county} COUNTY, TEXAS`;
  const causeNumber = str(data.caseNumber) || BLANK_SHORT;
  // captionUpper preserves McPherson/DiCaprio/van der Berg style internal
  // capitals — same reason the state divorce templates use it for captions.
  const petitioner = captionUpper(resolvePetitioner(data));
  const respondent = captionUpper(resolveRespondent(data));
  const formatted = [
    `CAUSE NO. ${causeNumber}`,
    '',
    'IN THE MATTER OF',
    'THE MARRIAGE OF',
    '',
    `${petitioner},`,
    'Petitioner,',
    '',
    'AND',
    '',
    `${respondent},`,
    'Respondent.',
  ].join('\n');
  return {
    header,
    caseCaption: {
      formatted,
      structured: {
        left: [
          'IN THE MATTER OF',
          'THE MARRIAGE OF',
          '',
          `${petitioner},`,
          '          Petitioner,',
          '',
          'AND',
          '',
          `${respondent},`,
          '          Respondent.',
        ],
        right: [`CAUSE NO. ${causeNumber}`, '', `${county} COUNTY, TEXAS`],
      },
    },
  };
}

function filerBlock(data, name, roleLine) {
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
 * Signature sections for the requesting style.
 *  - 'unsworn' (default): Tex. Civ. Prac. & Rem. Code § 132.001 unsworn
 *    declaration wording in perjuryStatement; no notary block needed.
 *  - 'notary': classic "Subscribed and sworn to before me" block.
 */
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
        'STATE OF TEXAS',
        `COUNTY OF ${BLANK_SHORT}`,
        '',
        `Subscribed and sworn to before me on this _____ day of ${BLANK_SHORT}, 20____, ` +
          `by ${BLANK_LINE} (name of document signer).`,
        '',
        BLANK_LINE,
        'Notary Public, State of Texas',
        `My commission expires: ${BLANK_SHORT}`,
        '(SEAL)',
      ].join('\n'),
    };
  }

  return {
    perjuryStatement:
      `${TEXAS_UNSWORN_DECLARATION}\n\n` +
      `Executed on ${BLANK_SHORT} (date) in ${BLANK_LINE} County, Texas.`,
    signatureBlock,
    notaryBlock: null,
  };
}

function baseStructure(kind, sections, opts = {}) {
  return {
    id: crypto.randomUUID(),
    state: 'TX',
    documentType: 'affidavit',
    kind,
    timestamp: new Date(),
    metadata: {
      supportDoc: true,
      kind,
      state: 'TX',
      signatureStyle: opts.signatureStyle === 'notary' ? 'notary' : 'unsworn',
    },
    sections,
  };
}

/**
 * Employment description from the declarant's own itemized income labels,
 * mirroring the Utah builder — extraction stores no dedicated occupation
 * field, but the income labels carry the job in the user's words. Only
 * labels that actually describe a job are used; a bare category label
 * ("Wages") says nothing about employment and is left blank.
 */
function employmentFromIncomeItems(items) {
  if (!Array.isArray(items)) return '';
  const descriptions = [];
  for (const item of items) {
    const label = str(item && item.label);
    if (!label) continue;
    const m = label.match(
      /(?:wages|income|salary|earnings|employment|job)\s+(?:as|from|at|with)\s+(.+)$/i,
    );
    if (m) descriptions.push(m[1].trim());
  }
  return descriptions.join('; ');
}

// ─── 1. Statement of Inability to Afford Payment of Court Costs ────────────
//     Tex. R. Civ. P. 145 (adopted by Tex. Sup. Ct. Misc. Docket No. 15-9171)

function statementOfInability(data = {}, opts = {}) {
  const { header, caseCaption } = texasCaption(data);
  const derived = resolvePartyIncomes(data);
  const declarant =
    derived.declarant === 'respondent' ? resolveRespondent(data) : resolvePetitioner(data);
  const declarantRoleLabel = derived.declarant === 'respondent' ? 'Respondent' : 'Petitioner';
  const own = derived[derived.declarant];
  const income = moneyTable(own.items, own.amount);
  const hasIncomeData = income.lines.length > 0 || own.amount !== null;
  const incomeTotal = hasIncomeData
    ? formatMoney(own.amount !== null && income.lines.length === 0 ? own.amount : income.total)
    : INCOME_PLACEHOLDER;
  const warnings = [...derived.warnings];
  if (!hasIncomeData) {
    warnings.push(
      'Monthly income is not on file — the TOTAL MONTHLY INCOME line is a placeholder. ' +
        'Enter your own gross monthly income before signing this sworn statement.',
    );
  }

  const expenseBlock = renderExpenseBlock(data, derived.declarant);
  if (!expenseBlock.hasData) {
    warnings.push(
      'Monthly expenses are not on file — TOTAL MONTHLY EXPENSES is a placeholder. ' +
        'Fill in your expenses before signing this sworn statement.',
    );
  }

  const employment =
    str(data.employment) ||
    str(data.employer) ||
    str(data.occupation) ||
    employmentFromIncomeItems(own.items) ||
    BLANK_LINE;

  const dependentsRaw = data.dependentsCount ?? data.dependents;
  let dependentsLine;
  if (dependentsRaw === undefined || dependentsRaw === null || str(dependentsRaw) === '') {
    dependentsLine =
      'Number of persons financially dependent on me (including myself): [NUMBER].';
    warnings.push(
      'Dependents count is not on file — the dependents line is a placeholder. ' +
        'Fill it in before signing this sworn statement.',
    );
  } else {
    const n = Number(dependentsRaw);
    dependentsLine = Number.isFinite(n)
      ? `Number of persons financially dependent on me (including myself): ${n}.`
      : `Number of persons financially dependent on me (including myself): ${str(dependentsRaw)}.`;
  }

  const benefits = str(data.publicBenefits) || str(data.governmentAssistance);
  const benefitsLine = benefits
    ? `Public benefits I receive: ${benefits}.`
    : `Public benefits I receive (SNAP, TANF, Medicaid, SSI, WIC, public housing, etc.): ${BLANK_LINE}.`;

  const assetsText = str(data.assetsDescription) || str(data.assets) || BLANK_LINE;

  const petitionerDebts = listText(data.petitionerDebts);
  const respondentDebts = listText(data.respondentDebts);
  const debtLines = [];
  if (petitionerDebts) debtLines.push(`Petitioner's debts: ${petitionerDebts}`);
  if (respondentDebts) debtLines.push(`Respondent's debts: ${respondentDebts}`);
  const debtContent = debtLines.length
    ? `DEBTS:\n${debtLines.join('\n')}`
    : `DEBTS: ${BLANK_LINE}.`;

  const incomeContent = [
    "MONTHLY INCOME (the declarant's own, itemized):",
    ...(income.lines.length ? income.lines : [`(no itemized income on file) ${BLANK_LINE}`]),
    `TOTAL MONTHLY INCOME: ${incomeTotal}`,
    ...(hasIncomeData
      ? []
      : ['(your monthly income is not on file — fill this in before signing)']),
  ].join('\n');

  const expenseContent = expenseBlock.content;

  const facts = {
    items: [
      {
        number: 1,
        content:
          'I am a party in this case and I cannot afford to pay the fees and costs of court ' +
          'or an appeal bond in this case.',
        type: 'fact',
      },
      { number: 2, content: `Employment (employer and job): ${employment}.`, type: 'fact' },
      { number: 3, content: incomeContent, type: 'fact' },
      { number: 4, content: expenseContent, type: 'fact' },
      { number: 5, content: dependentsLine, type: 'fact' },
      { number: 6, content: benefitsLine, type: 'fact' },
      { number: 7, content: `ASSETS (property, vehicles, bank accounts): ${assetsText}.`, type: 'fact' },
      { number: 8, content: debtContent, type: 'fact' },
      {
        number: 9,
        content:
          `I, ${declarant}, respectfully ask this Court to declare me unable to afford the fees ` +
          'and costs of court and to waive their payment, pursuant to Tex. R. Civ. P. 145.',
        type: 'fact',
      },
    ],
  };

  const structure = baseStructure(
    'statement_of_inability',
    {
      filerBlock: filerBlock(data, declarant, `${declarantRoleLabel}, Pro Se`),
      header,
      caseCaption,
      title: 'STATEMENT OF INABILITY TO AFFORD PAYMENT OF COURT COSTS OR AN APPEAL BOND',
      introduction: `I, ${declarant}, declare the following under penalty of perjury:`,
      facts,
      conclusion: null,
      ...signatureSections(declarant, 'Declarant', opts),
    },
    opts,
  );
  if (warnings.length > 0) structure.metadata.warnings = warnings;
  return structure;
}

// ─── 2. Petitioner's Financial Information Statement (TX) ──────────────────
//     Not a single prescribed statewide form. Labeled honestly (NOT
//     "Financial Declaration under Rule 26.1" — that's Utah). A simple
//     summary derived from incomeBreakdown, expenseBreakdown,
//     petitionerProperty, petitionerDebts is useful and does not
//     misrepresent Texas practice.

function financialInformationStatement(data = {}, opts = {}) {
  const { header, caseCaption } = texasCaption(data);
  const derived = resolvePartyIncomes(data);
  const declarant =
    derived.declarant === 'respondent' ? resolveRespondent(data) : resolvePetitioner(data);
  const declarantRoleLabel = derived.declarant === 'respondent' ? 'Respondent' : 'Petitioner';
  const own = derived[derived.declarant];
  const income = moneyTable(own.items, own.amount);
  const hasIncomeData = income.lines.length > 0 || own.amount !== null;
  const incomeTotal = hasIncomeData
    ? formatMoney(own.amount !== null && income.lines.length === 0 ? own.amount : income.total)
    : INCOME_PLACEHOLDER;
  const warnings = [...derived.warnings];
  if (!hasIncomeData) {
    warnings.push(
      'Monthly income is not on file — the TOTAL MONTHLY INCOME line is a placeholder. ' +
        'Enter your own gross monthly income before signing.',
    );
  }

  const expenseBlock = renderExpenseBlock(data, derived.declarant);
  if (!expenseBlock.hasData) {
    warnings.push(
      'Monthly expenses are not on file — TOTAL MONTHLY EXPENSES is a placeholder.',
    );
  }

  const employment =
    str(data.employment) ||
    str(data.employer) ||
    str(data.occupation) ||
    employmentFromIncomeItems(own.items) ||
    BLANK_LINE;

  const petitionerProperty = listText(data.petitionerProperty);
  const respondentProperty = listText(data.respondentProperty);
  const ownProperty =
    derived.declarant === 'respondent' ? respondentProperty : petitionerProperty;
  const propertyText = ownProperty || str(data.assetsDescription) || BLANK_LINE;

  const petitionerDebts = listText(data.petitionerDebts);
  const respondentDebts = listText(data.respondentDebts);
  const ownDebts = derived.declarant === 'respondent' ? respondentDebts : petitionerDebts;
  const debtText = ownDebts || BLANK_LINE;

  const incomeContent = [
    "MONTHLY INCOME (the declarant's own, itemized):",
    ...(income.lines.length ? income.lines : [`(no itemized income on file) ${BLANK_LINE}`]),
    `TOTAL MONTHLY INCOME: ${incomeTotal}`,
  ].join('\n');

  const expenseContent = expenseBlock.content;

  const facts = {
    items: [
      { number: 1, content: `Employment (employer and job): ${employment}.`, type: 'fact' },
      { number: 2, content: incomeContent, type: 'fact' },
      { number: 3, content: expenseContent, type: 'fact' },
      { number: 4, content: `PROPERTY / ASSETS: ${propertyText}.`, type: 'fact' },
      { number: 5, content: `DEBTS: ${debtText}.`, type: 'fact' },
    ],
  };

  const structure = baseStructure(
    'financial_declaration',
    {
      filerBlock: filerBlock(data, declarant, `${declarantRoleLabel}, Pro Se`),
      header,
      caseCaption,
      title: `${declarantRoleLabel.toUpperCase()}'S FINANCIAL INFORMATION STATEMENT`,
      introduction:
        `I, ${declarant}, submit this Financial Information Statement summarizing my income, ` +
        'expenses, property, and debts, drawn from the information on file in this case, and ' +
        'state as follows:',
      facts,
      conclusion:
        'The figures above are complete and accurate to the best of my knowledge. This ' +
        'statement is intended as a summary drawn from information on file; it is not a ' +
        'court-prescribed form. Texas does not publish a single statewide financial declaration ' +
        'form; disclosures required in this case (including Tex. R. Civ. P. 194 initial ' +
        'disclosures and any court-ordered inventory and appraisement) must still be provided ' +
        'separately in the manner and format the rules and this Court require.',
      ...signatureSections(declarant, 'Declarant', opts),
    },
    opts,
  );
  if (warnings.length > 0) structure.metadata.warnings = warnings;
  return structure;
}

module.exports = {
  TEXAS_UNSWORN_DECLARATION,
  texasCaption,
  filerBlock,
  statementOfInability,
  financialInformationStatement,
};
