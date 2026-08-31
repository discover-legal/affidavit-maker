/** @jest-environment node */

/**
 * Multi-turn facts persistence regression (Amara-shape).
 *
 * The task report claimed profile.facts was empty in the DB after 8 chat
 * turns even though newFacts arrived on 6 of them. This test simulates the
 * exact contract chat/route.ts uses: an in-memory user_profiles row backing
 * getUserProfile, followed by N sequential mergeUserProfile calls each
 * carrying its turn's newFacts + full accumulated affidavitData.facts.
 *
 * The assertion is cumulative: after every merge the stored facts array
 * must contain every content string emitted so far, deduped once.
 */

// Mock the DB layer with a mutable in-memory row so successive merges see
// their predecessor's write, exactly as production does.
const queryMock = jest.fn();
jest.mock('@/lib/db', () => ({
  query: (...args: unknown[]) => queryMock(...args),
}));
jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { mergeUserProfile } from '@/lib/api/profile';

type Row = { profile: Record<string, unknown>; facts: unknown[] };

function installRow(): { get: () => Row } {
  const row: Row = { profile: {}, facts: [] };
  queryMock.mockImplementation((sql: string, params?: unknown[]) => {
    if (sql.startsWith('SELECT profile, facts FROM user_profiles')) {
      return Promise.resolve({ rows: [{ profile: row.profile, facts: row.facts }], rowCount: 1 });
    }
    if (sql.includes('INSERT INTO user_profiles')) {
      const p = params as [number, string, string];
      row.profile = JSON.parse(p[1]);
      row.facts = JSON.parse(p[2]);
      return Promise.resolve({ rows: [], rowCount: 1 });
    }
    return Promise.resolve({ rows: [], rowCount: 0 });
  });
  return { get: () => row };
}

beforeEach(() => queryMock.mockReset());

// Amara-shape newFacts across her 8 real chat turns (v31e transcript).
const AMARA_TURNS: Array<{ affidavitData: Record<string, unknown>; newFacts: Array<Record<string, unknown>> }> = [
  {
    affidavitData: { state: 'GA', county: 'Fulton', role: 'petitioner' },
    newFacts: [{ id: 't0-1', content: 'The divorce documents are intended to be filed in Fulton County, Georgia.', category: 'residence', subcategory: 'filing_jurisdiction' }],
  },
  {
    affidavitData: { firstName: 'Amara', lastName: 'Okafor', spouseName: 'Malachi Okafor', marriageDate: '2012' },
    newFacts: [],
  },
  {
    affidavitData: { separationDate: 'about 4 months ago' },
    newFacts: [
      { id: 't2-1', content: 'Petitioner has resided in Georgia for approximately 15 years.', category: 'residence', subcategory: 'state_residency' },
      { id: 't2-2', content: 'Petitioner and Respondent separated approximately four months ago.', category: 'temporal', subcategory: 'separation' },
    ],
  },
  {
    affidavitData: { numberOfChildren: 3, hasMinorChildren: true },
    newFacts: [{ id: 't3-1', content: 'The parties have three minor children: Zora 13, Ade 10, Kofi 7.', category: 'children', subcategory: 'residence' }],
  },
  {
    affidavitData: { groundsForDivorce: 'cruel_treatment' },
    newFacts: [
      { id: 't4-1', content: 'Petitioner alleges Respondent subjected Petitioner to physical abuse constituting cruel treatment.', category: 'grounds', subcategory: 'cruel_treatment' },
      { id: 't4-2', content: 'Petitioner has hospital records from 2024 documenting matters related to the alleged physical abuse.', category: 'evidence', subcategory: 'supporting_medical_records' },
      { id: 't4-3', content: 'Petitioner has police reports from 2024 relating to the alleged physical abuse.', category: 'evidence', subcategory: 'supporting_police_reports' },
    ],
  },
  {
    affidavitData: { custodyPreference: 'sole' },
    newFacts: [
      { id: 't5-1', content: "Petitioner requests sole legal and sole physical custody of the three minor children.", category: 'children', subcategory: 'custody' },
      { id: 't5-2', content: 'Petitioner requests supervised visitation only for Respondent.', category: 'parental', subcategory: 'supervised_visitation' },
    ],
  },
  {
    affidavitData: { respondentAddressUnknown: true },
    newFacts: [
      { id: 't6-1', content: "Petitioner does not know Respondent's current residential address; Petitioner believes Respondent may be in Alabama near Mobile.", category: 'residence', subcategory: 'respondent_whereabouts', placeValue: 'Alabama near Mobile' },
    ],
  },
  {
    affidavitData: {},
    newFacts: [],
  },
];

test('cumulative multi-turn merge accumulates every newFact (Amara-shape)', async () => {
  const row = installRow();
  const expectedContents: string[] = [];

  for (let i = 0; i < AMARA_TURNS.length; i++) {
    const { affidavitData, newFacts } = AMARA_TURNS[i];
    // Simulate the orchestrator: affidavitData.facts carries the running
    // conversation list (existing + this turn's).
    const runningFacts = [...expectedContents.map((c, idx) => ({ id: `carry-${idx}`, content: c })), ...newFacts];
    await mergeUserProfile(7, { ...affidavitData, facts: runningFacts }, newFacts);
    for (const f of newFacts) expectedContents.push(String(f.content));

    const stored = row.get().facts as Array<{ content?: string }>;
    const storedContents = stored.map((f) => String(f.content ?? '').trim());
    for (const c of expectedContents) {
      expect(storedContents.some((s) => s === c.trim())).toBe(true);
    }
  }

  const finalFacts = row.get().facts as unknown[];
  expect(finalFacts.length).toBeGreaterThanOrEqual(expectedContents.length);
});

test('mergeUserProfile with newFacts only (no affidavitData.facts) still persists them', async () => {
  const row = installRow();
  await mergeUserProfile(
    7,
    { state: 'GA' },
    [{ id: 'x', content: 'Fresh fact from newFacts only.', category: 'general' }],
  );
  const facts = row.get().facts as Array<{ content: string }>;
  expect(facts).toHaveLength(1);
  expect(facts[0].content).toBe('Fresh fact from newFacts only.');
});

test('mergeUserProfile drops facts with empty/missing content (bug guard)', async () => {
  const row = installRow();
  await mergeUserProfile(
    7,
    { state: 'GA' },
    [
      { id: 'a', content: '', category: 'general' } as never,
      { id: 'b', category: 'general' } as never, // no content
      { id: 'c', content: 'A real fact.', category: 'general' },
    ],
  );
  const facts = row.get().facts as Array<{ id: string }>;
  expect(facts.map((f) => f.id)).toEqual(['c']);
});
