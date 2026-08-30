/**
 * Sarah AB round-2: interview captured children by year only
 * (Layla 2011, Zayn 2014). The DOB field must render the year rather
 * than a bare blank when only a year is available in the profile.
 */

'use strict';

const AlbertaDivorcePetitionTemplate =
  require('../../templates/states/alberta/DivorcePetitionTemplate');

const tpl = new AlbertaDivorcePetitionTemplate();

test('year-only DOB renders as "in <year>", not a bare blank', () => {
  const doc = tpl.generateDocument({
    petitionerName: 'Sarah Applicant',
    respondentName: 'Ahmed Defendant',
    state: 'AB',
    county: 'Calgary',
    marriageDate: '2010-06-15',
    separationDate: '2024-01-01',
    groundsForDivorce: 'separation',
    hasMinorChildren: true,
    children: [
      { name: 'Layla', birthDate: '2011' },
      { name: 'Zayn', birthDate: '2014' },
    ],
  });
  const childrenText = doc.sections.childrenInfo.items.map((i) => i.content).join('\n');
  expect(childrenText).toMatch(/Layla,\s*born in 2011/);
  expect(childrenText).toMatch(/Zayn,\s*born in 2014/);
  // The bare "born __________________" placeholder must not appear when
  // the year is known.
  expect(childrenText).not.toMatch(/Layla,\s*born __________________/);
});

test('renderable full-date DOB still renders the full date', () => {
  const doc = tpl.generateDocument({
    petitionerName: 'Sarah',
    respondentName: 'Ahmed',
    state: 'AB',
    county: 'Calgary',
    marriageDate: '2010-06-15',
    separationDate: '2024-01-01',
    groundsForDivorce: 'separation',
    hasMinorChildren: true,
    children: [{ name: 'Layla', birthDate: '2011-05-12' }],
  });
  const childrenText = doc.sections.childrenInfo.items.map((i) => i.content).join('\n');
  expect(childrenText).toMatch(/Layla,\s*born May 12, 2011/);
});
