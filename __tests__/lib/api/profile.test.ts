/** @jest-environment node */

// Mock the DB layer — profile logic is exercised against an in-memory row.
const queryMock = jest.fn();
jest.mock('@/lib/db', () => ({
  query: (...args: unknown[]) => queryMock(...args),
}));
jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import {
  getUserProfile,
  hydrateAffidavitData,
  mergeUserProfile,
  type UserProfile,
} from '@/lib/api/profile';

beforeEach(() => {
  queryMock.mockReset();
});

describe('hydrateAffidavitData', () => {
  const stored: UserProfile = {
    profile: {
      firstName: 'Jordan',
      petitionerFirstName: 'Jordan',
      petitionerLastName: 'Example',
      marriageDate: '2010-05-01',
      state: 'TX',
      county: 'Travis',
      monthlyIncome: 5200,
      children: [
        { name: 'Emma', dob: '2015-04-02' },
        { name: 'Liam', dob: '2017-06-15' },
        { name: 'Ava', dob: '2019-09-09' },
      ],
    },
    facts: [{ id: '1', content: 'I was married in Texas.', category: 'general' }],
  };

  test('family scope fills family gaps from the stored profile', () => {
    const hydrated = hydrateAffidavitData(stored, {} as Record<string, unknown>, 'family');
    expect(hydrated.petitionerFirstName).toBe('Jordan');
    expect(hydrated.marriageDate).toBe('2010-05-01');
    expect((hydrated.children as unknown[]).length).toBe(3);
    expect((hydrated.facts as unknown[]).length).toBe(1);
  });

  test('general scope hydrates identity/finances but NOT family data', () => {
    const hydrated = hydrateAffidavitData(stored, {} as Record<string, unknown>, 'general');
    expect(hydrated.firstName).toBe('Jordan');
    expect(hydrated.monthlyIncome).toBe(5200);
    expect(hydrated.marriageDate).toBeUndefined();
    expect(hydrated.children).toBeUndefined();
    expect(hydrated.facts).toBeUndefined();
  });

  test('jurisdiction fields never hydrate — routing must be confirmed per document', () => {
    const hydrated = hydrateAffidavitData(stored, {} as Record<string, unknown>, 'family');
    expect(hydrated.state).toBeUndefined();
    expect(hydrated.county).toBeUndefined();
  });

  test('never overwrites what the current conversation already has', () => {
    const hydrated = hydrateAffidavitData(
      stored,
      {
        petitionerFirstName: 'Robert',
        facts: [{ id: '9', content: 'Fresh fact.' }],
      },
      'family',
    );
    expect(hydrated.petitionerFirstName).toBe('Robert');
    expect((hydrated.facts as { id: string }[])[0].id).toBe('9');
  });

  test('merges profile children with conversation children by identity', () => {
    const hydrated = hydrateAffidavitData(
      stored,
      { children: [{ name: 'Emma', age: 11 }] },
      'family',
    );
    const children = hydrated.children as { name: string }[];
    expect(children).toHaveLength(3);
    expect(children.map((c) => c.name).sort()).toEqual(['Ava', 'Emma', 'Liam']);
  });
});

describe('getUserProfile', () => {
  test('returns empty profile when no row exists', async () => {
    queryMock.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    const profile = await getUserProfile(42);
    expect(profile).toEqual({ profile: {}, facts: [] });
  });

  test('tolerates malformed stored JSON shapes', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ profile: 'junk', facts: 'junk' }], rowCount: 1 });
    const profile = await getUserProfile(42);
    expect(profile).toEqual({ profile: {}, facts: [] });
  });
});

describe('mergeUserProfile', () => {
  test('accumulates fields, merges children, and dedupes facts', async () => {
    // First call: read existing row.
    queryMock.mockResolvedValueOnce({
      rows: [
        {
          profile: {
            petitionerFirstName: 'Jordan',
            children: [{ name: 'Emma', dob: '2015-04-02' }],
          },
          facts: [{ id: '1', content: 'I was married in Texas.' }],
        },
      ],
      rowCount: 1,
    });
    // Second call: upsert.
    queryMock.mockResolvedValueOnce({ rows: [], rowCount: 1 });

    await mergeUserProfile(
      7,
      {
        marriageDate: '2010-05-01',
        petitionerFirstName: '', // empty must not erase the stored value
        children: [{ name: 'Liam', dob: '2017-06-15' }],
        documentType: 'divorce_package', // per-document — must NOT be stored
        orchestratorState: { currentPhase: 'CHILDREN' }, // must NOT be stored
        facts: [
          { id: '1', content: 'I was married in   Texas.' }, // dupe (whitespace/case-insensitive)
          { id: '2', content: 'We separated in 2024.' },
        ],
      },
      [{ id: '3', content: 'We have three children.' }],
    );

    expect(queryMock).toHaveBeenCalledTimes(2);
    const [sql, params] = queryMock.mock.calls[1] as [string, unknown[]];
    expect(sql).toContain('INSERT INTO user_profiles');
    expect(params[0]).toBe(7);

    const savedProfile = JSON.parse(params[1] as string);
    expect(savedProfile.petitionerFirstName).toBe('Jordan');
    expect(savedProfile.marriageDate).toBe('2010-05-01');
    expect(savedProfile.children.map((c: { name: string }) => c.name).sort()).toEqual([
      'Emma',
      'Liam',
    ]);
    expect(savedProfile.documentType).toBeUndefined();
    expect(savedProfile.orchestratorState).toBeUndefined();

    const savedFacts = JSON.parse(params[2] as string);
    expect(savedFacts.map((f: { id: string }) => f.id).sort()).toEqual(['1', '2', '3']);
  });
});

describe('mergeUserProfile — numberOfChildren round-trip (v9-D fix)', () => {
  test('a stated child count survives the merge as a durable family field', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ profile: {}, facts: [] }], rowCount: 1 });
    queryMock.mockResolvedValueOnce({ rows: [], rowCount: 1 });

    await mergeUserProfile(7, { numberOfChildren: 2 });

    const [, params] = queryMock.mock.calls[1] as [string, unknown[]];
    const savedProfile = JSON.parse(params[1] as string);
    expect(savedProfile.numberOfChildren).toBe(2);
  });
});

describe('mergeUserProfile fact retirement (retiredFactStatements)', () => {
  const readRow = (facts: unknown[]) => ({
    rows: [{ profile: {}, facts }],
    rowCount: 1,
  });
  const savedFacts = () => {
    const params = queryMock.mock.calls[1][1] as unknown[];
    return JSON.parse(params[2] as string) as Array<{ id?: string; content?: string }>;
  };

  test('retires the matched stored fact and blocks re-entry from the conversation sweep', async () => {
    queryMock.mockResolvedValueOnce(
      readRow([
        { id: 'old', content: 'Daniel Hatch and I separated at the end of February 2026.' },
        { id: 'keep', content: 'I married Daniel Hatch in Provo on February 14, 2012.' },
      ]),
    );
    queryMock.mockResolvedValueOnce({ rows: [], rowCount: 1 });

    await mergeUserProfile(
      7,
      {
        retiredFactStatements: ['Daniel Hatch and I separated at the end of February 2026.'],
        // Conversation sweep still carries the stale card — it must not re-enter.
        facts: [
          { id: 'old', content: 'Daniel Hatch and I separated at the end of February 2026.' },
          { id: 'new', content: 'Daniel Hatch moved out on March 1, 2026.' },
        ],
      },
      [{ id: 'new', content: 'Daniel Hatch moved out on March 1, 2026.' }],
    );

    const facts = savedFacts();
    expect(facts.map((f) => f.id).sort()).toEqual(['keep', 'new']);
  });

  test('unmatched retirement statements retire nothing', async () => {
    queryMock.mockResolvedValueOnce(
      readRow([{ id: 'a', content: 'I live in Salt Lake County, Utah.' }]),
    );
    queryMock.mockResolvedValueOnce({ rows: [], rowCount: 1 });

    await mergeUserProfile(7, {
      retiredFactStatements: ['a statement matching nothing that is stored'],
    });

    expect(savedFacts().map((f) => f.id)).toEqual(['a']);
  });

  test('respects the per-turn retirement cap', async () => {
    const stored = Array.from({ length: 5 }, (_, i) => ({
      id: String(i),
      content: `This is recorded fact number ${i} about the marriage.`,
    }));
    queryMock.mockResolvedValueOnce(readRow(stored));
    queryMock.mockResolvedValueOnce({ rows: [], rowCount: 1 });

    await mergeUserProfile(7, {
      retiredFactStatements: stored.map((f) => f.content), // 5 asked, ≤3 honored
    });

    expect(savedFacts()).toHaveLength(2);
  });

  test('retiredFactStatements itself is never stored on the profile', async () => {
    queryMock.mockResolvedValueOnce(readRow([]));
    queryMock.mockResolvedValueOnce({ rows: [], rowCount: 1 });
    await mergeUserProfile(7, { retiredFactStatements: ['whatever statement here'] });
    const params = queryMock.mock.calls[1][1] as unknown[];
    const savedProfile = JSON.parse(params[1] as string);
    expect(savedProfile.retiredFactStatements).toBeUndefined();
  });
});

describe('mergeUserProfile breakdown dedupe', () => {
  const readRow = (profile: Record<string, unknown>) => ({
    rows: [{ profile, facts: [] }],
    rowCount: 1,
  });
  const savedProfile = () => {
    const params = queryMock.mock.calls[1][1] as unknown[];
    return JSON.parse(params[1] as string);
  };

  test('merging the same breakdown twice yields one entry per item', async () => {
    queryMock.mockResolvedValueOnce(readRow({}));
    queryMock.mockResolvedValueOnce({ rows: [], rowCount: 1 });

    await mergeUserProfile(7, {
      incomeBreakdown: [
        { label: 'My wages', amount: 3400, person: 'petitioner' },
        { label: 'My  Wages', amount: 3400, person: 'petitioner' }, // dupe (case/whitespace)
        { label: 'Spouse wages', amount: 5200, person: 'respondent' },
      ],
    });

    const saved = savedProfile();
    expect(saved.incomeBreakdown).toHaveLength(2);
    const petitioner = saved.incomeBreakdown.filter(
      (e: { person?: string }) => e.person === 'petitioner',
    );
    expect(petitioner).toHaveLength(1);
    expect(petitioner[0].amount).toBe(3400); // per-person sum reads 1×, not 2×
  });

  test('a corrected amount for the same (person, label) replaces rather than duplicates', async () => {
    queryMock.mockResolvedValueOnce(readRow({}));
    queryMock.mockResolvedValueOnce({ rows: [], rowCount: 1 });

    await mergeUserProfile(7, {
      incomeBreakdown: [
        { label: 'My wages', amount: 3400, person: 'petitioner' },
        { label: 'My wages', amount: 3600, person: 'petitioner' }, // correction — latest wins
      ],
    });

    const saved = savedProfile();
    expect(saved.incomeBreakdown).toEqual([
      { label: 'My wages', amount: 3600, person: 'petitioner' },
    ]);
  });

  test('scrubs pre-existing duplicate rows even on turns that do not touch the breakdown', async () => {
    queryMock.mockResolvedValueOnce(
      readRow({
        expenseBreakdown: [
          { label: 'Mortgage', amount: 1450 },
          { label: 'Mortgage', amount: 1450 },
          { label: 'Groceries', amount: 700 },
        ],
      }),
    );
    queryMock.mockResolvedValueOnce({ rows: [], rowCount: 1 });

    await mergeUserProfile(7, { marriageDate: '2012-02-14' });

    const saved = savedProfile();
    expect(saved.expenseBreakdown).toHaveLength(2);
  });
});

describe('spouseMonthlyIncome is a durable general field', () => {
  test('hydrates in general scope and never holds a household total by contract', () => {
    const hydrated = hydrateAffidavitData(
      { profile: { monthlyIncome: 3400, spouseMonthlyIncome: 5200 }, facts: [] },
      {} as Record<string, unknown>,
      'general',
    );
    expect(hydrated.monthlyIncome).toBe(3400);
    expect(hydrated.spouseMonthlyIncome).toBe(5200);
  });

  test('mergeUserProfile stores spouseMonthlyIncome', async () => {
    queryMock.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    queryMock.mockResolvedValueOnce({ rows: [], rowCount: 1 });
    await mergeUserProfile(7, { monthlyIncome: 3400, spouseMonthlyIncome: 5200 });
    const params = queryMock.mock.calls[1][1] as unknown[];
    const saved = JSON.parse(params[1] as string);
    expect(saved.monthlyIncome).toBe(3400);
    expect(saved.spouseMonthlyIncome).toBe(5200);
  });
});

describe('mergeUserProfile replaceChildren', () => {
  test('replacement lets an explicit removal propagate to the profile', async () => {
    queryMock.mockResolvedValueOnce({
      rows: [
        {
          profile: {
            children: [
              { name: 'Emma', dob: '2015-04-02' },
              { name: 'Liam', dob: '2017-06-15' },
            ],
          },
          facts: [],
        },
      ],
      rowCount: 1,
    });
    queryMock.mockResolvedValueOnce({ rows: [], rowCount: 1 });

    // Conversation was family-hydrated, user removed Liam mid-interview.
    await mergeUserProfile(7, { children: [{ name: 'Emma', dob: '2015-04-02' }] }, [], {
      replaceChildren: true,
    });

    const params = queryMock.mock.calls[1][1] as unknown[];
    const savedProfile = JSON.parse(params[1] as string);
    expect(savedProfile.children.map((c: { name: string }) => c.name)).toEqual(['Emma']);
  });
});

describe('updateUserProfile (fix my story)', () => {
  test('sets fields verbatim, clears empties, replaces children', async () => {
    const { updateUserProfile } = require('@/lib/api/profile');
    queryMock.mockResolvedValueOnce({
      rows: [
        {
          profile: {
            affiantName: 'Jordan Example',
            separationDate: '2024-11-15',
            children: [{ name: 'Emma', dob: '2015-04-02' }, { name: 'Liam', dob: '2017-06-15' }],
          },
          facts: [],
        },
      ],
      rowCount: 1,
    });
    queryMock.mockResolvedValueOnce({ rows: [], rowCount: 1 });

    await updateUserProfile(7, {
      affiantName: 'Jordan S. Example',
      separationDate: '', // explicit clear
      children: [{ name: 'Emma', dob: '2015-04-03' }], // replacement
      documentType: 'divorce_package', // not whitelisted — ignored
    });

    const params = queryMock.mock.calls[1][1] as unknown[];
    const saved = JSON.parse(params[1] as string);
    expect(saved.affiantName).toBe('Jordan S. Example');
    expect(saved.separationDate).toBeUndefined();
    expect(saved.children).toHaveLength(1);
    expect(saved.children[0].dob).toBe('2015-04-03');
    expect(saved.documentType).toBeUndefined();
  });
});

describe('party reconciliation (spouseName + role + captions)', () => {
  const readRow = (profile: Record<string, unknown>) => ({
    rows: [{ profile, facts: [] }],
    rowCount: 1,
  });
  const savedProfile = (call = 1) => {
    const params = queryMock.mock.calls[call][1] as unknown[];
    return JSON.parse(params[1] as string);
  };

  test('flipping to respondent swaps the captions instead of marrying the user to themself', async () => {
    const { updateUserProfile } = require('@/lib/api/profile');
    // Petitioner-drafted profile: the user IS the petitioner in the captions.
    queryMock.mockResolvedValueOnce(
      readRow({
        affiantName: 'Jordan Example',
        petitionerName: 'Jordan Example',
        petitionerFirstName: 'Jordan',
        petitionerLastName: 'Example',
        respondentName: 'Alex Example',
        respondentFirstName: 'Alex',
        respondentLastName: 'Example',
      }),
    );
    queryMock.mockResolvedValueOnce({ rows: [], rowCount: 1 });

    // Getting served flips the role — nothing else in the patch.
    await updateUserProfile(7, { role: 'respondent' });

    const saved = savedProfile();
    expect(saved.spouseName).toBe('Alex Example');
    expect(saved.petitionerName).toBe('Alex Example');
    expect(saved.petitionerFirstName).toBe('Alex');
    expect(saved.respondentName).toBe('Jordan Example');
    expect(saved.respondentLastName).toBe('Example');
  });

  test('merge derives canonical spouseName from an interview that wrote caption fields', async () => {
    queryMock.mockResolvedValueOnce(readRow({ affiantName: 'Jordan Example' }));
    queryMock.mockResolvedValueOnce({ rows: [], rowCount: 1 });

    await mergeUserProfile(7, {
      petitionerName: 'Jordan Example',
      respondentName: 'Alex Example',
    });

    expect(savedProfile().spouseName).toBe('Alex Example');
  });

  test('a corrected caption name outranks the stored spouseName', async () => {
    queryMock.mockResolvedValueOnce(
      readRow({
        affiantName: 'Jordan Example',
        spouseName: 'Alex Example',
        respondentName: 'Alex Example',
      }),
    );
    queryMock.mockResolvedValueOnce({ rows: [], rowCount: 1 });

    await mergeUserProfile(7, { respondentName: 'Alexandra Example' });

    const saved = savedProfile();
    expect(saved.spouseName).toBe('Alexandra Example');
    expect(saved.respondentName).toBe('Alexandra Example');
  });

  test('never adopts the user themself as spouse, even from a confused write', async () => {
    queryMock.mockResolvedValueOnce(
      readRow({
        affiantName: 'Jordan Example',
        role: 'respondent',
        spouseName: 'Alex Example',
      }),
    );
    queryMock.mockResolvedValueOnce({ rows: [], rowCount: 1 });

    // An interview that assumes user = petitioner writes their own name into
    // the petitioner slot; under role=respondent that slot reads as spouse.
    await mergeUserProfile(7, { petitionerName: 'Jordan Example' });

    const saved = savedProfile();
    expect(saved.spouseName).toBe('Alex Example');
    expect(saved.petitionerName).toBe('Alex Example');
    expect(saved.respondentName).toBe('Jordan Example');
  });

  test('an explicitly named same-named spouse is accepted (the Taylor Lautner case)', async () => {
    const { updateUserProfile } = require('@/lib/api/profile');
    queryMock.mockResolvedValueOnce(readRow({ affiantName: 'Taylor Lautner' }));
    queryMock.mockResolvedValueOnce({ rows: [], rowCount: 1 });

    // Spouses can legally share a full name; an explicit edit is trusted.
    await updateUserProfile(7, { spouseName: 'Taylor Lautner' });

    const saved = savedProfile();
    expect(saved.spouseName).toBe('Taylor Lautner');
    expect(saved.petitionerName).toBe('Taylor Lautner');
    expect(saved.respondentName).toBe('Taylor Lautner');
  });

  test('a stored same-named spouse survives later writes untouched', async () => {
    queryMock.mockResolvedValueOnce(
      readRow({ affiantName: 'Taylor Lautner', spouseName: 'Taylor Lautner' }),
    );
    queryMock.mockResolvedValueOnce({ rows: [], rowCount: 1 });

    await mergeUserProfile(7, { marriageDate: '2022-11-11' });

    expect(savedProfile().spouseName).toBe('Taylor Lautner');
  });

  test('respondent-role merge round-trip stores affiantName=user, spouseName=filer, and mirrored captions', async () => {
    // The orchestrator, on our fixed path, sends affiantName as the USER's
    // own side (respondent) alongside role='respondent'. Profile merge must
    // preserve that instead of clobbering affiantName from the petitioner
    // caption. Ontario Marcus replay end-to-end.
    queryMock.mockResolvedValueOnce({ rows: [{ profile: {}, facts: [] }], rowCount: 1 });
    queryMock.mockResolvedValueOnce({ rows: [], rowCount: 1 });

    await mergeUserProfile(7, {
      role: 'respondent',
      affiantName: 'Marcus David Whitfield-Nuñez',
      petitionerName: 'Éloïse Marie Whitfield-Nuñez',
      petitionerFirstName: 'Éloïse Marie',
      petitionerLastName: 'Whitfield-Nuñez',
      respondentName: 'Marcus David Whitfield-Nuñez',
      respondentFirstName: 'Marcus David',
      respondentLastName: 'Whitfield-Nuñez',
    });

    const saved = savedProfile();
    expect(saved.role).toBe('respondent');
    expect(saved.affiantName).toBe('Marcus David Whitfield-Nuñez');
    expect(saved.spouseName).toBe('Éloïse Marie Whitfield-Nuñez');
    expect(saved.petitionerName).toBe('Éloïse Marie Whitfield-Nuñez');
    expect(saved.respondentName).toBe('Marcus David Whitfield-Nuñez');
  });

  test('an explicit blank spouseName clears the spouse and their caption side', async () => {
    const { updateUserProfile } = require('@/lib/api/profile');
    queryMock.mockResolvedValueOnce(
      readRow({
        affiantName: 'Jordan Example',
        spouseName: 'Alex Example',
        petitionerName: 'Jordan Example',
        respondentName: 'Alex Example',
      }),
    );
    queryMock.mockResolvedValueOnce({ rows: [], rowCount: 1 });

    await updateUserProfile(7, { spouseName: '' });

    const saved = savedProfile();
    expect(saved.spouseName).toBeUndefined();
    expect(saved.respondentName).toBeUndefined();
    expect(saved.petitionerName).toBe('Jordan Example');
  });
});

describe('names are stored as given (LLM-first casing — no deterministic transform)', () => {
  const emptyRow = { rows: [{ profile: {}, facts: [] }], rowCount: 1 };
  const savedProfile = (call = 1) => {
    const params = queryMock.mock.calls[call][1] as unknown[];
    return JSON.parse(params[1] as string);
  };

  test('merge stores name fields verbatim — casing is the model layer\'s job', async () => {
    queryMock.mockResolvedValueOnce(emptyRow);
    queryMock.mockResolvedValueOnce({ rows: [], rowCount: 1 });

    await mergeUserProfile(7, {
      affiantName: 'Ronald McDonald',
      spouseName: 'Anne van der Berg',
    });

    const saved = savedProfile();
    expect(saved.affiantName).toBe('Ronald McDonald');
    expect(saved.spouseName).toBe('Anne van der Berg');
    // Captions derived by reconcileParties (default role: petitioner).
    expect(saved.petitionerName).toBe('Ronald McDonald');
    expect(saved.petitionerLastName).toBe('McDonald');
    expect(saved.respondentName).toBe('Anne van der Berg');
    expect(saved.respondentLastName).toBe('van der Berg');
  });

  test('children merge is case-insensitive on identity; the incoming name wins as typed', async () => {
    queryMock.mockResolvedValueOnce({
      rows: [
        {
          profile: { children: [{ name: 'Emma Example', dob: '2015-04-02' }] },
          facts: [],
        },
      ],
      rowCount: 1,
    });
    queryMock.mockResolvedValueOnce({ rows: [], rowCount: 1 });

    // Same child typed lowercase must merge (not duplicate); the incoming
    // spelling is stored as typed — plain last-write, no deterministic casing.
    await mergeUserProfile(7, { children: [{ name: 'emma example', age: 11 }] });

    const saved = savedProfile();
    expect(saved.children).toHaveLength(1);
    expect(saved.children[0].name).toBe('emma example');
    expect(saved.children[0].age).toBe(11);
  });
});

describe('appendKeyEvents', () => {
  test('dedupes by label+date and preserves existing events', async () => {
    const { appendKeyEvents } = require('@/lib/api/profile');
    const existingRow = {
      rows: [
        {
          profile: { keyEvents: [{ label: 'Served', date: '2026-01-15' }] },
          facts: [],
        },
      ],
      rowCount: 1,
    };
    queryMock.mockResolvedValueOnce(existingRow); // appendKeyEvents read
    queryMock.mockResolvedValueOnce(existingRow); // updateUserProfile read
    queryMock.mockResolvedValueOnce({ rows: [], rowCount: 1 }); // upsert

    await appendKeyEvents(7, [
      { label: 'Served', date: '2026-01-15' }, // dupe
      { label: 'Hearing', date: '2026-06-01', source: 'Notice' },
    ]);

    const params = queryMock.mock.calls[2][1] as unknown[];
    const saved = JSON.parse(params[1] as string);
    expect(saved.keyEvents).toHaveLength(2);
    expect(saved.keyEvents[1]).toEqual({ label: 'Hearing', date: '2026-06-01', source: 'Notice' });
  });
});

describe('mergeUserProfile breakdown replace-per-person', () => {
  const readRow = (profile: Record<string, unknown>) => ({
    rows: [{ profile, facts: [] }],
    rowCount: 1,
  });
  const savedProfile = () => {
    const params = queryMock.mock.calls[1][1] as unknown[];
    return JSON.parse(params[1] as string);
  };

  test('the katie2 label-variant restatement REPLACES the person\'s stored entry — one 3,400 entry, not two', async () => {
    queryMock.mockResolvedValueOnce(
      readRow({
        incomeBreakdown: [
          { label: "Katie O'Brien-Hatch wages as office manager at dental office", amount: 3400, person: 'petitioner' },
          { label: 'Daniel Hatch wages as HVAC technician', amount: 5200, person: 'respondent' },
        ],
      }),
    );
    queryMock.mockResolvedValueOnce({ rows: [], rowCount: 1 });

    await mergeUserProfile(7, {
      incomeBreakdown: [
        { label: "Kathleen O'Brien-Hatch wages as office manager at a dental office", amount: 3400, person: 'petitioner' },
      ],
    });

    const saved = savedProfile();
    const petitioner = saved.incomeBreakdown.filter(
      (e: { person?: string }) => e.person === 'petitioner',
    );
    expect(petitioner).toHaveLength(1);
    expect(petitioner[0].amount).toBe(3400);
    // The respondent was not mentioned this turn — entry untouched.
    const respondent = saved.incomeBreakdown.filter(
      (e: { person?: string }) => e.person === 'respondent',
    );
    expect(respondent).toHaveLength(1);
    // Role-aware totals recomputed from the merged breakdown.
    expect(saved.monthlyIncome).toBe(3400);
    expect(saved.spouseMonthlyIncome).toBe(5200);
  });

  test('recomputed totals override a stale doubled scalar from the document', async () => {
    queryMock.mockResolvedValueOnce(readRow({}));
    queryMock.mockResolvedValueOnce({ rows: [], rowCount: 1 });

    await mergeUserProfile(7, {
      monthlyIncome: 6800, // the corrupted doc scalar (2× the real wage)
      spouseMonthlyIncome: 10400,
      incomeBreakdown: [
        { label: 'My wages', amount: 3400, person: 'petitioner' },
        { label: 'Spouse wages', amount: 5200, person: 'respondent' },
      ],
    });

    const saved = savedProfile();
    expect(saved.monthlyIncome).toBe(3400);
    expect(saved.spouseMonthlyIncome).toBe(5200);
  });

  test('a respondent-role user\'s own total comes from respondent entries', async () => {
    queryMock.mockResolvedValueOnce(readRow({ role: 'respondent' }));
    queryMock.mockResolvedValueOnce({ rows: [], rowCount: 1 });

    await mergeUserProfile(7, {
      incomeBreakdown: [
        { label: 'My wages', amount: 5200, person: 'respondent' },
        { label: 'Spouse wages', amount: 3400, person: 'petitioner' },
      ],
    });

    const saved = savedProfile();
    expect(saved.monthlyIncome).toBe(5200);
    expect(saved.spouseMonthlyIncome).toBe(3400);
  });

  test('expense mirror: incoming list replaces and monthlyExpenses is recomputed', async () => {
    queryMock.mockResolvedValueOnce(
      readRow({
        expenseBreakdown: [
          { label: 'Rent', amount: 1200 },
          { label: 'Groceries', amount: 650 },
        ],
        monthlyExpenses: 1850,
      }),
    );
    queryMock.mockResolvedValueOnce({ rows: [], rowCount: 1 });

    await mergeUserProfile(7, {
      expenseBreakdown: [
        { label: 'Mortgage', amount: 1450 },
        { label: 'Groceries', amount: 700 },
        { label: 'Utilities', amount: 300 },
      ],
    });

    const saved = savedProfile();
    expect(saved.expenseBreakdown.map((e: { label: string }) => e.label)).toEqual([
      'Mortgage',
      'Groceries',
      'Utilities',
    ]);
    expect(saved.monthlyExpenses).toBe(2450);
  });
});

describe('mergeUserProfile property/debt replace-per-person', () => {
  const readRow = (profile: Record<string, unknown>) => ({
    rows: [{ profile, facts: [] }],
    rowCount: 1,
  });
  const savedProfile = () => {
    const params = queryMock.mock.calls[1][1] as unknown[];
    return JSON.parse(params[1] as string);
  };

  test('the incoming petitioner list REPLACES the stored petitioner list, respondent list untouched', () => {
    // Fire-and-forget style keeps the test terse; behaviour verified by the
    // final `savedProfile()` read below.
    return (async () => {
      queryMock.mockResolvedValueOnce(readRow({
        petitionerProperty: ['old stale item that the correction supersedes'],
        respondentProperty: ['2021 Toyota Tacoma'],
      }));
      queryMock.mockResolvedValueOnce({ rows: [], rowCount: 1 });

      await mergeUserProfile(7, {
        petitionerProperty: [
          '2019 Honda Odyssey',
          'the marital home at 1487 E Sycamore Way',
          'Fidelity 401(k), approximately $62,000',
        ],
      });

      const saved = savedProfile();
      expect(saved.petitionerProperty).toEqual([
        '2019 Honda Odyssey',
        'the marital home at 1487 E Sycamore Way',
        'Fidelity 401(k), approximately $62,000',
      ]);
      expect(saved.respondentProperty).toEqual(['2021 Toyota Tacoma']);
    })();
  });

  test('same-turn label-variant restatements collapse (Sudsy Snouts) — 3 stored, not 6', async () => {
    queryMock.mockResolvedValueOnce(readRow({}));
    queryMock.mockResolvedValueOnce({ rows: [], rowCount: 1 });

    await mergeUserProfile(7, {
      petitionerProperty: [
        '$18k dog-grooming business',
        'the mobile dog-grooming business worth $18k',
        '2021 Toyota Tacoma',
      ],
    });

    const saved = savedProfile();
    expect(saved.petitionerProperty).toEqual([
      'the mobile dog-grooming business worth $18k',
      '2021 Toyota Tacoma',
    ]);
  });

  test('separate-property marker persists through merge (Mari\'s $45k inherited CD)', async () => {
    queryMock.mockResolvedValueOnce(readRow({}));
    queryMock.mockResolvedValueOnce({ rows: [], rowCount: 1 });

    await mergeUserProfile(7, {
      petitionerProperty: [
        'Separate property: $45,000 certificate of deposit inherited from Aunt Rita in 2018, held in Mari\'s sole name',
        'the marital home at 1487 E Sycamore Way',
      ],
    });

    const saved = savedProfile();
    expect(saved.petitionerProperty[0]).toMatch(/^Separate property: /);
    expect(saved.petitionerProperty[0]).toMatch(/inherited from Aunt Rita/);
    expect(saved.petitionerProperty).toHaveLength(2);
  });

  test('negative-equity phrasing survives merge intact', async () => {
    queryMock.mockResolvedValueOnce(readRow({}));
    queryMock.mockResolvedValueOnce({ rows: [], rowCount: 1 });

    await mergeUserProfile(7, {
      respondentProperty: [
        'the marital home at 87 Ridgemount Crescent, currently underwater by approximately $22,000',
      ],
    });

    const saved = savedProfile();
    expect(saved.respondentProperty[0]).toMatch(/underwater by approximately \$22,000/);
  });
});

describe('spousal support waiver persistence (katie2 gap)', () => {
  test('spousalSupportWaived and its sibling gate fields persist through mergeUserProfile', async () => {
    queryMock.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    queryMock.mockResolvedValueOnce({ rows: [], rowCount: 1 });

    await mergeUserProfile(7, {
      spousalSupportRequested: false,
      spousalSupportWaived: true,
      spousalSupportAwarded: false,
      requestSpousalSupport: false,
    });

    const params = queryMock.mock.calls[1][1] as unknown[];
    const saved = JSON.parse(params[1] as string);
    expect(saved.spousalSupportWaived).toBe(true);
    expect(saved.spousalSupportRequested).toBe(false);
    expect(saved.spousalSupportAwarded).toBe(false);
    expect(saved.requestSpousalSupport).toBe(false);
  });

  test('respondent whereabouts-unknown fields persist through mergeUserProfile and hydrate in family scope only (Mari v8b)', async () => {
    // The TX petition template branches on these STRUCTURED fields to
    // render the alt-service caveat instead of an empty "is a resident of ."
    // clause. v8b replay: Mari's profile.json had NEITHER field even though
    // the interview captured a hedged whereabouts fact — the durable side
    // must survive a DB round-trip once the model does emit them.
    queryMock.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    queryMock.mockResolvedValueOnce({ rows: [], rowCount: 1 });

    await mergeUserProfile(42, {
      respondentAddressUnknown: true,
      respondentSuspectedLocation: 'Louisiana or Mississippi',
    });

    const params = queryMock.mock.calls[1][1] as unknown[];
    const saved = JSON.parse(params[1] as string);
    expect(saved.respondentAddressUnknown).toBe(true);
    expect(saved.respondentSuspectedLocation).toBe('Louisiana or Mississippi');

    // Family scope hydration re-seeds a new session so the caveat keeps
    // rendering across documents; general scope must NOT contaminate a
    // small-claims or name-change interview with a divorce whereabouts flag.
    const stored: UserProfile = {
      profile: {
        respondentAddressUnknown: true,
        respondentSuspectedLocation: 'Louisiana or Mississippi',
      },
      facts: [],
    };
    const family = hydrateAffidavitData(stored, {} as Record<string, unknown>, 'family');
    expect(family.respondentAddressUnknown).toBe(true);
    expect(family.respondentSuspectedLocation).toBe('Louisiana or Mississippi');

    const general = hydrateAffidavitData(stored, {} as Record<string, unknown>, 'general');
    expect(general.respondentAddressUnknown).toBeUndefined();
    expect(general.respondentSuspectedLocation).toBeUndefined();
  });

  test('spousalSupportWaived hydrates in family scope but not general scope', () => {
    const stored: UserProfile = {
      profile: { spousalSupportWaived: true, spousalSupportAwarded: false, requestSpousalSupport: false },
      facts: [],
    };
    const family = hydrateAffidavitData(stored, {} as Record<string, unknown>, 'family');
    expect(family.spousalSupportWaived).toBe(true);
    expect(family.requestSpousalSupport).toBe(false);

    const general = hydrateAffidavitData(stored, {} as Record<string, unknown>, 'general');
    expect(general.spousalSupportWaived).toBeUndefined();
  });
});

// v10-B backstop: promote a schema-typed "respondent_whereabouts" fact
// subcategory to the structured respondentAddressUnknown flag when Luna
// records the fact but skips the boolean. Pure shape check on fact metadata —
// no language parsing of the content string.
describe('mergeUserProfile — respondent whereabouts fact promotion', () => {
  test('promotes subcategory=respondent_whereabouts to respondentAddressUnknown=true', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ profile: {}, facts: [] }], rowCount: 1 });
    queryMock.mockResolvedValueOnce({ rows: [], rowCount: 1 });

    await mergeUserProfile(
      7,
      {
        facts: [
          {
            id: 'f1',
            content: 'The user has not seen the respondent in months.',
            category: 'service',
            subcategory: 'respondent_whereabouts',
          },
        ],
      },
    );

    const [, params] = queryMock.mock.calls[1] as [string, unknown[]];
    const savedProfile = JSON.parse(params[1] as string);
    expect(savedProfile.respondentAddressUnknown).toBe(true);
  });

  test('promotes when the whereabouts fact arrives via the newFacts arg', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ profile: {}, facts: [] }], rowCount: 1 });
    queryMock.mockResolvedValueOnce({ rows: [], rowCount: 1 });

    await mergeUserProfile(
      7,
      {},
      [
        {
          id: 'f1',
          content: 'possibly in Louisiana',
          category: 'service',
          subcategory: 'respondent_whereabouts',
        },
      ],
    );

    const [, params] = queryMock.mock.calls[1] as [string, unknown[]];
    const savedProfile = JSON.parse(params[1] as string);
    expect(savedProfile.respondentAddressUnknown).toBe(true);
  });

  test('does NOT overwrite an explicit respondentAddressUnknown=false the LLM emitted this turn', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ profile: {}, facts: [] }], rowCount: 1 });
    queryMock.mockResolvedValueOnce({ rows: [], rowCount: 1 });

    await mergeUserProfile(
      7,
      {
        respondentAddressUnknown: false,
        facts: [
          { id: 'f1', content: 'anything', category: 'service', subcategory: 'respondent_whereabouts' },
        ],
      },
    );

    const [, params] = queryMock.mock.calls[1] as [string, unknown[]];
    const savedProfile = JSON.parse(params[1] as string);
    // Structured field is authoritative when present — the promotion is a
    // backstop for the missing-flag case, not an override of an explicit
    // emission.
    expect(savedProfile.respondentAddressUnknown).toBe(false);
  });

  test('no fact of that subcategory → respondentAddressUnknown stays unset', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ profile: {}, facts: [] }], rowCount: 1 });
    queryMock.mockResolvedValueOnce({ rows: [], rowCount: 1 });

    await mergeUserProfile(
      7,
      {
        facts: [
          { id: 'f1', content: 'unrelated', category: 'marriage', subcategory: 'ceremony' },
        ],
      },
    );

    const [, params] = queryMock.mock.calls[1] as [string, unknown[]];
    const savedProfile = JSON.parse(params[1] as string);
    expect(savedProfile.respondentAddressUnknown).toBeUndefined();
  });
});

// v11-B: schema-typed fact companions promoted into structured scalars.
// Pure shape check on fact metadata (subcategory + place_value / numeric_value)
// — no language parsing of the content prose.
describe('mergeUserProfile — schema-typed fact companion promotion', () => {
  const readEmpty = () => ({ rows: [{ profile: {}, facts: [] }], rowCount: 1 });
  const savedProfile = () => {
    const [, params] = queryMock.mock.calls[1] as [string, unknown[]];
    return JSON.parse(params[1] as string);
  };

  test('subcategory=respondent_whereabouts + place_value promotes respondentSuspectedLocation', async () => {
    queryMock.mockResolvedValueOnce(readEmpty());
    queryMock.mockResolvedValueOnce({ rows: [], rowCount: 1 });

    await mergeUserProfile(7, {
      facts: [
        {
          id: 'f1',
          content: 'The respondent is possibly in Louisiana or Mississippi.',
          category: 'service',
          subcategory: 'respondent_whereabouts',
          place_value: 'Louisiana or Mississippi',
        },
      ],
    });

    expect(savedProfile().respondentSuspectedLocation).toBe('Louisiana or Mississippi');
  });

  test('accepts the stored placeValue camelCase shape too (fact came via _buildFacts)', async () => {
    queryMock.mockResolvedValueOnce(readEmpty());
    queryMock.mockResolvedValueOnce({ rows: [], rowCount: 1 });

    await mergeUserProfile(
      7,
      {},
      [
        {
          id: 'f1',
          content: 'The respondent is possibly in Louisiana or Mississippi.',
          category: 'service',
          subcategory: 'respondent_whereabouts',
          placeValue: 'Louisiana or Mississippi',
        } as never,
      ],
    );

    expect(savedProfile().respondentSuspectedLocation).toBe('Louisiana or Mississippi');
  });

  test('category=children + numeric_value=2 promotes numberOfChildren', async () => {
    queryMock.mockResolvedValueOnce(readEmpty());
    queryMock.mockResolvedValueOnce({ rows: [], rowCount: 1 });

    await mergeUserProfile(7, {
      facts: [
        {
          id: 'f1',
          content: 'The parties have two adult children.',
          category: 'children',
          numeric_value: 2,
        },
      ],
    });

    expect(savedProfile().numberOfChildren).toBe(2);
  });

  test('an explicit structured value wins over promotion (structured field authoritative when present)', async () => {
    queryMock.mockResolvedValueOnce(readEmpty());
    queryMock.mockResolvedValueOnce({ rows: [], rowCount: 1 });

    await mergeUserProfile(7, {
      respondentSuspectedLocation: 'Ohio',
      numberOfChildren: 3,
      facts: [
        {
          id: 'f1',
          content: 'possibly Louisiana',
          category: 'service',
          subcategory: 'respondent_whereabouts',
          place_value: 'Louisiana',
        },
        {
          id: 'f2',
          content: 'two kids',
          category: 'children',
          numeric_value: 2,
        },
      ],
    });

    const saved = savedProfile();
    expect(saved.respondentSuspectedLocation).toBe('Ohio');
    expect(saved.numberOfChildren).toBe(3);
  });

  test('category=grounds + grounds_value=cruel_treatment promotes groundsForDivorce (v21-A)', async () => {
    queryMock.mockResolvedValueOnce(readEmpty());
    queryMock.mockResolvedValueOnce({ rows: [], rowCount: 1 });

    await mergeUserProfile(7, {
      facts: [
        {
          id: 'f1',
          content: 'Amara has experienced documented cruelty at the hands of her spouse.',
          category: 'grounds',
          subcategory: 'grounds',
          grounds_value: 'cruel_treatment',
        },
      ],
    });

    expect(savedProfile().groundsForDivorce).toBe('cruel_treatment');
  });

  test('accepts the stored groundsValue camelCase shape too (fact came via _buildFacts)', async () => {
    queryMock.mockResolvedValueOnce(readEmpty());
    queryMock.mockResolvedValueOnce({ rows: [], rowCount: 1 });

    await mergeUserProfile(
      7,
      {},
      [
        {
          id: 'f1',
          content: 'David narrates an irretrievable breakdown of the marriage.',
          category: 'grounds',
          groundsValue: 'irretrievable_breakdown',
        } as never,
      ],
    );

    expect(savedProfile().groundsForDivorce).toBe('irretrievable_breakdown');
  });

  test('explicit groundsForDivorce wins over grounds fact promotion', async () => {
    queryMock.mockResolvedValueOnce(readEmpty());
    queryMock.mockResolvedValueOnce({ rows: [], rowCount: 1 });

    await mergeUserProfile(7, {
      groundsForDivorce: 'adultery',
      facts: [
        {
          id: 'f1',
          content: 'cruelty narrated',
          category: 'grounds',
          grounds_value: 'cruel_treatment',
        },
      ],
    });

    expect(savedProfile().groundsForDivorce).toBe('adultery');
  });

  test('forbidden sentinel "other" is overwritten by promoted grounds_value (v22-A, Amara)', async () => {
    queryMock.mockResolvedValueOnce(readEmpty());
    queryMock.mockResolvedValueOnce({ rows: [], rowCount: 1 });

    await mergeUserProfile(7, {
      groundsForDivorce: 'other',
      facts: [
        {
          id: 'f1',
          content: 'Amara has experienced documented cruelty at the hands of her spouse.',
          category: 'grounds',
          grounds_value: 'cruel_treatment',
        },
      ],
    });

    expect(savedProfile().groundsForDivorce).toBe('cruel_treatment');
  });

  test('forbidden sentinel "unknown" is overwritten by promoted grounds_value (v22-A)', async () => {
    queryMock.mockResolvedValueOnce(readEmpty());
    queryMock.mockResolvedValueOnce({ rows: [], rowCount: 1 });

    await mergeUserProfile(7, {
      groundsForDivorce: 'unknown',
      facts: [
        {
          id: 'f1',
          content: 'David narrates an irretrievable breakdown of the marriage.',
          category: 'grounds',
          grounds_value: 'irretrievable_breakdown',
        },
      ],
    });

    expect(savedProfile().groundsForDivorce).toBe('irretrievable_breakdown');
  });

  test('forbidden sentinel with NO grounds fact clears the field to absent (v22-A)', async () => {
    queryMock.mockResolvedValueOnce(readEmpty());
    queryMock.mockResolvedValueOnce({ rows: [], rowCount: 1 });

    await mergeUserProfile(7, { groundsForDivorce: 'n/a' });

    expect(savedProfile().groundsForDivorce).toBeUndefined();
  });

  test('mixed-case sentinel ("Other") is also normalized (v22-A)', async () => {
    queryMock.mockResolvedValueOnce(readEmpty());
    queryMock.mockResolvedValueOnce({ rows: [], rowCount: 1 });

    await mergeUserProfile(7, {
      groundsForDivorce: 'Other',
      facts: [
        {
          id: 'f1',
          content: 'cruelty narrated',
          category: 'grounds',
          grounds_value: 'cruel_treatment',
        },
      ],
    });

    expect(savedProfile().groundsForDivorce).toBe('cruel_treatment');
  });

  test('no companion value on the fact → no promotion (leaves the scalar unset)', async () => {
    queryMock.mockResolvedValueOnce(readEmpty());
    queryMock.mockResolvedValueOnce({ rows: [], rowCount: 1 });

    await mergeUserProfile(7, {
      facts: [
        {
          id: 'f1',
          content: 'not seen him in months',
          category: 'service',
          subcategory: 'respondent_whereabouts',
          // no place_value
        },
        {
          id: 'f2',
          content: 'we have some kids',
          category: 'children',
          // no numeric_value
        },
      ],
    });

    const saved = savedProfile();
    expect(saved.respondentSuspectedLocation).toBeUndefined();
    expect(saved.numberOfChildren).toBeUndefined();
  });
});

// Tavita (FL, no kids) backstop: has_minor_children:false without a paired
// number_of_children left profile.numberOfChildren null on the story page.
describe('mergeUserProfile — "no children" backstop', () => {
  const readEmpty = () => ({ rows: [{ profile: {}, facts: [] }], rowCount: 1 });
  const savedProfile = () => {
    const [, params] = queryMock.mock.calls[1] as [string, unknown[]];
    return JSON.parse(params[1] as string);
  };

  test('hasMinorChildren=false + no numberOfChildren + no children[] → numberOfChildren=0', async () => {
    queryMock.mockResolvedValueOnce(readEmpty());
    queryMock.mockResolvedValueOnce({ rows: [], rowCount: 1 });

    await mergeUserProfile(7, { hasMinorChildren: false });

    expect(savedProfile().numberOfChildren).toBe(0);
  });

  test('explicit numberOfChildren wins — backstop never overrides', async () => {
    queryMock.mockResolvedValueOnce(readEmpty());
    queryMock.mockResolvedValueOnce({ rows: [], rowCount: 1 });

    await mergeUserProfile(7, { hasMinorChildren: false, numberOfChildren: 2 });

    expect(savedProfile().numberOfChildren).toBe(2);
  });

  test('hasMinorChildren=true does NOT trigger the backstop', async () => {
    queryMock.mockResolvedValueOnce(readEmpty());
    queryMock.mockResolvedValueOnce({ rows: [], rowCount: 1 });

    await mergeUserProfile(7, { hasMinorChildren: true });

    expect(savedProfile().numberOfChildren).toBeUndefined();
  });

  test('hasMinorChildren unset (turn did not touch it) does NOT trigger the backstop', async () => {
    queryMock.mockResolvedValueOnce(readEmpty());
    queryMock.mockResolvedValueOnce({ rows: [], rowCount: 1 });

    await mergeUserProfile(7, { marriageDate: '2010-05-01' });

    expect(savedProfile().numberOfChildren).toBeUndefined();
  });

  // Alison (CA, 2 adult children) replay: LLM tagged the fact with
  // subcategory=adult_children and carried numeric_value=2, but the strict
  // v11-B match (=== 'children') let it through unpromoted. Backstop also
  // fires on hasMinorChildren=false, but a 2-adult-children case must
  // promote to 2, never fall back to the 0 backstop.
  test('hasMinorChildren=false + adult_children fact numeric_value=2 → numberOfChildren=2', async () => {
    queryMock.mockResolvedValueOnce(readEmpty());
    queryMock.mockResolvedValueOnce({ rows: [], rowCount: 1 });

    await mergeUserProfile(7, {
      hasMinorChildren: false,
      facts: [
        {
          id: 'f1',
          content: 'The parties have two adult children together.',
          category: 'children',
          subcategory: 'adult_children',
          numeric_value: 2,
        },
      ],
    });

    expect(savedProfile().numberOfChildren).toBe(2);
  });

  // Same shape but the profile's stored hasMinorChildren is explicit null
  // (an older merge cleared it) rather than false, and the incoming turn
  // does not touch children. The backstop must still fire so the story
  // page never renders "null children".
  test('stored hasMinorChildren=null + no children data → numberOfChildren=0', async () => {
    queryMock.mockResolvedValueOnce({
      rows: [{ profile: { hasMinorChildren: null }, facts: [] }],
      rowCount: 1,
    });
    queryMock.mockResolvedValueOnce({ rows: [], rowCount: 1 });

    await mergeUserProfile(7, { marriageDate: '2010-05-01' });

    expect(savedProfile().numberOfChildren).toBe(0);
  });

  // An adult-children fact without numeric_value must NOT trigger the
  // zero-backstop — the promoter will populate numeric_value on a later
  // pass and the count should stick then.
  test('adult_children fact without numeric_value suppresses the zero-backstop', async () => {
    queryMock.mockResolvedValueOnce(readEmpty());
    queryMock.mockResolvedValueOnce({ rows: [], rowCount: 1 });

    await mergeUserProfile(7, {
      hasMinorChildren: false,
      facts: [
        {
          id: 'f1',
          content: 'The parties have adult children.',
          category: 'children',
          subcategory: 'adult_children',
        },
      ],
    });

    const saved = savedProfile();
    expect(saved.numberOfChildren).toBeUndefined();
  });

  test('children[] present suppresses the backstop (an adult-child list must not become 0)', async () => {
    queryMock.mockResolvedValueOnce(readEmpty());
    queryMock.mockResolvedValueOnce({ rows: [], rowCount: 1 });

    await mergeUserProfile(7, {
      hasMinorChildren: false,
      children: [{ name: 'Adult Child', age: 24 }],
    });

    const saved = savedProfile();
    expect(saved.numberOfChildren).toBeUndefined();
    expect(saved.children).toHaveLength(1);
  });

  // v22-B: widened isChildrenCountFact matches Tavita's parental /
  // children_of_marriage tagging. Without an openAIService the merge-time
  // rescue LLM silently skips, so numberOfChildren stays undefined for a
  // fact-only signal — but the widened tag match is exercised (no crash).
  test('parental/children_of_marriage fact is recognized as a children-count fact', async () => {
    queryMock.mockResolvedValueOnce(readEmpty());
    queryMock.mockResolvedValueOnce({ rows: [], rowCount: 1 });

    await mergeUserProfile(7, {
      facts: [
        {
          id: 'f1',
          content: 'Marco Rossi and I have no children from this marriage.',
          category: 'parental',
          subcategory: 'children_of_marriage',
        },
      ],
    });

    // No LLM mocked → rescue skipped, backstop suppressed (fact matches),
    // stays undefined. The point of the test is that the widened tag match
    // does not throw and the flow completes.
    const saved = savedProfile();
    expect(saved.numberOfChildren).toBeUndefined();
  });
});

// v22-B: merge-time rescue LLM call for numberOfChildren. Mirrors the
// existing respondentSuspectedLocation rescue pattern (fail-open, LLM-first).
describe('mergeUserProfile — numberOfChildren rescue LLM', () => {
  const readEmpty = () => ({ rows: [{ profile: {}, facts: [] }], rowCount: 1 });
  const savedProfile = () => {
    const [, params] = queryMock.mock.calls[1] as [string, unknown[]];
    return JSON.parse(params[1] as string);
  };
  afterEach(() => {
    delete (global as unknown as { openAIService?: unknown }).openAIService;
  });

  // Alison-shape: adult_children fact, NO numeric_value on the fact, NO
  // structured numberOfChildren. The rescue LLM reads the fact prose /
  // sourceQuote and returns count=2.
  test('Alison-shape adult_children fact WITHOUT numeric_value → rescue promotes to 2', async () => {
    queryMock.mockResolvedValueOnce(readEmpty());
    queryMock.mockResolvedValueOnce({ rows: [], rowCount: 1 });

    const chat = jest.fn(async (
      _msgs: unknown,
      options: { response_format?: { json_schema?: { name?: string } } },
    ) => {
      if (options?.response_format?.json_schema?.name === 'children_count_extraction') {
        return {
          choices: [{ message: { content: JSON.stringify({ count: 2 }) } }],
        };
      }
      throw new Error('unexpected rescue call');
    });
    (global as unknown as { openAIService: unknown }).openAIService = { chat };

    await mergeUserProfile(7, {
      hasMinorChildren: false,
      facts: [
        {
          id: 'f1',
          content: 'The parties have two children of the marriage, ages 24 and 21; both children are adults.',
          sourceQuote: 'we have 2 adult kids, 24 and 21',
          category: 'children',
          subcategory: 'adult_children',
        },
      ],
    });

    expect(chat).toHaveBeenCalledTimes(1);
    const saved = savedProfile();
    expect(saved.numberOfChildren).toBe(2);
  });

  // Tavita-shape: parental/children_of_marriage fact, "no children" prose,
  // no hasMinorChildren emitted. Rescue extracts count=0 AND fills
  // hasMinorChildren=false.
  test('Tavita-shape "no children" fact → rescue promotes to 0 and fills hasMinorChildren=false', async () => {
    queryMock.mockResolvedValueOnce(readEmpty());
    queryMock.mockResolvedValueOnce({ rows: [], rowCount: 1 });

    const chat = jest.fn(async () => ({
      choices: [{ message: { content: JSON.stringify({ count: 0 }) } }],
    }));
    (global as unknown as { openAIService: unknown }).openAIService = { chat };

    await mergeUserProfile(7, {
      facts: [
        {
          id: 'f1',
          content: 'Marco Rossi and I have no children from this marriage.',
          sourceQuote: 'no children — none from this marriage',
          category: 'parental',
          subcategory: 'children_of_marriage',
        },
      ],
    });

    const saved = savedProfile();
    expect(saved.numberOfChildren).toBe(0);
    expect(saved.hasMinorChildren).toBe(false);
  });

  // Rescue returns -1 when the text does not name a count — profile stays
  // absent, downstream backstops still get a chance.
  test('rescue returns -1 → numberOfChildren stays absent', async () => {
    queryMock.mockResolvedValueOnce(readEmpty());
    queryMock.mockResolvedValueOnce({ rows: [], rowCount: 1 });

    const chat = jest.fn(async () => ({
      choices: [{ message: { content: JSON.stringify({ count: -1 }) } }],
    }));
    (global as unknown as { openAIService: unknown }).openAIService = { chat };

    await mergeUserProfile(7, {
      facts: [
        {
          id: 'f1',
          content: 'We had a long conversation about the kids.',
          category: 'children',
          subcategory: 'children',
        },
      ],
    });

    const saved = savedProfile();
    expect(saved.numberOfChildren).toBeUndefined();
  });

  // Explicit numberOfChildren always wins — rescue never fires.
  test('explicit numberOfChildren wins — rescue never invoked', async () => {
    queryMock.mockResolvedValueOnce(readEmpty());
    queryMock.mockResolvedValueOnce({ rows: [], rowCount: 1 });

    const chat = jest.fn();
    (global as unknown as { openAIService: unknown }).openAIService = { chat };

    await mergeUserProfile(7, {
      numberOfChildren: 3,
      facts: [
        {
          id: 'f1',
          content: 'The parties have three children.',
          category: 'children',
          subcategory: 'children',
        },
      ],
    });

    expect(chat).not.toHaveBeenCalled();
    const saved = savedProfile();
    expect(saved.numberOfChildren).toBe(3);
  });

  // Rescue LLM throws → fail-open (no crash, numberOfChildren stays absent).
  test('rescue LLM throws → fails open', async () => {
    queryMock.mockResolvedValueOnce(readEmpty());
    queryMock.mockResolvedValueOnce({ rows: [], rowCount: 1 });

    const chat = jest.fn(async () => { throw new Error('llm down'); });
    (global as unknown as { openAIService: unknown }).openAIService = { chat };

    await expect(
      mergeUserProfile(7, {
        facts: [
          {
            id: 'f1',
            content: 'The parties have two children.',
            category: 'children',
            subcategory: 'adult_children',
          },
        ],
      }),
    ).resolves.not.toThrow();

    const saved = savedProfile();
    expect(saved.numberOfChildren).toBeUndefined();
  });
});

// v22-C: merge-time rescue LLM call for groundsForDivorce. Mirrors the
// respondentSuspectedLocation and numberOfChildren rescues (fail-open,
// LLM-first, jurisdiction-aware). Amara (GA) and Mari (TX) replays: a
// grounds fact clearly exists but the primary schema call and the v20-B
// companion promoter both left grounds_value empty.
describe('mergeUserProfile — groundsForDivorce rescue LLM', () => {
  const readEmpty = () => ({ rows: [{ profile: {}, facts: [] }], rowCount: 1 });
  const savedProfile = () => {
    const [, params] = queryMock.mock.calls[1] as [string, unknown[]];
    return JSON.parse(params[1] as string);
  };
  afterEach(() => {
    delete (global as unknown as { openAIService?: unknown }).openAIService;
  });

  // Mari-shape: state=TX, sentinel "other" stored plus a cruelty grounds fact
  // with no grounds_value. Rescue should map to cruel_treatment (or the
  // jurisdiction's equivalent).
  test('Mari-shape TX "cruelty" grounds fact → rescue promotes to canonical slug', async () => {
    queryMock.mockResolvedValueOnce(readEmpty());
    queryMock.mockResolvedValueOnce({ rows: [], rowCount: 1 });

    const chat = jest.fn(async (
      _msgs: unknown,
      options: { response_format?: { json_schema?: { name?: string } } },
    ) => {
      if (options?.response_format?.json_schema?.name === 'grounds_extraction') {
        return {
          choices: [{ message: { content: JSON.stringify({ grounds_slug: 'cruel_treatment' }) } }],
        };
      }
      throw new Error('unexpected rescue call');
    });
    (global as unknown as { openAIService: unknown }).openAIService = { chat };

    await mergeUserProfile(7, {
      state: 'TX',
      groundsForDivorce: 'other',
      facts: [
        {
          id: 'f1',
          content: 'grounds — cruelty. he hurt me physically',
          sourceQuote: 'he hurt me physically, over years',
          category: 'grounds',
          subcategory: 'grounds',
        },
      ],
    });

    expect(chat).toHaveBeenCalledTimes(1);
    const saved = savedProfile();
    expect(saved.groundsForDivorce).toBe('cruel_treatment');
  });

  // Amara-shape: state=GA, groundsForDivorce null, "documented cruelty" fact.
  test('Amara-shape GA "documented cruelty" fact → rescue promotes to cruel_treatment', async () => {
    queryMock.mockResolvedValueOnce(readEmpty());
    queryMock.mockResolvedValueOnce({ rows: [], rowCount: 1 });

    const chat = jest.fn(async () => ({
      choices: [{ message: { content: JSON.stringify({ grounds_slug: 'cruel_treatment' }) } }],
    }));
    (global as unknown as { openAIService: unknown }).openAIService = { chat };

    await mergeUserProfile(7, {
      state: 'GA',
      facts: [
        {
          id: 'f1',
          content: 'Documented cruelty by the respondent — years of abuse.',
          sourceQuote: 'documented cruelty',
          category: 'grounds',
          subcategory: 'grounds',
        },
      ],
    });

    const saved = savedProfile();
    expect(saved.groundsForDivorce).toBe('cruel_treatment');
  });

  // Explicit valid slug wins — rescue never fires.
  test('explicit valid groundsForDivorce wins — rescue never invoked', async () => {
    queryMock.mockResolvedValueOnce(readEmpty());
    queryMock.mockResolvedValueOnce({ rows: [], rowCount: 1 });

    const chat = jest.fn();
    (global as unknown as { openAIService: unknown }).openAIService = { chat };

    await mergeUserProfile(7, {
      state: 'NY',
      groundsForDivorce: 'adultery',
      facts: [
        {
          id: 'f1',
          content: 'Grounds narrative — long story.',
          category: 'grounds',
          subcategory: 'grounds',
        },
      ],
    });

    expect(chat).not.toHaveBeenCalled();
    const saved = savedProfile();
    expect(saved.groundsForDivorce).toBe('adultery');
  });

  // No grounds fact at all → rescue skipped (nothing to extract from).
  test('no grounds fact → rescue skipped', async () => {
    queryMock.mockResolvedValueOnce(readEmpty());
    queryMock.mockResolvedValueOnce({ rows: [], rowCount: 1 });

    const chat = jest.fn();
    (global as unknown as { openAIService: unknown }).openAIService = { chat };

    await mergeUserProfile(7, {
      state: 'CA',
      facts: [
        {
          id: 'f1',
          content: 'We were married in Sacramento.',
          category: 'marriage',
          subcategory: 'ceremony',
        },
      ],
    });

    expect(chat).not.toHaveBeenCalled();
    const saved = savedProfile();
    expect(saved.groundsForDivorce).toBeUndefined();
  });

  // Rescue returns "" (no substance) → grounds stays absent.
  test('rescue returns empty slug → groundsForDivorce stays absent', async () => {
    queryMock.mockResolvedValueOnce(readEmpty());
    queryMock.mockResolvedValueOnce({ rows: [], rowCount: 1 });

    const chat = jest.fn(async () => ({
      choices: [{ message: { content: JSON.stringify({ grounds_slug: '' }) } }],
    }));
    (global as unknown as { openAIService: unknown }).openAIService = { chat };

    await mergeUserProfile(7, {
      state: 'GA',
      facts: [
        {
          id: 'f1',
          content: 'We talked at length about the case.',
          category: 'grounds',
          subcategory: 'grounds',
        },
      ],
    });

    const saved = savedProfile();
    expect(saved.groundsForDivorce).toBeUndefined();
  });

  // Rescue LLM throws → fail-open.
  test('rescue LLM throws → fails open', async () => {
    queryMock.mockResolvedValueOnce(readEmpty());
    queryMock.mockResolvedValueOnce({ rows: [], rowCount: 1 });

    const chat = jest.fn(async () => { throw new Error('llm down'); });
    (global as unknown as { openAIService: unknown }).openAIService = { chat };

    await expect(
      mergeUserProfile(7, {
        state: 'TX',
        facts: [
          {
            id: 'f1',
            content: 'grounds — cruelty. he hurt me physically',
            category: 'grounds',
            subcategory: 'grounds',
          },
        ],
      }),
    ).resolves.not.toThrow();

    const saved = savedProfile();
    expect(saved.groundsForDivorce).toBeUndefined();
  });

  // Rescue returning a sentinel slug is refused — never re-poison the field.
  test('rescue returns sentinel slug → groundsForDivorce stays absent', async () => {
    queryMock.mockResolvedValueOnce(readEmpty());
    queryMock.mockResolvedValueOnce({ rows: [], rowCount: 1 });

    const chat = jest.fn(async () => ({
      choices: [{ message: { content: JSON.stringify({ grounds_slug: 'unknown' }) } }],
    }));
    (global as unknown as { openAIService: unknown }).openAIService = { chat };

    await mergeUserProfile(7, {
      state: 'GA',
      facts: [
        {
          id: 'f1',
          content: 'grounds — the situation.',
          category: 'grounds',
          subcategory: 'grounds',
        },
      ],
    });

    const saved = savedProfile();
    expect(saved.groundsForDivorce).toBeUndefined();
  });
});

// v23: Luna occasionally tags a grounds narration with a non-'grounds'
// category (Amara GA replay: {category:'evidence', subcategory:'cruel_treatment'}
// — the model classified the ground by putting the statutory slug on the
// subcategory instead). The isGroundsFact predicate must still recognize
// those so the companion-value promotion and the rescue LLM can fill
// profile.groundsForDivorce.
describe('mergeUserProfile — statutory-ground subcategory (v23)', () => {
  const readEmpty = () => ({ rows: [{ profile: {}, facts: [] }], rowCount: 1 });
  const savedProfile = () => {
    const [, params] = queryMock.mock.calls[1] as [string, unknown[]];
    return JSON.parse(params[1] as string);
  };
  const savedFacts = () => {
    const [, params] = queryMock.mock.calls[1] as [string, unknown[]];
    return JSON.parse(params[2] as string);
  };

  test('category=evidence + subcategory=cruel_treatment + grounds_value → groundsForDivorce=cruel_treatment', async () => {
    queryMock.mockResolvedValueOnce(readEmpty());
    queryMock.mockResolvedValueOnce({ rows: [], rowCount: 1 });

    await mergeUserProfile(7, {
      facts: [
        {
          id: 'f1',
          content: 'Malachi physically abused Amara throughout the marriage.',
          category: 'evidence',
          subcategory: 'cruel_treatment',
          grounds_value: 'cruel_treatment',
        },
      ],
    });

    expect(savedProfile().groundsForDivorce).toBe('cruel_treatment');
  });

  test('category=evidence + subcategory=cruel_treatment (no companion) → rescue LLM fires and fills grounds', async () => {
    queryMock.mockResolvedValueOnce(readEmpty());
    queryMock.mockResolvedValueOnce({ rows: [], rowCount: 1 });

    const chat = jest.fn(async () => ({
      choices: [{ message: { content: JSON.stringify({ grounds_slug: 'cruel_treatment' }) } }],
    }));
    (global as unknown as { openAIService: unknown }).openAIService = { chat };

    await mergeUserProfile(7, {
      state: 'GA',
      facts: [
        {
          id: 'f1',
          content: 'Malachi physically abused Amara throughout the marriage.',
          sourceQuote: 'he hit me',
          category: 'evidence',
          subcategory: 'cruel_treatment',
        },
      ],
    });

    expect(chat).toHaveBeenCalled();
    expect(savedProfile().groundsForDivorce).toBe('cruel_treatment');
  });

  test('evidence-category fact IS persisted end-to-end (no category filter drops it)', async () => {
    queryMock.mockResolvedValueOnce(readEmpty());
    queryMock.mockResolvedValueOnce({ rows: [], rowCount: 1 });

    await mergeUserProfile(7, {
      facts: [
        {
          id: 'f1',
          content: 'Malachi physically abused Amara throughout the marriage.',
          category: 'evidence',
          subcategory: 'cruel_treatment',
        },
        {
          id: 'f2',
          content: 'Second cruelty incident on 2024-06-14.',
          category: 'evidence',
          subcategory: 'cruel_treatment',
        },
      ],
    });

    const facts = savedFacts();
    expect(facts).toHaveLength(2);
    expect(facts.map((f: { category: string }) => f.category)).toEqual(['evidence', 'evidence']);
  });

  test.each([
    ['adultery'],
    ['abandonment'],
    ['desertion'],
    ['insupportability'],
    ['irretrievable_breakdown'],
    ['irreconcilable_differences'],
    ['felony'],
    ['imprisonment'],
    ['breakdown_of_marriage'],
    ['separation_agreement'],
  ])('subcategory=%s (any category) still matches isGroundsFact and promotes', async (sub) => {
    queryMock.mockResolvedValueOnce(readEmpty());
    queryMock.mockResolvedValueOnce({ rows: [], rowCount: 1 });

    await mergeUserProfile(7, {
      facts: [
        {
          id: 'f1',
          content: `narrated ${sub}`,
          category: 'fault',
          subcategory: sub,
          grounds_value: sub,
        },
      ],
    });

    expect(savedProfile().groundsForDivorce).toBe(sub);
  });
});
