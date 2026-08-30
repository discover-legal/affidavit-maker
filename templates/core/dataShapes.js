'use strict';

/**
 * Shape tolerance for interview data reaching templates.
 *
 * The extraction layer stores some fields as free strings ("Assets the
 * petitioner keeps, as a comma-separated description, in the user's
 * words" — services/agents/BaseDivorceOrchestrator.js), while older saves
 * and some code paths carry arrays. Templates must render both without
 * crashing (`.forEach` on a string) or silently dropping (Array.isArray
 * guards that skip strings).
 *
 * A string is deliberately kept as ONE list item — never split on commas
 * or otherwise re-parsed: the user's description stays whole ("the house
 * at 12 Main St, Ottawa" is one asset, not two).
 */
function asList(value) {
  if (Array.isArray(value)) {
    return value.map((v) => String(v ?? '').trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? [trimmed] : [];
  }
  return [];
}

/**
 * The extraction layer records `propertyAgreement` sometimes as a status
 * token ("agreed", "yes") and sometimes as the user's actual description
 * of the deal ("She keeps the house; he keeps the truck"). Only the
 * latter belongs inside a pleading sentence — concatenating a raw status
 * token produced "…division of their community/marital property. agreed"
 * (live Utah QA, 2026-08).
 *
 * Returns the trimmed description when the value reads as prose, or ''
 * when it is a bare status/boolean token (which the surrounding sentence
 * already expresses).
 */
const PROPERTY_AGREEMENT_STATUS_TOKENS = new Set([
  'agreed', 'agree', 'agreement', 'yes', 'true', 'y',
  'no', 'false', 'n', 'none', 'n/a', 'na',
  'contested', 'disputed', 'not agreed', 'no agreement',
  'pending', 'unknown', 'undecided', 'tbd',
]);

function propertyAgreementProse(value) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  const normalized = trimmed.toLowerCase().replace(/[.!]+$/, '').replace(/\s+/g, ' ');
  if (PROPERTY_AGREEMENT_STATUS_TOKENS.has(normalized)) return '';
  // A one-word value is a token, not a description of a property deal.
  if (!/\s/.test(trimmed)) return '';
  return trimmed;
}

/**
 * Split a property/debt list into community and separate buckets by the
 * "Separate property: " / "Separate debt: " prefix convention the
 * extraction layer emits (see services/agents/extractionQuality.js —
 * PROPERTY_ITEM_DESCRIPTION / DEBT_ITEM_DESCRIPTION). Templates that render
 * separate-property tracing paragraphs use this to route items to the right
 * section instead of lumping every item into the community/marital division.
 *
 * The prefix is stripped from the returned separate items so the template
 * can render them cleanly ("$45,000 CD inherited …", not "Separate property:
 * $45,000 CD inherited …"). Matching is case-insensitive on the prefix word
 * only — the item's payload is preserved verbatim.
 *
 * Legacy strings and non-lists degrade to community-only, mirroring
 * `asList` — a template that expects both buckets is safe on old data.
 */
const SEPARATE_PROPERTY_PREFIX = /^\s*separate\s+property\s*:\s*/i;
const SEPARATE_DEBT_PREFIX = /^\s*separate\s+debt\s*:\s*/i;

function partitionByCharacter(value, kind = 'property') {
  const rx = kind === 'debt' ? SEPARATE_DEBT_PREFIX : SEPARATE_PROPERTY_PREFIX;
  const community = [];
  const separate = [];
  for (const item of asList(value)) {
    if (rx.test(item)) {
      separate.push(item.replace(rx, '').trim());
    } else {
      community.push(item);
    }
  }
  return { community, separate };
}

module.exports = { asList, propertyAgreementProse, partitionByCharacter };
