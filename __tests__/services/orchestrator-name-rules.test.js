/** @jest-environment node */
'use strict';

/**
 * Guards TX Mari acceptance v7: "his name is Slick" must NOT land as the
 * respondent's legal name. The orchestrator must always inject a
 * respondent-name nickname guard, the schema must warn against nickname
 * capture, and the response must ask for the full legal name.
 */

const BaseDivorceOrchestrator = require('../../services/agents/BaseDivorceOrchestrator');

function makeOrchestrator() {
  return new BaseDivorceOrchestrator({
    stateCode: 'TX',
    stateName: 'Texas',
    phases: {
      INTAKE: { prompt: 'intake prompt', displayName: 'Getting Started' },
      RESIDENCY: { prompt: 'residency prompt', displayName: 'Residency' },
      REVIEW: { prompt: 'review prompt', displayName: 'Review' },
    },
    phaseOrder: ['INTAKE', 'RESIDENCY', 'REVIEW'],
  });
}

describe('respondent nickname guard — system prompt', () => {
  test('RESPONDENT_NAME_RULE is always injected into the system prompt', () => {
    const orch = makeOrchestrator();
    const promptMissing = orch._buildSystemPrompt({ currentPhase: 'INTAKE' }, {});
    const promptWithName = orch._buildSystemPrompt(
      { currentPhase: 'INTAKE' },
      { affiantName: 'Mari Guerrero', petitionerFirstName: 'Mari' }
    );
    for (const p of [promptMissing, promptWithName]) {
      expect(p).toMatch(/RESPONDENT NAME — NICKNAME GUARD/);
      expect(p).toMatch(/his name is Slick/);
      expect(p).toMatch(/full legal name/);
    }
  });
});

describe('respondent nickname guard — schema descriptions', () => {
  test('respondent_first_name / respondent_last_name descriptions carry the nickname guard', () => {
    const props = makeOrchestrator().tool.function.parameters.properties;
    expect(props.respondent_first_name.description).toMatch(/NICKNAME GUARD/);
    expect(props.respondent_first_name.description).toMatch(/his name is Slick/);
    expect(props.respondent_first_name.description).toMatch(/full legal name/i);
    expect(props.respondent_last_name.description).toMatch(/NICKNAME GUARD/);
  });
});

describe('respondent nickname guard — orchestrator refuses to store nickname', () => {
  test('"his name is Slick" flow — orchestrator response asks for the full legal name and does not persist "Slick"', async () => {
    // Simulates a well-behaved model turn AFTER the new nickname guard.
    // The guard's whole point is that the model returns an EMPTY
    // respondent_first_name (or omits it) plus a response asking for the
    // full legal name. If regression re-introduces silent nickname
    // capture, this test fails.
    global.openAIService = {
      chat: jest.fn(async () => ({
        choices: [{
          message: {
            tool_calls: [{
              function: {
                name: 'process_phase_data',
                arguments: JSON.stringify({
                  response: "What is Slick's full legal name?",
                  phase_complete: false,
                  // Nickname NOT persisted — recorded only as a fact.
                  extracted_facts: [
                    { content: 'The respondent is known to the user as "Slick".', category: 'identity' },
                  ],
                }),
              },
            }],
          },
        }],
      })),
    };

    const orch = makeOrchestrator();
    const seedName = {
      affiantName: 'Mari Guerrero',
      petitionerFirstName: 'Mari',
      petitionerLastName: 'Guerrero',
    };
    const result = await orch.processMessage(
      'his name is Slick',
      [],
      seedName,
      'u',
      's'
    );

    // Response asks for the full legal name.
    expect(result.response).toMatch(/full legal name/i);
    // Nickname is NOT stored as the respondent's legal name.
    expect(result.affidavitData.respondentFirstName).toBeFalsy();
    expect(result.affidavitData.respondentName).toBeFalsy();
    // Provenance fact recorded.
    const factContents = (result.affidavitData.facts || []).map((f) => f.content);
    expect(factContents.some((c) => /Slick/.test(c))).toBe(true);

    delete global.openAIService;
  });
});

describe('respondent_suspected_location — hedge-strip landing (rule 19)', () => {
  test('hedge-stripped value flows through _applyFieldUpdates to respondentSuspectedLocation intact', () => {
    // The MODEL is responsible for stripping the hedge before emitting
    // (rule 19); this test asserts the deterministic plumbing side — the
    // clean value maps correctly and no additional munging alters it.
    const orch = makeOrchestrator();
    const data = orch._applyFieldUpdates({}, {
      respondent_address_unknown: true,
      respondent_suspected_location: 'Louisiana',
    });
    expect(data.respondentSuspectedLocation).toBe('Louisiana');
    expect(data.respondentAddressUnknown).toBe(true);
    expect(data.respondentAddress).toBeFalsy();
  });
});

describe('whereabouts-unknown fields — NEVER-OMIT guardrails (Mari v8b)', () => {
  // v8b replay showed the LLM captured a "does not know Ray's current
  // address; Ray may be in Louisiana or Mississippi" fact but never emitted
  // the STRUCTURED respondent_address_unknown / respondent_suspected_location
  // fields — so the TX petition dropped the alt-service caveat. The plumbing
  // is fine; the schema + rule prompts must be strong enough to force the
  // fields out of the model. These assertions guard the prompt strength.
  test('schema descriptions for both fields carry the NEVER OMIT and STRUCTURED FIELD language', () => {
    const props = makeOrchestrator().tool.function.parameters.properties;
    expect(props.respondent_address_unknown.description).toMatch(/NEVER OMIT/);
    expect(props.respondent_address_unknown.description).toMatch(/STRUCTURED/);
    expect(props.respondent_address_unknown.description).toMatch(/hedged whereabouts/i);
    expect(props.respondent_suspected_location.description).toMatch(/NEVER OMIT/);
    expect(props.respondent_suspected_location.description).toMatch(/hedge-stripped/i);
  });

  test('rule 17 in EXTRACTION_QUALITY carries the NEVER OMIT / fact-only-is-a-bug clause', () => {
    const { EXTRACTION_QUALITY } = require('../../services/agents/extractionQuality');
    expect(EXTRACTION_QUALITY).toMatch(/NEVER OMIT THE STRUCTURED FIELDS/);
    expect(EXTRACTION_QUALITY).toMatch(/Fact-only capture NEVER satisfies/);
    // Mari v8b provenance stays anchored to the rule so a future rewrite
    // has to consciously drop the reference.
    expect(EXTRACTION_QUALITY).toMatch(/Mari.*v8b/i);
  });

  test('after _applyFieldUpdates on a Mari-style compliant emission, both structured fields land camelCased', () => {
    // Simulates the model doing what rule 17's NEVER-OMIT clause demands:
    // emitting both structured fields on the same turn Mari says "i honestly
    // have no idea where he lives now… Possibly Louisiana or Mississippi".
    const orch = makeOrchestrator();
    const data = orch._applyFieldUpdates(
      { petitionerFirstName: 'Mari', petitionerLastName: 'Vasquez-McPherson' },
      {
        respondent_address_unknown: true,
        respondent_suspected_location: 'Louisiana or Mississippi',
        extracted_facts: [
          {
            content:
              "Mari Vasquez-McPherson does not know Ray Delacroix's current address; Ray Delacroix may be located in Louisiana or Mississippi.",
            category: 'residence',
            subcategory: 'respondent_whereabouts',
          },
        ],
      },
    );
    expect(data.respondentAddressUnknown).toBe(true);
    expect(data.respondentSuspectedLocation).toBe('Louisiana or Mississippi');
    // The sworn residence field must remain empty so the petition renders the
    // alt-service caveat rather than a bare "is a resident of …" clause.
    expect(data.respondentAddress).toBeFalsy();
  });
});
