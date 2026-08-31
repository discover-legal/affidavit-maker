/**
 * Attorney round-5 (Sarah AB, 2026-08-30): the Alberta Statement of Claim
 * for Divorce shipped without a jurat block, so a Commissioner for Oaths
 * had nothing to sign — the document literally could not be sworn.
 * Alberta Rules of Court, r.13.19–13.22 (Notaries and Commissioners Act,
 * RSA 2013, c. N-5.5) require a jurat naming place, date, and the
 * Commissioner for Oaths.
 */
'use strict';

const AlbertaDivorcePetitionTemplate =
  require('../../templates/states/alberta/DivorcePetitionTemplate');

describe('Alberta Commissioner-for-Oaths jurat block', () => {
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

  test('verification section renders SWORN...BEFORE ME jurat', () => {
    const v = doc.sections.verification.text;
    expect(v).toMatch(/SWORN \(or AFFIRMED\) BEFORE ME/i);
    expect(v).toMatch(/in the Province of Alberta/);
    // date + place blanks present
    expect(v).toMatch(/____/);
  });

  test('verification identifies the Commissioner for Oaths', () => {
    const v = doc.sections.verification.text;
    expect(v).toMatch(/A Commissioner for Oaths in and for the Province of Alberta/i);
  });

  test('fullText carries the jurat block below the verification title', () => {
    expect(doc.fullText).toMatch(/SWORN \(or AFFIRMED\) BEFORE ME/i);
    expect(doc.fullText).toMatch(/Commissioner for Oaths/i);
  });
});
