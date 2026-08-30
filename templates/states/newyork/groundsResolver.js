// templates/states/newyork/groundsResolver.js
//
// New York divorce grounds resolver.
//
// Mirrors templates/states/texas/groundsResolver.js. Bug context (2026-08
// coverage sweep): the NY petition and decree both read
// `divorceData.groundsForDivorce` straight and silently fall back to the
// no-fault "irretrievable breakdown" clause when the extractor tagged the
// ground only in facts[]. Every DRL §170 sub-ground therefore emerges as
// no-fault boilerplate — a fault-based petition then loses the pinpoint
// citation the pleading actually needs.
//
// This module is a template-side fallback: it prefers the structured
// field when present, otherwise infers the ground from any
// `category === 'grounds'` fact content the extractor did capture (or a
// non-grounds fact whose subcategory/sourceQuote name a ground keyword).
// The canonical NY slugs and their DRL §170 pins are:
//   - cruel_treatment       (DRL §170(1))
//   - abandonment           (DRL §170(2))
//   - imprisonment          (DRL §170(3))
//   - adultery              (DRL §170(4))
//   - separation_judgment   (DRL §170(5))
//   - separation_agreement  (DRL §170(6))
//   - irretrievable_breakdown (DRL §170(7)) — default no-fault
//
// Shared by NewYorkDivorcePetitionTemplate and NewYorkDivorceDecreeTemplate.

'use strict';

const NY_GROUND_KEYS = new Set([
  'irretrievable_breakdown',
  'irreconcilable_differences',
  'no_fault',
  'cruel_treatment',
  'cruel_inhuman_treatment',
  'cruelty',
  'abandonment',
  'imprisonment',
  'confinement',
  'adultery',
  'separation_agreement',
  'separation_judgment',
]);

// Slugs the extractor may emit that mean the same thing under NY law.
const NY_ALIAS_MAP = {
  cruelty: 'cruel_treatment',
  cruel_inhuman_treatment: 'cruel_treatment',
  confinement: 'imprisonment',
  no_fault: 'irretrievable_breakdown',
  irreconcilable_differences: 'irretrievable_breakdown',
  breakdown_of_marriage: 'irretrievable_breakdown',
};

function canonicalize(slug) {
  if (!slug) return null;
  const s = String(slug).trim().toLowerCase();
  if (NY_ALIAS_MAP[s]) return NY_ALIAS_MAP[s];
  return NY_GROUND_KEYS.has(s) ? s : null;
}

/**
 * Infer an NY ground from free-text fact content. Order matters:
 * higher-severity / more specific grounds first. "Separation agreement"
 * beats a bare "living apart" mention; "irretrievable breakdown" is the
 * last resort no-fault match.
 *
 * @param {string} text
 * @returns {string|null}
 */
function inferGroundFromText(text) {
  if (typeof text !== 'string' || !text.trim()) return null;
  const lower = text.toLowerCase();

  if (/\bcruel(ty|\s+(and\s+)?(inhuman\s+)?treatment)?\b/.test(lower)) return 'cruel_treatment';
  if (/\badulter(y|ous)\b/.test(lower))                                 return 'adultery';
  if (/\b(imprison(ed|ment)|incarcerated|prison\s+for|penitentiary|confined\s+in\s+prison)\b/.test(lower)) return 'imprisonment';
  if (/\babandon(ed|ment)\b/.test(lower))                               return 'abandonment';
  if (/\b(separation\s+agreement|written\s+agreement\s+of\s+separation|lived\s+separate\s+and\s+apart\s+pursuant\s+to\s+(a\s+)?(written\s+)?agreement)\b/.test(lower)) {
    return 'separation_agreement';
  }
  if (/\b(judgment\s+of\s+separation|decree\s+of\s+separation|separation\s+decree|separation\s+judgment|lived\s+apart\s+pursuant\s+to\s+(a\s+)?(judgment|decree))\b/.test(lower)) {
    return 'separation_judgment';
  }
  if (/\b(irretrievabl[ey]\s+broken|irretrievable\s+breakdown|broken\s+down\s+irretrievabl[ey]|no[-\s]?fault|irreconcilable|drl\s*§?\s*170\s*\(?\s*7\s*\)?)\b/.test(lower)) {
    return 'irretrievable_breakdown';
  }
  return null;
}

/**
 * Resolve the effective NY ground for divorce from the divorce data.
 * Reads (in priority order):
 *   1. `divorceData.grounds` — the short alias the editor / save path
 *      writes when the user picks a ground explicitly.
 *   2. `divorceData.groundsForDivorce` — the structured field the
 *      LLM-driven extractor populates.
 *   3. facts[] with `category === 'grounds' | 'ground'` — the extractor's
 *      typed capture.
 *   4. any fact's combined text (content + subcategory + sourceQuote)
 *      that hits a NON-default ground keyword (default no-fault would
 *      otherwise swallow accidental "irreconcilable" mentions).
 *   5. inferGroundFromText on the raw structured field ("cruel treatment"
 *      typed verbatim).
 *
 * Ultimately returns 'irretrievable_breakdown' (DRL §170(7) no-fault) as
 * the safe default.
 *
 * @param {Object} divorceData
 * @returns {string} Canonical NY ground key
 */
function resolveGroundsForDivorce(divorceData) {
  if (!divorceData || typeof divorceData !== 'object') return 'irretrievable_breakdown';

  const rawStructured = typeof divorceData.groundsForDivorce === 'string'
    ? divorceData.groundsForDivorce.trim().toLowerCase()
    : '';
  const rawAlias = typeof divorceData.grounds === 'string'
    ? divorceData.grounds.trim().toLowerCase()
    : '';

  for (const raw of [rawAlias, rawStructured]) {
    const canonical = canonicalize(raw);
    if (canonical) return canonical;
  }

  const facts = Array.isArray(divorceData.facts) ? divorceData.facts : [];
  for (const fact of facts) {
    if (!fact || typeof fact !== 'object') continue;
    const category = typeof fact.category === 'string' ? fact.category.toLowerCase() : '';
    const factText = [
      fact.content || fact.text || fact.value || '',
      fact.subcategory || '',
      fact.sourceQuote || '',
    ]
      .filter((s) => typeof s === 'string' && s.trim())
      .join(' ');
    if (!factText.trim()) continue;
    const isGroundsCategory = category === 'grounds' || category === 'ground';
    const inferred = inferGroundFromText(factText);
    if (inferred && (isGroundsCategory || inferred !== 'irretrievable_breakdown')) {
      return inferred;
    }
  }

  for (const raw of [rawAlias, rawStructured]) {
    if (!raw) continue;
    const inferred = inferGroundFromText(raw);
    if (inferred) return inferred;
  }

  return 'irretrievable_breakdown';
}

module.exports = {
  resolveGroundsForDivorce,
  inferGroundFromText,
  NY_GROUND_KEYS,
  NY_ALIAS_MAP,
};
