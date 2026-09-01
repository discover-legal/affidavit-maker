/** @jest-environment node */
'use strict';

/**
 * California FL-100 — spousal-support election prompt.
 *
 * Attorney round-5 (Alison CA, 2026-08-30): a California dissolution
 * petition must AFFIRMATIVELY elect one of three positions on spousal
 * support: (a) REQUEST (Family Code § 4320), (b) WAIVE + terminate
 * jurisdiction (Family Code § 4335), or (c) RESERVE jurisdiction
 * (Family Code § 4330). Silence in the FL-100 can bind. When the
 * profile is silent, the draft must surface a fill-in prompt naming
 * all three options.
 */

const CaliforniaDivorcePetitionTemplate = require('../../templates/states/california/DivorcePetitionTemplate');

function baseData(overrides = {}) {
  return {
    petitionerName: 'Alison Chen',
    respondentName: 'David Chen',
    state: 'CA',
    county: 'San Diego',
    marriageDate: '2010-06-01',
    separationDate: '2023-06-01',
    ...overrides,
  };
}

function reliefText(data) {
  const template = new CaliforniaDivorcePetitionTemplate();
  const section = template.generateReliefSection(data);
  return section.items.map((it) => it.content).join('\n');
}

describe('California — spousal-support election', () => {
  test('silent profile emits a Draft prompt naming request / waive / reserve', () => {
    const text = reliefText(baseData());
    expect(text).toMatch(/Draft.*Spousal-support election/i);
    expect(text).toMatch(/REQUEST[^)]*4320/);
    expect(text).toMatch(/WAIVE[^)]*4335/);
    expect(text).toMatch(/RESERVE[^)]*4330/);
  });

  test('explicit requestSpousalSupport renders the § 4320 order', () => {
    const text = reliefText(baseData({ requestSpousalSupport: true }));
    expect(text).toMatch(/Order spousal support from Respondent to Petitioner \(Family Code § 4320\)/);
    expect(text).not.toMatch(/Draft.*Spousal-support election/i);
  });

  test('explicit waiver renders a § 4335 termination-of-jurisdiction clause', () => {
    const text = reliefText(baseData({ spousalSupportWaived: true }));
    expect(text).toMatch(/Terminate the Court's jurisdiction to award spousal support/);
    expect(text).toMatch(/Family Code § 4335/);
    expect(text).not.toMatch(/Draft.*Spousal-support election/i);
  });

  test('explicit reservation renders a § 4330 reservation clause', () => {
    const text = reliefText(baseData({ spousalSupportReserved: true }));
    expect(text).toMatch(/Reserve jurisdiction over spousal support/);
    expect(text).toMatch(/Family Code § 4330/);
    expect(text).not.toMatch(/Draft.*Spousal-support election/i);
  });

  test('an unknown-string election ("undecided", "tbd") still triggers the Draft prompt', () => {
    for (const marker of ['undecided', 'TBD', 'unknown', 'silent']) {
      const text = reliefText(baseData({ spousalSupport: marker }));
      expect(text).toMatch(/Draft.*Spousal-support election/i);
    }
  });
});
