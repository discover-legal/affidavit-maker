/**
 * CA petition — positive 50/50 property division (attorney round-2,
 * 2026-08-30). When the profile carries standardPropertyDivision=true
 * or a fact mentioning a 50/50 / equal split, Section VI opens with an
 * affirmative Family Code § 2550 request instead of the "will agree…
 * or alternatively" hedge, and the Poway home + county still renders.
 */

const CaliforniaDivorcePetitionTemplate =
  require('../../templates/states/california/DivorcePetitionTemplate');

function base(overrides = {}) {
  return {
    petitionerName: 'Alison McPherson',
    respondentName: 'Kenji Ito',
    state: 'CA',
    county: 'San Diego',
    hasMinorChildren: false,
    ...overrides,
  };
}

describe('CA petition — Poway home + 50/50 request', () => {
  const tpl = new CaliforniaDivorcePetitionTemplate();

  test('standardPropertyDivision=true → affirmative § 2550 request, no "will agree" hedge', () => {
    const section = tpl.generatePropertySection(base({
      standardPropertyDivision: true,
      realEstateItems: [{ description: 'Poway home', county: 'San Diego' }],
    }));
    const body = section.items.map((i) => i.content).join('\n');
    expect(body).toMatch(/equal \(50\/50\) division/);
    expect(body).toMatch(/Family Code § 2550/);
    expect(body).not.toMatch(/will agree to a division of community property and debts, or alternatively/);
    expect(body).toMatch(/Poway home/);
    expect(body).toMatch(/San Diego County/);
  });

  test('facts mention "50/50 split" → hasStandardPropertyDivision fires', () => {
    const section = tpl.generatePropertySection(base({
      realEstateItems: [{ description: 'Poway home', county: 'San Diego' }],
      facts: [{ content: 'we want a standard 50/50 split of the community property' }],
    }));
    const body = section.items.map((i) => i.content).join('\n');
    expect(body).toMatch(/equal \(50\/50\) division/);
    expect(body).toMatch(/Family Code § 2550/);
  });

  test('no 50/50 flag: falls back to "will agree… or alternatively" hedge', () => {
    const section = tpl.generatePropertySection(base({
      realEstateItems: [{ description: 'Poway home', county: 'San Diego' }],
    }));
    const body = section.items.map((i) => i.content).join('\n');
    expect(body).toMatch(/will agree to a division of community property and debts, or alternatively/);
    expect(body).toMatch(/Poway home/);
  });
});
