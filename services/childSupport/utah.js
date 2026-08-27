'use strict';

// services/childSupport/utah.js
// Utah child support ESTIMATE — the statutory income-shares worksheet math,
// implemented from the verbatim text of Utah Code §§ 81-6-204, -205, -206
// (calculation rules) applied to the §§ 81-6-304/-305 tables encoded in
// ./utahTable.js (see that file's header for provenance + verification).
//
// Statutory rules implemented (orders entered on or after Jan 1, 2023):
//   § 81-6-204(1)  combine both parents' monthly adjusted gross incomes and
//                  look up the base combined obligation by income bracket and
//                  number of children in common
//   § 81-6-204(4)  no amount listed in the base table → base obligation is $0
//   § 81-6-204(7)  table covers up to 6 children; with more, the court may add
//                  amounts but not order less than the 6-child amount
//   § 81-6-204(8)  combined income above the table → court orders case-by-case,
//                  but not less than the highest bracket for that child count
//   § 81-6-204(10) income and award figures round to the nearest dollar
//   § 81-6-205     sole custody: each parent's award = their income share of
//                  the base; low income table caps the obligor's award when
//                  the obligor's individual income is on that table
//                  (lesser-of rule, § 205(4)(a); blank low cell → base table,
//                  § 205(4)(b)); $30 minimum (§ 205(5)); the noncustodial
//                  parent is the obligor (§ 205(7))
//   § 81-6-206     joint physical custody: the lesser-overnights parent's
//                  share is reduced by (overnights over 110 and under 131 ×
//                  .0027 + overnights over 130 × .0084) × base; a negative
//                  result flips who pays (§ 206(5)-(6)); on an equal schedule
//                  the lower-income parent is deemed to have 183 overnights
//                  (§ 206(7))
//
// What is NOT implemented (returns notes instead of guesses): split custody
// (§ 81-6-207), income imputation (§ 81-6-203(6)), medical/child-care add-ons
// (§§ 81-6-208/-209), and adjustments for prior support orders
// (§ 81-6-204(1)(a)) — the interview does not collect those inputs, so the
// estimate treats gross monthly income as the adjusted income and says so.
//
// UPL framing: every result is an ESTIMATE for preparing paperwork. The Utah
// Courts' official calculator and, ultimately, the judge decide the actual
// amount. This is information, not legal advice.

const statutoryTable = require('./utahTable');
const { resolvePartyIncomes } = require('../supportDocs/partyIncome');

const OFFICIAL_CALCULATOR_URL =
  'https://www.utcourts.gov/en/self-help/case-categories/family/child-support.html';

const ESTIMATE_DISCLAIMER =
  'This is an ESTIMATE to help you prepare paperwork, based on the numbers in your story. ' +
  'Utah generally sets child support by statutory guidelines, but the official calculator ' +
  `published by the Utah Courts (${OFFICIAL_CALCULATOR_URL}) and, ultimately, the judge ` +
  'decide the actual amount. This is information, not legal advice.';

const ADJUSTED_INCOME_NOTE =
  'This estimate uses each parent\'s gross monthly income as the "adjusted" income. Utah ' +
  'generally subtracts alimony and child support already ordered in OTHER cases before the ' +
  'lookup (Utah Code 81-6-204(1)) — if either parent pays those, the official calculator ' +
  'will give a more accurate number.';

// § 81-6-206(4) joint physical custody parent-time offsets.
const JOINT_RATE_111_TO_130 = 0.0027;
const JOINT_RATE_OVER_130 = 0.0084;
// Utah treats 111+ overnights with each parent as joint physical custody
// territory (the § 81-6-206(4) formula starts crediting at overnight 111).
const JOINT_OVERNIGHT_THRESHOLD = 111;

// ─── small helpers ───────────────────────────────────────────────────────────

function str(value) {
  return value === undefined || value === null ? '' : String(value).trim();
}

/** Parse '$3,200', '3200', 3200 → 3200. Unparseable/non-positive → 0. */
function parseAmount(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value > 0 ? value : 0;
  const n = Number(String(value ?? '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

// ─── input resolution ────────────────────────────────────────────────────────

// Per-party income derivation lives in services/supportDocs/partyIncome.js —
// explicit per-person fields win, then the per-person sums of the
// person-tagged incomeBreakdown, then the contract scalars (monthlyIncome =
// the USER's own income, spouseMonthlyIncome = the spouse's). A legacy
// household total stored in `monthlyIncome` is never attributed to one
// parent (that once inflated a worksheet's "Petitioner's gross monthly
// income" to the household total and flipped the shares).

function birthYearOf(child) {
  const raw = str(child.dob) || str(child.dateOfBirth) || str(child.birthDate);
  if (!raw) return null;
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) return parsed.getFullYear();
  const yearMatch = raw.match(/\b(19|20)\d{2}\b/);
  return yearMatch ? Number(yearMatch[0]) : null;
}

function ageOf(child, now) {
  const raw = str(child.dob) || str(child.dateOfBirth) || str(child.birthDate);
  if (raw) {
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
      return Math.floor((now.getTime() - parsed.getTime()) / (365.25 * 24 * 3600 * 1000));
    }
  }
  if (typeof child.age === 'number' && Number.isFinite(child.age)) return child.age;
  return null; // unknown — treated as a minor, with a note
}

/**
 * Children the estimate covers: listed children minus those clearly 18 or
 * older. Children without a usable birth date are INCLUDED (with a note) so a
 * missing detail doesn't silently zero out the estimate.
 */
function resolveChildren(data, now = new Date()) {
  const listed = Array.isArray(data.children)
    ? data.children.filter((c) => c && typeof c === 'object' && str(c.name))
    : [];
  const minors = [];
  const excludedAdults = [];
  let unknownDob = 0;
  for (const child of listed) {
    const age = ageOf(child, now);
    if (age !== null && age >= 18) {
      excludedAdults.push(str(child.name));
      continue;
    }
    if (age === null) unknownDob += 1;
    minors.push({ name: str(child.name), birthYear: birthYearOf(child) });
  }
  return { minors, excludedAdults, unknownDob };
}

function matchesParty(value, role, data) {
  const v = str(value).toLowerCase();
  if (!v) return false;
  if (v.includes(role)) return true; // 'petitioner' / 'respondent'
  const name = str(role === 'petitioner' ? data.petitionerName : data.respondentName).toLowerCase();
  return Boolean(name) && (v.includes(name) || name.includes(v));
}

/** Who would pay (obligor) in a sole-custody case: explicit payor wins;
 *  otherwise the parent the children do NOT primarily live with (§ 81-6-205(7)).
 *  Returns null when neither is known. */
function resolveObligorRole(data) {
  const payor = data.childSupportPayor;
  if (matchesParty(payor, 'petitioner', data)) return 'petitioner';
  if (matchesParty(payor, 'respondent', data)) return 'respondent';
  const custodian = data.primaryCustodian;
  if (matchesParty(custodian, 'petitioner', data)) return 'respondent';
  if (matchesParty(custodian, 'respondent', data)) return 'petitioner';
  return null;
}

/**
 * Joint physical custody detection:
 *  - parentTimePlan 'equal' → joint; § 81-6-206(7) deems the lower-income
 *    parent to have 183 overnights (other parent 182)
 *  - explicit overnight counts with BOTH parents at 111+ → joint, using those
 *  - 'expanded' or a single-sided count → sole model plus a pointer note (the
 *    expanded schedule's exact overnight count isn't encoded here)
 * Returns null (not joint) or { petitionerOvernights, respondentOvernights, deemed }.
 */
function resolveJoint(data, petitionerIncome, respondentIncome) {
  const plan = str(data.parentTimePlan).toLowerCase();
  if (plan === 'equal') {
    const petitionerIsLowerIncome = petitionerIncome <= respondentIncome;
    return {
      petitionerOvernights: petitionerIsLowerIncome ? 183 : 182,
      respondentOvernights: petitionerIsLowerIncome ? 182 : 183,
      deemed: true,
    };
  }
  const p = parseAmount(data.petitionerOvernights);
  const r = parseAmount(data.respondentOvernights);
  if (p >= JOINT_OVERNIGHT_THRESHOLD && r >= JOINT_OVERNIGHT_THRESHOLD) {
    return { petitionerOvernights: p, respondentOvernights: r, deemed: false };
  }
  return null;
}

/** True when the story hints at joint custody without giving usable numbers. */
function jointHintOnly(data) {
  const plan = str(data.parentTimePlan).toLowerCase();
  if (plan === 'expanded') return true;
  const p = parseAmount(data.petitionerOvernights);
  const r = parseAmount(data.respondentOvernights);
  const one = Math.max(p, r);
  // A single known side at 111-254 overnights leaves the other side at 111+ too.
  return (p === 0) !== (r === 0) && one >= JOINT_OVERNIGHT_THRESHOLD && one <= 365 - JOINT_OVERNIGHT_THRESHOLD;
}

// ─── table validation ────────────────────────────────────────────────────────

function validateRows(rows, label, cols, errors) {
  if (!Array.isArray(rows) || rows.length === 0) {
    errors.push(`${label} must be a non-empty array`);
    return;
  }
  let prev = null;
  rows.forEach((row, i) => {
    const at = `${label}[${i}]`;
    if (!row || typeof row !== 'object') {
      errors.push(`${at} is not an object`);
      return;
    }
    if (!Number.isInteger(row.from) || !Number.isInteger(row.to) || row.from < 0 || row.to < row.from) {
      errors.push(`${at} bracket must satisfy 0 <= from <= to (integers)`);
    }
    if (prev && Number.isInteger(row.from) && row.from !== prev.to + 1) {
      errors.push(`${at} bracket is not contiguous (prev to=${prev.to}, from=${row.from})`);
    }
    const by = row.byChildren;
    if (!Array.isArray(by) || by.length !== cols) {
      errors.push(`${at}.byChildren must have exactly ${cols} entries`);
    } else {
      let prevInRow = null;
      by.forEach((v, c) => {
        if (v === null) return;
        if (!Number.isInteger(v) || v <= 0) {
          errors.push(`${at}.byChildren[${c}] must be a positive integer or null`);
          return;
        }
        if (prevInRow !== null && v < prevInRow) {
          errors.push(`${at}.byChildren[${c}] (${v}) decreases as the child count rises`);
        }
        prevInRow = v;
        if (prev && Array.isArray(prev.byChildren) && Number.isInteger(prev.byChildren[c]) && v < prev.byChildren[c]) {
          errors.push(`${at}.byChildren[${c}] (${v}) decreases as income rises`);
        }
      });
    }
    prev = row;
  });
}

/**
 * Structural validation for the statutory table module — run after any
 * re-encoding for instant verification.
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateTable(table) {
  const errors = [];
  if (!table || typeof table !== 'object') {
    return { valid: false, errors: ['table is not an object'] };
  }
  if (table.populated !== true) {
    if ((Array.isArray(table.baseRows) && table.baseRows.length > 0) ||
        (Array.isArray(table.lowIncomeRows) && table.lowIncomeRows.length > 0)) {
      errors.push('populated is false but rows are present — flip populated together with verbatim data');
    }
    return { valid: errors.length === 0, errors };
  }
  const cols = table.childColumns;
  if (!Number.isInteger(cols) || cols < 1) {
    errors.push('childColumns must be a positive integer');
  }
  if (!table.effectiveDate) errors.push('effectiveDate must record the statute version encoded');
  if (!table.sourceUrl) errors.push('sourceUrl must record where the data was fetched');
  if (!table.fetchedAt) errors.push('fetchedAt must record when the data was fetched');
  if (!Number.isInteger(table.minimumSoleAward) || table.minimumSoleAward < 0) {
    errors.push('minimumSoleAward must be a non-negative integer (Utah Code 81-6-205(5))');
  }
  if (Number.isInteger(cols) && cols >= 1) {
    validateRows(table.baseRows, 'baseRows', cols, errors);
    validateRows(table.lowIncomeRows, 'lowIncomeRows', cols, errors);
  }
  return { valid: errors.length === 0, errors };
}

// ─── table lookup ────────────────────────────────────────────────────────────

/** Bracket lookup. Returns { value: number|null } for an in-range income
 *  (null = blank cell), or { outcome: 'below' | 'above' }. */
function lookup(rows, income, columnIndex) {
  if (income < rows[0].from) return { outcome: 'below' };
  const last = rows[rows.length - 1];
  if (income > last.to) return { outcome: 'above' };
  for (const row of rows) {
    if (income >= row.from && income <= row.to) {
      return { value: row.byChildren[columnIndex], row };
    }
  }
  // Contiguous brackets make this unreachable; guard anyway.
  return { outcome: 'above' };
}

// ─── the calculator ──────────────────────────────────────────────────────────

/**
 * Estimate Utah child support from interview/profile data.
 *
 * @param {object} data - stored story data (see FIELD_MAPs in services/agents)
 * @param {object} [opts]
 * @param {object} [opts.table] - TEST-ONLY table module override; production
 *                                always reads ./utahTable.js
 * @returns one of:
 *   { insufficient: true, missing: string[], ... }
 *   { unavailable: true, reason: string, officialCalculatorUrl, partial, ... }
 *   { model: 'sole'|'joint', combinedMonthlyIncome, petitionerIncome,
 *     respondentIncome, baseCombinedObligation, petitionerShare,
 *     respondentShare, obligorRole, monthlyObligation, perChild, childCount,
 *     children, notes, officialCalculatorUrl, meta, ... }
 */
function calculateUtah(data = {}, opts = {}) {
  const table = opts.table || statutoryTable;
  const notes = [ESTIMATE_DISCLAIMER];

  // § 81-6-204(10): income figures round to the nearest dollar.
  const derivedIncomes = resolvePartyIncomes(data);
  notes.push(...derivedIncomes.warnings);
  const petitionerIncome = Math.round(derivedIncomes.petitioner.amount || 0);
  const respondentIncome = Math.round(derivedIncomes.respondent.amount || 0);
  const { minors, excludedAdults, unknownDob } = resolveChildren(data);
  const joint = resolveJoint(data, petitionerIncome, respondentIncome);
  const obligorRoleSole = resolveObligorRole(data);

  const missing = [];
  if (petitionerIncome <= 0) missing.push('petitioner gross monthly income');
  if (respondentIncome <= 0) missing.push('respondent gross monthly income');
  if (minors.length === 0) {
    missing.push('the children this support covers (names and birth dates)');
  }
  if (!joint && !obligorRoleSole) {
    missing.push(
      'which parent the children live with most of the time (primary custodian), or which parent would pay',
    );
  }
  if (missing.length > 0) {
    return { insufficient: true, missing, notes, officialCalculatorUrl: OFFICIAL_CALCULATOR_URL };
  }

  notes.push(ADJUSTED_INCOME_NOTE);
  if (excludedAdults.length > 0) {
    notes.push(
      `Not counted (already 18 or older — support generally ends at 18 or normal high-school ` +
      `graduation in Utah): ${excludedAdults.join(', ')}. The court decides any exceptions.`,
    );
  }
  if (unknownDob > 0) {
    notes.push(
      `${unknownDob} child${unknownDob === 1 ? ' has' : 'ren have'} no birth date on file — ` +
      'counted as minor(s) for this estimate. Add birth dates to make the paperwork accurate.',
    );
  }
  if (!joint && jointHintOnly(data)) {
    notes.push(
      'Your parent-time details hint at joint physical custody (generally 111 or more ' +
      'overnights with each parent per year), but this estimate could not confirm each ' +
      'parent\'s overnight count, so it uses the sole-custody worksheet. Joint custody ' +
      'usually lowers the paying parent\'s amount — run the court\'s official calculator ' +
      `with your overnight counts: ${OFFICIAL_CALCULATOR_URL}`,
    );
  }

  const combined = petitionerIncome + respondentIncome;
  const petitionerShare = round2((petitionerIncome / combined) * 100);
  const respondentShare = round2(100 - petitionerShare);
  const meta = {
    statute: table.statute,
    effectiveDate: table.effectiveDate,
    encodedFrom: table.sourceUrl,
  };
  const common = {
    combinedMonthlyIncome: combined,
    petitionerIncome,
    respondentIncome,
    petitionerShare,
    respondentShare,
    childCount: minors.length,
    children: minors,
    officialCalculatorUrl: OFFICIAL_CALCULATOR_URL,
    meta,
  };

  const structure = validateTable(table);
  if (table.populated !== true || !structure.valid) {
    return {
      unavailable: true,
      reason: table.populated !== true ? 'table_not_populated' : 'table_invalid',
      officialCalculatorUrl: OFFICIAL_CALCULATOR_URL,
      partial: { ...common, obligorRole: joint ? null : obligorRoleSole },
      notes: notes.concat(
        'The statutory child support table could not be used, so no dollar estimate is ' +
        'shown. The court\'s official calculator has the current numbers: ' +
        OFFICIAL_CALCULATOR_URL,
      ),
      meta,
      errors: structure.errors,
    };
  }

  // Column: § 81-6-204(7) — the table covers up to `childColumns` children.
  const cols = table.childColumns;
  let columnIndex = minors.length - 1;
  if (minors.length > cols) {
    columnIndex = cols - 1;
    notes.push(
      `The statutory table lists up to ${cols} children; with ${minors.length} children the ` +
      `court may add to the ${cols}-child amount but generally may not order less than it ` +
      '(Utah Code 81-6-204(7)). This estimate uses that amount.',
    );
  }

  // Base combined obligation: § 81-6-204(1), (4), (8).
  let base;
  const baseLookup = lookup(table.baseRows, combined, columnIndex);
  if (baseLookup.outcome === 'above') {
    const lastRow = table.baseRows[table.baseRows.length - 1];
    base = lastRow.byChildren[columnIndex];
    notes.push(
      'Your combined income is above the highest bracket on the statutory table. The court ' +
      'sets an appropriate amount case-by-case, but generally may not order less than the ' +
      'highest bracket (Utah Code 81-6-204(8)) — this estimate uses that bracket, so treat ' +
      'it as a starting point, not a cap.',
    );
  } else if (baseLookup.outcome === 'below' || baseLookup.value === null) {
    // § 81-6-204(4): no listed amount → base combined obligation is $0.
    base = 0;
  } else {
    base = baseLookup.value;
  }

  return joint
    ? computeJoint({ table, base, joint, notes, common })
    : computeSole({ table, base, obligorRole: obligorRoleSole, notes, common });
}

/** § 81-6-205 — sole physical custody. */
function computeSole(ctx) {
  const { table, base, obligorRole, notes, common } = ctx;
  const obligorIncome = obligorRole === 'petitioner' ? common.petitionerIncome : common.respondentIncome;
  const obligorShare = obligorIncome / common.combinedMonthlyIncome;
  const lowRows = table.lowIncomeRows;
  const lowMax = lowRows[lowRows.length - 1].to;
  const columnIndex = Math.min(common.childCount, table.childColumns) - 1;

  let award;
  if (base > 0) {
    award = Math.round(base * obligorShare); // § 205(2), rounding per § 204(10)
    if (obligorIncome <= lowMax) {
      const low = lookup(lowRows, obligorIncome, columnIndex);
      if (low.value !== null && low.value !== undefined && !low.outcome) {
        // § 205(4)(a): lesser of the base-table and low-income calculations.
        if (low.value < award) {
          award = low.value;
          notes.push(
            'Because the paying parent\'s own income is on Utah\'s low income table, the ' +
            'estimate uses the lower amount from that table (Utah Code 81-6-205(4)).',
          );
        }
      }
      // § 205(4)(b): blank low-income cell → keep the base-table calculation.
    }
  } else {
    // § 205(3): base is $0 → the low income table sets the award from the
    // paying parent's own income; blank cell → base-table result ($0), § 205(4)(b).
    const low = lookup(lowRows, obligorIncome, columnIndex);
    award = !low.outcome && low.value !== null && low.value !== undefined ? low.value : 0;
    notes.push(
      'Your combined income is below the base table (or the table shows no amount there), ' +
      'so Utah\'s low income table sets the estimate from the paying parent\'s own income ' +
      '(Utah Code 81-6-204(4), 81-6-205(3)).',
    );
  }

  // § 205(5): sole-custody award may not be less than $30.
  if (award < table.minimumSoleAward) {
    award = table.minimumSoleAward;
    notes.push(
      `Utah generally sets a minimum of $${table.minimumSoleAward} per month in sole-custody ` +
      'cases (Utah Code 81-6-205(5)).',
    );
  }

  return buildResult({
    model: 'sole',
    base,
    obligorRole,
    monthlyObligation: award,
    notes,
    common,
  });
}

/** § 81-6-206 — joint physical custody. */
function computeJoint(ctx) {
  const { base, joint, notes, common } = ctx;
  const { petitionerOvernights, respondentOvernights, deemed } = joint;
  notes.push(
    deemed
      ? 'Equal parent-time schedule: Utah counts the lower-income parent as having 183 ' +
        'overnights for this calculation (Utah Code 81-6-206(7)).'
      : `Joint physical custody calculation used (Utah Code 81-6-206) with ` +
        `${petitionerOvernights} petitioner / ${respondentOvernights} respondent overnights per year.`,
  );

  if (base <= 0) {
    // § 206(2): base of $0 → each parent's award is $0.
    notes.push(
      'Your combined income is below the base table (or the table shows no amount there), ' +
      'so in a joint physical custody case the estimated award is $0 (Utah Code 81-6-206(2)).',
    );
    return buildResult({
      model: 'joint',
      base,
      obligorRole: null,
      monthlyObligation: 0,
      notes,
      common,
      overnights: { petitioner: petitionerOvernights, respondent: respondentOvernights },
    });
  }

  const lesserIsPetitioner = petitionerOvernights <= respondentOvernights;
  const lesserRole = lesserIsPetitioner ? 'petitioner' : 'respondent';
  const lesserOvernights = lesserIsPetitioner ? petitionerOvernights : respondentOvernights;
  const lesserShare =
    (lesserIsPetitioner ? common.petitionerIncome : common.respondentIncome) /
    common.combinedMonthlyIncome;

  // § 206(4): offsets for time the lesser-overnights parent has the children.
  const nights111to130 = Math.max(0, Math.min(lesserOvernights, 130) - 110);
  const nightsOver130 = Math.max(0, lesserOvernights - 130);
  const raw =
    lesserShare * base -
    nights111to130 * JOINT_RATE_111_TO_130 * base -
    nightsOver130 * JOINT_RATE_OVER_130 * base;
  const rounded = Math.round(raw); // § 204(10)

  let obligorRole;
  let monthlyObligation;
  if (rounded >= 0) {
    obligorRole = lesserRole; // § 206(5)
    monthlyObligation = rounded;
  } else {
    // § 206(6): a negative result flips who pays — the greater-overnights
    // parent becomes the obligor. The statute states the direction; this
    // estimate uses the absolute value as the amount.
    obligorRole = lesserRole === 'petitioner' ? 'respondent' : 'petitioner';
    monthlyObligation = Math.abs(rounded);
    notes.push(
      'The joint-custody formula came out negative, which flips who pays: the parent with ' +
      'more overnights pays the other parent (Utah Code 81-6-206(6)). Double-check this ' +
      'less-common situation with the court\'s official calculator.',
    );
  }

  return buildResult({
    model: 'joint',
    base,
    obligorRole,
    monthlyObligation,
    notes,
    common,
    overnights: { petitioner: petitionerOvernights, respondent: respondentOvernights },
  });
}

function buildResult(ctx) {
  const { model, base, obligorRole, monthlyObligation, notes, common, overnights } = ctx;
  const perChild = common.childCount > 0 ? round2(monthlyObligation / common.childCount) : null;
  const finalNotes = notes.concat(
    'The table amount covers all the children together, not an amount per child ' +
    '(Utah Code 81-6-204(9)) — the per-child figure here is an equal split for ' +
    'information only.',
  );
  return {
    model,
    ...common,
    baseCombinedObligation: base,
    obligorRole,
    monthlyObligation,
    perChild,
    overnights: overnights || null,
    notes: finalNotes,
  };
}

module.exports = {
  calculateUtah,
  validateTable,
  OFFICIAL_CALCULATOR_URL,
  ESTIMATE_DISCLAIMER,
};
