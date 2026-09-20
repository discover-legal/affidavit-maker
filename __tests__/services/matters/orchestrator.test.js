/** @jest-environment node */
'use strict';

const path = require('path');
const {
  loadMatterRegistry,
  createOrchestrator,
  registerDocumentSelection,
} = require('../../../services/matters');
const { buildSkipIf } = require('../../../services/matters/createOrchestrator');
const BaseMatterOrchestrator = require('../../../services/agents/BaseMatterOrchestrator');

const FIXTURES = path.join(__dirname, '..', '..', 'fixtures', 'matters');

function toolProps(orch) {
  return orch.tool.function.parameters.properties;
}

describe('YAML matter → BaseMatterOrchestrator', () => {
  const nameChange = loadMatterRegistry(path.join(process.cwd(), 'matters')).get('name_change');
  const sample = loadMatterRegistry(path.join(FIXTURES, 'valid')).get('sample_claim');

  test('name_change.yaml reproduces the former JS pack exactly', () => {
    const orch = createOrchestrator(nameChange);
    expect(orch).toBeInstanceOf(BaseMatterOrchestrator);
    expect(orch.matterTypeCode).toBe('name_change');
    expect(orch.practiceArea).toBe('civil');
    expect(orch.phaseOrder).toEqual(['INTAKE', 'BACKGROUND', 'MINOR_DETAILS', 'NOTICE', 'REVIEW']);

    // Field map: same 21 snake→camel pairs the JS FIELD_MAP had.
    expect(Object.keys(orch.fieldMap)).toHaveLength(21);
    expect(orch.fieldMap.publication_waiver_requested).toBe('publicationWaiverRequested');
    expect(orch.fieldMap.is_for_minor).toBe('isForMinor');

    // Phase metadata
    expect(orch.phases.INTAKE.requiredFields).toEqual([
      'currentFirstName', 'currentLastName', 'newFirstName', 'newLastName', 'state', 'county',
    ]);
    expect(orch.phases.MINOR_DETAILS.optional).toBe(true);
    expect(orch.phases.NOTICE.optional).toBe(false);
    expect(orch.phases.INTAKE.prompt).toMatch(/petition for a legal name change/);
    expect(orch.phases.INTAKE.prompt).toMatch(/EXTRACTION RULES:/); // shared_rules appended
    expect(orch.phases.REVIEW.prompt).toMatch(/spelling of the new name/);

    // Tool: engine-reserved params + every field + the correction channel.
    const props = toolProps(orch);
    expect(props.response).toEqual({ type: 'string' });
    expect(props.phase_complete).toEqual({ type: 'boolean' });
    expect(props.publication_waiver_reason).toEqual({
      type: 'string',
      enum: ['safety', 'gender_identity', 'financial_hardship', 'none'],
    });
    expect(props.criminal_history_confirmed.description).toBe('true = no disqualifying history');
    expect(props.extracted_facts.items.required).toEqual(['content', 'category']);
    expect(props.superseded_facts.type).toBe('array');
    expect(orch.tool.function.parameters.required).toEqual(['response', 'phase_complete']);
  });

  test('conditional phases skip exactly like the JS skipIf predicates did', () => {
    const orch = createOrchestrator(nameChange);
    // MINOR_DETAILS: skipIf (d) => !d.isForMinor
    expect(orch._getNextPhase('BACKGROUND', { isForMinor: false })).toBe('NOTICE');
    expect(orch._getNextPhase('BACKGROUND', {})).toBe('NOTICE');
    expect(orch._getNextPhase('BACKGROUND', { isForMinor: true })).toBe('MINOR_DETAILS');
    expect(orch._getNextPhase('NOTICE', {})).toBe('REVIEW');
  });

  test('buildSkipIf covers skip_if_any and combined rules', () => {
    const skipIf = buildSkipIf({ skipUnlessAny: ['isRenewal'], skipIfAny: ['isContempt'] });
    expect(skipIf({ isRenewal: true })).toBe(false);
    expect(skipIf({ isRenewal: true, isContempt: true })).toBe(true);
    expect(skipIf({})).toBe(true);
    expect(skipIf({ isRenewal: [] })).toBe(true); // empty arrays are not truthy
    expect(buildSkipIf({ skipUnlessAny: [], skipIfAny: [] })).toBeNull();
  });

  test('fact_category from YAML drives the default category of extracted facts', () => {
    const orch = createOrchestrator(sample);
    const facts = orch._buildFacts([{ content: 'My son lives with me.' }], 'CHILDREN', 'my son lives with me');
    expect(facts).toHaveLength(1);
    expect(facts[0].category).toBe('children');
    expect(facts[0].sourceQuote).toBe('my son lives with me');
    // No fact_category on INTAKE → engine's phase-name table still applies
    expect(orch._buildFacts([{ content: 'x' }], 'INTAKE', 'x')[0].category).toBe('general');
  });

  test('registerDocumentSelection wires the review-screen document list', () => {
    const calls = [];
    const agent = { registerHandler: (state, area, fn) => calls.push({ state, area, fn }) };
    expect(registerDocumentSelection(sample, agent)).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0].state).toBe('*');
    expect(calls[0].area).toBe('sample_claim');
    expect(calls[0].fn({})).toEqual({
      documents: ['affidavit'],
      reasons: { affidavit: 'A sworn statement supporting your sample claim.' },
    });
    expect(registerDocumentSelection(nameChange, agent)).toBe(false); // no document_selection declared
    expect(calls).toHaveLength(1);
  });

  test('runs one interview turn end to end through the engine', async () => {
    const orch = createOrchestrator(sample);
    const seen = {};
    global.openAIService = {
      chat: async (messages, opts) => {
        seen.messages = messages;
        seen.opts = opts;
        return {
          choices: [{
            message: {
              tool_calls: [{
                function: {
                  arguments: JSON.stringify({
                    response: 'Thanks Alex. Which county are you filing in?',
                    phase_complete: true,
                    petitioner_first_name: 'Alex',
                    petitioner_last_name: 'Rivera',
                    state: 'ON',
                    county: 'Toronto',
                    has_children: true,
                    urgency: 'high',
                    extracted_facts: [{ content: 'I live in Toronto.', category: 'general' }],
                  }),
                },
              }],
            },
          }],
        };
      },
    };
    try {
      const out = await orch.processMessage('My name is Alex Rivera, in Toronto', [], {}, 'user-1', 'sess-1');
      expect(out.response).toMatch(/Which county/);
      expect(out.affidavitData.petitionerFirstName).toBe('Alex');
      expect(out.affidavitData.petitionerName).toBe('Alex Rivera');
      expect(out.affidavitData.urgencyLevel).toBe('high'); // explicit target honoured
      expect(out.affidavitData.hasChildren).toBe(true);
      expect(out.newFacts).toHaveLength(1);
      // INTAKE complete + has_children → CHILDREN runs (not skipped)
      expect(out.orchestratorState.currentPhase).toBe('CHILDREN');
      expect(out.orchestratorState.completedPhases).toEqual(['INTAKE']);
      // The engine forced our tool and sent the YAML phase prompt as the system message
      expect(seen.opts.tool_choice.function.name).toBe('process_matter_data');
      expect(seen.messages[0].role).toBe('system');
      expect(seen.messages[0].content).toMatch(/Intake prompt for the sample claim/);
      expect(seen.messages[0].content).toMatch(/PROGRESS: Step 1 of 3/);
    } finally {
      delete global.openAIService;
    }
  });
});
