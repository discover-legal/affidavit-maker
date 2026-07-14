/**
 * @jest-environment node
 */
import { buildCalendar, type CalendarEvent } from '@/lib/ics';

const EVENTS: CalendarEvent[] = [
  {
    title: 'Answer due; respond, now\nplease',
    description: 'File your answer with the clerk',
    date: '2026-07-19',
  },
  { title: 'Hearing', date: '2026-07-31' },
];

/** Physical lines (folding intact). */
function physicalLines(ics: string): string[] {
  return ics.split('\r\n').filter((l) => l !== '');
}

/** Logical lines (folding undone: CRLF + space removed). */
function logicalLines(ics: string): string[] {
  return ics.replace(/\r\n /g, '').split('\r\n').filter((l) => l !== '');
}

describe('buildCalendar', () => {
  it('produces a structurally valid VCALENDAR 2.0 with CRLF line endings', () => {
    const ics = buildCalendar(EVENTS, 'My deadlines');
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    // No bare LF or CR anywhere — every newline is a CRLF pair.
    expect(ics.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/);

    const lines = logicalLines(ics);
    expect(lines).toContain('VERSION:2.0');
    expect(lines).toContain('PRODID:-//discover.legal//life-story//EN');
    expect(lines).toContain('X-WR-CALNAME:My deadlines');
    expect(lines.filter((l) => l === 'BEGIN:VEVENT')).toHaveLength(2);
    expect(lines.filter((l) => l === 'END:VEVENT')).toHaveLength(2);
    // Physical lines respect the 75-octet limit (ASCII input ⇒ chars = octets).
    for (const line of physicalLines(ics)) {
      expect(line.length).toBeLessThanOrEqual(75);
    }
  });

  it('renders all-day events: DTSTART;VALUE=DATE with DTEND the next day', () => {
    const lines = logicalLines(buildCalendar(EVENTS, 'Cal'));
    expect(lines).toContain('DTSTART;VALUE=DATE:20260719');
    expect(lines).toContain('DTEND;VALUE=DATE:20260720');
    // Month rollover on the 31st.
    expect(lines).toContain('DTSTART;VALUE=DATE:20260731');
    expect(lines).toContain('DTEND;VALUE=DATE:20260801');
  });

  it('escapes semicolons, commas, and newlines in TEXT values', () => {
    const lines = logicalLines(buildCalendar(EVENTS, 'Cal'));
    expect(lines).toContain('SUMMARY:Answer due\\; respond\\, now\\nplease');
  });

  it('assigns deterministic UIDs (same input, byte-identical output)', () => {
    const first = buildCalendar(EVENTS, 'Cal');
    const second = buildCalendar(EVENTS, 'Cal');
    expect(second).toBe(first);

    const uids = logicalLines(first).filter((l) => l.startsWith('UID:'));
    expect(uids).toHaveLength(2);
    for (const uid of uids) {
      expect(uid).toMatch(/^UID:[0-9a-f]{8}-\d{8}@discover\.legal$/);
    }
    expect(new Set(uids).size).toBe(2);
  });

  it('attaches a display alarm 3 days before each event', () => {
    const lines = logicalLines(buildCalendar(EVENTS, 'Cal'));
    expect(lines.filter((l) => l === 'BEGIN:VALARM')).toHaveLength(2);
    expect(lines.filter((l) => l === 'END:VALARM')).toHaveLength(2);
    expect(lines.filter((l) => l === 'ACTION:DISPLAY')).toHaveLength(2);
    expect(lines.filter((l) => l === 'TRIGGER:-P3D')).toHaveLength(2);
  });

  it('folds long lines at 75 octets and content survives unfolding', () => {
    const longTitle = 'Serve your spouse with the filed petition '.repeat(4).trim();
    const ics = buildCalendar([{ title: longTitle, date: '2026-08-01' }], 'Cal');
    for (const line of physicalLines(ics)) {
      expect(line.length).toBeLessThanOrEqual(75);
    }
    expect(logicalLines(ics)).toContain(`SUMMARY:${longTitle}`);
  });

  it('skips events without a real YYYY-MM-DD date', () => {
    const ics = buildCalendar(
      [
        { title: 'Vague', date: 'soon' },
        { title: 'Impossible', date: '2026-02-31' },
        { title: 'Kept', date: '2026-02-28' },
      ],
      'Cal',
    );
    const lines = logicalLines(ics);
    expect(lines.filter((l) => l === 'BEGIN:VEVENT')).toHaveLength(1);
    expect(lines).toContain('SUMMARY:Kept');
  });

  it('yields a valid empty calendar for zero events', () => {
    const ics = buildCalendar([], 'Empty');
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(ics).not.toContain('BEGIN:VEVENT');
    expect(logicalLines(ics)).toContain('X-WR-CALNAME:Empty');
  });
});
