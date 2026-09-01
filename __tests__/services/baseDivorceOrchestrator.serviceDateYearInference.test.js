/** @jest-environment node */
'use strict';

/**
 * Marcus v14 regression: user narrates "served May 12" with no year given,
 * today = 2026-08-28. LLM had been inferring 2025-05-12 because the system
 * prompt never told it what today was — it fell back to a training-cutoff
 * year. Fix: TODAY line prepended to every system prompt + rule 18 tightened
 * to reference the current year from that line.
 *
 * This test asserts both:
 *   (1) the plumbing: serviceDate is populated when the LLM emits it via
 *       process_phase_data with the current-year date;
 *   (2) the prompt signal: the system prompt for the turn actually carries
 *       the TODAY anchor with today's real year so the LLM can obey rule 18.
 */

const BaseDivorceOrchestrator = require('../../services/agents/BaseDivorceOrchestrator');

const PHASE_ORDER = [
  'INTAKE', 'RESIDENCY', 'GROUNDS', 'CHILDREN', 'PROPERTY',
  'SUPPORT', 'SERVICE', 'INDIGENCY', 'MILITARY', 'REVIEW',
];

function makeOrchestrator() {
  return new BaseDivorceOrchestrator({
    stateCode: 'ON',
    stateName: 'Ontario',
    phases: Object.fromEntries(PHASE_ORDER.map((name) => [name, {
      prompt: `${name} prompt`, displayName: name,
    }])),
    phaseOrder: PHASE_ORDER,
  });
}

function baseData() {
  return {
    affiantName: 'Marcus Kim',
    firstName: 'Marcus',
    lastName: 'Kim',
    role: 'respondent',
    petitionerFirstName: 'Elle',
    petitionerLastName: 'Kim',
    respondentFirstName: 'Marcus',
    respondentLastName: 'Kim',
    state: 'ON',
    county: 'Simcoe',
    orchestratorState: { currentPhase: 'SERVICE', completedPhases: [], stateCode: 'ON' },
  };
}

afterEach(() => { delete global.openAIService; jest.restoreAllMocks(); });

describe('service_date year inference — Marcus v14 regression', () => {
  test('system prompt anchors TODAY to the current calendar date', async () => {
    const chat = jest.fn(async () => ({
      choices: [{
        message: {
          tool_calls: [{
            function: {
              name: 'process_phase_data',
              arguments: JSON.stringify({
                response: 'ok', phase_complete: false, extracted_facts: [],
              }),
            },
          }],
        },
      }],
    }));
    global.openAIService = { chat };

    const orch = makeOrchestrator();
    await orch.processMessage('served May 12', [], baseData(), 'u', 's');

    expect(chat).toHaveBeenCalled();
    const [messages] = chat.mock.calls[0];
    const sys = messages.find((m) => m.role === 'system');
    expect(sys).toBeTruthy();
    const today = new Date().toISOString().slice(0, 10);
    const year = today.slice(0, 4);
    expect(sys.content).toContain(`TODAY: ${today}`);
    expect(sys.content).toContain(`current year: ${year}`);
    // The prompt tells the LLM to use the current year as the fallback,
    // not a prior year.
    expect(sys.content).toMatch(/NEVER default to a prior year/);
  });

  test('serviceDate landed via the LLM populates in the current year', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const currentYear = today.slice(0, 4);
    const expectedDate = `${currentYear}-05-12`;

    global.openAIService = {
      chat: jest.fn(async () => ({
        choices: [{
          message: {
            tool_calls: [{
              function: {
                name: 'process_phase_data',
                arguments: JSON.stringify({
                  response: 'Noted — served May 12.',
                  phase_complete: false,
                  service_date: expectedDate,
                  extracted_facts: [],
                }),
              },
            }],
          },
        }],
      })),
    };

    const orch = makeOrchestrator();
    const { affidavitData } = await orch.processMessage(
      'process server handed it to me May 12',
      [],
      baseData(),
      'u', 's',
    );
    expect(affidavitData.serviceDate).toBe(expectedDate);
    expect(affidavitData.serviceDate.startsWith(currentYear)).toBe(true);
  });
});
