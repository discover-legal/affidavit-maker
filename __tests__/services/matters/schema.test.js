/** @jest-environment node */
'use strict';

const { validateMatterDefinition } = require('../../../services/matters/schema');

function base(overrides = {}) {
  return {
    code: 'sample_claim',
    practice_area: 'civil',
    display_name: 'Sample Claim',
    short_name: 'Sample',
    tagline: 'A sample',
    documents: ['sample_petition'],
    triage: { description: 'A sample dispute', keywords: ['sample'] },
    fields: {
      petitioner_first_name: 'string',
      has_children: 'boolean',
      user_confirmed_review: 'boolean',
    },
    phases: [
      { id: 'INTAKE', display_name: 'Start', required_fields: ['petitioner_first_name'], prompt: 'Intake prompt that is long enough.' },
      { id: 'CHILDREN', display_name: 'Kids', skip_unless_any: ['has_children'], prompt: 'Children prompt that is long enough.' },
      { id: 'REVIEW', display_name: 'Review', required_fields: ['userConfirmedReview'], prompt: 'Review prompt that is long enough.' },
    ],
    ...overrides,
  };
}

function errorsOf(raw) {
  const r = validateMatterDefinition(raw, 'test.yaml');
  expect(r.ok).toBe(false);
  return r.errors.join('\n');
}

describe('matter definition schema', () => {
  test('normalizes a valid definition', () => {
    const r = validateMatterDefinition(base({ shared_rules: 'SHARED RULES\n' }), 'test.yaml');
    expect(r.ok).toBe(true);
    const m = r.matter;
    expect(m.code).toBe('sample_claim');
    expect(m.sortOrder).toBe(1000);
    expect(m.isPackaged).toBe(false);
    expect(m.familyProfile).toBe(false);
    expect(m.supportedJurisdictions).toBeNull();
    expect(m.documentSelection).toBeNull();
    expect(m.fields.map((f) => f.target)).toEqual(['petitionerFirstName', 'hasChildren', 'userConfirmedReview']);
    expect(m.fields[0].schema).toEqual({ type: 'string' });
    expect(m.phases.map((p) => p.id)).toEqual(['INTAKE', 'CHILDREN', 'REVIEW']);
    // required/skip refs resolve to camelCase targets whichever spelling was used
    expect(m.phases[0].requiredFields).toEqual(['petitionerFirstName']);
    expect(m.phases[2].requiredFields).toEqual(['userConfirmedReview']);
    expect(m.phases[1].skipUnlessAny).toEqual(['hasChildren']);
    // conditional phases are optional automatically
    expect(m.phases[1].optional).toBe(true);
    expect(m.phases[0].optional).toBe(false);
    // shared rules are appended to every prompt
    for (const p of m.phases) expect(p.prompt.endsWith('SHARED RULES\n')).toBe(true);
    expect(m.sourceFile).toBe('test.yaml');
  });

  test('accepts explicit targets, nested specs, enums and jurisdictions', () => {
    const r = validateMatterDefinition(
      base({
        supported_jurisdictions: ['on', 'ut'],
        fields: {
          ...base().fields,
          urgency: { type: 'string', enum: ['low', 'high'], target: 'urgencyLevel' },
          children: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' } } } },
        },
      }),
      'test.yaml',
    );
    expect(r.ok).toBe(true);
    expect(r.matter.supportedJurisdictions).toEqual(['ON', 'UT']);
    const urgency = r.matter.fields.find((f) => f.key === 'urgency');
    expect(urgency.target).toBe('urgencyLevel');
    expect(urgency.schema).toEqual({ type: 'string', enum: ['low', 'high'] });
    const children = r.matter.fields.find((f) => f.key === 'children');
    expect(children.schema.items.properties.name).toEqual({ type: 'string' });
  });

  test('rejects reserved field names', () => {
    expect(errorsOf(base({ fields: { ...base().fields, response: 'string' } }))).toMatch(/fields\.response: reserved/);
  });

  test('rejects an array field without items', () => {
    expect(errorsOf(base({ fields: { ...base().fields, kids: { type: 'array' } } }))).toMatch(/array fields need `items`/);
  });

  test('rejects enum on a non-string field', () => {
    expect(errorsOf(base({ fields: { ...base().fields, n: { type: 'number', enum: ['1'] } } }))).toMatch(/`enum` only applies to type: string/);
  });

  test('rejects two fields mapping to the same target', () => {
    const fields = { ...base().fields, other: { type: 'string', target: 'petitionerFirstName' } };
    expect(errorsOf(base({ fields }))).toMatch(/target "petitionerFirstName" already used/);
  });

  test('requires INTAKE first and REVIEW last', () => {
    const phases = base().phases;
    expect(errorsOf(base({ phases: [phases[2], phases[0]] }))).toMatch(/REVIEW must be the last phase|INTAKE must be the first phase/);
    expect(errorsOf(base({ phases: [phases[0], phases[1]] }))).toMatch(/last phase must be REVIEW/);
    expect(errorsOf(base({ phases: [phases[1], phases[2]] }))).toMatch(/INTAKE phase is required/);
  });

  test('rejects unknown field references in phases', () => {
    const phases = base().phases.map((p) => (p.id === 'INTAKE' ? { ...p, required_fields: ['nope'] } : p));
    expect(errorsOf(base({ phases }))).toMatch(/required_fields: unknown field "nope"/);
  });

  test('rejects optional: false on a conditional phase and conditional INTAKE', () => {
    let phases = base().phases.map((p) => (p.id === 'CHILDREN' ? { ...p, optional: false } : p));
    expect(errorsOf(base({ phases }))).toMatch(/optional: false conflicts/);
    phases = base().phases.map((p) => (p.id === 'INTAKE' ? { ...p, skip_if_any: ['has_children'] } : p));
    expect(errorsOf(base({ phases }))).toMatch(/INTAKE and REVIEW cannot be conditional/);
  });

  test('rejects document_selection reasons for unlisted documents', () => {
    const doc = base({ document_selection: { documents: ['affidavit'], reasons: { petition: 'x' } } });
    expect(errorsOf(doc)).toMatch(/document_selection\.reasons\.petition/);
  });

  test('rejects bad codes and unknown top-level keys', () => {
    expect(errorsOf(base({ code: 'Bad-Code' }))).toMatch(/code:/);
    expect(errorsOf(base({ surprise: true }))).toMatch(/surprise|Unrecognized key/i);
  });
});
