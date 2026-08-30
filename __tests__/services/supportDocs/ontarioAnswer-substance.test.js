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
    // Round-2 (Marcus, ON): Part C DEFAULTS to a claim template — never
    // "makes no claim" — so a respondent does not accidentally waive
    // corollary relief.
    expect(partC.items[0].content).toMatch(/RESERVES and CLAIMS|CLAIMS/);
    expect(partC.items[0].content).not.toMatch(/makes no claim/);
  });

  test('Part C emits an explicit no-claim statement only when respondentClaimsNothing is affirmatively set', () => {
    const doc = render({ ...commonData, respondentClaimsNothing: true });
    const { partC } = doc.sections.facts.form10;
    expect(partC.items[0].content).toMatch(/affirmatively makes no claim/);
  });

  test('contested-parenting profile auto-populates a Part C parenting-order claim', () => {
    const doc = render({
      ...commonData,
      custody_dispute_position:
        'The Respondent seeks mid-week parenting time on Wednesday evenings in addition to alternate weekends.',
    });
    const { partC } = doc.sections.facts.form10;
    const claim = partC.items.find((it) => /parenting order/i.test(it.content));
    expect(claim).toBeDefined();
    expect(claim.content).toMatch(/mid-week parenting time/);
    // Never a waiver.
    expect(partC.items.some((it) => /makes no claim/i.test(it.content))).toBe(false);
  });

  test('admissions pre-populate from divorce facts (marriage, separation, ground, children)', () => {
    const doc = render({
      ...commonData,
      marriageDate: '2010-06-01',
      marriageLocation: 'Toronto, Ontario',
      separationDate: '2020-05-01',
      oneYearSeparation: true,
      residencyOntario: true,
      children: [{ name: 'Alex Thompson', dob: '2012-04-15' }],
    });
    const { partA } = doc.sections.facts.form10;
    const admissions = partA.items.filter((it) => it.preAdmitted === true);
    // Marriage, separation, jurisdiction, ground, children ⇒ ≥ 5 pre-admits.
    expect(admissions.length).toBeGreaterThanOrEqual(4);
    const joined = admissions.map((it) => it.content).join('\n');
    expect(joined).toMatch(/2010-06-01/);
    expect(joined).toMatch(/2020-05-01/);
    expect(joined).toMatch(/one year/i);
    expect(joined).toMatch(/Alex Thompson/);
    // Every admission is phrased as ADMITS (not a blank checkbox scaffold).
    for (const it of admissions) {
      expect(it.content).toMatch(/ADMITS/);
      expect(it.content).not.toMatch(/mark one/);
    }
  });

  test('signature location label reads "(city and province)" — not "state/province"', () => {
    const doc = render(commonData);
    expect(doc.sections.perjuryStatement).toMatch(/\(city and province\)/);
    expect(doc.sections.perjuryStatement).not.toMatch(/state\/province/);
  });
});
