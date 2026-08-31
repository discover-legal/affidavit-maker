/**
 * Round-7 attorney review (Tavita FL, 2026-08-30): when the petition
 * pleads a prenuptial agreement in ¶¶9-10, the prayer must expressly
 * ask the court to enforce it under Fla. Stat. § 61.079. A generic
 * "such other relief" prayer does not preserve the request.
 */

const FloridaDivorcePetitionTemplate =
  require('../../templates/states/florida/DivorcePetitionTemplate');

function baseData(overrides = {}) {
  return {
    petitionerName: 'Marco Rossi',
    respondentName: 'Tavita Faletau',
    state: 'FL',
    county: 'Miami-Dade',
    marriageDate: '2018-06-15',
    hasMinorChildren: false,
    hasProperty: true,
    ...overrides,
  };
}

describe('Florida petition — prayer includes prenup enforcement (Round-7)', () => {
  test('prenupSigned=true → prayer asks the court to enforce §61.079', () => {
    const tpl = new FloridaDivorcePetitionTemplate();
    const section = tpl.generateReliefSection(
      baseData({ prenupSigned: true, prenupSignedYear: 2018 }),
    );
    const body = section.items.map((i) => i.content).join('\n');
    expect(body).toMatch(/prenuptial agreement/i);
    expect(body).toMatch(/§\s*61\.079/);
  });

  test('facts-derived prenup subcategory also triggers the prayer item', () => {
    const tpl = new FloridaDivorcePetitionTemplate();
    const section = tpl.generateReliefSection(
      baseData({
        facts: [
          { subcategory: 'prenuptial_agreement', content: 'Signed prenup 2018.' },
        ],
      }),
    );
    const body = section.items.map((i) => i.content).join('\n');
    expect(body).toMatch(/§\s*61\.079/);
  });

  test('no prenup on file → no §61.079 enforcement item', () => {
    const tpl = new FloridaDivorcePetitionTemplate();
    const section = tpl.generateReliefSection(baseData());
    const body = section.items.map((i) => i.content).join('\n');
    expect(body).not.toMatch(/61\.079/);
  });
});
