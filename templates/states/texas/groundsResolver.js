// templates/states/texas/groundsResolver.js
//
// Texas divorce grounds resolver.
//
// Bug context (2026-08 replay, Mari acceptance run):
//   Chat extraction correctly captures the ground in `facts[]` as
//   { category: 'grounds', content: 'I seek a divorce ... on the ground of
//   cruelty ...' }, but the structured `divorceData.groundsForDivorce`
//   field is not always populated by the orchestrator. Both the TX
//   petition and the TX decree read the structured field and silently
//   fall back to §6.001 insupportability — a fault-ground petition then
//   emerges as no-fault boilerplate.
//
// The extraction/orchestrator layer is owned by other agents and cannot
// be modified here. This module is a template-side fallback: it prefers
// the structured field when present, and otherwise infers the ground
// from any `category === 'grounds'` fact content the extractor did
// capture. Recognises every statutory Texas ground:
//   - insupportability (§6.001, default)
//   - cruelty          (§6.002)
//   - adultery         (§6.003)
//   - conviction       (§6.004, felony)
//   - abandonment      (§6.005)
//   - living_apart     (§6.006)
//   - confinement      (§6.007, mental hospital)
//
// Shared by DivorcePetitionTemplate and DivorceDecreeTemplate (both
// carry the same read-and-default pattern; fix belongs in one place).

'use strict';

const TX_GROUND_KEYS = new Set([
  'insupportability',
  'irreconcilable_differences',
  'no_fault',
  'cruelty',
  'adultery',
  'conviction',
  'felony',
  'felony_conviction',
  'abandonment',
  'living_apart',
  'confinement',
]);

/**
 * Infer a Texas ground key from free-text fact content. Order matters:
 * more specific / higher-severity grounds first so that a sentence like
 * "cruelty and adultery" resolves to cruelty (the petitioner's primary
 * plea) rather than adultery. Kept intentionally simple — the extractor
 * upstream is LLM-driven; this is only a fallback when the extractor
 * populated `facts[]` but not the structured field.
 *
 * @param {string} text
 * @returns {string|null}
 */
function inferGroundFromText(text) {
  if (typeof text !== 'string' || !text.trim()) return null;
  const lower = text.toLowerCase();

  if (/\bcruel(ty|\s+treatment)?\b/.test(lower)) return 'cruelty';
  if (/\badulter(y|ous)\b/.test(lower))           return 'adultery';
  if (/\b(felony|convict(ed|ion)|imprison(ed|ment)|penitentiary)\b/.test(lower)) return 'conviction';
  if (/\babandon(ed|ment)\b/.test(lower))         return 'abandonment';
  if (/\b(mental\s+hospital|mental\s+institution|confin(ed|ement))\b/.test(lower)) return 'confinement';
  if (/\b(liv(ed|ing)\s+apart|separat(ed|ion)\s+for\s+(at\s+least\s+)?three)/.test(lower)) return 'living_apart';
  if (/\b(insupportab(le|ility)|irreconcilable|no[-\s]?fault|discord\s+or\s+conflict)\b/.test(lower)) {
    return 'insupportability';
  }
  return null;
}

/**
 * Resolve the effective Texas ground for divorce from the divorce data.
 * Reads (in priority order):
 *   1. `divorceData.grounds` — the short alias the editor / save path
 *      writes when the user picks a ground explicitly (v8-B Mari replay:
 *      `content = { ...affidavitData, grounds: 'cruelty' }`). Was ignored
 *      before this fix.
 *   2. `divorceData.groundsForDivorce` — the structured field the
 *      LLM-driven extractor populates when it recognises a canonical
 *      value. Live extractor also emits placeholder values like
 *      "other" that we deliberately don't accept as sworn.
 *   3. facts[] fallback — any fact whose category is 'grounds'/'ground'
 *      OR whose subcategory/sourceQuote mentions a ground keyword. The
 *      Mari replay tagged the cruelty fact as category:'evidence',
 *      subcategory:'cruelty and supporting documentation' — the earlier
 *      category==='grounds' filter missed it and the petition emerged
 *      as no-fault §6.001 boilerplate.
 *   4. inferGroundFromText on the raw structured field ('cruel treatment'
 *      typed verbatim).
 *
 * Ultimately returns 'insupportability' (§6.001 no-fault) as the safe
 * default.
 *
 * @param {Object} divorceData
 * @returns {string} Normalised Texas ground key
 */
function resolveGroundsForDivorce(divorceData) {
  if (!divorceData || typeof divorceData !== 'object') return 'insupportability';

  const rawStructured = typeof divorceData.groundsForDivorce === 'string'
    ? divorceData.groundsForDivorce.trim().toLowerCase()
    : '';
  const rawAlias = typeof divorceData.grounds === 'string'
    ? divorceData.grounds.trim().toLowerCase()
    : '';

  // Try each explicit key in priority order (alias first — the save path
  // writes it as the sworn user pick).
  for (const raw of [rawAlias, rawStructured]) {
    if (raw && TX_GROUND_KEYS.has(raw)) return raw;
  }

  // Look through facts[] for anything the extractor tagged as grounds
  // — or, when the category is broader (e.g. 'evidence'), for ground
  // keywords in the fact's own metadata. Combining content + subcategory
  // + sourceQuote catches the Mari-shape fact whose content is a neutral
  // description ("Ray physically harmed Mari") while subcategory
  // ("cruelty and supporting documentation") carries the ground itself.
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
    // Explicitly-tagged grounds facts always count. Other categories
    // count only when the combined text hits a ground keyword — a
    // residence or financial fact never fires this branch by accident.
    const isGroundsCategory = category === 'grounds' || category === 'ground';
    const inferred = inferGroundFromText(factText);
    if (inferred && (isGroundsCategory || inferred !== 'insupportability')) {
      // Skip 'insupportability' from broad scans — it's the default and
      // would swallow any accidental "irreconcilable" mention in an
      // unrelated fact. An explicit grounds-category fact still wins.
      return inferred;
    }
  }

  // Last resort: try to infer from any structured value even if it
  // wasn't a recognised key (e.g. "cruel treatment" typed verbatim, or
  // "other" — which yields null and drops through).
  for (const raw of [rawAlias, rawStructured]) {
    if (!raw) continue;
    const inferred = inferGroundFromText(raw);
    if (inferred) return inferred;
  }

  return 'insupportability';
}

module.exports = {
  resolveGroundsForDivorce,
  inferGroundFromText,
  TX_GROUND_KEYS,
};
