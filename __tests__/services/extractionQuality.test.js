/** @jest-environment node */
'use strict';

/**
 * Extraction-quality hardening tests.
 *
 * Driven by a real Ontario transcript where the first message
 * "My name is Mike smith, I like in simcoe county was married 2928 days
 *  to marry Ellis Jane smith son-wyatt" produced four failures:
 * missed spouse extraction (re-asked twice), truncated compound name
 * ("Ellis Smith"), lowercase names in the decree, and verbatim-typo facts —
 * plus a live audit where free-text custody values ("joint decision making")
 * broke templates that branch on exact codes, inverting a custody decree.
 *
 * All normalization is the MODEL's job (owner decision: no deterministic
 * string munging), so these tests assert the deterministic surfaces we DO
 * control: tool schemas carry the hardened instructions and enum codes, the
 * system/user prompts carry the quality rules and no-re-ask directives, and
 * non-LLM plumbing (sourceQuote provenance, field mapping, phase skipping)
 * behaves correctly.
 */

const { EXTRACTION_QUALITY } = require('../../services/agents/extractionQuality');
const {
  retireFacts,
  sanitizeSupersededStatements,
  MAX_RETIREMENTS_PER_TURN,
} = require('../../services/agents/factRetirement');
const BaseDivorceOrchestrator = require('../../services/agents/BaseDivorceOrchestrator');
const BaseMatterOrchestrator = require('../../services/agents/BaseMatterOrchestrator');
const generalAffidavitOrchestrator = require('../../services/agents/GeneralAffidavitOrchestrator');
const AffidavitService = require('../../services/affidavitService');

function makeDivorceOrchestrator() {
  return new BaseDivorceOrchestrator({
    stateCode: 'ON',
    stateName: 'Ontario',
    phases: {
      INTAKE: { prompt: 'intake prompt', displayName: 'Getting Started' },
      REVIEW: { prompt: 'review prompt', displayName: 'Review' },
    },
    phaseOrder: ['INTAKE', 'REVIEW'],
  });
}

function makeMatterOrchestrator() {
  return new BaseMatterOrchestrator({
    stateCode: 'TX',
    stateName: 'Texas',
    matterTypeCode: 'custody',
    practiceArea: 'family',
    phases: {
      INTAKE: { prompt: 'intake prompt', displayName: 'Getting Started' },
      REVIEW: { prompt: 'review prompt', displayName: 'Review' },
    },
    phaseOrder: ['INTAKE', 'REVIEW'],
    fieldMap: {
      petitioner_first_name: 'petitionerFirstName',
      petitioner_last_name:  'petitionerLastName',
      county:                'county',
    },
  });
}

function makeAffidavitService() {
  return new AffidavitService({
    getSupportedStates: () => [{ code: 'TX', name: 'Texas' }],
  });
}

// ─── Shared prompt block ─────────────────────────────────────────────────────

describe('EXTRACTION_QUALITY prompt block', () => {
  test('covers all transcript failure modes', () => {
    expect(EXTRACTION_QUALITY).toMatch(/hyphenated or multi-word compound surnames/);
    expect(EXTRACTION_QUALITY).toMatch(/"Ellis Jane", last name: "Smith Son-Wyatt"/);
    expect(EXTRACTION_QUALITY).toMatch(/"mike smith" → "Mike Smith"/);
    expect(EXTRACTION_QUALITY).toMatch(/PRESERVING any internal capitals/);
    expect(EXTRACTION_QUALITY).toMatch(/I like in simcoe county/);
    expect(EXTRACTION_QUALITY).toMatch(/EXTRACT EVERYTHING, ASK ONE THING/);
    expect(EXTRACTION_QUALITY).toMatch(/NEVER RE-ASK/);
    expect(EXTRACTION_QUALITY).toMatch(/married 2928 days/);
    expect(EXTRACTION_QUALITY).toMatch(/35 yeRs/);
  });

  test('demands exact enum codes for machine-read fields', () => {
    expect(EXTRACTION_QUALITY).toMatch(/MACHINE-READ ENUM FIELDS/);
    expect(EXTRACTION_QUALITY).toMatch(/emit EXACTLY one of those codes/i);
  });

  test('fact hygiene: bans self-contradictory and near-duplicate facts', () => {
    expect(EXTRACTION_QUALITY).toMatch(/NO SELF-CONTRADICTORY FACTS/);
    expect(EXTRACTION_QUALITY).toMatch(/waive the filing fee because money will be tight but I do not want/);
    expect(EXTRACTION_QUALITY).toMatch(/NO NEAR-DUPLICATE FACTS/);
    expect(EXTRACTION_QUALITY).toMatch(/do NOT emit it again/i);
  });

  test('demands neutral third-person phrasing in court-order value fields', () => {
    expect(EXTRACTION_QUALITY).toMatch(/NEUTRAL THIRD-PERSON IN COURT-ORDER VALUE FIELDS/);
    expect(EXTRACTION_QUALITY).toMatch(/to be refinanced into the petitioner's name/);
    expect(EXTRACTION_QUALITY).toMatch(/never "to be refinanced into my name"/);
  });

  test('forbids word-identical re-asks', () => {
    expect(EXTRACTION_QUALITY).toMatch(/VARY RE-ASK PHRASING/);
    expect(EXTRACTION_QUALITY).toMatch(/NEVER repeat a previous question word-for-word/i);
  });
});

// ─── Correction retirement plumbing (factRetirement) ─────────────────────────

describe('factRetirement plumbing', () => {
  const facts = [
    { id: 'a', content: 'Daniel Hatch and I separated at the end of February 2026.' },
    { id: 'b', content: 'I married Daniel Hatch in Provo on February 14, 2012.' },
    { id: 'c', content: 'I live in Salt Lake County, Utah.' },
  ];

  test('retires an exact normalized match', () => {
    const { kept, retired } = retireFacts(facts, [
      'daniel hatch and I separated at the end of   February 2026.',
    ]);
    expect(retired.map((f) => f.id)).toEqual(['a']);
    expect(kept.map((f) => f.id)).toEqual(['b', 'c']);
  });

  test('retires on substring match in either direction', () => {
    const { retired } = retireFacts(facts, ['separated at the end of February 2026']);
    expect(retired.map((f) => f.id)).toEqual(['a']);
    const wider = retireFacts(facts, [
      'The recorded fact said: I live in Salt Lake County, Utah. That was wrong.',
    ]);
    expect(wider.retired.map((f) => f.id)).toEqual(['c']);
  });

  test('never retires when nothing matches', () => {
    const { kept, retired } = retireFacts(facts, ['a completely unrelated statement about boats']);
    expect(retired).toEqual([]);
    expect(kept).toHaveLength(3);
  });

  test('ignores statements too short to match safely', () => {
    const { retired } = retireFacts(facts, ['utah', 'yes', '']);
    expect(retired).toEqual([]);
  });

  test(`caps retirements at ${MAX_RETIREMENTS_PER_TURN} per turn`, () => {
    const many = Array.from({ length: 6 }, (_, i) => ({
      id: String(i),
      content: `This is recorded fact number ${i} about the marriage.`,
    }));
    const statements = many.map((f) => f.content);
    const { retired } = retireFacts(many, statements);
    expect(retired).toHaveLength(MAX_RETIREMENTS_PER_TURN);
    expect(sanitizeSupersededStatements(statements)).toHaveLength(MAX_RETIREMENTS_PER_TURN);
  });
});

// ─── BaseDivorceOrchestrator ─────────────────────────────────────────────────

describe('BaseDivorceOrchestrator extraction hardening', () => {
  const orch = makeDivorceOrchestrator();
  const props = orch.tool.function.parameters.properties;

  test('name field descriptions demand full names and compound surnames', () => {
    expect(props.petitioner_first_name.description).toMatch(/middle name/i);
    expect(props.petitioner_last_name.description).toMatch(/hyphenated and multi-word compound surnames/i);
    expect(props.petitioner_last_name.description).toMatch(/Smith Son-Wyatt/);
    expect(props.respondent_first_name.description).toMatch(/ANY mention of the spouse/i);
    expect(props.respondent_last_name.description).toMatch(/never just "Smith"/);
    expect(props.petitioner_first_name.description).toMatch(/McDonald/);
  });

  test('county and residency descriptions demand cleanup and unit conversion', () => {
    expect(props.county.description).toMatch(/proper name case/i);
    expect(props.county.description).toMatch(/simcoe/i);
    expect(props.residency_state_months.description).toMatch(/"5 years" → 60/);
    expect(props.residency_county_days.description).toMatch(/"3 months" → 90/);
  });

  test('marriage_duration field exists and maps through to divorceData', () => {
    expect(props.marriage_duration.description).toMatch(/2928 days/);
    const data = orch._applyFieldUpdates({}, { marriage_duration: '2928 days (approximately 8 years)' });
    expect(data.marriageDuration).toBe('2928 days (approximately 8 years)');
    expect(orch._summarizeCollected(data)).toContain('Marriage length: 2928 days (approximately 8 years)');
  });

  test('machine-read fields are constrained to exact enum codes', () => {
    expect(props.custody_arrangement.enum).toEqual(
      ['joint', 'sole_petitioner', 'sole_respondent', 'shared', 'split', 'contested', 'undecided']
    );
    expect(props.custody_arrangement.description).toMatch(/"joint decision making".*→ joint/);
    expect(props.service_method.enum).toEqual(['waiver', 'formal', 'publication', 'undecided']);
    expect(props.service_method.description).toMatch(/acknowledgment.*→ waiver/i);
    expect(props.property_agreement.enum).toEqual(['agreed', 'contested', 'pending']);
    expect(props.parent_time_plan.enum).toEqual(['statutory_minimum', 'expanded', 'equal', 'custom']);
    expect(props.child_support_payor.enum).toEqual(['petitioner', 'respondent']);
    expect(props.respondent_military_status.enum).toEqual(['not_military', 'military', 'unknown']);
    expect(props.name_change_party.enum).toEqual(['petitioner', 'respondent']);
    expect(props.spousal_support_requested.type).toBe('boolean');
  });

  test('primary residence is captured separately from the custody code', () => {
    expect(props.primary_custodian.description).toMatch(/LIVE with/i);
    expect(props.custody_arrangement.description).toMatch(/primary_custodian/);
  });

  test('the orchestrator stores the enum code, and the custodyType alias carries it', () => {
    const data = orch._applyFieldUpdates({}, {
      custody_arrangement: 'joint',
      service_method: 'waiver',
      property_agreement: 'agreed',
    });
    expect(data.custodyArrangement).toBe('joint');
    expect(data.custodyType).toBe('joint'); // templates branch on custodyType === 'joint'
    expect(data.serviceMethod).toBe('waiver');
    expect(data.propertyAgreement).toBe('agreed');
  });

  test('extracted_facts content demands cleaned statements, not transcriptions', () => {
    const content = props.extracted_facts.items.properties.content.description;
    expect(content).toMatch(/typos and speech-to-text noise corrected/i);
    expect(content).toMatch(/verbatim words are stored separately/i);
  });

  test('system prompt includes the shared quality rules and drops the verbatim-values rule', () => {
    const prompt = orch._buildSystemPrompt({ currentPhase: 'INTAKE' }, {});
    expect(prompt).toContain('DATA QUALITY RULES');
    expect(prompt).toMatch(/never re-ask for anything shown in ALREADY COLLECTED/i);
    expect(prompt).not.toMatch(/Keep extracted field VALUES in the user's words/);
  });

  test('facts keep cleaned content with verbatim sourceQuote provenance', () => {
    const message = 'I like in simcoe county was married 2928 days';
    const facts = orch._buildFacts(
      [{ content: 'I live in Simcoe County, Ontario.', category: 'residency' }],
      {}, 'RESIDENCY', message
    );
    expect(facts[0].content).toBe('I live in Simcoe County, Ontario.');
    expect(facts[0].sourceQuote).toBe(message);
  });

  test('user prompt marks ALREADY COLLECTED as do-not-re-ask', () => {
    const prompt = orch._buildUserPrompt('hello', {
      petitionerFirstName: 'Mike', petitionerLastName: 'Smith',
      respondentFirstName: 'Ellis Jane', respondentLastName: 'Smith Son-Wyatt',
    }, { currentPhase: 'INTAKE', completedPhases: [] });
    expect(prompt).toMatch(/do NOT ask for any of this again/);
    expect(prompt).toContain('Ellis Jane Smith Son-Wyatt');
  });

  test('starting phase skips INTAKE when both parties were already extracted', () => {
    expect(orch._determineStartingPhase({
      petitionerFirstName: 'Mike', petitionerLastName: 'Smith',
      respondentFirstName: 'Ellis Jane', respondentLastName: 'Smith Son-Wyatt',
    })).toBe('RESIDENCY');
  });
});

// ─── BaseMatterOrchestrator ──────────────────────────────────────────────────

describe('BaseMatterOrchestrator extraction hardening', () => {
  const orch = makeMatterOrchestrator();

  test('system prompt includes the shared quality rules', () => {
    const prompt = orch._buildSystemPrompt({ currentPhase: 'INTAKE' }, {});
    expect(prompt).toContain('DATA QUALITY RULES');
    expect(prompt).not.toMatch(/Keep extracted field VALUES in the user's words/);
  });

  test('default tool fact content demands cleaned statements', () => {
    const content = orch._defaultTool().function.parameters.properties
      .extracted_facts.items.properties.content.description;
    expect(content).toMatch(/typos and speech-to-text noise corrected/i);
  });

  test('facts keep cleaned content with verbatim sourceQuote provenance', () => {
    const message = 'I like in simcoe county';
    const facts = orch._buildFacts(
      [{ content: 'I live in Simcoe County.', category: 'identity' }],
      'INTAKE', message
    );
    expect(facts[0].content).toBe('I live in Simcoe County.');
    expect(facts[0].sourceQuote).toBe(message);
  });

  test('user prompt marks ALREADY COLLECTED as do-not-re-ask', () => {
    const prompt = orch._buildUserPrompt('hi', { petitionerName: 'Mike Smith' }, { currentPhase: 'INTAKE' });
    expect(prompt).toMatch(/do NOT ask for any of this again/);
  });
});

// ─── GeneralAffidavitOrchestrator ────────────────────────────────────────────

describe('GeneralAffidavitOrchestrator extraction hardening', () => {
  const orch = generalAffidavitOrchestrator;

  test('every phase prompt carries the quality rules', () => {
    expect(orch._getSystemPrompt('PARTIES', {}, [])).toContain('DATA QUALITY RULES');
    expect(orch._getSystemPrompt('FACTS', { affidavitType: 'general_affidavit' }, []))
      .toContain('DATA QUALITY RULES');
  });

  test('user prompt marks ALREADY COLLECTED as do-not-re-ask', () => {
    const prompt = orch._buildUserPrompt('hi', { affiantFirstName: 'Mike' }, { currentPhase: 'PARTIES' });
    expect(prompt).toMatch(/do NOT ask for any of this again/);
  });

  test('facts keep cleaned content with verbatim sourceQuote provenance', () => {
    const message = 'My name is mike smith';
    const facts = orch._buildFacts(
      [{ content: 'My name is Mike Smith.', category: 'identity' }],
      'PARTIES', message
    );
    expect(facts[0].content).toBe('My name is Mike Smith.');
    expect(facts[0].sourceQuote).toBe(message);
  });
});

// ─── AffidavitService (legacy general + divorce paths) ───────────────────────

describe('AffidavitService extraction hardening', () => {
  const service = makeAffidavitService();

  test('affidavit tool name/county/fact descriptions carry the new rules', () => {
    const props = service.createAffidavitProcessingTool().function.parameters.properties;
    expect(props.extracted_first_name.description).toMatch(/middle name/i);
    expect(props.extracted_last_name.description).toMatch(/hyphenated and multi-word compound surnames/i);
    expect(props.extracted_county.description).toMatch(/proper name case/i);
    expect(props.extracted_facts.items.properties.content.description)
      .toMatch(/typos and speech-to-text noise corrected/i);
  });

  test('divorce tool name descriptions carry the new rules', () => {
    const props = service.createDivorceProcessingTool().function.parameters.properties;
    expect(props.petitioner_last_name.description).toMatch(/Smith Son-Wyatt/);
    expect(props.respondent_first_name.description).toMatch(/ANY mention of the spouse/i);
    expect(props.residency_duration.description).toMatch(/35 yeRs/);
    expect(props.extracted_facts.items.properties.content.description)
      .toMatch(/typos and speech-to-text noise corrected/i);
  });

  test('both system prompts include the shared quality rules', () => {
    expect(service.createConsolidatedSystemPrompt()).toContain('DATA QUALITY RULES');
    expect(service.createDivorceSystemPrompt()).toContain('DATA QUALITY RULES');
  });

  test('processToolCall stamps sourceQuote provenance and keeps cleaned content', () => {
    const message = 'My name is mike smith, I like in simcoe county';
    const result = service.processToolCall({
      chat_response: 'ok',
      extracted_first_name: 'Mike',
      extracted_last_name: 'Smith',
      extracted_facts: [{ content: 'I live in Simcoe County.', category: 'temporal' }],
    }, {}, message);
    expect(result.updatedAffidavitData.affiantName).toBe('Mike Smith');
    expect(result.extractedFacts[0].sourceQuote).toBe(message);
    expect(result.extractedFacts[0].content).toBe('I live in Simcoe County.');
  });

  test('processDivorceToolCall stamps sourceQuote provenance on facts', () => {
    const message = 'was married 2928 days to marry Ellis Jane smith son-wyatt';
    const result = service.processDivorceToolCall({
      chat_response: 'ok',
      respondent_first_name: 'Ellis Jane',
      respondent_last_name: 'Smith Son-Wyatt',
      extracted_facts: [{
        content: 'I was married to Ellis Jane Smith Son-Wyatt for 2,928 days.',
        category: 'marriage',
      }],
    }, {}, message);
    expect(result.updatedAffidavitData.respondentFirstName).toBe('Ellis Jane');
    expect(result.updatedAffidavitData.respondentLastName).toBe('Smith Son-Wyatt');
    expect(result.extractedFacts[0].sourceQuote).toBe(message);
  });
});

// ─── Property/debt list integrity (persona run: "$62,000" shattered) ─────────

describe('property/debt lists are LLM-built arrays, never comma-split', () => {
  const orch = makeDivorceOrchestrator();
  const props = orch.tool.function.parameters.properties;
  const LIST_FIELDS = ['petitioner_property', 'respondent_property', 'petitioner_debts', 'respondent_debts'];

  test('schema fields are string arrays demanding ONE complete item with value intact', () => {
    for (const field of LIST_FIELDS) {
      expect(props[field].type).toBe('array');
      expect(props[field].items).toEqual({ type: 'string' });
      expect(props[field].description).toMatch(/ONE complete (asset|debt)/);
      expect(props[field].description).toMatch(/NEVER split/i);
      expect(props[field].description).not.toMatch(/comma-separated/i);
    }
    expect(props.petitioner_property.description).toMatch(/\$62,000/);
    expect(props.petitioner_debts.description).toMatch(/refinanced into the petitioner's name/);
  });

  test('schema demands neutral third-person phrasing, never first person', () => {
    for (const field of LIST_FIELDS) {
      expect(props[field].description).toMatch(/neutral third-person/i);
      expect(props[field].description).toMatch(/never "my"\/"me"\/"I"/);
    }
  });

  test('array values pass through intact — currency commas survive', () => {
    const data = orch._applyFieldUpdates({}, {
      respondent_property: ['Fidelity 401(k), approximately $62,000', '2021 Toyota Tacoma'],
    });
    expect(data.respondentProperty).toEqual([
      'Fidelity 401(k), approximately $62,000',
      '2021 Toyota Tacoma',
    ]);
  });

  test('a legacy string value becomes a single-element array — never re-split', () => {
    const data = orch._applyFieldUpdates({}, {
      petitioner_debts: "mortgage on 1487 E Sycamore Way, to be refinanced into the petitioner's name",
    });
    expect(data.petitionerDebts).toEqual([
      "mortgage on 1487 E Sycamore Way, to be refinanced into the petitioner's name",
    ]);
  });

  test('entries append to the collected list and dedupe, never dropping prior items', () => {
    const data = orch._applyFieldUpdates(
      { petitionerProperty: ['2019 Honda Odyssey'] },
      { petitioner_property: ['2019 Honda Odyssey', 'the marital home at 1487 E Sycamore Way'] },
    );
    expect(data.petitionerProperty).toEqual([
      '2019 Honda Odyssey',
      'the marital home at 1487 E Sycamore Way',
    ]);
  });
});

// ─── Role-aware income semantics (persona run: $17,200 household total) ──────

describe('role-aware income mapping', () => {
  const orch = makeDivorceOrchestrator();
  const props = orch.tool.function.parameters.properties;

  test('schema has per-party income fields and bans household totals', () => {
    expect(props.petitioner_monthly_income.type).toBe('number');
    expect(props.respondent_monthly_income.type).toBe('number');
    expect(props.petitioner_monthly_income.description).toMatch(/never a combined total/i);
    expect(props.monthly_income.description).toMatch(/NEVER a combined or household total/);
  });

  test('petitioner user: own income → monthlyIncome, spouse → spouseMonthlyIncome', () => {
    const data = orch._applyFieldUpdates({}, {
      petitioner_monthly_income: 3400,
      respondent_monthly_income: 5200,
    });
    expect(data.monthlyIncome).toBe(3400);
    expect(data.spouseMonthlyIncome).toBe(5200);
  });

  test('respondent user: mapping mirrors (same convention as affiantName)', () => {
    const data = orch._applyFieldUpdates({ role: 'respondent' }, {
      petitioner_monthly_income: 3400,
      respondent_monthly_income: 5200,
    });
    expect(data.monthlyIncome).toBe(5200);
    expect(data.spouseMonthlyIncome).toBe(3400);
  });

  test('incomeBreakdown totals are per-person — never a household sum', () => {
    const data = orch._applyFieldUpdates({}, {
      income_breakdown: [
        { label: 'Your wages', amount: 3400, person: 'petitioner' },
        { label: 'Spouse wages', amount: 5200, person: 'respondent' },
      ],
    });
    expect(data.monthlyIncome).toBe(3400); // NOT 8600
    expect(data.spouseMonthlyIncome).toBe(5200);
  });

  test('untagged breakdown entries count as the user\'s own income', () => {
    const data = orch._applyFieldUpdates({}, {
      income_breakdown: [{ label: 'My wages', amount: 3400 }],
    });
    expect(data.monthlyIncome).toBe(3400);
    expect(data.spouseMonthlyIncome).toBeUndefined();
  });

  test('breakdown schema demands the complete per-person list (replace semantics) so items never duplicate', () => {
    expect(props.income_breakdown.description).toMatch(/REPLACE-PER-PERSON/);
    expect(props.income_breakdown.description).toMatch(/COMPLETE list of income items/);
    expect(props.income_breakdown.description).toMatch(/EXACTLY as summarized/i);
    expect(props.expense_breakdown.description).toMatch(/COMPLETE current expense list/);
    expect(props.expense_breakdown.description).toMatch(/REPLACES/);
  });
});

// ─── Correction retirement wiring (orchestrators) ────────────────────────────

describe('superseded_facts wiring', () => {
  test('divorce tool schema carries superseded_facts with a conservative description', () => {
    const props = makeDivorceOrchestrator().tool.function.parameters.properties;
    expect(props.superseded_facts.type).toBe('array');
    expect(props.superseded_facts.items).toEqual({ type: 'string' });
    expect(props.superseded_facts.description).toMatch(/CORRECTED or CONTRADICTED/);
    expect(props.superseded_facts.description).toMatch(/ONLY when the user explicitly corrected themselves/);
  });

  test('matter orchestrators get superseded_facts injected even into custom tools', () => {
    const orch = new BaseMatterOrchestrator({
      stateCode: 'TX',
      matterTypeCode: 'custody',
      phases: { INTAKE: { prompt: 'p', displayName: 'Intake' } },
      phaseOrder: ['INTAKE'],
      buildTool: () => ({
        type: 'function',
        function: {
          name: 'process_matter_data',
          parameters: { type: 'object', properties: { response: { type: 'string' } } },
        },
      }),
    });
    expect(orch.tool.function.parameters.properties.superseded_facts.type).toBe('array');
    // Default tool has it too
    expect(
      makeMatterOrchestrator().tool.function.parameters.properties.superseded_facts.type
    ).toBe('array');
  });

  test('a correction retires the superseded fact card and reports the statements', () => {
    const orch = makeDivorceOrchestrator();
    const data = {
      facts: [
        { id: 'old', content: 'Daniel Hatch and I separated at the end of February 2026.' },
        { id: 'keep', content: 'I married Daniel Hatch in Provo on February 14, 2012.' },
      ],
    };
    orch._applySupersededFacts(data, ['Daniel Hatch and I separated at the end of February 2026.']);
    expect(data.facts.map((f) => f.id)).toEqual(['keep']);
    expect(data.retiredFactStatements).toEqual([
      'Daniel Hatch and I separated at the end of February 2026.',
    ]);
  });

  test('unmatched corrections retire nothing but still flow to the profile', () => {
    const orch = makeDivorceOrchestrator();
    const data = { facts: [{ id: 'a', content: 'I live in Salt Lake County.' }] };
    orch._applySupersededFacts(data, ['some statement recorded only in the profile store']);
    expect(data.facts).toHaveLength(1);
    expect(data.retiredFactStatements).toEqual([
      'some statement recorded only in the profile store',
    ]);
  });

  test('retiredFactStatements is cleared on turns with no corrections (stale never re-applies)', () => {
    const orch = makeDivorceOrchestrator();
    const data = { facts: [], retiredFactStatements: ['stale statement from last turn'] };
    orch._applySupersededFacts(data, undefined);
    expect(data.retiredFactStatements).toBeUndefined();
  });

  test('matter and general orchestrators share the same retirement contract', () => {
    const generalOrch = generalAffidavitOrchestrator;
    const matterOrch = makeMatterOrchestrator();
    for (const orch of [generalOrch, matterOrch]) {
      const data = { facts: [{ id: 'x', content: 'The lease started on January 1, 2025.' }] };
      orch._applySupersededFacts(data, ['The lease started on January 1, 2025.']);
      expect(data.facts).toEqual([]);
      expect(data.retiredFactStatements).toHaveLength(1);
    }
  });
});

// ─── DMDC soft gate (persona run: verbatim date-demand loop) ─────────────────

describe('DMDC military search soft gate', () => {
  const orch = new BaseDivorceOrchestrator({
    stateCode: 'UT',
    stateName: 'Utah',
    phases: {
      MILITARY: { prompt: 'military prompt', displayName: 'Military Status' },
      REVIEW:   { prompt: 'review prompt', displayName: 'Review' },
    },
    phaseOrder: ['MILITARY', 'REVIEW'],
  });

  test('schema accepts a non-date commitment and says it satisfies the question', () => {
    const props = orch.tool.function.parameters.properties;
    expect(props.military_search_planned.enum).toEqual(
      ['before_filing', 'date_scheduled', 'already_completed']
    );
    expect(props.military_search_planned.description).toMatch(/before I file/i);
    expect(props.military_search_planned.description).toMatch(/SATISFIES the DMDC search question/);
  });

  test('military_search_planned maps to dmdcSearchPlanned', () => {
    const data = orch._applyFieldUpdates({}, { military_search_planned: 'before_filing' });
    expect(data.dmdcSearchPlanned).toBe('before_filing');
  });

  test('a planned search satisfies the MILITARY phase without a date', () => {
    expect(orch._phaseAlreadySatisfied('MILITARY', {
      respondentMilitaryStatus: 'not_military',
      dmdcSearchPlanned: 'before_filing',
    })).toBe(true);
    expect(orch._phaseAlreadySatisfied('MILITARY', {
      respondentMilitaryStatus: 'not_military',
    })).toBe(false);
  });

  test('MILITARY system prompt carries the soft gate and no-verbatim-repeat rule', () => {
    const prompt = orch._buildSystemPrompt({ currentPhase: 'MILITARY' }, {});
    expect(prompt).toMatch(/DMDC SEARCH — SOFT GATE/);
    expect(prompt).toMatch(/fully satisfies the DMDC question/i);
    expect(prompt).toMatch(/Never repeat a question word-for-word/);
  });
});

// ─── AffidavitService correction plumbing ────────────────────────────────────

describe('AffidavitService superseded_facts plumbing', () => {
  const service = makeAffidavitService();

  test('both tools expose superseded_facts', () => {
    expect(
      service.createAffidavitProcessingTool().function.parameters.properties.superseded_facts.type
    ).toBe('array');
    expect(
      service.createDivorceProcessingTool().function.parameters.properties.superseded_facts.type
    ).toBe('array');
  });

  test('divorce property/debt value fields demand neutral third-person phrasing', () => {
    const props = service.createDivorceProcessingTool().function.parameters.properties;
    expect(props.debts_description.description).toMatch(/neutral third-person/i);
    expect(props.debts_description.description).toMatch(/refinanced into the petitioner's name/);
    expect(props.property_division_preference.description).toMatch(/neutral third-person/i);
    expect(props.real_estate.description).toMatch(/neutral third-person/i);
  });

  test('processToolCall retires superseded facts and reports the statements', () => {
    const result = service.processToolCall({
      chat_response: 'ok',
      superseded_facts: ['I moved out at the end of February.'],
    }, {
      facts: [
        { id: 'old', content: 'I moved out at the end of February.' },
        { id: 'keep', content: 'I live in Simcoe County.' },
      ],
    }, 'wait actually it was March 1');
    expect(result.updatedAffidavitData.facts.map((f) => f.id)).toEqual(['keep']);
    expect(result.updatedAffidavitData.retiredFactStatements).toEqual([
      'I moved out at the end of February.',
    ]);
  });

  test('processDivorceToolCall retires superseded facts before appending new ones', () => {
    const result = service.processDivorceToolCall({
      chat_response: 'ok',
      superseded_facts: ['We separated at the end of February 2026.'],
      extracted_facts: [{ content: 'We separated on March 1, 2026.', category: 'marriage' }],
    }, {
      facts: [{ id: 'old', content: 'We separated at the end of February 2026.' }],
    }, 'wait actually march 1');
    const contents = result.updatedAffidavitData.facts.map((f) => f.content);
    expect(contents).toEqual(['We separated on March 1, 2026.']);
  });
});
