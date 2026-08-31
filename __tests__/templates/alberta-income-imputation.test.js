/**
 * Sarah AB round-2 substantive #1: when the profile carries an income
 * imputation signal (self-employed payor, income under-reporting, or an
 * explicit imputation position), the AB petition must plead the s.19
 * imputation relief and render the supporting factual paragraphs.
 */

'use strict';

const AlbertaDivorcePetitionTemplate =
  require('../../templates/states/alberta/DivorcePetitionTemplate');

const tpl = new AlbertaDivorcePetitionTemplate();

function generate(extra = {}) {
  return tpl.generateDocument({
    petitionerName: 'Sarah Applicant',
    respondentName: 'Ahmed Defendant',
    state: 'AB',
    county: 'Calgary',
    marriageDate: '2010-06-15',
    separationDate: '2024-01-01',
    groundsForDivorce: 'separation',
    hasMinorChildren: true,
    children: [{ name: 'Layla', birthDate: '2011' }],
    ...extra,
  });
}

describe('Alberta s.19 income-imputation pleading (Sarah AB round-2)', () => {
  test('with income_underreporting fact: factual paragraphs + s.19 + s.21 relief', () => {
    const doc = generate({
      incomeUnderreporting: true,
      incomeUnderreportingDetail:
        "Defendant's self-employment income has ranged $60,000 to $180,000 with under-reporting on line 15000",
    });

    // Contested-issues section renders factual paragraph.
    expect(doc.sections.contestedIssues).toBeTruthy();
    const contested = doc.sections.contestedIssues.items.map((i) => i.content).join('\n');
    // Round-7 (2026-08-30): the trailing wrap-up "asks the Court" paragraph
    // was removed as duplicative of the RELIEF prayer, so the intro is now
    // the only line that cites the section — it uses the "s.19" short form.
    expect(contested).toMatch(/s\.?\s?19 of the Federal Child Support Guidelines/i);
    expect(contested).toMatch(/\$60,000 to \$180,000/);

    // Relief clause carries the s.19 imputation + s.21 disclosure prayer.
    const relief = doc.sections.reliefRequested.items.map((i) => i.content).join('\n');
    expect(relief).toMatch(/imputing income to the Defendant under s\.19/);
    expect(relief).toMatch(/financial disclosure pursuant to s\.21/);
  });

  test('with respondent_self_employed alone: still triggers imputation relief', () => {
    const doc = generate({ respondentSelfEmployed: true });
    const relief = doc.sections.reliefRequested.items.map((i) => i.content).join('\n');
    expect(relief).toMatch(/imputing income to the Defendant under s\.19/);
  });

  test('no imputation signal: no s.19 relief', () => {
    const doc = generate();
    const relief = doc.sections.reliefRequested.items.map((i) => i.content).join('\n');
    expect(relief).not.toMatch(/s\.19/);
  });
});
