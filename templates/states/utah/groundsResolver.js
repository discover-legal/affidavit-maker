// templates/states/utah/groundsResolver.js
//
// Utah divorce grounds resolver — v9-A follow-up (2026-08).
//
// Bug context:
//   `templates/states/utah/DivorceDecreeTemplate.js` hardcoded
//   "irreconcilable differences" in both the FINDINGS OF FACT
//   (generateJurisdictionSection) and the DECREE OF DIVORCE
//   (generateDissolutionSection) clauses. When the interviewee actually
//   pled a fault ground — adultery, cruel treatment, felony conviction,
//   desertion — the decree still emerged as a no-fault decree, which is
//   incorrect on its face and could invalidate the fault-based relief.
//
// Fix mirrors the Texas pattern (templates/states/texas/groundsResolver.js):
//   1. Read the structured field the extractor / editor writes
//      (`grounds` alias first, then `groundsForDivorce`).
//   2. Fall back to facts[] with category === 'grounds' / 'ground', OR
//      any category whose combined content/subcategory/sourceQuote
//      matches a Utah ground keyword.
//   3. Fall back to inferring from the raw structured value.
//   4. Default to Utah's most common statutory ground — irreconcilable
//      differences (Utah Code § 81-4-405, formerly § 30-3-1(3)(h)).
//
// The default is not a hardcode: it's the resolver's last-resort choice
// when nothing else identifies a ground, and it reflects the extractor's
// silence rather than the decree's authorship.
//
// Utah Code § 81-4-405 (formerly § 30-3-1(3)) grounds recognised:
//   - impotency               (§ 30-3-1(3)(a))
//   - adultery                (§ 30-3-1(3)(b))
//   - desertion               (§ 30-3-1(3)(c), willful, > 1 year)
//   - neglect                 (§ 30-3-1(3)(d), common necessaries)
//   - habitual_drunkenness    (§ 30-3-1(3)(e))
//   - conviction              (§ 30-3-1(3)(f), felony)
//   - cruel_treatment         (§ 30-3-1(3)(g))
//   - irreconcilable_differences (§ 30-3-1(3)(h), default)
//   - incurable_insanity      (§ 30-3-1(3)(i))
//   - living_apart            (§ 30-3-1(2), 3 yrs under decree of
//                              separate maintenance)

'use strict';

const UT_GROUND_KEYS = new Set([
  'irreconcilable_differences',
  'no_fault',
  'impotency',
  'adultery',
  'desertion',
  'abandonment',
  'neglect',
  'habitual_drunkenness',
  'conviction',
  'felony',
  'felony_conviction',
  'cruel_treatment',
  'cruelty',
  'incurable_insanity',
  'living_apart',
]);

// Canonicalise aliases to the key the Utah petition/decree switch uses.
// Keeps the decree in step with UtahDivorcePetitionTemplate.getGroundsText
// (irreconcilable_differences / cruel_treatment / conviction).
const CANONICAL = {
  no_fault: 'irreconcilable_differences',
  cruelty: 'cruel_treatment',
  abandonment: 'desertion',
  felony: 'conviction',
  felony_conviction: 'conviction',
};

function canonicalise(key) {
  return CANONICAL[key] || key;
}

/**
 * Infer a Utah ground key from free-text fact content. Order matters:
 * more specific / higher-severity grounds first so a sentence combining
 * ("adultery and cruelty") resolves to the more actionable ground the
 * petitioner is likely pleading. Kept intentionally simple — this is
 * only a fallback when the extractor never wrote a structured field.
 *
 * @param {string} text
 * @returns {string|null}
 */
function inferGroundFromText(text) {
  if (typeof text !== 'string' || !text.trim()) return null;
  const lower = text.toLowerCase();

  if (/\bcruel(ty|\s+treatment)?\b/.test(lower)) return 'cruel_treatment';
  if (/\badulter(y|ous)\b/.test(lower)) return 'adultery';
  if (/\b(felony|convict(ed|ion)|imprison(ed|ment)|penitentiary)\b/.test(lower)) return 'conviction';
  if (/\b(desert(ed|ion)|abandon(ed|ment))\b/.test(lower)) return 'desertion';
  if (/\b(habitual(ly)?\s+drunk\w*|alcoholi(c|sm)|habitual\s+intoxication)\b/.test(lower)) return 'habitual_drunkenness';
  if (/\b(neglect(ed|ing)?\s+(to\s+provide|the\s+common\s+necessaries)|failed\s+to\s+provide\s+(the\s+)?common\s+necessaries)\b/.test(lower)) return 'neglect';
  if (/\bimpoten(cy|t)\b/.test(lower)) return 'impotency';
  if (/\b(incurabl[ey]\s+insan(ity|e)|adjudged\s+insane)\b/.test(lower)) return 'incurable_insanity';
  if (/\b(liv(ed|ing)\s+(separate\s+and\s+)?apart|separate\s+maintenance).*(three|3)\s+(consecutive\s+)?years?\b/.test(lower)) return 'living_apart';
  if (/\b(irreconcilable|no[-\s]?fault|irretrievabl(e|y)\s+broken)\b/.test(lower)) return 'irreconcilable_differences';

  return null;
}

/**
 * Resolve the effective Utah ground for divorce from the divorce data.
 * See file-level comment for the priority chain. Returns a canonical
 * key that both UtahDivorcePetitionTemplate.getGroundsText and the
 * Utah decree template can dispatch on.
 *
 * @param {Object} divorceData
 * @returns {string} Canonical Utah ground key
 */
function resolveGroundsForDivorce(divorceData) {
  if (!divorceData || typeof divorceData !== 'object') return 'irreconcilable_differences';

  const rawStructured = typeof divorceData.groundsForDivorce === 'string'
    ? divorceData.groundsForDivorce.trim().toLowerCase()
    : '';
  const rawAlias = typeof divorceData.grounds === 'string'
    ? divorceData.grounds.trim().toLowerCase()
    : '';

  for (const raw of [rawAlias, rawStructured]) {
    if (raw && UT_GROUND_KEYS.has(raw)) return canonicalise(raw);
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
    // Skip 'irreconcilable_differences' from broad scans — it's the
    // default and would swallow any casual "irreconcilable" mention in
    // an unrelated fact. Explicit grounds-category facts still win.
    if (inferred && (isGroundsCategory || inferred !== 'irreconcilable_differences')) {
      return canonicalise(inferred);
    }
  }

  for (const raw of [rawAlias, rawStructured]) {
    if (!raw) continue;
    const inferred = inferGroundFromText(raw);
    if (inferred) return canonicalise(inferred);
  }

  return 'irreconcilable_differences';
}

/**
 * Human-readable ground clause for the Utah decree (short-form, drops
 * neatly into "...divorced ... on the grounds of X."). Kept in this
 * module so the decree template stays presentation-only.
 *
 * @param {string} groundKey - canonical key from resolveGroundsForDivorce
 * @returns {string}
 */
function decreeGroundPhrase(groundKey) {
  switch (canonicalise(groundKey)) {
    case 'adultery':               return 'adultery (Utah Code § 30-3-1(3)(b))';
    case 'desertion':              return 'willful desertion (Utah Code § 30-3-1(3)(c))';
    case 'neglect':                return 'willful neglect to provide the common necessaries of life (Utah Code § 30-3-1(3)(d))';
    case 'habitual_drunkenness':   return 'habitual drunkenness (Utah Code § 30-3-1(3)(e))';
    case 'conviction':             return 'conviction of a felony (Utah Code § 30-3-1(3)(f))';
    case 'cruel_treatment':        return 'cruel treatment (Utah Code § 30-3-1(3)(g))';
    case 'incurable_insanity':     return 'incurable insanity (Utah Code § 30-3-1(3)(i))';
    case 'living_apart':           return 'living separate and apart under a decree of separate maintenance for three consecutive years (Utah Code § 30-3-1(2))';
    case 'impotency':              return 'impotency at the time of marriage (Utah Code § 30-3-1(3)(a))';
    case 'irreconcilable_differences':
    default:                       return 'irreconcilable differences (Utah Code § 30-3-1(3)(h))';
  }
}

/**
 * Findings-of-fact clause for the Utah decree (long-form, used in the
 * JURISDICTION / FINDINGS section that also carries the marriage date).
 *
 * @param {string} groundKey
 * @returns {string}
 */
function findingGroundClause(groundKey) {
  switch (canonicalise(groundKey)) {
    case 'adultery':
      return 'Respondent committed adultery, constituting grounds for divorce under Utah Code § 30-3-1(3)(b).';
    case 'desertion':
      return 'Respondent willfully deserted Petitioner for more than one year, constituting grounds for divorce under Utah Code § 30-3-1(3)(c).';
    case 'neglect':
      return 'Respondent willfully neglected to provide Petitioner with the common necessaries of life, constituting grounds for divorce under Utah Code § 30-3-1(3)(d).';
    case 'habitual_drunkenness':
      return 'Respondent is a habitual drunkard, constituting grounds for divorce under Utah Code § 30-3-1(3)(e).';
    case 'conviction':
      return 'Respondent has been convicted of a felony, constituting grounds for divorce under Utah Code § 30-3-1(3)(f).';
    case 'cruel_treatment':
      return 'Respondent treated Petitioner with cruel treatment causing bodily injury or great mental distress, constituting grounds for divorce under Utah Code § 30-3-1(3)(g).';
    case 'incurable_insanity':
      return 'Respondent has been adjudged incurably insane as provided by law, constituting grounds for divorce under Utah Code § 30-3-1(3)(i).';
    case 'living_apart':
      return 'The parties have lived separate and apart under a decree of separate maintenance for three consecutive years without cohabitation, constituting grounds for divorce under Utah Code § 30-3-1(2).';
    case 'impotency':
      return 'Respondent was impotent at the time of marriage, constituting grounds for divorce under Utah Code § 30-3-1(3)(a).';
    case 'irreconcilable_differences':
    default:
      return 'The parties have irreconcilable differences which have caused the irremediable breakdown of the marriage, constituting grounds for divorce under Utah Code § 30-3-1(3)(h).';
  }
}

module.exports = {
  resolveGroundsForDivorce,
  inferGroundFromText,
  decreeGroundPhrase,
  findingGroundClause,
  UT_GROUND_KEYS,
};
