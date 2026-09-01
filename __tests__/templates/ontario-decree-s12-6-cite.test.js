/** @jest-environment node */
/**
 * Round-7 attorney (Marcus ON, 2026-08-30 v30b): the Certificate of Divorce
 * provision in the Divorce Act is s.12(6), not s.12(7). Ontario procedure
 * for obtaining the Certificate is Family Law Rules, O. Reg. 114/99,
 * r. 36(7). The prior cite (s.12(7)) is a stale-Act reference that would
 * fail an attorney sign-off.
 */

'use strict';

const OntarioDivorceDecreeTemplate = require('../../templates/states/ontario/DivorceDecreeTemplate');

function build() {
  const t = new OntarioDivorceDecreeTemplate();
  return t.generateDocument({
    role: 'respondent',
    state: 'ON',
    county: 'Toronto',
    petitionerName: 'Priya Thompson',
    respondentName: 'Marcus Thompson',
    affiantName: 'Marcus Thompson',
    marriageDate: '2013-08-03',
    separationDate: '2025-01-01',
    groundsForDivorce: 'breakdown_of_marriage',
    hasMinorChildren: false,
  });
}

function fullText(decree) {
  const parts = [];
  const visit = (v) => {
    if (v == null) return;
    if (typeof v === 'string') { parts.push(v); return; }
    if (Array.isArray(v)) { v.forEach(visit); return; }
    if (typeof v === 'object') { Object.values(v).forEach(visit); }
  };
  visit(decree);
  return parts.join('\n');
}

describe('Ontario decree — Certificate of Divorce statute cite', () => {
  test('cites Divorce Act s.12(6) — the actual Certificate of Divorce provision', () => {
    const text = fullText(build());
    expect(text).toMatch(/s\.12\(6\)/);
    // Certificate-of-divorce clause must be present.
    expect(text).toMatch(/Certificate of Divorce/i);
  });

  test('no longer cites the wrong s.12(7)', () => {
    const text = fullText(build());
    expect(text).not.toMatch(/s\.12\(7\)/);
  });

  test('procedural cite to Family Law Rules r. 36(7) accompanies the statute', () => {
    const text = fullText(build());
    expect(text).toMatch(/(Family Law Rules|FLR)[^\n]*36\(7\)/);
  });
});
