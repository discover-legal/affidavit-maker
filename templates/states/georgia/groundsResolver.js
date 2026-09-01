// templates/states/georgia/groundsResolver.js
//
// Georgia divorce grounds resolver — mirrors the TX/Utah/NY pattern.
//
// Bug context (2026-08 Amara acceptance replay):
//   The chat clearly narrated documented cruel treatment ("Ray's cruel
//   treatment", "documented cruelty"), but the extractor never promoted
//   the structured `divorceData.groundsForDivorce` field — `profile.grounds`
//   came back null. The Georgia petition template read the raw structured
//   field and, when unset, fell through its `switch` `default` to the
//   no-fault §19-5-3(13) "irretrievably broken" clause. A fault-based
//   cruelty petition then emerged as no-fault boilerplate.
//
// Fix pattern (identical to TX/Utah/NY):
//   1. Read the alias `divorceData.grounds` (short pick the editor writes).
//   2. Read the structured `divorceData.groundsForDivorce` field.
//   3. Fall back to any `facts[]` entry tagged as grounds — or whose
//      combined content/subcategory/sourceQuote text matches a GA
//      ground keyword.
//   4. Last resort: infer from the raw structured value even when it's
//      not a recognised key ("cruel treatment" typed verbatim).
//   5. Default to "irretrievably_broken" (O.C.G.A. §19-5-3(13) no-fault).
//
// Georgia statutory grounds under O.C.G.A. §19-5-3:
//   (1)  intermarriage among prohibited degrees of kinship
//   (2)  mental incapacity at time of marriage
//   (3)  impotency at time of marriage
//   (4)  force, menace, duress, or fraud in obtaining the marriage
//   (5)  pregnancy of wife by another at time of marriage, unknown to
//        husband
//   (6)  adultery
//   (7)  wilful and continued desertion for one year
//   (8)  conviction of an offense involving moral turpitude with
//        sentence of two years or longer
//   (9)  habitual intoxication
//   (10) cruel treatment
//   (11) incurable mental illness (two physicians)
//   (12) habitual drug addiction
//   (13) irretrievably broken (no-fault; the default)

'use strict';

const GA_GROUND_KEYS = new Set([
  'intermarriage_prohibited_kinship',
  'prohibited_kinship',
  'mental_incapacity_at_marriage',
  'mental_incapacity',
  'impotency',
  'force_menace_duress_fraud',
  'fraud_duress',
  'pregnancy_by_another',
  'adultery',
  'wilful_desertion',
  'desertion',
  'abandonment',
  'conviction_of_crime',
  'conviction',
  'felony',
  'felony_conviction',
  'moral_turpitude',
  'habitual_intoxication',
  'habitual_drunkenness',
  'cruel_treatment',
  'cruelty',
  'incurable_mental_illness',
  'incurable_insanity',
  'habitual_drug_use',
  'habitual_drug_addiction',
  'drug_addiction',
  'irretrievably_broken',
  'irreconcilable_differences',
  'no_fault',
  'breakdown_of_marriage',
  'irretrievable_breakdown',
]);

// Canonicalise aliases to the key the Georgia petition getGroundsText
// switch dispatches on, so the resolver's output drops straight in.
const CANONICAL = {
  cruelty: 'cruel_treatment',
  abandonment: 'wilful_desertion',
  desertion: 'wilful_desertion',
  felony: 'conviction_of_crime',
  felony_conviction: 'conviction_of_crime',
  conviction: 'conviction_of_crime',
  moral_turpitude: 'conviction_of_crime',
  habitual_drunkenness: 'habitual_intoxication',
  drug_addiction: 'habitual_drug_use',
  habitual_drug_addiction: 'habitual_drug_use',
  incurable_insanity: 'incurable_mental_illness',
  mental_incapacity: 'mental_incapacity_at_marriage',
  prohibited_kinship: 'intermarriage_prohibited_kinship',
  fraud_duress: 'force_menace_duress_fraud',
  no_fault: 'irretrievably_broken',
  irreconcilable_differences: 'irretrievably_broken',
  breakdown_of_marriage: 'irretrievably_broken',
  irretrievable_breakdown: 'irretrievably_broken',
};

function canonicalise(key) {
  return CANONICAL[key] || key;
}

/**
 * Infer a Georgia ground key from free-text fact content. Order matters:
 * more specific / higher-severity grounds first so "cruel treatment and
 * adultery" resolves to cruel_treatment (the plaintiff's primary plea).
 *
 * @param {string} text
 * @returns {string|null}
 */
function inferGroundFromText(text) {
  if (typeof text !== 'string' || !text.trim()) return null;
  const lower = text.toLowerCase();

  if (/\bcruel(ty|\s+treatment)?\b/.test(lower)) return 'cruel_treatment';
  if (/\badulter(y|ous)\b/.test(lower)) return 'adultery';
  if (/\b(felony|convict(ed|ion)|moral\s+turpitude|imprison(ed|ment)|penitentiary)\b/.test(lower)) return 'conviction_of_crime';
  if (/\b(desert(ed|ion)|abandon(ed|ment))\b/.test(lower)) return 'wilful_desertion';
  if (/\b(habitual(ly)?\s+drunk\w*|alcoholi(c|sm)|habitual\s+intoxication)\b/.test(lower)) return 'habitual_intoxication';
  if (/\b(habitual\s+drug|drug\s+addict(ion|ed)?|controlled\s+substance)\b/.test(lower)) return 'habitual_drug_use';
  if (/\bimpoten(cy|t)\b/.test(lower)) return 'impotency';
  if (/\b(mental(ly)?\s+incapacit(y|ated))\b/.test(lower)) return 'mental_incapacity_at_marriage';
  if (/\b(incurabl[ey]\s+(mental\s+illness|insan(ity|e))|adjudged\s+insane)\b/.test(lower)) return 'incurable_mental_illness';
  if (/\b(pregnan(t|cy)\s+(of\s+the\s+wife\s+)?by\s+another|pregnant\s+by\s+another\s+man)\b/.test(lower)) return 'pregnancy_by_another';
  if (/\b(force|menace|duress|fraud)\b.*\bmarriage\b|\bmarriage\b.*\b(force|menace|duress|fraud)\b/.test(lower)) return 'force_menace_duress_fraud';
  if (/\b(prohibited\s+(degrees\s+of\s+)?kinship|consanguinity|incest(uous)?)\b/.test(lower)) return 'intermarriage_prohibited_kinship';
  if (/\b(irretrievabl[ey]\s+broken|irreconcilable|no[-\s]?fault|breakdown\s+of\s+(the\s+)?marriage)\b/.test(lower)) return 'irretrievably_broken';

  return null;
}

/**
 * Resolve the effective Georgia ground for divorce from the divorce data.
 * Returns a canonical key that GeorgiaDivorcePetitionTemplate.getGroundsText
 * can dispatch on directly.
 *
 * @param {Object} divorceData
 * @returns {string} Canonical Georgia ground key
 */
function resolveGroundsForDivorce(divorceData) {
  if (!divorceData || typeof divorceData !== 'object') return 'irretrievably_broken';

  const rawStructured = typeof divorceData.groundsForDivorce === 'string'
    ? divorceData.groundsForDivorce.trim().toLowerCase()
    : '';
  const rawAlias = typeof divorceData.grounds === 'string'
    ? divorceData.grounds.trim().toLowerCase()
    : '';

  for (const raw of [rawAlias, rawStructured]) {
    if (raw && GA_GROUND_KEYS.has(raw)) return canonicalise(raw);
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
    // Skip the no-fault default from broad scans — an incidental
    // "irreconcilable" mention in an unrelated fact must not shadow a
    // fault plea. Explicit grounds-category facts still win.
    if (inferred && (isGroundsCategory || inferred !== 'irretrievably_broken')) {
      return canonicalise(inferred);
    }
  }

  for (const raw of [rawAlias, rawStructured]) {
    if (!raw) continue;
    const inferred = inferGroundFromText(raw);
    if (inferred) return canonicalise(inferred);
  }

  return 'irretrievably_broken';
}

module.exports = {
  resolveGroundsForDivorce,
  inferGroundFromText,
  canonicalise,
  GA_GROUND_KEYS,
};
