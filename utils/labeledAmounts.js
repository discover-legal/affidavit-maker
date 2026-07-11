'use strict';

/**
 * Merge for itemized money lists collected across chat turns —
 * income sources ({label, amount, person?}) and expense categories
 * ({label, amount}). Same contract as childrenMerge: the LLM usually
 * emits only the item under discussion, so entries merge by normalized
 * label (corrections update in place) and existing entries are never
 * dropped by assignment.
 */

const MAX_ITEMS = 20;

function normalizeLabel(label) {
  if (typeof label !== 'string') return '';
  return label.trim().toLowerCase().replace(/\s+/g, ' ');
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
 * @returns {Array} merged list; a re-stated label updates in place
 */
function mergeLabeledAmounts(existing, incoming) {
  const base = Array.isArray(existing)
    ? existing.map(sanitizeItem).filter(Boolean)
    : [];
  if (!Array.isArray(incoming)) return base;

  for (const raw of incoming) {
    const item = sanitizeItem(raw);
    if (!item) continue;
    const idx = base.findIndex((e) => normalizeLabel(e.label) === normalizeLabel(item.label));
    if (idx !== -1) {
      base[idx] = { ...base[idx], ...item };
    } else if (base.length < MAX_ITEMS) {
      base.push(item);
    }
  }
  return base;
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
