/** @jest-environment node */

import {
  buildRecitals,
  categoryLabel,
  computeAge,
  formatFriendlyDate,
  groupFacts,
} from '@/components/app/lifeStory';

describe('formatFriendlyDate', () => {
  test('formats ISO dates without timezone drift', () => {
    expect(formatFriendlyDate('2010-05-01')).toBe('May 1, 2010');
  });
  test('passes through unparseable strings and empties', () => {
    expect(formatFriendlyDate('early spring 2010')).toBe('early spring 2010');
    expect(formatFriendlyDate('')).toBe('');
    expect(formatFriendlyDate(undefined)).toBe('');
  });
});

describe('computeAge', () => {
  const now = new Date(2026, 6, 10); // 2026-07-10
  test('computes whole years from dob, respecting the birthday', () => {
    expect(computeAge({ dob: '2015-04-02' }, now)).toBe(11);
    expect(computeAge({ dob: '2015-08-02' }, now)).toBe(10);
  });
  test('falls back to a stated age, and to null', () => {
    expect(computeAge({ age: 7 }, now)).toBe(7);
    expect(computeAge({}, now)).toBeNull();
    expect(computeAge({ dob: 'garbage' }, now)).toBeNull();
  });
});

describe('buildRecitals', () => {
  test('always shows identity, marriage, and home — with blanks when unknown', () => {
    const recitals = buildRecitals({});
    expect(recitals.map((r) => r.id)).toEqual(['identity', 'marriage', 'home']);
    expect(recitals.every((r) => !r.known)).toBe(true);
    const identity = recitals[0].segments;
    expect(identity.some((s) => s.kind === 'blank' && s.text === 'your name')).toBe(true);
  });

  test('narrates known values as tokens', () => {
    const recitals = buildRecitals({
      affiantName: 'Brandon Pritchard',
      respondentFirstName: 'Alex',
      respondentLastName: 'Pritchard',
      marriageDate: '2010-05-01',
      marriageCity: 'Austin',
      marriageStateName: 'Texas',
      county: 'Travis',
      state: 'tx',
      residencyStateMonths: 48,
      monthlyIncome: 5200,
      hasProtectiveOrder: true,
    });
    const flat = recitals.flatMap((r) => r.segments);
    const values = flat.filter((s) => s.kind === 'value').map((s) => s.text);
    expect(values).toEqual(
      expect.arrayContaining([
        'Brandon Pritchard',
        'Alex Pritchard',
        'May 1, 2010',
        'Austin, Texas',
        'Travis County, TX',
        '48 months',
        '$5,200 a month',
        'protective order',
      ]),
    );
    expect(recitals.find((r) => r.id === 'identity')?.known).toBe(true);
  });

  test('omits finances and safety until shared', () => {
    const ids = buildRecitals({ affiantName: 'B' }).map((r) => r.id);
    expect(ids).not.toContain('finances');
    expect(ids).not.toContain('safety');
  });
});

describe('fact chapters', () => {
  test('groups facts under human labels, preserving order', () => {
    const chapters = groupFacts([
      { content: 'I have lived in Texas for six years.', category: 'residency' },
      { content: 'We have three children.', category: 'children' },
      { content: 'I moved to Travis County in 2020.', category: 'residency' },
      { content: '', category: 'residency' }, // empty content dropped
    ]);
    expect(chapters.map((c) => c.label)).toEqual(['Where you live', 'Your children']);
    expect(chapters[0].facts).toHaveLength(2);
  });

  test('categoryLabel humanizes unknown categories', () => {
    expect(categoryLabel('custody_details')).toBe('Custody details');
    expect(categoryLabel(undefined)).toBe('Your story');
  });
});
