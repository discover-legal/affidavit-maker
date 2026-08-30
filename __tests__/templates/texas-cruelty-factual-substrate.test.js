/** @jest-environment node */
'use strict';

/**
 * texas-cruelty-factual-substrate.test.js
 *
 * Attorney round-2 (2026-08): the TX cruelty grounds paragraph was
 * emerging with bare statutory language even when the transcript
 * contained a substrate ("he hurt me physically, i have er
 * documentation from before we split"). The template must now splice
 * the factual substrate into the grounds paragraph, and must attach a
 * Draft note pointing at TFC §6.504 (protective order in dissolution
 * suit) and TFC §6.501 (temporary restraining orders / county
 * standing orders).
 */

const TexasDivorcePetitionTemplate = require('../../templates/states/texas/DivorcePetitionTemplate');

function baseData(overrides = {}) {
  return {
    petitionerName: 'Mari Delacroix',
    respondentName: 'Ray Delacroix',
    state: 'TX',
    county: 'Harris',
    marriageDate: '2015-06-01',
    ...overrides,
  };
}

const ER_FACT = {
  id: 'abc9bcef',
  type: 'evidence',
  category: 'evidence',
  subcategory: 'cruelty and supporting documentation',
  content:
    'Ray Delacroix physically harmed Mari before the parties separated, resulting in emergency-room treatment for Mari.',
  sourceQuote:
    'grounds — cruelty. he hurt me physically, i have er documentation from before we split.',
};

describe('Texas cruelty petition — factual substrate + TFC §6.504/§6.501 draft note', () => {
  const petition = new TexasDivorcePetitionTemplate();

  test('splices factual substrate into the cruelty paragraph', () => {
    const section = petition.generateGroundsSection(
      baseData({ grounds: 'cruelty', facts: [ER_FACT] })
    );
    const grounds = section.items.find((it) => it.type === 'grounds');
    expect(grounds).toBeTruthy();
    expect(grounds.content).toMatch(/cruel treatment/i);
    expect(grounds.content).toMatch(/emergency-room treatment/i);
    expect(grounds.content).toMatch(/documentation of which Petitioner will produce/i);
  });

  test('cruelty without a matching substrate fact renders the bare statutory clause', () => {
    const section = petition.generateGroundsSection(
      baseData({ grounds: 'cruelty' })
    );
    const grounds = section.items.find((it) => it.type === 'grounds');
    expect(grounds.content).toMatch(/cruel treatment/i);
    expect(grounds.content).not.toMatch(/documentation of which/i);
  });

  test('cruelty petition attaches Draft note referencing TFC §6.504 and §6.501', () => {
    const section = petition.generateGroundsSection(
      baseData({ grounds: 'cruelty', facts: [ER_FACT] })
    );
    const note = section.items.find((it) => it.type === 'grounds_draft_note');
    expect(note).toBeTruthy();
    expect(note.content).toMatch(/§\s*6\.504/);
    expect(note.content).toMatch(/§\s*6\.501/);
    expect(note.content).toMatch(/protective order/i);
    expect(note.content).toMatch(/standing/i);
  });

  test('no-fault (insupportability) petition does NOT attach the family-violence draft note', () => {
    const section = petition.generateGroundsSection(
      baseData({ groundsForDivorce: 'insupportability' })
    );
    const note = section.items.find((it) => it.type === 'grounds_draft_note');
    expect(note).toBeUndefined();
  });

  test('substrate detection also fires on ER/hospital/police keywords even when subcategory is absent', () => {
    const section = petition.generateGroundsSection(
      baseData({
        grounds: 'cruelty',
        facts: [{
          category: 'grounds',
          content: 'Petitioner has hospital records and police reports from 2024 documenting the assaults by Respondent.',
        }],
      })
    );
    const grounds = section.items.find((it) => it.type === 'grounds');
    expect(grounds.content).toMatch(/hospital records/i);
    expect(grounds.content).toMatch(/documentation of which Petitioner will produce/i);
  });
});
