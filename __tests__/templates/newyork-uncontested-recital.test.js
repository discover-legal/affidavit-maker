/**
 * NY uncontested-posture recital + incorporation prayer (attorney
 * round-2, 2026-08-30). When the profile carries a Settlement Agreement
 * / mediated CSSA support / spousal-support waiver, the grounds section
 * appends a recital and the relief section adds an incorporation prayer
 * ("incorporated but not merged").
 */

const NewYorkDivorcePetitionTemplate =
  require('../../templates/states/newyork/DivorcePetitionTemplate');

function base(overrides = {}) {
  return {
    petitionerName: 'David Cohen',
    respondentName: 'Ruth Cohen',
    state: 'NY',
    county: 'New York',
    ...overrides,
  };
}

describe('NY uncontested recital + incorporation prayer', () => {
  const tpl = new NewYorkDivorcePetitionTemplate();

  test('mediatedChildSupport + spousalSupportWaived → recital + incorporation prayer', () => {
    const data = base({
      settlementAgreementDate: '2026-06-15',
      mediatedChildSupport: true,
      spousalSupportWaived: true,
      hasMinorChildren: true,
      children: [{ name: 'Emma', birthYear: 2020 }],
    });

    const grounds = tpl.generateGroundsSection(data);
    const groundsBody = grounds.items.map((i) => i.content).join('\n');
    expect(groundsBody).toMatch(/Settlement Agreement/);
    expect(groundsBody).toMatch(/child support \(calculated pursuant to the Child Support Standards Act\)/);
    expect(groundsBody).toMatch(/mutual waiver of spousal maintenance/);

    const relief = tpl.generateReliefSection(data);
    const reliefBody = relief.items.map((i) => i.content).join('\n');
    expect(reliefBody).toMatch(/Incorporating, but not merging/);
    expect(reliefBody).toMatch(/Judgment of Divorce/);
  });

  test('no settlement facts → no recital, no incorporation prayer', () => {
    const data = base();
    const grounds = tpl.generateGroundsSection(data);
    const groundsBody = grounds.items.map((i) => i.content).join('\n');
    expect(groundsBody).not.toMatch(/Settlement Agreement/);

    const relief = tpl.generateReliefSection(data);
    const reliefBody = relief.items.map((i) => i.content).join('\n');
    expect(reliefBody).not.toMatch(/Incorporating, but not merging/);
  });
});
