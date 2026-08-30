/** @jest-environment node */
/* eslint-disable @typescript-eslint/no-var-requires */

/**
 * Mari v14 regression trace: the orchestrator's post-turn companion promoter
 * mutates a whereabouts fact in place (fact.placeValue = "Louisiana or
 * Mississippi"), but the durable profile row still ends up with
 * respondentSuspectedLocation === null.
 *
 * This test exercises the FULL wiring the way app/api/chat/route.ts does:
 *   1. Run BaseDivorceOrchestrator.processMessage against a stubbed LLM that
 *      returns a whereabouts fact with no place_value (the exact primary-turn
 *      shape the backstop targets) AND a promoter response with the extracted
 *      place.
 *   2. Take result.newFacts + result.affidavitData exactly as chat/route.ts
 *      would, and call mergeUserProfile with them.
 *   3. Assert the durable profile.respondentSuspectedLocation was promoted.
 *
 * If the fact reference the promoter mutated is NOT the same reference
 * mergeUserProfile sees, this test fails and points at where a copy is
 * dropping the mutation.
 */

const queryMock = jest.fn();
jest.mock('@/lib/db', () => ({ query: (...args: unknown[]) => queryMock(...args) }));
jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { mergeUserProfile } from '@/lib/api/profile';

const BaseDivorceOrchestrator = require('../../../services/agents/BaseDivorceOrchestrator');

const PHASE_ORDER = [
  'INTAKE', 'RESIDENCY', 'GROUNDS', 'CHILDREN', 'PROPERTY',
  'SUPPORT', 'SERVICE', 'INDIGENCY', 'MILITARY', 'REVIEW',
];

function makeOrchestrator() {
  return new BaseDivorceOrchestrator({
    stateCode: 'TX',
    stateName: 'Texas',
    phases: Object.fromEntries(PHASE_ORDER.map((name) => [name, {
      prompt: `${name} prompt`, displayName: name,
    }])),
    phaseOrder: PHASE_ORDER,
  });
}

function baseData() {
  return {
    affiantName: 'Mari Vasquez-McPherson',
    firstName: 'Mari',
    lastName: 'Vasquez-McPherson',
    petitionerFirstName: 'Mari',
    petitionerLastName: 'Vasquez-McPherson',
    respondentFirstName: 'Ray',
    respondentLastName: 'Delacroix',
    state: 'TX',
    county: 'Travis',
  };
}

beforeEach(() => { queryMock.mockReset(); });
afterEach(() => { delete (global as unknown as { openAIService?: unknown }).openAIService; });

test('promoter mutation on newFacts survives into mergeUserProfile (Mari v14)', async () => {
  // Stub the two LLM calls the orchestrator makes this turn.
  const chat = jest.fn(async (
    _msgs: unknown,
    options: {
      tool_choice?: { function?: { name?: string } };
      response_format?: { json_schema?: { name?: string } };
    },
  ) => {
    const toolName = options?.tool_choice?.function?.name;
    if (toolName === 'process_phase_data') {
      return {
        choices: [{
          message: {
            tool_calls: [{
              function: {
                name: 'process_phase_data',
                arguments: JSON.stringify({
                  response: 'Understood, no address for Ray.',
                  phase_complete: false,
                  respondent_address_unknown: true,
                  extracted_facts: [{
                    content: 'Mari Vasquez-McPherson does not know Ray Delacroix\'s current address; Ray may be located in Louisiana or Mississippi.',
                    category: 'service',
                    subcategory: 'respondent_whereabouts',
                    // place_value deliberately omitted — the promoter's job.
                  }],
                }),
              },
            }],
          },
        }],
      };
    }
    const schemaName = (options as { response_format?: { json_schema?: { name?: string } } })
      ?.response_format?.json_schema?.name;
    if (schemaName === 'companion_extraction') {
      return {
        choices: [{
          message: {
            content: JSON.stringify({ results: [
              { id: 0, place_value: 'Louisiana or Mississippi', numeric_value: null },
            ] }),
          },
          finish_reason: 'stop',
        }],
      };
    }
    if (schemaName === 'place_extraction') {
      // Rescue path — not expected to fire in this test, but keep it safe.
      return {
        choices: [{
          message: { content: JSON.stringify({ place: 'Louisiana or Mississippi' }) },
          finish_reason: 'stop',
        }],
      };
    }
    throw new Error(`unexpected call: toolName=${toolName} schemaName=${schemaName}`);
  });
  (global as unknown as { openAIService: unknown }).openAIService = { chat };

  const orch = makeOrchestrator();
  const result = await orch.processMessage(
    'no idea where Ray is, maybe Louisiana or Mississippi',
    [],
    baseData(),
    'user-42',
    'sess-42',
  );

  // Sanity: the promoter did mutate the fact reference in newFacts.
  const whereaboutsInNewFacts = (result.newFacts || []).find(
    (f: { subcategory?: string }) => f.subcategory === 'respondent_whereabouts',
  );
  expect(whereaboutsInNewFacts).toBeTruthy();
  expect(whereaboutsInNewFacts.placeValue).toBe('Louisiana or Mississippi');

  // And it's the SAME reference living on updatedData.facts.
  const whereaboutsOnData = (result.affidavitData.facts || []).find(
    (f: { subcategory?: string }) => f.subcategory === 'respondent_whereabouts',
  );
  expect(whereaboutsOnData).toBeTruthy();
  expect(whereaboutsOnData.placeValue).toBe('Louisiana or Mississippi');

  // Now the chat-route contract: call mergeUserProfile with the returned data.
  queryMock.mockResolvedValueOnce({ rows: [{ profile: {}, facts: [] }], rowCount: 1 });
  queryMock.mockResolvedValueOnce({ rows: [], rowCount: 1 });

  await mergeUserProfile(
    42,
    result.affidavitData as Record<string, unknown>,
    result.newFacts as Array<Record<string, unknown>>,
  );

  const [, params] = queryMock.mock.calls[1] as [string, unknown[]];
  const savedProfile = JSON.parse(params[1] as string);
  expect(savedProfile.respondentAddressUnknown).toBe(true);
  expect(savedProfile.respondentSuspectedLocation).toBe('Louisiana or Mississippi');
});

// The primary LLM is not schema-constrained to emit subcategory ===
// "respondent_whereabouts"; live Luna runs have tagged the same semantic
// fact as subcategory: "whereabouts" (short form) or category: "residence"
// with subcategory: "respondent_location". A strict-equality gate blocks
// promotion; the broadened tag check catches these.
test.each([
  { category: 'service',   subcategory: 'whereabouts' },
  { category: 'residence', subcategory: 'respondent_location' },
  { category: 'service',   subcategory: 'respondent_address_unknown' },
])('promoter + merge handle subcategory variant %p', async (tag) => {
  const chat = jest.fn(async (
    _msgs: unknown,
    options: {
      tool_choice?: { function?: { name?: string } };
      response_format?: { json_schema?: { name?: string } };
    },
  ) => {
    const toolName = options?.tool_choice?.function?.name;
    if (toolName === 'process_phase_data') {
      return {
        choices: [{
          message: {
            tool_calls: [{
              function: {
                name: 'process_phase_data',
                arguments: JSON.stringify({
                  response: 'ok',
                  phase_complete: false,
                  extracted_facts: [{
                    content: 'Ray may be located in Louisiana or Mississippi.',
                    ...tag,
                  }],
                }),
              },
            }],
          },
        }],
      };
    }
    const schemaName = (options as { response_format?: { json_schema?: { name?: string } } })
      ?.response_format?.json_schema?.name;
    if (schemaName === 'companion_extraction') {
      return {
        choices: [{
          message: {
            content: JSON.stringify({ results: [
              { id: 0, place_value: 'Louisiana or Mississippi', numeric_value: null },
            ] }),
          },
          finish_reason: 'stop',
        }],
      };
    }
    if (schemaName === 'place_extraction') {
      // Rescue path — not expected to fire in this test, but keep it safe.
      return {
        choices: [{
          message: { content: JSON.stringify({ place: 'Louisiana or Mississippi' }) },
          finish_reason: 'stop',
        }],
      };
    }
    throw new Error(`unexpected call: toolName=${toolName} schemaName=${schemaName}`);
  });
  (global as unknown as { openAIService: unknown }).openAIService = { chat };

  const orch = makeOrchestrator();
  const result = await orch.processMessage(
    'no idea where Ray is',
    [],
    baseData(),
    'user-42',
    'sess-42',
  );

  // Promoter must have fired for the variant tag.
  const promoterCalled = chat.mock.calls.some(
    (c) => c[1]?.response_format?.json_schema?.name === 'companion_extraction',
  );
  expect(promoterCalled).toBe(true);

  queryMock.mockResolvedValueOnce({ rows: [{ profile: {}, facts: [] }], rowCount: 1 });
  queryMock.mockResolvedValueOnce({ rows: [], rowCount: 1 });
  await mergeUserProfile(
    42,
    result.affidavitData as Record<string, unknown>,
    result.newFacts as Array<Record<string, unknown>>,
  );
  const [, params] = queryMock.mock.calls[1] as [string, unknown[]];
  const savedProfile = JSON.parse(params[1] as string);
  expect(savedProfile.respondentAddressUnknown).toBe(true);
  expect(savedProfile.respondentSuspectedLocation).toBe('Louisiana or Mississippi');
});
