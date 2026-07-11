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

describe('storyProgress', () => {
  test('counts known core slots', () => {
    const { storyProgress } = require('@/components/app/lifeStory');
    expect(storyProgress({})).toEqual({ known: 0, total: 9 });
    expect(
      storyProgress({
        affiantName: 'B',
        respondentName: 'A',
        marriageDate: '2010-05-01',
        state: 'TX',
        children: [{ name: 'Emma' }],
      }).known,
    ).toBe(5);
    // "no minor children" is an answer, not a gap
    expect(storyProgress({ hasMinorChildren: false }).known).toBe(1);
  });
});

describe('rich visuals helpers', () => {
  const { buildTimeline, buildLedger, moneyLeftover, buildFamily } =
    require('@/components/app/lifeStory');
  const profile = {
    respondentFirstName: 'Alex',
    marriageDate: '2010-05-01',
    separationDate: '2024-11-15',
    children: [
      { name: 'Emma', dob: '2015-04-02' },
      { name: 'Liam', dob: '2017-06-15' },
    ],
  };

  test('buildTimeline places births between married and today, clamped', () => {
    const t = buildTimeline(profile, new Date(2026, 6, 10));
    expect(t.majors.map((m: { key: string }) => m.key)).toEqual(['married', 'separated']);
    expect(t.births).toHaveLength(2);
    expect(t.births[0].initial).toBe('E');
    for (const b of t.births) {
      expect(b.pos).toBeGreaterThanOrEqual(10);
      expect(b.pos).toBeLessThanOrEqual(88);
    }
    expect(t.births[1].pos - t.births[0].pos).toBeGreaterThanOrEqual(6);
  });

  test('buildTimeline handles bad dates safely', () => {
    expect(buildTimeline({})).toBeNull();
    expect(buildTimeline({ marriageDate: 'sometime' })).toBeNull();
    const t = buildTimeline(
      { marriageDate: '2020-01-01', separationDate: '2019-01-01' },
      new Date(2026, 0, 1),
    );
    expect(t.majors.map((m: { key: string }) => m.key)).toEqual(['married']); // bad separation dropped
  });

  test('buildFamily puts You first, spouse last, children scaled between', () => {
    const fam = buildFamily(profile);
    expect(fam[0].label).toBe('You');
    expect(fam[fam.length - 1].label).toBe('Alex');
    expect(fam[1].heightScale).toBeLessThan(1);
  });

  test('moneyLeftover computes margin only when both sides known', () => {
    expect(moneyLeftover({ monthlyIncome: 5200, monthlyExpenses: 4100 })).toBe(1100);
    expect(moneyLeftover({ monthlyIncome: 4000, monthlyExpenses: 4500 })).toBe(-500);
    expect(moneyLeftover({ monthlyIncome: 5200 })).toBeNull();
  });

  test('buildLedger humanizes values and leaves gaps null', () => {
    const items = buildLedger({
      groundsForDivorce: 'insupportability',
      custodyArrangement: 'joint',
      primaryCustodian: 'Brandon Pritchard',
      childSupportAmount: 800,
      childSupportObligor: 'Alex Pritchard',
      spousalSupportRequested: false,
      serviceMethod: 'waiver',
      hasProtectiveOrder: false,
    });
    const by = Object.fromEntries(items.map((i: { key: string; value: string | null }) => [i.key, i.value]));
    expect(by.grounds).toBe('insupportability');
    expect(by.custody).toBe('Joint, with Brandon');
    expect(by.child_support).toBe('$800/mo from Alex');
    expect(by.spousal_support).toBe('Not requested');
    expect(by.service).toBe('Waiver of service');
    expect(by.protective_order).toBe('None');
    expect(by.military).toBeNull();
    expect(by.fee_waiver).toBeNull();
  });
});

describe('parseKnownDate strictness', () => {
  const { parseKnownDate } = require('@/components/app/lifeStory');
  test('rejects rollover dates instead of silently shifting them', () => {
    expect(parseKnownDate('13/01/2015')).toBeNull(); // DD/MM entry, not month 13
    expect(parseKnownDate('2015-13-45')).toBeNull();
    expect(parseKnownDate('2015-02-30')).toBeNull();
    expect(parseKnownDate('12/31/2015')).not.toBeNull();
  });
});

describe('moneySegments', () => {
  const { moneySegments } = require('@/components/app/lifeStory');
  test('sorts largest-first and folds beyond 5 into Other', () => {
    const segs = moneySegments([
      { label: 'Housing', amount: 1400 },
      { label: 'Food', amount: 600 },
      { label: 'Utilities', amount: 250 },
      { label: 'Childcare', amount: 900 },
      { label: 'Transportation', amount: 400 },
      { label: 'Medical', amount: 150 },
      { label: 'Debt payments', amount: 300 },
    ]);
    expect(segs).toHaveLength(5);
    expect(segs[0].label).toBe('Housing');
    // Other = Debt payments 300 + Utilities 250 + Medical 150
    expect(segs[4]).toEqual({ label: 'Other', amount: 700 });
  });

  test('annotates income items with the person', () => {
    const profile = { respondentFirstName: 'Alex' };
    const segs = moneySegments(
      [
        { label: 'Wages', amount: 4200, person: 'petitioner' },
        { label: 'Wages', amount: 1000, person: 'respondent' },
      ],
      profile,
    );
    expect(segs[0].label).toBe('Wages (you)');
    expect(segs[1].label).toBe('Wages (Alex)');
  });

  test('drops invalid entries and handles non-arrays', () => {
    expect(moneySegments(undefined)).toEqual([]);
    expect(moneySegments([{ label: '', amount: 5 }, { label: 'X', amount: -1 }, null])).toEqual([]);
  });
});
