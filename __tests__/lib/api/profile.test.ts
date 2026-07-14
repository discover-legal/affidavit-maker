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
      firstName: 'Brandon',
      petitionerFirstName: 'Brandon',
      petitionerLastName: 'Pritchard',
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
    expect(hydrated.petitionerFirstName).toBe('Brandon');
    expect(hydrated.marriageDate).toBe('2010-05-01');
    expect((hydrated.children as unknown[]).length).toBe(3);
    expect((hydrated.facts as unknown[]).length).toBe(1);
  });

  test('general scope hydrates identity/finances but NOT family data', () => {
    const hydrated = hydrateAffidavitData(stored, {} as Record<string, unknown>, 'general');
    expect(hydrated.firstName).toBe('Brandon');
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
            petitionerFirstName: 'Brandon',
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
    expect(savedProfile.petitionerFirstName).toBe('Brandon');
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
            affiantName: 'Brandon Pritchard',
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
      affiantName: 'Brandon S. Pritchard',
      separationDate: '', // explicit clear
      children: [{ name: 'Emma', dob: '2015-04-03' }], // replacement
      documentType: 'divorce_package', // not whitelisted — ignored
    });

    const params = queryMock.mock.calls[1][1] as unknown[];
    const saved = JSON.parse(params[1] as string);
    expect(saved.affiantName).toBe('Brandon S. Pritchard');
    expect(saved.separationDate).toBeUndefined();
    expect(saved.children).toHaveLength(1);
    expect(saved.children[0].dob).toBe('2015-04-03');
    expect(saved.documentType).toBeUndefined();
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
