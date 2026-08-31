/**
 * Attorney round-4 (Sarah AB, 2026-08-30). When the profile is silent on
 * property (no explicit `noPropertyConfirmed`, and `propertyAgreement` is
 * a status token like "pending" — NOT a described agreement), the
 * Statement of Claim must NOT fabricate a "no family property" allegation.
 * It must render the Draft-note so the drafter confirms before filing.
 */

'use strict';

const AlbertaDivorcePetitionTemplate =
  require('../../templates/states/alberta/DivorcePetitionTemplate');

const tpl = new AlbertaDivorcePetitionTemplate();

function generate(extra = {}) {
  return tpl.generateDocument({
    petitionerName: 'Sarah Khoury',
    respondentName: 'Ahmed Khoury',
    state: 'AB',
    county: 'Calgary',
    marriageDate: '2010',
    separationDate: '2025-02-01',
    groundsForDivorce: 'breakdown_of_marriage',
    hasMinorChildren: true,
    children: [{ name: 'Layla', birthDate: '2011' }],
    ...extra,
  });
}

function propertyText(doc) {
  return doc.sections.propertyInfo.items.map((i) => i.content).join('\n');
}

describe('Alberta property section — silence must not fabricate', () => {
  test('hasProperty:false + propertyAgreement:"pending" renders Draft-note, not "no family property"', () => {
    const doc = generate({ hasProperty: false, propertyAgreement: 'pending' });
    const text = propertyText(doc);
    expect(text).not.toMatch(/There is no family property to be divided/);
    expect(text).toMatch(/Draft — confirm whether you and your spouse have any family property/);
  });

  test('hasProperty undefined + no confirmation renders Draft-note', () => {
    const doc = generate({});
    const text = propertyText(doc);
    expect(text).not.toMatch(/There is no family property to be divided/);
    expect(text).toMatch(/Draft — confirm whether/);
  });

  test('explicit noPropertyConfirmed:true still renders the affirmative nil clause', () => {
    const doc = generate({ hasProperty: false, noPropertyConfirmed: true });
    const text = propertyText(doc);
    expect(text).toMatch(/There is no family property to be divided/);
  });
});
