/** @jest-environment node */
'use strict';

const path = require('path');
const { loadMatterDefinitions, loadMatterRegistry, BUILTIN_MATTER_CODES } = require('../../../services/matters');

const FIXTURES = path.join(__dirname, '..', '..', 'fixtures', 'matters');

describe('matter YAML loader', () => {
  test('loads valid files, ignores "_" scaffolds, sorts by sort_order', () => {
    const { matters, errors } = loadMatterDefinitions({ dir: path.join(FIXTURES, 'valid') });
    expect(errors).toEqual([]);
    expect(matters.map((m) => m.code)).toEqual(['sample_claim']);
    const m = matters[0];
    expect(m.practiceArea).toBe('family');
    expect(m.familyProfile).toBe(true);
    expect(m.supportedJurisdictions).toEqual(['ON', 'UT']);
    expect(m.documents).toEqual(['sample_petition', 'indigency_affidavit']);
    expect(m.documentSelection).toEqual({
      documents: ['affidavit'],
      reasons: { affidavit: 'A sworn statement supporting your sample claim.' },
    });
    expect(m.triage.routingNotes).toEqual(['"I have a sample problem" → sample_claim']);
    expect(m.phases.map((p) => p.id)).toEqual(['INTAKE', 'CHILDREN', 'REVIEW']);
    expect(m.phases[1].factCategory).toBe('children');
    expect(m.sourceFile.endsWith('sample_claim.yaml')).toBe(true);
  });

  test('reports every problem in an invalid directory and keeps none of them', () => {
    const { matters, errors } = loadMatterDefinitions({
      dir: path.join(FIXTURES, 'invalid'),
      reservedCodes: BUILTIN_MATTER_CODES,
    });
    expect(matters.map((m) => m.code)).toEqual(['dup_code']); // first of the duplicates survives
    const byFile = (name) => errors.filter((e) => e.file.endsWith(name)).map((e) => e.message).join('\n');
    expect(byFile('broken_syntax.yaml')).toMatch(/YAML parse error/);
    expect(byFile('missing_review.yaml')).toMatch(/last phase must be REVIEW/);
    expect(byFile('reserved_code.yaml')).toMatch(/"custody" is a built-in matter/);
    expect(byFile('unknown_field.yaml')).toMatch(/unknown field "nope"/);
    expect(byFile('dup_b.yaml')).toMatch(/"dup_code" already defined in dup_a\.yaml/);
    expect(byFile('dup_a.yaml')).toBe('');
  });

  test('a missing directory yields no matters and no errors', () => {
    const { matters, errors } = loadMatterDefinitions({ dir: path.join(FIXTURES, 'does-not-exist') });
    expect(matters).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('registry helpers: get/has/codes/familyProfileCodes', () => {
    const reg = loadMatterRegistry(path.join(FIXTURES, 'valid'));
    expect(reg.errors).toEqual([]);
    expect(reg.codes()).toEqual(['sample_claim']);
    expect(reg.has('SAMPLE_CLAIM')).toBe(true);
    expect(reg.get('sample_claim').displayName).toBe('Sample Claim');
    expect(reg.get('nope')).toBeNull();
    expect(reg.familyProfileCodes()).toEqual(['sample_claim']);
  });

  test('the shipped matters/ directory is valid (CI gate)', () => {
    const reg = loadMatterRegistry(path.join(process.cwd(), 'matters'));
    expect(reg.errors).toEqual([]);
    expect(reg.codes()).toContain('name_change');
  });
});
