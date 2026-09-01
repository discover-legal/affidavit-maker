// templates/core/parenting.js
// Custody/parenting enum normalization shared by the divorce petition and
// decree base classes (and their jurisdiction subclasses).
//
// The interview orchestrators store machine-reliable enums on the case data:
//   custodyType: 'joint' | 'sole_petitioner' | 'sole_respondent' | 'shared'
//              | 'split' | 'contested' | 'undecided'
//   primaryResidence / primaryCustodian: who the children primarily live with
//
// Older saved documents carry free-text values ("joint decision making",
// "sole custody to mother", …). The safety rule that motivates this module:
// NEVER let an unrecognized value fall through to a sole-custody order — a
// wrong-but-plausible order is worse than neutral as-agreed language. So the
// normalizer only maps values it can positively recognize, and everything
// else becomes 'unspecified', which templates render as a neutral parenting
// order with an explicit placeholder plus a validation warning.

'use strict';

/**
 * Normalize the stored custody arrangement.
 *
 * @param {Object} divorceData - The saved case data
 * @returns {{kind: 'joint'|'sole_petitioner'|'sole_respondent'|'legacy_sole'|'unspecified',
 *            raw: string|null, explicit: boolean}}
 *   kind        - safe rendering branch
 *   raw         - the stored value (null when absent)
 *   explicit    - false when custodyType was absent and 'joint' is only the
 *                 historical default (petitions must not plead a defaulted
 *                 arrangement as if the parties chose it)
 */
function resolveCustodyArrangement(divorceData) {
  const raw = divorceData && divorceData.custodyType != null && String(divorceData.custodyType).trim() !== ''
    ? String(divorceData.custodyType).trim()
    : null;

  if (raw === null) {
    // Historical default: templates always rendered the joint branch when no
    // custody type was stored. Preserved for byte-identity of old US output.
    return { kind: 'joint', raw: null, explicit: false };
  }

  const value = raw.toLowerCase();

  // Machine enums (exact).
  if (value === 'joint' || value === 'shared') {
    return { kind: 'joint', raw, explicit: true };
  }
  if (value === 'sole_petitioner') {
    return { kind: 'sole_petitioner', raw, explicit: true };
  }
  if (value === 'sole_respondent') {
    return { kind: 'sole_respondent', raw, explicit: true };
  }
  if (value === 'split' || value === 'contested' || value === 'undecided') {
    return { kind: 'unspecified', raw, explicit: true };
  }

  // Legacy exact 'sole': the old else-branch was the deliberate rendering for
  // this stored value (sole to primaryCustodian, falling back to the filer).
  if (value === 'sole') {
    return { kind: 'legacy_sole', raw, explicit: true };
  }

  // Legacy free text that positively indicates a shared arrangement
  // ("joint decision making", "shared parenting", "joint custody", …).
  if (/\b(joint|shared)\b/.test(value)) {
    return { kind: 'joint', raw, explicit: true };
  }

  // Anything else ("sole custody to mother", junk, …) is ambiguous — render
  // neutral, never a sole order.
  return { kind: 'unspecified', raw, explicit: true };
}

/** Normalize a name for comparison: trim, collapse whitespace, lowercase. */
function normalizeName(value) {
  return String(value == null ? '' : value).trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * Map a stored who-the-children-live-with value onto a caption party.
 *
 * Extraction sometimes stores the user's *preferred* name ("Katie
 * O'Brien-Hatch") in primaryResidence/primaryCustodian while the caption
 * carries the full legal name ("Kathleen O'Brien-Hatch"). Order paragraphs
 * must use the caption name, so this matcher resolves a stored value to a
 * party role by, in order:
 *   1. role tokens ('petitioner' / 'applicant' / 'filer' / 'respondent');
 *   2. exact (case/whitespace-insensitive) match with a caption name;
 *   3. unique surname match — the value's last name token equals exactly
 *      one party's last name token (both parties sharing a surname is
 *      ambiguous and resolves to null).
 * Anything else is null: never guess a party from an ambiguous value.
 *
 * @param {string} value - The stored residence/custodian value
 * @param {Object} divorceData - The saved case data (caption names)
 * @returns {'petitioner'|'respondent'|null}
 */
function matchPartyRole(value, divorceData) {
  const v = normalizeName(value);
  if (!v) return null;

  if (v === 'petitioner' || v === 'applicant' || v === 'filer') return 'petitioner';
  if (v === 'respondent') return 'respondent';

  const petitioner = normalizeName(divorceData && divorceData.petitionerName);
  const respondent = normalizeName(divorceData && divorceData.respondentName);

  if (petitioner && v === petitioner) return 'petitioner';
  if (respondent && v === respondent) return 'respondent';

  const surname = (s) => {
    const parts = s.split(' ');
    return parts.length > 1 ? parts[parts.length - 1] : null;
  };
  const vSurname = surname(v);
  if (vSurname) {
    const matchesPetitioner = Boolean(petitioner) && surname(petitioner) === vSurname;
    const matchesRespondent = Boolean(respondent) && surname(respondent) === vSurname;
    if (matchesPetitioner && !matchesRespondent) return 'petitioner';
    if (matchesRespondent && !matchesPetitioner) return 'respondent';
  }
  return null;
}

/**
 * Which caption party the children primarily reside with, from
 * primaryResidence / primaryCustodian (see matchPartyRole).
 *
 * @param {Object} divorceData - The saved case data
 * @returns {'petitioner'|'respondent'|null} null when unknown/ambiguous
 */
function resolveResidenceRole(divorceData) {
  const raw = (divorceData && (divorceData.primaryResidence || divorceData.primaryCustodian)) || null;
  if (raw == null) return null;
  return matchPartyRole(raw, divorceData);
}

/**
 * Resolve the name of the person the children primarily reside with, from
 * primaryResidence / primaryCustodian. Accepts either a party name or a
 * party-role token ('petitioner' / 'applicant' / 'respondent'). When the
 * stored value matches a caption party (exactly or by unique surname — a
 * stored go-by like "Katie O'Brien-Hatch"), the caption's full legal name
 * is returned so order paragraphs stay consistent.
 *
 * @param {Object} divorceData - The saved case data
 * @returns {string|null} A display name, or null when no residence data exists
 */
function resolvePrimaryResidenceName(divorceData) {
  // Round-6 (Marcus ON, 2026-08-30 v29): a primary_residence FACT that
  // names one caption party takes precedence over the structured
  // primaryResidence/primaryCustodian slot — extraction has been observed
  // to land the wrong name in the structured slot (Marcus ON profile
  // stored `primaryCustodian: "Marcus Thompson"` while the extracted fact
  // read "Our children, Ava and Ethan, live primarily with Priya
  // Thompson"). Facts carry the interviewee's own words; the structured
  // slot is a downstream inference. When they conflict, believe the fact.
  const factName = _residenceFromFacts(divorceData);
  if (factName) return factName;

  const raw = (divorceData && (divorceData.primaryResidence || divorceData.primaryCustodian)) || null;
  if (raw == null) return null;
  const value = String(raw).trim();
  if (!value) return null;

  const role = matchPartyRole(value, divorceData);
  if (role === 'petitioner') {
    return (divorceData.petitionerName && String(divorceData.petitionerName).trim()) || null;
  }
  if (role === 'respondent') {
    return (divorceData.respondentName && String(divorceData.respondentName).trim()) || null;
  }
  // Role tokens that failed to resolve must not leak as literal text.
  const token = value.toLowerCase();
  if (token === 'petitioner' || token === 'applicant' || token === 'filer' || token === 'respondent') {
    return null;
  }
  return value;
}

/**
 * Name of the parent who does NOT have the children's primary residence —
 * the parent a parent-time / visitation order belongs to. Derived from the
 * residence role (the OTHER party gets parent-time), falling back to an
 * explicit sole-custody enum. Returns null when the data does not say who
 * the children live with — callers must render neutral wording, never
 * guess a name.
 *
 * @param {Object} divorceData - The saved case data
 * @returns {string|null}
 */
function resolveNonResidentialParentName(divorceData) {
  const partyName = (key) =>
    (divorceData && divorceData[key] && String(divorceData[key]).trim()) || null;

  const role = resolveResidenceRole(divorceData);
  if (role === 'petitioner') return partyName('respondentName');
  if (role === 'respondent') return partyName('petitionerName');

  const custody = resolveCustodyArrangement(divorceData);
  if (custody.kind === 'sole_petitioner') return partyName('respondentName');
  if (custody.kind === 'sole_respondent') return partyName('petitionerName');
  return null;
}

/**
 * Scan facts[] for a `primary_residence` (or synonymous) fact whose content
 * names a caption party via "live/lives/reside primarily with <name>" or
 * "primarily with <name>". Returns the caption party's canonical name, or
 * null when nothing definitive was found. Deliberately narrow: a fact that
 * does not name a caption party unambiguously is ignored.
 */
function _residenceFromFacts(divorceData) {
  if (!divorceData) return null;
  const facts = Array.isArray(divorceData.facts) ? divorceData.facts : [];
  if (facts.length === 0) return null;
  // Case-sensitive intentionally: the `/i` flag makes [A-Z] match a-z too,
  // which swallows following words like " in Toronto" into the party-name
  // capture. Use two alternations for the verb so the pattern still matches
  // "Live/Resides" at sentence start.
  const primaryPattern =
    /(?:[Ll]ive[s]?|[Rr]esid(?:e|es|ing))\s+(?:primarily|mostly|mainly|principally|chiefly|almost\s+entirely)\s+with\s+([A-Z][A-Za-zÀ-ſ.'’-]+(?:[\s-][A-Z][A-Za-zÀ-ſ.'’-]+){0,3})/;
  for (const fact of facts) {
    if (!fact || typeof fact !== 'object') continue;
    const sub = String(fact.subcategory || '').toLowerCase();
    const content = String(fact.content || fact.text || fact.value || '');
    if (!content) continue;
    // Broad match: any parenting-related fact whose text names a primary
    // residence party. Not only subcategory === 'primary_residence' —
    // extraction sometimes files the same information under 'children' or
    // 'parenting'.
    const parentingSub = /(primary_residence|primary_custod|parenting|children|custody)/.test(sub);
    if (!parentingSub && !primaryPattern.test(content)) continue;
    const m = content.match(primaryPattern);
    if (!m) continue;
    const name = m[1].trim();
    const role = matchPartyRole(name, divorceData);
    if (role === 'petitioner') {
      return (divorceData.petitionerName && String(divorceData.petitionerName).trim()) || null;
    }
    if (role === 'respondent') {
      return (divorceData.respondentName && String(divorceData.respondentName).trim()) || null;
    }
  }
  return null;
}

module.exports = {
  resolveCustodyArrangement,
  resolvePrimaryResidenceName,
  resolveResidenceRole,
  resolveNonResidentialParentName,
  matchPartyRole,
};
