/**
 * Attorney round-5 (Sarah AB, 2026-08-30): the AB Statement of Claim
 * used the US idiom "habitually resident" for Divorce Act s.3(1). The
 * federal Divorce Act uses "ORDINARILY RESIDENT" — the phrasing courts
 * expect and the standard on which residence-based jurisdiction is proved.
 */
'use strict';

const AlbertaDivorcePetitionTemplate =
  require('../../templates/states/alberta/DivorcePetitionTemplate');

describe('Alberta uses Divorce Act s.3(1) "ordinarily resident" phrasing', () => {
  const tpl = new AlbertaDivorcePetitionTemplate();
  const doc = tpl.generateDocument({
    petitionerName: 'Sarah Khoury',
    respondentName: 'Ahmed Khoury',
    state: 'AB',
    county: 'Calgary',
    marriageDate: '2010-06-15',
    separationDate: '2025-02-01',
    groundsForDivorce: 'separation',
  });

  test('jurisdiction pleading uses "ordinarily resident"', () => {
    const jurisdiction = doc.sections.jurisdiction.items.map((i) => i.content).join('\n');
    expect(jurisdiction).toMatch(/ordinarily resident/i);
    expect(jurisdiction).not.toMatch(/habitually resident/i);
  });

  test('fullText nowhere contains the US idiom "habitually resident"', () => {
    expect(doc.fullText).not.toMatch(/habitually resident/i);
    expect(doc.fullText).toMatch(/ordinarily resident/i);
  });

  test('residency-requirement description uses "ordinarily resident"', () => {
    expect(tpl.residencyRequirements.description).toMatch(/ordinarily resident/i);
    expect(tpl.residencyRequirements.description).not.toMatch(/habitually resident/i);
  });
});
