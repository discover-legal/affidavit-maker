// services/supportDocs/utahChildSupportWorksheet.js
// Utah Child Support Worksheet (ESTIMATE), generated from the user's stored
// story data via services/childSupport.
//
// Same contract as the builders in ./utah.js: (data, opts) => documentStructure
// using the generic affidavit `sections` shape that services/pdfService.js
// renders (header, caseCaption.formatted, title, introduction,
// facts.items [{number, content}], conclusion, signatureBlock); documentType
// is pinned to 'affidavit' so detectDocumentType() routes it correctly.
//
// Three render states, all first-class:
//   1. full estimate      — statutory math from services/childSupport/utah.js
//                           (sole custody § 81-6-205 or joint § 81-6-206)
//   2. table unavailable  — defensive: if the statutory table module ever
//                           fails validation, incomes/shares still print
//                           (that math needs no table) and the table-lookup
//                           and obligation lines render as blanks with a
//                           pointer to the Utah Courts' official calculator
//   3. insufficient data  — blanks plus a plain-language list of exactly
//                           what's missing and how to add it
//
// Registration in ./index.js is intentionally NOT done here — the
// orchestrating session wires the registry (kind key 'child_support_worksheet').

const crypto = require('node:crypto');
const { utahCaption, filerBlock } = require('./utah');

const { calculateUtah, OFFICIAL_CALCULATOR_URL } = require('../childSupport');

const BLANK_SHORT = '______________';
const BLANK_LINE = '________________________________';
const BLANK_MONEY = '$__________';

// ─── shared helpers (mirroring ./utah.js, which keeps them module-private) ───

function str(value) {
  return value === undefined || value === null ? '' : String(value).trim();
}

function resolvePetitioner(data) {
  return (
    str(data.petitionerName) ||
    [str(data.petitionerFirstName), str(data.petitionerLastName)].filter(Boolean).join(' ') ||
    '_________________________________'
  );
}

function resolveRespondent(data) {
  return (
    str(data.respondentName) ||
    [str(data.respondentFirstName), str(data.respondentLastName)].filter(Boolean).join(' ') ||
    '_________________________________'
  );
}


function formatMoney(amount) {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) return BLANK_MONEY;
  return `$${amount.toLocaleString('en-US', {
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatPercent(share) {
  if (typeof share !== 'number' || !Number.isFinite(share)) return '_____%';
  return `${share % 1 === 0 ? share : share.toFixed(2)}%`;
}

/** Dot-leader worksheet line: label followed by a right-hand value column. */
function line(label, value) {
  const dots = '.'.repeat(Math.max(3, 48 - label.length));
  return `${label} ${dots} ${value}`;
}

function baseStructure(kind, sections) {
  return {
    id: crypto.randomUUID(),
    state: 'UT',
    documentType: 'affidavit', // pins pdfService.detectDocumentType to the generic path
    kind,
    timestamp: new Date(),
    metadata: {
      supportDoc: true,
      estimate: true,
      kind,
      state: 'UT',
    },
    sections,
  };
}

// ─── the builder ─────────────────────────────────────────────────────────────

/**
 * Utah Child Support Worksheet (ESTIMATE).
 * @param {object} data - stored story data
 * @param {object} [opts]
 * @param {object} [opts.table] - TEST-ONLY statutory-table override, passed
 *                                through to calculateUtah
 */
function childSupportWorksheet(data = {}, opts = {}) {
  const petitioner = resolvePetitioner(data);
  const respondent = resolveRespondent(data);
  const { header, caseCaption } = utahCaption(data);
  const result = calculateUtah(data, opts.table ? { table: opts.table } : undefined);

  const insufficient = result.insufficient === true;
  const unavailable = result.unavailable === true;
  const full = !insufficient && !unavailable;
  // Incomes/shares need no statutory table — print them whenever we have them.
  const figures = full ? result : unavailable ? result.partial : {};

  const obligorName =
    figures.obligorRole === 'petitioner' ? petitioner :
    figures.obligorRole === 'respondent' ? respondent : '';
  const receivingName =
    figures.obligorRole === 'petitioner' ? respondent :
    figures.obligorRole === 'respondent' ? petitioner : '';

  const children = Array.isArray(figures.children) ? figures.children : [];
  const childrenLines = children.length
    ? children.map((c) => `- ${c.name}${c.birthYear ? ` (born ${c.birthYear})` : ` (born ${BLANK_SHORT})`}`)
    : (Array.isArray(data.children) ? data.children : [])
        .filter((c) => c && typeof c === 'object' && str(c.name))
        .map((c) => `- ${str(c.name)} (born ${BLANK_SHORT})`);

  const modelLabel = !full
    ? BLANK_LINE
    : result.model === 'joint'
      ? 'Joint physical custody' +
        (result.overnights
          ? ` (${result.overnights.petitioner}/${result.overnights.respondent} overnights)`
          : '')
      : 'Sole physical custody';

  const worksheetLines = [
    line("Petitioner's gross monthly income", formatMoney(figures.petitionerIncome)),
    line("Respondent's gross monthly income", formatMoney(figures.respondentIncome)),
    line('Combined gross monthly income', formatMoney(figures.combinedMonthlyIncome)),
    line('Number of children covered', figures.childCount != null ? String(figures.childCount) : BLANK_SHORT),
    line('Worksheet used', modelLabel),
    line('Base combined obligation (statutory table)', formatMoney(full ? result.baseCombinedObligation : undefined)),
    line("Petitioner's share of combined income", formatPercent(figures.petitionerShare)),
    line("Respondent's share of combined income", formatPercent(figures.respondentShare)),
    line('Estimated monthly child support', formatMoney(full ? result.monthlyObligation : undefined)),
    line('Paying parent (obligor)', obligorName || BLANK_LINE),
    line('Receiving parent', receivingName || BLANK_LINE),
    line('Per child (informational, equal split)', formatMoney(full ? result.perChild : undefined)),
  ].join('\n');

  const facts = { items: [] };
  let n = 0;

  facts.items.push({
    number: ++n,
    content:
      `Parents: ${petitioner} (Petitioner) and ${respondent} (Respondent).` +
      (str(data.primaryCustodian)
        ? ` The children live most of the time with: ${str(data.primaryCustodian)}.`
        : ''),
    type: 'fact',
  });

  facts.items.push({
    number: ++n,
    content:
      'Children this worksheet covers:\n' +
      (childrenLines.length ? childrenLines.join('\n') : `(none on file) ${BLANK_LINE}`),
    type: 'fact',
  });

  facts.items.push({
    number: ++n,
    content: `WORKSHEET (ESTIMATE):\n${worksheetLines}`,
    type: 'fact',
  });

  if (full) {
    facts.items.push({
      number: ++n,
      content:
        (obligorName
          ? `Based on the statutory table and the incomes above, ${obligorName} would generally ` +
            `pay about ${formatMoney(result.monthlyObligation)} per month (base combined ` +
            `obligation ${formatMoney(result.baseCombinedObligation)}, split in proportion to ` +
            'income and adjusted as Utah\'s guidelines direct). '
          : `Based on the statutory table and the incomes above, the estimated award is ` +
            `${formatMoney(result.monthlyObligation)} per month. `) +
        'This is an estimate for preparing paperwork — the court decides the actual amount.',
      type: 'fact',
    });
  }

  if (unavailable) {
    facts.items.push({
      number: ++n,
      content:
        'A dollar estimate is not available yet: Utah\'s statutory child support table ' +
        'could not be used by this app, so the table-lookup and support lines above are ' +
        'left blank. Your incomes and each parent\'s share are shown because that math ' +
        'comes straight from your own numbers. For the actual guideline amount, use the ' +
        `Utah Courts' official child support calculator: ${OFFICIAL_CALCULATOR_URL}`,
      type: 'fact',
    });
  }

  if (insufficient) {
    facts.items.push({
      number: ++n,
      content:
        'This worksheet could not be completed because some information is still missing:\n' +
        result.missing.map((m) => `- ${m}`).join('\n') +
        '\nYou can add any of these in the chat interview, or open your profile page ' +
        '(/profile) and use "Fix my story" to fill them in. The blanks above will fill in ' +
        'automatically once the information is on file.',
      type: 'fact',
    });
  }

  // Statute-specific caveats from the calculator (joint custody, excluded
  // adult children, above-ceiling, etc.) — skip the standing disclaimer,
  // which the conclusion carries verbatim.
  const extraNotes = (result.notes || []).filter(
    (note) => !/This is an ESTIMATE to help you prepare paperwork/.test(note),
  );
  if (extraNotes.length > 0) {
    facts.items.push({
      number: ++n,
      content: `Notes on this estimate:\n${extraNotes.map((note) => `- ${note}`).join('\n')}`,
      type: 'fact',
    });
  }

  return baseStructure('child_support_worksheet', {
    filerBlock: filerBlock(data, petitioner, 'Petitioner, Pro Se'),
    header,
    caseCaption,
    title: 'CHILD SUPPORT WORKSHEET (ESTIMATE)',
    introduction:
      'This worksheet estimates child support under Utah\'s income-shares guidelines from ' +
      'the information in your story. It generally combines both parents\' gross monthly ' +
      'incomes, looks up the base obligation in the statutory table, and splits it in ' +
      'proportion to each parent\'s income. It is a preparation aid, not a court form ' +
      'or a court order.',
    facts,
    conclusion:
      'IMPORTANT: This is an ESTIMATE to help you prepare paperwork — it is not the ' +
      'official number. Utah generally sets child support by statutory guidelines, and the ' +
      'official calculator published by the Utah Courts ' +
      `(${OFFICIAL_CALCULATOR_URL}) and, ultimately, the judge decide the actual amount. ` +
      'This is information, not legal advice.',
    perjuryStatement: null,
    signatureBlock: {
      line: BLANK_LINE,
      name: petitioner,
      title: 'Prepared by (party)',
      date: `Date: ${BLANK_SHORT}`,
    },
    notaryBlock: null,
  });
}

module.exports = { childSupportWorksheet };
