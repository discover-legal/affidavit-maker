/**
 * Attorney round-5 (Sarah AB, 2026-08-30): the AB caption said
 * "JUDICIAL DISTRICT OF CALGARY". Alberta uses "JUDICIAL CENTRE"
 * (Court of King's Bench office; Alta. Rules of Court, r.3.3).
 * "Judicial District" is Ontario / other-province vocabulary and reads
 * as a caption defect to an Alberta filing clerk.
 */
'use strict';

const AlbertaDivorcePetitionTemplate =
  require('../../templates/states/alberta/DivorcePetitionTemplate');

describe('Alberta caption uses "Judicial Centre" (never "Judicial District")', () => {
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

  test('caseCaption courtName uses JUDICIAL CENTRE', () => {
    const formatted = doc.sections.caseCaption.formatted;
    expect(formatted).toMatch(/JUDICIAL CENTRE OF CALGARY/);
    expect(formatted).not.toMatch(/JUDICIAL DISTRICT/i);
  });

  test('fullText nowhere carries "Judicial District"', () => {
    expect(doc.fullText).not.toMatch(/Judicial District/i);
    expect(doc.fullText).toMatch(/Judicial Centre/);
  });

  test('getDefaultCourt with unknown county still uses [JUDICIAL CENTRE] placeholder', () => {
    const court = tpl.getDefaultCourt(null);
    expect(court).toMatch(/JUDICIAL CENTRE/);
    expect(court).not.toMatch(/JUDICIAL DISTRICT/i);
  });
});
