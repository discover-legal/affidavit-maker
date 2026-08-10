// services/supportDocs/utah.js
// Utah supporting court documents, generated from the user's stored data
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
// Signature style: Utah Code 78B-18a (Uniform Unsworn Declarations Act)
// lets a declaration substitute for a notarized affidavit, so 'unsworn'
// is the default; pass { signatureStyle: 'notary' } for the classic
// "Subscribed and sworn to before me" block instead.

const crypto = require('node:crypto');

const BLANK_SHORT = '______________';
const BLANK_LINE = '________________________________';

const UTAH_UNSWORN_DECLARATION =
  'I declare under criminal penalty of the State of Utah that the foregoing is true and correct.';

// ─── shared helpers ──────────────────────────────────────────────────────────

function str(value) {
  return value === undefined || value === null ? '' : String(value).trim();
}

// Profile data often stores "Salt Lake County"; every caption appends the
// word itself. Same normalization as DivorceDocumentGenerator.
function normalizeCountyName(county) {
  return typeof county === 'string' ? county.replace(/\s+county$/i, '').trim() : county;
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

/**
 * Utah caption block:
 *   IN THE DISTRICT COURT OF [COUNTY] COUNTY, STATE OF UTAH
 *   [PETITIONER], Petitioner, v. [RESPONDENT], Respondent.
 *   Case No. ____ when unknown.
 */
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

/**
 * Itemized money table from a breakdown ([{label, amount, person?}]).
 * Returns { lines, total }. Amount strings sit at the right end of a
 * dot-leader line so they read as a right-hand amounts column.
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
  const total = rows.length
    ? rows.reduce((sum, it) => sum + parseAmount(it.amount), 0)
    : parseAmount(fallbackTotal);
  return { lines, total };
}

/** First keyEvents entry whose label matches the pattern; returns its date or ''. */
function findEventDate(data, pattern) {
  const events = Array.isArray(data.keyEvents) ? data.keyEvents : [];
  const hit = events.find((e) => e && typeof e === 'object' && pattern.test(str(e.label)));
  return hit ? str(hit.date) : '';
}

function serviceDate(data) {
  return findEventDate(data, /serv/i);
}

/**
 * Signature sections for the requesting style.
 *  - 'unsworn' (default): Utah Code 78B-18a unsworn declaration wording in
 *    perjuryStatement; no notary block needed.
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

// ─── 1. Acceptance of Service ───────────────────────────────────────────────

function acceptanceOfService(data = {}, opts = {}) {
  const petitioner = resolvePetitioner(data);
  const respondent = resolveRespondent(data);
  const { header, caseCaption } = utahCaption(data);
  const served = serviceDate(data) || BLANK_SHORT;

  const facts = {
    items: [
      {
        number: 1,
        content:
          `On ${served} (date), I received a copy of the Petition for Divorce and the ` +
          `Summons filed by ${petitioner} in this case.`,
        type: 'fact',
      },
      {
        number: 2,
        content:
          'I accept service (delivery) of those documents and waive any further formal ' +
          'service of them on me.',
        type: 'fact',
      },
      {
        number: 3,
        content:
          'By signing this Acceptance of Service, I am not agreeing with anything requested ' +
          'in the Petition. My signature confirms only that the documents were delivered to ' +
          'me and that I accept that delivery.',
        type: 'fact',
      },
      {
        number: 4,
        content:
          'I understand that I keep every right to respond to the Petition within the time ' +
          'allowed by Utah law, and that my time to respond runs from the date I accepted delivery.',
        type: 'fact',
      },
    ],
  };

  return baseStructure(
    'acceptance_of_service',
    {
      header,
      caseCaption,
      title: 'ACCEPTANCE OF SERVICE',
      introduction: `I, ${respondent}, am the Respondent in this case. I state as follows:`,
      facts,
      conclusion: null,
      ...signatureSections(respondent, 'Respondent', opts),
    },
    opts,
  );
}

// ─── 2. Certificate / Proof of Service ──────────────────────────────────────

function certificateOfService(data = {}, opts = {}) {
  const respondent = resolveRespondent(data);
  const { header, caseCaption } = utahCaption(data);
  const served = serviceDate(data) || BLANK_SHORT;
  const method = str(data.serviceMethod) || BLANK_SHORT;
  const address = str(data.respondentAddress);
  const server = str(data.serverName);

  const facts = {
    items: [
      {
        number: 1,
        content:
          'Documents served: the Petition for Divorce and the Summons in this case, together ' +
          `with any attachments listed here: ${BLANK_LINE}.`,
        type: 'fact',
      },
      {
        number: 2,
        content:
          `Person served: ${respondent}, the Respondent` +
          (address ? `, at ${address}.` : `. Address where served: ${BLANK_LINE}.`),
        type: 'fact',
      },
      {
        number: 3,
        content: `Date of service: ${served}.`,
        type: 'fact',
      },
      {
        number: 4,
        content: `Method of service: ${method}.`,
        type: 'fact',
      },
      {
        number: 5,
        content:
          'The person who completed service is at least 18 years old and is qualified under ' +
          'Utah law to serve these documents.',
        type: 'fact',
      },
    ],
  };

  return baseStructure(
    'certificate_of_service',
    {
      header,
      caseCaption,
      title: 'CERTIFICATE OF SERVICE',
      introduction:
        'I certify that I served the documents described below in this case. I state as follows:',
      facts,
      conclusion: null,
      ...signatureSections(
        server || `Printed name: ${BLANK_SHORT}`,
        'Person Who Completed Service',
        opts,
      ),
    },
    opts,
  );
}

// ─── 3. Financial Declaration (Utah R. Civ. P. 26.1-shaped, simplified) ─────

function financialDeclaration(data = {}, opts = {}) {
  const petitioner = resolvePetitioner(data);
  const { header, caseCaption } = utahCaption(data);

  const income = moneyTable(data.incomeBreakdown, data.monthlyIncome);
  const expenses = moneyTable(data.expenseBreakdown, data.monthlyExpenses);
  const employment =
    str(data.employment) || str(data.employer) || str(data.occupation) || BLANK_LINE;

  const incomeContent = [
    'MONTHLY INCOME (itemized):',
    ...(income.lines.length ? income.lines : [`(no itemized income on file) ${BLANK_LINE}`]),
    `TOTAL MONTHLY INCOME: ${formatMoney(income.total)}`,
  ].join('\n');

  const expenseContent = [
    'MONTHLY EXPENSES (itemized):',
    ...(expenses.lines.length ? expenses.lines : [`(no itemized expenses on file) ${BLANK_LINE}`]),
    `TOTAL MONTHLY EXPENSES: ${formatMoney(expenses.total)}`,
  ].join('\n');

  const petitionerDebts = str(data.petitionerDebts);
  const respondentDebts = str(data.respondentDebts);
  const debtLines = [];
  if (petitionerDebts) debtLines.push(`Petitioner's debts: ${petitionerDebts}`);
  if (respondentDebts) debtLines.push(`Respondent's debts: ${respondentDebts}`);
  const debtContent = debtLines.length
    ? `DEBTS:\n${debtLines.join('\n')}`
    : `DEBTS: ${BLANK_LINE}`;

  const facts = {
    items: [
      { number: 1, content: `Employment (employer and job): ${employment}.`, type: 'fact' },
      { number: 2, content: incomeContent, type: 'fact' },
      { number: 3, content: expenseContent, type: 'fact' },
      {
        number: 4,
        content: `ASSETS: ${str(data.assetsDescription) || BLANK_LINE}.`,
        type: 'fact',
      },
      { number: 5, content: debtContent, type: 'fact' },
    ],
  };

  return baseStructure(
    'financial_declaration',
    {
      header,
      caseCaption,
      title: 'FINANCIAL DECLARATION',
      introduction:
        `I, ${petitioner}, submit this Financial Declaration (patterned on Utah Rule of ` +
        'Civil Procedure 26.1, simplified) and state as follows:',
      facts,
      conclusion:
        'The figures above are complete and accurate to the best of my knowledge. Attach pay ' +
        'stubs, tax returns, and other supporting documents as Utah Rule of Civil Procedure ' +
        '26.1 requires.',
      ...signatureSections(petitioner, 'Declarant', opts),
    },
    opts,
  );
}

// ─── 4. Motion for Default + supporting declaration ─────────────────────────

function motionForDefaultPackage(data = {}, opts = {}) {
  const petitioner = resolvePetitioner(data);
  const respondent = resolveRespondent(data);
  const { header, caseCaption } = utahCaption(data);
  const served = serviceDate(data) || BLANK_SHORT;
  const filed = findEventDate(data, /fil/i);
  const method = str(data.serviceMethod) || BLANK_SHORT;
  const military = str(data.respondentMilitaryStatus);

  const militaryContent =
    (military
      ? `Respondent's military status: ${military}.`
      : `Respondent's military status: ${BLANK_LINE} (you must tell the court whether ` +
        'Respondent is in the military service).') +
    ' Before a default may be entered, federal law (the Servicemembers Civil Relief Act, ' +
    '50 U.S.C. § 3931) requires the moving party to state whether the Respondent is in ' +
    'military service and to support that statement.';

  const facts = {
    items: [
      {
        number: 1,
        content:
          `Petitioner filed a Petition for Divorce in this case` +
          (filed ? ` on ${filed}.` : '.'),
        type: 'fact',
      },
      {
        number: 2,
        content: `Respondent was served with the Petition and Summons on ${served} by ${method}.`,
        type: 'fact',
      },
      {
        number: 3,
        content:
          'More than 21 days have passed since the date of service, and Respondent has not ' +
          'filed an answer or any other response and has not appeared in this case.',
        type: 'fact',
      },
      { number: 4, content: militaryContent, type: 'fact' },
      {
        number: 5,
        content:
          "Petitioner therefore asks the court to enter Respondent's default and to allow " +
          'this case to proceed to judgment on the papers.',
        type: 'fact',
      },
    ],
  };

  const supportingDeclaration = [
    'SUPPORTING DECLARATION OF PETITIONER',
    '',
    `I, ${petitioner}, declare: (1) I am the Petitioner in this case. (2) Respondent, ` +
      `${respondent}, was served with the Petition and Summons on ${served} by ${method}. ` +
      '(3) More than 21 days have passed since service; Respondent has not answered, ' +
      'responded, or appeared, and no extension of time has been agreed to or ordered. ' +
      `(4) Respondent's military status is: ${military || BLANK_LINE}.`,
  ].join('\n');

  return baseStructure(
    'default_package',
    {
      header,
      caseCaption,
      title: 'MOTION FOR DEFAULT',
      introduction:
        `${petitioner}, the Petitioner, asks the court to enter the default of ` +
        `${respondent}, the Respondent, and states as follows:`,
      facts,
      conclusion: supportingDeclaration,
      ...signatureSections(petitioner, 'Petitioner', opts),
    },
    opts,
  );
}

// ─── 5. Finalization prep sheet (not a court filing) ────────────────────────

function finalizationPrep(data = {}, opts = {}) {
  const respondent = resolveRespondent(data);
  const county = str(data.county);
  const children = Array.isArray(data.children)
    ? data.children.filter((c) => c && typeof c === 'object' && str(c.name))
    : [];
  const childNames = children.map((c) => str(c.name)).join(', ');
  const served = serviceDate(data);
  const filed = findEventDate(data, /fil/i);
  const method = str(data.serviceMethod);
  const hasFinancials =
    (Array.isArray(data.incomeBreakdown) && data.incomeBreakdown.length > 0) ||
    (Array.isArray(data.expenseBreakdown) && data.expenseBreakdown.length > 0);

  const checklist = [
    `[ ] 30-day waiting period: Utah courts cannot finalize a divorce sooner than 30 days ` +
      `after the petition is filed${filed ? ` (your petition was filed on ${filed})` : ''}, ` +
      'unless the court waives the wait for good cause.',
  ];
  if (children.length > 0) {
    checklist.push(
      `[ ] Divorce education and orientation courses: because you have minor children ` +
        `(${childNames}), Utah requires both parents to complete the divorce education and ` +
        'divorce orientation courses before the divorce can be finished.',
    );
  }
  checklist.push(
    `[ ] Financial declarations exchanged: you and ${respondent} each need to complete and ` +
      'exchange a Financial Declaration' +
      (hasFinancials
        ? ' (your itemized income and expenses are already in your story — you can generate a prefilled Financial Declaration).'
        : '.'),
  );
  checklist.push(
    '[ ] Service complete: ' +
      (served
        ? `your records show Respondent was served on ${served}`
        : 'the court needs proof that Respondent was served or signed an Acceptance of Service') +
      (method ? ` by ${method}` : '') +
      '.',
  );

  const introduction = [
    'Utah finishes uncontested divorces "on the papers" — without a hearing — when your ' +
      'paperwork answers everything the court needs to know. This prep sheet is built from ' +
      'your own story so far. It is not a court filing; keep it for yourself.',
    '',
    'PART 1 — YOUR CHECKLIST',
    '',
    ...checklist,
    '',
    'PART 2 — QUESTIONS THE COURT NEEDS YOUR PAPERS TO ANSWER',
    '',
    'For each question below, your stored answer is filled in where we have it. Fix anything ' +
      'that is wrong and fill in every blank before you prepare your final declaration.',
  ].join('\n');

  const blankAnswer = BLANK_LINE;
  const residencyAnswer = data.residencyStateMonths
    ? `You told us about ${data.residencyStateMonths} months.`
    : blankAnswer;
  const marriageAnswer = str(data.marriageDate)
    ? `Married on ${str(data.marriageDate)}` +
      (str(data.marriageLocation) || str(data.marriagePlace)
        ? ` in ${str(data.marriageLocation) || str(data.marriagePlace)}.`
        : '.') +
      (str(data.separationDate) ? ` Separated on ${str(data.separationDate)}.` : '')
    : blankAnswer;
  const groundsAnswer = str(data.groundsForDivorce) || blankAnswer;
  const childrenAnswer = children.length
    ? children.map((c) => `${str(c.name)} (born ${str(c.dob) || BLANK_SHORT})`).join('; ')
    : 'No minor children listed in your story.';
  const propertyAnswer = str(data.propertyAgreement)
    ? str(data.propertyAgreement)
    : str(data.assetsDescription)
      ? `Property in your story: ${str(data.assetsDescription)}. Agreed division: ${BLANK_LINE}`
      : blankAnswer;
  const supportParts = [];
  if (data.childSupportAmount !== undefined && data.childSupportAmount !== null && str(data.childSupportAmount) !== '') {
    supportParts.push(`Child support: ${formatMoney(data.childSupportAmount)} per month.`);
  }
  const spousalAmount = data.spousalSupportAmount ?? data.supportAmount;
  if (spousalAmount !== undefined && spousalAmount !== null && str(spousalAmount) !== '') {
    supportParts.push(`Spousal support: ${formatMoney(spousalAmount)} per month.`);
  } else if (str(data.spousalSupportRequested)) {
    supportParts.push(`Spousal support requested: ${str(data.spousalSupportRequested)}.`);
  }
  const custody = str(data.custodyArrangement);
  if (custody) supportParts.push(`Custody: ${custody}.`);
  const supportAnswer = supportParts.length ? supportParts.join(' ') : blankAnswer;

  const qa = [
    {
      q: `Have you lived in ${county || BLANK_SHORT} County, Utah for at least 3 months before filing?`,
      a: residencyAnswer,
    },
    { q: 'When and where were you married — and when did you separate?', a: marriageAnswer },
    { q: 'What is the legal reason (grounds) for your divorce?', a: groundsAnswer },
    { q: 'What are the names and birth dates of your minor children?', a: childrenAnswer },
    {
      q: `Have you and ${respondent} agreed on how to divide property and debts?`,
      a: propertyAnswer,
    },
    {
      q: 'What should the papers say about custody, child support, and spousal support?',
      a: supportAnswer,
    },
  ];

  const facts = {
    items: qa.map((pair, idx) => ({
      number: idx + 1,
      content: `Q: ${pair.q}\nYour answer: ${pair.a}`,
      type: 'question',
    })),
  };

  return baseStructure(
    'finalization_prep',
    {
      header: null,
      caseCaption: null,
      title: 'Finishing your Utah divorce — your checklist and declaration prep',
      introduction,
      facts,
      conclusion:
        'This prep sheet is general information to help you organize your own uncontested ' +
        'Utah divorce. It is not legal advice, and it is not a substitute for advice from a ' +
        'licensed Utah attorney about your specific situation.',
      perjuryStatement: null,
      signatureBlock: null,
      notaryBlock: null,
    },
    opts,
  );
}

module.exports = {
  UTAH_UNSWORN_DECLARATION,
  normalizeCountyName,
  acceptanceOfService,
  certificateOfService,
  financialDeclaration,
  motionForDefaultPackage,
  finalizationPrep,
};
