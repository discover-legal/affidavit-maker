/** @jest-environment node */
'use strict';

/**
 * georgia-petition-uccjea.test.js
 *
 * v19 replay: Amara (Georgia) had three minor children in her profile;
 * the GA petition named them but produced no UCCJEA / home-state
 * declaration. Georgia has adopted the UCCJEA as O.C.G.A. § 19-9-40 et
 * seq., and every pleading touching custody must state the child's home
 * state and 5-year residence history. Fix mirrors the v17-C NY pattern.
 */

const GeorgiaDivorcePetitionTemplate = require('../../templates/states/georgia/DivorcePetitionTemplate');

function baseData(overrides = {}) {
  return {
    petitionerName: 'Amara Plaintiff',
    respondentName: 'Ray Defendant',
    state: 'GA',
    county: 'Fulton',
    marriageDate: '2015-06-01',
    groundsForDivorce: 'irretrievably_broken',
    ...overrides,
  };
}

describe('Georgia petition — UCCJEA home-state declaration (O.C.G.A. § 19-9-40)', () => {
  const petition = new GeorgiaDivorcePetitionTemplate();

  test('UCCJEA declaration renders when minor children are present', () => {
    const section = petition.generateChildrenSection(
      baseData({
        hasMinorChildren: true,
        children: [
          { name: 'Child One', birthDate: '2018-04-12' },
          { name: 'Child Two', birthDate: '2020-01-15' },
          { name: 'Child Three', birthDate: '2022-07-30' },
        ],
      })
    );

    const joined = section.items.map((i) => i.content).join('\n');
    expect(joined).toMatch(/UCCJEA HOME-STATE DECLARATION/);
    expect(joined).toMatch(/O\.C\.G\.A\.\s*§\s*19-9-40/);
    expect(joined).toMatch(/home state of the minor child\(ren\)/i);
    expect(joined).toMatch(/last five \(5\) years/i);

    const headerCount = section.items.filter((i) => i.type === 'uccjea_header').length;
    expect(headerCount).toBe(1);

    const perChild = section.items.filter((i) => i.type === 'uccjea_child_address');
    expect(perChild).toHaveLength(3);
    expect(perChild[0].content).toMatch(/Child One/);
    expect(perChild[1].content).toMatch(/Child Two/);
    expect(perChild[2].content).toMatch(/Child Three/);
  });

  test('UCCJEA declaration is absent when there are no minor children', () => {
    const section = petition.generateChildrenSection(
      baseData({ hasMinorChildren: false })
    );
    const joined = section.items.map((i) => i.content).join('\n');
    expect(joined).not.toMatch(/UCCJEA/);
    expect(joined).not.toMatch(/19-9-40/);
    expect(section.items.every((i) => i.type !== 'uccjea_header')).toBe(true);
  });

  test('UCCJEA declaration is absent when children[] is empty and no minors flagged', () => {
    const section = petition.generateChildrenSection(
      baseData({ children: [] })
    );
    const joined = section.items.map((i) => i.content).join('\n');
    expect(joined).not.toMatch(/UCCJEA/);
  });

  test('honours childHomeState override when set', () => {
    const section = petition.generateChildrenSection(
      baseData({
        hasMinorChildren: true,
        children: [{ name: 'Child One', birthDate: '2018-04-12' }],
        childHomeState: 'Alabama',
      })
    );
    const homeStateItem = section.items.find((i) => i.type === 'uccjea_home_state');
    expect(homeStateItem.content).toMatch(/Alabama is the home state/);
  });

  test('lists prior addresses when supplied; otherwise a fill-in blank', () => {
    const section = petition.generateChildrenSection(
      baseData({
        hasMinorChildren: true,
        children: [
          {
            name: 'Child One',
            birthDate: '2018-04-12',
            currentAddress: '123 Peachtree, Atlanta GA',
            priorAddresses: ['456 Oak, Savannah GA (2018-2021)'],
          },
          { name: 'Child Two', birthDate: '2020-01-15' },
        ],
      })
    );
    const priors = section.items.filter((i) => i.type === 'uccjea_prior_addresses');
    expect(priors).toHaveLength(2);
    expect(priors[0].content).toMatch(/456 Oak, Savannah/);
    expect(priors[1].content).toMatch(/same as present address, except as follows/i);
  });

  test('discloses pending custody actions when present; otherwise the negative declaration', () => {
    const withActions = petition.generateChildrenSection(
      baseData({
        hasMinorChildren: true,
        children: [{ name: 'Child One', birthDate: '2018-04-12' }],
        pendingCustodyActions: ['Cobb County Case 2024-CV-1234'],
      })
    );
    const other = withActions.items.find((i) => i.type === 'uccjea_other_actions');
    expect(other.content).toMatch(/Cobb County Case 2024-CV-1234/);

    const withoutActions = petition.generateChildrenSection(
      baseData({
        hasMinorChildren: true,
        children: [{ name: 'Child One', birthDate: '2018-04-12' }],
      })
    );
    const otherNeg = withoutActions.items.find((i) => i.type === 'uccjea_other_actions');
    expect(otherNeg.content).toMatch(/has not participated/i);
  });
});
