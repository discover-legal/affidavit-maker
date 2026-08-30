/**
 * Sarah AB round-2: Alberta has no community-property regime; property is
 * "family property" under the Family Property Act, RSA 2000, c. F-4.7.
 * The word "community" (US idiom) must not appear anywhere in AB output.
 */

'use strict';

const AlbertaDivorcePetitionTemplate =
  require('../../templates/states/alberta/DivorcePetitionTemplate');
const AlbertaDivorceDecreeTemplate =
  require('../../templates/states/alberta/DivorceDecreeTemplate');

function baseData(extra = {}) {
  return {
    petitionerName: 'Sarah Applicant',
    respondentName: 'Ahmed Defendant',
    state: 'AB',
    county: 'Calgary',
    marriageDate: '2010-06-15',
    separationDate: '2020-01-01',
    groundsForDivorce: 'separation',
    hasMinorChildren: false,
    ...extra,
  };
}

describe('Alberta output contains no "community" (Sarah AB round-2)', () => {
  test('petition — property section uses "family property", never "community"', () => {
    const doc = new AlbertaDivorcePetitionTemplate().generateDocument(baseData());
    expect(doc.fullText.toLowerCase()).not.toContain('community');
  });

  test('petition with agreed property division: still no "community"', () => {
    const doc = new AlbertaDivorcePetitionTemplate().generateDocument(
      baseData({
        propertyAgreement: 'Each party keeps assets in their own name.',
        petitionerProperty: ['Home'],
        respondentProperty: ['Vehicle'],
      }),
    );
    expect(doc.fullText.toLowerCase()).not.toContain('community');
  });

  test('decree — no "community" anywhere', () => {
    const doc = new AlbertaDivorceDecreeTemplate().generateDocument(baseData({
      caseNumber: '2001-12345',
    }));
    expect(doc.fullText.toLowerCase()).not.toContain('community');
  });
});
