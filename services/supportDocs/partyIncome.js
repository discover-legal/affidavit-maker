'use strict';

// services/supportDocs/partyIncome.js
// Per-party income derivation, shared by every document that swears to or
// computes from income: the financial declaration, the fee-waiver motion,
// the child support worksheet (via services/childSupport), and the lawyer
// handoff summary.
//
// DATA CONTRACT (2026-08 extraction):
//   monthlyIncome        = the USER's own gross monthly income. The user is
//                          the declarant in these builders and sits on the
//                          caption side `role` names (missing role means
//                          petitioner — same convention as extraction).
//   spouseMonthlyIncome  = the spouse's gross monthly income
//   incomeBreakdown      = itemized entries tagged by CAPTION side
//                          ({ label, amount, person: 'petitioner'|'respondent' }).
//                          Untagged entries were collected as the declarant's
//                          own financial declaration (the interview tags the
//                          other parent's entries), so they belong to the
//                          declarant's side.
//
// LEGACY data may still carry a HOUSEHOLD TOTAL in `monthlyIncome` (this
// once printed the household total as ONE spouse's income on sworn forms —
// inflating a Child Support Worksheet's shares and a Financial Declaration's
// "TOTAL MONTHLY INCOME" 2.5x). Rules, in order:
//   1. An explicit per-person field (petitionerMonthlyIncome,
//      respondentMonthlyIncome/respondentIncome/respondentGrossMonthlyIncome)
//      is unambiguous and wins.
//   2. Otherwise the per-person sums of `incomeBreakdown` win — including
//      over the `monthlyIncome` scalar, so a legacy household total can
//      never masquerade as one person's income when itemized data exists.
//      When both sides' itemized sums add up to the scalar, the scalar is
//      flagged as a household total in `warnings`.
//   3. Otherwise the contract scalars (`monthlyIncome` for the declarant's
//      side, `spouseMonthlyIncome` for the spouse's) are used — except that a
//      scalar matching the OTHER side's itemized sum is never attributed to
//      this side.
//   4. An amount is NEVER attributed to a person the data does not tie it
//      to. A party with nothing attributable resolves to `amount: null` —
//      callers render a placeholder ([MONTHLY INCOME]) or blank plus a
//      warning, because a blank on a sworn form beats a wrong number.

const INCOME_PLACEHOLDER = '[MONTHLY INCOME]';

function str(value) {
  return value === undefined || value === null ? '' : String(value).trim();
}

/** Parse '$3,200', '3200', 3200 → 3200. Unparseable/non-positive → 0. */
function parseAmount(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value > 0 ? value : 0;
  const n = Number(String(value ?? '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** An explicitly declared zero ("I have no income") is data, not absence. */
function declaredZero(value) {
  return value === 0 || str(value) === '0' || str(value) === '$0';
}

function formatUsd(n) {
  return `$${n.toLocaleString('en-US', {
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Which side an itemized entry is tied to; null = ambiguous, attribute to no one. */
function sideOf(entry, declarantSide) {
  const person = str(entry.person).toLowerCase();
  if (!person) return declarantSide; // collected as the declarant's own declaration
  if (person.includes('respondent')) return 'respondent';
  if (person.includes('petitioner')) return 'petitioner';
  return null;
}

function sumOf(items) {
  return items.reduce((total, it) => total + parseAmount(it.amount), 0);
}

/** ≈ comparison for household-total detection (rounding drift tolerance). */
function approxEquals(a, b) {
  return Math.abs(a - b) <= Math.max(1, b * 0.02);
}

/**
 * Derive each party's gross monthly income under the data contract above.
 *
 * @param {object} data - stored story data (profile and/or document content)
 * @returns {{
 *   petitioner: { amount: number|null, items: object[], source: string|null },
 *   respondent: { amount: number|null, items: object[], source: string|null },
 *   unattributedItems: object[],
 *   householdScalar: boolean,
 *   warnings: string[],
 * }}
 */
/**
 * Some callers reach the support-doc builders with a wrapped payload of the
 * shape `{ affidavitData: { monthlyIncome, monthlyExpenses, ... } }` (the
 * editor blob served as-is instead of the flattened document content). The
 * builders' data contract is FLAT — every derivation below reads
 * `data.<field>` — so treat a nested `affidavitData` object as a defensive
 * fallback: top-level fields still WIN when present, but a nested value is
 * used when the top-level is absent, so an `affidavitData.monthlyExpenses`
 * that the caller passed does not silently render as $0.
 *
 * This unwrap is intentionally shallow (no deep merge) — the acceptance-run
 * payload we have to accommodate is the one-layer wrap.
 */
function unwrapAffidavitData(data) {
  if (!data || typeof data !== 'object') return {};
  const nested = data.affidavitData;
  if (!nested || typeof nested !== 'object' || Array.isArray(nested)) return data;
  return { ...nested, ...data };
}

function resolvePartyIncomes(rawData = {}) {
  const data = unwrapAffidavitData(rawData);
  // Which caption side the USER (the declarant in these builders) sits on —
  // mirrors the extraction contract's role-aware mapping: `monthlyIncome` is
  // the USER's own income even when the user is the respondent, and untagged
  // itemized entries were collected as the declarant's own declaration.
  const declarantSide = str(data.role).toLowerCase() === 'respondent' ? 'respondent' : 'petitioner';
  const spouseSide = declarantSide === 'respondent' ? 'petitioner' : 'respondent';

  const entries = (Array.isArray(data.incomeBreakdown) ? data.incomeBreakdown : []).filter(
    (it) => it && typeof it === 'object' && (str(it.label) || it.amount !== undefined),
  );
  const petitionerItems = [];
  const respondentItems = [];
  const unattributedItems = [];
  for (const entry of entries) {
    const side = sideOf(entry, declarantSide);
    if (side === 'respondent') respondentItems.push(entry);
    else if (side === 'petitioner') petitionerItems.push(entry);
    else unattributedItems.push(entry);
  }
  const petitionerSum = sumOf(petitionerItems);
  const respondentSum = sumOf(respondentItems);
  const sums = { petitioner: petitionerSum, respondent: respondentSum };
  const scalar = parseAmount(data.monthlyIncome);
  const warnings = [];

  const bothSum = petitionerSum + respondentSum;
  const householdScalar =
    scalar > 0 && petitionerSum > 0 && respondentSum > 0 && approxEquals(scalar, bothSum);
  if (householdScalar) {
    warnings.push(
      `The stored monthly income total (${formatUsd(scalar)}) matches both parties' itemized ` +
        "income combined — it was treated as a household total, not one person's income; each " +
        "party's own itemized amounts were used instead.",
    );
  }
  if (unattributedItems.length > 0) {
    warnings.push(
      `${unattributedItems.length} income ${unattributedItems.length === 1 ? 'entry' : 'entries'} ` +
        'could not be tied to a specific person and were left out of the per-person totals — ' +
        'review and add them yourself where they belong.',
    );
  }

  // Explicit per-person fields are caption-named regardless of who the
  // declarant is.
  const EXPLICIT_FIELDS = {
    petitioner: ['petitionerMonthlyIncome'],
    respondent: ['respondentMonthlyIncome', 'respondentIncome', 'respondentGrossMonthlyIncome'],
  };

  const resolveSide = (side) => {
    const explicitField = EXPLICIT_FIELDS[side].find(
      (field) => parseAmount(data[field]) > 0 || declaredZero(data[field]),
    );
    if (explicitField) {
      return { amount: parseAmount(data[explicitField]), source: explicitField };
    }
    if (sums[side] > 0) {
      return { amount: sums[side], source: 'incomeBreakdown' };
    }
    if (side === declarantSide) {
      // ── the declarant's own side: `monthlyIncome` is the user's own ──
      if (scalar > 0 || declaredZero(data.monthlyIncome)) {
        const otherSum = sums[spouseSide];
        if (otherSum > 0 && approxEquals(scalar, otherSum)) {
          // The scalar restates the OTHER side's itemized income — never the
          // declarant's own. Leave the declarant's income unknown.
          warnings.push(
            `The stored monthly income (${formatUsd(scalar)}) matches the other party's itemized ` +
              'income — it was not attributed to the declarant. Enter your own monthly income.',
          );
          return { amount: null, source: null };
        }
        if (otherSum > 0) {
          warnings.push(
            `The declarant's monthly income (${formatUsd(scalar)}) came from a single stored ` +
              'total — verify it is your own income only, not a combined household figure.',
          );
        }
        return { amount: scalar, source: 'monthlyIncome' };
      }
    } else if (parseAmount(data.spouseMonthlyIncome) > 0 || declaredZero(data.spouseMonthlyIncome)) {
      // ── the spouse's side ──
      return { amount: parseAmount(data.spouseMonthlyIncome), source: 'spouseMonthlyIncome' };
    }
    return { amount: null, source: null };
  };

  // Resolve the declarant first so warning order stays stable.
  const bySide = {};
  bySide[declarantSide] = resolveSide(declarantSide);
  bySide[spouseSide] = resolveSide(spouseSide);

  return {
    petitioner: { ...bySide.petitioner, items: petitionerItems },
    respondent: { ...bySide.respondent, items: respondentItems },
    declarant: declarantSide,
    unattributedItems,
    householdScalar,
    warnings,
  };
}

/**
 * `parseAmount` above rejects zero, because income of 0 usually means "unknown"
 * on a sworn form. Expenses are different — a user CAN legitimately have $0 of
 * a given expense, and the scalar `monthlyExpenses` can be an explicit 0. This
 * variant preserves 0 (and negative, though callers coerce) and is used only
 * by `resolveDeclarantExpenses`.
 */
function parseExpenseAmount(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const n = Number(String(value ?? '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function hasValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== '';
}

/**
 * Per-declarant expense derivation, mirroring how income resolves above.
 *
 * DATA CONTRACT:
 *   monthlyExpenses    = the declarant's own total monthly expenses (scalar).
 *   expenseBreakdown   = itemized entries { label, amount, person? }.
 *                        Untagged entries were collected as the declarant's
 *                        own declaration; person-tagged entries carry a
 *                        caption side ('petitioner' | 'respondent').
 *
 * Resolution:
 *   1. If `expenseBreakdown` has any entries the declarant may swear to (own
 *      side tags + untagged), those itemize.
 *   2. Otherwise the scalar `monthlyExpenses` — if present, including an
 *      explicit 0 — renders as a single line so the total is not silently
 *      dropped just because no breakdown was extracted.
 *   3. Neither on file → callers render a placeholder + warning.
 *
 * Returns { items, scalarAmount, hasBreakdown, hasScalar, hasData }.
 */
function resolveDeclarantExpenses(rawData = {}, declarantSide = 'petitioner') {
  const data = unwrapAffidavitData(rawData);
  const raw = Array.isArray(data.expenseBreakdown) ? data.expenseBreakdown : [];
  const items = raw.filter((entry) => {
    if (!entry || typeof entry !== 'object') return false;
    if (!str(entry.label) && entry.amount === undefined) return false;
    const person = str(entry.person).toLowerCase();
    if (!person) return true; // untagged → declarant's own
    if (person.includes('respondent')) return declarantSide === 'respondent';
    if (person.includes('petitioner')) return declarantSide === 'petitioner';
    return false;
  });
  const hasScalar = hasValue(data.monthlyExpenses);
  const scalarAmount = hasScalar ? parseExpenseAmount(data.monthlyExpenses) : 0;
  const hasBreakdown = items.length > 0;
  return {
    items,
    scalarAmount,
    hasBreakdown,
    hasScalar,
    hasData: hasBreakdown || hasScalar,
  };
}

module.exports = { resolvePartyIncomes, resolveDeclarantExpenses, INCOME_PLACEHOLDER };
