/**
 * Dependency-free iCalendar (RFC 5545) builder for the pro se deadline
 * export ("Add my deadlines to my calendar" on /profile).
 *
 * All-day VEVENTs only (DTSTART;VALUE=DATE with DTEND the next day), CRLF
 * line endings, 75-octet line folding, and TEXT escaping per the spec.
 * Deliberately deterministic — UIDs are content hashes and DTSTAMP derives
 * from the event date, never Date.now()/Math.random() — so the same input
 * always yields byte-identical output (stable tests, stable re-imports).
 */

export type CalendarEvent = {
  title: string;
  description?: string;
  /** All-day event date as YYYY-MM-DD. Events with any other shape are skipped. */
  date: string;
};

const PRODID = '-//discover.legal//life-story//EN';
const CRLF = '\r\n';
const LINE_OCTET_LIMIT = 75;

/** RFC 5545 §3.3.11 TEXT escaping: backslash first, then ; , and newlines. */
function escapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}

/** Deterministic 32-bit FNV-1a hash of a string, as 8 hex chars. */
function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/** UTF-8 byte length of a single code point (folding counts octets, not chars). */
function utf8Octets(codePoint: number): number {
  if (codePoint < 0x80) return 1;
  if (codePoint < 0x800) return 2;
  if (codePoint < 0x10000) return 3;
  return 4;
}

/**
 * Fold a content line at 75 octets (RFC 5545 §3.1). Continuation lines
 * begin with a single space, which itself counts against their limit.
 * Iterates by code point so multi-byte characters are never split.
 */
function foldLine(line: string): string {
  const folded: string[] = [];
  let current = '';
  let octets = 0;
  for (const ch of line) {
    const chOctets = utf8Octets(ch.codePointAt(0) as number);
    const budget = folded.length === 0 ? LINE_OCTET_LIMIT : LINE_OCTET_LIMIT - 1;
    if (octets + chOctets > budget) {
      folded.push(current);
      current = '';
      octets = 0;
    }
    current += ch;
    octets += chOctets;
  }
  folded.push(current);
  return folded.map((part, i) => (i === 0 ? part : ` ${part}`)).join(CRLF);
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** YYYY-MM-DD → [DTSTART, DTEND] as YYYYMMDD (DTEND = next day), or null. */
function allDayRange(date: string): [string, string] | null {
  const m = DATE_RE.exec(date.trim());
  if (!m) return null;
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const start = new Date(Date.UTC(year, month - 1, day));
  // Reject "valid-looking" impossible dates (2026-02-31) that Date normalizes.
  if (
    start.getUTCFullYear() !== year ||
    start.getUTCMonth() !== month - 1 ||
    start.getUTCDate() !== day
  ) {
    return null;
  }
  const end = new Date(Date.UTC(year, month - 1, day + 1));
  const fmt = (d: Date) =>
    `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(
      d.getUTCDate(),
    ).padStart(2, '0')}`;
  return [fmt(start), fmt(end)];
}

/**
 * Build a complete VCALENDAR 2.0 document from all-day events. Events whose
 * `date` is not a real YYYY-MM-DD day are silently skipped; an empty event
 * list still yields a valid (empty) calendar. Every event carries a display
 * alarm 3 days before the day itself.
 */
export function buildCalendar(events: CalendarEvent[], calName: string): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${PRODID}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(calName)}`,
  ];

  for (const event of events) {
    const range = allDayRange(event.date);
    if (!range) continue;
    const [start, end] = range;
    const uid = `${fnv1a(`${event.title}|${event.date}`)}-${start}@discover.legal`;
    lines.push(
      'BEGIN:VEVENT',
      `UID:${uid}`,
      // DTSTAMP is required; derived from the event date to stay deterministic.
      `DTSTAMP:${start}T000000Z`,
      `DTSTART;VALUE=DATE:${start}`,
      `DTEND;VALUE=DATE:${end}`,
      `SUMMARY:${escapeText(event.title)}`,
    );
    if (event.description) {
      lines.push(`DESCRIPTION:${escapeText(event.description)}`);
    }
    lines.push(
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${escapeText(event.title)}`,
      'TRIGGER:-P3D',
      'END:VALARM',
      'END:VEVENT',
    );
  }

  lines.push('END:VCALENDAR');
  return lines.map(foldLine).join(CRLF) + CRLF;
}
