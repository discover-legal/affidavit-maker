/** @jest-environment node */

import {
  buildRecitals,
  categoryLabel,
  computeAge,
  formatFriendlyDate,
  formatResidencyDuration,
  fullName,
  groupFacts,
  partitionFactsByState,
  spouseName,
  statesMentioned,
} from '@/components/app/lifeStory';

describe('formatResidencyDuration', () => {
  it('keeps short durations in months', () => {
    expect(formatResidencyDuration(1)).toBe('1 month');
    expect(formatResidencyDuration(18)).toBe('18 months');
    expect(formatResidencyDuration(23)).toBe('23 months');
  });

  it('humanizes 24+ months into years, with a months remainder', () => {
    expect(formatResidencyDuration(24)).toBe('2 years');
    expect(formatResidencyDuration(27)).toBe('2 years and 3 months');
    expect(formatResidencyDuration(144)).toBe('12 years');
    expect(formatResidencyDuration(145)).toBe('12 years and 1 month');
  });

  it('is bilingual and safe on junk', () => {
    expect(formatResidencyDuration(144, 'es')).toBe('12 años');
    expect(formatResidencyDuration(27, 'es')).toBe('2 años y 3 meses');
    expect(formatResidencyDuration(1, 'es')).toBe('1 mes');
    expect(formatResidencyDuration(0)).toBe('');
    expect(formatResidencyDuration(NaN)).toBe('');
  });
});

describe('fullName / spouseName (role-aware identity)', () => {
  const respondentProfile = {
    role: 'respondent',
    petitionerName: 'Alex Example',
    respondentName: 'Jordan S. Example',
  };
  test('respondent with captions only: self is the respondent, not the petitioner', () => {
    expect(fullName(respondentProfile)).toBe('Jordan S. Example');
    expect(spouseName(respondentProfile)).toBe('Alex Example');
  });
  test('affiantName always wins for self', () => {
    expect(fullName({ ...respondentProfile, affiantName: 'J. Example' })).toBe('J. Example');
  });
  test('missing role is treated as petitioner', () => {
    expect(fullName({ petitionerName: 'Avery Smith', respondentName: 'Sam Smith' }))
      .toBe('Avery Smith');
    expect(spouseName({ petitionerName: 'Avery Smith', respondentName: 'Sam Smith' }))
      .toBe('Sam Smith');
  });
  test('split caption fields and firstName/lastName fallbacks', () => {
    expect(fullName({ role: 'respondent', respondentFirstName: 'Jordan', respondentLastName: 'Example' }))
      .toBe('Jordan Example');
    expect(fullName({ firstName: 'Pat', lastName: 'Doe' })).toBe('Pat Doe');
  });
});

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

describe('buildRecitals identity is role-aware (uses the USER, not the caption)', () => {
  test('respondent-role profile: "Your name is" reads the respondent side / affiantName, not the petitioner caption', () => {
    const recitals = buildRecitals({
      role: 'respondent',
      affiantName: 'Marcus David Whitfield-Nuñez',
      petitionerName: 'Éloïse Marie Whitfield-Nuñez',
      respondentName: 'Marcus David Whitfield-Nuñez',
      spouseName: 'Éloïse Marie Whitfield-Nuñez',
      marriageDate: '2009-07-11',
    });
    const identity = recitals.find((r) => r.id === 'identity')!;
    const text = identity.segments.map((s) => s.text).join('');
    expect(text).toContain('Marcus David Whitfield-Nuñez');
    expect(text).not.toContain('Éloïse');

    const marriage = recitals.find((r) => r.id === 'marriage')!;
    const marriageText = marriage.segments.map((s) => s.text).join('');
    expect(marriageText).toContain('Éloïse Marie Whitfield-Nuñez');
  });
});

describe('buildRecitals', () => {
  test('always shows identity, marriage, and home — with blanks when unknown', () => {
    const recitals = buildRecitals({});
    expect(recitals.map((r) => r.id)).toEqual(['identity', 'marriage', 'home']);
    expect(recitals.every((r) => !r.known)).toBe(true);
    const identity = recitals[0].segments;
    // Empty-identity CTA reads as an invitation, not a duplicated fallback.
    expect(identity.some((s) => s.kind === 'blank' && s.text === 'Add your name')).toBe(true);
    expect(recitals[1].segments.map((s) => s.text).join('')).toContain('Your marriage details:');
  });

  test('normalizes a county value that already includes the County suffix', () => {
    const home = buildRecitals({ county: 'Salt Lake County', state: 'UT' })
      .find((r) => r.id === 'home');
    // The home recital renders full US state names ("Utah") over bare
    // 2-letter codes when we have the mapping.
    expect(home?.segments.map((s) => s.text).join('')).toBe('Home is Salt Lake County, Utah.');
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
        'Travis County, Texas',
        '4 years',
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

describe('own-vs-household income derivation', () => {
  const { userMonthlyIncome } = require('@/components/app/lifeStory');
  const flatten = (r: { segments: Array<{ text: string }> }) =>
    r.segments.map((s) => s.text).join('');
  const finances = (profile: Record<string, unknown>, lang?: 'en' | 'es') =>
    buildRecitals(profile, lang).find((r) => r.id === 'finances');

  const personaProfile = {
    monthlyIncome: 8600, // both spouses' wages — NOT the user's money
    monthlyExpenses: 3100,
    incomeBreakdown: [
      { label: 'My wages', amount: 3400, person: 'petitioner' },
      { label: 'Spouse wages', amount: 5200, person: 'respondent' },
    ],
  };

  test('recital narrates the USER\'s own income from the person-tagged breakdown', () => {
    const en = flatten(finances(personaProfile)!);
    expect(en).toContain('You bring in about $3,400 a month');
    expect(en).not.toContain('$8,600');
    const es = flatten(finances(personaProfile, 'es')!);
    expect(es).toContain('Ingresas unos $3,400 al mes');
    expect(es).not.toContain('$8,600');
  });

  test('a lone ambiguous scalar is framed as the household\'s, never the user\'s', () => {
    const en = flatten(finances({ monthlyIncome: 8600 })!);
    expect(en).toContain('About $8,600 a month comes into your household');
    const es = flatten(finances({ monthlyIncome: 8600 }, 'es')!);
    expect(es).toContain('Entran unos $8,600 al mes en tu hogar');
  });

  test('contract fields: monthlyIncome is the user\'s own once spouseMonthlyIncome exists', () => {
    expect(userMonthlyIncome({ monthlyIncome: 3400, spouseMonthlyIncome: 5200 }))
      .toEqual({ amount: 3400, scope: 'own' });
    expect(userMonthlyIncome({ monthlyIncome: 8600 }))
      .toEqual({ amount: 8600, scope: 'household' });
    expect(userMonthlyIncome({})).toBeNull();
    const en = flatten(finances({ monthlyIncome: 3400, spouseMonthlyIncome: 5200 })!);
    expect(en).toContain('You bring in about $3,400 a month');
  });

  test('person matching is role-aware for a respondent user', () => {
    expect(
      userMonthlyIncome({
        role: 'respondent',
        incomeBreakdown: [
          { label: 'Wages', amount: 3400, person: 'petitioner' },
          { label: 'Wages', amount: 5200, person: 'respondent' },
        ],
      }),
    ).toEqual({ amount: 5200, scope: 'own' });
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

describe('partitionFactsByState (Reno/NV must not linger on a CA profile)', () => {
  test('a bare "used to live in Reno" residency fact is superseded on a CA profile', () => {
    const facts = [
      { content: 'I used to live in Reno.', category: 'residency', subcategory: 'prior_residence' },
      { content: 'I live in San Jose, California.', category: 'residency' },
    ];
    const { current, superseded } = partitionFactsByState(facts, 'CA');
    // The Reno-only line moves out of the current bullets and into the
    // collapsible "Earlier notes" section; the CA line stays put.
    expect(current.map((f) => f.content)).toEqual(['I live in San Jose, California.']);
    expect(superseded.map((f) => f.content)).toEqual(['I used to live in Reno.']);
    // And that Reno fact is under the chapter groupings shown ONLY in the
    // superseded section — never in the "In your own words" chapters.
    const chapters = groupFacts(current);
    const supersededChapters = groupFacts(superseded);
    expect(chapters.some((c) => c.facts.some((f) => /reno/i.test(f.content)))).toBe(false);
    expect(
      supersededChapters.some((c) => c.facts.some((f) => /reno/i.test(f.content))),
    ).toBe(true);
  });

  test('a filing-category fact naming a non-current jurisdiction is partitioned', () => {
    const facts = [
      { content: 'Petition filed in Washoe County.', category: 'filing' },
    ];
    const { current, superseded } = partitionFactsByState(facts, 'CA');
    expect(current).toHaveLength(0);
    expect(superseded).toHaveLength(1);
  });

  test('statesMentioned reads city/county hints ("Reno", "Washoe" → NV)', () => {
    expect(statesMentioned('I used to live in Reno.').has('NV')).toBe(true);
    expect(statesMentioned('Filed in Washoe County').has('NV')).toBe(true);
    expect(statesMentioned('nothing here').size).toBe(0);
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

  test('moneyLeftover uses the USER\'s own income from a person-tagged breakdown', () => {
    // Household scalar says $8,600, but only $3,400 of it is the user's.
    expect(
      moneyLeftover({
        monthlyIncome: 8600,
        monthlyExpenses: 3100,
        incomeBreakdown: [
          { label: 'My wages', amount: 3400, person: 'petitioner' },
          { label: 'Spouse wages', amount: 5200, person: 'respondent' },
        ],
      }),
    ).toBe(300);
  });

  test('ledger distinguishes an explicit mutual waiver from mere absence', () => {
    const waived = {
      spousalSupportRequested: false,
      spousalSupportWaived: true,
    };
    const row = (profile: Record<string, unknown>, lang?: 'en' | 'es') =>
      buildLedger(profile, lang).find(
        (i: { key: string }) => i.key === 'spousal_support',
      ).value;
    expect(row(waived)).toBe('Waived (mutual)');
    expect(row(waived, 'es')).toBe('Renunciada (mutua)');
    // mere absence stays "Not requested"
    expect(row({ spousalSupportRequested: false })).toBe('Not requested');
    expect(row({ spousalSupportRequested: false }, 'es')).toBe('No solicitada');
    expect(row({})).toBeNull();
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

  test('feeWaiverHint keys on the USER\'s own income, not the household scalar', () => {
    // Household $8,600 would never hint; the user's own $1,800 does.
    expect(
      feeWaiverHint({
        monthlyIncome: 8600,
        incomeBreakdown: [
          { label: 'My wages', amount: 1800, person: 'petitioner' },
          { label: 'Spouse wages', amount: 6800, person: 'respondent' },
        ],
      }),
    ).toBe(true);
    // Own income over the guideline: no hint even with a low household scalar.
    expect(
      feeWaiverHint({
        monthlyIncome: 1800,
        incomeBreakdown: [
          { label: 'My wages', amount: 2500, person: 'petitioner' },
          { label: 'Spouse wages', amount: 100, person: 'respondent' },
        ],
      }),
    ).toBe(false);
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

describe('respondent affiantName safety-net', () => {
  test('affiantName === petitionerName on a respondent profile → falls back to respondent caption', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const profile = {
        role: 'respondent',
        // extraction bug: affiantName accidentally captured the petitioner
        affiantName: 'Éloïse Whitfield',
        petitionerName: 'Éloïse Whitfield',
        respondentName: 'Marcus Whitfield',
      };
      expect(fullName(profile)).toBe('Marcus Whitfield');
      expect(warn).toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });
});

describe('hasMinors / noMinors on record', () => {
  const { hasMinorsOnRecord, noMinorsOnRecord } = require('@/components/app/lifeStory');
  const now = new Date(2026, 6, 10);
  test('hasMinorChildren flag rules unambiguously', () => {
    expect(hasMinorsOnRecord({ hasMinorChildren: true })).toBe(true);
    expect(noMinorsOnRecord({ hasMinorChildren: false })).toBe(true);
  });
  test('all-adult children list → no minors on record', () => {
    const profile = { children: [{ name: 'Ada', dob: '1998-01-01' }] };
    expect(hasMinorsOnRecord(profile, now)).toBe(false);
    expect(noMinorsOnRecord(profile, now)).toBe(true);
  });
  test('mixed / unknown DOB counts as possibly-minor', () => {
    expect(hasMinorsOnRecord({ children: [{ name: 'x' }] }, now)).toBe(true);
    expect(noMinorsOnRecord({ children: [{ name: 'x' }] }, now)).toBe(false);
  });
});

describe('ledger suppresses custody / child-support when no minors', () => {
  const { buildLedger } = require('@/components/app/lifeStory');
  test('hasMinorChildren:false → no custody or child_support rows', () => {
    const keys = buildLedger({ hasMinorChildren: false }).map((i: { key: string }) => i.key);
    expect(keys).not.toContain('custody');
    expect(keys).not.toContain('child_support');
    // grounds / property / service etc. still render
    expect(keys).toContain('grounds');
  });
  test('all-adult children list → same suppression', () => {
    const items = buildLedger({ children: [{ name: 'A', dob: '1998-01-01' }] });
    const keys = items.map((i: { key: string }) => i.key);
    expect(keys).not.toContain('custody');
    expect(keys).not.toContain('child_support');
  });
  test('minor on record → rows render', () => {
    const items = buildLedger({ hasMinorChildren: true });
    const keys = items.map((i: { key: string }) => i.key);
    expect(keys).toContain('custody');
    expect(keys).toContain('child_support');
  });
});

describe('residency humanization applies to any jurisdiction', () => {
  test('Canadian profile: city + full province name + years, no "County"', () => {
    const home = buildRecitals({
      city: 'Oakville',
      state: 'ON',
      residencyStateMonths: 72,
    }).find((r) => r.id === 'home');
    const flat = home?.segments.map((s) => s.text).join('');
    expect(flat).toBe('Home is Oakville, Ontario — where you have lived for 6 years.');
  });
  test('reads alternate residency-months field names', () => {
    const home = buildRecitals({
      city: 'London',
      state: 'ON',
      residencyMonths: 27,
    }).find((r) => r.id === 'home');
    expect(home?.segments.map((s) => s.text).join('')).toContain(
      '2 years and 3 months',
    );
  });
  test('California: state code expands to full name', () => {
    const home = buildRecitals({ county: 'Alameda', state: 'CA' })
      .find((r) => r.id === 'home');
    expect(home?.segments.map((s) => s.text).join('')).toBe(
      'Home is Alameda County, California.',
    );
  });
});

describe('partitionFactsByState', () => {
  const { partitionFactsByState } = require('@/components/app/lifeStory');
  test('a residency fact mentioning NV is superseded on a CA profile', () => {
    const facts = [
      { content: 'I lived in Reno, Nevada for 12 years.', category: 'residency' },
      { content: 'I moved to Oakland in 2025.', category: 'residency' },
      { content: 'Filed in Washoe County, NV.', category: 'court' },
    ];
    const { current, superseded } = partitionFactsByState(facts, 'CA');
    expect(superseded).toHaveLength(2);
    expect(current).toHaveLength(1);
    expect(current[0].content).toContain('Oakland');
  });
  test('a fact that mentions BOTH the current state and another is superseded', () => {
    // Live CA acceptance run (2026-08): correction sentences like "I moved
    // from Reno, Nevada, to San Jose, California" and "use California as the
    // jurisdiction, not Nevada" mention the current state alongside the one
    // being corrected; keeping such facts in the current bullets recited the
    // superseded jurisdiction verbatim in the user's "In your own words"
    // chapters. Any mention of a non-current state now moves the fact into
    // the Earlier notes section — the affirmative CA-only fact
    // ("I live in San Jose, California") is the one that stays current.
    const facts = [
      { content: 'I moved from Nevada to California in 2024.', category: 'residency' },
    ];
    const { current, superseded } = partitionFactsByState(facts, 'CA');
    expect(current).toHaveLength(0);
    expect(superseded).toHaveLength(1);
  });

  test('the live CA correction bullets are moved to superseded', () => {
    // Reproducing the three CURRENT bullets that leaked through on
    // scratchpad/accept5-calcorr — a Reno→San Jose residency line
    // (residency), a "use California, not Nevada" line (jurisdiction),
    // and a "only California / no Nevada or Washoe" line (filing).
    // All three mention the current state alongside Nevada, and belong
    // in Earlier notes, not the current bullets.
    const facts = [
      {
        content:
          'I moved from Reno, Nevada, to San Jose, California, on June 20, 2025, and have lived in California for approximately 14 months.',
        category: 'residency',
      },
      {
        content: 'I want to use California as the jurisdiction for this case, not Nevada.',
        category: 'jurisdiction',
      },
      {
        content:
          'I want the final packet to reference only California, Santa Clara County, and California Judicial Council forms, with no references to Nevada, Washoe County, or Nevada forms.',
        category: 'filing',
      },
      // An affirmative, CA-only residency fact stays current.
      { content: 'I live in San Jose, California, in Santa Clara County.', category: 'residency' },
    ];
    const { current, superseded } = partitionFactsByState(facts, 'CA');
    expect(superseded).toHaveLength(3);
    expect(current).toHaveLength(1);
    expect(current[0].content).toContain('San Jose, California');
  });
  test('non-jurisdiction categories are never filtered', () => {
    const facts = [
      { content: 'Married in Reno, Nevada.', category: 'marriage' },
    ];
    const { current, superseded } = partitionFactsByState(facts, 'CA');
    expect(current).toHaveLength(1);
    expect(superseded).toHaveLength(0);
  });
  test('unknown current state → all facts pass through', () => {
    const facts = [{ content: 'anywhere', category: 'residency' }];
    expect(partitionFactsByState(facts, 'ZZ').superseded).toHaveLength(0);
    expect(partitionFactsByState(facts, '').superseded).toHaveLength(0);
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
