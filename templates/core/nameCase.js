// templates/core/nameCase.js
// Name-aware casing helpers for court captions and orders.
//
// The caption formatter historically ran `.toUpperCase()` on party names,
// which corrupts internal-capital surnames the extraction layer deliberately
// preserves (see services/agents/extractionQuality.js — "McDonald",
// "DiCaprio", "van der Berg" stay exactly as typed). "McPherson" then
// rendered as "MCPHERSON" in the caption.
//
// captionUpper() preserves those internal-capital patterns while still
// UPPERCASING the rest of the name so the caption reads like a court
// caption. The rules mirror what the extraction prompt tells the model
// to keep intact:
//
//   Mc / Mac + Uppercase       → keep the lowercase middle char, uppercase
//                                the rest ("McPherson"  → "McPHERSON")
//   De / Di / La / Le / O' + Uppercase → same ("DiCaprio" → "DiCAPRIO")
//   van / von / de / der / la  → lowercased connective particles in
//     compound surnames stay lowercase, and the following legal-name word
//     uppercases ("van der Berg" → "van der BERG"). Match only when the
//     particle is stored as a lowercase token.
//   Apostrophes and hyphens are respected as word boundaries — everything
//     between them is uppercased normally.
//
// Anything the pattern does not recognize falls back to a plain
// `.toUpperCase()`, so the historical output is byte-identical for names
// with no internal capitals (the common case).

'use strict';

// Lowercase particles that stay lowercase inside a compound surname
// ("van der Berg", "de la Cruz"). Only respected when the stored token is
// already lowercase — if the user typed "Van", we leave it uppercased.
const LOWERCASE_PARTICLES = new Set([
  'van', 'von', 'de', 'del', 'della', 'der', 'den', 'di', 'du',
  'la', 'le', 'lo', 'da', 'das', 'dos', 'y', 'zu', 'af', 'op', 'ten', 'ter',
]);

/**
 * Uppercase one whitespace-separated token, preserving Mc/Mac/O'/Di/De/La/Le
 * internal capitals and connective-particle lowercase.
 * @param {string} token
 * @returns {string}
 */
function upperOneToken(token) {
  if (!token) return token;

  // Connective particle stays lowercase if the user typed it lowercase.
  if (token === token.toLowerCase() && LOWERCASE_PARTICLES.has(token)) {
    return token;
  }

  // Mc/Mac prefix with a following capital ("McPherson", "MacArthur").
  const mcMatch = /^(Ma?c)([A-Z])(.*)$/.exec(token);
  if (mcMatch) {
    return mcMatch[1] + (mcMatch[2] + mcMatch[3]).toUpperCase();
  }

  // Short capitalized prefix followed by a capital, e.g. "DiCaprio", "DeLuca",
  // "LaCroix", "LeBron". Cover 2- to 3-letter prefixes.
  const prefixMatch = /^([A-Z][a-z]{1,2})([A-Z])(.*)$/.exec(token);
  if (prefixMatch) {
    return prefixMatch[1] + (prefixMatch[2] + prefixMatch[3]).toUpperCase();
  }

  // O'Brien / D'Angelo — apostrophe splits the token; uppercase both parts
  // and preserve the apostrophe.
  if (token.includes("'") || token.includes('’')) {
    return token
      .split(/(['’])/)
      .map((piece) => (piece === "'" || piece === '’' ? piece : piece.toUpperCase()))
      .join('');
  }

  // Hyphenated surnames: uppercase each side independently.
  if (token.includes('-')) {
    return token
      .split('-')
      .map(upperOneToken)
      .join('-');
  }

  return token.toUpperCase();
}

/**
 * Uppercase a party name for a court caption, preserving
 * McPherson / DiCaprio / van der Berg / O'Brien-Hatch patterns.
 *
 * @param {string} name
 * @returns {string}
 */
function captionUpper(name) {
  if (name == null) return '';
  const s = String(name);
  if (s === '') return '';
  return s.split(/(\s+)/).map((piece) => (/^\s+$/.test(piece) ? piece : upperOneToken(piece))).join('');
}

module.exports = { captionUpper };
