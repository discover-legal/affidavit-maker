/**
 * Alberta Statement of Claim for Divorce — s.8(2)(a) grounds gate.
 *
 * When the separation is shorter than one year, the template must not
 * assert "have lived separate and apart for at least one year" — that is
 * simply not true. It must switch to prospective language and emit a
 * drafter note pointing to the fault-ground alternatives (Divorce Act
 * s.8(2)(b) — cruelty, adultery).
 */

'use strict';

const AlbertaDivorcePetitionTemplate =
  require('../../templates/states/alberta/DivorcePetitionTemplate');

function iso(d) {
  return d.toISOString().slice(0, 10);
}

function underOneYearAgo() {
  const d = new Date();
  d.setMonth(d.getMonth() - 6); // 6 months ago
  return iso(d);
}

function overOneYearAgo() {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 2);
  return iso(d);
}

const tpl = new AlbertaDivorcePetitionTemplate();

describe('Alberta grounds gate — Divorce Act s.8(2)(a)', () => {
  test('separation < 1 year: uses prospective language and drafter warning; never "as required"', () => {
    const text = tpl.getGroundsText('separation', { separationDate: underOneYearAgo() });
    expect(text).toMatch(/will have been living separate and apart/);
    expect(text).toMatch(/paragraph 8\(2\)\(a\) of the Divorce Act/);
    expect(text).toMatch(/cruelty|adultery/i);
    expect(text).toMatch(/Draft/);
    expect(text).not.toMatch(/^The spouses have lived separate and apart for at least one year immediately preceding/);
  });

  test('separation > 1 year: uses the traditional "have lived separate and apart" assertion', () => {
    const text = tpl.getGroundsText('separation', { separationDate: overOneYearAgo() });
    expect(text).toMatch(/have lived separate and apart for at least one year/);
    expect(text).not.toMatch(/will have been living/);
  });

  test('missing separation date: falls back to the traditional assertion (base behaviour)', () => {
    const text = tpl.getGroundsText('separation', {});
    expect(text).toMatch(/have lived separate and apart for at least one year/);
  });
});
