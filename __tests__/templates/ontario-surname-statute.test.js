/** @jest-environment node */
'use strict';

/**
 * Ontario surname change on divorce — Change of Name Act (RSO 1990, c. C.7),
 * NOT Divorce Act s.15.2 (which is spousal support).
 *
 * Attorney round-5 (Marcus, ON, 2026-08-30) flagged Divorce Act s.15.2
 * being cited for surname changes. On dissolution in Ontario the
 * statutory authority is the Change of Name Act, s.3(1)(a) (statutory
 * election to resume a former name), administered through
 * ServiceOntario. The Divorce Act does not effect a name change.
 */

const OntarioDivorcePetitionTemplate = require('../../templates/states/ontario/DivorcePetitionTemplate');
const { answerToPetition } = require('../../services/supportDocs/ontarioAnswer');

function petitionText(overrides = {}) {
  const template = new OntarioDivorcePetitionTemplate();
  const data = {
    petitionerName: 'Priya Thompson',
    respondentName: 'Marcus Thompson',
    state: 'ON',
    county: 'Toronto',
    marriageDate: '2010-06-01',
    separationDate: '2023-01-15',
    requestNameChange: true,
    previousName: 'Priya Kapoor',
    ...overrides,
  };
  const doc = template.generateDocument(data);
  return doc.fullText || JSON.stringify(doc);
}

function answerText(overrides = {}) {
  const doc = answerToPetition({
    role: 'respondent',
    petitionerName: 'Priya Thompson',
    respondentName: 'Marcus Thompson',
    county: 'Toronto',
    caseNumber: 'FC-24-000123',
    state: 'ON',
    ...overrides,
  });
  return doc.fullText || JSON.stringify(doc);
}

describe('Ontario — surname statute is Change of Name Act, not Divorce Act s.15.2', () => {
  test('petition name-change relief cites Change of Name Act, RSO 1990, c. C.7', () => {
    const text = petitionText();
    expect(text).toMatch(/Change of Name Act, RSO 1990, c\. C\.7/);
  });

  test('petition name-change relief does NOT cite Divorce Act s.15.2', () => {
    const text = petitionText();
    // The petition must not tie name change to spousal-support statute.
    // Locate the name-change relief line and confirm it does not cite s.15.2.
    const nameChangeLine = text.split('\n').find((l) => /former name/i.test(l) && /Priya Kapoor|Change of Name Act/.test(l));
    expect(nameChangeLine).toBeTruthy();
    expect(nameChangeLine).not.toMatch(/Divorce Act[^,]*15\.2/);
    expect(nameChangeLine).not.toMatch(/s\.\s*15\.2/);
  });

  test('Ontario Answer surname counter-petition example cites Change of Name Act', () => {
    const text = answerText();
    // The counterPetitionExamples listing should reflect the correct statute.
    expect(text).toMatch(/Change of Name Act, RSO 1990, c\. C\.7/);
    expect(text).not.toMatch(/change of surname \(Divorce Act, s\.\s*15\.2/);
  });
});
