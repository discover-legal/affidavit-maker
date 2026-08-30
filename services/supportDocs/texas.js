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

// TRCP 145 requires the declarant to itemize income and expenses by
// category. When no breakdown is on file, the sworn statement scaffolds
// each required category as a labeled blank the filer completes by hand.
const INCOME_SCAFFOLD_CATEGORIES = [
  'Wages / salary (paystubs)',
  'Self-employment / gig / tips',
  'Public benefits (SNAP, TANF, SSI, WIC, etc.)',
  'Child support / spousal maintenance received',
  'Other income',
];
const EXPENSE_SCAFFOLD_CATEGORIES = [
  'Rent / mortgage',
  'Utilities (electric, gas, water, phone/internet)',
  'Food / groceries',
  'Transportation (car payment, gas, insurance, transit)',
  'Health insurance / medical / prescriptions',
  'Child care',
  'Debt payments (credit cards, loans)',
  'Clothing / household necessities',
  'Other necessary expenses',
];

/**
 * Render a category label with dot-leader alignment and a trailing blank,
 * matching the moneyTable() row format used for real itemized entries so
 * the two blocks visually align in the final PDF.
 */
function scaffoldRow(label) {
  const dots = '.'.repeat(Math.max(3, 44 - label.length));
  return `${label} ${dots} $${BLANK_SHORT}`;
}

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
    // Rule 145 requires itemized categories. When nothing is on file, keep
    // the "(no itemized expenses on file)" marker AND scaffold each required
    // category as a labeled blank so the filer completes the form by hand
    // instead of signing a bare placeholder.
    bodyLines = [
      `(no itemized expenses on file) ${BLANK_LINE}`,
      ...EXPENSE_SCAFFOLD_CATEGORIES.map(scaffoldRow),
    ];
    totalText = '[MONTHLY EXPENSES]';
  }
  // Expose the numeric total so callers can compute a Rule 145 qualification
  // check (income minus expenses); null when nothing is on file.
  let totalAmount = null;
  if (derived.hasBreakdown) {
    totalAmount = moneyTable(derived.items, undefined).total;
  } else if (derived.hasScalar) {
    totalAmount = derived.scalarAmount;
  }
  return {
    hasData: derived.hasData,
    totalAmount,
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
  // Unwrap { affidavitData: {...} } for the fields we read directly (the
  // income/expense helpers already unwrap internally, but the new mandatory
  // fields — spouse income, attorney representation, numberOfChildren —
  // need the same treatment so the wrapped acceptance payload reaches them).
  const unwrapped =
    data && typeof data.affidavitData === 'object' && data.affidavitData !== null
      ? { ...data.affidavitData, ...data }
      : data || {};
  const derived = resolvePartyIncomes(data);
  const declarant =
    derived.declarant === 'respondent' ? resolveRespondent(data) : resolvePetitioner(data);
  const declarantRoleLabel = derived.declarant === 'respondent' ? 'Respondent' : 'Petitioner';
  const own = derived[derived.declarant];
  const spouseOwn = derived[derived.declarant === 'respondent' ? 'petitioner' : 'respondent'];
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

  // Auto-fill dependents from the profile's numberOfChildren (+1 for the
  // declarant), but only when no explicit count was supplied. A caller that
  // supplies dependentsCount: 0 still gets "0" — the auto-fill is a
  // last-resort default, not an override.
  const dependentsRaw = data.dependentsCount ?? data.dependents;
  let dependentsLine;
  if (dependentsRaw === undefined || dependentsRaw === null || str(dependentsRaw) === '') {
    const kidsRaw =
      unwrapped.numberOfChildren ??
      unwrapped.numChildren ??
      unwrapped.numberOfMinorChildren;
    const kids = Number(kidsRaw);
    if (Number.isFinite(kids) && kids >= 0) {
      const total = kids + 1;
      dependentsLine =
        `Number of persons financially dependent on me (including myself): ${total} ` +
        `(myself${kids > 0 ? ` + ${kids} minor ${kids === 1 ? 'child' : 'children'}` : ''}).`;
    } else {
      dependentsLine =
        'Number of persons financially dependent on me (including myself): [NUMBER].';
      warnings.push(
        'Dependents count is not on file — the dependents line is a placeholder. ' +
          'Fill it in before signing this sworn statement.',
      );
    }
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

  // Rule 145(f) household context: spouse income + representation status.
  const spouseName =
    derived.declarant === 'respondent' ? resolvePetitioner(data) : resolveRespondent(data);
  const spouseIncomeLine = (() => {
    if (spouseOwn && spouseOwn.amount !== null && spouseOwn.amount !== undefined) {
      return `Household spouse's gross monthly income (${spouseName}): ${formatMoney(spouseOwn.amount)}.`;
    }
    return `Household spouse's gross monthly income (${spouseName}): ${BLANK_SHORT} (leave blank if unknown or not applicable).`;
  })();

  const attorneyRepRaw =
    str(unwrapped.attorneyRepresentation) ||
    str(unwrapped.attorneyName) ||
    str(unwrapped.attorneyOfRecord);
  const attorneyRepLine = attorneyRepRaw
    ? `Attorney representation: represented by ${attorneyRepRaw}.`
    : `Attorney representation: I am self-represented (pro se). If represented, write attorney's name: ${BLANK_LINE}.`;

  const legalAidRaw =
    str(unwrapped.legalAidRepresentation) ||
    str(unwrapped.legalAidProvider) ||
    (unwrapped.receivesLegalAid === true ? 'yes' : '');
  const legalAidLine = legalAidRaw
    ? `Legal-aid or pro-bono representation: ${legalAidRaw}. (Tex. R. Civ. P. 145(e): a legal-aid provider's determination of financial eligibility is evidence of inability to pay.)`
    : `Legal-aid or pro-bono representation: none / ${BLANK_LINE}. (If you are represented by a legal-aid provider that determined you financially eligible, TRCP 145(e) makes that determination evidence supporting this Statement — attach the provider's letter.)`;

  const incomeContent = [
    "MONTHLY INCOME (the declarant's own, itemized):",
    ...(income.lines.length
      ? income.lines
      : [
          `(no itemized income on file) ${BLANK_LINE}`,
          ...INCOME_SCAFFOLD_CATEGORIES.map(scaffoldRow),
        ]),
    `TOTAL MONTHLY INCOME: ${incomeTotal}`,
    ...(hasIncomeData
      ? []
      : ['(your monthly income is not on file — fill this in before signing)']),
  ].join('\n');

  const expenseContent = expenseBlock.content;

  // Rule 145 qualification check. TRCP 145(f) lets a party contest the
  // declarant's inability to pay; the court may set a hearing. When the
  // numbers show a monthly surplus > $500 AND the declarant is not on
  // public benefits, warn the filer to review qualification before signing.
  // The check runs only when BOTH figures are on file — a blank never
  // triggers a "you don't qualify" warning.
  let qualificationDraftNote = '';
  if (hasIncomeData && expenseBlock.hasData && expenseBlock.totalAmount !== null) {
    const monthlyIncomeAmount =
      own.amount !== null && income.lines.length === 0 ? own.amount : income.total;
    const monthlyExpensesAmount = expenseBlock.totalAmount;
    const surplus = monthlyIncomeAmount - monthlyExpensesAmount;
    if (surplus > 500 && !benefits) {
      qualificationDraftNote =
        `(Draft — Rule 145 waivers are typically granted when a person receives ` +
        `public benefits or lacks funds for basic necessities. Based on the ` +
        `income/expense figures on file (${formatMoney(monthlyIncomeAmount)} in, ` +
        `${formatMoney(monthlyExpensesAmount)} out, ${formatMoney(surplus)} surplus), ` +
        `review whether you qualify before filing. The court may set a hearing ` +
        `under TRCP 145(f) to contest inability to pay.)`;
      warnings.push(
        `Qualification check: monthly surplus of ${formatMoney(surplus)} suggests ` +
          'the declarant may not qualify for a Rule 145 waiver absent public benefits. ' +
          'Review before filing.',
      );
    }
  }

  const documentationDraftNote =
    '(Draft — Attach documentation supporting the figures above where available: ' +
    'the most recent one or two paystubs (or a signed statement of self-employment ' +
    'income), benefit letters (SNAP, TANF, SSI, Medicaid, WIC, public housing), ' +
    'the past month\'s bank statement(s), and a copy of any legal-aid financial ' +
    'eligibility determination (TRCP 145(e)).)';

  const introduction = qualificationDraftNote
    ? `I, ${declarant}, declare the following under penalty of perjury:\n\n${qualificationDraftNote}`
    : `I, ${declarant}, declare the following under penalty of perjury:`;

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
      { number: 3, content: attorneyRepLine, type: 'fact' },
      { number: 4, content: incomeContent, type: 'fact' },
      { number: 5, content: expenseContent, type: 'fact' },
      { number: 6, content: spouseIncomeLine, type: 'fact' },
      { number: 7, content: dependentsLine, type: 'fact' },
      { number: 8, content: benefitsLine, type: 'fact' },
      { number: 9, content: legalAidLine, type: 'fact' },
      { number: 10, content: `ASSETS (property, vehicles, bank accounts): ${assetsText}.`, type: 'fact' },
      { number: 11, content: debtContent, type: 'fact' },
      {
        number: 12,
        content:
          `I, ${declarant}, respectfully ask this Court to declare me unable to afford the fees ` +
          'and costs of court and to waive their payment, pursuant to Tex. R. Civ. P. 145.\n\n' +
          documentationDraftNote,
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
      introduction,
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
