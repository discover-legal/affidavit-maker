/**
 * Date shape and arithmetic for composition.
 *
 * Everything here is SYNTACTIC, which core/README.md rule 6 allows: a date
 * either has the ISO / partial-ISO shape (YYYY, YYYY-MM, YYYY-MM-DD) or it
 * does not. We do not interpret prose ("a few months ago" is not a date and
 * renders a blank — spec 03 §3 I-5). The shape check is a Date round-trip,
 * not a regex: Date.parse accepts the shape and toISOString() reproduces
 * exactly the prefix the user gave. Anything V8 parses leniently ("June
 * 2015", "1") fails the round-trip and is rejected.
 */

import type { Language } from '../model/types';

export type DatePrecision = 'year' | 'month' | 'day';

const PRECISION_BY_LENGTH: Record<number, DatePrecision> = { 4: 'year', 7: 'month', 10: 'day' };

/** True when `value` is a string of shape YYYY, YYYY-MM or YYYY-MM-DD naming a real calendar date. */
export function isRenderableDate(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const precision = PRECISION_BY_LENGTH[value.length];
  if (!precision) return false;
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) return false;
  // Round-trip: date-only ISO strings parse as UTC, so the ISO prefix must match verbatim.
  return new Date(ms).toISOString().slice(0, value.length) === value;
}

export function datePrecision(value: string): DatePrecision {
  return PRECISION_BY_LENGTH[value.length] ?? 'day';
}

/** The earliest instant a (possibly partial) date can denote, as UTC. */
export function earliestInstant(value: string): Date {
  return new Date(Date.parse(value));
}

/**
 * The latest instant a (possibly partial) date can denote, as UTC: the end
 * of the year for YYYY, the end of the month for YYYY-MM. Used when a gate
 * needs a LOWER bound on elapsed time from a partial date (a separation
 * "in 2023" has lasted at least since 31 December 2023).
 */
export function latestInstant(value: string): Date {
  const start = earliestInstant(value);
  switch (datePrecision(value)) {
    case 'year':
      return new Date(Date.UTC(start.getUTCFullYear(), 11, 31));
    case 'month':
      // Day 0 of the next month is the last day of this month.
      return new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0));
    default:
      return start;
  }
}

/** Whole calendar months elapsed from `from` to `to` (UTC). Negative when `from` is in the future. */
export function monthsBetween(from: Date, to: Date): number {
  const months = (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + (to.getUTCMonth() - from.getUTCMonth());
  return to.getUTCDate() < from.getUTCDate() ? months - 1 : months;
}

export function addMonths(date: Date, months: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, date.getUTCDate()));
}

const LOCALE: Record<Language, string> = { en: 'en-US', es: 'es' };

/** Human-readable date at the precision the record carries ("June 14, 2015", "June 2015", "2015"). */
export function formatDate(value: string, language: Language = 'en'): string {
  const precision = datePrecision(value);
  const options: Intl.DateTimeFormatOptions = { timeZone: 'UTC', year: 'numeric' };
  if (precision !== 'year') options.month = 'long';
  if (precision === 'day') options.day = 'numeric';
  return earliestInstant(value).toLocaleDateString(LOCALE[language] ?? LOCALE.en, options);
}

/** ISO calendar date (YYYY-MM-DD) of an instant, in UTC. */
export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
