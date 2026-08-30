// templates/core/canadianHelpers.js
// Shared helpers for Canadian divorce templates (Ontario, Alberta, and any
// other province that adopts them). Three concerns live here:
//
//   1. Field-name aliasing — the interview/profile stores Court File No.,
//      children DOBs, marriage year, and separation date under a number of
//      historical field names; templates hit `undefined` and render a blank
//      when they read only the canonical key. `normalizeCanadianDivorceData`
//      collapses the aliases into the canonical fields the templates use.
//
//   2. Grounds gate for Divorce Act s.8(2)(a) — one-year separation is only
//      pleadable once the parties will have been separated for at least a
//      year by the time the court makes the order. Templates should not
//      assert "have lived separate and apart for one year" when the actual
//      separation is shorter; the helpers emit prospective / warning
//      language instead.
//
//   3. Contested-issue rendering — when the profile carries a
//      `custody_dispute_position` or `child_support_income_imputation`
//      (or the equivalent snake_case / camelCase field), templates render
//      the party's position with the correct statutory hook (Divorce Act
//      s.16.5 for changed circumstances; Federal Child Support Guidelines
//      s.19 for imputation).
'use strict';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Parse a date-like value into an epoch-ms timestamp, or null if the value
 * cannot be trusted as a date. Accepts ISO strings, Date instances, and
 * things Date can natively parse ("March 2026", "2026-03"). NEVER returns
 * NaN — a value that fails to parse comes back null so callers can short
 * circuit rather than emit "NaN days".
 */
function parseDate(value) {
  if (value == null) return null;
  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? value.getTime() : null;
  }
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const s = String(value).trim();
  if (!s) return null;
  const ms = Date.parse(s);
  return Number.isFinite(ms) ? ms : null;
}

function addDays(ts, days) {
  return new Date(ts + days * MS_PER_DAY);
}

function formatLongDate(ts) {
  try {
    return new Date(ts).toLocaleDateString('en-CA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch (_e) {
    return new Date(ts).toISOString().slice(0, 10);
  }
}

/**
 * Compute the s.8(2)(a) one-year separation gate for the current template
 * data. Returns:
 *   { known: false }
 *     — separationDate absent or unparseable; the template should render its
 *       normal language.
 *   { known: true, meetsOneYear: true, oneYearMarkDate, separationDate,
 *     daysSinceSeparation }
 *     — the parties will have been separated for a year by the time the
 *       court considers the order (or already have been); the historical
 *       "have lived separate and apart for at least one year" assertion is
 *       accurate.
 *   { known: true, meetsOneYear: false, oneYearMarkDate, separationDate,
 *     daysSinceSeparation }
 *     — the year is not up yet; templates should switch to prospective
 *       language and emit a drafter warning to consider fault grounds.
 */
function evaluateOneYearSeparation(divorceData, now = Date.now()) {
  const raw = divorceData && (divorceData.separationDate || divorceData.dateOfSeparation);
  const sepMs = parseDate(raw);
  if (sepMs === null) return { known: false };
  const daysSinceSeparation = Math.floor((now - sepMs) / MS_PER_DAY);
  const oneYearMs = sepMs + 365 * MS_PER_DAY;
  return {
    known: true,
    meetsOneYear: daysSinceSeparation >= 365,
    daysSinceSeparation,
    separationDate: formatLongDate(sepMs),
    oneYearMarkDate: formatLongDate(oneYearMs),
    oneYearMarkDateObj: addDays(sepMs, 365),
  };
}

/**
 * Compose the s.8(2)(a) ground pleading language. When the gate is met (or
 * the separation date is unknown, which is the historical default) the
 * template renders the traditional "have lived separate and apart for at
 * least one year" assertion. When the gate is NOT met, the sentence is
 * rewritten in the prospective form ("will have been living separate and
 * apart for at least one year by <date>") and a bracketed drafter warning
 * points to the fault-ground alternatives.
 */
function oneYearSeparationPleading(divorceData, opts = {}) {
  const { statuteCite = 'paragraph 8(2)(a) of the Divorce Act' } = opts;
  const gate = evaluateOneYearSeparation(divorceData);
  if (!gate.known || gate.meetsOneYear) {
    return {
      text:
        'The spouses have lived separate and apart for at least one year immediately preceding the ' +
        `determination of the divorce proceeding, within the meaning of ${statuteCite}.`,
      gate,
    };
  }
  return {
    text:
      `The spouses have been separated since ${gate.separationDate} and will have been living ` +
      `separate and apart for at least one year by ${gate.oneYearMarkDate}, as required by ` +
      `${statuteCite}, by the time the Court considers the granting of a Divorce Order. ` +
      '(Draft — the one-year separation requirement is not yet met; consider filing on ' +
      'cruelty (s.8(2)(b)(ii)) or adultery (s.8(2)(b)(i)) grounds instead, or wait until ' +
      `${gate.oneYearMarkDate}.)`,
    gate,
  };
}

/**
 * Read a contested-issue position from the profile under any of the
 * commonly-stored key names (camelCase, snake_case, "position" suffix).
 */
function readIssuePosition(divorceData, keys) {
  if (!divorceData) return '';
  for (const key of keys) {
    const val = divorceData[key];
    if (typeof val === 'string' && val.trim()) return val.trim();
  }
  return '';
}

/** Custody / parenting-time dispute (Divorce Act s.16.5, changed circumstances). */
function custodyDisputePosition(divorceData) {
  return readIssuePosition(divorceData, [
    'custodyDisputePosition',
    'custody_dispute_position',
    'parentingDisputePosition',
    'parenting_dispute_position',
    'contestedParentingPosition',
  ]);
}

/**
 * Federal Child Support Guidelines s.19 income-imputation request (used
 * when the payor is underemployed or has undisclosed income; the requesting
 * party asks the court to impute income above the T1 line 15000 figure).
 */
function incomeImputationPosition(divorceData) {
  return readIssuePosition(divorceData, [
    'childSupportIncomeImputation',
    'child_support_income_imputation',
    'imputationPosition',
    'incomeImputationPosition',
  ]);
}

/**
 * Normalize a saved-document / profile blob so the templates see the
 * canonical field names they read. Alias sources (from the interview and
 * historical profiles):
 *   caseNumber       ← courtFileNo / courtFileNumber / court_file_no / fileNo / actionNumber
 *   marriageDate     ← marriageDate / dateOfMarriage / marriageYear (ISO YYYY-MM-DD if year-only)
 *   separationDate   ← separationDate / dateOfSeparation
 *   children[].birthDate ← birthDate / dob / dateOfBirth / birth_date
 * Never mutates the input; returns a shallow-cloned object safe to pass to
 * the template.
 */
function normalizeCanadianDivorceData(input) {
  if (!input || typeof input !== 'object') return input;
  const out = { ...input };

  if (!out.caseNumber) {
    out.caseNumber =
      out.courtFileNo ||
      out.courtFileNumber ||
      out.court_file_no ||
      out.court_file_number ||
      out.fileNo ||
      out.actionNumber ||
      out.action_number ||
      out.caseNumber;
  }

  if (!out.marriageDate) {
    out.marriageDate =
      out.dateOfMarriage ||
      out.marriage_date ||
      (out.marriageYear ? String(out.marriageYear).trim() : '') ||
      out.marriageDate;
  }

  if (!out.separationDate) {
    out.separationDate =
      out.dateOfSeparation || out.separation_date || out.separationDate;
  }

  if (Array.isArray(out.children)) {
    out.children = out.children.map((child) => {
      if (!child || typeof child !== 'object') return child;
      if (child.birthDate || child.dob || child.dateOfBirth) return child;
      const dob = child.birth_date || child.date_of_birth;
      if (!dob) return child;
      return { ...child, birthDate: dob };
    });
  }

  return out;
}

module.exports = {
  evaluateOneYearSeparation,
  oneYearSeparationPleading,
  custodyDisputePosition,
  incomeImputationPosition,
  normalizeCanadianDivorceData,
  formatLongDate,
  parseDate,
};
