/** @jest-environment node */
'use strict';

/**
 * georgia-cruelty-factual-substrate.test.js
 *
 * Attorney round-2 (2026-08): the GA cruelty grounds paragraph was
 * emerging with bare §19-5-3(10) statutory language even when the
 * transcript contained a substrate ("he was physically abusive, i
 * have hospital records and police reports from 2024"). The template
 * must now splice the factual substrate into the grounds paragraph,
 * and must attach a Draft note pointing at the Family Violence
 * Protection Act (O.C.G.A. §19-13-1 et seq.) and the family-violence
 * custody presumption (O.C.G.A. §19-9-3(a)(4)).
 */

const GeorgiaDivorcePetitionTemplate = require('../../templates/states/georgia/DivorcePetitionTemplate');

function baseData(overrides = {}) {
  return {
    petitionerName: 'Amara Plaintiff',
    respondentName: 'Ray Defendant',
    state: 'GA',
    county: 'Fulton',
    marriageDate: '2015-06-01',
    ...overrides,
  };
}

const AMARA_ABUSE_FACT = {
  category: 'evidence',
  subcategory: 'cruelty and supporting documentation',
  content:
    'Ray physically abused Amara during the marriage, documented in hospital records and police reports from 2024.',
  sourceQuote:
    'he was physically abusive, i have hospital records and police reports from 2024.',
};

describe('Georgia cruelty petition — factual substrate + §19-13/§19-9-3(a)(4) draft note', () => {
  const petition = new GeorgiaDivorcePetitionTemplate();

  test('splices factual substrate into the cruelty paragraph', () => {
    const section = petition.generateGroundsSection(
      baseData({ grounds: 'cruel_treatment', facts: [AMARA_ABUSE_FACT] })
    );
    const grounds = section.items.find((it) => it.type === 'grounds');
    expect(grounds).toBeTruthy();
    expect(grounds.content).toMatch(/cruel treatment/i);
    expect(grounds.content).toMatch(/§\s*19-5-3\(10\)/);
    expect(grounds.content).toMatch(/hospital records/i);
    expect(grounds.content).toMatch(/police reports/i);
    expect(grounds.content).toMatch(/Plaintiff will produce documentation/i);
    expect(grounds.content).toMatch(/Specifically,/);
  });

  test('cruelty without a matching substrate fact renders the bare statutory clause', () => {
    const section = petition.generateGroundsSection(
      baseData({ grounds: 'cruel_treatment' })
    );
    const grounds = section.items.find((it) => it.type === 'grounds');
    expect(grounds.content).toMatch(/cruel treatment/i);
    expect(grounds.content).not.toMatch(/will produce documentation/i);
    expect(grounds.content).not.toMatch(/Specifically,/);
  });

  test('cruelty petition attaches Draft note referencing O.C.G.A. §19-13-1 et seq. and §19-9-3(a)(4)', () => {
    const section = petition.generateGroundsSection(
      baseData({ grounds: 'cruel_treatment', facts: [AMARA_ABUSE_FACT] })
    );
    const note = section.items.find((it) => it.type === 'grounds_draft_note');
    expect(note).toBeTruthy();
    expect(note.content).toMatch(/§\s*19-13-1/);
    expect(note.content).toMatch(/§\s*19-9-3\(a\)\(4\)/);
    expect(note.content).toMatch(/Family Violence Protection Act/i);
    expect(note.content).toMatch(/presumption/i);
  });

  test('no-fault petition does NOT attach the family-violence draft note', () => {
    const section = petition.generateGroundsSection(
      baseData({ groundsForDivorce: 'irretrievably_broken' })
    );
    const note = section.items.find((it) => it.type === 'grounds_draft_note');
    expect(note).toBeUndefined();
  });

  test('substrate detection also fires on hospital/ER/police keywords when subcategory is absent', () => {
    const section = petition.generateGroundsSection(
      baseData({
        grounds: 'cruel_treatment',
        facts: [{
          category: 'grounds',
          content: 'Plaintiff has hospital records and police reports documenting the assaults by Defendant.',
        }],
      })
    );
    const grounds = section.items.find((it) => it.type === 'grounds');
    expect(grounds.content).toMatch(/hospital records/i);
    expect(grounds.content).toMatch(/Plaintiff will produce documentation/i);
  });
});
