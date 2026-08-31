// Round-3 attorney-review fix (2026-08-30): NY hasUncontestedPosture must
// fire from David-shape facts (subcategory=mutual_waiver on a
// spousal_support fact + subcategory=uncontested_agreement + mediated CSSA
// child-support fact) even when settlementAgreementDate /
// spousalSupportWaived / mediatedChildSupport structured fields are unset.

const NewYorkDivorcePetitionTemplate =
  require('../../templates/states/newyork/DivorcePetitionTemplate');

const DAVID_FACTS = [
  { content: 'The parties have agreed on the terms of an uncontested divorce.',
    category: 'relational', subcategory: 'uncontested_agreement' },
  { content: 'Petitioner David Rosenberg and Respondent Yvonne Rosenberg have each waived spousal maintenance.',
    category: 'spousal_support', subcategory: 'mutual_waiver' },
  { content: 'The parties have agreed that child support will be determined and paid in accordance with the New York Child Support Standards Act guidelines.',
    category: 'children', subcategory: 'child_support' },
  { content: 'The parties have mediated and agreed upon a parenting schedule for their minor child, Emma Rosenberg.',
    category: 'parental', subcategory: 'parenting_schedule' },
];

describe('NY uncontested-settlement live-shape recital', () => {
  const tpl = new NewYorkDivorcePetitionTemplate();

  test('hasUncontestedPosture fires from David-shape facts alone', () => {
    expect(tpl.hasUncontestedPosture({ facts: DAVID_FACTS })).toBe(true);
    // Also each individual signal:
    expect(tpl.hasUncontestedPosture({ facts: [DAVID_FACTS[0]] })).toBe(true);
    expect(tpl.hasUncontestedPosture({ facts: [DAVID_FACTS[1]] })).toBe(true);
  });

  test('getUncontestedRecital renders CSSA + waiver text from facts', () => {
    const text = tpl.getUncontestedRecital({
      hasMinorChildren: true,
      children: [{ name: 'Emma', dob: '2020' }],
      facts: DAVID_FACTS,
    });
    expect(text).toMatch(/Settlement Agreement/);
    expect(text).toMatch(/Child Support Standards Act/);
    expect(text).toMatch(/mutual waiver of spousal maintenance/);
  });

  test('grounds section includes an uncontested-posture recital paragraph', () => {
    const section = tpl.generateGroundsSection({
      state: 'NY', county: 'Kings',
      petitionerName: 'David Rosenberg', respondentName: 'Yvonne Rosenberg',
      groundsForDivorce: 'irretrievable_breakdown',
      hasMinorChildren: true,
      children: [{ name: 'Emma', dob: '2020' }],
      facts: DAVID_FACTS,
      _paragraphNum: 8,
    });
    const recital = section.items.find((it) => it.type === 'uncontested_recital');
    expect(recital).toBeTruthy();
    expect(recital.content).toMatch(/Settlement Agreement/);
  });

  test('silence (no facts, no structured flags) does NOT emit the recital', () => {
    const section = tpl.generateGroundsSection({
      state: 'NY', county: 'Kings',
      petitionerName: 'X', respondentName: 'Y',
      groundsForDivorce: 'irretrievable_breakdown',
      _paragraphNum: 8,
    });
    const recital = section.items.find((it) => it.type === 'uncontested_recital');
    expect(recital).toBeFalsy();
  });
});
