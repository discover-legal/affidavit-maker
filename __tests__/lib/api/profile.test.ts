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
