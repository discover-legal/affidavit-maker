/**
 * Attorney round-4 (Sarah AB, 2026-08-30). The LLM extractor put every
 * s.19 income-imputation signal on facts[] (subcategories
 * `income_imputation_request`, `income_imputation`,
 * `income_underreporting`, and `respondent_income` + content naming
 * "self-employed"), never on the structured `respondentSelfEmployed` /
 * `incomeUnderreporting` fields. Prior gate only read structured fields,
 * so Sarah's Statement of Claim silently dropped the s.19 relief.
 * With the widened gate the imputation pleading must fire.
 */

'use strict';

const AlbertaDivorcePetitionTemplate =
  require('../../templates/states/alberta/DivorcePetitionTemplate');

const tpl = new AlbertaDivorcePetitionTemplate();

function generate(extra = {}) {
  return tpl.generateDocument({
    petitionerName: 'Sarah Khoury',
    respondentName: 'Ahmed Khoury',
    state: 'AB',
    county: 'Calgary',
    marriageDate: '2010',
    separationDate: '2025-02-01',
    groundsForDivorce: 'breakdown_of_marriage',
    hasMinorChildren: true,
    children: [{ name: 'Layla', birthDate: '2011' }, { name: 'Zayn', birthDate: '2014' }],
    ...extra,
  });
}

describe('Alberta s.19 pleading fires when signal lives on facts[]', () => {
  test('income_imputation_request subcategory on facts triggers s.19 relief + factual paragraph', () => {
    const doc = generate({
      facts: [
        {
          category: 'child_support',
          subcategory: 'income_imputation_request',
          content:
            'I want the court to impute income to Ahmed Khoury based on his actual earning capacity.',
        },
      ],
    });
    const relief = doc.sections.reliefRequested.items.map((i) => i.content).join('\n');
    expect(relief).toMatch(/imputing income to the Defendant under s\.19/);
    expect(relief).toMatch(/financial disclosure pursuant to s\.21/);
    expect(doc.sections.contestedIssues).toBeTruthy();
    const contested = doc.sections.contestedIssues.items.map((i) => i.content).join('\n');
    // Round-7 (2026-08-30): the trailing wrap-up paragraph was dropped as
    // duplicative of the RELIEF clause, so the intro is the only line that
    // cites the section here — it uses the "s.19" short form.
    expect(contested).toMatch(/s\.?\s?19 of the Federal Child Support Guidelines/i);
  });

  test('respondent_income fact naming self-employment triggers s.19', () => {
    const doc = generate({
      facts: [
        {
          category: 'child_support',
          subcategory: 'respondent_income',
          content: 'Ahmed Khoury is self-employed and operates a contracting business.',
        },
        {
          category: 'child_support',
          subcategory: 'respondent_income',
          content:
            "Ahmed Khoury's income varies substantially, from approximately $60,000 to $180,000.",
        },
      ],
    });
    const relief = doc.sections.reliefRequested.items.map((i) => i.content).join('\n');
    expect(relief).toMatch(/imputing income to the Defendant under s\.19/);
    const contested = doc.sections.contestedIssues.items.map((i) => i.content).join('\n');
    // The factual paragraphs recite the payor evidence.
    expect(contested).toMatch(/self-employed/);
    expect(contested).toMatch(/\$60,000|\$180,000|60[k,]|180[k,]/i);
  });

  test('income_underreporting subcategory alone triggers s.19', () => {
    const doc = generate({
      facts: [
        {
          category: 'support',
          subcategory: 'income_underreporting',
          content: 'I believe Ahmed has been under-reporting his income to reduce child support.',
        },
      ],
    });
    const relief = doc.sections.reliefRequested.items.map((i) => i.content).join('\n');
    expect(relief).toMatch(/imputing income to the Defendant under s\.19/);
  });
});
