/**
 * Attorney round-4 (David NY, 2026-08-30). When the profile carries an
 * uncontested / settled posture (Settlement Agreement or
 * mediation-derived signals), the NY petition body and prayer must NOT
 * ask the Court to "determine custody" / "order child support" or
 * "award custody to the appropriate party" — the parties already agreed.
 * Both the child-section requests and prayer clause (c) must instead
 * approve / incorporate the Settlement Agreement.
 */

'use strict';

const NewYorkDivorcePetitionTemplate =
  require('../../templates/states/newyork/DivorcePetitionTemplate');

const tpl = new NewYorkDivorcePetitionTemplate();

function generate(extra = {}) {
  return tpl.generateDocument({
    petitionerName: 'David Rosenberg',
    respondentName: 'Yvonne Rosenberg',
    state: 'NY',
    county: 'Kings',
    marriageDate: '2015',
    marriagePlace: 'Manhattan',
    separationDate: 'January 2024',
    hasMinorChildren: true,
    numberOfChildren: 1,
    children: [{ name: 'Emma', birthDate: '2020', livesWith: 'Both Petitioner and Respondent in Brooklyn' }],
    groundsForDivorce: 'irreconcilable_differences',
    settlementAgreement: true,
    mediatedChildSupport: true,
    spousalSupportWaived: true,
    ...extra,
  });
}

function childrenText(doc) {
  return doc.sections.childrenInfo.items.map((i) => i.content || '').join('\n');
}
function reliefText(doc) {
  return doc.sections.reliefRequested.items.map((i) => i.content || '').join('\n');
}

describe('NY uncontested prayer switching', () => {
  test('children section: settlement present → approve/incorporate, not "determine/order"', () => {
    const doc = generate();
    const text = childrenText(doc);
    expect(text).not.toMatch(/determine custody of the child\(ren\)/i);
    expect(text).not.toMatch(/order child support in accordance/i);
    expect(text).toMatch(/approve and incorporate/i);
    expect(text).toMatch(/Settlement Agreement/);
  });

  test('prayer clause (c): settlement present → approve custody arrangement (not "award to appropriate party")', () => {
    const doc = generate();
    const text = reliefText(doc);
    expect(text).not.toMatch(/Awarding custody of the child\(ren\) to the appropriate party/);
    expect(text).toMatch(/Approving the custody arrangement as set forth in the parties' Settlement Agreement/);
    expect(text).toMatch(/Approving the parties' agreed child support arrangement/);
  });

  test('contested case (no settlement): retains determine/order phrasing', () => {
    const doc = generate({
      settlementAgreement: false,
      mediatedChildSupport: false,
      spousalSupportWaived: false,
      facts: [],
    });
    const kids = childrenText(doc);
    expect(kids).toMatch(/determine custody of the child\(ren\)/i);
    expect(kids).toMatch(/order child support in accordance with the Child Support Standards Act/i);
    const relief = reliefText(doc);
    expect(relief).toMatch(/Awarding custody of the child\(ren\) to the appropriate party/);
  });
});
