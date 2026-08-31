/**
 * Attorney round-5 (Sarah AB, 2026-08-30): the s.19 imputation prayer
 * appeared in RELIEF but the record carried no factual paragraphs
 * supporting it — the payor's self-employment, income variability
 * ($60k–$180k), and under-reporting were never pleaded as sworn facts.
 * The Alberta template must render those facts in a numbered pleading
 * section (contestedIssues) that appears in the assembled PDF (which
 * previously walked only parties → property, dropping contestedIssues on
 * the floor). Fact paragraphs must render in fullText AND be numbered.
 */
'use strict';

const AlbertaDivorcePetitionTemplate =
  require('../../templates/states/alberta/DivorcePetitionTemplate');

function payload(extra = {}) {
  return {
    petitionerName: 'Sarah Khoury',
    respondentName: 'Ahmed Khoury',
    state: 'AB',
    county: 'Calgary',
    marriageDate: '2010-06-15',
    separationDate: '2025-02-01',
    groundsForDivorce: 'separation',
    hasMinorChildren: true,
    children: [{ name: 'Layla', birthYear: 2011 }, { name: 'Zayn', birthYear: 2014 }],
    facts: [
      {
        category: 'child_support',
        subcategory: 'respondent_income',
        content: 'Ahmed Khoury is self-employed and operates a contracting business.',
      },
      {
        category: 'child_support',
        subcategory: 'respondent_income',
        content: "Ahmed's income has ranged from approximately $60,000 to $180,000 annually.",
      },
      {
        category: 'child_support',
        subcategory: 'income_underreporting',
        content: 'I believe Ahmed has been under-reporting his income on line 15000.',
      },
    ],
    ...extra,
  };
}

describe('Alberta s.19 factual paragraphs render in the pleading (not only in RELIEF)', () => {
  const tpl = new AlbertaDivorcePetitionTemplate();

  test('contestedIssues section exists and its items carry numbered paragraphs', () => {
    const doc = tpl.generateDocument(payload());
    expect(doc.sections.contestedIssues).toBeTruthy();
    const items = doc.sections.contestedIssues.items;
    expect(items.length).toBeGreaterThan(0);
    // Every item must be a numbered pleading paragraph (item.number set to
    // an integer > propertyInfo's last paragraph number).
    for (const item of items) {
      expect(typeof item.number).toBe('number');
      expect(item.number).toBeGreaterThan(0);
    }
  });

  test('imputation facts render as sworn factual paragraphs', () => {
    const doc = tpl.generateDocument(payload());
    const contested = doc.sections.contestedIssues.items.map((i) => i.content).join('\n');
    expect(contested).toMatch(/self-employed/i);
    expect(contested).toMatch(/60,000|60[k,]/i);
    expect(contested).toMatch(/180,000|180[k,]/i);
    expect(contested).toMatch(/under-reporting|under reporting|line 15000/i);
    // Round-7 (2026-08-30): the trailing wrap-up paragraph was dropped as
    // duplicative of the RELIEF clause, so the intro is the only line that
    // cites the section here — it uses the "s.19" short form.
    expect(contested).toMatch(/s\.?\s?19 of the Federal Child Support Guidelines/i);
  });

  test('fullText carries the contested-issues section BEFORE the relief clause', () => {
    const doc = tpl.generateDocument(payload());
    const fullText = doc.fullText;
    expect(fullText).toMatch(/CONTESTED ISSUES/);
    const contestedIdx = fullText.indexOf('CONTESTED ISSUES');
    const reliefIdx = fullText.indexOf('RELIEF CLAIMED');
    expect(contestedIdx).toBeGreaterThan(0);
    expect(reliefIdx).toBeGreaterThan(contestedIdx);
    // Facts must appear in fullText, not merely on doc.sections.
    expect(fullText).toMatch(/self-employed/i);
    expect(fullText).toMatch(/60,000|180,000/);
  });
});
