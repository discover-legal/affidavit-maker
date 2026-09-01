/** @jest-environment node */
'use strict';

/**
 * georgia-prayer-mirroring.test.js
 *
 * Attorney round-2 (2026-08): Amara asked for sole legal + sole
 * physical custody with supervised visitation only; the GA prayer
 * still rendered the generic "legal and physical custody of the
 * minor child(ren) in their best interests" boilerplate. The relief
 * section must mirror the stated ask.
 */

const GeorgiaDivorcePetitionTemplate = require('../../templates/states/georgia/DivorcePetitionTemplate');

function baseData(overrides = {}) {
  return {
    petitionerName: 'Amara Plaintiff',
    respondentName: 'Ray Defendant',
    state: 'GA',
    county: 'Fulton',
    marriageDate: '2015-06-01',
    hasMinorChildren: true,
    children: [{ name: 'Kai Plaintiff', birthDate: '2018-03-14' }],
    ...overrides,
  };
}

function reliefText(section) {
  return section.items
    .filter((it) => it.type === 'relief_item')
    .map((it) => it.content)
    .join('\n');
}

describe('Georgia prayer mirroring — sole custody + supervised visitation', () => {
  const petition = new GeorgiaDivorcePetitionTemplate();

  test('custodyPreference=sole_legal_sole_physical renders sole-custody prayer', () => {
    const section = petition.generateReliefSection(
      baseData({ custodyPreference: 'sole_legal_sole_physical' })
    );
    const text = reliefText(section);
    expect(text).toMatch(/sole legal custody and sole physical custody/i);
    expect(text).not.toMatch(/legal and physical custody of the minor child\(ren\) in their best interests/i);
  });

  test('sole-custody + supervised-visitation preference renders supervised-visitation prayer', () => {
    const section = petition.generateReliefSection(
      baseData({
        custodyPreference: 'sole_legal_sole_physical',
        visitationPreference: 'supervised',
      })
    );
    const text = reliefText(section);
    expect(text).toMatch(/sole legal custody and sole physical custody/i);
    expect(text).toMatch(/Defendant.*visitation.*supervised/i);
    expect(text).not.toMatch(/^Establish a parenting time schedule;$/m);
  });

  test('facts naming sole custody + supervised visitation trigger the mirrored prayer', () => {
    const section = petition.generateReliefSection(
      baseData({
        facts: [
          {
            category: 'children',
            subcategory: 'custody request',
            content: 'Plaintiff seeks sole legal and sole physical custody of Kai; Defendant should have supervised visitation only.',
          },
        ],
      })
    );
    const text = reliefText(section);
    expect(text).toMatch(/sole legal custody and sole physical custody/i);
    expect(text).toMatch(/supervised/i);
  });

  test('generic case (no stated preference) keeps the historical best-interests prayer', () => {
    const section = petition.generateReliefSection(baseData());
    const text = reliefText(section);
    expect(text).toMatch(/legal and physical custody of the minor child\(ren\) in their best interests/i);
    expect(text).not.toMatch(/sole legal custody and sole physical custody/i);
  });

  test('sole-custody prayer names the actual Plaintiff', () => {
    const section = petition.generateReliefSection(
      baseData({
        petitionerName: 'Amara Plaintiff',
        custodyPreference: 'sole_legal_sole_physical',
      })
    );
    const text = reliefText(section);
    expect(text).toMatch(/Award Amara Plaintiff sole legal custody/i);
  });
});
