/**
 * Ontario Form 10 (Answer) — structural scaffold.
 *
 * Family Law Rules Form 10 requires three distinct sub-sections:
 *   PART A — the respondent's responses to each claim in the Application;
 *   PART B — the important facts supporting the responses;
 *   PART C — the claims (if any) the respondent makes against the applicant.
 * The previous builder rendered one paragraph plus a blank, missing this
 * scaffold entirely.
 */

'use strict';

const { answerToPetition } = require('../../../services/supportDocs/ontarioAnswer');

function render(data, opts) {
  return answerToPetition(data, opts);
}

const commonData = {
  role: 'respondent',
  affiantName: 'Marcus Thompson',
  petitionerName: 'Priya Thompson',
  respondentName: 'Marcus Thompson',
  county: 'Toronto',
  caseNumber: 'FC-24-000123',
};

describe('Ontario Form 10 — structured claim/response scaffold', () => {
  test('renders PART A / PART B / PART C headers in order', () => {
    const doc = render(commonData);
    const items = doc.sections.facts.items;
    const headers = items.filter((it) => it && it.type === 'form10_header').map((it) => it.content);
    expect(headers[0]).toMatch(/PART A — RESPONSES TO THE APPLICANT.S CLAIMS/i);
    expect(headers[1]).toMatch(/PART B — IMPORTANT FACTS SUPPORTING THE RESPONSES/i);
    expect(headers[2]).toMatch(/PART C — CLAIMS BY THE RESPONDENT/i);
  });

  test('exposes structured form10 sub-object with all three parts populated', () => {
    const doc = render({
      ...commonData,
      answerPositions: [
        { paragraph: '1', position: 'admit' },
        { paragraph: '3', position: 'deny' },
        { paragraph: '4', position: 'lack_knowledge' },
      ],
      supportingFacts: [
        'Respondent has been the primary caregiver since separation.',
        'Applicant\'s income exceeds the T1 line 15000 figure.',
      ],
      includeCounterclaim: true,
      marriageDate: '2010-06-01',
      separationDate: '2020-05-01',
    });
    const { partA, partB, partC } = doc.sections.facts.form10;
    expect(partA.items.length).toBeGreaterThanOrEqual(3); // admit + deny + lack_knowledge
    expect(partB.items.length).toBe(2);
    expect(partC.items.length).toBeGreaterThan(0); // counterclaim allegations
    expect(partA.items.some((it) => /ADMITS/i.test(it.content))).toBe(true);
    expect(partB.items[0].content).toMatch(/primary caregiver/);
  });

  test('empty case still emits scaffolded parts with fill-in prompts (never a bare paragraph)', () => {
    const doc = render(commonData);
    const { partA, partB, partC } = doc.sections.facts.form10;
    // Part A carries at least one response item (either the drafter's own
    // AGREE/DO NOT AGREE/NO KNOWLEDGE bucket lines or a base-default
    // general-denial line — both are valid Form 10 responses).
    expect(
      partA.items.some((it) => /AGREES|DOES NOT AGREE|NO KNOWLEDGE|DENIAL|denies/i.test(it.content)),
    ).toBe(true);
    expect(partB.items[0].content).toMatch(/Important facts supporting/);
    expect(partC.items[0].content).toMatch(/makes no claim against the Applicant/);
  });

  test('signature location label reads "(city and province)" — not "state/province"', () => {
    const doc = render(commonData);
    expect(doc.sections.perjuryStatement).toMatch(/\(city and province\)/);
    expect(doc.sections.perjuryStatement).not.toMatch(/state\/province/);
  });
});
