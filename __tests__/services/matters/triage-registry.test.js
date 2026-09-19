/** @jest-environment node */
'use strict';

const path = require('path');

const FIXTURES = path.join(__dirname, '..', '..', 'fixtures', 'matters');

describe('triage prompt + tool follow the matter registry', () => {
  const originalDir = process.env.MATTERS_DIR;

  afterEach(() => {
    if (originalDir === undefined) delete process.env.MATTERS_DIR;
    else process.env.MATTERS_DIR = originalDir;
    jest.resetModules();
  });

  function loadTriage(dir) {
    if (dir) process.env.MATTERS_DIR = dir;
    else delete process.env.MATTERS_DIR;
    jest.resetModules();
    return require('../../../services/agents/prompts/triage/index');
  }

  test('shipped matters/: name_change is classifiable and listed in the prompt', () => {
    const triage = loadTriage();
    const codes = triage.buildTriageTool().function.parameters.properties.matter_type_code.enum;
    expect(codes).toContain('name_change');
    expect(codes).toContain('divorce');
    expect(codes).toContain('probate');
    expect(codes[codes.length - 1]).toBe('general_affidavit');
    expect(new Set(codes).size).toBe(codes.length);
    expect(triage.TRIAGE_PROMPT).toMatch(/- name_change\s+→ Legally changing your name \(keywords: change my name, name change, new name, update name\)/);
    expect(triage.TRIAGE_PROMPT).toMatch(/CIVIL LAW:/);
    expect(triage.TRIAGE_PROMPT).not.toMatch(/ADDITIONAL ROUTING NOTES/);
  });

  test('a fixture matter appears in its practice-area group with its routing notes', () => {
    const triage = loadTriage(path.join(FIXTURES, 'valid'));
    const codes = triage.buildTriageTool().function.parameters.properties.matter_type_code.enum;
    expect(codes).toContain('sample_claim');
    expect(codes).not.toContain('name_change'); // MATTERS_DIR replaced the shipped dir
    const prompt = triage.buildTriagePrompt();
    const familyBlock = prompt.slice(prompt.indexOf('FAMILY LAW:'), prompt.indexOf('CIVIL LAW:'));
    expect(familyBlock).toMatch(/- sample_claim\s+→ A fixture claim about a sample dispute \(keywords: sample, fixture claim\)/);
    expect(prompt).toMatch(/ADDITIONAL ROUTING NOTES:\n  - "I have a sample problem" → sample_claim/);
  });

  test('an empty or missing matters dir leaves the built-in classifier intact', () => {
    const triage = loadTriage(path.join(FIXTURES, 'does-not-exist'));
    const codes = triage.buildTriageTool().function.parameters.properties.matter_type_code.enum;
    expect(codes).toEqual([...triage.BUILTIN_TRIAGE_ENTRIES.map((e) => e.code), 'general_affidavit']);
  });
});
