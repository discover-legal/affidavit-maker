/**
 * Round-7 attorney review (Mari TX, 2026-08-30): when the property
 * section (¶9) pleads no community property to divide, the prayer must
 * not still ask the court to divide a community estate. Test the
 * property section and the prayer stay consistent.
 */

const TexasDivorcePetitionTemplate =
  require('../../templates/states/texas/DivorcePetitionTemplate');

function baseData(overrides = {}) {
  return {
    petitionerName: 'Mari Vasquez-McPherson',
    respondentName: 'Ray Delacroix',
    state: 'TX',
    county: 'Harris',
    marriageDate: '2015-04-10',
    hasMinorChildren: false,
    groundsForDivorce: 'insupportability',
    ...overrides,
  };
}

describe('Texas petition — property/prayer consistency (Round-7, Mari)', () => {
  test('hasProperty=false → prayer omits community estate division', () => {
    const tpl = new TexasDivorcePetitionTemplate();
    const section = tpl.generateReliefSection(
      baseData({ hasProperty: false, hasDebts: false }),
    );
    const body = section.items.map((i) => i.content).join('\n');
    expect(body).not.toMatch(/Division of the community estate/);
  });

  test('noPropertyConfirmed=true → prayer omits community estate division', () => {
    const tpl = new TexasDivorcePetitionTemplate();
    const section = tpl.generateReliefSection(
      baseData({ noPropertyConfirmed: true }),
    );
    const body = section.items.map((i) => i.content).join('\n');
    expect(body).not.toMatch(/Division of the community estate/);
  });

  test('facts saying no property → prayer omits community estate division', () => {
    const tpl = new TexasDivorcePetitionTemplate();
    const section = tpl.generateReliefSection(
      baseData({
        facts: [
          {
            category: 'property',
            subcategory: 'no_property',
            content: 'No property, no house, no retirement.',
          },
        ],
      }),
    );
    const body = section.items.map((i) => i.content).join('\n');
    expect(body).not.toMatch(/Division of the community estate/);
  });

  test('hasProperty=true → prayer still includes community estate division', () => {
    const tpl = new TexasDivorcePetitionTemplate();
    const section = tpl.generateReliefSection(
      baseData({ hasProperty: true }),
    );
    const body = section.items.map((i) => i.content).join('\n');
    expect(body).toMatch(/Division of the community estate/);
  });
});
