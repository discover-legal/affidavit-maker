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
    expect(recitals[1].segments.map((s) => s.text).join('')).toContain('Your marriage details:');
  });

  test('normalizes a county value that already includes the County suffix', () => {
    const home = buildRecitals({ county: 'Salt Lake County', state: 'UT' })
      .find((r) => r.id === 'home');
    expect(home?.segments.map((s) => s.text).join('')).toBe('Home is Salt Lake County, UT.');
  });

  test('narrates known values as tokens', () => {
    const recitals = buildRecitals({
      affiantName: 'Jordan Example',
      respondentFirstName: 'Alex',
      respondentLastName: 'Example',
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
        'Jordan Example',
        'Alex Example',
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

  test('uses the other party as the spouse for a respondent profile', () => {
    const recitals = buildRecitals({
      role: 'respondent',
      affiantName: 'Jordan Avery',
      petitionerName: 'Morgan Avery',
      respondentName: 'Jordan Avery',
      marriageDate: '2018-09-15',
    });
    const marriage = recitals.find((r) => r.id === 'marriage');
    const text = marriage?.segments.map((segment) => segment.text).join('');
    expect(text).toContain('You married Morgan Avery');
    expect(text).not.toContain('You married Jordan Avery');
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
      primaryCustodian: 'Jordan Example',
      childSupportAmount: 800,
      childSupportObligor: 'Alex Example',
      spousalSupportRequested: false,
      serviceMethod: 'waiver',
      hasProtectiveOrder: false,
    });
    const by = Object.fromEntries(items.map((i: { key: string; value: string | null }) => [i.key, i.value]));
    expect(by.grounds).toBe('insupportability');
    expect(by.custody).toBe('Joint, with Jordan');
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

  test('inverts you/other-party income labels for a respondent', () => {
    const profile = {
      role: 'respondent',
      petitionerFirstName: 'Morgan',
      respondentFirstName: 'Jordan',
    };
    const segs = moneySegments(
      [
        { label: 'Wages', amount: 4200, person: 'petitioner' },
        { label: 'Wages', amount: 1000, person: 'respondent' },
      ],
      profile,
    );
    expect(segs[0].label).toBe('Wages (Morgan)');
    expect(segs[1].label).toBe('Wages (you)');
  });

  test('drops invalid entries and handles non-arrays', () => {
    expect(moneySegments(undefined)).toEqual([]);
    expect(moneySegments([{ label: '', amount: 5 }, { label: 'X', amount: -1 }, null])).toEqual([]);
  });
});

describe('supportKindVisible', () => {
  const { supportKindVisible } = require('@/components/app/lifeStory');

  test('shows answer only to respondents and default/finalization only to petitioners', () => {
    expect(supportKindVisible('answer', 'respondent', {})).toBe(true);
    expect(supportKindVisible('answer', 'petitioner', {})).toBe(false);
    expect(supportKindVisible('default_package', 'respondent', {})).toBe(false);
    expect(supportKindVisible('finalization_prep', 'respondent', {})).toBe(false);
    expect(supportKindVisible('default_package', 'petitioner', {})).toBe(true);
  });

  test('shows the child-support worksheet only when children are on record', () => {
    expect(supportKindVisible('child_support_worksheet', 'petitioner', {})).toBe(false);
    expect(supportKindVisible('child_support_worksheet', 'respondent', { hasMinorChildren: true })).toBe(true);
    expect(supportKindVisible('child_support_worksheet', 'petitioner', { children: [{ name: 'Sam' }] })).toBe(true);
    expect(supportKindVisible('child_support_worksheet', 'petitioner', {
      children: [{ name: 'Adult child', dob: '1990-01-01' }],
    })).toBe(false);
  });
});

describe('pro se helpers', () => {
  const {
    advisorFlags,
    feeWaiverHint,
    waitingPeriodNote,
    buildTimeline: buildTl,
    groupFacts: group,
  } = require('@/components/app/lifeStory');

  test('advisorFlags fires on contested issues and safety, never dismissably empty', () => {
    expect(advisorFlags({})).toEqual([]);
    const flags = advisorFlags({
      custodyArrangement: 'contested',
      propertyAgreement: 'Contested',
      hasProtectiveOrder: true,
    });
    expect(flags.map((f: { key: string }) => f.key).sort()).toEqual([
      'custody',
      'property',
      'safety',
    ]);
  });

  test('feeWaiverHint uses income vs poverty guidelines by household size', () => {
    // 1 person, 150% of $15,650 = $23,475/yr ≈ $1,956/mo
    expect(feeWaiverHint({ monthlyIncome: 1800 })).toBe(true);
    expect(feeWaiverHint({ monthlyIncome: 2500 })).toBe(false);
    // household of 4 raises the threshold
    expect(feeWaiverHint({ monthlyIncome: 2500, dependentsCount: 3 })).toBe(true);
    // already pursuing a waiver — no hint needed
    expect(feeWaiverHint({ monthlyIncome: 1800, indigencyRequested: true })).toBe(false);
    expect(feeWaiverHint({})).toBe(false);
  });

  test('waitingPeriodNote computes earliest-decree from a filed event', () => {
    const now = new Date(2026, 6, 10);
    expect(waitingPeriodNote({}, 60, 'Texas', now)).toContain('60-day waiting period');
    const withFiling = {
      keyEvents: [{ label: 'Petition filed', date: '2026-06-20' }],
    };
    const note = waitingPeriodNote(withFiling, 60, 'Texas', now);
    expect(note).toContain('earliest a court could finalize');
    // waiting period already passed → nothing to flag
    const old = { keyEvents: [{ label: 'Filed', date: '2025-01-01' }] };
    expect(waitingPeriodNote(old, 60, 'Texas', now)).toBeNull();
    expect(waitingPeriodNote({}, null, 'Texas', now)).toBeNull();
  });

  test('buildTimeline includes court events and anchors without a marriage', () => {
    const now = new Date(2026, 6, 10);
    const t = buildTl(
      {
        marriageDate: '2010-05-01',
        keyEvents: [
          { label: 'Served', date: '2026-01-15', source: 'Petition served' },
          { label: 'Hearing', date: '2026-06-01' },
        ],
      },
      now,
    );
    const keys = t.majors.map((m: { label: string }) => m.label);
    expect(keys).toEqual(expect.arrayContaining(['Married', 'Served', 'Hearing']));
    // no marriage: anchors on earliest event instead of returning null
    const t2 = buildTl({ keyEvents: [{ label: 'Served', date: '2026-01-15' }] }, now);
    expect(t2).not.toBeNull();
    expect(t2.majors[0].label).toBe('Served');

    const spanish = buildTl(
      {
        keyEvents: [
          { label: 'Served', date: '2026-01-15' },
          { label: 'Petition for Divorce filed', date: '2026-02-15' },
        ],
      },
      now,
      'es',
    );
    expect(spanish.majors.map((m: { label: string }) => m.label)).toEqual(
      expect.arrayContaining(['Notificación', 'Petición de divorcio presentada']),
    );
  });

  test('groupFacts carries provenance from quotes and document sources', () => {
    const chapters = group([
      { content: 'I live in Texas.', category: 'residency', sourceQuote: 'I moved to Texas six years ago' },
      { content: 'The petition asks for joint custody.', category: 'response', source: 'Petition served on you' },
    ]);
    expect(chapters[0].facts[0].provenance).toContain('You said:');
    expect(chapters[1].facts[0].provenance).toBe('From: Petition served on you');
  });
});

describe('Spanish polish', () => {
  const { formatFriendlyDate: fmt, categoryLabel: cat, buildRecitals: recit } =
    require('@/components/app/lifeStory');
  test('dates localize to Spanish month names', () => {
    expect(fmt('2010-05-01')).toBe('May 1, 2010');
    expect(fmt('2010-05-01', 'es')).toBe('1 de mayo de 2010');
    expect(fmt('early spring', 'es')).toBe('early spring'); // verbatim passthrough
  });
  test('marriage chapter label exists in both languages', () => {
    expect(cat('marriage')).toBe('Your marriage');
    expect(cat('marriage', 'es')).toBe('Tu matrimonio');
  });
  test('Spanish recitals carry Spanish dates', () => {
    const r = recit({ marriageDate: '2010-05-01' }, 'es');
    const marriage = r.find((x: { id: string }) => x.id === 'marriage');
    const values = marriage.segments.filter((s: { kind: string }) => s.kind === 'value');
    expect(values.some((v: { text: string }) => v.text === '1 de mayo de 2010')).toBe(true);
  });
  test('extracted fact categories are localized, not title-cased English fallbacks', () => {
    expect(cat('temporal', 'es')).toBe('Cronología');
    expect(cat('communication', 'es')).toBe('Comunicaciones');
    expect(cat('separation', 'es')).toBe('Separación');
    expect(cat('property_debts', 'es')).toBe('Bienes y deudas');
    expect(cat('court', 'es')).toBe('Tribunal');
    expect(cat('case_number', 'es')).toBe('Número de caso');
    expect(cat(' Case number ', 'es')).toBe('Número de caso');
    expect(cat('property and debts', 'es')).toBe('Bienes y deudas');
    expect(cat('parties', 'es')).toBe('Partes del caso');
  });

  test('dynamic Utah next steps do not fall back to English', () => {
    const { getProcedure, computeNextSteps } = require('@/lib/api/procedure');
    const { localizeNextStep } = require('@/components/app/lifeStory');
    const procedure = getProcedure('UT');
    const profile = { serviceMethod: 'waiver' };
    const steps = computeNextSteps(profile, procedure, new Date(2026, 6, 13));
    const localized = steps.map((step: { key: string }) =>
      localizeNextStep(step, procedure, profile, 'petitioner', 'es'),
    );

    expect(localized.find((step: { key: string }) => step.key === 'serve').title).toBe(
      'Notifica a tu cónyuge',
    );
    expect(localized.find((step: { key: string }) => step.key === 'waiting').detail).toContain(
      'período de espera de 30 días',
    );
    expect(JSON.stringify(localized)).not.toContain('Serve your spouse');
    expect(JSON.stringify(localized)).not.toContain('Financial declaration');
  });
});
