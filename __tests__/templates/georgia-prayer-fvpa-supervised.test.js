/**
 * GA Complaint for Divorce — FVPA supervised-visitation prayer scaling
 * (attorney round-3, Amara, 2026-08-30).
 *
 * O.C.G.A. § 19-9-3(a)(4) creates a presumption AGAINST awarding
 * custody to a parent found to have committed family violence.
 * O.C.G.A. § 19-9-7 authorizes supervised or restricted visitation.
 * When the petition pleads cruel treatment (O.C.G.A. § 19-5-3(10)) or
 * family-violence facts, the prayer must elevate to supervised
 * visitation instead of a generic "best interests" parenting-time
 * schedule.
 */

const GeorgiaDivorcePetitionTemplate = require('../../templates/states/georgia/DivorcePetitionTemplate');

function baseData(overrides = {}) {
  return {
    petitionerName: 'Amara Okafor',
    respondentName: 'Kwame Okafor',
    state: 'GA',
    county: 'Fulton',
    marriageDate: '2015-06-15',
    hasMinorChildren: true,
    children: [{ name: 'Ada Okafor', birthDate: '2018-04-22' }],
    ...overrides,
  };
}

describe('GA prayer scaling — FVPA supervised visitation', () => {
  test('cruelty grounds + sole custody preference → prayer elevates to supervised visitation', () => {
    const tpl = new GeorgiaDivorcePetitionTemplate();
    const relief = tpl.generateReliefSection(baseData({
      groundsForDivorce: 'cruel_treatment',
      custodyPreference: 'sole_legal_sole_physical',
    }));
    const joined = relief.items.map((i) => i.content).join('\n');
    expect(joined).toMatch(/supervised/i);
    expect(joined).toMatch(/visitation/i);
    expect(joined).toMatch(/O\.C\.G\.A\. § 19-9-7/);
    expect(joined).toMatch(/§ 19-9-3\(a\)\(4\)/);
    expect(joined).not.toMatch(/parenting time schedule that serves the best interests/);
  });

  test('cruelty grounds alone (no custody preference) still elevates to supervised', () => {
    const tpl = new GeorgiaDivorcePetitionTemplate();
    const relief = tpl.generateReliefSection(baseData({
      groundsForDivorce: 'cruel_treatment',
    }));
    const joined = relief.items.map((i) => i.content).join('\n');
    expect(joined).toMatch(/supervised/i);
    expect(joined).toMatch(/visitation/i);
    expect(joined).toMatch(/O\.C\.G\.A\. § 19-9-7/);
  });

  test('family-violence facts (no cruelty ground selected) also trip the elevation', () => {
    const tpl = new GeorgiaDivorcePetitionTemplate();
    const relief = tpl.generateReliefSection(baseData({
      groundsForDivorce: 'irretrievably_broken',
      facts: [
        {
          category: 'incident',
          subcategory: 'family_violence',
          content: 'Defendant struck me during an argument in 2023.',
        },
      ],
    }));
    const joined = relief.items.map((i) => i.content).join('\n');
    expect(joined).toMatch(/supervised/i);
    expect(joined).toMatch(/visitation/i);
    expect(joined).toMatch(/§ 19-9-3\(a\)\(4\)/);
  });

  test('no cruelty, no family-violence facts → generic best-interests prayer', () => {
    const tpl = new GeorgiaDivorcePetitionTemplate();
    const relief = tpl.generateReliefSection(baseData({
      groundsForDivorce: 'irretrievably_broken',
    }));
    const joined = relief.items.map((i) => i.content).join('\n');
    expect(joined).toMatch(/best interests/i);
    expect(joined).not.toMatch(/supervised visitation/i);
  });
});
