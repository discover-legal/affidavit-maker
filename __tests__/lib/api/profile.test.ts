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
      petitionerFirstName: 'Brandon',
      petitionerLastName: 'Pritchard',
      marriageDate: '2010-05-01',
      children: [
        { name: 'Emma', dob: '2015-04-02' },
        { name: 'Liam', dob: '2017-06-15' },
        { name: 'Ava', dob: '2019-09-09' },
      ],
    },
    facts: [{ id: '1', content: 'I was married in Texas.', category: 'general' }],
  };

  test('fills gaps from the stored profile', () => {
    const hydrated = hydrateAffidavitData(stored, {} as Record<string, unknown>);
    expect(hydrated.petitionerFirstName).toBe('Brandon');
    expect(hydrated.marriageDate).toBe('2010-05-01');
    expect((hydrated.children as unknown[]).length).toBe(3);
    expect((hydrated.facts as unknown[]).length).toBe(1);
    expect(hydrated.profileHydrated).toBe(true);
  });

  test('never overwrites what the current conversation already has', () => {
    const hydrated = hydrateAffidavitData(stored, {
      petitionerFirstName: 'Robert',
      facts: [{ id: '9', content: 'Fresh fact.' }],
    });
    expect(hydrated.petitionerFirstName).toBe('Robert');
    expect((hydrated.facts as { id: string }[])[0].id).toBe('9');
  });

  test('merges profile children with conversation children by identity', () => {
    const hydrated = hydrateAffidavitData(stored, {
      children: [{ name: 'Emma', age: 11 }],
    });
    const children = hydrated.children as { name: string }[];
    expect(children).toHaveLength(3);
    expect(children.map((c) => c.name).sort()).toEqual(['Ava', 'Emma', 'Liam']);
  });

  test('does not flag hydration when there is nothing to add', () => {
    const hydrated = hydrateAffidavitData({ profile: {}, facts: [] }, { state: 'TX' });
    expect(hydrated.profileHydrated).toBeUndefined();
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
