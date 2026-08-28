'use strict';

/**
 * Merge for itemized money lists collected across chat turns —
 * income sources ({label, amount, person?}) and expense categories
 * ({label, amount}).
 *
 * REPLACE-PER-PERSON semantics (structural dedupe, no language logic):
 * the model each turn emits the COMPLETE current picture for whichever
 * person it discussed (the schema + ALREADY COLLECTED summary demand
 * this). So when an incoming turn contains ANY entry tagged to person X,
 * that turn's set for X REPLACES all of X's previously stored entries;
 * persons the turn does not mention keep their stored entries untouched.
 *
 * Why not label-keyed merge: a live run stored the same wage twice under
 * near-identical label variants ("Katie ... dental office" vs
 * "Kathleen ... a dental office"), doubling the sworn per-person income.
 * Label-equality can't catch variants without fuzzy string matching
 * (forbidden here) — replacement per person makes the variant simply
 * supersede the old wording.
 *
 * Person-less entries (expenses, untagged income) share one bucket, so a
 * turn restating any expense replaces the whole expense list — again,
 * the model restates the complete list.
 */

const MAX_ITEMS = 20;

function normalizeLabel(label) {
  if (typeof label !== 'string') return '';
  return label.trim().toLowerCase().replace(/\s+/g, ' ');
}

function personKeyOf(item) {
  return typeof item?.person === 'string' ? item.person.trim().toLowerCase() : '';
}

function sanitizeItem(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const label = typeof raw.label === 'string' ? raw.label.trim() : '';
  const amount = Number(raw.amount ?? raw.monthly_amount ?? raw.monthlyAmount);
  if (!label || !Number.isFinite(amount) || amount < 0) return null;
  const item = { label, amount: Math.round(amount) };
  const person = typeof raw.person === 'string' ? raw.person.trim() : '';
  if (person) item.person = person;
  return item;
}

/**
 * @param {Array|undefined} existing
 * @param {Array|undefined} incoming
 * @returns {Array} merged list. Incoming entries REPLACE the stored
 *   entries of every person they mention (see module docblock); within
 *   the incoming set, a repeated (person, label) keeps the latest amount.
 */
function mergeLabeledAmounts(existing, incoming) {
  const base = Array.isArray(existing)
    ? existing.map(sanitizeItem).filter(Boolean)
    : [];
  if (!Array.isArray(incoming)) return base;

  const items = incoming.map(sanitizeItem).filter(Boolean);
  if (items.length === 0) return base;

  // Persons mentioned this turn: their stored entries are superseded.
  const mentioned = new Set(items.map(personKeyOf));
  const merged = base.filter((e) => !mentioned.has(personKeyOf(e)));

  for (const item of items) {
    // Exact (person, label) repeats within one turn collapse, latest wins.
    const idx = merged.findIndex(
      (e) =>
        personKeyOf(e) === personKeyOf(item) &&
        normalizeLabel(e.label) === normalizeLabel(item.label)
    );
    if (idx !== -1) {
      merged[idx] = { ...merged[idx], ...item };
    } else if (merged.length < MAX_ITEMS) {
      merged.push(item);
    }
  }
  return merged;
}

/** @returns {number} sum of item amounts (0 for empty/invalid) */
function totalOf(items) {
  if (!Array.isArray(items)) return 0;
  return items.reduce((sum, raw) => {
    const item = sanitizeItem(raw);
    return item ? sum + item.amount : sum;
  }, 0);
}

module.exports = { mergeLabeledAmounts, totalOf };
