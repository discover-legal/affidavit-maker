/**
 * Round-7 attorney review (Mari TX, 2026-08-30): the cruelty ground on
 * the Texas petition must carry its statutory pinpoint (Texas Family
 * Code §6.002) on the ground itself, not only via the §6.001
 * alternative that generateGroundsSection appends.
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
    hasProperty: false,
    noPropertyConfirmed: true,
    groundsForDivorce: 'cruelty',
    ...overrides,
  };
}

describe('Texas petition — §6.002 pinpoint on cruelty (Round-7, Mari)', () => {
  test('cruelty grounds text cites Texas Family Code §6.002', () => {
    const tpl = new TexasDivorcePetitionTemplate();
    const text = tpl.getGroundsText('cruelty', baseData());
    expect(text).toMatch(/§\s*6\.002/);
    expect(text).toMatch(/cruel treatment/i);
  });

  test('generateGroundsSection primary cruelty paragraph carries the §6.002 cite', () => {
    const tpl = new TexasDivorcePetitionTemplate();
    const section = tpl.generateGroundsSection(baseData());
    const primary = section.items.find((i) => i.type === 'grounds');
    expect(primary).toBeTruthy();
    expect(primary.content).toMatch(/§\s*6\.002/);
  });

  test('§6.001 alternative is still pleaded alongside', () => {
    const tpl = new TexasDivorcePetitionTemplate();
    const section = tpl.generateGroundsSection(baseData());
    const body = section.items.map((i) => i.content).join('\n');
    expect(body).toMatch(/§\s*6\.001|6\.001/);
    expect(body).toMatch(/insupportable/);
  });
});
