/** @jest-environment node */
'use strict';

/**
 * year-only-dob-universal.test.js
 *
 * Attorney round-3 (2026-08-30): David NY got the year-only DOB fix
 * in round-2, but Sarah AB (Alberta petition) and Marcus ON (Ontario
 * Answer) still rendered blank when the profile only carried a
 * `birthYear`. Verify every jurisdiction now renders "born <year>"
 * (or "born in <year>") when that is the only signal.
 */

const OntarioAnswer = require('../../services/supportDocs/ontarioAnswer');
const AlbertaPetition = require('../../templates/states/alberta/DivorcePetitionTemplate');
const NewYorkPetition = require('../../templates/states/newyork/DivorcePetitionTemplate');
const CaliforniaPetition = require('../../templates/states/california/DivorcePetitionTemplate');
const TexasPetition = require('../../templates/states/texas/DivorcePetitionTemplate');

const YEAR_ONLY_CHILD = { name: 'Emma', birthYear: 2016 };

function joinChildContent(section) {
  return (section.items || []).map((it) => it.content || '').join('\n');
}

describe('Year-only DOB — universal fallback across ON, AB, NY, CA, TX', () => {
  test('Alberta petition renders "born in 2016" from child.birthYear', () => {
    const petition = new AlbertaPetition();
    const section = petition.generateChildrenSection({
      petitionerName: 'Sarah Test',
      respondentName: 'Alex Test',
      state: 'AB',
      hasMinorChildren: true,
      children: [YEAR_ONLY_CHILD],
    });
    const blob = joinChildContent(section);
    expect(blob).toMatch(/2016/);
    expect(blob).not.toMatch(/born __________________/);
  });

  test('New York petition renders "born 2016" from child.birthYear', () => {
    const petition = new NewYorkPetition();
    const section = petition.generateChildrenSection({
      petitionerName: 'David Test',
      respondentName: 'Alex Test',
      state: 'NY',
      hasMinorChildren: true,
      children: [YEAR_ONLY_CHILD],
    });
    const blob = joinChildContent(section);
    expect(blob).toMatch(/2016/);
    expect(blob).not.toMatch(/born __________________/);
  });

  test('California petition renders "born 2016" from child.birthYear', () => {
    const petition = new CaliforniaPetition();
    const section = petition.generateChildrenSection({
      petitionerName: 'Cara Test',
      respondentName: 'Alex Test',
      state: 'CA',
      hasMinorChildren: true,
      children: [YEAR_ONLY_CHILD],
    });
    const blob = joinChildContent(section);
    expect(blob).toMatch(/2016/);
  });

  test('Texas petition renders "born 2016" from child.birthYear', () => {
    const petition = new TexasPetition();
    const section = petition.generateChildrenSection({
      petitionerName: 'Mari Test',
      respondentName: 'Ray Test',
      state: 'TX',
      hasMinorChildren: true,
      children: [YEAR_ONLY_CHILD],
    });
    const blob = joinChildContent(section);
    expect(blob).toMatch(/2016/);
  });

  test('Ontario Answer (Marcus) renders "(born 2016)" from child.birthYear', () => {
    const doc = OntarioAnswer.answerToPetition({
      respondentName: 'Marcus Test',
      petitionerName: 'Alex Test',
      state: 'ON',
      county: 'York',
      hasMinorChildren: true,
      marriageDate: '2010-05-01',
      children: [YEAR_ONLY_CHILD],
    });
    const facts = (doc && doc.sections && doc.sections.facts && doc.sections.facts.items) || [];
    const blob = facts.map((it) => it.content || '').join('\n');
    expect(blob).toMatch(/2016/);
  });

  test('Also works when only "birthDate" is a 4-digit year string ("2020")', () => {
    const petition = new AlbertaPetition();
    const section = petition.generateChildrenSection({
      petitionerName: 'Sarah Test',
      respondentName: 'Alex Test',
      state: 'AB',
      hasMinorChildren: true,
      children: [{ name: 'Zayn', birthDate: '2014' }],
    });
    const blob = joinChildContent(section);
    expect(blob).toMatch(/2014/);
  });
});
