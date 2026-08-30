/** @jest-environment node */
'use strict';

/**
 * v12-B backstop: after the main extraction turn produces new facts, a
 * focused companion-promoter LLM call fills in schema-typed
 * place_value / numeric_value companions that the primary Luna
 * (Responses API) turn sparsely omits. Downstream promotion in
 * lib/api/profile.ts reads the *typed* companions (not the fact prose)
 * to route respondentSuspectedLocation and numberOfChildren into the
 * structured profile.
 *
 * These tests drive the orchestrator via its public entry point and
 * inspect the merged facts on updatedData to confirm the companions
 * are attached (or that fail-open leaves the facts untouched).
 */

const BaseDivorceOrchestrator = require('../../services/agents/BaseDivorceOrchestrator');

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

// Baseline divorceData with the user's own name already captured so the
// name-first gate does not interfere with the extraction turn.
function baseData() {
  return {
    affiantName: 'Mari Guerrero',
    petitionerFirstName: 'Mari',
    petitionerLastName: 'Guerrero',
    respondentFirstName: 'Ray',
    respondentLastName: 'Delacroix',
    state: 'TX',
    county: 'Travis',
  };
}

/**
 * Build a fake openAIService that:
 *   - First call (primary extraction): returns the given extracted_facts
 *     via process_phase_data.
 *   - Second call (companion promoter): returns the given results via
 *     extract_companions (or throws if `promoterError` is set).
 */
// v14-C: promoter switched from function-tool to response_format
// json_schema (reasoning-model reliability). The primary extraction call
// still uses tools; the promoter is identified by its response_format schema
// name "companion_extraction" and returns a JSON string in message.content.
function stubOpenAI({ extractedFacts, promoterResults, promoterError = null }) {
  const chat = jest.fn(async (_messages, options) => {
    const toolName = options?.tool_choice?.function?.name;
    const schemaName = options?.response_format?.json_schema?.name;
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
                  respondent_address_unknown: false,
                  respondent_suspected_location: '',
                  extracted_facts: extractedFacts,
                }),
              },
            }],
          },
        }],
      };
    }
    if (schemaName === 'companion_extraction') {
      if (promoterError) throw promoterError;
      return {
        choices: [{
          message: {
            content: JSON.stringify({ results: promoterResults || [] }),
          },
          finish_reason: 'stop',
        }],
      };
    }
    throw new Error(`unexpected call: toolName=${toolName} schemaName=${schemaName}`);
  });
  global.openAIService = { chat };
  return chat;
}

afterEach(() => {
  delete global.openAIService;
  jest.restoreAllMocks();
});

describe('v12-B companion promoter', () => {
  test('backfills place_value on a respondent_whereabouts fact that lacks it', async () => {
    const chat = stubOpenAI({
      extractedFacts: [{
        content: 'Respondent Ray Delacroix may be located somewhere in Louisiana or Mississippi.',
        category: 'service',
        subcategory: 'respondent_whereabouts',
        // No place_value emitted — the exact bug this backstop fixes.
      }],
      promoterResults: [
        { id: 0, place_value: 'Louisiana or Mississippi', numeric_value: null },
      ],
    });

    const orch = makeOrchestrator();
    const { affidavitData } = await orch.processMessage(
      'I have no idea where Ray is, maybe Louisiana or Mississippi.',
      [],
      baseData(),
      'user-1',
      'sess-1',
    );

    // The primary extraction call + one promoter call.
    expect(chat).toHaveBeenCalledTimes(2);
    const promoterCall = chat.mock.calls.find(
      (c) => c[1]?.response_format?.json_schema?.name === 'companion_extraction',
    );
    expect(promoterCall).toBeTruthy();
    expect(promoterCall[1].model).toBe('gpt-5-nano');

    const whereabouts = (affidavitData.facts || []).find(
      (f) => f.subcategory === 'respondent_whereabouts',
    );
    expect(whereabouts).toBeTruthy();
    expect(whereabouts.placeValue).toBe('Louisiana or Mississippi');
  });

  test('backfills grounds_value on a grounds fact that lacks it (v21-A)', async () => {
    const chat = stubOpenAI({
      extractedFacts: [{
        content: 'Mari and Ray have experienced an irretrievable breakdown of the marriage.',
        category: 'grounds',
        subcategory: 'grounds',
        // No grounds_value emitted — the exact bug this backstop fixes.
      }],
      promoterResults: [
        { id: 0, place_value: null, numeric_value: null, grounds_value: 'irretrievable_breakdown' },
      ],
    });

    const orch = makeOrchestrator();
    const { affidavitData } = await orch.processMessage(
      'we have an irretrievable breakdown',
      [],
      baseData(),
      'user-1',
      'sess-1',
    );

    expect(chat).toHaveBeenCalledTimes(2);
    const groundsFact = (affidavitData.facts || []).find(
      (f) => f.category === 'grounds',
    );
    expect(groundsFact).toBeTruthy();
    expect(groundsFact.groundsValue).toBe('irretrievable_breakdown');
  });

  test('backfills numeric_value on a children fact that lacks it', async () => {
    const chat = stubOpenAI({
      extractedFacts: [{
        content: 'Mari and Ray have two adult children together.',
        category: 'children',
        subcategory: 'adult_children',
      }],
      promoterResults: [
        { id: 0, place_value: null, numeric_value: 2 },
      ],
    });

    const orch = makeOrchestrator();
    const { affidavitData } = await orch.processMessage(
      'we have two adult kids',
      [],
      baseData(),
      'user-1',
      'sess-1',
    );

    expect(chat).toHaveBeenCalledTimes(2);
    const childrenFact = (affidavitData.facts || []).find(
      (f) => f.category === 'children',
    );
    expect(childrenFact).toBeTruthy();
    expect(childrenFact.numericValue).toBe(2);
  });

  test('skips the promoter call when every fact already has its companion', async () => {
    const chat = stubOpenAI({
      extractedFacts: [
        {
          content: 'Ray may be in Louisiana.',
          category: 'service',
          subcategory: 'respondent_whereabouts',
          place_value: 'Louisiana',
        },
        {
          content: 'We have two kids.',
          category: 'children',
          subcategory: 'adult_children',
          numeric_value: 2,
        },
      ],
      // If the promoter were called, this would throw (no results shape needed).
      promoterResults: [],
    });

    const orch = makeOrchestrator();
    const { affidavitData } = await orch.processMessage(
      'context set already',
      [],
      baseData(),
      'user-1',
      'sess-1',
    );

    // Only the primary extraction — no second call.
    expect(chat).toHaveBeenCalledTimes(1);
    expect(chat.mock.calls[0][1].tool_choice.function.name).toBe('process_phase_data');

    const facts = affidavitData.facts || [];
    const whereabouts = facts.find((f) => f.subcategory === 'respondent_whereabouts');
    const children = facts.find((f) => f.category === 'children');
    expect(whereabouts.placeValue).toBe('Louisiana');
    expect(children.numericValue).toBe(2);
  });

  test('fails open when the promoter LLM throws — facts still merge without companions', async () => {
    // v14-C: fail-open is now handled inside _promoteFactCompanions via a
    // try/catch that logs to console.log and returns. The outer processMessage
    // never sees the throw, so we assert on chat call count + fact survival
    // rather than on the previous outer logger.warn.
    const chat = stubOpenAI({
      extractedFacts: [{
        content: 'Ray may be somewhere in Louisiana or Mississippi.',
        category: 'service',
        subcategory: 'respondent_whereabouts',
      }],
      promoterError: new Error('nano upstream 503'),
    });

    const orch = makeOrchestrator();
    const { affidavitData } = await orch.processMessage(
      'no idea where Ray is',
      [],
      baseData(),
      'user-1',
      'sess-1',
    );

    // Both calls attempted; the second threw.
    expect(chat).toHaveBeenCalledTimes(2);

    // The fact still landed on the merged data, minus placeValue.
    const whereabouts = (affidavitData.facts || []).find(
      (f) => f.subcategory === 'respondent_whereabouts',
    );
    expect(whereabouts).toBeTruthy();
    expect(whereabouts.placeValue).toBeUndefined();
  });

  // v13 regression: on gpt-5-nano the promoter's completion budget is spent
  // on hidden reasoning tokens BEFORE the tool-call arguments emit. A live
  // call against Mari's whereabouts fact with max_tokens:400 burned all 400
  // tokens on reasoning and returned finish_reason:"length" with an empty
  // message — no tool call, no place_value, respondentSuspectedLocation
  // silently stayed null. The budget must leave room for the actual
  // arguments after typical reasoning; 400 is not enough, 2000 is.
  test('promoter budget is large enough for reasoning models to emit tool arguments', async () => {
    const chat = stubOpenAI({
      extractedFacts: [{
        content: "Respondent Ray Delacroix moved out of the marital residence approximately eight months ago, and Mari Vasquez-McPherson does not know Respondent Ray Delacroix's current address or whereabouts; Respondent Ray Delacroix may be located in Louisiana or Mississippi.",
        category: 'residence',
        subcategory: 'respondent_whereabouts',
      }],
      promoterResults: [
        { id: 0, place_value: 'Louisiana or Mississippi', numeric_value: null },
      ],
    });

    const orch = makeOrchestrator();
    const { affidavitData } = await orch.processMessage(
      'i honestly have no idea where he lives now',
      [],
      baseData(),
      'user-1',
      'sess-1',
    );

    const promoterCall = chat.mock.calls.find(
      (c) => c[1]?.response_format?.json_schema?.name === 'companion_extraction',
    );
    expect(promoterCall).toBeTruthy();
    // Regression guard: a reasoning model needs ≥1000 completion tokens or
    // the tool call never emits.
    expect(promoterCall[1].max_tokens).toBeGreaterThanOrEqual(1000);

    const whereabouts = (affidavitData.facts || []).find(
      (f) => f.subcategory === 'respondent_whereabouts',
    );
    expect(whereabouts).toBeTruthy();
    expect(whereabouts.placeValue).toBe('Louisiana or Mississippi');
  });
});
