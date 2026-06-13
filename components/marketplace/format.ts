/**
 * Shared, pure formatting helpers for the marketplace UI. No 'use client' —
 * safe to import from both Server and Client Components.
 */

/** 100 -> "$1.00", 2499 -> "$24.99". Whole-dollar prices drop the cents. */
export function formatPrice(cents: number): string {
  const dollars = cents / 100;
  return Number.isInteger(dollars) ? `$${dollars}` : `$${dollars.toFixed(2)}`;
}

/** "4.7" with one decimal, or null when there are no ratings yet. */
export function formatRating(avg: number, count: number): string | null {
  if (!count || count <= 0) return null;
  return avg.toFixed(1);
}

const DIFFICULTY_LABELS: Record<string, string> = {
  basic: 'Basic',
  standard: 'Standard',
  complex: 'Complex',
};

export function difficultyLabel(level: string): string {
  return DIFFICULTY_LABELS[level] ?? 'Standard';
}

/** Joins jurisdiction codes for display, truncating long lists. */
export function formatJurisdictions(codes: string[], max = 4): string {
  if (codes.length === 0) return 'All jurisdictions';
  if (codes.length <= max) return codes.join(', ');
  return `${codes.slice(0, max).join(', ')} +${codes.length - max}`;
}
