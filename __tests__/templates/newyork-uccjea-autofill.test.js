/**
 * Attorney round-4 (David NY, 2026-08-30). Emma has lived in Brooklyn her
 * whole life; the UCCJEA (DRL § 75-a) present-address must not render
 * "[CURRENT ADDRESS]" when the profile carries a Plaintiff address (or
 * the county+state fallback), and a "with Both Petitioner and
 * Respondent" livesWith must be treated as Plaintiff-side (not
 * defendant-only).
 */

'use strict';

const NewYorkDivorcePetitionTemplate =
  require('../../templates/states/newyork/DivorcePetitionTemplate');

const tpl = new NewYorkDivorcePetitionTemplate();

function generate(extra = {}) {
  return tpl.generateDocument({
    petitionerName: 'David Rosenberg',
    respondentName: 'Yvonne Rosenberg',
    state: 'NY',
    county: 'Kings',
    marriageDate: '2015',
    marriagePlace: 'Manhattan',
    hasMinorChildren: true,
    numberOfChildren: 1,
    children: [
      {
        name: 'Emma',
        birthDate: '2020',
        livesWith: 'Both Petitioner David Rosenberg and Respondent Yvonne Rosenberg in Brooklyn',
      },
    ],
    groundsForDivorce: 'irreconcilable_differences',
    ...extra,
  });
}

function childrenText(doc) {
  return doc.sections.childrenInfo.items.map((i) => i.content || '').join('\n');
}

describe('NY UCCJEA present-address autofill', () => {
  test('petitionerAddress on profile is used for the present-address line', () => {
    const doc = generate({ petitionerAddress: '123 Cadman Plaza, Brooklyn, NY' });
    const text = childrenText(doc);
    expect(text).toMatch(/Child: Emma.*Present address: 123 Cadman Plaza, Brooklyn, NY/);
    expect(text).not.toMatch(/\[CURRENT ADDRESS\]/);
  });

  test('with no street address, falls back to county + state ("Kings County, New York")', () => {
    const doc = generate({});
    const text = childrenText(doc);
    expect(text).not.toMatch(/\[CURRENT ADDRESS\]/);
    expect(text).toMatch(/Present address: Kings County, New York/);
  });

  test('livesWith names Respondent only → still renders SOMETHING (no [CURRENT ADDRESS] placeholder)', () => {
    // Respondent-only cases fall through to the address on the profile
    // (or the county+state fallback). The critical assertion: no
    // "[CURRENT ADDRESS]" placeholder leaks into the pleading. The drafter
    // corrects a specific respondent address before filing.
    const doc = generate({
      children: [{ name: 'Emma', birthDate: '2020', livesWith: 'Respondent Yvonne Rosenberg' }],
    });
    const text = childrenText(doc);
    expect(text).not.toMatch(/\[CURRENT ADDRESS\]/);
  });
});
