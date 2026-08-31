/**
 * Sarah AB round-7 (2026-08-30): a stricter version of the
 * single-intro rule. Round-6 stopped repeating the s.19 preamble in
 * front of every supporting fact, but the rendered petition still
 * carried a SECOND intro-style paragraph — the trailing "The
 * Plaintiff asks the Court to impute income to the Defendant
 * pursuant to section 19..." — right after the last fact, giving
 * readers two intros around the same block. That closing ask
 * duplicates the RELIEF prayer clause (see getReliefClauses item
 * (f), which already asks for s.19 imputation AND s.21 disclosure),
 * so the imputation section must render as intro + facts and
 * nothing else that reads as another intro/ask.
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
      { category: 'child_support', subcategory: 'income_underreporting',
        content: 'I believe Ahmed has been under-reporting his income.' },
    ],
  };
}

// A paragraph is intro-shaped when it opens with "The Plaintiff" and
// mentions imputing income. This catches both the surviving preamble
// ("pleads the following in support of a request that income be
// imputed...") and the removed closing ask ("asks the Court to impute
// income..."); exactly one must remain across the whole petition.
const INTRO_SHAPE = /The\s+Plaintiff\b[^.]*\bimpute/gi;

describe('Alberta imputation renders exactly ONE intro paragraph', () => {
  const tpl = new AlbertaDivorcePetitionTemplate();

  test('across contested-issues items', () => {
    const doc = tpl.generateDocument(payload());
    const items = doc.sections.contestedIssues.items || [];
    const introItems = items.filter((i) => INTRO_SHAPE.test(String(i.content || '')));
    expect(introItems.length).toBe(1);
  });

  test('across fullText between the section header and RELIEF', () => {
    const doc = tpl.generateDocument(payload());
    const text = String(doc.fullText || '');
    const startIdx = text.indexOf('CONTESTED ISSUES');
    const endIdx = text.indexOf('RELIEF CLAIMED');
    expect(startIdx).toBeGreaterThan(-1);
    expect(endIdx).toBeGreaterThan(startIdx);
    const block = text.slice(startIdx, endIdx);
    const matches = block.match(INTRO_SHAPE) || [];
    expect(matches.length).toBe(1);
  });
});
