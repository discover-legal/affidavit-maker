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
