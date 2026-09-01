/**
 * Round-6 attorney review (Sarah AB, 2026-08-30 v29):
 * previous rendering repeated the 30-word s.19 preamble in front of every
 * supporting fact and left double periods on the tail ("...contracting
 * business.."). Each supporting fact must render as its own numbered
 * paragraph under a SINGLE intro paragraph, with no double periods.
 */
'use strict';

const AlbertaDivorcePetitionTemplate =
  require('../../templates/states/alberta/DivorcePetitionTemplate');

function payload() {
  return {
    petitionerName: 'Sarah Khoury',
    respondentName: 'Ahmed Khoury',
    state: 'AB',
    county: 'Calgary',
    marriageDate: '2010-06-15',
    separationDate: '2025-02-01',
    groundsForDivorce: 'separation',
    hasMinorChildren: true,
    children: [{ name: 'Layla', birthYear: 2011 }],
    facts: [
      { category: 'child_support', subcategory: 'respondent_income',
        content: 'Ahmed Khoury is self-employed and operates a contracting business.' },
      { category: 'child_support', subcategory: 'respondent_income',
        content: "Ahmed's income has ranged from approximately $60,000 to $180,000 annually." },
      { category: 'child_support', subcategory: 'income_underreporting',
        content: 'I believe Ahmed has been under-reporting his income.' },
    ],
  };
}

describe('Alberta s.19 imputation renders ONE intro + numbered supporting facts', () => {
  const tpl = new AlbertaDivorcePetitionTemplate();

  test('the s.19 preamble appears exactly once', () => {
    const doc = tpl.generateDocument(payload());
    const preamble = /pleads the following in support of a request that income be imputed/g;
    const matches = String(doc.fullText).match(preamble) || [];
    expect(matches.length).toBe(1);
  });

  test('no double periods in the contested-issues paragraphs', () => {
    const doc = tpl.generateDocument(payload());
    const contested = doc.sections.contestedIssues.items.map((i) => i.content).join('\n');
    expect(contested).not.toMatch(/\.\./);
  });

  test('each supporting fact still appears as its own numbered paragraph', () => {
    const doc = tpl.generateDocument(payload());
    const items = doc.sections.contestedIssues.items;
    // Round-7 (2026-08-30): the trailing "asks the Court to impute" prayer
    // paragraph was dropped as duplicative of the RELIEF clause, so the
    // block is 1 intro + 3 facts = 4 items minimum.
    expect(items.length).toBeGreaterThanOrEqual(4);
    const joined = items.map((i) => i.content).join('\n');
    expect(joined).toMatch(/self-employed/i);
    expect(joined).toMatch(/60,000/);
    expect(joined).toMatch(/180,000/);
    expect(joined).toMatch(/under-reporting/i);
  });
});
