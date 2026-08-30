/**
 * Sarah AB round-2: the grounds paragraph must NOT plead a current-tense
 * one-year separation while its own draft note says the ground is not
 * available yet. Under-12-mo separation gets a pure future-tense plea plus
 * the drafter note; never both a "have lived separate and apart for at
 * least one year" assertion and a "not yet met" warning.
 */

'use strict';

const AlbertaDivorcePetitionTemplate =
  require('../../templates/states/alberta/DivorcePetitionTemplate');

function iso(d) {
  return d.toISOString().slice(0, 10);
}

function sixMonthsAgo() {
  const d = new Date();
  d.setMonth(d.getMonth() - 6);
  return iso(d);
}

const tpl = new AlbertaDivorcePetitionTemplate();

describe('Alberta grounds-gate consistency (Sarah AB round-2)', () => {
  test('under 12mo separation: pure future-tense plea + draft warning, NOT the current-tense assertion', () => {
    const text = tpl.getGroundsText('separation', { separationDate: sixMonthsAgo() });

    // Future-tense operative plea present.
    expect(text).toMatch(/will have been living separate and apart for at least one year/);
    // Draft warning present, with fault-ground alternatives.
    expect(text).toMatch(/Draft/);
    expect(text).toMatch(/do not file until/i);
    expect(text).toMatch(/cruelty/);
    expect(text).toMatch(/adultery/);

    // Must NOT also carry the traditional current-tense assertion.
    expect(text).not.toMatch(/have lived separate and apart for at least one year/);
    // And must not carry a factual "have been separated since" lead-in that
    // reads as though it were asserting current 1-year separation.
    expect(text).not.toMatch(/have been separated since/);
  });
});
