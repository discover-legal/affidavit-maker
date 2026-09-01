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

  // v22-B: rule 20 covers BOTH the "no children" and the adult-only cases.
  // Alison (2 adult) and Tavita (0) both had the LLM record only prose,
  // leaving profile.numberOfChildren null on the story page.
  test('rule 20 covers both "no children" (Tavita, 0) and adult-only (Alison, N) cases', () => {
    expect(EXTRACTION_QUALITY).toMatch(/CHILDREN COUNT — ALWAYS EMIT THE STRUCTURED COUNT/);
    // "No children" branch — Tavita shape.
    expect(EXTRACTION_QUALITY).toMatch(/NO CHILDREN/);
    expect(EXTRACTION_QUALITY).toMatch(/has_minor_children: false AND number_of_children: 0/);
    expect(EXTRACTION_QUALITY).toMatch(/Tavita \(FL, no kids\) failure/);
    // Adult-only branch — Alison shape.
    expect(EXTRACTION_QUALITY).toMatch(/ADULT-ONLY CHILDREN/);
    expect(EXTRACTION_QUALITY).toMatch(/two adult kids/);
    expect(EXTRACTION_QUALITY).toMatch(/has_minor_children: false AND number_of_children: N/);
    expect(EXTRACTION_QUALITY).toMatch(/Alison \(CA, 2 adult kids\) failure/);
    // Emphasises: adult children still count toward number_of_children.
    expect(EXTRACTION_QUALITY).toMatch(/the field is the COUNT of children of the marriage, minor or adult/);
  });

  // Alison v8-B replay guard: "we have two kids ages 24 and 21" produced a
  // profile.children array 25 entries long (2 anonymous kids re-emitted every
  // turn, cap hit) and the CA petition read "There are 25 adult children of
  // the marriage". The children schema description must (a) tell the LLM
  // that one array entry = one distinct child and NEVER a sum/concat of
  // ages, and (b) require a name (real or placeholder) so mergeChildren
  // can dedupe on re-mention.
  test('children field schema description prevents the Alison "25 kids" duplication', () => {
    const orch = makeDivorceOrchestrator();
    const props = orch.tool.function.parameters.properties;
    expect(props.children).toBeDefined();
    const desc = props.children.description || '';
    expect(desc).toMatch(/ONE ENTRY PER DISTINCT CHILD/);
    expect(desc).toMatch(/kids are 24 and 21/);
    expect(desc).toMatch(/\bTWO entries\b/);
    expect(desc).toMatch(/NOT 25/);
    expect(desc).toMatch(/DO NOT re-send children already in ALREADY COLLECTED/);
    expect(desc).toMatch(/synthesize a stable placeholder/);
    // Nested item props also carry the guardrail so age-only entries do
    // not lose the "one child per entry" constraint.
    const items = props.children.items || {};
    expect(items.properties.age.description).toMatch(/never a joined multi-digit string/);
    expect(items.properties.name.description).toMatch(/placeholder/);
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
    expect(props.respondent_first_name.description).toMatch(/ANY mention of the non-filing spouse/i);
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

  // v11-B: schema-typed fact companions carry structured payloads alongside
  // the sworn-prose content string so profile-merge promotion can route the
  // quantity/place into the right structured scalar without string-parsing.
  test('extracted_facts item schema declares numeric_value and place_value companions', () => {
    const itemProps = props.extracted_facts.items.properties;
    expect(itemProps.numeric_value).toBeDefined();
    expect(itemProps.numeric_value.type).toEqual(expect.arrayContaining(['number']));
    expect(itemProps.numeric_value.description).toMatch(/numeric quantity/i);
    expect(itemProps.place_value).toBeDefined();
    expect(itemProps.place_value.type).toEqual(expect.arrayContaining(['string']));
    expect(itemProps.place_value.description).toMatch(/place/i);
    expect(itemProps.place_value.description).toMatch(/hedge/i);
  });

  // v21-A: grounds_value companion so a narrated ground (David NY
  // "irretrievable breakdown", Amara GA "documented cruelty") reaches the
  // durable profile via the same shape-check promotion the other companions use.
  test('extracted_facts item schema declares the grounds_value companion (v21-A)', () => {
    const itemProps = props.extracted_facts.items.properties;
    expect(itemProps.grounds_value).toBeDefined();
    expect(itemProps.grounds_value.type).toEqual(expect.arrayContaining(['string']));
    expect(itemProps.grounds_value.description).toMatch(/grounds/i);
    expect(itemProps.grounds_value.description).toMatch(/snake_case/);
    expect(itemProps.grounds_value.description).toMatch(/irretrievable_breakdown/);
    expect(itemProps.grounds_value.description).toMatch(/cruel_treatment/);
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
    expect(props.respondent_first_name.description).toMatch(/ANY mention of the non-filing party/i);
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

  test('REPLACE-PER-PARTY: this turn\'s list supersedes the stored list for that party; the other side is untouched', () => {
    // Mirrors the income breakdown contract: a live turn where the model
    // restated 3 items must land as 3 stored items, never 6.
    const data = orch._applyFieldUpdates(
      {
        petitionerProperty: ['old stale item that was corrected'],
        respondentProperty: ['2021 Toyota Tacoma'],
      },
      { petitioner_property: [
        '2019 Honda Odyssey',
        'the marital home at 1487 E Sycamore Way',
        'Fidelity 401(k), approximately $62,000',
      ] },
    );
    expect(data.petitionerProperty).toEqual([
      '2019 Honda Odyssey',
      'the marital home at 1487 E Sycamore Way',
      'Fidelity 401(k), approximately $62,000',
    ]);
    // Respondent's stored property is untouched — no field for it this turn.
    expect(data.respondentProperty).toEqual(['2021 Toyota Tacoma']);
  });

  test('same-turn dedupe collapses label-variant restatements, keeping the LONGER wording', () => {
    // Cross-persona real symptom: a single turn restated the same asset
    // under two labels. Normalize (whitespace/punct/currency/articles),
    // collide, keep the longer original — truly distinct items survive.
    const data = orch._applyFieldUpdates({}, {
      petitioner_property: [
        '$18k dog-grooming business',
        'the mobile dog-grooming business worth $18k',
        '2021 Toyota Tacoma',
      ],
    });
    expect(data.petitionerProperty).toEqual([
      'the mobile dog-grooming business worth $18k',
      '2021 Toyota Tacoma',
    ]);
  });

  test('schema descriptions carry the replace-per-person, attribution, negative-equity, and separate-property rules', () => {
    for (const field of LIST_FIELDS) {
      expect(props[field].description).toMatch(/REPLACE-PER-PERSON/);
      expect(props[field].description).toMatch(/COMPLETE list/);
    }
    // Any asset/debt in a fact MUST populate the list — Marcus persona.
    expect(props.petitioner_property.description).toMatch(/mentioned in extracted_facts MUST also appear here/);
    expect(props.petitioner_debts.description).toMatch(/mentioned in extracted_facts MUST also appear here/);
    // Negative equity preserved.
    expect(props.petitioner_property.description).toMatch(/underwater by approximately \$22,000/);
    // Separate-property prefix (naming convention the templates consume).
    expect(props.petitioner_property.description).toMatch(/Separate property: /);
    expect(props.petitioner_debts.description).toMatch(/Separate debt: /);
  });
});

describe('EXTRACTION_QUALITY covers property/debt attribution and negative equity', () => {
  test('attribution rule: any asset or debt in a fact must populate the list field', () => {
    expect(EXTRACTION_QUALITY).toMatch(/ASSETS AND DEBTS MUST POPULATE THEIR LIST FIELDS/);
    // The exact Marcus persona failure is cited as the example.
    expect(EXTRACTION_QUALITY).toMatch(/87 Ridgemount Crescent/);
  });

  test('negative-equity rule preserves the negative sign / underwater phrasing', () => {
    expect(EXTRACTION_QUALITY).toMatch(/PRESERVE NEGATIVE EQUITY/);
    expect(EXTRACTION_QUALITY).toMatch(/underwater by \$X/);
    expect(EXTRACTION_QUALITY).toMatch(/never truncate to a positive value/i);
  });

  test('separate-vs-community rule uses the "Separate property:" prefix', () => {
    expect(EXTRACTION_QUALITY).toMatch(/SEPARATE VS COMMUNITY\/MARITAL PROPERTY/);
    expect(EXTRACTION_QUALITY).toMatch(/prefix that list entry with "Separate property: "/);
    // Texas Mari's $45k inherited CD is cited as the example.
    expect(EXTRACTION_QUALITY).toMatch(/inherited from Aunt Rita/);
  });

  test('rule 16: equalization payments are property, never debts', () => {
    expect(EXTRACTION_QUALITY).toMatch(/EQUALIZATION PAYMENTS ARE PROPERTY, NOT DEBTS/);
    expect(EXTRACTION_QUALITY).toMatch(/NEVER list the equalization payment as an entry in petitioner_debts \/ respondent_debts/);
    // The exact live-run failure is cited.
    expect(EXTRACTION_QUALITY).toMatch(/\$80,000 equalization payment under ALLOCATION OF DEBTS/);
  });

  test('rule 17: date completion infers year from context — Marcus persona', () => {
    // Marcus persona (Ontario acceptance v6): user typed "june 24"; the
    // model wrongly defaulted to the separation-date year (2024) instead
    // of the case-filing year (2025 per file number FS-25-…). The
    // /respond banner then read "deadline passed a year ago" for a real
    // respondent whose deadline is actually weeks out.
    expect(EXTRACTION_QUALITY).toMatch(/DATE COMPLETION — INFER YEAR FROM CONTEXT/);
    expect(EXTRACTION_QUALITY).toMatch(/NEVER silently default to the separation-date year/);
    expect(EXTRACTION_QUALITY).toMatch(/FS-25-…/);
    expect(EXTRACTION_QUALITY).toMatch(/2025-06-24/);
    expect(EXTRACTION_QUALITY).toMatch(/wrongly inferred 2024-06-24/);
    // Fallback contract: current year + fact-note, never a silent guess.
    expect(EXTRACTION_QUALITY).toMatch(/CURRENT calendar year/);
    expect(EXTRACTION_QUALITY).toMatch(/year was assumed/i);
  });
});

describe('rule 21: grounds — always emit structured field AND fact companion (v21-A)', () => {
  test('EXTRACTION_QUALITY tells the model to emit both grounds slug and grounds_value companion', () => {
    expect(EXTRACTION_QUALITY).toMatch(/GROUNDS — ALWAYS EMIT BOTH THE STRUCTURED FIELD AND A FACT COMPANION/);
    expect(EXTRACTION_QUALITY).toMatch(/irretrievable_breakdown/);
    expect(EXTRACTION_QUALITY).toMatch(/cruel_treatment/);
    expect(EXTRACTION_QUALITY).toMatch(/grounds_value/);
    expect(EXTRACTION_QUALITY).toMatch(/David \(NY\)/);
    expect(EXTRACTION_QUALITY).toMatch(/Amara \(GA\)/);
  });
});

describe('rule 19: hedge-strip suspected-location values', () => {
  test('EXTRACTION_QUALITY tells the model to strip leading hedge words from suspected_location', () => {
    expect(EXTRACTION_QUALITY).toMatch(/HEDGE-STRIPPED SUSPECTED-LOCATION VALUE/);
    expect(EXTRACTION_QUALITY).toMatch(/"possibly"/);
    expect(EXTRACTION_QUALITY).toMatch(/"maybe"/);
    expect(EXTRACTION_QUALITY).toMatch(/"somewhere in"/);
    expect(EXTRACTION_QUALITY).toMatch(/"I think"/);
    // The rule cites the exact fix: "Possibly Louisiana or Mississippi" → "Louisiana or Mississippi"
    expect(EXTRACTION_QUALITY).toMatch(/Louisiana or Mississippi/);
    expect(EXTRACTION_QUALITY).toMatch(/NOT "Possibly Louisiana or Mississippi"/);
    // Provenance guidance: user's hedged words stay in a fact
    expect(EXTRACTION_QUALITY).toMatch(/exact hedged words in a fact/);
  });
});

describe('service_date schema description carries the year-inference rule', () => {
  const BaseDivorceOrchestrator = require('../../services/agents/BaseDivorceOrchestrator');
  const props = new BaseDivorceOrchestrator({
    stateCode: 'ON',
    stateName: 'Ontario',
    phases: { INTAKE: { prompt: 'intake', displayName: 'Intake' } },
    phaseOrder: ['INTAKE'],
  }).tool.function.parameters.properties;

  test('service_date description cites the Marcus failure verbatim', () => {
    const d = props.service_date.description;
    expect(d).toMatch(/INFER the year from surrounding context/);
    expect(d).toMatch(/FS-25-…/);
    expect(d).toMatch(/2025-06-24/);
    expect(d).toMatch(/NOT 2024-06-24/);
    expect(d).toMatch(/NEVER silently default to the separation-date year/);
    expect(d).toMatch(/CURRENT calendar year/);
    // Deadline-banner blast radius must appear so future editors know
    // why this field's year matters.
    expect(d).toMatch(/deadline banner/i);
  });

  test('service_date description demands the structured field for any narrated service event (ON Marcus v7)', () => {
    // ON acceptance v7: "she served me May 12" (no year) went into a
    // free-text fact only; service_date stayed empty so rule 18 year-
    // inference never fired. The schema must now REQUIRE the structured
    // field whenever the user narrates a service event.
    const d = props.service_date.description;
    expect(d).toMatch(/NEVER OMIT THIS FIELD/);
    expect(d).toMatch(/served May 12/);
    expect(d).toMatch(/free-text fact/);
    expect(d).toMatch(/STRUCTURED field/);
  });
});

// ─── Equalization + prenup schema fields (live CA acceptance run) ────────────

describe('BaseDivorceOrchestrator equalization and prenup schema fields', () => {
  const orch = makeDivorceOrchestrator();
  const props = orch.tool.function.parameters.properties;

  test('equalization fields are present and structured', () => {
    expect(props.equalization_amount.type).toBe('number');
    expect(props.equalization_amount.description).toMatch(/NEVER list the equalization payment as an entry in petitioner_debts/);
    expect(props.equalization_schedule.type).toBe('string');
    expect(props.equalization_schedule.description).toMatch(/schedule/i);
    expect(props.equalization_payor.enum).toEqual(['petitioner', 'respondent']);
    expect(props.equalization_payee.enum).toEqual(['petitioner', 'respondent']);
  });

  test('prenup fields are present and structured', () => {
    expect(props.prenup_signed.type).toBe('boolean');
    expect(props.prenup_signed.description).toMatch(/WHEREAS-style recital/);
    expect(props.prenup_signed_year.type).toBe('number');
    expect(props.prenup_signed_year.minimum).toBe(1900);
    expect(props.prenup_signed_year.maximum).toBe(2100);
    expect(props.prenup_governs_after_divorce.type).toBe('boolean');
    expect(props.prenup_governs_after_divorce.description).toMatch(/continues to govern/);
  });

  test('equalization + prenup snake→camel field mapping lands on the template-read names', () => {
    const data = orch._applyFieldUpdates(
      { petitionerName: 'Alison Rae McPherson', respondentName: 'Devin McPherson' },
      {
        equalization_amount: 80000,
        equalization_schedule: 'in 36 monthly installments of $2,222.22 beginning October 1, 2026',
        equalization_payor: 'petitioner',
        equalization_payee: 'respondent',
        prenup_signed: true,
        prenup_signed_year: 2001,
        prenup_governs_after_divorce: true,
      }
    );
    expect(data.equalizationAmount).toBe(80000);
    expect(data.equalizationSchedule).toMatch(/36 monthly installments/);
    // Role codes resolve to actual names so the decree reads coherently.
    expect(data.equalizationPayor).toBe('Alison Rae McPherson');
    expect(data.equalizationPayee).toBe('Devin McPherson');
    expect(data.prenupSigned).toBe(true);
    expect(data.prenupSignedYear).toBe(2001);
    expect(data.prenupGovernsAfterDivorce).toBe(true);
  });

  test('equalization payee derives from payor when only one side is emitted', () => {
    const data = orch._applyFieldUpdates(
      { petitionerName: 'Alison Rae McPherson', respondentName: 'Devin McPherson' },
      { equalization_amount: 80000, equalization_payor: 'petitioner' }
    );
    expect(data.equalizationPayor).toBe('Alison Rae McPherson');
    expect(data.equalizationPayee).toBe('Devin McPherson');
  });
});

describe('dedupePropertyItems — home/house synonym + token-subset (CA acceptance)', () => {
  const orch = makeDivorceOrchestrator();

  test('collapses "marital home at 1418 …" with "house at 1418 … assigned to the petitioner"', () => {
    const data = orch._applyFieldUpdates({}, {
      petitioner_property: [
        'the marital home at 1418 Willow Glen Terrace in San Jose, valued at approximately $1,200,000 with approximately $860,000 in equity, subject to the $340,000 mortgage assigned to the petitioner',
        'the house at 1418 Willow Glen Terrace in San Jose, assigned to the petitioner',
      ],
    });
    expect(data.petitionerProperty).toHaveLength(1);
    // Keeps the LONGER wording so no detail is lost.
    expect(data.petitionerProperty[0]).toMatch(/valued at approximately \$1,200,000/);
  });

  test('collapses the mortgage duplicate too', () => {
    const data = orch._applyFieldUpdates({}, {
      petitioner_debts: [
        'the mortgage on the marital home at 1418 Willow Glen Terrace in San Jose, approximately $340,000, assigned to the petitioner',
        'the mortgage on the house at 1418 Willow Glen Terrace in San Jose, assigned to the petitioner',
      ],
    });
    expect(data.petitionerDebts).toHaveLength(1);
    expect(data.petitionerDebts[0]).toMatch(/approximately \$340,000/);
  });

  test('leaves truly distinct items alone (a 2021 Toyota is not the marital home)', () => {
    const data = orch._applyFieldUpdates({}, {
      petitioner_property: [
        'the marital home at 1418 Willow Glen Terrace in San Jose',
        '2021 Toyota Tacoma, approximately $28,000',
        'Fidelity 401(k), approximately $62,000',
      ],
    });
    expect(data.petitionerProperty).toHaveLength(3);
  });
});

describe('BaseDivorceOrchestrator._summarizeCollected surfaces property/debt invariants', () => {
  const orch = makeDivorceOrchestrator();

  test('lists each party\'s current property/debt items and instructs restate-exact', () => {
    const summary = orch._summarizeCollected({
      petitionerProperty: ['the marital home at 1487 E Sycamore Way', 'Fidelity 401(k), approximately $62,000'],
      respondentDebts: ['joint Amex balance, approximately $6,400'],
    });
    expect(summary).toMatch(/Petitioner property recorded/);
    expect(summary).toMatch(/restate every one of these items EXACTLY/);
    expect(summary).toMatch(/1487 E Sycamore Way/);
    expect(summary).toMatch(/Respondent debts recorded/);
    expect(summary).toMatch(/joint Amex balance, approximately \$6,400/);
    // The other buckets are silent when empty.
    expect(summary).not.toMatch(/Petitioner debts recorded/);
    expect(summary).not.toMatch(/Respondent property recorded/);
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
    // Seed the user's own name — the phase-satisfied check refuses to mark
    // any non-INTAKE phase satisfied while the name is missing (TX Mari).
    expect(orch._phaseAlreadySatisfied('MILITARY', {
      affiantName: 'Alison Rae McPherson',
      petitionerFirstName: 'Alison',
      respondentMilitaryStatus: 'not_military',
      dmdcSearchPlanned: 'before_filing',
    })).toBe(true);
    expect(orch._phaseAlreadySatisfied('MILITARY', {
      affiantName: 'Alison Rae McPherson',
      petitionerFirstName: 'Alison',
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
