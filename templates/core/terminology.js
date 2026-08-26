// templates/core/terminology.js
// Jurisdiction-aware caption/body terminology for the document base classes.
//
// DEFAULT_TERMS reproduces the historical US wording byte-for-byte, so every
// US template renders identically unless a jurisdiction opts in. A template
// opts in from its constructor by merging overrides:
//
//   this.terminology = {
//     ...this.terminology,
//     jurisdictionLabel: null,          // suppress the "STATE OF X" header line
//     jurisdictionTerm: 'Province',     // "the Province of X" / "this province"
//     districtLabel: null,              // suppress the "COUNTY OF Y" venue line
//     districtTerm: 'Judicial district',// noun used in messages/prefix phrases
//     districtStyle: 'plain',           // how body text names the district
//     districtPlaceholder: '[JUDICIAL DISTRICT]',
//     filerLabel: 'Applicant',
//     responderLabel: 'Respondent',
//     selfRepresentedLabel: 'Self-Represented',
//   };
//
// districtStyle:
//   'suffix' → "Toronto County"           (US default)
//   'prefix' → "the Judicial District of Toronto"
//   'plain'  → "Toronto"
//
// jurisdictionLabel / districtLabel set to null omit the corresponding
// header/venue line entirely (correct for jurisdictions whose caption is the
// court-name line + registry/court-location, e.g. Canadian provinces).

'use strict';

const DEFAULT_TERMS = Object.freeze({
  jurisdictionLabel: 'STATE OF',
  jurisdictionTerm: 'State',
  districtLabel: 'COUNTY OF',
  districtTerm: 'County',
  districtStyle: 'suffix',
  districtPlaceholder: '[COUNTY]',
  filerLabel: 'Petitioner',
  responderLabel: 'Respondent',
  selfRepresentedLabel: 'Pro Se',
});

/**
 * Compose the phrase body text uses to name the sub-jurisdiction
 * ("Toronto County" / "the Judicial District of Montreal" / "Vancouver").
 * @param {Object} terms - a terminology object (DEFAULT_TERMS shape)
 * @param {string} name - district name; falls back to terms.districtPlaceholder
 * @returns {string}
 */
function districtPhrase(terms, name) {
  const t = terms || DEFAULT_TERMS;
  const n = (name && String(name).trim()) || t.districtPlaceholder;
  if (t.districtStyle === 'plain') return n;
  if (t.districtStyle === 'prefix') return `the ${t.districtTerm} of ${n}`;
  return `${n} ${t.districtTerm}`;
}

// ── Canadian jurisdictions, for renderers that only receive a state string ──
// Keyed by 2-letter code; `names` carries lowercase full-name aliases.
const CANADIAN_JURISDICTIONS = Object.freeze({
  ON: { name: 'Ontario', territory: false, names: ['ontario'] },
  BC: { name: 'British Columbia', territory: false, names: ['british columbia'] },
  AB: { name: 'Alberta', territory: false, names: ['alberta'] },
  QC: { name: 'Quebec', territory: false, names: ['quebec', 'québec'] },
  MB: { name: 'Manitoba', territory: false, names: ['manitoba'] },
  NB: { name: 'New Brunswick', territory: false, names: ['new brunswick'] },
  NL: {
    name: 'Newfoundland and Labrador',
    territory: false,
    names: ['newfoundland and labrador', 'newfoundland'],
  },
  NS: { name: 'Nova Scotia', territory: false, names: ['nova scotia'] },
  PE: {
    name: 'Prince Edward Island',
    territory: false,
    names: ['prince edward island'],
  },
  SK: { name: 'Saskatchewan', territory: false, names: ['saskatchewan'] },
  NT: {
    name: 'Northwest Territories',
    territory: true,
    names: ['northwest territories'],
  },
  YT: { name: 'Yukon', territory: true, names: ['yukon', 'yukon territory'] },
  NU: { name: 'Nunavut', territory: true, names: ['nunavut'] },
});

/**
 * Look up a Canadian jurisdiction by 2-letter code or full name
 * (case-insensitive). Returns null for anything else.
 */
function canadianJurisdiction(state) {
  if (!state) return null;
  const s = String(state).trim();
  const byCode = CANADIAN_JURISDICTIONS[s.toUpperCase()];
  if (byCode) return byCode;
  const lower = s.toLowerCase();
  for (const code of Object.keys(CANADIAN_JURISDICTIONS)) {
    if (CANADIAN_JURISDICTIONS[code].names.includes(lower)) {
      return CANADIAN_JURISDICTIONS[code];
    }
  }
  return null;
}

/**
 * Header lines for a plain-facts preview (previewRenderer). US behavior is
 * unchanged; Canadian jurisdictions get "PROVINCE OF X" (territories: the
 * territory name alone — their own templates use the same convention) and
 * never a "COUNTY OF" line, since Canadian jurisdictions have no counties
 * in this sense.
 * @param {string} state - state/province code or name as stored on the document
 * @param {string} county - county/location as stored on the document
 * @returns {string[]} lines to join with '\n'
 */
function venueHeaderLines(state, county) {
  const ca = canadianJurisdiction(state);
  if (ca) {
    return [
      ca.territory ? ca.name.toUpperCase() : `PROVINCE OF ${ca.name.toUpperCase()}`,
    ];
  }
  return [`STATE OF ${state || '[STATE]'}`, `COUNTY OF ${county || '[COUNTY]'}`];
}

module.exports = {
  DEFAULT_TERMS,
  districtPhrase,
  canadianJurisdiction,
  venueHeaderLines,
};
