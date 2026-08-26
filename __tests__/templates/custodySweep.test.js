/** @jest-environment node */
'use strict';

/**
 * custodySweep.test.js
 *
 * All-jurisdiction sweep of the decree custody-inversion fix.
 *
 * The bug: decree templates branched `custodyType === 'joint' ? joint : SOLE`,
 * so any unrecognized stored value (like the legacy free text "joint decision
 * making") fell through to a sole-custody order — the opposite of the parties'
 * agreement, in a signable court document. The fix routes every template
 * through templates/core/parenting.js resolveCustodyArrangement(), which
 * never lets an unrecognized value render a sole order.
 *
 * For EVERY jurisdiction decree template that renders a custody section:
 *   1. legacy "joint decision making" NEVER produces a sole order (it maps
 *      to the joint branch);
 *   2. enum 'joint' produces that jurisdiction's joint wording;
 *   3. an unrecognized value ("sole custody to mother") produces the neutral
 *      placeholder order plus a validation warning — never a sole order;
 *   4. 'sole_respondent' names the respondent as custodian, and any item that
 *      speaks of sole custody names the respondent, not the petitioner.
 *
 * Mechanism under test: templates/core/parenting.js + the per-jurisdiction
 * DivorceDecreeTemplate custody sections (state subclasses and the base
 * class fallback alike).
 */

const fs = require('fs');
const path = require('path');

const STATES = path.join(__dirname, '..', '..', 'templates', 'states');

const PETITIONER = 'Avery Quinn';
const RESPONDENT = 'Jordan Quinn';

const BASE_CASE = {
  county: 'Kings',
  petitionerName: PETITIONER,
  respondentName: RESPONDENT,
  caseNumber: 'FS-24-0001',
  marriageDate: '2012-06-15',
  separationDate: '2024-11-01',
  divorceDate: '2026-08-01',
  groundsForDivorce: 'separation',
  hasMinorChildren: true,
  children: [
    { name: 'Riley Quinn', dob: '2015-04-02' },
    { name: 'Casey Quinn', dob: '2018-09-20' },
  ],
  isUncontested: true,
};

// Montana's decree custody section adopts the filed parenting plan for every
// arrangement — genuinely neutral wording that never awards custody to either
// parent, so the joint-marker / placeholder / custodian-naming assertions do
// not apply. It still must never render a sole order and must warn on
// unrecognized values (base validateData).
const PLAN_BASED = new Set(['montana']);

// Discover every jurisdiction decree template that renders a custody section.
const JURISDICTIONS = fs
  .readdirSync(STATES, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .filter((dir) => fs.existsSync(path.join(STATES, dir, 'DivorceDecreeTemplate.js')))
  .map((dir) => {
    const Template = require(path.join(STATES, dir, 'DivorceDecreeTemplate.js'));
    return { dir, Template };
  })
  // Only sweep templates that actually emit a custody section for a case
  // with minor children (with an explicit custodyType so guarded sections
  // like North Carolina's render too).
  .filter(({ Template }) => {
    const doc = new Template().generateDocument({ ...BASE_CASE, custodyType: 'joint' });
    const custody = doc.sections && doc.sections.childCustody;
    return custody && Array.isArray(custody.items) && custody.items.length > 0;
  });

function custodyText(Template, data) {
  const doc = new Template().generateDocument({ ...BASE_CASE, ...data });
  const section = doc.sections.childCustody;
  return {
    doc,
    items: section.items.map((i) => i.content),
    text: section.items.map((i) => i.content).join('\n'),
  };
}

// Words that only ever appear in a sole-custody/sole-responsibility order.
const SOLE_RE = /\bsole\b|Sole Managing Conservator/i;
// Words present in every jurisdiction's joint wording (joint / shared /
// share / both / guardians-of-both phrasing).
const JOINT_RE = /\b(joint|shared?|sharing|both)\b/i;

describe('custody sweep — every jurisdiction decree with a custody section', () => {
  it('found the full jurisdiction sweep (sanity)', () => {
    // 87 subclassed custody sections + the base-class-routed jurisdictions.
    expect(JURISDICTIONS.length).toBeGreaterThanOrEqual(100);
  });

  describe.each(JURISDICTIONS)('$dir decree', ({ dir, Template }) => {
    const planBased = PLAN_BASED.has(dir);

    it('legacy "joint decision making" never produces a sole order', () => {
      const { text } = custodyText(Template, {
        custodyType: 'joint decision making',
        primaryCustodian: PETITIONER,
      });
      expect(text).not.toMatch(SOLE_RE);
      if (!planBased) expect(text).toMatch(JOINT_RE);
    });

    it("enum 'joint' produces the jurisdiction's joint wording", () => {
      const { text } = custodyText(Template, {
        custodyType: 'joint',
        primaryCustodian: PETITIONER,
      });
      if (!planBased) expect(text).toMatch(JOINT_RE);
      expect(text).not.toMatch(SOLE_RE);
    });

    it('an unrecognized value renders the neutral placeholder + a validation warning, never a sole order', () => {
      const { doc, text } = custodyText(Template, {
        custodyType: 'sole custody to mother',
      });
      if (!planBased) expect(text).toContain('[ARRANGEMENT');
      expect(text).not.toMatch(SOLE_RE);
      expect(
        doc.validation.warnings.some((w) => /was not recognized/.test(w))
      ).toBe(true);
    });

    it("'sole_respondent' names the respondent as custodian", () => {
      const { items, text } = custodyText(Template, {
        custodyType: 'sole_respondent',
      });
      if (!planBased) expect(text).toContain(RESPONDENT);
      expect(text).not.toContain('[ARRANGEMENT');
      const soleItems = items.filter((c) => SOLE_RE.test(c));
      soleItems.forEach((c) => {
        expect(c).toContain(RESPONDENT);
        expect(c).not.toContain(PETITIONER);
      });
    });

    it("'sole_petitioner' never awards custody to the respondent", () => {
      const { items } = custodyText(Template, {
        custodyType: 'sole_petitioner',
      });
      const soleItems = items.filter((c) => SOLE_RE.test(c));
      soleItems.forEach((c) => {
        expect(c).toContain(PETITIONER);
        expect(c).not.toContain(RESPONDENT);
      });
    });
  });
});
