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
  // timeZone: 'UTC' fixes the day-drift bug (Sarah AB round-2): an ISO
  // date-only string like "2026-02-27" parses as UTC midnight; a local
  // toLocaleDateString west of UTC then renders "February 26". The base
  // dateUtils.formatDate already formats in UTC, so anchoring here as well
  // means the marriage-info paragraph and the grounds paragraph both name
  // the same day.
  try {
    return new Date(ts).toLocaleDateString('en-CA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'UTC',
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
  // Refactor (Sarah AB round-2): pure future-tense operative plea — no
  // "have been separated since" lead-in that reads as though it were
  // asserting the current-tense one-year ground (self-defeating when
  // paired with a "not yet met" draft note). We render EITHER the future-
  // tense plea (below) OR the traditional current-tense assertion
  // (above), never both.
  return {
    text:
      `The spouses will have been living separate and apart for at least one year by ` +
      `${gate.oneYearMarkDate}, within the meaning of ${statuteCite}, by the time the Court ` +
      'considers the granting of a Divorce Order.\n' +
      `(Draft — do not file until ${gate.oneYearMarkDate}; alternative fault grounds are ` +
      'pleadable now: cruelty (Divorce Act s.8(2)(b)(ii)), adultery (Divorce Act ' +
      's.8(2)(b)(i)).)',
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

/**
 * Extract the four-digit year from a value the base date helpers won't
 * accept as renderable ("2011", 2011, "born 2011"). Returns null when no
 * bare-year signal is present. Sarah AB round-2: interview captured
 * "Layla 2011, Zayn 2014" and children DOBs landed as year-only strings;
 * the base formatDate returns null for those, so the AB template used to
 * emit a blank + "insert exact date of birth" note. When the drafter has
 * given the year, we render it as "in <year>" and skip the blank.
 */
function yearOnlyOf(v) {
  if (v == null) return null;
  // Attorney round-3 (2026-08-30): accept a whole child object too, so
  // profiles that carry only `birthYear` (Sarah AB, Marcus ON) render
  // as "born in <year>" instead of an empty blank.
  if (typeof v === 'object') {
    const cand =
      v.birthYear ??
      v.birth_year ??
      v.birthDate ??
      v.dob ??
      v.dateOfBirth;
    if (cand == null) return null;
    return yearOnlyOf(cand);
  }
  const s = String(v).trim();
  if (!s) return null;
  const m = s.match(/(?:^|\D)(19\d{2}|20\d{2})(?:\D|$)/);
  return m ? m[1] : null;
}

/**
 * Whether the profile carries any signal that supports a Federal Child
 * Support Guidelines s.19 income-imputation request. Explicit position
 * text, a self-employment flag, or an income-underreporting flag each
 * count. The Alberta template uses this as the trigger for the s.19
 * factual/relief paragraphs.
 */
function shouldPleadIncomeImputation(d) {
  if (!d || typeof d !== 'object') return false;
  if (incomeImputationPosition(d)) return true;
  const boolish = (v) => v === true || v === 'true' || v === 1 || v === '1';
  return (
    boolish(d.respondentSelfEmployed) ||
    boolish(d.respondent_self_employed) ||
    boolish(d.selfEmployedPayor) ||
    boolish(d.incomeUnderreporting) ||
    boolish(d.income_underreporting) ||
    boolish(d.childSupportImputationRequested) ||
    boolish(d.child_support_imputation_requested)
  );
}

/**
 * Collect free-text factual detail supporting an income-imputation
 * pleading. Any string values found under the known keys are returned;
 * the template renders each as a sworn factual paragraph.
 */
function incomeImputationFacts(d) {
  if (!d || typeof d !== 'object') return [];
  const keys = [
    'incomeUnderreportingDetail',
    'income_underreporting_detail',
    'respondentIncomeDetail',
    'respondent_income_detail',
    'imputationBasis',
    'imputation_basis',
    'payorIncomeVariability',
    'payor_income_variability',
  ];
  const out = [];
  for (const k of keys) {
    const v = d[k];
    if (typeof v === 'string' && v.trim()) out.push(v.trim());
  }
  const pos = incomeImputationPosition(d);
  if (pos && !out.includes(pos)) out.push(pos);
  return out;
}

module.exports = {
  evaluateOneYearSeparation,
  oneYearSeparationPleading,
  custodyDisputePosition,
  incomeImputationPosition,
  shouldPleadIncomeImputation,
  incomeImputationFacts,
  normalizeCanadianDivorceData,
  formatLongDate,
  parseDate,
  yearOnlyOf,
};
