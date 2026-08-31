/**
 * Attorney round-4 (Amara GA, 2026-08-30). The GA UCCJEA present-address
 * autofill added in round-3 fired only when the profile carried an
 * explicit street address in `petitionerAddress` (or synonyms). Amara's
 * profile had only county+state; every child rendered
 * "Present address: [CURRENT ADDRESS]". Widen to (a) match every
 * Plaintiff-side phrasing including "with me" / "with plaintiff" /
 * "with mother" / "with <plaintiff first name>", and (b) fall back to
 * the county+state on the profile as the concise place identifier.
 */

'use strict';

const GeorgiaDivorcePetitionTemplate =
  require('../../templates/states/georgia/DivorcePetitionTemplate');

const tpl = new GeorgiaDivorcePetitionTemplate();

function generate(extra = {}) {
  return tpl.generateDocument({
    petitionerName: 'Amara Okafor',
    petitionerFirstName: 'Amara',
    petitionerLastName: 'Okafor',
    respondentName: 'Malachi Okafor',
    state: 'GA',
    county: 'Fulton',
    marriageDate: '2012',
    marriagePlace: 'Atlanta, Georgia',
    hasMinorChildren: true,
    numberOfChildren: 3,
    custodyPreference: 'sole',
    children: [
      { name: 'Zora', age: 13, livesWith: 'Petitioner, Amara Okafor, in Atlanta' },
      { name: 'Ade', age: 10, livesWith: 'Petitioner, Amara Okafor, in Atlanta' },
      { name: 'Kofi', age: 7, livesWith: 'Petitioner, Amara Okafor, in Atlanta' },
    ],
    groundsForDivorce: 'cruel_treatment',
    ...extra,
  });
}

function childrenText(doc) {
  return doc.sections.childrenInfo.items.map((i) => i.content || '').join('\n');
}

describe('GA UCCJEA autofill widened for Amara-shape profiles', () => {
  test('county+state fallback fills present-address when no street address is on file', () => {
    const doc = generate();
    const text = childrenText(doc);
    expect(text).not.toMatch(/\[CURRENT ADDRESS\]/);
    // Fallback is "Fulton County, Georgia".
    expect(text).toMatch(/Present address: Fulton County, Georgia/);
  });

  test('livesWith="with me" also matches (livesWith phrase widening)', () => {
    const doc = generate({
      children: [{ name: 'Zora', age: 13, livesWith: 'with me in Atlanta' }],
    });
    const text = childrenText(doc);
    expect(text).not.toMatch(/\[CURRENT ADDRESS\]/);
    expect(text).toMatch(/Present address: Fulton County, Georgia/);
  });

  test('livesWith names Plaintiff first name → matched', () => {
    const doc = generate({
      children: [{ name: 'Zora', age: 13, livesWith: 'lives with Amara in Atlanta' }],
    });
    const text = childrenText(doc);
    expect(text).not.toMatch(/\[CURRENT ADDRESS\]/);
    expect(text).toMatch(/Present address: Fulton County, Georgia/);
  });

  test('explicit petitionerAddress still wins over the fallback', () => {
    const doc = generate({ petitionerAddress: '100 Peachtree St NW, Atlanta, GA' });
    const text = childrenText(doc);
    expect(text).toMatch(/Present address: 100 Peachtree St NW, Atlanta, GA/);
  });
});
