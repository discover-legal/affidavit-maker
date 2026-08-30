/** @jest-environment node */
'use strict';

/**
 * Guards the TX Mari fix: no phase past INTAKE is satisfied while the
 * user's own full legal name is missing, the system prompt injects the
 * turn-1 name rule while missing, and processMessage refuses to advance
 * phases even if the LLM sets phase_complete: true prematurely.
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

function stubOpenAIService(toolArguments) {
  global.openAIService = {
    chat: jest.fn(async () => ({
      choices: [{
        message: {
          tool_calls: [{
            function: {
              name: 'process_phase_data',
              arguments: JSON.stringify(toolArguments),
            },
          }],
        },
      }],
    })),
  };
}

afterEach(() => {
  delete global.openAIService;
});

describe('name-first gate — phase-satisfied check', () => {
  test('_phaseAlreadySatisfied returns false for phases past INTAKE when name missing', () => {
    const orch = makeOrchestrator();
    // The user has state + county + residency + marriage — every non-INTAKE
    // phase would nominally look "satisfied" but the name is still missing.
    const dataNoName = {
      state: 'TX',
      county: 'Travis',
      residencyStateMonths: 6,
      marriageDate: '2015-01-01',
      marriageLocation: 'Austin, TX',
      groundsForDivorce: 'insupportability',
      hasMinorChildren: false,
      propertyAgreement: 'agreed',
      spousalSupportRequested: false,
      serviceMethod: 'waiver',
      indigencyConfirmed: true,
      respondentMilitaryStatus: 'not_military',
      dmdcSearchPlanned: 'before_filing',
    };
    for (const phase of PHASE_ORDER.filter((p) => p !== 'INTAKE' && p !== 'REVIEW')) {
      expect(orch._phaseAlreadySatisfied(phase, dataNoName)).toBe(false);
    }
  });

  test('_phaseAlreadySatisfied still evaluates normally once the name is present', () => {
    const orch = makeOrchestrator();
    const dataWithName = {
      affiantName: 'Mari Guerrero',
      petitionerFirstName: 'Mari',
      state: 'TX',
      county: 'Travis',
      residencyStateMonths: 6,
    };
    expect(orch._phaseAlreadySatisfied('RESIDENCY', dataWithName)).toBe(true);
  });
});

describe('name-first gate — system prompt injection', () => {
  test('NAME_FIRST_RULE is injected while user name is missing', () => {
    const orch = makeOrchestrator();
    const prompt = orch._buildSystemPrompt(
      { currentPhase: 'INTAKE' },
      { /* no name fields */ },
    );
    expect(prompt).toMatch(/TURN 1 RULE/);
    expect(prompt).toMatch(/What is your full legal name\?/);
  });

  test('NAME_FIRST_RULE is NOT injected once affiantName is set', () => {
    const orch = makeOrchestrator();
    const prompt = orch._buildSystemPrompt(
      { currentPhase: 'RESIDENCY' },
      { affiantName: 'Mari Guerrero' },
    );
    expect(prompt).not.toMatch(/TURN 1 RULE/);
  });

  test('petitionerFirstName alone satisfies the name-known predicate', () => {
    const orch = makeOrchestrator();
    const prompt = orch._buildSystemPrompt(
      { currentPhase: 'INTAKE' },
      { petitionerFirstName: 'Mari' },
    );
    expect(prompt).not.toMatch(/TURN 1 RULE/);
  });
});

describe('name-first gate — structural signals (schema + user prompt) fire when name missing', () => {
  test('user prompt carries REQUIRED NEXT QUESTION line when name missing', () => {
    const orch = makeOrchestrator();
    const prompt = orch._buildUserPrompt(
      "my husband has been cheating for years and i want out.",
      { /* no name */ },
      { currentPhase: 'INTAKE', completedPhases: [] },
    );
    expect(prompt).toMatch(/REQUIRED NEXT QUESTION/);
    expect(prompt).toMatch(/full legal name/i);
  });

  test('user prompt has NO name-required line once name is captured', () => {
    const orch = makeOrchestrator();
    const prompt = orch._buildUserPrompt(
      "here is more info",
      { affiantName: 'Mari Guerrero' },
      { currentPhase: 'RESIDENCY', completedPhases: ['INTAKE'] },
    );
    expect(prompt).not.toMatch(/REQUIRED NEXT QUESTION/);
  });

  test('tool schema sent to the model carries the hard name requirement when name missing', async () => {
    // Mari-shape opening: third-person, mentions husband and county but never
    // her own name. Failure mode from the TX Mari acceptance run.
    const captured = { tools: null };
    global.openAIService = {
      chat: jest.fn(async (_messages, options) => {
        captured.tools = options.tools;
        return {
          choices: [{
            message: {
              tool_calls: [{
                function: {
                  name: 'process_phase_data',
                  arguments: JSON.stringify({
                    response: "I've noted that. What is your full legal name?",
                    phase_complete: false,
                  }),
                },
              }],
            },
          }],
        };
      }),
    };
    const orch = makeOrchestrator();
    await orch.processMessage(
      "my husband and i live in Austin, we have been married since 2016.",
      [], {}, 'u', 's',
    );
    expect(Array.isArray(captured.tools)).toBe(true);
    const responseDesc = captured.tools[0].function.parameters.properties.response.description;
    expect(responseDesc).toMatch(/HARD REQUIREMENT/);
    expect(responseDesc).toMatch(/full legal name/);
  });

  test('tool schema reverts to plain description once name is captured', async () => {
    const captured = { tools: null };
    global.openAIService = {
      chat: jest.fn(async (_messages, options) => {
        captured.tools = options.tools;
        return {
          choices: [{
            message: {
              tool_calls: [{
                function: {
                  name: 'process_phase_data',
                  arguments: JSON.stringify({ response: 'ok', phase_complete: false }),
                },
              }],
            },
          }],
        };
      }),
    };
    const orch = makeOrchestrator();
    await orch.processMessage('and I live in Travis county.', [], {
      affiantName: 'Mari Guerrero',
      petitionerFirstName: 'Mari',
    }, 'u', 's');
    const responseDesc = captured.tools[0].function.parameters.properties.response.description;
    expect(responseDesc).not.toMatch(/HARD REQUIREMENT/);
  });
});

describe('name-first gate — TX Mari failure-mode reproduction (persona never volunteers name)', () => {
  test('four turns of Mari-shape input with no self-name never advance past INTAKE and never capture a name', async () => {
    // Simulates the reported live failure: user shares locality, spouse
    // name, marriage date, kids, but never her own. The gate MUST keep the
    // interview in INTAKE across every turn and MUST refuse to derive an
    // affiantName from spouse-only extractions.
    const marisTurns = [
      "my husband and i have been fighting for years and i want out. we live in austin.",
      "his name is John Guerrero. we live in Travis county.",
      "married June 2016 in Houston.",
      "two kids, ages 5 and 7, they live with me.",
    ];

    // Model-shape: always sets phase_complete:true (worst-case), extracts
    // spouse info, and NEVER emits a petitioner name. The gate must hold.
    const modelExtractions = [
      { response: 'ok', phase_complete: true, state: 'TX', county: 'Austin' },
      { response: 'ok', phase_complete: true, respondent_first_name: 'John', respondent_last_name: 'Guerrero', county: 'Travis' },
      { response: 'ok', phase_complete: true, marriage_date: '2016-06', marriage_city: 'Houston' },
      { response: 'ok', phase_complete: true },
    ];
    let turn = 0;
    global.openAIService = {
      chat: jest.fn(async () => ({
        choices: [{
          message: {
            tool_calls: [{
              function: {
                name: 'process_phase_data',
                arguments: JSON.stringify(modelExtractions[turn++]),
              },
            }],
          },
        }],
      })),
    };

    const orch = makeOrchestrator();
    let data = {};
    for (let i = 0; i < marisTurns.length; i++) {
      const result = await orch.processMessage(marisTurns[i], [], data, 'u', 's');
      data = result.affidavitData;
      expect(result.orchestratorState.currentPhase).toBe('INTAKE');
      expect(result.orchestratorState.completedPhases).toEqual([]);
    }
    expect(data.affiantName).toBeFalsy();
    expect(data.petitionerFirstName).toBeFalsy();
    expect(data.petitionerName).toBeFalsy();
  });
});

describe('name-first gate — processMessage phase-advance blocker', () => {
  test('phase_complete=true without a name does NOT advance past INTAKE', async () => {
    stubOpenAIService({
      response: 'Got it — tell me more about your marriage.',
      phase_complete: true,
      // Deliberately no *_first_name fields — mimics the LLM trying to
      // sprint past INTAKE with a partial answer.
      state: 'TX',
      county: 'Travis',
    });
    const orch = makeOrchestrator();
    const result = await orch.processMessage('I live in Travis County, Texas.', [], {}, 'u', 's');
    expect(result.orchestratorState.currentPhase).toBe('INTAKE');
    expect(result.orchestratorState.completedPhases).toEqual([]);
  });

  test('phase_complete=true WITH a name advances normally (Katie/Alison flow)', async () => {
    stubOpenAIService({
      response: 'Thanks, Katie. Which county do you live in?',
      phase_complete: true,
      petitioner_first_name: 'Katie',
      petitioner_last_name:  'Bennett',
      respondent_first_name: 'Devin',
      respondent_last_name:  'Bennett',
    });
    const orch = makeOrchestrator();
    const result = await orch.processMessage(
      "I'm Katie Bennett and my spouse is Devin Bennett.",
      [], {}, 'u', 's',
    );
    expect(result.affidavitData.petitionerName).toBe('Katie Bennett');
    // Advanced out of INTAKE (skipped past already-satisfied phases per the
    // phase-order rules — the important thing is that INTAKE ITSELF was
    // marked complete, unlike the name-missing case above).
    expect(result.orchestratorState.completedPhases).toContain('INTAKE');
    expect(result.orchestratorState.currentPhase).not.toBe('INTAKE');
  });
});
